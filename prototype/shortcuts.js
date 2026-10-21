export const isMac = platform => /Mac|iPhone|iPad/.test(platform ?? globalThis.navigator?.platform ?? '');
export const shortcuts = Object.freeze([
  { id: 'quick-open', command: 'Quick Open File', bindings: [['Mod+p']], context: 'Workspace', app: true },
  { id: 'command-search', command: 'Show Commands', bindings: [['Mod+Shift+p']], context: 'Workspace', app: true },
  { id: 'back', command: 'Go Back', bindings: [['Mod+[']], windows: [['Alt+ArrowLeft']], context: 'Workspace', app: true },
  { id: 'forward', command: 'Go Forward', bindings: [['Mod+]']], windows: [['Alt+ArrowRight']], context: 'Workspace', app: true },
  { id: 'settings', command: 'Open Settings', bindings: [['Mod+,']], context: 'Workspace', app: true },
  { id: 'shortcuts', command: 'Keyboard Shortcuts', bindings: [['Mod+k', 'Mod+s']], context: 'Workspace', app: true },
  { id: 'save', command: 'Save', bindings: [['Mod+s']], context: 'Workspace', app: true },
  { id: 'sidebar-delete', command: 'Delete Selected File', bindings: [['Delete'], ['Backspace']], context: 'Focused sidebar file' },
  { id: 'sidebar-restore', command: 'Restore Last Deleted File', bindings: [['Mod+z']], context: 'Focused sidebar file or folder' },
  { id: 'sidebar-menu', command: 'Open File / Folder Actions', bindings: [['Shift+F10'], ['ContextMenu']], context: 'Focused sidebar file or folder' },
  { id: 'sidebar-select', command: 'Move Sidebar Selection', bindings: [['ArrowUp'], ['ArrowDown'], ['Home'], ['End']], context: 'Focused sidebar file or folder' },
  { id: 'sidebar-disclosure', command: 'Expand / Collapse Folder', bindings: [['ArrowRight'], ['ArrowLeft']], context: 'Focused sidebar file or folder' },
  { id: 'bold', command: 'Toggle Bold', bindings: [['Mod+b']], context: 'Markdown editor' },
  { id: 'italic', command: 'Toggle Italic', bindings: [['Mod+i']], context: 'Markdown editor' },
  { id: 'code', command: 'Toggle Inline Code', bindings: [['Mod+`']], context: 'Markdown editor' },
  { id: 'undo', command: 'Undo', bindings: [['Mod+z']], context: 'Markdown editor' },
  { id: 'redo', command: 'Redo', bindings: [['Mod+Shift+z'], ['Mod+y']], context: 'Markdown editor' },
  { id: 'indent', command: 'Indent List or Code / Next Table Cell', bindings: [['Tab']], context: 'List, code block or table' },
  { id: 'outdent', command: 'Outdent List or Code / Previous Table Cell', bindings: [['Shift+Tab']], context: 'List, code block or table' },
  { id: 'exit-code', command: 'Exit Code Block', bindings: [['Mod+Enter']], context: 'Code block' },
  { id: 'commit-property', command: 'Apply Property Edit', bindings: [['Enter'], ['Tab']], context: 'Property editor' },
  { id: 'cancel', command: 'Cancel Property Edit / Close Menu', bindings: [['Escape']], context: 'Property editor or menu' }
]);
export const bindingsFor = (shortcut, mac) => [...shortcut.bindings, ...(mac ? [] : shortcut.windows || [])];
export const keyLabel = (binding, mac) => binding.map(key => key.replace('Mod', mac ? 'Cmd' : 'Ctrl').replace('ArrowLeft', 'Left').replace('ArrowRight', 'Right').replace('ArrowUp', 'Up').replace('ArrowDown', 'Down').split('+').join(' + ')).join(', ');
export function matchesKey(event, binding, mac) {
  const pieces = binding.split('+'), key = pieces.pop();
  const primary = pieces.includes('Mod');
  const expectedMeta = primary && mac, expectedCtrl = primary && !mac;
  const physical = { '[': 'BracketLeft', ']': 'BracketRight', ',': 'Comma', '`': 'Backquote' }[key];
  return !!event.metaKey === expectedMeta && !!event.ctrlKey === expectedCtrl && !!event.shiftKey === pieces.includes('Shift') && !!event.altKey === pieces.includes('Alt')
    && (event.key.toLowerCase() === key.toLowerCase() || physical && event.code === physical);
}
export class ShortcutController {
  constructor(handlers, { mac = isMac(), available = () => true, chordTimeout = 3000 } = {}) {
    this.handlers = handlers; this.mac = mac; this.available = available; this.chordTimeout = chordTimeout; this.pending = null;
  }
  clear() { clearTimeout(this.timer); this.pending = null; }
  handle(event) {
    if (['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)) return false;
    if (event.isComposing || !this.available()) { this.clear(); return false; }
    const candidates = shortcuts.filter(shortcut => shortcut.app).flatMap(shortcut => bindingsFor(shortcut, this.mac).map(binding => ({ id: shortcut.id, binding })));
    let command;
    if (this.pending) {
      const pending = this.pending; this.clear();
      command = candidates.find(candidate => candidate.binding.length === 2 && candidate.binding[0] === pending && matchesKey(event, candidate.binding[1], this.mac));
      if (!command && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return true; }
    }
    if (!command) command = candidates.find(candidate => candidate.binding.length === 1 && matchesKey(event, candidate.binding[0], this.mac));
    const prefix = !command && candidates.find(candidate => candidate.binding.length > 1 && matchesKey(event, candidate.binding[0], this.mac));
    if (!command && !prefix) return false;
    event.preventDefault(); event.stopPropagation();
    if (prefix) { this.pending = prefix.binding[0]; this.timer = setTimeout(() => this.clear(), this.chordTimeout); }
    else this.handlers[command.id]?.();
    return true;
  }
}
