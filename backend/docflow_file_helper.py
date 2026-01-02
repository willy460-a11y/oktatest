#!/usr/bin/env python3
"""DocFlow File Helper — opent bestanden vanaf de webapp rechtstreeks op Windows."""
from __future__ import annotations

import argparse
import atexit
import http.client
import os
import platform
import signal
import subprocess
import sys
import time
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

APP_NAME = "DocFlow File Helper"
HELPER_VERSION = "1.0.0"
DEFAULT_PORT = int(os.environ.get("DOCFLOW_HELPER_PORT", "5678"))
LOCK_FILE = Path.home() / ".docflow_file_helper.lock"
ALLOWED_PREFIXES = [
    r"\\172.27.91.15\common-zoetermeer$\Quality\RvA\RvA Templates",
]

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:*", "*"]}})

state = {
    "started_at": time.time(),
    "open_count": 0,
    "last_path": None,
}


def show_popup(message: str) -> None:
    """Toon een Windows notificatie/pop-up wanneer mogelijk."""
    if platform.system() != "Windows":
        return
    try:
        import ctypes  # type: ignore

        MB_OK = 0x0
        MB_ICONINFORMATION = 0x40
        ctypes.windll.user32.MessageBoxW(0, message, APP_NAME, MB_OK | MB_ICONINFORMATION)
    except Exception:
        pass


def normalize_path(raw: str) -> str:
    path = raw.strip().strip('"')
    if path.startswith("file://"):
        path = path.replace("file://", "")
        path = path.replace("/", os.sep)
    return path


def is_allowed_path(path: str) -> bool:
    normalized = path.lower()
    if not ALLOWED_PREFIXES:
        return True
    return any(normalized.startswith(prefix.lower()) for prefix in ALLOWED_PREFIXES)


def open_document(path: str) -> None:
    if platform.system() == "Windows":
        os.startfile(path)  # type: ignore[attr-defined]
    elif platform.system() == "Darwin":
        subprocess.call(["open", path])
    else:
        subprocess.call(["xdg-open", path])


def cleanup_lock() -> None:
    try:
        if LOCK_FILE.exists():
            LOCK_FILE.unlink()
    except OSError:
        pass


def request_existing_shutdown(port: int) -> None:
    try:
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=0.5)
        conn.request("POST", "/internal/shutdown")
        conn.getresponse()
        conn.close()
        time.sleep(0.5)
    except Exception:
        pass


def ensure_single_instance(port: int) -> None:
    if LOCK_FILE.exists():
        try:
            pid = int(LOCK_FILE.read_text().strip())
        except Exception:
            pid = None
        if pid and pid != os.getpid():
            try:
                os.kill(pid, signal.SIGTERM)
                time.sleep(0.5)
            except OSError:
                pass
    request_existing_shutdown(port)
    LOCK_FILE.write_text(str(os.getpid()))
    atexit.register(cleanup_lock)


@app.get("/health")
def health() -> tuple:
    return (
        jsonify({
            "status": "ok",
            "version": HELPER_VERSION,
            "open_count": state["open_count"],
            "last_path": state["last_path"],
        }),
        200,
    )


@app.post("/open")
def open_endpoint():
    payload = request.get_json(force=True, silent=True) or {}
    path = payload.get("path")
    if not path:
        return jsonify({"ok": False, "error": "path missing"}), 400

    resolved_path = normalize_path(path)
    if not is_allowed_path(resolved_path):
        return jsonify({"ok": False, "error": "path not allowed"}), 403

    try:
        open_document(resolved_path)
        state["open_count"] += 1
        state["last_path"] = resolved_path
        return jsonify({"ok": True}), 200
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/internal/shutdown")
def shutdown() -> tuple:
    func = request.environ.get("werkzeug.server.shutdown")
    if func:
        func()
    cleanup_lock()
    return jsonify({"ok": True}), 200


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start de DocFlow File Helper server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Luisterpoort voor localhost")
    parser.add_argument("--host", default="127.0.0.1", help="Host (laat staan op 127.0.0.1)")
    parser.add_argument("--no-popup", action="store_true", help="Geen Windows popup tonen bij start")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_single_instance(args.port)
    if not args.no_popup:
        show_popup(f"{APP_NAME} draait nu op {args.host}:{args.port}\nJe kunt DocFlow bestanden direct openen.")

    print(f"{APP_NAME} v{HELPER_VERSION} gestart op http://{args.host}:{args.port}")
    print("Druk Ctrl+C om te stoppen. Er wordt gelogd naar het systeemlogboek.")

    app.run(host=args.host, port=args.port, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
