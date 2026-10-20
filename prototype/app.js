import NavigationHistory, { sameLocation } from './navigation-history.js';
import { ShortcutController, shortcuts, bindingsFor, keyLabel, isMac } from './shortcuts.js';
import QuickOpen from './quick-open.js';
import Walkthrough from './walkthrough.js';
import ShortcutReference from './shortcut-reference.js';
import { recordColor } from './colors.js';
import ThemePicker from './theme-picker.js';
import { applyColorTheme, validateThemePreferences, readThemePreferences, saveThemePreferences, themePreferencesKey } from './themes.js';
import { projectReview } from './project-review.js';
import { legacyPreferences } from './personal-settings.js';
import { appearanceKey, readTheme, saveTheme, isDark, nextTheme } from './appearance.js';
import InlineProperties from './inline-properties.js';
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
  let themePreferences = readThemePreferences(), themePicker = null;
  const appearance = { theme: readTheme() };
  const systemAppearance = matchMedia('(prefers-color-scheme: dark)');
  function applyAppearance() {
    root.dataset.theme = appearance.theme;
    document.documentElement.style.colorScheme = appearance.theme === 'system' ? 'light dark' : appearance.theme;
    const toggle = root.querySelector('[data-theme-toggle]');
    const dark = isDark(appearance.theme, systemAppearance.matches);
    applyColorTheme(root, themePreferences, dark);
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
    themePreferences = { colorTheme: personalSettings.colorTheme, themes: personalSettings.themes };
    applyAppearance();
    themePicker?.render();
    if (personalSettings.warning) notify(personalSettings.warning);
  }
  systemAppearance.addEventListener('change', () => { applyAppearance(); themePicker?.render(); });
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
  let files = null, directoryState = null, walkthrough = null;
  let state = desktop ? { version: 4, view: 'daily', project: null, document: null, note: null, workspace: { version: 4, databases: {}, records: {}, issues: [] } } : loadWorkspace();
  let profile = BentoProfile.read();
  const workspace = () => state.workspace;
  const record = () => workspace().records[state.document];
  const getProject = projectId => model.capability(workspace(), workspace().records[projectId], 'project') ? workspace().records[projectId] : undefined;
  const allTasks = () => model.allTasks(workspace());
  const dueLabel = due => !due ? 'No date' : due === planDate ? 'Today'
    : new Date(due + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  let liveEditor = null, propertyEditor = null, shortcutReference = null, creation = null;
  const location = () => ({ view: state.view, project: state.project, document: state.document });
  const navigation = new NavigationHistory(location());

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
  function rememberPresentation() {
    if (state.view !== 'create' && sameLocation(navigation.entries[navigation.index].location, location())) navigation.remember({ scrollY: window.scrollY, editor: liveEditor?.navigationState() || null });
  }
  function showLocation(destination) {
    const { view, project, document: documentId } = destination;
    state.view = view; state.project = project; state.document = documentId;
    if (view === 'document') directoryState?.reveal(workspace().paths?.[documentId]);
    if (isNote(workspace().records[documentId])) state.note = documentId;
    editingSnapshot = null; proposal = false;
    render(); persist();
    if (desktop) desktop.rememberLocation({ view, project, document: documentId || null }).then(result => { if (!result.ok) notify('Your last page could not be saved. Workspace edits are unaffected.'); });
  }
  function navigate(view, project = null, documentId = state.document) {
    if (propertyEditor && !propertyEditor.commit()) return;
    rememberPresentation();
    const destination = { view, project, document: documentId };
    if (sameLocation(location(), destination)) return;
    navigation.visit(destination); creation = null; showLocation(destination); window.scrollTo(0, 0);
  }
  function travel(direction) {
    if (propertyEditor && !propertyEditor.commit()) return;
    if (state.view === 'create' && creation) { const previous = creation.previous; creation = null; showLocation(previous); return; }
    rememberPresentation();
    const entry = navigation.move(direction, destination => (destination.view !== 'document' || !!workspace().records[destination.document]) && (!destination.project || !!model.capability(workspace(), workspace().records[destination.project], 'project')));
    if (!entry) return;
    showLocation(entry.location);
    main.tabIndex = -1; main.focus({ preventScroll: true });
    if (entry.presentation.editor) liveEditor?.restoreNavigationState(entry.presentation.editor);
    window.scrollTo(0, entry.presentation.scrollY || 0);
  }
  function openQuickOpen(commands = false) {
    if (!quickOpen.open && propertyEditor && !propertyEditor.commit()) return;
    root.querySelectorAll('.b-workspace-menu[open], .b-document-actions[open]').forEach(menu => { menu.open = false; });
    quickOpen.toggle(commands);
  }
  const commandHandlers = {
    'quick-open': openQuickOpen, 'command-search': () => openQuickOpen(true),
    back: () => travel(-1), forward: () => travel(1), settings: () => navigate('profile'),
    shortcuts: () => { navigate('profile'); shortcutReference?.focus(); },
    save: () => { if (propertyEditor && !propertyEditor.commit()) return; if (desktop) files?.save(); else { persist(); notify('Changes saved in this browser.'); } },
    overview: () => navigate('daily'),
    appearance: () => { navigate('profile'); main.querySelector('[data-color-theme]')?.focus(); },
    'toggle-mode': () => changeAppearance(nextTheme(appearance.theme, systemAppearance.matches)).then(() => themePicker?.render())
  };
  function paletteCommands() {
    const commands = shortcuts.filter(shortcut => shortcut.app && !['quick-open', 'command-search'].includes(shortcut.id))
      .filter(shortcut => shortcut.id !== 'back' || navigation.index > 0 || creation)
      .filter(shortcut => shortcut.id !== 'forward' || navigation.index < navigation.entries.length - 1)
      .map(shortcut => ({ id: shortcut.id, title: shortcut.command, detail: 'Command', kind: 'command', shortcut: keyLabel(bindingsFor(shortcut, isMac())[0], isMac()), run: commandHandlers[shortcut.id] }));
    commands.push({ id: 'overview', title: 'Daily Overview', detail: 'Command', kind: 'command', run: commandHandlers.overview },
      { id: 'appearance', title: 'Choose Color Theme', detail: 'Command · Appearance settings', kind: 'command', run: commandHandlers.appearance },
      { id: 'toggle-mode', title: 'Toggle Light / Dark Mode', detail: 'Command · Appearance', kind: 'command', run: commandHandlers['toggle-mode'] });
    if (desktop && files?.view) {
      if (!files.view.readOnly) for (const database of Object.values(workspace().databases)) commands.push({ id: 'create:' + database.id, title: creationLabel(database), detail: 'Create a Markdown page · ' + database.title, kind: 'command', run: () => showCreate(database.id, state.project || (record() && (model.capability(workspace(), record(), 'project') ? record().id : model.projectOf(workspace(), record()))) || null) });
      for (const [id, title] of [['open', 'Open Workspace…'], ['create', 'New Workspace…'], ['reload', 'Reload Workspace Files']]) commands.push({ id: 'workspace:' + id, title, detail: 'Command · Workspace', kind: 'command', run: () => files.open(() => desktop[id]()) });
    }
    return commands;
  }
  const quickOpen = new QuickOpen(root, {
    entries: () => [...paletteCommands(), ...Object.values(workspace().records).sort((a, b) => a.title.localeCompare(b.title)).map(doc => ({
      id: doc.id, kind: 'page', title: doc.title, color: recordColor(doc), type: model.capability(workspace(), doc, 'project') ? 'Project' : model.capability(workspace(), doc, 'task') ? 'Todo' : 'Page',
      detail: workspace().paths?.[doc.id] || `${workspace().databases[doc.database]?.title || 'Documents'}/${doc.id}.md`, keywords: [workspace().databases[doc.database]?.title || '', ...doc.tags]
    }))],
    capture() {
      const origin = document.activeElement, editor = liveEditor?.navigationState(), scroll = window.scrollY;
      return () => {
        if (origin?.isConnected && origin.getClientRects().length) origin.focus({ preventScroll: true });
        else { main.tabIndex = -1; main.focus({ preventScroll: true }); }
        if (editor?.focused) liveEditor?.restoreNavigationState(editor);
        window.scrollTo(0, scroll);
      };
    },
    run(entry) {
      if (entry.kind === 'page') { if (workspace().records[entry.id]) openRecord(entry.id); else notify('That page is no longer available.'); }
      else return paletteCommands().find(command => command.id === entry.id)?.run();
    }, error: notify
  });
  const shortcutController = new ShortcutController(Object.fromEntries(Object.entries(commandHandlers).map(([id, run]) => [id, () => { if (!['quick-open', 'command-search'].includes(id)) quickOpen.close(); run(); }])), { available: () => !desktop || !!files?.view });
  document.addEventListener('keydown', event => shortcutController.handle(event), true);
  window.addEventListener('blur', () => shortcutController.clear());
  function openRecord(documentId) {
    if (Object.hasOwn(workspace().records, documentId)) navigate('document', null, documentId);
  }

  function projectDatabase() {
    return Object.values(workspace().databases).find(database => database.capabilities.project);
  }
  function projectField(database, project = null) {
    return database?.fields.find(field => field.type === 'relation' && !field.unavailable && (!project || field.target_database === project.database) && workspace().databases[field.target_database]?.capabilities.project);
  }
  function isNote(doc) {
    return doc && doc.id !== workspace().home && !model.capability(workspace(), doc, 'task') && !model.capability(workspace(), doc, 'project');
  }
  function creationLabel(database) { return `New page in ${database.title}`; }
  function readOnly(doc) { return !!files?.view?.readOnly || !!workspace().readOnlyRecords?.includes(doc.id); }
  function showCreate(databaseId, project = null) {
    if (propertyEditor && !propertyEditor.commit()) return;
    rememberPresentation();
    if (files?.view?.readOnly) return notify('Repair this workspace before creating documents.');
    if (!workspace().databases[databaseId]) return notify('This database is unavailable. Reload or restore its definition.');
    creation = { database: databaseId, project, previous: { view: state.view, project: state.project, document: state.document } };
    state.view = 'create'; render();
    main.querySelector('[name="title"]').focus();
  }
  function renderCreation() {
    const database = workspace().databases[creation.database], relation = projectField(database, getProject(creation.project));
    const projects = Object.values(workspace().records).filter(doc => doc.database === relation?.target_database && model.capability(workspace(), doc, 'project') && (model.activeProjects(workspace()).some(active => active.id === doc.id) || doc.id === creation.project));
    main.innerHTML = `<p class="b-eyebrow">${escape(database.title)}</p><h1>${escape(creationLabel(database))}</h1>
      <p class="b-muted">A Markdown document for your notes and details.</p>
      <form id="b-create-document"><label class="b-field">Title<input name="title" aria-label="Document title" required maxlength="200" placeholder="${database.capabilities.project ? 'e.g. Creekside improvements' : 'Give this page a title'}"></label>
      ${relation ? `<label class="b-field">Project<select name="project" aria-label="Project"><option value="">Unassigned</option>${projects.map(project => `<option value="${project.id}" ${creation.project === project.id ? 'selected' : ''}>${escape(project.title)}</option>`).join('')}</select></label>` : ''}
      <p id="b-create-error" class="b-issues" role="alert" hidden></p>
      <div class="b-actions"><button type="submit" class="b-button b-primary">Create page</button><button type="button" class="b-button" data-cancel-create>Cancel</button></div></form>`;
  }
  function directoryContents(node) {
    const folders = node.folders.map(directoryFolder).join('');
    const documents = node.documents.map(doc => `<li><button type="button" class="b-tree-document" data-record="${escape(doc.id)}" title="${escape(doc.path)}" ${state.view === 'document' && state.document === doc.id ? 'aria-current="page"' : ''}><span class="b-record-marker" data-record-marker="${escape(doc.id)}" data-color="${recordColor(workspace().records[doc.id])}" aria-hidden="true">●</span><span>${escape(doc.title)}</span></button></li>`).join('');
    return `<ul class="b-tree-children">${folders}${documents}${folders || documents ? '' : '<li class="b-tree-empty">No pages yet</li>'}</ul>`;
  }
  function directoryFolder(node) {
    const database = node.database;
    const label = node.path ? database?.title || node.name : workspace().records[workspace().home]?.title || files.view.title;
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
    sidebar.innerHTML = `<nav class="b-nav" aria-label="Workspace">${workspace().home ? `<button type="button" data-record="${workspace().home}" ${state.view === 'document' && state.document === workspace().home ? 'aria-current="page"' : ''}>Workspace</button>` : ''}<button type="button" data-view="daily" ${state.view === 'daily' ? 'aria-current="page"' : ''}>Daily overview</button></nav>
      <nav class="b-directory-tree" aria-label="Workspace files"><ul>${directoryFolder(directoryTree(workspace()))}</ul></nav>
      <nav class="b-nav b-sidebar-settings" aria-label="Settings"><button type="button" data-view="profile" ${state.view === 'profile' ? 'aria-current="page"' : ''}>Settings</button></nav>`;
  }

  function taskRow(task) {
    const project = getProject(task.project), source = model.sourcesFor(workspace(), task.id)[0];
    return `<li class="b-task ${task.done ? 'b-done' : ''}">
      <input class="cursor-interaction" type="checkbox" data-task="${task.id}" aria-label="Complete ${escape(task.title)}" ${task.done ? 'checked' : ''} ${readOnly(workspace().records[task.id]) ? 'disabled' : ''}>
      <div><button class="b-task-title b-document-link cursor-interaction" type="button" data-record="${task.id}">${escape(task.title)}</button>
        ${source ? `<button class="b-source cursor-interaction" data-record="${source.id}" type="button"><span class="b-project-label" ${project ? `data-color="${recordColor(project)}"` : ''}>${escape(project?.title || 'Unassigned')}</span> · ${escape(source.title)} ↗</button>` : `<span class="b-source"><span class="b-project-label" ${project ? `data-color="${recordColor(project)}"` : ''}>${escape(project?.title || 'Unassigned')}</span> · No source reference</span>`}
      </div><span class="b-date ${!task.done && task.due && task.due < planDate ? 'b-overdue' : ''}">${dueLabel(task.due)}</span>
    </li>`;
  }
  function projectCard(project) {
    const tasks = allTasks().filter(task => task.project === project.id), open = tasks.filter(task => !task.done);
    const next = open.filter(task => task.due).sort((a, b) => a.due.localeCompare(b.due))[0];
    return `<section class="b-project" data-color="${recordColor(project)}"><button type="button" class="cursor-interaction" ${desktop ? `data-record="${project.id}"` : `data-project="${project.id}"`}>${escape(project.title)}</button>
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

    if (desktop && !Object.keys(workspace().records).some(id => id !== workspace().home)) {
      const projects = projectDatabase(), first = projects || Object.values(workspace().databases)[0];
      main.innerHTML = `<p class="b-eyebrow">Your workspace is ready</p><h1 id="b-greeting">${escape(BentoProfile.greeting(profile))}</h1>
        <section class="b-onboarding"><h2>${projects ? 'Create your first project' : 'Create your first page'}</h2><p>${projects ? 'Start with a project, then add meeting notes and turn checkboxes into todos.' : 'Your Workspace page is ready for notes. Add pages through an available database.'}</p>
        ${first ? `<button type="button" class="b-button b-primary" data-create="${first.id}" ${files.view.readOnly ? 'disabled' : ''}>Start your first page</button>` : '<p>No databases are configured. You can still edit the Workspace page.</p>'}</section>`;
      return;
    }
    const tasks = allTasks().filter(task => !state.project || task.project === state.project);
    const open = tasks.filter(task => !task.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const selected = getProject(state.project);
    const meeting = Object.values(workspace().records).find(doc => isNote(doc) && (!selected || model.projectOf(workspace(), doc) === selected.id));
    main.innerHTML = `<p class="b-eyebrow">${desktop ? escape(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })) : 'Sample plan · Monday, October 19'} · ${selected ? 'Project overview' : 'All projects'}</p>
      <h1 id="b-greeting">${selected ? escape(selected.title) : escape(BentoProfile.greeting(profile))}</h1>
      <p class="b-muted">${open.length} open actions${selected ? ' in this project' : ' across your workspace'}.</p>
      <div class="b-actions">
        ${meeting ? `<button type="button" class="b-button b-primary cursor-interaction" data-record="${meeting.id}">Open ${escape(meeting.title)}</button>` : ''}
        ${selected ? `<button type="button" class="b-button cursor-interaction" data-record="${selected.id}">Open project document</button><button type="button" class="b-button cursor-interaction" data-view="daily">All projects</button>` : ''}
        <button type="button" class="b-button cursor-interaction" data-undo ${previous ? '' : 'disabled'}>Undo last change</button>
      </div><h2>${selected ? 'Project summary' : 'Active projects'}</h2>
      <div class="b-summary-grid">${model.activeProjects(workspace()).filter(project => !selected || project.id === selected.id).map(projectCard).join('')}</div>
      ${Object.values(workspace().databases).some(db => db.capabilities.task) ? '' : '<p class="b-muted">Todo tracking is unavailable. Configure a database with a task capability to enable it.</p>'}${projectDatabase() ? '' : '<p class="b-muted">Project review is unavailable. Configure a database with a project capability to enable it.</p>'}${renderTaskGroups(open)}${open.length ? '' : '<p class="b-muted">No outstanding work. Your project notes are still here.</p>'}
      <details><summary>Completed (${tasks.length - open.length})</summary><ul class="b-list">${tasks.filter(task => task.done).map(taskRow).join('')}</ul></details>`;
  }

  function refreshDocument() {
    const issues = workspace().issues.filter(item => item.document === record().id);
    const panel = main.querySelector('#b-document-issues');
    panel.hidden = !issues.length;
    panel.textContent = issues.map(item => `Line ${item.line + 1}: ${item.message}`).join(' ');
  }
  function renderDocument() {
    const doc = record(), database = workspace().databases[doc.database], task = model.taskInfo(workspace(), doc);
    const label = doc.id === workspace().home ? 'Workspace Markdown' : task ? 'Todo Markdown' : model.capability(workspace(), doc, 'project') ? 'Project Markdown' : 'Page Markdown';
    const databaseLabel = database?.title || (doc.id === workspace().home ? 'Workspace' : 'Documents');
    const isProject = model.capability(workspace(), doc, 'project');
    const related = Object.values(workspace().databases).filter(db => !db.capabilities.task && !db.capabilities.project && db.fields.some(field => field.type === 'relation' && !field.unavailable && field.target_database === doc.database));
    const actions = [
      desktop && isProject ? related.map(db => `<button type="button" data-create="${db.id}" data-for-project="${doc.id}">${escape(creationLabel(db))}</button>`).join('') : '',
      desktop && isProject ? `<button type="button" data-project="${doc.id}">Review project work</button>` : '',
      !desktop ? '<button type="button" data-export>Download Markdown</button>' : ''
    ].join('');
    main.innerHTML = `<div class="b-document-header"><p class="b-eyebrow"><span class="b-color-dot" data-document-color data-color="${recordColor(doc)}" aria-hidden="true"></span> ${escape(databaseLabel)} / ${escape(doc.title)}</p>
      ${actions ? `<details class="b-document-actions"><summary aria-label="Document actions" title="Document actions">⋯</summary><div class="b-document-action-list">${actions}</div></details>` : ''}</div>
      ${task ? `<h1 data-todo-heading>${escape(doc.title)}</h1>` : ''}
      ${desktop || task ? '<section id="b-document-properties" aria-label="Document properties"></section>' : ''}
      ${task ? `<nav class="b-source-links" aria-label="Source notes">${model.sourcesFor(workspace(), task.id).map(source => `<button type="button" data-record="${source.id}">Back to ${escape(source.title)}</button>`).join('')}</nav>` : ''}
      ${readOnly(doc) ? '<p class="b-issues">This page is read-only. Restore its database definition or resolve workspace errors to edit it.</p>' : ''}
      <article id="b-reading" class="b-reading" aria-label="Editable Markdown document"></article>
      <p id="b-document-issues" class="b-issues" role="alert" hidden></p>
      ${doc.id === 'coordination' ? `<div class="b-actions"><button class="b-button cursor-interaction" type="button" data-propose>Preview agent suggestion</button></div>
        <section id="b-proposal" class="b-proposal" hidden><h3>Sample agent suggestion</h3><p id="b-suggestion-text"></p><p class="b-muted">From this note · no due date specified · simulated assistance</p>
          <div class="b-actions"><button type="button" class="b-button b-primary cursor-interaction" data-apply>Insert Markdown checkbox</button><button type="button" class="b-button cursor-interaction" data-dismiss>Dismiss</button></div></section>` : ''}`;
    if (desktop || task) propertyEditor = new InlineProperties(main.querySelector('#b-document-properties'), {
      workspace, record, readOnly: readOnly(doc), hideTitle: !!isProject,
      tagColor(tag, color) {
        const next = model.updateTagColor(workspace(), tag, color); previous = clone(state); state.workspace = next; persist(); notify('Tag color saved across this workspace.');
      },
      completed: task ? () => model.taskInfo(workspace(), record()).done : null,
      error: notify,
      change(patch) {
        const next = Object.hasOwn(patch, 'completed') ? model.updateTodo(workspace(), doc.id, { done: patch.completed }) : model.updateDocument(workspace(), doc.id, patch);
        previous = clone(state); state.workspace = next; editingSnapshot = null;
        if (desktop && patch.title) root.querySelectorAll('aside [data-record]').forEach(button => {
          if (button.dataset.record === doc.id && button.querySelector('span:last-child')) button.querySelector('span:last-child').textContent = record().title;
        });
        if (doc.id === workspace().home) {
          root.querySelector('[data-workspace-name]').textContent = record().title; document.title = record().title + ' · Bento';
          root.querySelector('aside details[data-directory=""] .b-tree-folder-name').textContent = record().title;
        }
        const heading = main.querySelector('[data-todo-heading]'); if (heading) heading.textContent = record().title;
        main.querySelector('.b-document-header .b-eyebrow').innerHTML = `<span class="b-color-dot" data-document-color data-color="${recordColor(record())}" aria-hidden="true"></span> ${escape(databaseLabel)} / ${escape(record().title)}`;
        root.querySelectorAll('[data-record-marker]').forEach(marker => { if (marker.dataset.recordMarker === doc.id) marker.dataset.color = recordColor(record()); });
        refreshDocument(); persist(); notify('Properties saved.');
      }
    });
    liveEditor = new RichEditor(main.querySelector('#b-reading'), {
      body: () => record().body, label, readOnly: readOnly(doc),
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
    const now = new Date();
    if (desktop && planDate !== BentoProfile.dateKey(now)) { planDate = BentoProfile.dateKey(now); if (state.view === 'daily') render(); }
    const heading = main.querySelector('#b-greeting'), greeting = BentoProfile.greeting(profile, now);
    if (heading && !state.project && heading.textContent !== greeting) heading.textContent = greeting;
  }
  function renderProfile() {
    main.innerHTML = `${desktop && personalSettings ? `<p class="b-muted">Settings file: <code>${escape(personalSettings.path)}</code></p>${personalSettings.warning ? `<p class="b-issues" role="alert">${escape(personalSettings.warning)}</p>` : ''}<button type="button" class="b-button" data-reload-settings>Reload settings</button>` : ''}<p class="b-eyebrow">Personal settings</p><h1>Settings</h1><section id="b-theme-settings" aria-label="Appearance settings"></section><h2>Your profile</h2>
      <form id="b-profile-form"><div class="b-form">
        <label class="b-field">First name<input name="firstName" autocomplete="given-name" required maxlength="80" value="${escape(profile.firstName)}"></label>
        <label class="b-field">Last name<input name="lastName" autocomplete="family-name" maxlength="80" value="${escape(profile.lastName)}"></label>
        <label class="b-field">Birthday (optional)<input name="birthday" type="date" aria-label="Birthday" max="${BentoProfile.dateKey()}" value="${escape(profile.birthday)}"></label></div>
        <p class="b-muted" style="margin-top:16px">Your birthday adds a little celebration to your daily greeting.</p>
        <div class="b-actions"><button type="submit" class="b-button b-primary cursor-interaction">Save profile</button><button type="button" class="b-button cursor-interaction" data-view="daily">Back to overview</button></div></form><section id="b-keyboard-shortcuts" aria-label="Keyboard shortcuts"></section>`;
    shortcutReference = new ShortcutReference(main.querySelector('#b-keyboard-shortcuts'));
    themePicker = new ThemePicker(main.querySelector('#b-theme-settings'), {
      preferences: () => themePreferences, appearance: () => appearance.theme,
      dark: () => isDark(appearance.theme, systemAppearance.matches),
      mode: async mode => { await changeAppearance(mode); },
      change: async next => {
        next = validateThemePreferences(next);
        if (desktop) await savePersonal(next);
        else if (!saveThemePreferences(next)) throw new Error('Theme preferences could not be saved. Your current theme was kept.');
        themePreferences = next; applyAppearance();
      }
    });
  }
  function render() {
    themePicker = null; shortcutReference = null;
    propertyEditor?.destroy(); propertyEditor = null;
    liveEditor?.destroy(); liveEditor = null;
    if (desktop && !files?.view) {
      root.querySelector('aside').hidden = true;
      root.querySelector('.b-shell').classList.add('b-welcome-shell');
      root.querySelector('.b-file-controls').hidden = true;
      main.innerHTML = `<section class="b-welcome"><p class="b-eyebrow">Welcome to Bento</p><h1>Your projects, notes, and next steps.</h1><p>Take meeting notes, track your actions, and see what needs attention.</p>
        <div class="b-actions"><button type="button" class="b-button b-primary" data-files="example">Try an example workspace</button><button type="button" class="b-button" data-files="create">New workspace</button><button type="button" class="b-button" data-files="open">Open workspace</button></div>
        <p class="b-muted">Try two fictional projects, meeting notes, and a short walkthrough. Choose an empty folder for the example or a new workspace. Your Markdown files stay in that folder.</p></section>`;
      return;
    }
    if (desktop) { root.querySelector('.b-shell').classList.remove('b-welcome-shell'); root.querySelector('.b-file-controls').hidden = false; renderSidebar(); }
    applyAppearance();
    root.querySelectorAll('[data-view]').forEach(button => {
      const selected = button.dataset.view === state.view || button.dataset.view === 'meeting' && state.view === 'document' && record()?.id === state.note;
      if (selected && !state.project) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    if (!desktop) root.querySelector('#b-project-nav').innerHTML = model.activeProjects(workspace()).map(project => `<button type="button" class="cursor-interaction" data-project="${project.id}" ${state.project === project.id ? 'aria-current="page"' : ''}>${escape(project.title)}</button>`).join('');
    if (state.view === 'create') renderCreation(); else if (state.view === 'daily') renderDaily(); else if (state.view === 'profile') renderProfile(); else if (record()) renderDocument(); else renderDaily();
    if (walkthrough?.active) main.insertAdjacentHTML('afterbegin', walkthrough.html());
    if (globalThis.lucide) globalThis.lucide.createIcons({ attrs: { width: 16, height: 16 } });
  }

  function handleWalkthrough(action) {
    if (!walkthrough?.valid || (propertyEditor && !propertyEditor.commit())) return;
    root.querySelector('.b-workspace-menu').open = false;
    if (action === 'dismiss') { walkthrough.dismiss(); main.querySelector('.b-walkthrough')?.remove(); return; }
    rememberPresentation();
    if (action === 'next') walkthrough.next();
    if (action === 'replay') walkthrough.replay();
    if (!walkthrough.active) { main.querySelector('.b-walkthrough')?.remove(); notify('You’re ready. Keep exploring, or create a new workspace from the workspace menu.'); return; }
    const target = walkthrough.location();
    navigate(target.view, null, target.document);
    // Reopening the current location does not trigger navigation/render.
    main.querySelector('.b-walkthrough')?.remove();
    main.insertAdjacentHTML('afterbegin', walkthrough.html());
    main.querySelector('.b-walkthrough h2 button')?.focus({ preventScroll: true });
  }

  function editDocument(body) {
    if (readOnly(record())) return;
    if (!editingSnapshot) { editingSnapshot = clone(state); previous = editingSnapshot; }
    const previousTitle = record().title;
    state.workspace = model.applyEdit(workspace(), state.document, body).workspace;
    if (record().title !== previousTitle) {
      root.querySelectorAll('aside [data-record]').forEach(button => {
        if (button.dataset.record === record().id && button.querySelector('span:last-child')) button.querySelector('span:last-child').textContent = record().title;
      });
      const database = workspace().databases[record().database];
      main.querySelector('.b-document-header .b-eyebrow').innerHTML = `<span class="b-color-dot" data-document-color data-color="${recordColor(record())}" aria-hidden="true"></span> ${escape(database?.title || 'Documents')} / ${escape(record().title)}`;
    }
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
      else if (button.hasAttribute('data-theme-toggle')) changeAppearance(nextTheme(appearance.theme, systemAppearance.matches)).then(() => themePicker?.render());
      else if (button.dataset.walkthrough) handleWalkthrough(button.dataset.walkthrough);
      else if (button.hasAttribute('data-quick-open')) openQuickOpen();
      else if (button.dataset.create) showCreate(button.dataset.create, button.dataset.forProject || null);
      else if (button.hasAttribute('data-cancel-create')) { Object.assign(state, creation.previous); creation = null; render(); }
      else if (button.dataset.view === 'meeting') openRecord(state.note);
      else if (button.dataset.view) navigate(button.dataset.view);
      else if (button.dataset.record) openRecord(button.dataset.record);
      else if (button.dataset.project) navigate('daily', button.dataset.project);
      else if (button.hasAttribute('data-undo') && previous) {
        rememberPresentation();
        const snapshot = previous; previous = null; state = snapshot; editingSnapshot = null; proposal = false; navigation.visit(location());
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
        const database = workspace().databases[creation.database], relation = projectField(database, getProject(creation.project)), project = String(values.get('project') || '');
        const properties = relation && project ? { [relation.id]: relation.cardinality === 'many' ? [project] : project } : {};
        const result = model.createDocument(workspace(), { database: database.id, title: String(values.get('title')), properties });
        previous = null;
        state.workspace = result.workspace; creation = null;
        navigate('document', null, result.documentId);
        notify('Created a Markdown document.');
        liveEditor?.focus();
      } catch (error) { const panel = main.querySelector('#b-create-error'); panel.hidden = false; panel.textContent = error.message; }
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
    if (!desktop && (event.key === appearanceKey || event.key === null)) { appearance.theme = readTheme(); applyAppearance(); themePicker?.render(); }
    if (!desktop && (event.key === BentoProfile.key || event.key === null)) { profile = BentoProfile.read(); refreshGreeting(); }
    if (!desktop && (event.key === themePreferencesKey || event.key === null)) { themePreferences = readThemePreferences(); applyAppearance(); themePicker?.render(); }
    if (event.key === storageKey && event.newValue !== expectedStorage) { storageLocked = true; storageWarning = 'Another page changed the saved workspace; this session will not overwrite it.'; notify('Workspace changed elsewhere.'); }
  });
  document.addEventListener('visibilitychange', refreshGreeting);
  window.addEventListener('focus', refreshGreeting);
  setInterval(refreshGreeting, 60_000);
  window.addEventListener('openai:set_globals', event => {
    const saved = event.detail?.globals?.widgetState?.privateContent;
    if (!desktop && validSnapshot(saved) && saved.savedAt > state.savedAt && !editingSnapshot) { state = clone(saved); previous = null; proposal = false; navigation.reset(location()); render(); }
  });
  if (desktop) {
    await loadPersonal();
    root.dataset.desktop = 'true';
    root.querySelector('.b-demo').textContent = 'Markdown workspace';
    root.querySelector('.b-demo').hidden = true;
    root.querySelector('.b-theme-toggle').insertAdjacentHTML('beforebegin', `<div class="b-file-controls"><details class="b-workspace-menu"><summary aria-label="Workspace actions"><span data-workspace-name>Workspace</span><span aria-hidden="true">⌄</span></summary><div><button type="button" data-quick-open>Quick open…</button><button type="button" data-walkthrough="replay" hidden>Replay walkthrough</button><button type="button" data-files="open">Open workspace</button><button type="button" data-files="create">New workspace</button><button type="button" data-files="example">Try an example workspace</button><button type="button" data-files="reload" disabled>Reload files</button><button type="button" data-files="save" disabled>Save files</button><button type="button" data-files="restore" hidden>Restore draft</button><button type="button" data-files="draft" hidden>Download draft</button></div></details><button type="button" class="b-draft-notice" data-draft-notice hidden>Draft available</button><span id="b-save-state" role="status" aria-live="polite"></span></div>`);
    root.querySelector('.b-shell').insertAdjacentHTML('beforebegin', '<p id="b-file-errors" class="b-issues" role="alert" hidden></p>');

    const errors = root.querySelector('#b-file-errors');
    files = new BentoFileSession(desktop, {
      workspace,
      activate(view) {
        walkthrough = new Walkthrough(view);
        root.querySelector('[data-walkthrough="replay"]').hidden = !walkthrough.valid;
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
        state.note = Object.values(workspace().records).find(isNote)?.id;
        previous = null; editingSnapshot = null; proposal = false;
        quickOpen.close(); navigation.reset(location()); shortcutController.clear();
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
      if (action === 'example') files.open(() => desktop.create('example'));
      else if (action === 'open' || action === 'create' || action === 'reload') files.open(() => desktop[action]());
      else if (action === 'save') files.save();
      else if (action === 'restore') files.restore();
      else if (action === 'draft') files.downloadDraft();
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
    const tweak = new globalThis.Tweak({ container: root, onChange: () => changeAppearance(appearance.theme) });
    tweak.addSelect(appearance, 'theme', { label: 'Appearance', options: ['system', 'light', 'dark'] });
  }
})();
