#!/usr/bin/env python3
"""Convenience launcher for the DocFlow Flask backend."""
from __future__ import annotations

import argparse
import json
import http.client
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
if str(ROOT) not in sys.path:
    sys.path.insert
    
    (0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from backend.docflow_app import (  # type: ignore  # noqa: E402
        run_app,
        APP_VERSION,
        write_scan_pause,
        load_scan_pause,
        SCAN_PAUSE_FILE,
    )
except ModuleNotFoundError as exc:  # pragma: no cover - runtime guard
    missing = exc.name or ""
    print("❌ Vereiste Python-dependency ontbreekt.")
    if missing:
        print(f"   Module '{missing}' kon niet worden geladen.")
    print("   Installeer de backend dependencies met:")
    print("     pip install -r backend/requirements.txt")
    sys.exit(1)

# Pas dit pad aan als Node.js op een andere plek staat (alleen relevant voor Windows)
WINDOWS_NODE_DIR = Path(
    os.environ.get(
        "DOCFLOW_NODE_DIR",
        r"C:\\Users\\Willy.Spencer\\Downloads\\node-v24.11.1-win-x64\\node-v24.11.1-win-x64",
    )
)


def discover_ips() -> list[str]:
    """Return a sorted list of LAN IP addresses that other users can use."""
    ips: set[str] = set()
    hostname = socket.gethostname()

    try:
        for info in socket.getaddrinfo(hostname, None):
            candidate = info[4][0]
            if candidate.startswith("127."):
                continue
            if ":" in candidate:  # Skip IPv6 for clarity in console output
                continue
            ips.add(candidate)
    except socket.gaierror:
        pass

    # Fallback: ask the OS what IP would be used to reach the internet
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            candidate = s.getsockname()[0]
            if not candidate.startswith("127."):
                ips.add(candidate)
    except OSError:
        pass

    return sorted(ips)


def resolve_npm_command() -> str | None:
    """Return an npm executable to use (Windows-aware)."""

    if os.name == "nt":
        npm_candidate = WINDOWS_NODE_DIR / "npm.cmd"
        if npm_candidate.exists():
            return str(npm_candidate)
    return shutil.which("npm")


def desired_recharts_version() -> str | None:
    """Return the Recharts version requested in package.json, if any."""

    pkg_path = ROOT / "package.json"
    if not pkg_path.exists():
        return None

    try:
        pkg = json.loads(pkg_path.read_text())
    except (OSError, json.JSONDecodeError):
        return None

    version = pkg.get("dependencies", {}).get("recharts")
    return version.strip() if isinstance(version, str) and version.strip() else None


def installed_recharts_version() -> str | None:
    """Return the installed Recharts version from node_modules, if present."""

    pkg_path = ROOT / "node_modules" / "recharts" / "package.json"
    if not pkg_path.exists():
        return None

    try:
        pkg = json.loads(pkg_path.read_text())
    except (OSError, json.JSONDecodeError):
        return None

    version = pkg.get("version")
    return version.strip() if isinstance(version, str) and version.strip() else None


def ensure_node_modules() -> None:
    """Install frontend dependencies when `node_modules` is missing or incomplete."""

    node_modules = ROOT / "node_modules"
    vite_binary = node_modules / ".bin" / "vite"
    desired_recharts = desired_recharts_version()
    installed_recharts = installed_recharts_version()
    has_node_modules = node_modules.exists()
    has_vite = vite_binary.exists()
    recharts_needs_sync = (
        desired_recharts
        and has_node_modules
        and (not installed_recharts or desired_recharts != installed_recharts)
    )

    # If the folder exists but the Vite binary is missing, the installation is incomplete.
    if has_node_modules and has_vite and not recharts_needs_sync:
        return

    if recharts_needs_sync:
        mismatch_note = installed_recharts or "onbekend"
        print(
            "⚠️  node_modules gevonden, maar Recharts versie"
            f" {mismatch_note} wijkt af van package.json ({desired_recharts})."
            " Voer 'npm install' opnieuw uit…"
        )
    elif has_node_modules:
        print("⚠️  node_modules gevonden, maar Vite ontbreekt. Voer 'npm install' opnieuw uit…")
    else:
        print("🔧 node_modules niet gevonden. Voer 'npm install' automatisch uit…")

    if not (ROOT / "package.json").exists():
        print("❌ package.json ontbreekt – kan npm install niet uitvoeren.")
        sys.exit(1)

    npm_cmd = resolve_npm_command()
    if not npm_cmd:
        print("❌ npm niet gevonden. Installeer Node.js of voeg npm toe aan je PATH.")
        sys.exit(1)

    try:
        subprocess.run([npm_cmd, "install"], cwd=ROOT, check=True)
    except subprocess.CalledProcessError as exc:
        print(f"❌ npm install is mislukt (exit code {exc.returncode}).")
        sys.exit(exc.returncode)
    else:
        print("✅ npm install voltooid.")


def build_contains_localhost_api(build_dir: Path) -> bool:
    """Heuristic: detect old builds that still point to localhost for the API."""

    needles = {"http://localhost", "https://localhost", "127.0.0.1"}

    for ext in ("*.js", "*.html", "*.txt"):
        for path in build_dir.rglob(ext):
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue

            if any(n in text for n in needles):
                return True

    return False


def ensure_frontend_build() -> None:
    """Run `npm run build` when missing or when localhost URLs are baked in."""

    build_dir = ROOT / "build"
    index_html = build_dir / "index.html"

    if index_html.exists() and not build_contains_localhost_api(build_dir):
        return

    if not (ROOT / "package.json").exists():
        print("❌ package.json ontbreekt – kan npm run build niet uitvoeren.")
        sys.exit(1)

    npm_cmd = resolve_npm_command()
    if not npm_cmd:
        print("❌ npm niet gevonden. Installeer Node.js of voeg npm toe aan je PATH.")
        sys.exit(1)

    if index_html.exists():
        print("⚠️  Bestaande frontend-build verwijst nog naar localhost. Voer 'npm run build' opnieuw uit…")
    else:
        print("🎨 Frontend build ontbreekt. Voer 'npm run build' automatisch uit…")

    try:
        subprocess.run([npm_cmd, "run", "build"], cwd=ROOT, check=True)
    except subprocess.CalledProcessError as exc:
        print(f"❌ npm run build is mislukt (exit code {exc.returncode}).")
        sys.exit(exc.returncode)
    else:
        print("✅ Frontend build voltooid.")


def ensure_windows_node_paths() -> None:
    """Extend PATH with a bundled Node.js location on Windows if needed."""

    if os.name != "nt":
        return

    node_path = WINDOWS_NODE_DIR / "node.exe"
    npm_path = WINDOWS_NODE_DIR / "npm.cmd"

    if not node_path.exists() or not npm_path.exists():
        print("❌ node.exe of npm.cmd niet gevonden.")
        print(f"  Controleer het pad: {WINDOWS_NODE_DIR}")
        print("  Pas DOCFLOW_NODE_DIR aan (omgeving) of het constante pad bovenaan dit script.")
        sys.exit(1)

    os.environ["PATH"] = str(WINDOWS_NODE_DIR) + os.pathsep + os.environ.get("PATH", "")


def is_backend_healthy(host: str, port: int, timeout: int = 3) -> bool:
    """Check whether the backend responds on /api/health."""

    target_host = "127.0.0.1" if host in {"0.0.0.0", "*", ""} else host
    try:
        conn = http.client.HTTPConnection(target_host, port, timeout=timeout)
        conn.request("GET", "/api/health")
        resp = conn.getresponse()
        resp.read()  # Drain to free the connection
        return resp.status == 200
    except OSError:
        return False


def wait_for_backend(host: str, port: int, startup_timeout: int = 30) -> bool:
    """Poll /api/health until the backend is up or timeout expires."""

    deadline = time.time() + startup_timeout
    while time.time() < deadline:
        if is_backend_healthy(host, port):
            return True
        time.sleep(1)
    return False


def run_with_watchdog(args: argparse.Namespace) -> None:
    """Keep the backend alive for LAN users by auto-restarting on failure."""

    ensure_windows_node_paths()
    ensure_node_modules()
    ensure_frontend_build()

    script_path = Path(__file__).resolve()
    cmd = [sys.executable, str(script_path), "--host", args.host, "--port", str(args.port), "--child-server"]
    if args.debug:
        cmd.append("--debug")

    print("👀 Watchdog actief: backend wordt herstart als het proces stopt of niet bereikbaar is.")
    print("Laat dit venster open staan zodat collega's de webpagina blijven zien.")

    proc: subprocess.Popen | None = None
    try:
        while True:
            proc = subprocess.Popen(cmd)
            ready = wait_for_backend(args.host, args.port)
            if not ready:
                print("⚠️  Backend reageert niet binnen 30s – probeer opnieuw te starten…")
                proc.terminate()
                proc.wait()
                time.sleep(3)
                continue

            exit_code = proc.wait()
            print(f"⚠️  Backend gestopt (exit {exit_code}). Herstart over 3s…")
            time.sleep(3)
    except KeyboardInterrupt:
        print("🛑 Watchdog gestopt door gebruiker.")
    finally:
        if proc:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except Exception:
                pass

    try:
        node_ver = subprocess.run([str(node_path), "-v"], capture_output=True, text=True, check=True)
        print("✔ Node versie:", node_ver.stdout.strip())
    except (OSError, subprocess.CalledProcessError):
        print("❌ Node werkt niet")

    try:
        npm_ver = subprocess.run([str(npm_path), "-v"], capture_output=True, text=True, check=True)
        print("✔ npm versie:", npm_ver.stdout.strip())
    except (OSError, subprocess.CalledProcessError):
        print("❌ npm werkt niet")

    print("✅ Node-omgeving ingesteld.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Start de DocFlow backend met netwerk info")
    parser.add_argument("--host", default=os.environ.get("DOCFLOW_HOST", "0.0.0.0"), help="Host/IP om op te luisteren")
    parser.add_argument("--port", type=int, default=int(os.environ.get("DOCFLOW_PORT", "5000")), help="Poortnummer")
    parser.add_argument("--debug", action="store_true", help="Activeer Flask debug mode")
    parser.add_argument(
        "--pause-scan",
        nargs="?",
        const="120",
        metavar="MINUTEN",
        help="Pauzeer de scanner (standaard 120 minuten). Gebruik 0 voor onbeperkt."
    )
    parser.add_argument(
        "--pause-reason",
        default="handmatig gepauzeerd via start_docflow",
        help="Reden die in scan_paused.flag wordt opgeslagen wanneer --pause-scan wordt gebruikt."
    )
    parser.add_argument(
        "--resume-scan",
        action="store_true",
        help="Hervat de scanner door scan_paused.flag te verwijderen en sluit daarna af."
    )
    parser.add_argument(
        "--scan-status",
        action="store_true",
        help="Toon of de scanner gepauzeerd is en sluit daarna af zonder de server te starten."
    )
    parser.add_argument(
        "--watchdog",
        action="store_true",
        help=(
            "Houd de backend draaiend voor collega's door te controleren op /api/health en automatisch te herstarten. "
            "Laat het venster open staan op de pc die de backend host."
        ),
    )
    parser.add_argument(
        "--child-server",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    args = parser.parse_args()

    # Quick maintenance controls: pause/resume/status without starting the server
    if args.resume_scan or args.pause_scan is not None or args.scan_status:
        if args.scan_status:
            info = load_scan_pause()
            if info:
                until = info.get("until")
                reason = info.get("reason", "pausing")
                horizon = "onbeperkt" if not until else until
                print(f"ℹ️  Scanner staat gepauzeerd tot {horizon} (reden: {reason}).")
            else:
                print("ℹ️  Scanner is actief (geen scan_paused.flag gevonden).")

        if args.resume_scan:
            if Path(SCAN_PAUSE_FILE).exists():
                try:
                    Path(SCAN_PAUSE_FILE).unlink()
                    print("✅ scan_paused.flag verwijderd – scanner hervat.")
                except OSError as exc:
                    print(f"❌ Kon scan_paused.flag niet verwijderen: {exc}")
            else:
                print("ℹ️  Geen scan_paused.flag gevonden – scanner was al actief.")

        if args.pause_scan is not None:
            try:
                minutes = max(0, int(args.pause_scan))
            except ValueError:
                print("❌ Ongeldige waarde voor --pause-scan; gebruik een getal (bijv. 120 of 0).")
                sys.exit(1)

            info = write_scan_pause(minutes, args.pause_reason)
            until = info.get("until") or "onbeperkt"
            print(f"✅ Scanner gepauzeerd tot {until} (reden: {info.get('reason')}).")

        # Skip server startup when only doing maintenance actions
        return

    if args.child_server:
        ensure_windows_node_paths()
        ensure_node_modules()
        ensure_frontend_build()
        run_app(host=args.host, port=args.port, debug=args.debug)
        return

    if args.watchdog:
        run_with_watchdog(args)
        return

    ensure_windows_node_paths()
    ensure_node_modules()
    ensure_frontend_build()

    lan_ips = discover_ips()
    local_url = f"http://127.0.0.1:{args.port}"

    print("=" * 72)
    print(" DocFlow backend starter")
    print("=" * 72)
    print(f"Versie       : {APP_VERSION}")
    print(f"Lokale URL   : {local_url}")
    if lan_ips:
        print("Netwerk URL(s):")
        for ip in lan_ips:
            print(f"  → http://{ip}:{args.port}")
    else:
        print("Netwerk URL(s): geen gevonden - controleer je netwerkadapter")
    print("-" * 72)
    frontend_dir = ROOT / "build"
    if not frontend_dir.exists():
        print("⚠️  Opmerking: de nieuwe React-interface is nog niet gebouwd.")
        print("   Run 'npm install' en 'npm run build' zodat start_docflow de Figma UI kan serveren.")
        print("   (Zonder build krijg je een 503-melding bij het openen van de pagina.)")
        print("-" * 72)
    print("Gebruik deze LAN URL om DocFlow te delen met collega's op hetzelfde netwerk.")
    print("Druk op CTRL+C om te stoppen.\n")

    # Run the Flask app
    run_app(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
