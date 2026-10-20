# Bento app assets

A friendly green bento box with rice, a red plum, a golden side dish, and greens. The brand colors stay fixed across themes; the transparent surroundings work on both light and dark surfaces.

- `bento-source.png`: original transparent raster master, generated with the built-in image generator. Keep this as the source; do not upscale the small exports.
- `bento.icns`: macOS icon with 16–1024 pixel representations.
- `bento.ico`: Windows icon containing 16, 24, 32, 48, 64, 128 and 256 pixel PNG representations.
- `bento.png`: 512 pixel general-purpose export.
- `../prototype/assets/bento-32.png`: browser favicon.
- `../prototype/assets/bento-64.png`: 28 CSS pixel header mark with room for high-density screens.
- `../prototype/assets/bento-256.png`: desktop runtime window icon, also used for the development Dock icon on macOS.
- `icon-prompt.txt`: exact generation prompt. This is raster artwork; there is no vector master.

Run `pnpm assets:icons` on macOS to regenerate exports from the master using built-in `sips` and `iconutil`. The ICO container is written with Node's standard library. Generated exports are checked in, so normal app packaging on Windows and macOS needs no image-generation service or icon conversion tools.

The packager embeds the native platform icon. Runtime images and the favicon are bundled locally; no remote assets are loaded. The full-color icon is decorative next to the visible Bento name, so it does not add a duplicate screen-reader label.
