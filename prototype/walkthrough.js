import { escapeProperty as escape } from './property-editor.js';
const steps = [
  { title: 'Start with a project', text: 'This example has two fictional projects. A project is a page for your notes, with meeting notes and actions connected to it.', next: 'Try meeting notes' },
  { title: 'Capture a meeting and its actions', text: 'Write directly in the meeting note. Type [] followed by a space to add an action. Every checkbox becomes a tracked todo; open an action to keep notes about it.', next: 'Review upcoming work' },
  { title: 'See what needs your attention', text: 'Your daily overview brings upcoming work together across projects. Use Review work on a project for its actions and related meeting notes. Try completing an example action.', next: 'Finish walkthrough' }
];
export default class Walkthrough {
  constructor(view, storage) {
    this.config = view.walkthrough;
    this.valid = this.config?.version === 1 && !!view.workspace.records[this.config.project] && !!view.workspace.records[this.config.meeting];
    this.step = 0;
    if (!this.valid) return;
    this.key = 'bento.walkthrough.v1:' + this.config.project;
    try {
      this.storage = storage ?? globalThis.localStorage;
      const value = JSON.parse(this.storage.getItem(this.key));
      if (Number.isInteger(value) && value >= 0 && value <= steps.length) this.step = value;
    } catch { /* A walkthrough still works without local preferences. */ }
  }
  get active() { return this.valid && this.step < steps.length; }
  location() {
    return this.step === 0 ? { view: 'document', document: this.config.project } : this.step === 1 ? { view: 'document', document: this.config.meeting } : { view: 'daily', document: null };
  }
  set(step) {
    this.step = step;
    try { this.storage?.setItem(this.key, JSON.stringify(step)); } catch { /* Retain session progress. */ }
  }
  next() { this.set(Math.min(this.step + 1, steps.length)); }
  dismiss() { this.set(steps.length); }
  replay() { this.set(0); }
  html() {
    if (!this.active) return '';
    const step = steps[this.step];
    return `<section class="b-walkthrough" aria-label="Getting started"><div><p class="b-eyebrow">Example workspace · ${this.step + 1} of ${steps.length}</p><h2><button type="button" data-walkthrough="show" title="Show this step">${escape(step.title)}</button></h2><p>${escape(step.text)}</p></div><div class="b-walkthrough-actions"><button type="button" class="b-button b-primary" data-walkthrough="next">${escape(step.next)}</button><button type="button" data-walkthrough="dismiss">Skip walkthrough</button></div></section>`;
  }
}
