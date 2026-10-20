import { setBlockType, wrapIn } from 'prosemirror-commands';
import { wrapInList } from 'prosemirror-schema-list';
import { Fragment } from 'prosemirror-model';
import { Selection, TextSelection } from 'prosemirror-state';
import { editorSchema as schema } from './rich-markdown.js';

export const slashCommands = Object.freeze([
  { id: 'text', title: 'Text', detail: 'Plain paragraph · paragraph' },
  { id: 'heading1', title: 'Heading 1', detail: 'Large heading · h1' },
  { id: 'heading2', title: 'Heading 2', detail: 'Section heading · h2' },
  { id: 'heading3', title: 'Heading 3', detail: 'Small heading · h3' },
  { id: 'bullet', title: 'Bulleted list', detail: 'Unordered list · bullet' },
  { id: 'numbered', title: 'Numbered list', detail: 'Ordered list · number' },
  { id: 'todo', title: 'Todo', detail: 'Tracked checkbox · task' },
  { id: 'quote', title: 'Quote', detail: 'Block quotation' },
  { id: 'code', title: 'Code block', detail: 'Plain-text code' },
  { id: 'divider', title: 'Divider', detail: 'Horizontal rule' },
  { id: 'table', title: 'Table', detail: 'Two-column table' }
]);
function table() {
  const { table, table_row: row, table_header: header, table_cell: cell, paragraph } = schema.nodes;
  const heading = label => header.create(null, paragraph.create(null, schema.text(label)));
  return table.create(null, [row.create(null, [heading('Column 1'), heading('Column 2')]), row.create(null, [cell.create(null, paragraph.create()), cell.create(null, paragraph.create())])]);
}
export function slashTransaction(state, id, range) {
  if (!slashCommands.some(command => command.id === id)) return null;
  const transaction = state.tr.delete(range.from, range.to), cleared = state.apply(transaction);
  if (['divider', 'table'].includes(id)) {
    const { $from } = cleared.selection;
    if ($from.depth !== 1 || $from.parent.content.size) return null;
    const start = $from.before(), node = id === 'table' ? table() : schema.nodes.horizontal_rule.create();
    transaction.replaceWith(start, $from.after(), Fragment.fromArray([node, schema.nodes.paragraph.create()]));
    transaction.setSelection(TextSelection.create(transaction.doc, start + (id === 'table' ? 4 : node.nodeSize + 1)));
    return transaction.scrollIntoView();
  }
  const operation = id.startsWith('heading') ? setBlockType(schema.nodes.heading, { level: Number(id.at(-1)) })
    : id === 'text' ? setBlockType(schema.nodes.paragraph)
    : id === 'code' ? setBlockType(schema.nodes.code_block)
    : id === 'quote' ? wrapIn(schema.nodes.blockquote)
    : wrapInList(id === 'numbered' ? schema.nodes.ordered_list : schema.nodes.bullet_list);
  let changed;
  if (!operation(cleared, value => { changed = value; }) && id !== 'text') return null;
  if (changed) {
    for (const step of changed.steps) transaction.step(step);
    transaction.setSelection(Selection.fromJSON(transaction.doc, changed.selection.toJSON()));
  }
  if (id === 'todo') {
    const { $from } = transaction.selection;
    for (let depth = $from.depth; depth > 0; depth--) if ($from.node(depth).type === schema.nodes.list_item) {
      transaction.setNodeMarkup($from.before(depth), null, { ...$from.node(depth).attrs, checked: false }); break;
    }
  }
  transaction.setStoredMarks([]); return transaction.scrollIntoView();
}
