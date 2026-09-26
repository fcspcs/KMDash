# Project rules

## Device safety (most important)
- Be very careful with the KMD hardware. Never send anything to the device outside the app's
  explicit, user-confirmed actions.
- Allowed WebSocket commands are exactly those of the original GUI (see `docs/PROTOCOL.md`), sent in the
  same format (values as strings). The whitelist lives in `web/src/app/sources/live.js`.
- Settings changes only after the device settings were loaded (`send_settings`), only changed values,
  always with a confirmation step. Calibration and restore defaults need an explicit two-step confirm.
- Tools in `tools/` are read-only: they only listen and send `send_settings`.
- Charging: only the supplied 5V charger (manual: higher voltage chargers damage the KMD, not covered by warranty).

## Copy and UI
- UI language: English and German (`lib/i18n.js`). Texts short and human.
- Hints and the report describe what was measured. No work steps on the action (no leading, regulating or repair advice, no lists of causes).
- No em or en dashes in UI copy, no filler, nothing that reads machine generated.
- Style "ivory and ink": paper white and black, hairlines instead of boxes and shadows, 2px corners.
  One typeface, Geist, modern and legible: large figures and headings in medium weight, never thin,
  labels in small capitals at 11px or more (never units: "g" must not become "G"). One accent, the red of the key felt, marks where you are
  (selected key, open tab, progress); buttons and links are ink. Tokens live in `App.svelte`.
- Fonts are bundled in `web/src/app/fonts` (OFL, licenses next to them), no font requests at runtime.
- Large tap targets (44px+), bottom tab bar on phones, sidebar on desktop, sheets and dialogs.
- Charts follow the dataviz rules: one scale per chart (never grams and mm together), validated
  series colors (Down blue, Balance aqua, Up orange; Friction violet, Dip green, each own chart),
  legend for 2+ series, text in ink colors never series colors.

## Code
- `web/src/app` is shared by the userscript build (runs on the KMD page) and the Astro demo page.
  No external requests at runtime: the phone is offline on the KMD WiFi.
- Svelte 5 runes. Styles scoped in components, shared utility classes in `App.svelte` (`.btn`, `.list`, `.row`, `.field`, `.input`).
- Analysis logic in `web/src/app/lib/analysis.js` is tested with synthetic curves shaped like real ones
  (`src/app/sources/synthetic.js`, `npm test` in `web/`). Never commit recordings from a real device.
- Targets are always test weight values. The calibration against test weights (`lib/calibration.js`) converts
  readings in the app, it never sends anything to the device. Files keep the raw KMD values.
- Check UI changes with screenshots at iPhone size and at desktop size (1280 px, from 960 px the app
  uses the sidebar layout), light, dark and German, before calling them done.
  End to end without the device: `python tools/simulate_kmd.py --app` after `npm run build:userscript`.
- Never add the manufacturer's files (the device page, its scripts, images or the manual) or personal
  device data (serial numbers, network names, addresses) to the repository. Only own code, sample data from `synthetic.js`.
