import PageLinkPicker from './page-link-picker.js';
import { slashCommands, slashTransaction } from './slash-commands.js';

export default class SlashPicker extends PageLinkPicker {
  constructor(editor, options) {
    super(editor, { ...options, emptyMessage: 'No matching commands', pages: () => slashCommands });
    this.menu.id = 'b-slash-picker'; this.menu.classList.add('b-slash-picker'); this.menu.setAttribute('aria-label', 'Slash commands');
  }
  query() { return super.query(/^\/([a-z0-9 -]{0,40})$/i); }
  choose(index) {
    const command = this.results[index]; if (!command) return;
    const range = this.range; this.close();
    const transaction = slashTransaction(this.editor.view.state, command.id, range);
    if (!transaction) { this.options.error?.('This block cannot be inserted here. Try an empty paragraph.'); return; }
    this.editor.view.dispatch(transaction); this.editor.view.focus();
  }
}
