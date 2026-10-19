import model from './workspace.js';

function related(workspace, document, project) {
  return (workspace.databases[document.database]?.fields || []).some(field => {
    if (field.type !== 'relation' || field.target_database !== project.database) return false;
    const value = document.properties[field.id];
    return Array.isArray(value) ? value.includes(project.id) : value === project.id;
  });
}
export function projectReview(workspace, projectId, today) {
  const project = workspace.records[projectId];
  if (!model.capability(workspace, project, 'project')) throw new Error('Project not found.');
  if (!model.validDate(today)) throw new Error('Invalid review date.');
  const tasks = model.allTasks(workspace).filter(task => task.project === projectId)
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title));
  const groups = { overdue: [], today: [], upcoming: [], undated: [], completed: [] };
  for (const task of tasks) {
    const group = task.done ? 'completed' : !task.due ? 'undated' : task.due < today ? 'overdue' : task.due === today ? 'today' : 'upcoming';
    groups[group].push(task);
  }
  const notes = Object.values(workspace.records).filter(document => !model.capability(workspace, document, 'project') && !model.taskInfo(workspace, document) && related(workspace, document, project))
    .sort((a, b) => a.title.localeCompare(b.title));
  return { project, notes, groups, open: tasks.length - groups.completed.length };
}
