(() => {
  const root = document.getElementById('bento-workflow');
  const main = root.querySelector('#b-main');
  const status = root.querySelector('#b-status');
  const planDate = '2026-10-19';
  const projects = [
    { id: 'creek', title: 'Creekside improvements', status: 'Active' },
    { id: 'elm', title: 'Elm Street drainage', status: 'Active' },
    { id: 'park', title: 'Park access review', status: 'Active' }
  ];
  const notes = [
    { id: 'coordination', project: 'creek', title: 'Weekly coordination', tags: ['coordination', 'review'] },
    { id: 'drainage', project: 'elm', title: 'Drainage review', tags: ['review'] }
  ];
  const defaults = {
    version: 2, view: 'daily', project: null, note: 'coordination', editor: 'write',
    documents: {
      coordination: '# Weekly coordination\n\nOctober 19, 2026\n\n## Discussion & decisions\n\nDiscussed review comments and the next coordination meeting.\n\n**Decision:** use the latest marked-up plan as the working reference.\n\nNext step: prepare a short agenda for the next coordination meeting.\n\n## Action items\n\n- [ ] Review the marked-up plan comments (due 2026-10-19)\n- [ ] Draft the coordination follow-up (due 2026-10-22)\n- [x] Link the latest working plan in the notes\n',
      drainage: '# Drainage review\n\nOctober 16, 2026\n\nReviewed the comment log before the next review.\n\n- [ ] Collect the outstanding reference notes (due 2026-10-16)\n- [ ] List questions for the next drainage review\n'
    }
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const escape = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const getNote = id => notes.find(note => note.id === id);
  const getProject = id => projects.find(project => project.id === id);
  const markerPattern = /<!--bento-source-line:(\d+)-->/g;
  const taskPrefix = /^([\t ]*(?:>[\t ]*)*(?:[-+*]|\d+[.)])[\t ]+\[([ xX])\])([\t ]+|$)/;
  const stripMarkers = text => text.replace(markerPattern, '');

  const markdown = new marked.Marked({
    renderer: {
      html({ text }) { return escape(stripMarkers(text)); },
      link({ tokens }) { return this.parser.parseInline(tokens); },
      image({ text }) { return `<span>[Image: ${escape(text)}]</span>`; },
      checkbox(token) {
        if (!Number.isInteger(token.sourceLine)) return '';
        return `<input type="checkbox" class="cursor-interaction" data-source-line="${token.sourceLine}" aria-label="Complete ${escape(token.taskTitle)}" ${token.checked ? 'checked' : ''}>`;
      }
    }
  });

  function validSnapshot(value) {
    return value?.version === 2 && ['daily', 'meeting', 'profile'].includes(value.view)
      && (value.project === null || projects.some(project => project.id === value.project))
      && getNote(value.note) && ['write', 'read'].includes(value.editor)
      && value.documents && notes.every(note => typeof value.documents[note.id] === 'string');
  }

  function restoreWorkspace(value) {
    if (validSnapshot(value)) return clone(value);
    // Preserve notes/tasks from the first prototype when the inline host has saved them.
    if (value?.bodies && Array.isArray(value.tasks)) {
      const migrated = clone(defaults);
      for (const note of notes) {
        if (typeof value.bodies[note.id] !== 'string') return clone(defaults);
        const rows = value.tasks.filter(task => task.note === note.id && typeof task.title === 'string')
          .map(task => `- [${task.done ? 'x' : ' '}] ${task.title}${task.due ? ` (due ${task.due})` : ''}`);
        migrated.documents[note.id] = `# ${note.title}\n\n${value.bodies[note.id]}\n\n## Action items\n\n${rows.join('\n')}\n`;
      }
      return migrated;
    }
    return clone(defaults);
  }

  let state = restoreWorkspace(window.openai?.widgetState?.privateContent);
  let profile = BentoProfile.read();
  let previous = null;
  let editingSnapshot = null;
  let proposal = false;
  const appearance = { theme: 'system' };

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00');
    return !Number.isNaN(date.valueOf()) && date.getFullYear() === Number(value.slice(0, 4))
      && date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
  }

  function taskDetails(item, line) {
    const rawTitle = stripMarkers(item.text).split('\n')[0].trim();
    const dueMatch = /\s+\(due (\d{4}-\d{2}-\d{2})\)$/.exec(rawTitle);
    const due = dueMatch && validDate(dueMatch[1]) ? dueMatch[1] : '';
    return { line, title: due ? rawTitle.slice(0, dueMatch.index) : rawTitle, due, done: item.checked === true };
  }

  function parseDocument(source) {
    // Annotate a temporary parse copy, never the actual Markdown. The parser decides
    // which candidates are real tasks (excluding fenced/indented code and HTML).
    const annotated = source.split('\n').map((line, index) => line.replace(taskPrefix,
      (_, prefix, checked, gap) => `${prefix}${gap || ' '}<!--bento-source-line:${index}-->`)).join('\n');
    const tokens = markdown.lexer(annotated);
    const tasks = [];
    marked.walkTokens(tokens, token => {
      if (token.type === 'code') token.text = stripMarkers(token.text);
      if (token.type !== 'list_item' || !token.task) return;
      const match = /^<!--bento-source-line:(\d+)-->/.exec(token.text);
      if (!match) return;
      const task = taskDetails(token, Number(match[1]));
      tasks.push(task);
      let checkbox;
      marked.walkTokens(token.tokens, child => {
        if (!checkbox && child.type === 'checkbox') checkbox = child;
      });
      if (checkbox) Object.assign(checkbox, { sourceLine: task.line, taskTitle: task.title });
      // Generated source markers must not appear in the readable document.
      marked.walkTokens(token.tokens, child => {
        if (child.type === 'html' && /^<!--bento-source-line:\d+-->$/.test(child.text)) child.text = '';
      });
    });
    return { tokens, tasks };
  }

  function allTasks() {
    return notes.flatMap(note => parseDocument(state.documents[note.id]).tasks
      .map(task => ({ ...task, id: `${note.id}:${task.line}`, note: note.id })));
  }

  const tasksFor = id => allTasks().filter(task => getNote(task.note).project === id);
  const dueLabel = due => !due ? 'No date' : due === planDate ? 'Today'
    : new Date(due + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  function notify(message) { status.textContent = message; }
  function persist() {
    window.openai?.setWidgetState?.({
      modelContent: { screen: state.view, project: state.project, openTodos: allTasks().filter(task => !task.done).length },
      privateContent: clone(state)
    })?.catch(() => {});
  }
  function change(operation, message) {
    previous = clone(state);
    operation();
    editingSnapshot = null;
    render();
    persist();
    notify(message);
  }
  function navigate(view, project = null, note = 'coordination') {
    state.view = view;
    state.project = project;
    state.note = note;
    proposal = false;
    editingSnapshot = null;
    render();
    persist();
  }

  function taskRow(task) {
    const note = getNote(task.note), project = getProject(note.project);
    return `<li class="b-task ${task.done ? 'b-done' : ''}">
      <input class="cursor-interaction" type="checkbox" data-task="${task.id}" aria-label="Complete ${escape(task.title)}" ${task.done ? 'checked' : ''}>
      <div><span class="b-task-title">${escape(task.title)}</span>
        <button class="b-source cursor-interaction" data-note="${note.id}" type="button">${escape(project.title)} · ${escape(note.title)} ↗</button>
      </div><span class="b-date ${!task.done && task.due && task.due < planDate ? 'b-overdue' : ''}">${dueLabel(task.due)}</span>
    </li>`;
  }

  function projectCard(project) {
    const tasks = tasksFor(project.id), open = tasks.filter(task => !task.done);
    const next = open.filter(task => task.due).sort((a, b) => a.due.localeCompare(b.due))[0];
    return `<section class="b-project">
      <button type="button" class="cursor-interaction" data-project="${project.id}">${escape(project.title)}</button>
      <p>${project.status} · ${open.length} open · ${tasks.length - open.length} complete</p>
      <p>${next ? 'Next due: ' + dueLabel(next.due) : open.length ? 'No dated work' : 'No outstanding work'}</p>
    </section>`;
  }

  function renderTaskGroups(open) {
    const groups = [
      ['Overdue', task => task.due && task.due < planDate],
      ['Today', task => task.due === planDate],
      ['Upcoming', task => task.due > planDate],
      ['Without a date', task => !task.due]
    ];
    return groups.map(([title, test]) => {
      const tasks = open.filter(test);
      return tasks.length ? `<section><h2>${title} <span class="b-muted">${tasks.length}</span></h2><ul class="b-list">${tasks.map(taskRow).join('')}</ul></section>` : '';
    }).join('');
  }

  function renderDaily() {
    const tasks = allTasks().filter(task => !state.project || getNote(task.note).project === state.project);
    const open = tasks.filter(task => !task.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const selected = state.project ? getProject(state.project) : null;
    main.innerHTML = `<p class="b-eyebrow">Sample plan · Monday, October 19 · ${selected ? 'Project overview' : 'All projects'}</p>
      <h1 id="b-greeting">${selected ? escape(selected.title) : escape(BentoProfile.greeting(profile))}</h1>
      <p class="b-muted">${open.length} open actions${selected ? ' in this project' : ' across your workspace'}.</p>
      <div class="b-actions">
        ${selected?.id !== 'park' ? `<button type="button" class="b-button b-primary cursor-interaction" data-open-meeting="${selected?.id === 'elm' ? 'drainage' : 'coordination'}">Open meeting note</button>` : ''}
        ${selected ? '<button type="button" class="b-button cursor-interaction" data-view="daily">All projects</button>' : ''}
        <button type="button" class="b-button cursor-interaction" data-undo ${previous ? '' : 'disabled'}>Undo last change</button>
      </div>
      <h2>${selected ? 'Project summary' : 'Active projects'}</h2>
      <div class="b-summary-grid">${projects.filter(project => !selected || project.id === selected.id).map(projectCard).join('')}</div>
      ${renderTaskGroups(open)}
      ${open.length ? '' : '<p class="b-muted">No outstanding work. Your project notes are still here.</p>'}
      <details><summary>Completed (${tasks.length - open.length})</summary><ul class="b-list">${tasks.filter(task => task.done).map(taskRow).join('')}</ul></details>`;
  }

  function resizeEditor() {
    const editor = main.querySelector('#b-markdown-editor');
    if (!editor) return;
    editor.style.height = 'auto';
    editor.style.height = Math.max(420, editor.scrollHeight + 4) + 'px';
  }

  function refreshDocument() {
    const parsed = parseDocument(state.documents[state.note]);
    main.querySelector('#b-reading').innerHTML = markdown.parser(parsed.tokens);
    main.querySelector('#b-task-count').textContent = `${parsed.tasks.length} tracked todos · ${parsed.tasks.filter(task => !task.done).length} open`;
    resizeEditor();
  }

  function renderMeeting() {
    const note = getNote(state.note), project = getProject(note.project);
    main.innerHTML = `<p class="b-eyebrow">${escape(project.title)} / Meeting notes</p>
      <div class="b-actions">
        ${note.tags.map(tag => `<span class="b-tag">${tag}</span>`).join('')}
        <button type="button" class="b-button cursor-interaction" data-project="${project.id}">View project</button>
        <button type="button" class="b-button cursor-interaction" data-undo ${previous ? '' : 'disabled'}>Undo last change</button>
      </div>
      <div class="b-actions" role="group" aria-label="Document mode">
        <button class="b-button cursor-interaction" type="button" data-editor="write" aria-pressed="${state.editor === 'write'}">Write Markdown</button>
        <button class="b-button cursor-interaction" type="button" data-editor="read" aria-pressed="${state.editor === 'read'}">Read</button>
      </div>
      <label id="b-editor-label" ${state.editor === 'write' ? '' : 'hidden'}>
        <span class="b-eyebrow">Meeting Markdown</span>
        <textarea class="b-editor" id="b-markdown-editor" aria-label="Meeting Markdown" spellcheck="false"></textarea>
      </label>
      <article id="b-reading" class="b-reading" aria-label="Rendered meeting note" ${state.editor === 'read' ? '' : 'hidden'}></article>
      <p id="b-task-count" class="b-muted" role="status" aria-live="polite"></p>
      <div class="b-actions"><button class="b-button cursor-interaction" type="button" data-propose>Preview agent suggestion</button></div>
      <section id="b-proposal" class="b-proposal" hidden aria-label="Sample agent suggestion">
        <h3>Sample agent suggestion</h3><p id="b-suggestion-text"></p>
        <p class="b-muted">From this note · no due date specified · simulated assistance</p>
        <div class="b-actions"><button type="button" class="b-button b-primary cursor-interaction" data-apply>Insert Markdown checkbox</button><button type="button" class="b-button cursor-interaction" data-dismiss>Dismiss</button></div>
      </section>`;
    main.querySelector('#b-markdown-editor').value = state.documents[note.id];
    refreshDocument();
    if (proposal) showProposal();
  }

  const suggestion = 'Prepare an agenda for the next coordination meeting';
  function showProposal() {
    const available = state.note === 'coordination' && state.documents[state.note].includes('prepare a short agenda')
      && !allTasks().some(task => task.note === state.note && task.title === suggestion);
    main.querySelector('#b-proposal').hidden = false;
    main.querySelector('#b-suggestion-text').textContent = available ? suggestion : 'No additional sample suggestion for the current note.';
    main.querySelector('[data-apply]').hidden = !available;
  }

  function refreshGreeting() {
    const heading = main.querySelector('#b-greeting');
    if (heading && !state.project) heading.textContent = BentoProfile.greeting(profile);
  }

  function renderProfile() {
    main.innerHTML = `<p class="b-eyebrow">Personal settings</p><h1>Your profile</h1>
      <p class="b-muted">Make Bento feel a little more like you.</p>
      <form id="b-profile-form">
        <div class="b-form">
          <label class="b-field">First name<input name="firstName" autocomplete="given-name" required maxlength="80" value="${escape(profile.firstName)}"></label>
          <label class="b-field">Last name<input name="lastName" autocomplete="family-name" maxlength="80" value="${escape(profile.lastName)}"></label>
          <label class="b-field">Birthday (optional)<input name="birthday" type="date" aria-label="Birthday" max="${BentoProfile.dateKey()}" value="${escape(profile.birthday)}"></label>
        </div>
        <p class="b-muted" style="margin-top:16px">Your birthday adds a little celebration to your daily greeting.</p>
        <div class="b-actions"><button type="submit" class="b-button b-primary cursor-interaction">Save profile</button><button type="button" class="b-button cursor-interaction" data-view="daily">Back to overview</button></div>
      </form>`;
  }

  function render() {
    root.dataset.theme = appearance.theme;
    root.querySelectorAll('[data-view]').forEach(button => {
      if (button.dataset.view === state.view && !state.project) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    root.querySelector('#b-project-nav').innerHTML = projects.map(project => `<button type="button" class="cursor-interaction" data-project="${project.id}" ${state.project === project.id ? 'aria-current="page"' : ''}>${project.title}</button>`).join('');
    if (state.view === 'daily') renderDaily();
    else if (state.view === 'profile') renderProfile();
    else renderMeeting();
    if (globalThis.lucide) lucide.createIcons({ attrs: { width: 16, height: 16 } });
  }

  function setTaskCompletion(noteId, line, done) {
    const task = allTasks().find(task => task.note === noteId && task.line === line);
    if (!task) return;
    change(() => {
      const lines = state.documents[noteId].split('\n');
      lines[line] = lines[line].replace(taskPrefix, (_, prefix, checked, gap) => prefix.slice(0, -2) + (done ? 'x' : ' ') + ']' + gap);
      state.documents[noteId] = lines.join('\n');
    }, done ? 'Todo completed in the Markdown document.' : 'Todo reopened in the Markdown document.');
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.view) navigate(button.dataset.view);
    else if (button.dataset.project) navigate('daily', button.dataset.project);
    else if (button.dataset.note || button.dataset.openMeeting) navigate('meeting', null, button.dataset.note || button.dataset.openMeeting);
    else if (button.dataset.editor) { state.editor = button.dataset.editor; editingSnapshot = null; render(); persist(); }
    else if (button.hasAttribute('data-undo') && previous) {
      state = previous; previous = null; editingSnapshot = null; proposal = false;
      render(); persist(); notify('Last document change undone.');
    } else if (button.hasAttribute('data-propose')) { proposal = true; showProposal(); }
    else if (button.hasAttribute('data-dismiss')) { proposal = false; main.querySelector('#b-proposal').hidden = true; }
    else if (button.hasAttribute('data-apply')) change(() => {
      state.documents[state.note] += `\n- [ ] ${suggestion}\n`;
      proposal = false;
    }, 'Inserted the reviewed checkbox into the Markdown document.');
  });

  root.addEventListener('change', event => {
    if (event.target.dataset.task) {
      const task = allTasks().find(task => task.id === event.target.dataset.task);
      if (task) setTaskCompletion(task.note, task.line, event.target.checked);
    } else if (event.target.hasAttribute('data-source-line')) {
      setTaskCompletion(state.note, Number(event.target.dataset.sourceLine), event.target.checked);
    }
  });

  root.addEventListener('input', event => {
    if (event.target.closest('#b-profile-form')) { event.target.setCustomValidity(''); return; }
    if (event.target.id !== 'b-markdown-editor') return;
    if (!editingSnapshot) { editingSnapshot = clone(state); previous = editingSnapshot; }
    state.documents[state.note] = event.target.value.replace(/\r\n?/g, '\n');
    refreshDocument();
    main.querySelector('[data-undo]').disabled = false;
    persist();
    notify('Markdown updated. Todos follow the document automatically.');
  });
  root.addEventListener('submit', event => {
    if (event.target.id !== 'b-profile-form') return;
    event.preventDefault();
    const form = event.target;
    const values = new FormData(form);
    const value = {
      version: 1, firstName: String(values.get('firstName') || '').trim(),
      lastName: String(values.get('lastName') || '').trim(), birthday: String(values.get('birthday') || '')
    };
    if (!BentoProfile.validate(value)) {
      form.elements.firstName.setCustomValidity('Enter a first name. Use a valid birthday or leave it blank.');
      form.reportValidity();
      return;
    }
    const result = BentoProfile.write(value);
    profile = result.profile;
    navigate('daily');
    notify(result.saved ? 'Profile saved in this browser.' : 'Profile kept for this session. Browser storage is unavailable.');
  });
  window.addEventListener('storage', event => {
    if (event.key === BentoProfile.key || event.key === null) {
      profile = BentoProfile.read();
      refreshGreeting();
    }
  });
  document.addEventListener('visibilitychange', refreshGreeting);
  setInterval(refreshGreeting, 60_000);
  window.addEventListener('resize', resizeEditor);
  window.addEventListener('openai:set_globals', event => {
    const saved = event.detail?.globals?.widgetState?.privateContent;
    if (validSnapshot(saved) && JSON.stringify(saved) !== JSON.stringify(state)) {
      state = clone(saved); previous = null; editingSnapshot = null; proposal = false; render();
    }
  });
  render();
  if (globalThis.Tweak) {
    const tweak = new Tweak({ container: root, onChange: () => { root.dataset.theme = appearance.theme; } });
    tweak.addSelect(appearance, 'theme', { label: 'Appearance', options: ['system', 'light', 'dark'] });
  }
})();
