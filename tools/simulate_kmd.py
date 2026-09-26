"""Pretend to be a KMD on your own network: serve a stand-in page and play back synthetic readings.

Useful for trying the app on a phone without the device. Open http://<computer-ip>:8080 on the phone.

Usage: python tools/simulate_kmd.py [--auto SECONDS] [--app]
  without --auto: press Enter to send the next reading
  --app: add the built userscript (web/public/kmdash.user.js) to the page, so KMDash runs
         without a userscript manager. Build it first: cd web && npm run build:userscript

Port 81 may need admin rights on macOS and Linux.
"""
import argparse
import json
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from websockets.exceptions import ConnectionClosed
from websockets.sync.server import serve

ROOT = Path(__file__).resolve().parent.parent
PAGE = Path(__file__).resolve().parent / "simulator" / "index.html"
SAMPLES = ROOT / "web" / "src" / "app" / "sources" / "samples.json"
USERSCRIPT = ROOT / "web" / "public" / "kmdash.user.js"


class PageHandler(BaseHTTPRequestHandler):
    inject_app = False

    def do_GET(self):
        path = self.path.split("?")[0].split("#")[0]
        if path in ("/", "/index.html"):
            html = PAGE.read_text(encoding="utf-8")
            if self.inject_app:
                html = html.replace("</body>", '<script src="/kmdash.user.js"></script>\n</body>')
            return self._send(html.encode("utf-8"), "text/html; charset=utf-8")
        if path == "/kmdash.user.js" and self.inject_app:
            return self._send(USERSCRIPT.read_bytes(), "application/javascript")
        self.send_error(404)

    def _send(self, body, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class Simulator:
    def __init__(self, settings, readings):
        self.settings, self.readings = settings, readings
        self.clients, self.lock, self.index = set(), threading.Lock(), 0

    def handler(self, ws):
        with self.lock:
            self.clients.add(ws)
        print(f"+ client connected ({len(self.clients)} open)")
        try:
            for raw in ws:
                msg = json.loads(raw)
                if msg.get("type") == "send_settings":
                    ws.send(json.dumps(self.settings))
                    print("  send_settings -> settings_data")
                else:
                    # A real KMD would change its settings here. The simulator only reports it.
                    print(f"  WARNING: write command received: {raw}")
        except ConnectionClosed:
            pass
        finally:
            with self.lock:
                self.clients.discard(ws)
            print(f"- client disconnected ({len(self.clients)} open)")

    def measure(self):
        msg = self.readings[self.index % len(self.readings)]
        self.index += 1
        with self.lock:
            clients = list(self.clients)
        for ws in clients:
            try:
                ws.send(json.dumps(msg))
            except ConnectionClosed:
                pass
        print(f"reading {self.index}: D {msg['average_downweight']:.1f} U {msg['average_upweight']:.1f} -> {len(clients)} client(s)")


def lan_ip():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("192.0.2.1", 80))
        return s.getsockname()[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--auto", type=float, help="send a reading every N seconds")
    parser.add_argument("--http-port", type=int, default=8080)
    parser.add_argument("--ws-port", type=int, default=81)
    parser.add_argument("--app", action="store_true", help="run KMDash on the page")
    args = parser.parse_args()
    if args.app and not USERSCRIPT.exists():
        parser.error("web/public/kmdash.user.js is missing, run: cd web && npm run build:userscript")
    PageHandler.inject_app = args.app

    samples = json.loads(SAMPLES.read_text(encoding="utf-8"))
    sim = Simulator(samples["settings"], samples["keys"])

    http = ThreadingHTTPServer(("0.0.0.0", args.http_port), PageHandler)
    threading.Thread(target=http.serve_forever, daemon=True).start()
    ws_server = serve(sim.handler, "0.0.0.0", args.ws_port)
    threading.Thread(target=ws_server.serve_forever, daemon=True).start()

    print(f"KMD simulator with {len(sim.readings)} synthetic readings" + (" and KMDash" if args.app else ""), flush=True)
    print(f"  Open on the phone: http://{lan_ip()}:{args.http_port}   (WebSocket on port {args.ws_port})")
    try:
        if args.auto:
            print(f"  Sending a reading every {args.auto:g} s. Ctrl+C to stop.")
            while True:
                time.sleep(args.auto)
                sim.measure()
        else:
            print("  Enter sends a reading, Ctrl+C stops.")
            while True:
                input()
                sim.measure()
    except (KeyboardInterrupt, EOFError):
        pass
    finally:
        http.shutdown()
        ws_server.shutdown()


if __name__ == "__main__":
    main()
