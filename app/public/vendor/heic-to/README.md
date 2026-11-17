# heic-to 1.6.7 (vendored, unmodified)

WB1, THE TEAM WHITEBOARD: the board's import pane loads this only when a HEIC picture will not open in the
browser by itself (Chrome and Edge on a PC). It turns the HEIC into a JPEG inside the page; nothing leaves the
computer until the shrunk JPEG goes to the board's reader.

- Source: https://github.com/hoppergee/heic-to, npm heic-to@1.6.7, file dist/iife/heic-to.js (global HeicTo).
- libheif 1.23.7 inside. License: LGPL-3.0 (LICENSE beside this file). The file is served as its own script,
  unmodified, so it can be replaced with any compatible build.
- Served at /admin/whiteboard/heic-to-1.6.7.js behind the Admin PIN. To update: replace heic-to.js and change
  WB_HEIC_PATH in src/whiteboard.ts to the new version number.
