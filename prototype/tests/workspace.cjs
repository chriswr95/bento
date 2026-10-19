const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../workspace.js');
const initial=()=>model.createWorkspace({coordination:'# Meeting\n',drainage:'# Drainage\n'});
const edit=(workspace,body,id='coordination')=>model.applyEdit(workspace,id,body).workspace;
const task=(workspace)=>model.allTasks(workspace)[0];

test('checkbox capture creates one separately editable document and stable reference',()=>{
 const first=edit(initial(),'# Meeting\n\n- [ ] Review comments (due 2026-10-24)\n');
 const todo=task(first), note=first.records.coordination;
 assert.equal(model.allTasks(first).length,1);
 assert.equal(first.records[todo.id].database,'db-todos');
 assert.equal(todo.due,'2026-10-24');
 assert.equal(todo.project,'creek');
 assert.match(note.body,new RegExp(todo.id));
 const withNotes=edit(first,'# Working notes\n\nThe comments need another pass.\n',todo.id);
 const moved=edit(withNotes,'# Another heading\n\n'+withNotes.records.coordination.body);
 assert.equal(task(moved).id,todo.id);
 assert.match(moved.records[todo.id].body,/another pass/);
 assert.equal(first.records[todo.id].body,'');
});

test('completion from a todo and source updates one record, preserving its body',()=>{
 let workspace=edit(initial(),'- [ ] Review comments\n');
 const todo=task(workspace);
 workspace=edit(workspace,'My detailed notes',todo.id);
 workspace=model.updateTodo(workspace,todo.id,{done:true,title:'Review the revised comments'});
 assert.match(workspace.records.coordination.body,/- \[x\] \[Review the revised comments\]/);
 const body=workspace.records.coordination.body.replace('[x]','[ ]');
 workspace=edit(workspace,body);
 assert.equal(task(workspace).done,false);
 assert.equal(workspace.records[todo.id].body,'My detailed notes');
});

test('removing references retains records and notes; duplicate titles remain separate',()=>{
 let workspace=edit(initial(),'- [ ] Repeated\n- [ ] Repeated\n');
 const todos=model.allTasks(workspace);
 assert.equal(todos.length,2);
 assert.notEqual(todos[0].id,todos[1].id);
 workspace=edit(workspace,'Retain this detail',todos[0].id);
 workspace=edit(workspace,'# Meeting without references');
 assert.equal(model.allTasks(workspace).length,2);
 assert.equal(workspace.records[todos[0].id].body,'Retain this detail');
 assert.equal(model.sourcesFor(workspace,todos[0].id).length,0);
});

test('pasting linked occurrences uses one todo ID and one checkpoint per source document',()=>{
 let workspace=edit(initial(),'- [ ] Review\n');
 workspace=edit(workspace,workspace.records.coordination.body.repeat(2));
 assert.equal(model.allTasks(workspace).length,1);
 assert.equal(Object.keys(workspace.records.coordination.references).length,1);
 const checked=model.updateTodo(workspace,task(workspace).id,{done:true});
 assert.equal(model.parse(checked.records.coordination.body).tasks.filter(t=>t.done).length,2);
});

test('source references across notes propagate canonical status',()=>{
 let workspace=edit(initial(),'- [ ] Review\n');
 const todo=task(workspace);
 workspace=edit(workspace,workspace.records.coordination.body,'drainage');
 assert.equal(Object.keys(workspace.records.coordination.references)[0],Object.keys(workspace.records.drainage.references)[0]);
 workspace=model.updateTodo(workspace,todo.id,{done:true});
 assert.match(workspace.records.coordination.body,/\[x\]/);
 assert.match(workspace.records.drainage.body,/\[x\]/);
 assert.equal(model.allTasks(workspace).length,1);
});

test('nested, ordered, and quoted tasks capture; code/HTML examples do not',()=>{
 const workspace=edit(initial(),'- [ ] Parent\n  - [x] Child\n\n1. [ ] Ordered\n\n> - [ ] Quoted\n\n```\n- [ ] Code\n```\n\n    - [ ] Indented\n\n<div>\n- [ ] HTML\n</div>\n');
 assert.deepEqual(model.allTasks(workspace).map(t=>t.title),['Parent','Child','Ordered','Quoted']);
 assert.equal(model.allTasks(workspace)[1].done,true);
});

test('conflicting edits and missing baselines preserve both representations',()=>{
 let workspace=edit(initial(),'- [ ] Original\n');
 const todo=task(workspace);
 workspace.records[todo.id].title='Remote title';
 workspace=edit(workspace,workspace.records.coordination.body.replace('[Original]','[Local title]'));
 assert.equal(workspace.records[todo.id].title,'Remote title');
 assert.match(workspace.records.coordination.body,/Local title/);
 assert.match(workspace.issues[0].message,/Conflicting title/);
 let other=edit(initial(),'- [ ] Another\n');
 const reference=Object.values(other.records.coordination.references)[0];
 delete reference.base_title;
 other=edit(other,other.records.coordination.body);
 assert.match(other.issues[0].message,/Missing title baseline/);
});

