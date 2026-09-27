# KMDash

A phone and laptop interface for the Renner Key Measuring Device (KMD).

The KMD's built-in web page is hard to use at the piano. KMDash replaces it with something you can use with one hand: large readings, a keyboard strip, guided measuring, before and after comparisons, your own targets and hints about what the force curve shows. On a laptop it spreads out over the wider screen.

This is an unofficial project. It is not made by, endorsed by or affiliated with Renner or the makers of the KMD.

## How it works

The KMD opens its own WiFi and serves a small page at `http://192.168.1.67`. Readings come in over a WebSocket on port 81, without encryption. On that WiFi there is no internet, and browsers normally don't let a secure website talk to such a device. KMDash gets there in two ways:

- **Computer:** Chrome and Edge from version 147 let a secure site reach a device on the local network once you allow it. KMDash runs straight from the website at `/app/`, installs as an app and opens offline (service worker in `web/src/sw`).
- **Phone and tablet:** Safari and Firefox have no such permission, so KMDash is a userscript there: the browser runs it on the KMD's own page, where it stops that page before it connects and shows the app instead.

Nothing is installed on the KMD. See [Device safety](#device-safety) for what the app sends.

## Install

The website has a step by step guide per device (section Install). In short:

- **Computer (Chrome or Edge 147+):** open `/app/` on the website, install it as an app. At the piano join the KMD WiFi, open KMDash and allow access to the local network when the browser asks.
- **iPhone and iPad:** install [Userscripts](https://apps.apple.com/app/userscripts/id1463298887), allow the extension in Settings, Apps, Safari, Extensions, then open `kmdash.user.js` from the website in Safari and install it from the extension menu. At the piano join the KMD WiFi and open `http://192.168.1.67`.
- **Android:** Firefox with Violentmonkey (or Tampermonkey), open `kmdash.user.js` and confirm. Keep the phone on the KMD WiFi without switching to mobile data, then open `http://192.168.1.67`.

To use the KMD's own page from the userscript, add `#original` to the address.

## Features

- Single, continuous and guided measuring: one to three readings per key, key by key or in rounds, in order, white keys first or one colour only
- Several runs per piano, compared in the charts, per key and as a table of changes
- Targets per piano, as ranges or slopes from key to key, starting from a factory profile if you like
- Calibration against test weights: measure a few keys with brass weights and all readings are converted
- Hints on damper and pedal, let-off in the window, friction by section and keys that differ from their neighbours, with thresholds you can set (Piano → Hints)
- Zoom into the force curve and into a part of the keyboard, show or hide series, the measuring window and the previous curve
- Smooth curves through the readings and evenness in numbers: scatter around the curve, share of keys near it and inside the targets, before and after
- PDF report of the runs you choose: findings at the top, charts, evenness, averages by section, hints, a table of all keys, the changes from run to run, averages over time and small force curves, with client, place and measuring conditions
- Opens and saves the JSON and CSV files of the KMD's own page, plus a detailed CSV for your own spreadsheets; several files come in one ZIP
- Phone and laptop layouts, English and German, light and dark

Everything is stored in the browser of each device. Save a file after each job, and use it to move a piano between phone and computer.

## Device safety

KMDash only knows the commands the KMD's own page uses, sent the same way ([docs/PROTOCOL.md](docs/PROTOCOL.md)). On its own it only asks for the current settings. Changing a setting needs freshly loaded values and a review step, and only changed values are sent. Sensor calibration and factory reset need two confirmations. The calibration against test weights happens in the app and never touches the device.

Charge the KMD only with the charger that came with it.

## Development

```bash
cd web
npm install
npm test          # analysis, storage and calibration tests
npm run dev       # website and demo at http://localhost:4321/demo/
npm run build     # userscript and website into web/dist
```

You can try it without a KMD. The simulator serves a stand-in page and plays back synthetic readings:

```bash
pip install websockets
cd web && npm run build:userscript && cd ..
python tools/simulate_kmd.py --app --auto 3
```

Then open `http://<your computer>:8080` on your phone or laptop. `tools/listen_kmd.py` logs what a real KMD sends and only ever sends the read-only settings request.

The app lives in `web/src/app` (Svelte 5), the userscript entry in `web/src/userscript`, the website in `web/src/pages`.

The public website is set up for Vercel. Use `web` as the Root Directory; its `vercel.json` contains the Astro build settings.

## License

MIT, see [LICENSE](LICENSE). Renner and KMD are names of their respective owners and are used here only to say what this software works with.

The font Geist is bundled under the SIL Open Font License, see `web/src/app/fonts`.
