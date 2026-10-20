# Themes

Open **Settings → Appearance**. Choose a color theme and a mode: Light, Dark, or Follow system. The sun/moon button changes mode without changing your chosen theme. Selection applies across the entire app and across workspaces.

Bento includes its original palette and adaptations of GitHub, One Dark, Darcula, Tokyo Night, and Catppuccin. Each has a light and dark palette. Catppuccin pairs Latte and Mocha; One Dark and Darcula include light companions. These are Bento palettes, not extensions from those projects or marketplace packages. Code blocks currently use the app's text colors, without syntax token highlighting.

## Install and customize

1. Use **Export template** to download the selected palette as a `.bento-theme.json` file with a new custom ID.
2. Change the name, colors, and optionally the ID in a text editor.
3. Choose **Install theme…** and select the file. Bento validates it, saves it, and selects it.

Try [Sakura](../examples/themes/sakura.bento-theme.json) as a working example. Custom themes are portable JSON files; VS Code `.vsix` packages and arbitrary CSS themes are not supported. Installing another file with the same custom ID updates that theme. Built-in IDs are reserved. **Remove theme** removes the selected custom theme and selects Bento.

Desktop installations and the selected ID are stored in your personal `settings.md`, under `themes` and `color_theme`. The original imported file stays untouched; modifying it later requires importing it again. These preferences are separate from workspace documents. The browser sample stores its own theme preferences locally in that browser.

An unavailable selected ID falls back to Bento and displays a message in Appearance. Invalid imports leave the current selection and stored themes unchanged. Existing malformed or externally changed personal settings retain the same repair/conflict protections as profile settings.

## File format

Version 1 requires `version: 1`, an `id`, a `name`, and both `light` and `dark` objects. Optional `author` and `description` strings are supported. IDs use lowercase letters, digits, and hyphens, up to 64 characters; names may contain up to 80 characters.

Each palette requires exactly these hexadecimal `#RRGGBB` colors:

| Token | Role |
| --- | --- |
| `paper` | Document and primary surfaces |
| `side` | Sidebar, chips and secondary surfaces |
| `ink` | Primary text |
| `soft` | Secondary text and labels |
| `line` | Borders and dividers |
| `accent` | Links, focus indicators, primary buttons and checkboxes |
| `wash` | Selection and hover surfaces |
| `warn` | Errors and overdue work |

Files must be at most 32 KB. Up to 32 custom themes can be installed. Themes contain colors and descriptive text only; no scripts, CSS rules, fonts, or remote assets. Built-in palettes are tested for 4.5:1 primary and secondary text contrast against their page and sidebar surfaces. Custom-theme authors should check their own combinations.

## Palette references

The eight-token mappings and some companion/contrast colors are Bento adaptations. References:

- [GitHub theme](https://github.com/primer/github-vscode-theme)
- [Atom One Dark](https://github.com/atom/one-dark-syntax)
- [JetBrains Darcula](https://github.com/JetBrains/intellij-community/blob/master/platform/platform-resources/src/themes/darcula.theme.json)
- [Tokyo Night](https://github.com/folke/tokyonight.nvim)
- [Catppuccin palette](https://github.com/catppuccin/palette)

## Project, document and tag colors

Bento uses eight stable color names: **red, orange, yellow, green, teal, blue, purple, pink**. Open a document's **Color** property to choose one; **Automatic** restores a stable default. The assignment appears in navigation, project cards and relation chips. Tags have their own workspace-wide color: open Tags, select the small dot beside a tag, and choose a color. The same tag has the same color everywhere in that workspace. Labels remain visible alongside color.

Themes translate these names into coordinated light/dark palettes. Chip backgrounds are tinted surfaces, with foreground colors adjusted to keep at least 4.5:1 text contrast against the chip background. Switching themes or mode changes the palette without modifying assignments.

A version 1 theme may optionally add an `accents` object inside each palette, with all eight names mapped to `#RRGGBB` values. Exporting a built-in template includes those values. Older/custom files without accents still work: Bento derives eight harmonious hues using that palette's accent saturation and background. All custom accents are subject to the same chip contrast adjustment, so the visible text color can be darker or lighter than the supplied hex value.
