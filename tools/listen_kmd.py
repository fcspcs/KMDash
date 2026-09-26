"""Listen to the KMD's WebSocket and log every message.

The only thing sent is {"type": "send_settings"}, the read-only request the KMD's own page sends
when its settings dialog opens. No settings, calibration or reset commands.

Usage: python tools/listen_kmd.py [seconds]
Messages are appended to recordings/ws-log-<date>.jsonl (ignored by git).
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from websockets.exceptions import ConnectionClosed
from websockets.sync.client import connect

URL = os.environ.get("KMD_WS_URL", "ws://192.168.1.67:81/")
LOG = Path(__file__).resolve().parent.parent / "recordings" / f"ws-log-{datetime.now():%Y-%m-%d}.jsonl"
READ_ONLY_REQUEST = {"type": "send_settings"}


def current_ssid():
    """Name of the WiFi this computer is on (Windows, macOS, Linux), or None if unknown."""
    commands = [
        (["netsh", "wlan", "show", "interfaces"], r"^\s*SSID\s*:\s*(.+)$"),
        (["/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport", "-I"], r"^\s*SSID\s*:\s*(.+)$"),
        (["iwgetid", "-r"], r"^(\S.*)$"),
    ]
    for command, pattern in commands:
        try:
            out = subprocess.run(command, capture_output=True, text=True, timeout=5).stdout
        except (OSError, subprocess.SubprocessError):
            continue
        match = re.search(pattern, out, re.MULTILINE)
        if match:
            return match.group(1).strip()
    return None


def summarize(raw):
    try:
        msg = json.loads(raw)
    except (TypeError, ValueError):
        print(f"  (not JSON) {str(raw)[:120]}")
        return
    if msg.get("type") == "key_data":
        print(
            f"  key_data: {len(msg.get('xvalue', []))} points | "
            f"D {msg.get('average_downweight')} U {msg.get('average_upweight')} "
            f"B {msg.get('average_balanceweight')} F {msg.get('friction')} dip {msg.get('keydip')}"
        )
    else:
        print(f"  {msg.get('type')}: {json.dumps(msg)[:200]}")


def main():
    duration = float(sys.argv[1]) if len(sys.argv) > 1 else 180
    # Other devices on a home network may use 192.168.1.67 too, so check the WiFi first
    ssid = current_ssid()
    if "KMD_WS_URL" not in os.environ and ssid is not None and not ssid.startswith("KMD-"):
        print(f"Connected to '{ssid}', not to the KMD's WiFi (KMD-...). Stopping.")
        sys.exit(1)

    LOG.parent.mkdir(exist_ok=True)
    count = 0
    with connect(URL, open_timeout=10) as ws, LOG.open("a", encoding="utf-8") as log:
        print(f"Connected to {URL}, listening for {duration:.0f} s")
        ws.send(json.dumps(READ_ONLY_REQUEST))
        end = time.monotonic() + duration
        while (remaining := end - time.monotonic()) > 0:
            try:
                raw = ws.recv(timeout=remaining)
            except TimeoutError:
                break
            except ConnectionClosed as exc:
                print(f"Connection closed by the KMD: {exc}")
                break
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8", errors="replace")
            count += 1
            log.write(json.dumps({"t": datetime.now().isoformat(timespec="milliseconds"), "raw": raw}) + "\n")
            log.flush()
            print(f"[{datetime.now():%H:%M:%S}] message {count}")
            summarize(raw)

    print(f"\n{count} messages written to {LOG}")


if __name__ == "__main__":
    main()
