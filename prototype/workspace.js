(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./vendor/marked.umd.js') : root.marked);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BentoWorkspace = api;
})(globalThis, function (marked) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`;
  const taskPrefix = /^([\t ]*(?:>[\t ]*)*(?:[-+*]|\d+[.)])[\t ]+\[([ xX])\])([\t ]+|$)/;
  const sourceMarkers = /<!--bento-source-line:\d+-->/g;
  const refMarker = /\s*<!-- bento-ref: ([\w-]+) -->\s*$/;
  const lexer = new marked.Marked();
  const stripMarkers = text => text.replace(sourceMarkers, '');
  const escapeLabel = text => text.replace(/([\\[\]`*_<>])/g, '\\$1');
  const unescapeLabel = text => text.replace(/\\([\\[\]`*_<>])/g, '$1');

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00');
    return !Number.isNaN(date.valueOf()) && date.getFullYear() === Number(value.slice(0, 4))
      && date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
  }

  function details(item, line, lines) {
    const content = stripMarkers(item.text).split('\n')[0].trim();
    const marker = refMarker.exec(content);
    const withoutMarker = content.replace(refMarker, '');
    const link = /^\[((?:\\.|[^\]\\])*)\]\(([^)]+)\)$/.exec(withoutMarker);
    const dueMatch = /\s+\(due (\d{4}-\d{2}-\d{2})\)$/.exec(withoutMarker);
    const due = !marker && dueMatch && validDate(dueMatch[1]) ? dueMatch[1] : '';
    return {
      line, content, prefix: taskPrefix.exec(lines[line])?.[0] || '',
      title: marker && link ? unescapeLabel(link[1]) : due ? withoutMarker.slice(0, dueMatch.index) : withoutMarker,
      due, done: item.checked === true, refId: marker?.[1] || null, href: link?.[2] || null
    };
  }

  function parse(body) {
    const lines = body.split('\n');
    const annotated = lines.map((line, index) => line.replace(taskPrefix,
      (_, prefix, checked, gap) => `${prefix}${gap || ' '}<!--bento-source-line:${index}-->`)).join('\n');
    const tokens = lexer.lexer(annotated), tasks = [];
    marked.walkTokens(tokens, token => {
      if (token.type === 'code') token.text = stripMarkers(token.text);
      if (token.type !== 'list_item' || !token.task) return;
      const match = /^<!--bento-source-line:(\d+)-->/.exec(token.text);
      if (!match) return;
      const task = details(token, Number(match[1]), lines);
      tasks.push(task);
      let checkbox, link;
      marked.walkTokens(token.tokens, child => {
        if (!checkbox && child.type === 'checkbox') checkbox = child;
        if (!link && child.type === 'link') link = child;
        if (child.type === 'html' && /^<!--bento-source-line:\d+-->$/.test(child.text)) child.text = '';
      });
      if (checkbox) Object.assign(checkbox, { sourceLine: task.line, taskTitle: task.title, referenceId: task.refId, sourceHref: task.href });
      if (link && task.refId) link.referenceId = task.refId;
    });
    return { tokens, tasks };
  }

  function capability(workspace, record, name) {
    return workspace.databases[record?.database]?.capabilities?.[name];
  }
  function taskInfo(workspace, record) {
    const cap = capability(workspace, record, 'task');
    if (!cap) return null;
    return {
      id: record.id, title: record.title,
      done: record.properties[cap.completion.field] === cap.completion.checked,
      due: record.properties[cap.due.field] || '',
      project: record.properties[cap.project.field] || null
    };
  }
  const allTasks = workspace => Object.values(workspace.records).map(record => taskInfo(workspace, record)).filter(Boolean);
  function activeProjects(workspace) {
    return Object.values(workspace.records).filter(record => {
      const cap = capability(workspace, record, 'project');
      return cap && cap.active.values.includes(record.properties[cap.active.field]);
    });
  }
  function projectOf(workspace, record) {
    const task = taskInfo(workspace, record);
    if (task) return task.project;
    if (capability(workspace, record, 'project')) return record.id;
    const fields = workspace.databases[record.database]?.fields || [];
    const targets = fields.filter(field => field.type === 'relation').flatMap(field => {
      const values = record.properties[field.id];
      return (Array.isArray(values) ? values : values ? [values] : [])
        .filter(value => capability(workspace, workspace.records[value], 'project'));
    });
    const unique = [...new Set(targets)];
    return unique.length === 1 ? unique[0] : null;
  }

  function makeRecord(recordId, database, title, body, properties = {}) {
    return { id: recordId, database, schema_version: 1, title, tags: [], properties, references: {}, body };
  }
  function createTodo(workspace, source, task) {
    const database = workspace.defaultTaskDatabase;
    const cap = workspace.databases[database]?.capabilities?.task;
    if (!cap) return null;
    const record = makeRecord(id('todo'), database, task.title, '', {
      [cap.completion.field]: task.done ? cap.completion.checked : cap.completion.unchecked,
      [cap.due.field]: task.due || null,
      [cap.project.field]: projectOf(workspace, source)
    });
    workspace.records[record.id] = record;
    return record;
  }
  function baseline(task) {
    return { target: task.id, base_title: task.title, base_completed: task.done };
  }
  function projectedLine(task, prefix, refId) {
    const marker = prefix.replace(/\[([ xX])\]/, task.done ? '[x]' : '[ ]');
    return `${marker}[${escapeLabel(task.title)}](${task.id}.md) <!-- bento-ref: ${refId} -->`;
  }
  function issue(workspace, record, line, message) {
    workspace.issues.push({ document: record.id, line, message });
  }

  function reconcileField(workspace, source, occurrence, target, reference, field, baseKey, current, write) {
    const input = occurrence[field], base = reference[baseKey];
    if (typeof base !== typeof current) {
      issue(workspace, source, occurrence.line, `Missing ${field} baseline; both versions preserved.`);
      return false;
    }
    if (input !== base && current !== base && input !== current) {
      issue(workspace, source, occurrence.line, `Conflicting ${field} changes; both versions preserved.`);
      return false;
    }
    if (input !== base && current === base) write(input);
    return true;
  }

  function reconcileReference(workspace, source, occurrence, reference) {
    const target = workspace.records[reference.target], task = taskInfo(workspace, target);
    if (!task || occurrence.href !== `${target.id}.md`) {
      issue(workspace, source, occurrence.line, 'Unresolved todo reference; document preserved.');
      return null;
    }
    const cap = capability(workspace, target, 'task');
    const titleOK = reconcileField(workspace, source, occurrence, target, reference, 'title', 'base_title', task.title,
      value => { target.title = value; });
    const statusOK = reconcileField(workspace, source, occurrence, target, reference, 'done', 'base_completed', task.done,
      value => { target.properties[cap.completion.field] = value ? cap.completion.checked : cap.completion.unchecked; });
    if (!titleOK || !statusOK) return null;
    const updated = taskInfo(workspace, target);
    Object.assign(reference, baseline(updated));
    return updated;
  }

  function reconcileDocument(workspace, source, capture, edits) {
    const lines = source.body.split('\n'), parsed = parse(source.body), seen = new Set();
    for (const occurrence of parsed.tasks) {
      let refId = occurrence.refId;
      let reference = source.references[refId];
      let target;
      if (!refId) {
        if (!capture || !occurrence.title.trim()) continue;
        target = createTodo(workspace, source, occurrence);
        if (!target) { issue(workspace, source, occurrence.line, 'Choose a task database to capture this checkbox.'); continue; }
        refId = id('ref');
        reference = baseline(taskInfo(workspace, target));
        source.references[refId] = reference;
      } else if (!reference) {
        const copies = Object.values(workspace.records).filter(record => record.id !== source.id)
          .map(record => record.references[refId]).filter(candidate => candidate && occurrence.href === `${candidate.target}.md`
            && candidate.base_title === occurrence.title && candidate.base_completed === occurrence.done);
        if (!copies.length || new Set(copies.map(candidate => candidate.target)).size !== 1) {
          issue(workspace, source, occurrence.line, 'Unknown reference; no new todo was created.');
          continue;
        }
        refId = id('ref');
        reference = clone(copies[0]);
        source.references[refId] = reference;
      } else if (seen.has(refId)) {
        // Pasting a linked checkbox adds an occurrence, not another task record.
        refId = id('ref');
        reference = clone(reference);
        source.references[refId] = reference;
      }
      seen.add(refId);
      const task = target ? taskInfo(workspace, target) : reconcileReference(workspace, source, occurrence, reference);
      if (!task) continue;
      const replacement = projectedLine(task, occurrence.prefix, refId);
      if (replacement !== lines[occurrence.line]) edits.push({ line: occurrence.line, old: lines[occurrence.line], replacement, capture: !occurrence.refId, prefixLength: occurrence.prefix.length, title: task.title });
      lines[occurrence.line] = replacement;
    }
    // Removing an occurrence unlinks it; the independently useful record survives.
    for (const refId of Object.keys(source.references)) {
      if (!seen.has(refId) && !parsed.tasks.some(task => task.refId === refId)) delete source.references[refId];
    }
    source.body = lines.join('\n');
  }

  function reconcileAll(workspace, captureId = null) {
    workspace.issues = [];
    const edits = [];
    // First accept the edited document's intents, then project those changes elsewhere.
    const records = Object.values(workspace.records);
    if (captureId) records.sort((a, b) => Number(b.id === captureId) - Number(a.id === captureId));
    for (const record of records) reconcileDocument(workspace, record, record.id === captureId, record.id === captureId ? edits : []);
    return edits;
  }

  function applyEdit(workspace, documentId, body) {
    const next = clone(workspace);
    if (!next.records[documentId]) throw new Error('Document not found.');
    next.records[documentId].body = body.replace(/\r\n?/g, '\n');
    const edits = reconcileAll(next, documentId);
    assertWorkspace(next);
    return { workspace: next, edits };
  }
  function updateTodo(workspace, documentId, patch) {
    const next = clone(workspace), record = next.records[documentId];
    const cap = capability(next, record, 'task');
    if (!cap) throw new Error('This document has no task capability.');
    if ('title' in patch) {
      if (typeof patch.title !== 'string' || !patch.title.trim() || /[\r\n]/.test(patch.title)) throw new Error('Enter a single-line title.');
      record.title = patch.title.trim();
    }
    if ('done' in patch) {
      if (typeof patch.done !== 'boolean') throw new Error('Completion must be a boolean.');
      record.properties[cap.completion.field] = patch.done ? cap.completion.checked : cap.completion.unchecked;
    }
    if ('due' in patch) {
      if (patch.due && !validDate(patch.due)) throw new Error('Enter a valid due date.');
      record.properties[cap.due.field] = patch.due || null;
    }
    if ('project' in patch) {
      if (patch.project && !capability(next, next.records[patch.project], 'project')) throw new Error('Project not found.');
      record.properties[cap.project.field] = patch.project || null;
    }
    reconcileAll(next);
    assertWorkspace(next);
    return next;
  }
  function setCheckbox(workspace, documentId, line, done) {
    const occurrence = parse(workspace.records[documentId].body).tasks.find(task => task.line === line);
    const reference = occurrence && workspace.records[documentId].references[occurrence.refId];
    if (reference) return updateTodo(workspace, reference.target, { done });
    const lines = workspace.records[documentId].body.split('\n');
    if (!occurrence) throw new Error('Checkbox not found.');
    lines[line] = lines[line].replace(taskPrefix, (_, prefix, checked, gap) => prefix.slice(0, -2) + (done ? 'x' : ' ') + ']' + gap);
    return applyEdit(workspace, documentId, lines.join('\n')).workspace;
  }
  function sourcesFor(workspace, targetId) {
    return Object.values(workspace.records).filter(record => Object.values(record.references).some(reference => reference.target === targetId));
  }
  function serializeDocument(record) {
    const { body, ...metadata } = record;
    const envelope = { bento_version: 1, ...metadata };
    return '---\n' + Object.entries(envelope).filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n') + '\n---\n\n' + body;
  }

  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function assertWorkspace(workspace) {
    if (!workspace || workspace.version !== 3 || !isObject(workspace.records) || !isObject(workspace.databases) || !Array.isArray(workspace.issues)) throw new Error('Invalid workspace.');
    for (const [key, database] of Object.entries(workspace.databases)) {
      if (database.id !== key || !Array.isArray(database.fields) || !isObject(database.capabilities)) throw new Error('Invalid database definition.');
      const fields = Object.fromEntries(database.fields.map(field => [field.id, field]));
      if (Object.keys(fields).length !== database.fields.length) throw new Error('Duplicate field identity.');
      for (const field of database.fields) {
        if (typeof field.id !== 'string' || !['text', 'number', 'boolean', 'date', 'select', 'relation'].includes(field.type)) throw new Error('Invalid field definition.');
        if (field.type === 'select' && (!Array.isArray(field.options) || new Set(field.options.map(option => option.id)).size !== field.options.length)) throw new Error('Invalid select options.');
        if (field.type === 'relation' && (!Object.hasOwn(workspace.databases, field.target_database) || !['one', 'many'].includes(field.cardinality))) throw new Error('Invalid relation definition.');
      }
      const task = database.capabilities.task;
      if (task) {
        const completion = fields[task.completion?.field];
        const values = completion?.options?.map(option => option.id) || [];
        if (completion?.type !== 'select' || !values.includes(task.completion.checked) || !values.includes(task.completion.unchecked) || task.completion.checked === task.completion.unchecked) throw new Error('Invalid completion mapping.');
        if (fields[task.due?.field]?.type !== 'date' || fields[task.project?.field]?.type !== 'relation') throw new Error('Invalid task field mapping.');
      }
    }
    for (const [key, record] of Object.entries(workspace.records)) {
      if (record.id !== key || !/^[\w-]+$/.test(key) || typeof record.title !== 'string' || typeof record.body !== 'string') throw new Error('Invalid document.');
      if (record.database !== undefined && (typeof record.database !== 'string' || !Object.hasOwn(workspace.databases, record.database))) throw new Error('A document must have zero or one valid database membership.');
      if (!isObject(record.properties) || !isObject(record.references) || !Array.isArray(record.tags) || !record.tags.every(tag => typeof tag === 'string')) throw new Error('Invalid document metadata.');
      if (record.database && record.schema_version !== workspace.databases[record.database].schema_version) throw new Error('Unsupported schema version.');
      for (const reference of Object.values(record.references)) {
        if (!isObject(reference) || typeof reference.target !== 'string') throw new Error('Invalid reference metadata.');
      }
      const cap = capability(workspace, record, 'task');
      if (cap && ![cap.completion.checked, cap.completion.unchecked].includes(record.properties[cap.completion.field])) throw new Error('Invalid task status.');
      const due = cap && record.properties[cap.due.field];
      if (due && !validDate(due)) throw new Error('Invalid task date.');
      for (const field of workspace.databases[record.database]?.fields || []) {
        const value = record.properties[field.id];
        if (value == null) continue;
        if (field.type === 'relation' && (field.cardinality === 'many' ? !Array.isArray(value) || !value.every(item => typeof item === 'string') : typeof value !== 'string')) throw new Error('Invalid relationship cardinality.');
      }
    }
    return true;
  }

  function createWorkspace(documents = {}) {
    const workspace = { version: 3, defaultTaskDatabase: 'db-todos', issues: [], databases: {
      'db-todos': { id: 'db-todos', title: 'Todos', schema_version: 1, fields: [
        { id: 'field-task-status', name: 'Status', type: 'select', options: [{ id: 'option-open', name: 'Open' }, { id: 'option-done', name: 'Done' }] },
        { id: 'field-task-due', name: 'Due date', type: 'date' },
        { id: 'field-task-project', name: 'Project', type: 'relation', target_database: 'db-projects', cardinality: 'one' }
      ], capabilities: { task: {
        completion: { field: 'field-task-status', checked: 'option-done', unchecked: 'option-open' },
        due: { field: 'field-task-due' }, project: { field: 'field-task-project' }
      } } },
      'db-projects': { id: 'db-projects', title: 'Projects', schema_version: 1, fields: [{ id: 'field-project-status', name: 'Status', type: 'select', options: [{ id: 'option-active', name: 'Active' }, { id: 'option-completed', name: 'Completed' }] }], capabilities: { project: { active: { field: 'field-project-status', values: ['option-active'] } } } },
      'db-meetings': { id: 'db-meetings', title: 'Meeting Notes', schema_version: 1, fields: [{ id: 'field-meeting-projects', name: 'Related projects', type: 'relation', target_database: 'db-projects', cardinality: 'many' }], capabilities: {} }
    }, records: {} };
    for (const [recordId, title] of [['creek', 'Creekside improvements'], ['elm', 'Elm Street drainage'], ['park', 'Park access review']]) {
      workspace.records[recordId] = makeRecord(recordId, 'db-projects', title, `# ${title}\n\nProject notes and reference material.\n`, { 'field-project-status': 'option-active' });
    }
    const meetingBodies = {
      coordination: '# Weekly coordination\n\nOctober 19, 2026\n\n## Discussion & decisions\n\nDiscussed review comments and the next coordination meeting.\n\n**Decision:** use the latest marked-up plan as the working reference.\n\nNext step: prepare a short agenda for the next coordination meeting.\n\n## Action items\n\n- [ ] Review the marked-up plan comments (due 2026-10-19)\n- [ ] Draft the coordination follow-up (due 2026-10-22)\n- [x] Link the latest working plan in the notes\n',
      drainage: '# Drainage review\n\nOctober 16, 2026\n\nReviewed the comment log before the next review.\n\n- [ ] Collect the outstanding reference notes (due 2026-10-16)\n- [ ] List questions for the next drainage review\n', ...documents
    };
    for (const [recordId, project, title] of [['coordination', 'creek', 'Weekly coordination'], ['drainage', 'elm', 'Drainage review']]) {
      workspace.records[recordId] = makeRecord(recordId, 'db-meetings', title, meetingBodies[recordId], { 'field-meeting-projects': [project] });
      reconcileAll(workspace, recordId);
    }
    assertWorkspace(workspace);
    return workspace;
  }

  return Object.freeze({ clone, parse, stripMarkers, refMarker, escapeLabel, validDate, capability, taskInfo, allTasks,
    activeProjects, projectOf, applyEdit, updateTodo, setCheckbox, sourcesFor, serializeDocument, assertWorkspace, createWorkspace });
});
