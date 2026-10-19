const { test } = require('node:test');
const assert = require('node:assert/strict');
const schema = require('../prototype/schema.js');
const option = { id: 'one', name: 'One' };
test('typed values distinguish text, finite numbers, booleans, real dates, choices and cardinality', () => {
  const cases = [
    [{type:'text'}, '123', 123],
    [{type:'number',min:0}, 1.5, -1],
    [{type:'number',integer:true}, 2, 2.5],
    [{type:'boolean'}, false, 'false'],
    [{type:'date'}, '2028-02-29', '2027-02-29'],
    [{type:'select',options:[option]}, 'one', 'two'],
    [{type:'status',options:[{...option,group:'in-progress'}]}, 'one', 'two'],
    [{type:'multi-select',options:[option]}, ['one'], ['one','one']],
    [{type:'relation',cardinality:'one'}, 'project-1', ['project-1']],
    [{type:'relation',cardinality:'many'}, ['project-1'], 'project-1']
  ];
  for (const [field,good,bad] of cases) {
    schema.value({...field,name:'Test'}, good);
    assert.throws(()=>schema.value({...field,name:'Test'},bad),/Invalid value/);
  }
  assert.throws(()=>schema.value({type:'number',name:'Hours'}, Infinity),/Invalid value/);
  assert.throws(()=>schema.value({type:'text',name:'Client',required:true}, null),/required/);
});
test('status groups and field defaults are validated in definitions', () => {
  const database={id:'db-test',title:'Test',schema_version:1,fields:[{id:'status',name:'Status',type:'status',options:[{...option,group:'unknown'}]}]};
  assert.throws(()=>schema.definition(database,{'db-test':database}),/status group/);
  database.fields[0].options[0].group='complete';
  database.fields[0].default='missing';
  assert.throws(()=>schema.definition(database,{'db-test':database}),/Invalid value/);
});

test('broken project capability bindings are rejected before rendering summaries', () => {
  const model=require('../prototype/workspace.js');
  const workspace=model.createWorkspace();
  workspace.databases['db-projects'].capabilities.project.active.field='missing';
  assert.throws(()=>model.assertWorkspace(workspace),/active-project mapping/);
});
