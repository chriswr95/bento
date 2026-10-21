import { TextSelection } from 'prosemirror-state';
import { sinkListItem, liftListItem } from 'prosemirror-schema-list';

export function indentList(outdent = false) {
  return (state, dispatch) => {
    const item = state.schema.nodes.list_item, { $from } = state.selection;
    let depth = 0;
    for (let index = 1; index <= $from.depth; index++) if ($from.node(index).type === item) depth++;
    if (!depth) return false;
    if (!outdent || depth > 1) (outdent ? liftListItem(item) : sinkListItem(item))(state, dispatch);
    return true;
  };
}
export function indentCode(outdent = false) {
  return (state, dispatch) => {
    const { selection } = state, { $from, $to } = selection;
    if (!$from.parent.type.spec.code || !$from.sameParent($to)) return false;
    if (!dispatch) return true;
    if (!outdent && selection.empty) { dispatch(state.tr.insertText('  ').scrollIntoView()); return true; }
    const text = $from.parent.textContent, start = text.slice(0, $from.parentOffset).lastIndexOf('\n') + 1;
    const last = $to.parentOffset - (selection.empty ? 0 : 1), edits = [];
    for (let offset = start; offset <= last; ) {
      const remove = outdent ? /^(?:\t| {1,2})/.exec(text.slice(offset))?.[0].length || 0 : 0;
      if (!outdent || remove) edits.push({ from: $from.start() + offset, remove });
      const newline = text.indexOf('\n', offset); if (newline < 0) break; offset = newline + 1;
    }
    if (!edits.length) return true;
    const tr = state.tr;
    for (const edit of edits.reverse()) tr.insertText(outdent ? '' : '  ', edit.from, edit.from + edit.remove);
    tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(selection.anchor), tr.mapping.map(selection.head)));
    dispatch(tr.scrollIntoView()); return true;
  };
}
