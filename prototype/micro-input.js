import MicroPropertyPicker from './micro-property-picker.js';
import { propertyQuery, entryFields, fieldValue } from './micro-syntax.js';

export default class MicroInput {
  constructor(input, options) {
    this.controller = new AbortController();
    this.picker = new MicroPropertyPicker(options.root, {
      host: input, workspace: options.workspace, today: options.today,
      query: () => {
        if (this.composing || input.selectionStart !== input.selectionEnd) return null;
        const query = propertyQuery(input.value, input.selectionStart);
        return query && { ...query, token: input.value.slice(query.from, query.to), target: options.database() };
      },
      rect: () => input.getBoundingClientRect(),
      fields: () => entryFields(options.workspace(), options.database()),
      value: (_context, field) => fieldValue(options.record(), field),
      apply: (context, field, patch) => {
        if (input.value.slice(context.from, context.to) !== context.token || options.database() !== context.target) throw new Error('The entry changed. Select the property again.');
        options.apply(field, patch);
        input.setRangeText('', context.from, context.to, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      focus: () => input.focus()
    });
    const on = (name, handler) => input.addEventListener(name, handler, { signal: this.controller.signal });
    on('input', event => { if (!event.isComposing) this.picker.update(); });
    on('compositionstart', () => { this.composing = true; this.picker.close(); });
    on('compositionend', () => { this.composing = false; this.picker.update(); });
    on('click', () => this.picker.update());
    on('keydown', event => this.picker.keydown(event));
    on('keyup', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) this.picker.update(); });
  }
  destroy() { this.controller.abort(); this.picker.destroy(); }
}
