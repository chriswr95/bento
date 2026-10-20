import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShortcutController, matchesKey } from '../prototype/shortcuts.js';
const event = (key, options = {}) => ({ key, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...options });
test('macOS and Windows modifiers match brackets without consuming formatting or modified variants', () => {
  assert.equal(matchesKey(event('[', { metaKey: true }), 'Mod+[', true), true);
  assert.equal(matchesKey(event('[', { ctrlKey: true }), 'Mod+[', false), true);
  assert.equal(matchesKey(event('[', { metaKey: true, shiftKey: true }), 'Mod+[', true), false);
  const actions = [], controller = new ShortcutController({ back: () => actions.push('back'), forward: () => actions.push('forward') }, { mac: false });
  controller.handle(event('ArrowLeft', { altKey: true })); controller.handle(event(']', { ctrlKey: true }));
  assert.deepEqual(actions, ['back', 'forward']); assert.equal(controller.handle(event('b', { ctrlKey: true })), false);
});
test('shortcut chords survive modifier re-presses and do not trigger Save', () => {
  const actions = [], controller = new ShortcutController({ shortcuts: () => actions.push('reference'), save: () => actions.push('save') }, { mac: true });
  controller.handle(event('k', { metaKey: true })); controller.handle(event('Meta', { metaKey: true })); controller.handle(event('s', { metaKey: true }));
  assert.deepEqual(actions, ['reference']);
  controller.handle(event('s', { metaKey: true })); assert.deepEqual(actions, ['reference', 'save']); controller.clear();
});
test('cancelled, unavailable and IME-composing shortcuts do not execute commands', () => {
  let calls = 0; const controller = new ShortcutController({ shortcuts: () => calls++, settings: () => calls++ }, { mac: true });
  controller.handle(event('k', { metaKey: true })); const escape = event('Escape'); controller.handle(escape);
  assert.equal(escape.prevented, true); assert.equal(controller.pending, null);
  assert.equal(controller.handle(event(',', { metaKey: true, isComposing: true })), false); assert.equal(calls, 0);
  controller.available = () => false; assert.equal(controller.handle(event(',', { metaKey: true })), false); controller.clear();
});
