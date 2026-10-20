import PageLinkPicker from './page-link-picker.js';
import { slashCommands, slashTransaction } from './slash-commands.js';

export default class SlashPicker extends PageLinkPicker {
  constructor(editor, options) {
    super(editor, { ...options, emptyMessage: 'No matching commands', pages: () => [...slashCommands, ...(options.databases?.() || []).map(database => ({ id: 'database:' + database.id, database: database.id, title: 'New page in ' + database.title, detail: 'Create a database entry · @ to set properties' }))] });
    this.menu.id = 'b-slash-picker'; this.menu.classList.add('b-slash-picker'); this.menu.setAttribute('aria-label', 'Slash commands');
  }
  query() { return super.query(/^\/([^\n/]{0,100})$/); }
  choose(index) {
    const command = this.results[index]; if (!command) return;
    const range = this.range; this.close();
    if (command.database) {
      this.editor.view.dispatch(this.editor.view.state.tr.delete(range.from, range.to));
      this.options.createDatabase?.(command.database);
      return;
    }
    const transaction = slashTransaction(this.editor.view.state, command.id, range);
    if (!transaction) { this.options.error?.('This block cannot be inserted here. Try an empty paragraph.'); return; }
    this.editor.view.dispatch(transaction); this.editor.view.focus();
  }
}