test('membership and malformed updates fail without mutating the input',()=>{
 const workspace=initial(), invalid=model.clone(workspace);
 invalid.records.coordination.database=['db-meetings','db-todos'];
 assert.throws(()=>model.assertWorkspace(invalid),/zero or one/);
 let withTask=edit(workspace,'- [ ] Review\n');
 assert.throws(()=>model.updateTodo(withTask,task(withTask).id,{due:'2026-02-30'}),/valid due date/);
 assert.throws(()=>model.updateTodo(withTask,task(withTask).id,{done:'false'}),/boolean/);
 assert.equal(task(withTask).done,false);
});

test('missing capture destination retains plain source and reports a pending action',()=>{
 const workspace=initial();
 workspace.defaultTaskDatabase=null;
 const next=edit(workspace,'- [ ] Keep this action\n');
 assert.equal(model.allTasks(next).length,0);
 assert.equal(next.records.coordination.body,'- [ ] Keep this action\n');
 assert.match(next.issues[0].message,/Choose a task database/);
});

test('special labels round-trip and Markdown exports contain record metadata/body',()=>{
 let workspace=edit(initial(),'- [ ] Check <sample> & [brackets] \\ path\n');
 const todo=task(workspace);
 workspace=edit(workspace,workspace.records.coordination.body);
 assert.equal(task(workspace).title,todo.title);
 assert.equal(model.allTasks(workspace).length,1);
 const exported=model.serializeDocument(workspace.records[todo.id]);
 assert.match(exported,/^---\nbento_version: 1\nid: "todo-/);
 assert.doesNotMatch(exported,/^database:/m);
 assert.match(exported,/field-task-status/);
});


test('invalid capability bindings and reference metadata are rejected',()=>{
 const workspace=initial();
 workspace.databases['db-todos'].capabilities.task.completion.field='missing-field';
 assert.throws(()=>model.assertWorkspace(workspace),/completion mapping/);
 const other=initial();
 other.records.coordination.references['ref-invalid']=null;
 assert.throws(()=>model.assertWorkspace(other),/reference metadata/);
});


test('one changed repeated link propagates without being undone by an unchanged occurrence',()=>{
 let workspace=edit(initial(),'- [ ] Review\n');
 workspace=edit(workspace,workspace.records.coordination.body.repeat(2));
 workspace=edit(workspace,workspace.records.coordination.body.replace('[Review]','[Revised]'));
 assert.equal(task(workspace).title,'Revised');
 assert.equal(workspace.records.coordination.body.match(/\[Revised\]/g).length,2);
 assert.deepEqual(workspace.issues,[]);
 assert.doesNotMatch(workspace.records.coordination.body,/bento-ref/);
});

test('conflicting repeated labels preserve the entire group without partially writing status',()=>{
 let workspace=edit(initial(),'- [ ] Review\n');
 const original=workspace.records.coordination.body;
 workspace=edit(workspace,original.replace('[Review]','[First]').replace('[ ]','[x]')+original.replace('[Review]','[Second]'));
 assert.equal(task(workspace).title,'Review');
 assert.equal(task(workspace).done,false);
 assert.match(workspace.issues[0].message,/Conflicting title/);
 assert.match(workspace.records.coordination.body,/First/);
 assert.match(workspace.records.coordination.body,/Second/);
});

test('new missing or stale linked targets are preserved rather than captured as new todos',()=>{
 let workspace=edit(initial(),'- [ ] Review\n');
 const count=model.allTasks(workspace).length;
 workspace=edit(workspace,'- [ ] [Missing](todo-missing.md)\n'+workspace.records.coordination.body.replace('[Review]','[Old title]'),'drainage');
 assert.equal(model.allTasks(workspace).length,count);
 assert.match(workspace.issues.map(item=>item.message).join(' '),/Unresolved todo link/);
 assert.match(workspace.issues.map(item=>item.message).join(' '),/New todo link differs/);
});

test('legacy migration preserves todo IDs, body notes, and checkpoints without mutating its input',()=>{
 const workspace=edit(initial(),'- [ ] Review\n'), todo=task(workspace);
 const old=model.clone(workspace); old.version=3;
 old.records[todo.id].body='Detailed notes';
 old.records.coordination.references={'ref-old':{target:todo.id,base_title:todo.title,base_completed:false}};
 old.records.coordination.body=old.records.coordination.body.trimEnd()+' <!-- bento-ref: ref-old -->\n';
 const migrated=model.migrateWorkspace(old);
 assert.equal(migrated.version,4);
 assert.equal(migrated.records[todo.id].body,'Detailed notes');
 assert.doesNotMatch(migrated.records.coordination.body,/bento-ref/);
 assert.deepEqual(Object.keys(migrated.records.coordination.references),[todo.id]);
 assert.match(old.records.coordination.body,/bento-ref/);
 old.records.coordination.references['ref-other']={target:todo.id,base_title:'Contradictory',base_completed:false};
 assert.throws(()=>model.migrateWorkspace(old),/disagree/);
});
