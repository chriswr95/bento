import { projectReview } from './project-review.js';
import { legacyPreferences } from './personal-settings.js';
import { appearanceKey, readTheme, saveTheme, isDark, nextTheme } from './appearance.js';
import { propertyForm, propertyPatch } from './property-editor.js';
import { directoryTree, DirectoryState } from './directory-tree.js';
import BentoWorkspace from './workspace.js';
import BentoProfile from './profile.js';
import RichEditor from './vendor/rich-editor.js';
import BentoFileSession from './file-session.js';
(async () => {
  const root = document.getElementById('bento-workflow');
  const main = root.querySelector('#b-main'), status = root.querySelector('#b-status');
  const model = BentoWorkspace, clone = model.clone, storageKey = 'bento.prototype.workspace.v4';
  let planDate = window.bentoDesktop ? BentoProfile.dateKey() : '2026-10-19';
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const desktop = window.bentoDesktop;
  let personalSettings = null;
  const appearance = { theme: readTheme() };
  const systemAppearance = matchMedia('(prefers-color-scheme: dark)');
  function applyAppearance() {
    root.dataset.theme = appearance.theme;
    document.documentElement.style.colorScheme = appearance.theme === 'system' ? 'light dark' : appearance.theme;
    const toggle = root.querySelector('[data-theme-toggle]');
    const dark = isDark(appearance.theme, systemAppearance.matches);
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    toggle.querySelector('[data-theme-icon="sun"]').toggleAttribute('hidden', !dark);
    toggle.querySelector('[data-theme-icon="moon"]').toggleAttribute('hidden', dark);
  }
  async function changeAppearance(theme) {
    appearance.theme = theme; applyAppearance();
    if (desktop) {
      try { await savePersonal({ appearance: theme }); }
      catch (error) { notify(`Appearance changed for this session. ${error.message}`); }
    } else if (!saveTheme(theme)) notify('Appearance changed for this session. Local settings could not be saved.');
  }
  async function savePersonal(patch) {
    const result = await desktop.settingsSave(patch);
    if (!result.ok) throw new Error(result.error);
    personalSettings = result.value;
  }
  async function loadPersonal() {
    const result = await desktop.settingsRead(legacyPreferences());
    if (!result.ok) { notify(result.error); return; }
    personalSettings = result.value;
    profile = personalSettings.profile; appearance.theme = personalSettings.appearance;
    applyAppearance();
    if (personalSettings.warning) notify(personalSettings.warning);
  }
  systemAppearance.addEventListener('change', applyAppearance);
  applyAppearance();
  let previous = null, editingSnapshot = null, proposal = false, storageLocked = false, expectedStorage = null;
  let storageWarning = '';

  function validSnapshot(value) {
    try {
      return value?.version === 4 && ['daily', 'document', 'profile'].includes(value.view)
        && model.assertWorkspace(value.workspace)
        && !!value.workspace.records[value.document] && (!value.project || !!value.workspace.records[value.project]);
    } catch { return false; }
  }
  function loadWorkspace() {
    let host = window.openai?.widgetState?.privateContent;
    const upgrade = snapshot => ({ ...snapshot, version: 4, workspace: model.migrateWorkspace(snapshot.workspace) });
    try { if (host?.version === 3) host = upgrade(host); } catch { host = null; }
    let local;
    try {
      expectedStorage = localStorage.getItem(storageKey);
      if (expectedStorage) {
        local = JSON.parse(expectedStorage);
        if (!validSnapshot(local)) throw new Error('Invalid saved workspace');
      }
    } catch {
      if (expectedStorage) { storageLocked = true; storageWarning = 'Saved workspace needs repair; it has been left unchanged.'; }
      else storageWarning = 'Browser storage unavailable; workspace changes will stay in this session.';
    }
    const candidates = [host, local].filter(validSnapshot).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    if (candidates.length) return clone(candidates[0]);
    try {
      const legacy = localStorage.getItem('bento.prototype.workspace.v3');
      if (!expectedStorage && legacy) {
        const migrated = upgrade(JSON.parse(legacy));
        if (!validSnapshot(migrated)) throw new Error('Invalid migrated workspace');
        return migrated;
      }
    } catch {
      storageWarning = 'Earlier saved workspace needs repair; its original copy has been left unchanged.';
      storageLocked = true;
    }
    let documents = {};
    if (host?.version === 2 && host.documents) {
      documents = Object.fromEntries(['coordination', 'drainage'].filter(key => typeof host.documents[key] === 'string').map(key => [key, host.documents[key]]));
    } else if (host?.bodies && Array.isArray(host.tasks)) {
      for (const key of ['coordination', 'drainage']) {
        if (typeof host.bodies[key] === 'string') documents[key] = host.bodies[key] + '\n\n' + host.tasks.filter(task => task.note === key)
          .map(task => `- [${task.done ? 'x' : ' '}] ${String(task.title)}${task.due ? ` (due ${task.due})` : ''}`).join('\n');
      }
    }
    return { version: 4, savedAt: 0, view: 'daily', project: null, document: 'coordination', note: 'coordination', workspace: model.createWorkspace(documents) };
  }
  let files = null, directoryState = null;
  let state = desktop ? { version: 4, view: 'daily', project: null, document: null, note: null, workspace: { version: 4, databases: {}, records: {}, issues: [] } } : loadWorkspace();
  let profile = BentoProfile.read();
  const workspace = () => state.workspace;
  const record = () => workspace().records[state.document];
  const getProject = projectId => workspace().records[projectId];
  const allTasks = () => model.allTasks(workspace());
  const dueLabel = due => !due ? 'No date' : due === planDate ? 'Today'
    : new Date(due + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  let liveEditor = null, creation = null;

  function notify(message) { status.textContent = storageWarning ? `${message} ${storageWarning}` : message; }
  function persist() {
    if (desktop) { files?.changed(workspace()); return; }
    state.savedAt = Date.now();
    const snapshot = JSON.stringify(state);
    if (!storageLocked) {
      try {
        if (localStorage.getItem(storageKey) !== expectedStorage) {
          storageLocked = true;
          storageWarning = 'Another page changed the saved workspace. These edits remain in this session; the other copy was not overwritten.';
        } else {
          localStorage.setItem(storageKey, snapshot);
          expectedStorage = snapshot;
          storageWarning = '';
        }
      } catch { storageWarning = 'Browser storage unavailable; these changes remain in this session.'; }
    }
    const privateContent = new TextEncoder().encode(snapshot).byteLength < 13_000 ? clone(state) : null;
    window.openai?.setWidgetState?.({ modelContent: {
      screen: state.view, project: state.project, openTodos: allTasks().filter(task => !task.done).length
    }, privateContent })?.catch(() => {});
  }
  function change(operation, message) {
    const next = operation();
    previous = clone(state);
    state.workspace = next;
    editingSnapshot = null;
    render(); persist(); notify(message);
  }
  function navigate(view, project = null, documentId = state.document) {
    state.view = view; state.project = project; state.document = documentId;
    if (view === 'document') directoryState?.reveal(workspace().paths?.[documentId]);
    if (workspace().records[documentId]?.database === 'db-meetings') state.note = documentId;
    editingSnapshot = null; proposal = false;
    render(); persist();
    if (desktop) desktop.rememberLocation({ view, project, document: documentId || null }).then(result => { if (!result.ok) notify('Your last page could not be saved. Workspace edits are unaffected.'); });
  }
  function openRecord(documentId) {
    if (Object.hasOwn(workspace().records, documentId)) navigate('document', null, documentId);
  }

  function projectDatabase() {
    return Object.values(workspace().databases).find(database => database.capabilities.project);
  }
  function projectField(database) {
    return database?.fields.find(field => field.type === 'relation' && workspace().databases[field.target_database]?.capabilities.project);
  }
  function meetingDatabase() {
    return Object.values(workspace().databases).find(database => !database.capabilities.task && !database.capabilities.project && projectField(database));
  }
  function creationLabel(database) {
    return database.capabilities.project ? 'New project' : database.capabilities.task ? 'New todo' : database.id === meetingDatabase()?.id ? 'New meeting note' : `New page in ${database.title}`;
  }
  function showCreate(databaseId, project = null) {
    if (files?.view?.readOnly) return notify('Repair this workspace before creating documents.');
    creation = { database: databaseId, project, previous: { view: state.view, project: state.project, document: state.document } };
    state.view = 'create'; render();
    main.querySelector('[name="title"]').focus();
  }
  function renderCreation() {
    const database = workspace().databases[creation.database], relation = projectField(database);
    const projects = Object.values(workspace().records).filter(doc => model.capability(workspace(), doc, 'project') && (model.activeProjects(workspace()).some(active => active.id === doc.id) || doc.id === creation.project));
    main.innerHTML = `<p class="b-eyebrow">${escape(database.title)}</p><h1>${escape(creationLabel(database))}</h1>
      <p class="b-muted">A Markdown document for your notes and details.</p>
      <form id="b-create-document"><label class="b-field">Title<input name="title" aria-label="Document title" required maxlength="200" placeholder="${database.capabilities.project ? 'e.g. Creekside improvements' : 'Give this page a title'}"></label>
      ${relation ? `<label class="b-field">Project<select name="project" aria-label="Project"><option value="">Unassigned</option>${projects.map(project => `<option value="${project.id}" ${creation.project === project.id ? 'selected' : ''}>${escape(project.title)}</option>`).join('')}</select></label>` : ''}
      <p id="b-create-error" class="b-issues" role="alert" hidden></p>
      <div class="b-actions"><button type="submit" class="b-button b-primary">${database.capabilities.project ? 'Create project' : 'Create page'}</button><button type="button" class="b-button" data-cancel-create>Cancel</button></div></form>`;
  }
  function directoryContents(node) {
    const folders = node.folders.map(directoryFolder).join('');
    const documents = node.documents.map(doc => `<li><button type="button" class="b-tree-document" data-record="${escape(doc.id)}" title="${escape(doc.path)}" ${state.view === 'document' && state.document === doc.id ? 'aria-current="page"' : ''}><span aria-hidden="true">≡</span><span>${escape(doc.title)}</span></button></li>`).join('');
    return `<ul class="b-tree-children">${folders}${documents}${folders || documents ? '' : '<li class="b-tree-empty">No pages yet</li>'}</ul>`;
  }
  function directoryFolder(node) {
    const database = node.database;
    const label = node.path ? database?.title || node.name : files.view.title;
    const fallback = node.path === '' || (database ? !database.capabilities.task : !node.path.includes('/'));
    return `<li class="b-tree-folder"><details data-directory="${escape(node.path)}" ${directoryState.expanded(node.path, fallback) ? 'open' : ''}>
      <summary title="${escape(node.path || files.view.folder)}"><span class="b-tree-chevron" aria-hidden="true"></span><span class="b-tree-folder-name">${escape(label)}</span></summary>
      ${directoryContents(node)}</details>
      ${database ? `<button type="button" class="b-tree-create" data-create="${escape(database.id)}" aria-label="${escape(creationLabel(database))}" title="${escape(creationLabel(database))}" ${files.view.readOnly ? 'disabled' : ''}>+</button>` : ''}</li>`;
  }
  function renderSidebar() {
    const sidebar = root.querySelector('aside');
    sidebar.hidden = !files?.view;
    if (sidebar.hidden) return;
    sidebar.innerHTML = `<nav class="b-nav" aria-label="Workspace"><button type="button" data-view="daily" ${state.view === 'daily' ? 'aria-current="page"' : ''}>Daily overview</button></nav>
      <nav class="b-directory-tree" aria-label="Workspace files"><ul>${directoryFolder(directoryTree(workspace()))}</ul></nav>
      <nav class="b-nav b-sidebar-settings" aria-label="Settings"><button type="button" data-view="profile" ${state.view === 'profile' ? 'aria-current="page"' : ''}>Profile</button></nav>`;
  }

  function taskRow(task) {
    const project = getProject(task.project), source = model.sourcesFor(workspace(), task.id)[0];
    return `<li class="b-task ${task.done ? 'b-done' : ''}">
      <input class="cursor-interaction" type="checkbox" data-task="${task.id}" aria-label="Complete ${escape(task.title)}" ${task.done ? 'checked' : ''}>
      <div><button class="b-task-title b-document-link cursor-interaction" type="button" data-record="${task.id}">${escape(task.title)}</button>
        ${source ? `<button class="b-source cursor-interaction" data-record="${source.id}" type="button">${escape(project?.title || 'Unassigned')} · ${escape(source.title)} ↗</button>` : `<span class="b-source">${escape(project?.title || 'Unassigned')} · No source reference</span>`}
      </div><span class="b-date ${!task.done && task.due && task.due < planDate ? 'b-overdue' : ''}">${dueLabel(task.due)}</span>
    </li>`;
  }
  function projectCard(project) {
    const tasks = allTasks().filter(task => task.project === project.id), open = tasks.filter(task => !task.done);
    const next = open.filter(task => task.due).sort((a, b) => a.due.localeCompare(b.due))[0];
    return `<section class="b-project"><button type="button" class="cursor-interaction" ${desktop ? `data-record="${project.id}"` : `data-project="${project.id}"`}>${escape(project.title)}</button>
      <p><button type="button" data-project="${project.id}">Review work</button></p><p>Active · ${open.length} open · ${tasks.length - open.length} complete</p>
      <p>${next ? 'Next due: ' + dueLabel(next.due) : open.length ? 'No dated work' : 'No outstanding work'}</p></section>`;
  }
  function renderTaskGroups(open) {
    const groups = [['Overdue', task => task.due && task.due < planDate], ['Today', task => task.due === planDate],
      ['Upcoming', task => task.due > planDate], ['Without a date', task => !task.due]];
    return groups.map(([title, test]) => {
      const tasks = open.filter(test);
      return tasks.length ? `<section><h2>${title} <span class="b-muted">${tasks.length}</span></h2><ul class="b-list">${tasks.map(taskRow).join('')}</ul></section>` : '';
    }).join('');
  }
  function renderProjectReview() {
    const review = projectReview(workspace(), state.project, planDate);
    const groups = [['Overdue', 'overdue'], ['Today', 'today'], ['Upcoming', 'upcoming'], ['Without a date', 'undated']];
    main.innerHTML = `<p class="b-eyebrow">Project review · ${escape(planDate)}</p><h1>${escape(review.project.title)}</h1>
      <p class="b-muted">${review.open} open action${review.open === 1 ? '' : 's'} · ${review.groups.completed.length} completed · ${review.notes.length} related note${review.notes.length === 1 ? '' : 's'}</p>
      <div class="b-actions"><button type="button" class="b-button b-primary" data-record="${review.project.id}">Open project document</button><button type="button" class="b-button" data-view="daily">All projects</button></div>
      <section aria-label="Related notes"><h2>Related notes <span class="b-muted">${review.notes.length}</span></h2>
      ${review.notes.length ? `<ul class="b-list">${review.notes.map(note => `<li class="b-review-note"><button type="button" class="b-document-link" data-record="${note.id}">${escape(note.title)}</button><span class="b-muted">${escape(workspace().databases[note.database]?.title || 'Notes')}</span></li>`).join('')}</ul>` : '<p class="b-muted">No related notes yet. Link a meeting note to this project through its Properties.</p>'}</section>
      ${groups.map(([title, key]) => `<section aria-label="${title}"><h2>${title} <span class="b-muted">${review.groups[key].length}</span></h2>${review.groups[key].length ? `<ul class="b-list">${review.groups[key].map(taskRow).join('')}</ul>` : '<p class="b-muted">No work in this group.</p>'}</section>`).join('')}
      <details class="b-review-completed"><summary>Completed (${review.groups.completed.length})</summary><ul class="b-list">${review.groups.completed.map(taskRow).join('')}</ul></details>`;
  }
  function renderDaily() {
    if (state.project) { renderProjectReview(); return; }

    if (desktop && !Object.keys(workspace().records).length) {
      const projects = projectDatabase();
      main.innerHTML = `<p class="b-eyebrow">Your workspace is ready</p><h1>${escape(BentoProfile.greeting(profile))}</h1>
        <section class="b-onboarding"><h2>Create your first project</h2><p>Start with a project, then add meeting notes and turn checkboxes into todos.</p>
        ${projects ? `<button type="button" class="b-button b-primary" data-create="${projects.id}" ${files.view.readOnly ? 'disabled' : ''}>Create your first project</button>` : '<p>Add a page using a database in the sidebar.</p>'}</section>`;
      return;
    }
    const tasks = allTasks().filter(task => !state.project || task.project === state.project);
    const open = tasks.filter(task => !task.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const selected = getProject(state.project);
    const meeting = Object.values(workspace().records).find(doc => doc.database === 'db-meetings' && (!selected || model.projectOf(workspace(), doc) === selected.id));
    main.innerHTML = `<p class="b-eyebrow">${desktop ? escape(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })) : 'Sample plan · Monday, October 19'} · ${selected ? 'Project overview' : 'All projects'}</p>
      <h1 id="b-greeting">${selected ? escape(selected.title) : escape(BentoProfile.greeting(profile))}</h1>
      <p class="b-muted">${open.length} open actions${selected ? ' in this project' : ' across your workspace'}.</p>
      <div class="b-actions">
        ${meeting ? `<button type="button" class="b-button b-primary cursor-interaction" data-record="${meeting.id}">Open meeting note</button>` : ''}
        ${selected ? `<button type="button" class="b-button cursor-interaction" data-record="${selected.id}">Open project document</button><button type="button" class="b-button cursor-interaction" data-view="daily">All projects</button>` : ''}
        <button type="button" class="b-button cursor-interaction" data-undo ${previous ? '' : 'disabled'}>Undo last change</button>
      </div><h2>${selected ? 'Project summary' : 'Active projects'}</h2>
      <div class="b-summary-grid">${model.activeProjects(workspace()).filter(project => !selected || project.id === selected.id).map(projectCard).join('')}</div>
      ${renderTaskGroups(open)}${open.length ? '' : '<p class="b-muted">No outstanding work. Your project notes are still here.</p>'}
      <details><summary>Completed (${tasks.length - open.length})</summary><ul class="b-list">${tasks.filter(task => task.done).map(taskRow).join('')}</ul></details>`;
  }

  function refreshDocument() {
    const parsed = model.parse(record().body);
    const targets = new Set(parsed.tasks.map(task => task.todoId).filter(id => record().references[id]));
    main.querySelector('#b-task-count').textContent = `${targets.size} linked todos in this document`;
    const issues = workspace().issues.filter(item => item.document === record().id);
    const panel = main.querySelector('#b-document-issues');
    panel.hidden = !issues.length;
    panel.textContent = issues.map(item => `Line ${item.line + 1}: ${item.message}`).join(' ');
  }
  function taskProperties(task) {
    const sources = model.sourcesFor(workspace(), task.id);
    const projects = model.activeProjects(workspace());
    if (task.project && getProject(task.project) && !projects.some(project => project.id === task.project)) projects.push(getProject(task.project));
    const completion = model.capability(workspace(), record(), 'task').completion;
    const statusField = workspace().databases[record().database].fields.find(field => field.id === completion.field);
    return `<form id="b-todo-properties" class="b-properties">
      <label class="b-field">Title<input name="title" aria-label="Todo title" maxlength="200" required value="${escape(task.title)}"></label>
      <label class="b-field">Status<select name="status" aria-label="Status">${statusField.options.map(option => `<option value="${escape(option.id)}" ${record().properties[statusField.id] === option.id ? 'selected' : ''}>${escape(option.name)}</option>`).join('')}</select></label>
      <label class="b-completion"><input type="checkbox" data-todo-completed aria-label="Completed" ${task.done ? 'checked' : ''}>Completed</label>
      <div class="b-form"><label class="b-field">Due date (optional)<input name="due" type="date" aria-label="Due date" value="${escape(task.due)}"></label>
        <label class="b-field">Project<select name="project" aria-label="Project"><option value="">Unassigned</option>${projects.map(project => `<option value="${project.id}" ${task.project === project.id ? 'selected' : ''}>${escape(project.title)}</option>`).join('')}</select></label></div>
      <div class="b-actions"><button type="submit" class="b-button cursor-interaction">Save properties</button>${sources.map(source => `<button type="button" class="b-button cursor-interaction" data-record="${source.id}">Back to ${escape(source.title)}</button>`).join('')}</div>
    </form>`;
  }
  function renderDocument() {
    const doc = record(), database = workspace().databases[doc.database], task = model.taskInfo(workspace(), doc);
    const label = task ? 'Todo Markdown' : doc.database === meetingDatabase()?.id ? 'Meeting Markdown' : model.capability(workspace(), doc, 'project') ? 'Project Markdown' : 'Page Markdown';
    const isProject = model.capability(workspace(), doc, 'project'), meetings = meetingDatabase();
    const actions = [
      desktop && isProject && meetings ? `<button type="button" data-create="${meetings.id}" data-for-project="${doc.id}">New meeting note</button>` : '',
      desktop && isProject ? `<button type="button" data-project="${doc.id}">Review project work</button>` : '',
      !desktop ? '<button type="button" data-export>Download Markdown</button>' : ''
    ].join('');
    main.innerHTML = `<div class="b-document-header"><p class="b-eyebrow">${escape(database?.title || 'Documents')} / ${escape(doc.title)}</p>
      ${actions ? `<details class="b-document-actions"><summary aria-label="Document actions" title="Document actions">⋯</summary><div class="b-document-action-list">${actions}</div></details>` : ''}</div>
      ${task ? `<h1>${escape(doc.title)}</h1>${taskProperties(task)}` : desktop ? propertyForm(workspace(), doc, files.view.readOnly) : ''}
      <article id="b-reading" class="b-reading" aria-label="Editable Markdown document"></article>
      <p id="b-task-count" class="b-muted" role="status" aria-live="polite"></p><p id="b-document-issues" class="b-issues" role="alert" hidden></p>
      ${doc.id === 'coordination' ? `<div class="b-actions"><button class="b-button cursor-interaction" type="button" data-propose>Preview agent suggestion</button></div>
        <section id="b-proposal" class="b-proposal" hidden><h3>Sample agent suggestion</h3><p id="b-suggestion-text"></p><p class="b-muted">From this note · no due date specified · simulated assistance</p>
          <div class="b-actions"><button type="button" class="b-button b-primary cursor-interaction" data-apply>Insert Markdown checkbox</button><button type="button" class="b-button cursor-interaction" data-dismiss>Dismiss</button></div></section>` : ''}`;
    liveEditor = new RichEditor(main.querySelector('#b-reading'), {
      body: () => record().body, label,
      change: body => editDocument(body), error: notify, openRecord,
      validTask: (id, href) => !!record().references[id] && !!model.taskInfo(workspace(), workspace().records[id]) && model.linkMatches(workspace(), record().id, href, id),
      openLink: href => { const id = model.targetId(href); if (id && workspace().records[id]) openRecord(id); }
    });
    refreshDocument(); if (proposal && main.querySelector('#b-proposal')) showProposal();
  }
  const suggestion = 'Prepare an agenda for the next coordination meeting';
  function showProposal() {
    const available = record().body.includes('prepare a short agenda') && !allTasks().some(task => task.title === suggestion);
    main.querySelector('#b-proposal').hidden = false;
    main.querySelector('#b-suggestion-text').textContent = available ? suggestion : 'No additional sample suggestion for the current note.';
    main.querySelector('[data-apply]').hidden = !available;
  }
  function refreshGreeting() {
    if (desktop && planDate !== BentoProfile.dateKey()) { planDate = BentoProfile.dateKey(); if (state.view === 'daily') renderDaily(); }
    const heading = main.querySelector('#b-greeting');
    if (heading && !state.project) heading.textContent = BentoProfile.greeting(profile);
  }
  function renderProfile() {
    main.innerHTML = `${desktop && personalSettings ? `<p class="b-muted">Settings file: <code>${escape(personalSettings.path)}</code></p>${personalSettings.warning ? `<p class="b-issues" role="alert">${escape(personalSettings.warning)}</p>` : ''}<button type="button" class="b-button" data-reload-settings>Reload settings</button>` : ''}<p class="b-eyebrow">Personal settings</p><h1>Your profile</h1><p class="b-muted">Make Bento feel a little more like you.</p>
      <form id="b-profile-form"><div class="b-form">
        <label class="b-field">First name<input name="firstName" autocomplete="given-name" required maxlength="80" value="${escape(profile.firstName)}"></label>
        <label class="b-field">Last name<input name="lastName" autocomplete="family-name" maxlength="80" value="${escape(profile.lastName)}"></label>
        <label class="b-field">Birthday (optional)<input name="birthday" type="date" aria-label="Birthday" max="${BentoProfile.dateKey()}" value="${escape(profile.birthday)}"></label></div>
        <p class="b-muted" style="margin-top:16px">Your birthday adds a little celebration to your daily greeting.</p>
        <div class="b-actions"><button type="submit" class="b-button b-primary cursor-interaction">Save profile</button><button type="button" class="b-button cursor-interaction" data-view="daily">Back to overview</button></div></form>`;
  }
  function render() {
    liveEditor?.destroy(); liveEditor = null;
    if (desktop && !files?.view) {
      root.querySelector('aside').hidden = true;
      root.querySelector('.b-shell').classList.add('b-welcome-shell');
      root.querySelector('.b-file-controls').hidden = true;
      main.innerHTML = `<section class="b-welcome"><p class="b-eyebrow">Welcome to Bento</p><h1>Your workspace, in Markdown.</h1><p>Keep project notes, capture meetings, and follow through on your work.</p>
        <div class="b-actions"><button type="button" class="b-button b-primary" data-files="create">New workspace</button><button type="button" class="b-button" data-files="open">Open workspace</button></div>
        <p class="b-muted">Choose an empty folder for a new workspace. Your Markdown files stay in that folder.</p></section>`;
      return;
    }
    if (desktop) { root.querySelector('.b-shell').classList.remove('b-welcome-shell'); root.querySelector('.b-file-controls').hidden = false; renderSidebar(); }
    applyAppearance();
    root.querySelectorAll('[data-view]').forEach(button => {
      const selected = button.dataset.view === state.view || button.dataset.view === 'meeting' && state.view === 'document' && record()?.database === 'db-meetings';
      if (selected && !state.project) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    if (!desktop) root.querySelector('#b-project-nav').innerHTML = model.activeProjects(workspace()).map(project => `<button type="button" class="cursor-interaction" data-project="${project.id}" ${state.project === project.id ? 'aria-current="page"' : ''}>${escape(project.title)}</button>`).join('');
    if (state.view === 'create') renderCreation(); else if (state.view === 'daily') renderDaily(); else if (state.view === 'profile') renderProfile(); else if (record()) renderDocument(); else renderDaily();
    if (globalThis.lucide) lucide.createIcons({ attrs: { width: 16, height: 16 } });
  }

  function editDocument(body) {
    if (!editingSnapshot) { editingSnapshot = clone(state); previous = editingSnapshot; }
    state.workspace = model.applyEdit(workspace(), state.document, body).workspace;
    refreshDocument();
    persist(); notify(desktop ? 'Draft updated.' : 'Document saved.');
  }
  function exportDocument() {
    const blob = new Blob([model.serializeDocument(record())], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${record().id}.md`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    try {
      if (button.hasAttribute('data-reload-settings')) loadPersonal().then(() => { render(); notify(personalSettings?.warning || 'Personal settings reloaded.'); });
      else if (button.hasAttribute('data-theme-toggle')) changeAppearance(nextTheme(appearance.theme, systemAppearance.matches));
      else if (button.dataset.create) showCreate(button.dataset.create, button.dataset.forProject || null);
      else if (button.hasAttribute('data-cancel-create')) { Object.assign(state, creation.previous); creation = null; render(); }
      else if (button.dataset.view === 'meeting') openRecord(state.note);
      else if (button.dataset.view) navigate(button.dataset.view);
      else if (button.dataset.record) openRecord(button.dataset.record);
      else if (button.dataset.project) navigate('daily', button.dataset.project);
      else if (button.hasAttribute('data-undo') && previous) {
        const snapshot = previous; previous = null; state = snapshot; editingSnapshot = null; proposal = false;
        render(); persist(); notify('Last document change undone.');
      } else if (button.hasAttribute('data-export')) exportDocument();
      else if (button.hasAttribute('data-propose')) { proposal = true; showProposal(); }
      else if (button.hasAttribute('data-dismiss')) { proposal = false; main.querySelector('#b-proposal').hidden = true; }
      else if (button.hasAttribute('data-apply')) { proposal = false; change(() => model.applyEdit(workspace(), state.document, record().body + `\n- [ ] ${suggestion}\n`).workspace, 'Created a todo document from the reviewed checkbox.'); }
    } catch (error) { notify(error.message); }
  });
  document.addEventListener('click', event => {
    root.querySelectorAll('.b-document-actions[open], .b-workspace-menu[open]').forEach(menu => { if (!menu.contains(event.target) && !event.target.closest('[data-draft-notice]')) menu.open = false; });
  });
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const menu = root.querySelector('.b-document-actions[open], .b-workspace-menu[open]');
    if (menu) { menu.open = false; menu.querySelector('summary').focus(); event.preventDefault(); }
  });
  root.addEventListener('toggle', event => {
    const details = event.target;
    if (details.isConnected && details.matches('aside details[data-directory]')) directoryState?.set(details.dataset.directory, details.open);
  }, true);
  root.addEventListener('change', event => {
    try {
      if (event.target.dataset.task) change(() => model.updateTodo(workspace(), event.target.dataset.task, { done: event.target.checked }), 'Todo completion updated.');
      else if (event.target.hasAttribute('data-todo-completed')) {
        const form = main.querySelector('#b-todo-properties'), values = new FormData(form);
        change(() => model.updateTodo(workspace(), state.document, { done: event.target.checked, title: String(values.get('title')), due: String(values.get('due')), project: String(values.get('project')), status: String(values.get('status')) }), 'Todo properties and completion updated.');
      }
    } catch (error) { if (event.target.type === 'checkbox') event.target.checked = !event.target.checked; notify(error.message); }
  });
  root.addEventListener('input', event => {
    if (event.target.closest('#b-profile-form')) { event.target.setCustomValidity(''); return; }
  });
  root.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target, values = new FormData(form);
    if (form.id === 'b-create-document') {
      try {
        const database = workspace().databases[creation.database], relation = projectField(database), project = String(values.get('project') || '');
        const properties = relation && project ? { [relation.id]: relation.cardinality === 'many' ? [project] : project } : {};
        const result = model.createDocument(workspace(), { database: database.id, title: String(values.get('title')), properties });
        previous = null;
        state.workspace = result.workspace; creation = null;
        navigate('document', null, result.documentId);
        notify('Created a Markdown document.');
        liveEditor?.focus();
      } catch (error) { const panel = main.querySelector('#b-create-error'); panel.hidden = false; panel.textContent = error.message; }
    } else if (form.id === 'b-page-properties') {
      try {
        const patch = propertyPatch(workspace(), record(), values);
        change(() => model.updateDocument(workspace(), state.document, patch), 'Page properties saved.');
      } catch (error) {
        const panel = form.querySelector('[data-property-error]'); panel.hidden = false; panel.textContent = error.message;
      }
    } else if (form.id === 'b-todo-properties') {
      try { change(() => model.updateTodo(workspace(), state.document, { title: String(values.get('title')), due: String(values.get('due')), project: String(values.get('project')), status: String(values.get('status')) }), 'Todo properties saved.'); }
      catch (error) { notify(error.message); }
    } else if (form.id === 'b-profile-form') {
      const value = { version: 1, firstName: String(values.get('firstName') || '').trim(), lastName: String(values.get('lastName') || '').trim(), birthday: String(values.get('birthday') || '') };
      if (!BentoProfile.validate(value)) { form.elements.firstName.setCustomValidity('Enter a first name and a valid birthday, or leave birthday blank.'); form.reportValidity(); return; }
      if (desktop) {
        try { await savePersonal({ profile: value }); profile = value; navigate('daily'); notify('Profile saved in personal settings.md.'); }
        catch (error) { notify(error.message); }
        return;
      }
      const result = BentoProfile.write(value); profile = result.profile; navigate('daily');
      notify(result.saved ? 'Profile saved in this browser.' : 'Profile kept for this session. Browser storage is unavailable.');
    }
  });
  window.addEventListener('storage', event => {
    if (!desktop && (event.key === appearanceKey || event.key === null)) { appearance.theme = readTheme(); applyAppearance(); }
    if (!desktop && (event.key === BentoProfile.key || event.key === null)) { profile = BentoProfile.read(); refreshGreeting(); }
    if (event.key === storageKey && event.newValue !== expectedStorage) { storageLocked = true; storageWarning = 'Another page changed the saved workspace; this session will not overwrite it.'; notify('Workspace changed elsewhere.'); }
  });
  document.addEventListener('visibilitychange', refreshGreeting);
  setInterval(refreshGreeting, 60_000);
  window.addEventListener('openai:set_globals', event => {
    const saved = event.detail?.globals?.widgetState?.privateContent;
    if (!desktop && validSnapshot(saved) && saved.savedAt > state.savedAt && !editingSnapshot) { state = clone(saved); previous = null; proposal = false; render(); }
  });
  if (desktop) {
    await loadPersonal();
    root.dataset.desktop = 'true';
    root.querySelector('.b-demo').textContent = 'Markdown workspace';
    root.querySelector('.b-demo').hidden = true;
    root.querySelector('.b-theme-toggle').insertAdjacentHTML('beforebegin', `<div class="b-file-controls"><details class="b-workspace-menu"><summary aria-label="Workspace actions"><span data-workspace-name>Workspace</span><span aria-hidden="true">⌄</span></summary><div><button type="button" data-files="open">Open workspace</button><button type="button" data-files="create">New workspace</button><button type="button" data-files="reload" disabled>Reload files</button><button type="button" data-files="save" disabled>Save files</button><button type="button" data-files="restore" hidden>Restore draft</button><button type="button" data-files="draft" hidden>Download draft</button></div></details><button type="button" class="b-draft-notice" data-draft-notice hidden>Draft available</button><span id="b-save-state" role="status" aria-live="polite"></span></div>`);
    root.querySelector('.b-shell').insertAdjacentHTML('beforebegin', '<p id="b-file-errors" class="b-issues" role="alert" hidden></p>');

    const errors = root.querySelector('#b-file-errors');
    files = new BentoFileSession(desktop, {
      workspace,
      activate(view) {
        root.querySelector('[data-workspace-name]').textContent = view.title;
        document.title = view.title + ' · Bento';
        const treeKey = 'bento.sidebar.tree.v1:' + view.folder;
        if (directoryState?.key !== treeKey) directoryState = new DirectoryState(treeKey);
        state.workspace = view.workspace;
        state.view = view.location?.view || 'daily'; state.project = view.location?.project || null; creation = null;
        if (view.location?.document) state.document = view.location.document;
        if (state.view === 'document') directoryState.reveal(workspace().paths?.[state.document]);
        if ('resumeWarning' in view) { storageWarning = view.resumeWarning || ''; notify('Workspace ready.'); }
        state.document = Object.hasOwn(workspace().records, state.document) ? state.document : Object.keys(workspace().records)[0];
        state.note = Object.values(workspace().records).find(doc => doc.database === 'db-meetings')?.id;
        previous = null; editingSnapshot = null; proposal = false;
        errors.hidden = !view.errors.length; errors.textContent = view.errors.map(error => `${error.path}: ${error.message}`).join(' ');
        render();
      },
      error(message) { errors.hidden = !message; errors.textContent = message; },
      status(message) {
        const indicator = root.querySelector('#b-save-state');
        indicator.textContent = message === 'Saved to workspace files' ? 'Saved' : message === 'Saving files…' ? 'Saving…' : message;
        indicator.title = message;
      },
      controls(session) {
        root.querySelector('[data-files="save"]').disabled = !session.dirty || session.saving || session.view.readOnly;
        root.querySelector('[data-files="reload"]').disabled = session.saving;
        root.querySelector('[data-files="restore"]').hidden = session.dirty || !session.hasDraft();
        const draft = session.hasDraft();
        root.querySelector('[data-files="draft"]').hidden = !draft;
        const notice = root.querySelector('[data-draft-notice]');
        notice.hidden = !draft || (session.dirty && !session.failed);
        notice.textContent = session.failed ? 'Draft kept' : 'Draft available';
      }
    });
    root.addEventListener('click', event => {
      if (event.target.closest('[data-draft-notice]')) {
        const menu = root.querySelector('.b-workspace-menu'); menu.open = true;
        menu.querySelector('[data-files="restore"]:not([hidden]), [data-files="draft"]:not([hidden])')?.focus();
        return;
      }
      const action = event.target.closest('[data-files]')?.dataset.files;
      if (action) root.querySelector('.b-workspace-menu').open = false;
      if (action === 'open' || action === 'create' || action === 'reload') files.open(() => desktop[action]());
      else if (action === 'save') files.save();
      else if (action === 'restore') files.restore();
      else if (action === 'draft') files.downloadDraft();
    });
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); files.save(); }
    });
    window.addEventListener('beforeunload', event => { if (files.dirty && !confirm('Keep your unsaved draft in Bento and close?')) { event.preventDefault(); event.returnValue = false; } });
    await files.open(async () => {
      const result = await desktop.initial();
      if (result.ok && result.value?.unavailable) { storageWarning = result.value.resumeWarning || ''; return { ok: true, value: null }; }
      return result;
    });
  }
  render(); notify(desktop ? personalSettings?.warning || (files?.view ? 'Workspace ready.' : 'Open a workspace or create one to begin.') : storageWarning ? 'Sample workspace opened.' : 'Sample workspace ready. Edits save in this browser.');
  if (globalThis.Tweak) {
    const tweak = new Tweak({ container: root, onChange: () => changeAppearance(appearance.theme) });
    tweak.addSelect(appearance, 'theme', { label: 'Appearance', options: ['system', 'light', 'dark'] });
  }
})();
