# Keyboard shortcuts

Open **Settings → Keyboard shortcuts**, or press **Cmd+K, then Cmd+S** on macOS (**Ctrl+K, then Ctrl+S** on Windows/Linux). Search by command, keybinding, or context. This is a searchable reference to fixed bindings; rebinding is not implemented yet.

| Command | macOS | Windows/Linux |
| --- | --- | --- |
| Quick Open File | Cmd+P | Ctrl+P |
| Show Commands | Cmd+Shift+P | Ctrl+Shift+P |
| Go Back | Cmd+[ | Ctrl+[ or Alt+Left |
| Go Forward | Cmd+] | Ctrl+] or Alt+Right |
| Open Settings | Cmd+, | Ctrl+, |
| Keyboard Shortcuts | Cmd+K, Cmd+S | Ctrl+K, Ctrl+S |
| Save | Cmd+S | Ctrl+S |
| Bold | Cmd+B | Ctrl+B |
| Italic | Cmd+I | Ctrl+I |
| Inline code | Cmd+Backtick | Ctrl+Backtick |
| Undo | Cmd+Z | Ctrl+Z |
| Redo | Cmd+Shift+Z or Cmd+Y | Ctrl+Shift+Z or Ctrl+Y |
| Indent list / next table cell | Tab | Tab |
| Outdent list / previous table cell | Shift+Tab | Shift+Tab |
| Exit code block | Cmd+Enter | Ctrl+Enter |
| Apply property edit | Enter or leave field | Enter or leave field |
| Cancel property edit / close menu | Escape | Escape |

The context column in Settings distinguishes workspace commands from editor, list/table, and property commands. App shortcuts work while typing in the editor and property fields. Save first applies a valid pending property edit. Formatting and undo/redo remain owned by the Markdown editor; form fields retain native text behavior.

Back/forward history tracks page locations and document caret/scroll positions separately from content. It never rolls back document edits. Reopening an already active page does not add a history entry. Visiting a different page after going back discards the forward branch. History is bounded to 100 locations and resets on reload, restart, or workspace activation. The last selected page is still restored by the existing desktop session mechanism.

A two-step chord waits up to three seconds for its second key; Escape cancels it. Input-method composition is left alone. The canonical registry is `prototype/shortcuts.js`; the Settings reference and app shortcut dispatcher use it.

Quick open searches workspace files by default. Cmd/Ctrl+Shift+P opens the same picker with `>` prefilled for commands. The leading `>` is the only mode selector: add or remove it to switch. Switching shortcuts while open preserves the search text and changes the prefix; repeating the shortcut for the current mode closes the picker. Use ↑/↓ to select and Enter to open/run. Escape closes it and restores the editor caret. Search matches page titles, paths, database names and tags; document bodies are not searched. Cmd/Ctrl+P is reserved for this picker rather than printing.
