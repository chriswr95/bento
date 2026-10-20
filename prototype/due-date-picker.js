import model from './workspace.js';
import profile from './profile.js';

export function nextDate(today) {
  if (!model.validDate(today)) throw new Error('Invalid review date.');
  const date = new Date(today + 'T12:00:00'); date.setDate(date.getDate() + 1);
  return profile.dateKey(date);
}
export default class DueDatePicker {
  constructor(root, options) {
    this.options = options;
    this.dialog = document.createElement('dialog'); this.dialog.className = 'b-due-picker'; this.dialog.setAttribute('aria-label', 'Reschedule todo');
    this.dialog.innerHTML = `<h2></h2><label>Due date<input type="date" aria-label="Due date"></label><div class="b-due-shortcuts"><button type="button" data-due-choice="today">Today</button><button type="button" data-due-choice="tomorrow">Tomorrow</button><button type="button" data-due-choice="clear">No date</button></div><p class="b-issues" role="alert" hidden></p><div class="b-actions"><button type="button" class="b-button" data-due-cancel>Cancel</button><button type="button" class="b-button b-primary" data-due-apply>Set date</button></div>`;
    root.append(this.dialog); this.input = this.dialog.querySelector('input'); this.error = this.dialog.querySelector('[role=alert]');
    this.dialog.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.hasAttribute('data-due-cancel')) this.close();
      else if (button.hasAttribute('data-due-apply')) this.save(this.input.value, true);
      else if (button.dataset.dueChoice) {
        const choice = button.dataset.dueChoice;
        this.save(choice === 'clear' ? '' : choice === 'today' ? this.options.today() : nextDate(this.options.today()));
      }
    });
    this.dialog.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target === this.input && !event.isComposing) { event.preventDefault(); this.save(this.input.value, true); }
    });
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
  }
  show(task) {
    this.task = task.id; this.input.value = task.due; this.error.hidden = true;
    this.dialog.querySelector('h2').textContent = task.title;
    this.dialog.showModal(); this.input.focus();
  }
  close() {
    this.dialog.close();
    const button = [...this.dialog.parentElement.querySelectorAll('[data-reschedule]')].find(button => button.dataset.reschedule === this.task);
    button?.focus({ preventScroll: true });
  }
  save(value, validateInput = false) {
    if (validateInput && !this.input.checkValidity() || value && !model.validDate(value)) { this.error.textContent = 'Enter a valid date.'; this.error.hidden = false; return; }
    try { this.options.change(this.task, value); this.close(); }
    catch (error) { this.error.textContent = error.message; this.error.hidden = false; }
  }
}
