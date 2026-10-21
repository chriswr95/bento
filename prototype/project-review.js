import model from './workspace.js';

function reviewIndex(workspace) {
  const tasks = model.allTasks(workspace).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const projects = new Map(Object.values(workspace.records).filter(record => model.capability(workspace, record, 'project')).map(project => [project.id, { project, tasks: [], notes: [] }]));
  for (const task of tasks) projects.get(task.project)?.tasks.push(task);
  for (const document of Object.values(workspace.records)) {
    if (model.capability(workspace, document, 'project') || model.taskInfo(workspace, document)) continue;
    const related = new Set();
    for (const field of workspace.databases[document.database]?.fields || []) {
      if (field.type !== 'relation' || field.unavailable) continue;
      const value = document.properties[field.id];
      for (const id of Array.isArray(value) ? value : value ? [value] : []) {
        if (projects.get(id)?.project.database === field.target_database) related.add(id);
      }
    }
    for (const id of related) projects.get(id).notes.push(document);
  }
  return { tasks, projects };
}
function groupTasks(tasks, today) {
  const groups = { overdue: [], today: [], upcoming: [], undated: [], completed: [] };
  for (const task of tasks) {
    const group = task.done ? 'completed' : !task.due ? 'undated' : task.due < today ? 'overdue' : task.due === today ? 'today' : 'upcoming';
    groups[group].push(task);
  }
  return groups;
}
function summarize(workspace, entry, today) {
  const groups = groupTasks(entry.tasks, today);
  const active = model.capability(workspace, entry.project, 'project').active;
  const field = workspace.databases[entry.project.database].fields.find(field => field.id === active.field);
  const status = field.options.find(option => option.id === entry.project.properties[field.id])?.name || 'Not set';
  const notes = entry.notes.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const recentNotes = notes.flatMap(document => {
    const dates = (workspace.databases[document.database]?.fields || []).filter(field => field.type === 'date' && !field.unavailable);
    const date = dates.length === 1 ? document.properties[dates[0].id] : null;
    return model.validDate(date) && date <= today ? [{ document, date }] : [];
  }).sort((a, b) => b.date.localeCompare(a.date) || a.document.title.localeCompare(b.document.title)).slice(0, 2);
  return { project: entry.project, status, notes, recentNotes, groups, open: entry.tasks.length - groups.completed.length, nextDue: groups.today[0] || groups.upcoming[0] || null };
}
export function projectReview(workspace, projectId, today) {
  if (!model.capability(workspace, workspace.records[projectId], 'project')) throw new Error('Project not found.');
  if (!model.validDate(today)) throw new Error('Invalid review date.');
  return summarize(workspace, reviewIndex(workspace).projects.get(projectId), today);
}
export function databaseProjectReviews(workspace, databaseId, today) {
  if (!model.validDate(today)) throw new Error('Invalid review date.');
  return [...reviewIndex(workspace).projects.values()]
    .filter(entry => entry.project.database === databaseId)
    .sort((a, b) => a.project.title.localeCompare(b.project.title) || a.project.id.localeCompare(b.project.id))
    .map(entry => summarize(workspace, entry, today));
}
export function dailyReview(workspace, today) {
  if (!model.validDate(today)) throw new Error('Invalid review date.');
  const index = reviewIndex(workspace), groups = groupTasks(index.tasks, today);
  const projects = model.activeProjects(workspace).map(project => summarize(workspace, index.projects.get(project.id), today))
    .sort((a, b) => b.groups.overdue.length - a.groups.overdue.length || b.groups.today.length - a.groups.today.length || (a.nextDue?.due || '9999').localeCompare(b.nextDue?.due || '9999') || a.project.title.localeCompare(b.project.title));
  return { groups, projects, open: index.tasks.length - groups.completed.length };
}
