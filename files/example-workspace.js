import model from '../prototype/workspace.js';
import profile from '../prototype/profile.js';

// Ordinary documents and the same checkbox capture path used by the editor.
export function exampleWorkspace(empty, today = new Date()) {
  let workspace = model.clone(empty);
  const date = offset => {
    const value = new Date(today); value.setDate(value.getDate() + offset);
    return profile.dateKey(value);
  };
  function document(database, title, body, properties = {}, color = 'blue') {
    const created = model.createDocument(workspace, { database, title, properties });
    workspace = created.workspace;
    workspace.records[created.documentId].tags = ['example'];
    workspace.records[created.documentId].color = color;
    workspace = model.applyEdit(workspace, created.documentId, body).workspace;
    return created.documentId;
  }
  const project = document('db-projects', 'Creekside path improvements', '# Creekside path improvements\n\nFictional example project — change anything as you explore.\n\n## Goal\n\nPrepare the next plan review for a neighborhood walking path.\n\n## Current focus\n\nResolve review comments and send a short coordination follow-up. Meeting notes and actions stay connected to this project.\n', {}, 'green');
  const drainage = document('db-projects', 'Maple Avenue drainage', '# Maple Avenue drainage\n\nFictional example project.\n\n## Current focus\n\nCollect questions before the next drainage review.\n', {}, 'purple');
  const meeting = document('db-meetings', 'Weekly coordination', `# Weekly coordination\n\nFictional meeting · ${date(0)}\n\n## Discussion & decisions\n\nUse the latest marked-up plan for the next review. Keep the follow-up focused on open comments and next steps.\n\n## My action items\n\n- [ ] Review the marked-up path comments (due ${date(0)})\n- [ ] Send the coordination follow-up (due ${date(3)})\n- [x] Gather the working plan notes\n\n## Try it\n\nAdd your own checkbox below with \`[] \` or \`- [ ] \`, then type an action. Bento will track it as a todo for this project.\n`, { 'field-meeting-date': date(0), 'field-meeting-projects': [project] }, 'green');
  document('db-meetings', 'Drainage check-in', '# Drainage check-in\n\nFictional example meeting.\n\n## Discussion\n\nCollect the remaining questions before scheduling the next review.\n\n## My action items\n\n- [ ] List questions for the drainage review\n', { 'field-meeting-date': date(-1), 'field-meeting-projects': [drainage] }, 'purple');
  const task = model.allTasks(workspace).find(item => item.title === 'Review the marked-up path comments');
  workspace = model.applyEdit(workspace, task.id, '# Working notes\n\nUse this space for notes about this action. Each todo is its own Markdown document.\n\n## Follow-up\n\nSummarize the open comments before the next coordination meeting.\n').workspace;
  return { workspace, walkthrough: { version: 1, project, meeting } };
}
