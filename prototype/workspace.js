(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./vendor/marked.umd.js') : root.marked, typeof module === 'object' && module.exports ? require('./schema.js') : root.BentoSchema);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BentoWorkspace = api;
})(globalThis, function (marked, schema) {
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
      title: link ? unescapeLabel(link[1]) : due ? withoutMarker.slice(0, dueMatch.index) : withoutMarker,
      due, done: item.checked === true, todoId: link ? targetId(link[2]) : null, href: link?.[2] || null
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
      if (checkbox) Object.assign(checkbox, { sourceLine: task.line, taskTitle: task.title, todoId: task.todoId, sourceHref: task.href });
      if (link && task.todoId) Object.assign(link, { todoId: task.todoId, sourceLine: task.line, taskTitle: task.title });
    });
    return { tokens, tasks };
  }

  function targetId(href) {
    if (typeof href !== 'string' || href.startsWith('/') || /[:?#\\]/.test(href)) return null;
    return /^([\w-]+)\.md$/i.exec(href.split('/').at(-1))?.[1] || null;
  }
  function linkFor(workspace, sourceId, target) {
    const destination = workspace.paths?.[target] || `${target}.md`;
    const from = (workspace.paths?.[sourceId] || '').split('/').slice(0, -1), to = destination.split('/');
    while (from.length && to.length && from[0] === to[0]) { from.shift(); to.shift(); }
    return '../'.repeat(from.length) + to.map(part => encodeURIComponent(part).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase())).join('/');
  }
  function linkMatches(workspace, sourceId, href, target) {
    if (!workspace.paths) return href === `${target}.md`;
    return href === linkFor(workspace, sourceId, target);
  }
  function capability(workspace, record, name) {
    return workspace.databases[record?.database]?.capabilities?.[name];
  }
  function taskInfo(workspace, record) {
    const cap = capability(workspace, record, 'task');
    if (!cap) return null;
    const status = workspace.databases[record.database].fields.find(field => field.id === cap.completion.field);
    const value = record.properties[cap.completion.field];
    return {
      id: record.id, title: record.title,
      done: status.type === 'status' ? status.options.find(option => option.id === value)?.group === 'complete' : value === cap.completion.checked,
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
    return { bento_version: 1, id: recordId, database, schema_version: 1, title, tags: [], properties, references: {}, body };
  }
  function createTodo(workspace, source, task) {
    const database = workspace.defaultTaskDatabase;
    const cap = workspace.databases[database]?.capabilities?.task;
    if (!cap) return null;
    const record = makeRecord(id('todo'), database, task.title, '', {
      ...schema.defaults(workspace.databases[database]),
      [cap.completion.field]: task.done ? cap.completion.checked : cap.completion.unchecked,
      [cap.due.field]: task.due || null,
      [cap.project.field]: projectOf(workspace, source)
    });
    record.schema_version = workspace.databases[database].schema_version;
    schema.properties(workspace.databases[database], record, workspace.records);
    workspace.records[record.id] = record;
    if (workspace.paths) workspace.paths[record.id] = `${workspace.databasePaths[database]}/${record.id}.md`;
    return record;
  }
  function baseline(task) {
    return { base_title: task.title, base_completed: task.done };
  }
  function projectedLine(workspace, source, task, prefix) {
    const marker = prefix.replace(/\[([ xX])\]/, task.done ? '[x]' : '[ ]');
    return `${marker}[${escapeLabel(task.title)}](${linkFor(workspace, source.id, task.id)})`;
  }
  function issue(workspace, record, line, message) {
    workspace.issues.push({ document: record.id, line, message });
  }

  function reconcileGroup(workspace, source, occurrences, reference, target) {
    const task = taskInfo(workspace, target), cap = capability(workspace, target, 'task');
    const proposed = {};
    for (const [field, baseKey] of [['title', 'base_title'], ['done', 'base_completed']]) {
      const base = reference[baseKey], current = task[field];
      if (typeof base !== typeof current) {
        issue(workspace, source, occurrences[0].line, `Missing ${field} baseline; both versions preserved.`);
        return null;
      }
      const changes = [...new Set(occurrences.map(item => item[field]).filter(value => value !== base))];
      if (changes.length > 1 || (changes.length && current !== base && changes[0] !== current)) {
        issue(workspace, source, occurrences[0].line, `Conflicting ${field} changes; both versions preserved.`);
        return null;
      }
      proposed[field] = changes.length ? changes[0] : current;
    }
    // Validate the whole group before mutating either canonical field.
    if (!proposed.title.trim()) {
      issue(workspace, source, occurrences[0].line, 'A todo needs a title; both versions preserved.');
      return null;
    }
    target.title = proposed.title;
    if (proposed.done !== task.done) target.properties[cap.completion.field] = proposed.done ? cap.completion.checked : cap.completion.unchecked;
    const updated = taskInfo(workspace, target);
    Object.assign(reference, baseline(updated));
    return updated;
  }

  function reconcileDocument(workspace, source, capture, edits) {
    const lines = source.body.split('\n'), parsed = parse(source.body), groups = new Map();
    for (const occurrence of parsed.tasks) {
      let targetId = occurrence.todoId;
      if (!occurrence.href) {
        if (!capture || !occurrence.title.trim()) continue;
        let target;
        try { target = createTodo(workspace, source, occurrence); }
        catch (error) { issue(workspace, source, occurrence.line, `Pending checkbox: ${error.message}`); continue; }
        if (!target) { issue(workspace, source, occurrence.line, 'Choose a task database to capture this checkbox.'); continue; }
        targetId = target.id;
        source.references[targetId] = baseline(taskInfo(workspace, target));
      }
      const target = workspace.records[targetId], task = taskInfo(workspace, target);
      if (!task || (occurrence.href && !linkMatches(workspace, source.id, occurrence.href, targetId))) {
        issue(workspace, source, occurrence.line, 'Unresolved todo link; document preserved.');
        continue;
      }
      if (!source.references[targetId]) {
        // A newly pasted link associates a record only when its projection agrees.
        if (occurrence.title !== task.title || occurrence.done !== task.done) {
          issue(workspace, source, occurrence.line, 'New todo link differs from its document; both versions preserved.');
          continue;
        }
        source.references[targetId] = baseline(task);
      }
      if (!groups.has(targetId)) groups.set(targetId, []);
      groups.get(targetId).push(occurrence);
    }
    for (const [targetId, occurrences] of groups) {
      const task = reconcileGroup(workspace, source, occurrences, source.references[targetId], workspace.records[targetId]);
      if (!task) continue;
      for (const occurrence of occurrences) {
        const replacement = projectedLine(workspace, source, task, occurrence.prefix);
        if (replacement !== lines[occurrence.line]) edits.push({ line: occurrence.line, old: lines[occurrence.line], replacement, capture: !occurrence.todoId, prefixLength: occurrence.prefix.length, title: task.title });
        lines[occurrence.line] = replacement;
      }
    }
    // Removing a link retains the independently useful todo document.
    const linked = new Set(parsed.tasks.map(task => task.todoId).filter(Boolean));
    for (const targetId of Object.keys(source.references)) {
      if (!groups.has(targetId) && !linked.has(targetId)) delete source.references[targetId];
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
    if ('status' in patch) {
      const field = next.databases[record.database].fields.find(field => field.id === cap.completion.field);
      schema.value(field, patch.status);
      record.properties[field.id] = patch.status;
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
    const reference = occurrence && workspace.records[documentId].references[occurrence.todoId];
    if (reference) return updateTodo(workspace, occurrence.todoId, { done });
    const lines = workspace.records[documentId].body.split('\n');
    if (!occurrence) throw new Error('Checkbox not found.');
    lines[line] = lines[line].replace(taskPrefix, (_, prefix, checked, gap) => prefix.slice(0, -2) + (done ? 'x' : ' ') + ']' + gap);
    return applyEdit(workspace, documentId, lines.join('\n')).workspace;
  }
  function sourcesFor(workspace, targetId) {
    return Object.values(workspace.records).filter(record => Object.hasOwn(record.references, targetId));
  }
  function serializeDocument(record) {
    const { body, database, ...metadata } = record;
    const envelope = { bento_version: 1, ...metadata };
    return '---\n' + Object.entries(envelope).filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n') + '\n---\n\n' + body;
  }

  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function assertWorkspace(workspace) {
    if (!workspace || workspace.version !== 4 || !isObject(workspace.records) || !isObject(workspace.databases) || !Array.isArray(workspace.issues)) throw new Error('Invalid workspace.');
    for (const [key, database] of Object.entries(workspace.databases)) {
      if (database.id !== key || !Array.isArray(database.fields) || !isObject(database.capabilities)) throw new Error('Invalid database definition.');
      schema.definition(database, workspace.databases);
      const fields = Object.fromEntries(database.fields.map(field => [field.id, field]));
      const task = database.capabilities.task;
      if (task) {
        const completion = fields[task.completion?.field];
        const values = completion?.options?.map(option => option.id) || [];
        if (!['select', 'status'].includes(completion?.type) || !values.includes(task.completion.checked) || !values.includes(task.completion.unchecked) || task.completion.checked === task.completion.unchecked) throw new Error('Invalid completion mapping.');
        if (completion.type === 'status' && (completion.options.find(option => option.id === task.completion.checked).group !== 'complete' || completion.options.find(option => option.id === task.completion.unchecked).group === 'complete')) throw new Error('Invalid completion group mapping.');
        if (fields[task.due?.field]?.type !== 'date' || fields[task.project?.field]?.type !== 'relation') throw new Error('Invalid task field mapping.');
      }
      const project = database.capabilities.project;
      if (project) {
        const active = project.active, field = fields[active?.field];
        if (!['select', 'status'].includes(field?.type) || !Array.isArray(active?.values) || !active.values.length || !active.values.every(value => field.options.some(option => option.id === value))) throw new Error('Invalid active-project mapping.');
      }
    }
    for (const [key, record] of Object.entries(workspace.records)) {
      if (record.id !== key || !/^[\w-]+$/.test(key) || typeof record.title !== 'string' || typeof record.body !== 'string') throw new Error('Invalid document.');
      if (record.database !== undefined && (typeof record.database !== 'string' || !Object.hasOwn(workspace.databases, record.database))) throw new Error('A document must have zero or one valid database membership.');
      if (!isObject(record.properties) || !isObject(record.references) || !Array.isArray(record.tags) || !record.tags.every(tag => typeof tag === 'string')) throw new Error('Invalid document metadata.');
      if (record.database && record.schema_version !== workspace.databases[record.database].schema_version) throw new Error('Unsupported schema version.');
      for (const reference of Object.values(record.references)) {
        if (!isObject(reference) || ('target' in reference)) throw new Error('Invalid reference metadata.');
      }
      const cap = capability(workspace, record, 'task');
      if (record.database) schema.properties(workspace.databases[record.database], record, workspace.records);
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

  function migrateWorkspace(value) {
    if (value?.version === 4) { assertWorkspace(value); return clone(value); }
    if (value?.version !== 3) throw new Error('Unsupported workspace version.');
    const next = clone(value);
    for (const record of Object.values(next.records)) {
      const references = {};
      for (const reference of Object.values(record.references)) {
        if (!reference || typeof reference.target !== 'string') throw new Error('Invalid legacy reference.');
        const candidate = { base_title: reference.base_title, base_completed: reference.base_completed };
        if (references[reference.target] && JSON.stringify(references[reference.target]) !== JSON.stringify(candidate)) {
          throw new Error('Legacy references disagree; the saved copy needs repair.');
        }
        references[reference.target] = candidate;
      }
      const lines = record.body.split('\n');
      for (const occurrence of parse(record.body).tasks) {
        const legacyId = refMarker.exec(occurrence.content)?.[1];
        const legacy = record.references[legacyId];
        if (legacyId && (!legacy || occurrence.href !== `${legacy.target}.md`)) throw new Error('Legacy reference does not match its link.');
        if (legacy) lines[occurrence.line] = lines[occurrence.line].replace(refMarker, '');
      }
      record.references = references;
      record.body = lines.join('\n');
    }
    next.version = 4;
    assertWorkspace(next);
    return next;
  }

  function createWorkspace(documents = {}) {
    const workspace = { version: 4, defaultTaskDatabase: 'db-todos', issues: [], databases: {
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

  return Object.freeze({ clone, parse, stripMarkers, refMarker, escapeLabel, targetId, linkFor, linkMatches, validDate, capability, taskInfo, allTasks,
    activeProjects, projectOf, applyEdit, updateTodo, setCheckbox, sourcesFor, serializeDocument, assertWorkspace, migrateWorkspace, createWorkspace });
});
