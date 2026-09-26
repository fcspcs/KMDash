# KMD WebSocket interface

What KMDash knows about the KMD's web interface. Everything here was learned by using the device's own page and listening to the WebSocket, nothing was changed on the device to find it out.

## Network

| | |
|---|---|
| WiFi | The KMD opens its own network, `KMD-<serial number>`, 2.4 GHz |
| Address | `192.168.1.67` |
| HTTP | Port 80, serves the KMD's own page |
| WebSocket | `ws://192.168.1.67:81/`, text frames with JSON |
| USB-C | Charging only, no data |

`192.168.1.67` can be a different device on a home network, so the tools in `tools/` check the WiFi name first.

## Messages from the KMD

**`key_data`** is sent after every successful measurement. Nothing is sent when the KMD shows an error. The message does not say which key was measured, the client keeps track of that.

```json
{
  "type": "key_data",
  "xvalue": [0, 0.175, ..., 8.77, 8.59, ..., 0],
  "yvalue": [0, 18.3, ..., 260.3, 219.9, ..., 0],
  "keydip": 8.792405128,
  "average_downweight": 68.95292664,
  "average_upweight": 28.95708275,
  "average_balanceweight": 48.95500565,
  "friction": 19.99792099,
  "touchweight_window_low": 2,
  "touchweight_window_high": 4
}
```

- `xvalue` is travel in mm, `yvalue` is force in g, 100 points each. Points 0 to 50 are the downstroke to key bottom, the rest is the upstroke back to 0.
- Down and up weight are averaged over the window `touchweight_window_low` to `touchweight_window_high` (mm).
- `balance = (down + up) / 2`, `friction = (down - up) / 2`.

**`settings_data`** is the answer to `send_settings`.

```json
{"type": "settings_data", "calibration_weight": 211.69,
 "touchweight_window_low": 2, "touchweight_window_high": 4, "stop_weight_val": 250}
```

## Messages to the KMD

| type | What it does | When KMDash sends it |
|---|---|---|
| `send_settings` | KMD answers with `settings_data`, read only | When the device settings open |
| `set_calibration_weight` (`cal_weight_val`) | Sets the calibration weight | After review, only if changed |
| `set_tw_window` (`tw_window_low`, `tw_window_high`) | Sets the measuring window | After review, only if changed |
| `set_stop_weight` (`stop_weight_val`) | Sets the stop weight | After review, only if changed |
| `start_calibration` | Starts sensor calibration | After two confirmations |
| `restore_defaults` | Factory settings, calibration needed afterwards | After two confirmations |

Values are sent as strings, the same way the KMD's own page sends them. On its own KMDash only sends `send_settings`. Settings are only sent after they were freshly read from the KMD, and only the values that changed. The allowed commands are listed in `web/src/app/sources/live.js`.

The calibration against test weights happens in the app and sends nothing.

## Files

The KMD's own page keeps all readings in the browser tab. KMDash opens and saves the same formats.

**Project file (JSON).** Arrays are indexed by key number, index 0 is empty.

```json
{
  "pianoname": "unnamed project", "startingnoteindex": 0, "numkeys": 88,
  "keydip_data": [], "downweight_data": [], "upweight_data": [],
  "balanceweight_data": [], "friction_data": [], "keynumber_data": [],
  "xyvalues_data": [[{"x": 0, "y": 0}]],
  "twwindow_data": [[{"x": 2, "y": 350}, {"x": 4, "y": 350}]]
}
```

`startingnoteindex` counts from A (`A, A#, B, C, ...`). With 88 keys starting on A, key 1 is A0, key 4 is C1 and key 40 is C4.

**CSV.** Overview `<name>_overview.csv` with `Key, Downweight, Upweight, Friction, Balance Weight, Keydip`. Single key `<name>_key<n>.csv` with `keystroke position (mm), touchweight (g)`.
