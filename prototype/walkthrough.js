import { escapeProperty as escape } from './property-editor.js';
const steps = [
  { label: 'Project', title: 'Start with a project', text: 'A project is a page for the big picture. Its meetings and actions stay connected, so you can always find the context.', tip: 'Click into the project below and add a sentence. Changes save automatically.', next: 'Try meeting notes' },
  { label: 'Meeting', title: 'Capture a meeting and its actions', text: 'Take notes right on the page. Every checkbox becomes a todo, with its own space for details and a link back to this meeting.', tip: 'On a new line, type [] then Space to start an action. Type @ after its title to choose a due date or another property.', next: 'Review upcoming work' },
  { label: 'Daily review', title: 'See what needs your attention', text: 'Your actions come together here across every project. Nothing gets lost between a meeting and tomorrow morning.', tip: 'Complete an example action, or click its date to move it to Tomorrow. Use the counts above My work to focus your day.', next: 'Finish walkthrough' }
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
  back() { this.set(Math.max(0, this.step - 1)); }
  dismiss() { this.set(steps.length); }
  replay() { this.set(0); }
  html() {
    if (!this.active) return '';
    const step = steps[this.step];
    return `<section class="b-walkthrough" aria-label="Getting started"><div class="b-walkthrough-copy"><ol class="b-tour-progress" aria-label="Tour progress">${steps.map((item, index) => `<li ${index === this.step ? 'aria-current="step"' : ''} class="${index < this.step ? 'b-tour-done' : ''}"><span aria-hidden="true">${index < this.step ? '✓' : index + 1}</span>${escape(item.label)}</li>`).join('')}</ol><h2><button type="button" data-walkthrough="show" title="Show this step">${escape(step.title)}</button></h2><p>${escape(step.text)}</p><p class="b-tour-tip"><strong>Try it</strong> ${escape(step.tip)}</p></div><div class="b-walkthrough-actions"><button type="button" class="b-button b-primary" data-walkthrough="next">${escape(step.next)}</button>${this.step ? '<button type="button" class="b-tour-back" data-walkthrough="back">Back</button>' : ''}<button type="button" data-walkthrough="dismiss">Skip walkthrough</button></div></section>`;
  }
  completion() {
    return '<section class="b-tour-finish" aria-label="Walkthrough complete"><span class="b-tour-check" aria-hidden="true">✓</span><div><h2 tabindex="-1">A little more room for your day.</h2><p>You’ve seen how notes become actions, and actions become a plan. Keep exploring this example, or start fresh with your own work.</p><div class="b-actions"><button type="button" class="b-button b-primary" data-files="create">Create my workspace</button><button type="button" class="b-button" data-walkthrough="close-finish">Keep exploring</button></div></div></section>';
  }
}
