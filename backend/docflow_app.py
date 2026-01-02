from __future__ import annotations
 
# =========================
# Standard library imports
# =========================
import os, json, threading, time, socket, shutil, logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
 
# =========================
# Load environment FIRST
# =========================
from dotenv import load_dotenv
load_dotenv()
 
# =========================
# Flask imports
# =========================
from flask import (
    Flask,
    jsonify,
    request,
    send_file,
    make_response,
    abort,
    Response,
    send_from_directory,
    session,
)
 
from functools import lru_cache
import tempfile
 
# =========================
# Flask app initialization
# =========================
app = Flask(__name__)

from flask import redirect

app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY")
 
app.config.update(
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,  # want je gebruikt http
)
 
@app.route("/docflow")
@app.route("/docflow/")
def docflow_alias():
    return redirect("/")
 
 
# 🔑 DIT WAS DE ONTBREKENDE SCHAKEL
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY")
 
app.config.update(
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,  # jij draait op http + IP
)
 
# =========================
# Okta imports (PAS NA app + secret)
# =========================
from auth.okta import okta_bp, user_is_authenticated

# ===================== CONFIG =====================
CONCEPT_DIR  = r"\\172.27.91.15\common-zoetermeer$\Quality\RvA\RvA Templates\Concept"
APPROVED_DIR = r"\\172.27.91.15\common-zoetermeer$\Quality\RvA\RvA Templates\Approved"

SCAN_INTERVAL_SECONDS = 20
STATE_FILE = "state.json"
BACKUP_DIR = "backups"
SCAN_PAUSE_FILE = "scan_paused.flag"
INITIAL_CONCEPT_COUNT = 417
# Baseline date for concept count tracking
# Update this to the project start date so daily averages are accurate
INITIAL_CONCEPT_DATE = "2025-08-21"
# Startdatum voor valideren-tracking (eerste week uitgesloten)
INITIAL_VALIDATE_DATE = "2025-08-28"
IDEAS_FILE = Path(__file__).with_name("ideas.json")

APP_TITLE   = "DocFlow — Project template"
APP_VERSION = "v4.9"
DEFAULT_HOST = os.environ.get("DOCFLOW_HOST", "0.0.0.0")
DEFAULT_PORT = int(os.environ.get("DOCFLOW_PORT", "5000"))
EXE_DOWNLOAD_PATH = r"\\172.27.91.15\common-zoetermeer$\Algemeen\Cheatsheet\DocFlowViewer.exe"
FILE_HELPER_DIR = Path(__file__).with_name("dist")
FILE_HELPER_FILENAME = "DocFlowFileHelper.exe"
# Frontend build output (Vite)
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "build"
FRONTEND_ASSETS_DIR = FRONTEND_DIR / "assets"
FRONTEND_INDEX = FRONTEND_DIR / "index.html"

# Directory containing intro tour images
INTRO_IMAGE_DIR = Path(__file__).with_name("intro_images")

FALLBACK_SVG = b"""<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>\n<rect width='400' height='300' fill='#e5e7eb'/>\n<text x='200' y='150' dominant-baseline='middle' text-anchor='middle' fill='#64748b' font-size='20'>Geen afbeelding</text>\n</svg>"""

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('docflow.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
# ==================================================

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY") or os.environ.get("SESSION_SECRET") or "change-me"
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("FLASK_SESSION_SECURE", "").lower() in {"1", "true", "yes"}
lock = threading.Lock()
ideas_lock = threading.Lock()

app.register_blueprint(okta_bp)


def load_ideas() -> list:
    if not IDEAS_FILE.exists():
        return []
    try:
        with IDEAS_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
    except Exception as e:
        log(f"Failed to load ideas: {e}")
    return []


def save_ideas(ideas: list) -> None:
    IDEAS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with IDEAS_FILE.open("w", encoding="utf-8") as f:
        json.dump(ideas, f, ensure_ascii=False, indent=2)


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"

    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.before_request
def handle_options_request():
    if request.method == "OPTIONS":
        return make_response("", 204)


@app.before_request
def require_okta_session():
    # Allow preflight requests and public endpoints
    if request.method == "OPTIONS":
        return None

    path = (request.path or "/").rstrip("/") or "/"
    public_paths = {
        "/",
        "/api/health",
        "/api/auth/okta/login",
        "/api/auth/okta/callback",
        "/api/auth/okta/logout",
        "/api/auth/okta/user",
    }

    if path in public_paths:
        return None

    if path.startswith("/assets") or path.startswith("/intro-image") or path == "/logo":
        return None

    if path.startswith("/api/") and not user_is_authenticated():
        return jsonify({"ok": False, "error": "Niet ingelogd"}), 401
    return None

# Determine logo image file in the same directory as this script
LOGO_PATH: Optional[Path] = None
for ext in ("png", "jpg", "jpeg", "gif", "svg", "ico"):
    candidate = Path(__file__).with_name(f"trescallogo.{ext}")
    if candidate.exists():
        LOGO_PATH = candidate
        break


def get_file_helper_path() -> Optional[Path]:
    """Return the path to the DocFlow helper executable if it exists."""
    candidate = FILE_HELPER_DIR / FILE_HELPER_FILENAME
    if candidate.exists():
        return candidate
    return None


def get_file_helper_metadata(path: Optional[Path]) -> Dict[str, Any]:
    """Return metadata that can be surfaced to the frontend."""
    if not path:
        return {
            "status": "inactive",
            "available": False,
            "filename": FILE_HELPER_FILENAME,
            "size_bytes": 0,
            "last_modified": None,
            "version": APP_VERSION,
        }

    stat = path.stat()
    return {
        "status": "inactive",
        "available": True,
        "filename": path.name,
        "size_bytes": stat.st_size,
        "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "version": APP_VERSION,
    }

# --------------------- Helpers ---------------------
@lru_cache(maxsize=100)
def file_exists_cached(path: str) -> bool:
    """Cached file existence check"""
    return os.path.exists(path)

def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"

def iso_to_dt(s: str) -> datetime:
    if not s: return datetime.min
    s2 = s[:-1] if s.endswith("Z") else s
    try: return datetime.fromisoformat(s2)
    except Exception: return datetime.min

def load_state() -> Dict:
    if not os.path.exists(STATE_FILE):
        return {"documents": {}}
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading state: {e}")
        return {"documents": {}}

def save_state(state: Dict, force_backup: bool = False) -> None:
    # Create backup before saving (alleen bij belangrijke acties of geforceerd)
    if force_backup:
        create_backup()
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
    os.replace(tmp, STATE_FILE)

def create_backup(backup_type="kort"):
    """Create backup of current state with different retention policies"""
    if not os.path.exists(STATE_FILE):
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"state_backup_{backup_type}_{timestamp}.json")
    try:
        shutil.copy2(STATE_FILE, backup_path)
        cleanup_backups()
    except Exception as e:
        logger.error(f"Backup creation failed: {e}")

def cleanup_backups():
    """Clean up backups according to retention policy"""
    try:
        # Krijg alle backups
        all_backups = [f for f in os.listdir(BACKUP_DIR) if f.startswith("state_backup_")]
        
        # Groepeer per type
        kort_backups = sorted([f for f in all_backups if "_kort_" in f])
        halfuur_backups = sorted([f for f in all_backups if "_halfuur_" in f]) 
        dag_backups = sorted([f for f in all_backups if "_dag_" in f])
        
        # Keep only last 10 kort backups
        while len(kort_backups) > 10:
            os.remove(os.path.join(BACKUP_DIR, kort_backups.pop(0)))
            
        # Keep only last 10 halfuur backups  
        while len(halfuur_backups) > 10:
            os.remove(os.path.join(BACKUP_DIR, halfuur_backups.pop(0)))
            
        # Keep only last 7 dag backups
        while len(dag_backups) > 7:
            os.remove(os.path.join(BACKUP_DIR, dag_backups.pop(0)))
            
    except Exception as e:
        logger.error(f"Backup cleanup failed: {e}")

def scheduled_backups():
    """Create scheduled backups"""
    try:
        now = datetime.now()
        
        # Halfuur backup (elke 30 minuten)
        if now.minute in [0, 30]:
            create_backup("halfuur")
            
        # Dag backup (elke dag om 02:00)
        if now.hour == 2 and now.minute == 0:
            create_backup("dag")
            
    except Exception as e:
        logger.error(f"Scheduled backup failed: {e}")

def sanitize_path(path: str) -> str:
    """Sanitize file path for security"""
    return os.path.normpath(path)

def make_key(full_path: str) -> str:
    return Path(full_path).as_posix().lower()

def append_event(doc: Dict, event: str, **kwargs) -> None:
    ev = {
        "event": event,
        "ts": now_iso(),
        "status": doc.get("status"),
        "assignees_snapshot": list(doc.get("assignees", []))
    }
    ev.update(kwargs)
    doc.setdefault("history", []).append(ev)

# --------------------- Logging ---------------------
def client_info() -> str:
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '?')
    try:
        host = socket.gethostbyaddr(ip)[0]
        return f"{ip} ({host})"
    except Exception:
        return f"{ip}"

def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%d/%b/%Y %H:%M:%S')}] {msg}")


def load_scan_pause() -> Optional[Dict[str, Any]]:
    """Return pause metadata if scanner should be paused."""
    env_disable = os.environ.get("DOCFLOW_DISABLE_SCANNER", "").strip().lower()
    if env_disable in {"1", "true", "yes", "on"}:
        return {"reason": "DOCFLOW_DISABLE_SCANNER is set"}

    if not os.path.exists(SCAN_PAUSE_FILE):
        return None

    try:
        with open(SCAN_PAUSE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return {"reason": "scanner paused (invalid flag file)"}

    until = data.get("until")
    if until:
        try:
            until_dt = iso_to_dt(until)
            if datetime.utcnow() > until_dt:
                os.remove(SCAN_PAUSE_FILE)
                return None
        except Exception:
            pass

    return data or {"reason": "scanner paused"}


def write_scan_pause(minutes: int, reason: str) -> Dict[str, Any]:
    """Persist a pause request to disk and return its metadata."""
    until_ts: Optional[str] = None
    if minutes > 0:
        until_ts = (datetime.utcnow() + timedelta(minutes=minutes)).isoformat() + "Z"

    payload = {"until": until_ts, "reason": reason or "scanner paused"}
    with open(SCAN_PAUSE_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    return payload

# --- Scanners ---
def list_files_concept_top_level(folder: str) -> List[str]:
    out: List[str] = []
    if not os.path.isdir(folder): return out
    try:
        for e in os.scandir(folder):
            if e.is_file() and not e.name.startswith("~$"):
                out.append(os.path.join(folder, e.name))
    except PermissionError:
        pass
    return out

def list_files_recursive(folder: str) -> List[str]:
    files = []
    for root, _, names in os.walk(folder):
        for fn in names:
            if fn.startswith("~$"): continue
            files.append(os.path.join(root, fn))
    return files

def file_size_safe(p: str) -> int:
    try: return os.path.getsize(p)
    except Exception: return 0

def rescan():
    with lock:
        state = load_state()

        # Check network accessibility first
        concept_accessible = os.path.exists(CONCEPT_DIR)
        approved_accessible = os.path.exists(APPROVED_DIR)
        
        # Skip only missing file detection if directories are not accessible, but still try to scan if one is accessible
        if not concept_accessible and not approved_accessible:
            logger.warning(f"Both network directories temporarily inaccessible - skipping scan entirely. Concept: {concept_accessible}, Approved: {approved_accessible}")
            return
            
        # Initialize empty sets for inaccessible directories
        concept_top = set(list_files_concept_top_level(CONCEPT_DIR)) if concept_accessible else set()
        approved_all = set(list_files_recursive(APPROVED_DIR)) if approved_accessible else set()

        concept_names  = {os.path.basename(p) for p in concept_top}
        approved_names = {os.path.basename(p) for p in approved_all}
        dup_names = concept_names.intersection(approved_names)

        seen = set()

        # Concept - only scan if accessible
        if concept_accessible:
            for full in concept_top:
                key = make_key(full); seen.add(key)
                name = os.path.basename(full); size_now = file_size_safe(full)
                doc = state["documents"].get(key)
                if not doc:
                    doc = {
                        "path": full, "name": name, "status": "concept",
                        "assignees": [], "history": [],
                        "last_seen_in_concept": now_iso(), "last_seen_in_approved": None,
                        "notes": "", "ignored": False, "from_concept": True,
                        "approved_from_concept": False, "size": size_now,
                        "dup_concept_approved": (name in dup_names)
                    }
                    append_event(doc, "indexed", where="concept")
                    state["documents"][key] = doc
                else:
                    doc.update({
                        "path": full, "last_seen_in_concept": now_iso(),
                        "ignored": False, "from_concept": True,
                        "size": size_now, "dup_concept_approved": (name in dup_names)
                    })
                    if doc.get("status") == "approved":
                        append_event(doc, "returned_to_concept")
                        doc["status"] = "concept"

        # Concept-submappen als 'ignored' - only if concept is accessible
        if concept_accessible:
            for key2, doc2 in state["documents"].items():
                p = doc2.get("path","")
                if p and os.path.normcase(p).startswith(os.path.normcase(CONCEPT_DIR + os.sep)):
                    if p not in concept_top:
                        doc2["ignored"] = True

        # Approved - only scan if accessible
        if approved_accessible:
            for full in approved_all:
                key = make_key(full); seen.add(key)
                name = os.path.basename(full); size_now = file_size_safe(full)
                doc = state["documents"].get(key)
                if not doc:
                    # Try to find an existing document (typically from Concept) with the same name
                    lower_name = name.lower()
                    matched_key = None
                    matched_doc = None
                    for key_existing, existing in list(state["documents"].items()):
                        if key_existing == key:
                            continue
                        existing_name = (existing.get("name") or "").lower()
                        if existing_name != lower_name:
                            continue
                        if existing.get("status") == "approved":
                            continue
                        matched_key = key_existing
                        matched_doc = existing
                        # Prefer documents that we already saw in Concept
                        if existing.get("from_concept"):
                            break

                    if matched_doc:
                        state["documents"].pop(matched_key, None)
                        if matched_doc.get("status") != "approved":
                            append_event(matched_doc, "move_to_approved_detected", detected_by="scanner_name_match")
                        matched_doc.update({
                            "path": full,
                            "name": name,
                            "last_seen_in_approved": now_iso(),
                            "ignored": False,
                            "status": "approved",
                            "assignees": [],
                            "notes": "",
                            "size": size_now,
                            "dup_concept_approved": (name in dup_names)
                        })
                        if matched_doc.get("from_concept"):
                            matched_doc["approved_from_concept"] = True
                        state["documents"][key] = matched_doc
                        continue

                    doc = {
                        "path": full, "name": name, "status": "approved",
                        "assignees": [], "history": [],
                        "last_seen_in_concept": None, "last_seen_in_approved": now_iso(),
                        "notes": "", "ignored": False, "from_concept": False,
                        "approved_from_concept": False, "size": size_now,
                        "dup_concept_approved": (name in dup_names)
                    }
                    append_event(doc, "indexed", where="approved")
                    state["documents"][key] = doc
                else:
                    if doc.get("status") != "approved":
                        append_event(doc, "move_to_approved_detected")
                    doc.update({
                        "path": full, "name": name, "last_seen_in_approved": now_iso(),
                        "ignored": False, "status": "approved", "assignees": [],
                        "notes": "", "size": size_now, "dup_concept_approved": (name in dup_names)
                    })
                    if doc.get("from_concept"):
                        doc["approved_from_concept"] = True

        # Missing files handling - only mark as missing if we can access the directories
        if concept_accessible and approved_accessible:
            for k, d in state["documents"].items():
                if k not in seen:
                    pass  # Silently ignore missing files to prevent false notifications

        # Auto terug naar concept bij 0 assignees (behalve approved) - MET EXTRA BEVEILIGING
        reset_count = 0
        for d in state["documents"].values():
            # Extra check: alleen resetten als er NOOIT assignees zijn geweest, 
            # of als het document al langer dan 5 minuten geen assignees heeft
            if d.get("status") not in ("approved","concept") and not d.get("assignees"):
                # Veiligheidscheck: kijk of dit document ooit assignees heeft gehad
                has_had_assignees = any(
                    event.get("event") in ["start", "stuck", "mark_mapproved", "disapprove"] 
                    for event in d.get("events", [])
                )
                
                # Als het document assignees heeft gehad, wacht 5 minuten voor reset
                if has_had_assignees:
                    last_unassign = None
                    for event in reversed(d.get("events", [])):
                        if event.get("event") == "unassign":
                            last_unassign = event.get("ts")
                            break
                    
                    # Als er een unassign event was, check of het >5 min geleden is
                    if last_unassign:
                        try:
                            unassign_time = iso_to_dt(last_unassign)
                            now_time = datetime.utcnow()
                            if (now_time - unassign_time).total_seconds() < 300:  # 5 minuten
                                continue  # Skip reset, te recent
                        except:
                            pass
                
                # Reset naar concept
                if d.get("status") != "concept":
                    append_event(d, "auto_back_to_concept_no_assignees")
                    reset_count += 1
                d["status"] = "concept"
        
        # Log hoeveel documenten zijn gereset
        if reset_count > 0:
            logger.warning(f"Auto-reset {reset_count} documenten naar concept (geen assignees)")

        save_state(state)  # Geen backup bij automatische scan

def rescan_task():
    last_pause_reason: Optional[str] = None
    while True:
        try:
            pause_info = load_scan_pause()
            if pause_info:
                reason = pause_info.get('reason', 'manual pause')
                if reason != last_pause_reason:
                    log(f"[scanner] paused: {reason}; skipping scan")
                last_pause_reason = reason
            else:
                last_pause_reason = None
                rescan()
                # Check for scheduled backups every scan
                scheduled_backups()
        except Exception as e:
            log(f"[scanner] error: {e}")
        time.sleep(SCAN_INTERVAL_SECONDS)

threading.Thread(target=rescan_task, daemon=True).start()

# --------------------- File ops ---------------------
def ensure_dirs():
    os.makedirs(CONCEPT_DIR, exist_ok=True)
    os.makedirs(APPROVED_DIR, exist_ok=True)

def safe_move_to_approved(src_path: str) -> str:
    ensure_dirs()
    filename = os.path.basename(src_path)
    target = os.path.join(APPROVED_DIR, filename)
    if os.path.exists(target):
        stem, ext = os.path.splitext(filename)
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        target = os.path.join(APPROVED_DIR, f"{stem}__{ts}{ext}")
    shutil.move(src_path, target)
    return target

# --------------------- Filters ---------------------
def claims_sort_key(doc: Dict) -> tuple:
    """Sort claimed documents by first assignee, unclaimed last."""
    assignees = doc.get("assignees") or []
    first_assignee = assignees[0].lower() if assignees else ""
    return (
        0 if assignees else 1,
        first_assignee,
        (doc.get("name") or "").lower(),
    )


def filter_docs(state: Dict, status: Optional[str], search: str, sort_key: Optional[str]) -> List[Dict]:
    docs = [d for d in state["documents"].values() if not d.get("ignored")]
    valid_status = {"concept", "ongoing", "stuck", "m.approved", "approved", "dup"}
    if status in valid_status:
        if status == "dup":
            docs = [d for d in docs if d.get("dup_concept_approved")]
        else:
            docs = [d for d in docs if d.get("status") == status]
            if status == "approved":
                docs = [d for d in docs if d.get("name")]
    if search:
        s = search.lower()
        docs = [d for d in docs if s in d.get("name","").lower() or s in d.get("path","").lower()]

    if not sort_key or sort_key == "az":
        docs.sort(key=lambda d: (d.get("name") or "").lower())
    elif sort_key == "za":
        docs.sort(key=lambda d: (d.get("name") or "").lower(), reverse=True)
    elif sort_key == "size_asc":
        docs.sort(key=lambda d: int(d.get("size") or 0))
    elif sort_key == "size_desc":
        docs.sort(key=lambda d: int(d.get("size") or 0), reverse=True)
    elif sort_key == "claims":
        docs.sort(key=claims_sort_key)
    else:
        docs.sort(key=lambda d: (d.get("name") or "").lower())
    return docs

# --------------------- API ---------------------
@app.get("/logo")
def serve_logo():
    if LOGO_PATH and LOGO_PATH.exists():
        return send_file(LOGO_PATH)
    abort(404)


@app.get("/api/file-helper/status")
def api_file_helper_status():
    """Expose availability + metadata of the DocFlow helper executable."""
    metadata = get_file_helper_metadata(get_file_helper_path())
    return jsonify(metadata)


@app.get("/api/download/docflow-file-helper")
def download_docflow_helper():
    helper_path = get_file_helper_path()
    if not helper_path:
        abort(404)
    return send_file(
        helper_path,
        as_attachment=True,
        download_name=helper_path.name,
        mimetype="application/octet-stream",
    )


@app.get("/download-viewer")
def download_viewer():
    """Serve the latest DocFlow viewer executable"""
    try:
        return send_file(EXE_DOWNLOAD_PATH, as_attachment=True)
    except Exception as e:
        logger.error(f"Download viewer failed: {e}")
        abort(404)


@app.get("/intro-image/<path:name>")
def intro_image(name: str):
    """Serve onboarding images from INTRO_IMAGE_DIR"""
    safe = os.path.basename(name)
    allowed = {"png", "jpg", "jpeg", "webp"}
    base, ext = os.path.splitext(safe)
    if ext:
        ext = ext.lstrip(".").lower()
        if ext not in allowed:
            abort(404)
        candidate = INTRO_IMAGE_DIR / safe
        if candidate.exists():
            return send_file(candidate)
    else:
        for e in allowed:
            candidate = INTRO_IMAGE_DIR / f"{safe}.{e}"
            if candidate.exists():
                return send_file(candidate)
    return Response(FALLBACK_SVG, mimetype="image/svg+xml")

@app.get("/assets/<path:filename>")
def serve_frontend_asset(filename: str):
    """Serve static assets from the Vite build (dist/assets)."""
    if not FRONTEND_ASSETS_DIR.exists():
        abort(404)
    # Basic path sanitization to avoid escaping the assets folder
    normalized = os.path.normpath(filename)
    if normalized.startswith(".."):
        abort(404)
    full_path = FRONTEND_ASSETS_DIR / normalized
    if not full_path.exists():
        abort(404)
    return send_from_directory(FRONTEND_ASSETS_DIR, normalized)


@app.get("/")
def home():
    if FRONTEND_INDEX.exists():
        return send_file(FRONTEND_INDEX)

    # Frontend build ontbreekt: toon duidelijke boodschap in plaats van de oude interface
    return Response(
        "Frontend build niet gevonden. Run 'npm install' en 'npm run build' om de nieuwe UI beschikbaar te maken.",
        status=503,
        mimetype="text/plain",
    )

@app.get("/api/health")
def api_health():
    return jsonify({"ok": True})


@app.get("/api/docs")
def api_docs():
    status = request.args.get("status")
    search = request.args.get("q", "")
    sort_key = request.args.get("sort", "az")
    user = request.args.get("user", "")
    log(f"{client_info()} — user={user or '-'} — GET /api/docs?status={status or ''}&sort={sort_key}")
    with lock:
        st = load_state()
        docs = filter_docs(st, status, search, sort_key)
    return jsonify({"ok": True, "items": docs, "count": len(docs)})

@app.get("/api/mylist")
def api_mylist():
    user = request.args.get("user", "")
    search = request.args.get("q", "")
    sort_key = request.args.get("sort", "az")
    log(f"{client_info()} — user={user or '-'} — GET /api/mylist")
    with lock:
        st = load_state()
        docs = [d for d in st["documents"].values()
                if not d.get("ignored")
                and user in d.get("assignees", [])
                and d.get("status") in ("ongoing", "stuck", "m.approved")]
        if search:
            s = search.lower()
            docs = [d for d in docs if s in d.get("name","").lower() or s in d.get("path","").lower()]
        if not sort_key or sort_key == "az":
            docs.sort(key=lambda d: (d.get("name") or "").lower())
        elif sort_key == "za":
            docs.sort(key=lambda d: (d.get("name") or "").lower(), reverse=True)
        elif sort_key == "size_asc":
            docs.sort(key=lambda d: int(d.get("size") or 0))
        elif sort_key == "size_desc":
            docs.sort(key=lambda d: int(d.get("size") or 0), reverse=True)
        elif sort_key == "claims":
            docs.sort(key=claims_sort_key)
        else:
            docs.sort(key=lambda d: (d.get("name") or "").lower())
        status_priority = {"ongoing": 0, "stuck": 1, "m.approved": 2}
        docs.sort(key=lambda d: status_priority.get(d.get("status"), 99))
    return jsonify({"ok": True, "items": docs, "count": len(docs)})


@app.get("/api/ideas")
def api_ideas_list():
    with ideas_lock:
        ideas = load_ideas()
    return jsonify({"ok": True, "items": ideas, "count": len(ideas)})


@app.post("/api/ideas")
def api_ideas_add():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    author = (data.get("author") or "Anoniem").strip() or "Anoniem"
    metadata = data.get("metadata") or {}
    if not text:
        return jsonify({"ok": False, "error": "Idee tekst is verplicht"}), 400

    idea = {
        "id": f"{int(time.time() * 1000)}",
        "text": text,
        "author": author,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "votes": 0,
        "status": "new",
        "votedBy": [],
        "metadata": metadata,
        "adminNote": data.get("adminNote", "")
    }

    with ideas_lock:
        ideas = load_ideas()
        ideas.insert(0, idea)
        save_ideas(ideas)

    log(f"{client_info()} — Idee toegevoegd door {author}")
    return jsonify({"ok": True, "item": idea})


@app.post("/api/ideas/vote")
def api_ideas_vote():
    data = request.get_json(silent=True) or {}
    idea_id = data.get("id")
    user = (data.get("user") or "").strip()
    if not idea_id or not user:
        return jsonify({"ok": False, "error": "id en user zijn verplicht"}), 400

    with ideas_lock:
        ideas = load_ideas()
        updated = None
        for idea in ideas:
            if idea.get("id") == idea_id:
                voted_by = set(idea.get("votedBy") or [])
                if user in voted_by:
                    voted_by.remove(user)
                else:
                    voted_by.add(user)
                idea["votedBy"] = sorted(voted_by)
                idea["votes"] = len(voted_by)
                updated = idea
                break
        if updated is None:
            return jsonify({"ok": False, "error": "Idee niet gevonden"}), 404
        save_ideas(ideas)

    log(f"{client_info()} — Stem toggled door {user} op idee {idea_id}")
    return jsonify({"ok": True, "item": updated})


@app.post("/api/ideas/status")
def api_ideas_status():
    data = request.get_json(silent=True) or {}
    idea_id = data.get("id")
    status = data.get("status")
    if not idea_id or status not in {"new", "rejected", "in-progress", "done"}:
        return jsonify({"ok": False, "error": "Ongeldige status of id"}), 400

    with ideas_lock:
        ideas = load_ideas()
        updated = None
        for idea in ideas:
            if idea.get("id") == idea_id:
                idea["status"] = status
                updated = idea
                break
        if updated is None:
            return jsonify({"ok": False, "error": "Idee niet gevonden"}), 404
        save_ideas(ideas)

    log(f"{client_info()} — Idee {idea_id} status -> {status}")
    return jsonify({"ok": True, "item": updated})


@app.post("/api/ideas/note")
def api_ideas_note():
    data = request.get_json(silent=True) or {}
    idea_id = data.get("id")
    note = data.get("note", "")
    if not idea_id:
        return jsonify({"ok": False, "error": "id is verplicht"}), 400

    with ideas_lock:
        ideas = load_ideas()
        updated = None
        for idea in ideas:
            if idea.get("id") == idea_id:
                idea["adminNote"] = note
                updated = idea
                break
        if updated is None:
            return jsonify({"ok": False, "error": "Idee niet gevonden"}), 404
        save_ideas(ideas)

    log(f"{client_info()} — Admin notitie aangepast voor idee {idea_id}")
    return jsonify({"ok": True, "item": updated})


@app.post("/api/ideas/delete")
def api_ideas_delete():
    data = request.get_json(silent=True) or {}
    idea_id = data.get("id")
    if not idea_id:
        return jsonify({"ok": False, "error": "id is verplicht"}), 400

    with ideas_lock:
        ideas = load_ideas()
        new_ideas = [i for i in ideas if i.get("id") != idea_id]
        if len(new_ideas) == len(ideas):
            return jsonify({"ok": False, "error": "Idee niet gevonden"}), 404
        save_ideas(new_ideas)

    log(f"{client_info()} — Idee {idea_id} verwijderd")
    return jsonify({"ok": True})


@app.post("/api/ideas/reset")
def api_ideas_reset():
    with ideas_lock:
        save_ideas([])
    log(f"{client_info()} — Alle ideeën verwijderd")
    return jsonify({"ok": True, "items": []})

@app.get("/api/changes")
def api_changes():
    user = (request.args.get("user","") or "").strip()
    since = request.args.get("since","")
    limit = int(request.args.get("limit","50"))
    if limit > 200: limit = 200

    def iso_to_dt2(s: str) -> datetime:
        if not s: return datetime.min
        s2 = s[:-1] if s.endswith("Z") else s
        try: return datetime.fromisoformat(s2)
        except Exception: return datetime.min

    dt_since = iso_to_dt2(since) if since else datetime.utcnow() - timedelta(days=7)
    user_l = user.lower()
    
    # Check for server-side dismissals
    dismissals = load_dismissals()
    user_dismissal = dismissals.get(user, "")
    dt_dismissed = iso_to_dt2(user_dismissal) if user_dismissal else datetime.min

    with lock:
        st = load_state()
        events = []
        for d in st["documents"].values():
            for ev in d.get("history", []):
                ts = iso_to_dt2(ev.get("ts",""))
                if ts < dt_since: continue
                # Skip events before dismissal time
                if ts <= dt_dismissed: continue
                ass = [a.lower() for a in ev.get("assignees_snapshot", [])]
                if user and user_l not in ass: continue
                by = (ev.get("by","") or "").lower()
                if user and by and by == user_l:  # filter eigen acties
                    continue
                events.append({
                    "ts": ev.get("ts"), "event": ev.get("event"),
                    "status": ev.get("status"), "by": ev.get("by",""),
                    "note": ev.get("note",""), "where": ev.get("where",""),
                    "doc_name": d.get("name"), "path": d.get("path")
                })
        events.sort(key=lambda e: e.get("ts",""), reverse=True)
        total = len(events)
        if limit: events = events[:limit]
    return jsonify({"ok": True, "count": total, "items": events})

# --------------------- Muterende API's ---------------------
@app.post("/api/start")
def api_start():
    data = request.get_json(force=True)
    path, user = data.get("path"), data.get("user")
    if not path or not user: return jsonify({"ok": False, "error": "path and user required"}), 400
    key = make_key(path)
    with lock:
        st = load_state()
        doc = st["documents"].get(key)
        if not doc: return jsonify({"ok": False, "error": "document not indexed yet"}), 404
        if doc.get("status") == "approved": return jsonify({"ok": False, "error": "document already approved"}), 400
        doc["status"] = "ongoing"
        ass = set(doc.get("assignees", [])); ass.add(user)
        doc["assignees"] = sorted(ass)
        append_event(doc, "start", by=user)
        doc["from_concept"] = True
        save_state(st, force_backup=True)  # Backup bij claimen
    return jsonify({"ok": True})

@app.post("/api/stuck")
def api_stuck():
    data = request.get_json(force=True)
    path, user = data.get("path"), data.get("user"); note = data.get("note","")
    if not path or not user: return jsonify({"ok": False, "error": "path and user required"}), 400
    key = make_key(path)
    with lock:
        st = load_state(); doc = st["documents"].get(key)
        if not doc: return jsonify({"ok": False, "error": "document not indexed yet"}), 404
        if doc.get("status") == "approved": return jsonify({"ok": False, "error": "document already approved"}), 400
        doc["status"] = "stuck"
        ass = set(doc.get("assignees", [])); ass.add(user)
        doc["assignees"] = sorted(ass)
        doc["notes"] = note
        append_event(doc, "stuck", by=user, note=note)
        doc["from_concept"] = True
        save_state(st, force_backup=True)  # Backup bij stagnatie
    return jsonify({"ok": True})

@app.post("/api/mark_mapproved")
def api_mark_mapproved():
    data = request.get_json(force=True)
    path, user = data.get("path"), data.get("user")
    if not path or not user: return jsonify({"ok": False, "error": "path and user required"}), 400
    key = make_key(path)
    with lock:
        st = load_state(); doc = st["documents"].get(key)
        if not doc: return jsonify({"ok": False, "error": "document not indexed yet"}), 404
        if doc.get("status") == "approved": return jsonify({"ok": False, "error": "document already approved"}), 400
        doc["status"] = "m.approved"
        ass = set(doc.get("assignees", [])); ass.add(user)
        doc["assignees"] = sorted(ass)
        append_event(doc, "mark_mapproved", by=user)
        save_state(st, force_backup=True)  # Backup bij valideren
    return jsonify({"ok": True})

@app.post("/api/disapprove")
def api_disapprove():
    data = request.get_json(force=True)
    path, user = data.get("path"), data.get("user"); note = data.get("note","")
    if not path or not user: return jsonify({"ok": False, "error": "path and user required"}), 400
    key = make_key(path)
    with lock:
        st = load_state(); doc = st["documents"].get(key)
        if not doc: return jsonify({"ok": False, "error": "document not indexed yet"}), 404
        if doc.get("status") != "m.approved": return jsonify({"ok": False, "error": "document must be M.approved to disapprove"}), 400
        doc["status"] = "ongoing"
        ass = set(doc.get("assignees", [])); ass.add(user)
        doc["assignees"] = sorted(ass)
        doc["notes"] = note
        append_event(doc, "disapprove", by=user, note=note)
        doc["from_concept"] = True
        save_state(st, force_backup=True)  # Backup bij afkeuren
    return jsonify({"ok": True})

@app.post("/api/finalize_approve")
def api_finalize_approve():
    data = request.get_json(force=True)
    path, user = data.get("path"), data.get("user")
    if not path or not user: return jsonify({"ok": False, "error": "path and user required"}), 400
    key_old = make_key(path)
    with lock:
        st = load_state(); doc = st["documents"].get(key_old)
        if not doc: return jsonify({"ok": False, "error": "document not indexed yet"}), 404
        if doc.get("status") != "m.approved": return jsonify({"ok": False, "error": "document must be M.approved first"}), 400
        if not os.path.exists(path): return jsonify({"ok": False, "error": "bronbestand niet gevonden in Concept"}), 404
        try:
            new_path = safe_move_to_approved(path)
        except Exception as e:
            return jsonify({"ok": False, "error": f"Kon niet verplaatsen: {e}"}), 500
        key_new = make_key(new_path)
        st["documents"].pop(key_old, None)
        doc.update({
            "path": new_path, "name": os.path.basename(new_path),
            "status": "approved", "assignees": [], "notes": "",
            "last_seen_in_approved": now_iso(), "approved_from_concept": True,
            "size": file_size_safe(new_path)
        })
        append_event(doc, "finalize_approve_move", by=user, to=new_path)
        st["documents"][key_new] = doc
        save_state(st)
    return jsonify({"ok": True})

@app.post("/api/unassign")
def api_unassign():
    data = request.get_json(force=True)
    path, user = data.get("path"), data.get("user")
    if not path or not user: return jsonify({"ok": False, "error": "path and user required"}), 400
    key = make_key(path)
    with lock:
        st = load_state(); doc = st["documents"].get(key)
        if not doc: return jsonify({"ok": False, "error": "document not indexed yet"}), 404
        cur = [u for u in doc.get("assignees", []) if u.lower() != (user or "").lower()]
        doc["assignees"] = cur
        append_event(doc, "unassign", by=user)
        if len(cur) == 0 and doc.get("status") != "approved":
            if doc.get("status") != "concept":
                append_event(doc, "auto_back_to_concept_no_assignees")
            doc["status"] = "concept"
        save_state(st)
    return jsonify({"ok": True})

# --------------------- NIEUWE API's VOOR BULK & EXPORT ---------------------
# Bulk API endpoint removed - using individual endpoints instead

# Export functionality removed as requested

@app.post("/api/notifications/subscribe")
def api_notifications_subscribe():
    """Subscribe to browser notifications"""
    data = request.get_json(force=True)
    user = data.get("user", "")
    endpoint = data.get("endpoint", "")
    
    if not user or not endpoint:
        return jsonify({"ok": False, "error": "user and endpoint required"}), 400
    
    # Store subscription (in production, use a proper database)
    subscriptions = load_subscriptions()
    subscriptions[user] = {
        "endpoint": endpoint,
        "created": now_iso()
    }
    save_subscriptions(subscriptions)
    
    return jsonify({"ok": True})

@app.post("/api/notifications/dismiss")
def api_notifications_dismiss():
    """Dismiss notifications for a user"""
    data = request.get_json(force=True)
    user = data.get("user", "")
    
    if not user:
        return jsonify({"ok": False, "error": "user required"}), 400
    
    # Store dismissal timestamp per user
    dismissals = load_dismissals()
    dismissals[user] = now_iso()
    save_dismissals(dismissals)
    
    return jsonify({"ok": True})

def load_subscriptions():
    """Load notification subscriptions"""
    sub_file = "subscriptions.json"
    if not os.path.exists(sub_file):
        return {}
    try:
        with open(sub_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_subscriptions(subs):
    """Save notification subscriptions"""
    sub_file = "subscriptions.json"
    with open(sub_file, "w", encoding="utf-8") as f:
        json.dump(subs, f, indent=2)

def load_dismissals():
    """Load notification dismissals"""
    dismissal_file = "dismissals.json"
    if not os.path.exists(dismissal_file):
        return {}
    try:
        with open(dismissal_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_dismissals(dismissals):
    """Save notification dismissals"""
    dismissal_file = "dismissals.json"
    with open(dismissal_file, "w", encoding="utf-8") as f:
        json.dump(dismissals, f, indent=2)

@app.get("/api/backups")
def api_list_backups():
    """List available backups"""
    if not os.path.exists(BACKUP_DIR):
        return jsonify({"ok": True, "backups": []})
    
    backups = []
    for f in os.listdir(BACKUP_DIR):
        if f.startswith("state_backup_"):
            path = os.path.join(BACKUP_DIR, f)
            # Parse new format: state_backup_TYPE_TIMESTAMP.json
            parts = f.replace("state_backup_", "").replace(".json", "").split("_")
            if len(parts) >= 3:
                backup_type = parts[0]
                timestamp_str = "_".join(parts[1:])
            else:
                backup_type = "kort"  # fallback voor oude backups
                timestamp_str = "_".join(parts)
            
            try:
                timestamp = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                type_label = {"kort": "📋 Kort", "halfuur": "⏰ Half uur", "dag": "📅 Dag"}.get(backup_type, "📋 Kort")
                backups.append({
                    "filename": f,
                    "timestamp": timestamp.isoformat(),
                    "size": os.path.getsize(path),
                    "type": backup_type,
                    "display_name": f"{type_label} - {timestamp.strftime('%d-%m-%Y %H:%M:%S')}"
                })
            except Exception:
                continue
    
    backups.sort(key=lambda x: x["timestamp"], reverse=True)
    return jsonify({"ok": True, "backups": backups})

@app.post("/api/create_backup")
def api_create_backup():
    """Create manual backup with password protection"""
    data = request.get_json()
    password = data.get("password", "")
    backup_type = data.get("backup_type", "kort")
    
    if password != "Trescal":
        return jsonify({"ok": False, "error": "Ongeldig wachtwoord"})
    
    try:
        create_backup(backup_type)
        type_labels = {
            "kort": "Korte",
            "halfuur": "Halfuur", 
            "dag": "Dagelijkse"
        }
        type_label = type_labels.get(backup_type, backup_type)
        return jsonify({"ok": True, "message": f"{type_label} backup succesvol aangemaakt"})
    except Exception as e:
        logger.error(f"Manual backup creation failed: {e}")
        return jsonify({"ok": False, "error": f"Backup mislukt: {str(e)}"})

@app.post("/api/restore")
def api_restore_backup():
    """Restore from backup with password protection"""
    data = request.get_json()
    filename = data.get("filename")
    password = data.get("password", "")
    
    if password != "Trescal":
        return jsonify({"ok": False, "error": "Ongeldig wachtwoord"})
    
    if not filename or not filename.startswith("state_backup_"):
        return jsonify({"ok": False, "error": "Ongeldige backup"})
    
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        return jsonify({"ok": False, "error": "Backup niet gevonden"})
    
    try:
        # Create backup of current state before restoring
        create_backup("kort")

        # Restore the backup
        shutil.copy2(backup_path, STATE_FILE)
        logger.info(f"State restored from backup: {filename}")

        # After a restore, pause the scanner so the snapshot stays intact
        pause_minutes = max(0, int(data.get("pause_minutes", 120)))
        pause_reason = data.get("pause_reason", f"Herstel van {filename}")
        pause_info = write_scan_pause(pause_minutes, pause_reason)

        pause_msg = "Scanner onbeperkt gepauzeerd" if pause_minutes == 0 else f"Scanner gepauzeerd voor {pause_minutes} minuten"
        return jsonify({"ok": True, "message": f"Hersteld van backup: {filename}. {pause_msg}", "pause": pause_info})
    except Exception as e:
        logger.error(f"Restore failed: {e}")
        return jsonify({"ok": False, "error": f"Herstel mislukt: {str(e)}"})


@app.post("/api/scan/pause")
def api_pause_scanner():
    """Pause the background scanner to keep a restored state in place."""
    data = request.get_json() or {}
    password = data.get("password", "")
    if password != "Trescal":
        return jsonify({"ok": False, "error": "Ongeldig wachtwoord"})

    minutes = max(0, int(data.get("minutes", 30)))
    reason = data.get("reason", "handmatig gepauzeerd")
    pause_info = write_scan_pause(minutes, reason)
    return jsonify({"ok": True, "message": f"Scanner gepauzeerd voor {minutes} minuten" if minutes else "Scanner onbeperkt gepauzeerd", "pause": pause_info})


@app.post("/api/scan/resume")
def api_resume_scanner():
    """Resume scanning by removing the pause flag."""
    data = request.get_json() or {}
    password = data.get("password", "")
    if password != "Trescal":
        return jsonify({"ok": False, "error": "Ongeldig wachtwoord"})

    if os.path.exists(SCAN_PAUSE_FILE):
        try:
            os.remove(SCAN_PAUSE_FILE)
        except Exception as e:
            return jsonify({"ok": False, "error": f"Kon pauze niet opheffen: {str(e)}"})

    return jsonify({"ok": True, "message": "Scanner hervat"})

@app.get("/api/stats/performance")
def api_performance_stats():
    """Get performance statistics"""
    stats = {
        "scan_interval": SCAN_INTERVAL_SECONDS,
        "state_file_size": os.path.getsize(STATE_FILE) if os.path.exists(STATE_FILE) else 0,
        "backup_count": len([f for f in os.listdir(BACKUP_DIR) if f.startswith("state_backup_")]) if os.path.exists(BACKUP_DIR) else 0,
        "concept_accessible": os.path.exists(CONCEPT_DIR),
        "approved_accessible": os.path.exists(APPROVED_DIR),
        "uptime": time.time() - getattr(api_performance_stats, '_start_time', time.time())
    }
    if not hasattr(api_performance_stats, '_start_time'):
        api_performance_stats._start_time = time.time()
    
    return jsonify({"ok": True, "stats": stats})

# --------------------- VERBETERDE UI ---------------------
INDEX_HTML = r"""
<!doctype html>
<html lang="nl" class="h-full">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{ app_title }}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* ====== VERBETERDE Light / Dark theme tokens ====== */
    :root{
      --bg: #ffffff; --fg:#0f172a; --muted:#64748b;
      --foreground: #0f172a; --muted-foreground: #64748b; --background: #ffffff;
      --card:#ffffff; --card-soft:#f8fafc; --border:#e5e7eb;
      --badge1:#f3f4f6; --badge1t:#374151;
      --ongo:#e8f0fe; --ongot:var(--brand);
      --stuck:#fff4d6; --stuckt:#b45309;
      --mappr:#e0e7ff; --mapprt:#4338ca;
      --appr:#dcfce7; --apprt:#065f46;
      --shadow: 0 1px 6px rgba(0,0,0,.06);
      --shadow-lg: 0 12px 40px rgba(0,0,0,.10);
      --input-bg:#ffffff; --input-fg:#0f172a; --input-border:#e5e7eb;
      --overlay: rgba(15,23,42,.28);
      --brand:#0077C8;
    }
    .dark{
      --bg:#0b1220; --fg:#9ca3af; --muted:#6b7280; /* MEER GRIJS */
      --foreground: #e2e8f0; --muted-foreground: #94a3b8; --background: #0b1220;
      --card:#0f172a; --card-soft:#121a31; --border:#334155;
      --badge1:#1c2542; --badge1t:#9ca3af; /* GRIJZER */
      --ongo:#14265a; --ongot:#93c5fd; /* GRIJZER */
      --stuck:#3a2a05; --stuckt:#fbbf24; /* GRIJZER */
      --mappr:#1b2050; --mapprt:#a5b4fc; /* GRIJZER */
      --appr:#0f3b2f; --apprt:#86efac; /* GRIJZER */
      --shadow: 0 1px 8px rgba(0,0,0,.5);
      --shadow-lg: 0 12px 40px rgba(0,0,0,.6);
      --input-bg:#1e293b; --input-fg:#9ca3af; --input-border:#374151; /* DARK INPUTS */
      --overlay: rgba(0,0,0,.55);
      --brand:#0077C8;
    }

    html, body{ height:100%; }
    body{ background:var(--bg); color:var(--fg); }

    .card { border-radius:16px; box-shadow:var(--shadow); padding:16px; background:var(--card); border:1px solid var(--border); transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease; }
    .card:hover{ box-shadow:0 4px 22px rgba(0,0,0,.08); border-color:var(--brand); transform:translateY(-2px); }
    .stats-compact.card:hover{ box-shadow:var(--shadow); border-color:var(--border); transform:none; }
    body.modal-open .card:hover{ box-shadow:var(--shadow); border-color:var(--border); transform:none; }
    #notifDialog .card:hover{ box-shadow:var(--shadow); border-color:var(--border); transform:none; }
    .badge { padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; display:inline-block; }
    .status-concept { background:var(--badge1); color:var(--badge1t); }
    .status-ongoing { background:var(--ongo); color:var(--ongot); }
    .status-stuck { background:var(--stuck); color:var(--stuckt); }
    .status-mapproved { background:var(--mappr); color:var(--mapprt); }
    .status-approved { background:var(--appr); color:var(--apprt); }
    .status-dup { background:#fef3c7; color:#92400e; }
    .dark .status-dup { background:#3a2a05; color:#facc15; }

    .btn { padding:10px 14px; border-radius:12px; border:1px solid var(--border); font-size:14px; font-weight:600; cursor:pointer; background:var(--card-soft); transition:transform .15s ease, background .2s ease, filter .2s ease; color:var(--fg); }
    .btn:active { transform: translateY(1px); }
    .btn:hover { filter:brightness(1.03); }
    .btn-primary { background:var(--brand); color:#fff; border-color:var(--brand); }
    .btn-primary:hover { background:#006bb0; }
    .btn-warn { background:#f59e0b; color:#fff; border-color:#f59e0b; }
    .btn-ok { background:#10b981; color:#fff; border-color:#10b981; }
    .btn-ghost { background:var(--card); color:var(--fg); border-color:#d1d5db22; }
    .btn-accent { background:#6366f1; color:#fff; border-color:#6366f1; }

    .btn-action{ min-width:118px; justify-content:center; }

    .btn-bell { background:#facc15; color:#111827; border-color:#facc15; }
    .btn-bell:hover { background:#eab308; }
    .notif-wrap{ position:relative; }
    .notif-dot{ position:absolute; top:-4px; right:-4px; width:10px; height:10px; border-radius:999px; background:#ef4444; box-shadow:0 0 0 2px var(--card); }
    .notif-count{ position:absolute; top:-8px; right:-8px; min-width:16px; height:16px; line-height:16px; padding:0 5px; font-size:10px; border-radius:999px; color:#fff; background:#ef4444; box-shadow:0 0 0 2px var(--card); text-align:center; }

    .iconbtn { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:999px; border:1px solid var(--border); background:var(--card); transition:filter .2s ease; }
    .iconbtn:hover { filter:brightness(1.05); }

    #downloadBtn{ width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:8px; border:1px solid var(--border); background:var(--card); color:var(--brand); cursor:pointer; transition:filter .2s ease, box-shadow .2s ease; text-decoration:none; }
    #downloadBtn:hover{ filter:brightness(1.05); box-shadow:0 0 0 2px var(--brand); }

    .svg { width:20px; height:20px; display:block; }

    #logoWrap{ cursor:pointer; transition:transform .2s; }
    #logoWrap:hover{ transform:scale(1.02); }
    #logoWrap:hover #docflowTitle{ color:var(--brand); }

    /* Uniforme kaart lay-out */
    .doc-card{ display:flex; flex-direction:column; min-height:200px; }
    .doc-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .namewrap{ display:flex; align-items:center; gap:12px; min-height:36px; }
    .doc-title{ font-weight:500; font-size:15px; line-height:1.3; color:var(--fg); }
    .doc-size{ font-size:12px; color:var(--muted); }
    .note-area{ min-height:22px; margin-top:6px; color:#b45309; font-size:12px; }
    .actions{ margin-top:auto; display:flex; gap:8px; flex-wrap:wrap; }

    /* Loading shimmer placeholders */
    .shimmer{ position:relative; overflow:hidden; background:var(--card-soft); }
    .shimmer::after{
      content:""; position:absolute; top:0; left:-150px;
      width:100px; height:100%;
      background:linear-gradient(90deg, transparent, rgba(255,255,255,.4), transparent);
      animation:shimmer 1.5s infinite;
    }
    @keyframes shimmer{
      0%{ transform:translateX(0); }
      100%{ transform:translateX(250px); }
    }

    /* VERBETERDE Inputs/selects/dialogs voor dark mode */
    input[type="text"], textarea, select {
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 12px;
      padding: 8px 10px;
      outline: none;
      transition: all 0.2s ease;
    }
    input[type="text"]:focus, textarea:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 2px rgba(0, 119, 200, 0.1);
    }
    select { padding: 6px 8px; }
    dialog { border: none; padding: 0; background: transparent; color:var(--fg); outline: none; }
    .stats-compact:focus { outline: none; }
    dialog::backdrop{ background: var(--overlay); backdrop-filter: blur(2px); }

    .opacity-50{ opacity:.5; }

    /* Toggle switch */
    .toggle{ width:56px; height:30px; border-radius:999px; position:relative; border:1px solid var(--border); background:var(--card); display:inline-flex; align-items:center; padding:3px; cursor:pointer; }
    .toggle .knob{ width:24px; height:24px; border-radius:999px; background:#ffd166; display:flex; align-items:center; justify-content:center; transition: transform .2s ease, background .2s ease; }
    .toggle.dark .knob{ background:#94a3b8; transform: translateX(26px); }

    /* BULK OPERATIONS STYLING */
    .bulk-controls { 
      position: fixed; 
      bottom: 20px; 
      right: 20px; 
      z-index: 50; 
      transform: translateY(100px); 
      opacity: 0; 
      transition: all 0.3s ease; 
      background: var(--card); 
      border: 1px solid var(--border); 
      border-radius: 16px; 
      padding: 16px; 
      box-shadow: var(--shadow-lg);
    }
    .bulk-controls.show { transform: translateY(0); opacity: 1; }
    .bulk-selection { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .bulk-actions { display: flex; gap: 8px; }

    /* SELECTION CHECKBOX */
    .select-checkbox { 
      position: absolute; 
      top: 12px; 
      left: 12px; 
      width: 20px; 
      height: 20px; 
      accent-color: var(--brand);
      z-index: 10;
    }
    .doc-card.selected {
      border-color: var(--brand);
      background: var(--card-soft);
    }

    /* PROGRESS BAR */
    .progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: var(--border);
      z-index: 100;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s ease;
    }
    .progress-bar.active { transform: scaleX(1); }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--brand), #06b6d4);
      width: 0%;
      transition: width 0.3s ease;
    }

    /* DRAG AND DROP */
    .drop-zone {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--overlay);
      z-index: 200;
      display: none;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    .drop-zone.active { display: flex; }
    .drop-indicator {
      background: var(--card);
      border: 2px dashed var(--brand);
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      color: var(--fg);
      font-size: 18px;
      font-weight: 600;
    }

    /* KEYBOARD SHORTCUTS HELP */
    .shortcuts-help {
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      font-size: 11px;
      color: var(--muted);
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;
      z-index: 30;
    }
    .shortcuts-help.show { opacity: 1; transform: translateY(0); }
    .shortcut { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .shortcut kbd { 
      background: var(--card-soft); 
      border: 1px solid var(--border); 
      border-radius: 4px; 
      padding: 2px 6px; 
      font-size: 10px; 
    }

    /* COMPACTE STATISTIEKEN DIALOG */
    .stats-compact {
      max-height: 90vh;
      overflow: auto;
    }
    .stats-kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi-card {
      padding: 12px;
      border-radius: 12px;
      background: var(--card-soft);
      border: 1px solid var(--border);
      text-align: center;
    }
    .kpi-label {
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 20px;
      font-weight: bold;
      color: var(--fg);
    }
    .charts-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .chart-card {
      padding: 16px;
      border-radius: 12px;
      background: var(--card);
      border: 1px solid var(--border);
    }
    .chart-title {
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--fg);
    }
  </style>
</head>
<body class="min-h-full">
  <div class="max-w-7xl mx-auto p-4">
    <header class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-2 relative">
        <div class="flex items-center gap-2" id="logoWrap">
          <img id="trescalLogo" src="/logo" alt="Trescal logo" style="height:34px;" />
          <span class="text-2xl font-bold" id="docflowTitle">Docflow</span>
          <div id="titleTooltip" class="card" style="position:fixed;display:none;padding:8px 12px;font-size:12px;pointer-events:none;width:300px;line-height:1.5;transform:translateX(-50%);white-space:normal;flex:none;">
            <div><strong>Trescal Docflow is live! 🎉🚀</strong></div>
            <div>Met Trescal Docflow wordt het beheren van documenten een stuk makkelijker. Het programma helpt je om de flow van documenten – van concept tot approved – soepel en overzichtelijk te laten verlopen.</div>
            <div>Alle bestanden zijn direct zichtbaar in de concept- en approved-map, waardoor je altijd met de juiste versie werkt. ✅</div>
            <div>💡 Tip: Download het programma om het jezelf nog makkelijker te maken! In de app kun je Excel-sheets direct openen en met één klik verplaatsen naar de approved-map. Zo hoef je nooit meer eindeloos door mappen te zoeken naar dat ene bestand.</div>
          </div>
        </div>
        <div class="relative" id="backupWrap">
          <button id="backupBtn" class="btn-ghost" style="width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;">💾</button>
          <div id="backupPop" class="card" style="position:absolute; top:120%; left:0; display:none; min-width:380px; max-width:480px; line-height:1.5; font-size:13.5px; z-index:40; box-shadow:var(--shadow-lg);">
            <div class="font-semibold mb-3" style="color: var(--warning, #fbbf24);">🔄 Backup & Herstel</div>
            <div style="margin-bottom: 12px; color: var(--muted); font-size: 12px;">
              Maak backups en herstel als er iets mis gaat. Wachtwoord vereist voor uitvoering.
            </div>
            
            <!-- Password input (initially hidden) -->
            <div id="passwordSection" style="display: none; margin-bottom: 12px; padding: 8px; background: var(--card-alt, var(--muted)); border-radius: 6px;">
              <label style="font-size: 12px; font-weight: 600;">Wachtwoord voor backup acties:</label>
              <input type="password" id="backupPassword" placeholder="Voer wachtwoord in..." style="width: 100%; margin-top: 4px; padding: 6px; border: 1px solid var(--border); border-radius: 4px; background: var(--background);">
              <div style="margin-top: 6px; display: flex; gap: 4px;">
                <button id="verifyPasswordBtn" class="btn btn-secondary" style="font-size: 11px; padding: 4px 8px;">Verifiëren</button>
                <button id="cancelPasswordBtn" class="btn btn-ghost" style="font-size: 11px; padding: 4px 8px;">Annuleren</button>
              </div>
            </div>

            <!-- Backup types -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px; background: var(--card-alt, var(--muted)); border-radius: 4px;">
                <div>
                  <div style="font-weight: 600; font-size: 12px;">Korte Backups (10x)</div>
                  <div style="font-size: 11px; color: var(--muted);">Voor directe wijzigingen</div>
                </div>
                <div style="display: flex; gap: 4px;">
                  <button class="backup-action-btn btn btn-secondary" data-type="kort" data-action="create" style="font-size: 11px; padding: 4px 6px;">Maak</button>
                  <button class="backup-action-btn btn btn-ghost" data-type="kort" data-action="restore" style="font-size: 11px; padding: 4px 6px;">Herstel</button>
                </div>
              </div>
              
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px; background: var(--card-alt, var(--muted)); border-radius: 4px;">
                <div>
                  <div style="font-weight: 600; font-size: 12px;">Halfuur Backups (10x)</div>
                  <div style="font-size: 11px; color: var(--muted);">Voor sessie herstel</div>
                </div>
                <div style="display: flex; gap: 4px;">
                  <button class="backup-action-btn btn btn-secondary" data-type="halfuur" data-action="create" style="font-size: 11px; padding: 4px 6px;">Maak</button>
                  <button class="backup-action-btn btn btn-ghost" data-type="halfuur" data-action="restore" style="font-size: 11px; padding: 4px 6px;">Herstel</button>
                </div>
              </div>
              
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px; background: var(--card-alt, var(--muted)); border-radius: 4px;">
                <div>
                  <div style="font-weight: 600; font-size: 12px;">Dagelijkse Backups (7x)</div>
                  <div style="font-size: 11px; color: var(--muted);">Voor lange termijn</div>
                </div>
                <div style="display: flex; gap: 4px;">
                  <button class="backup-action-btn btn btn-secondary" data-type="dag" data-action="create" style="font-size: 11px; padding: 4px 6px;">Maak</button>
                  <button class="backup-action-btn btn btn-ghost" data-type="dag" data-action="restore" style="font-size: 11px; padding: 4px 6px;">Herstel</button>
                </div>
              </div>
            </div>
            
            <div id="backupsList" style="margin-top: 12px; display: none;">
              <div style="font-weight: 600; margin-bottom: 8px; font-size: 12px;">Beschikbare backups:</div>
              <div id="backupsContent" style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; padding: 8px; background: var(--background); font-size: 11px;">
                <div style="color: var(--muted); text-align: center;">Laden...</div>
              </div>
              </div>
            </div>
          </div>
          <div class="relative" id="downloadWrap">
          <a id="downloadBtn" href="/download-viewer">⬇️</a>
          <div id="downloadTip" class="card" style="position:absolute;top:110%;left:50%;transform:translateX(-50%);display:none;padding:4px 8px;font-size:12px;">Download de viewer</div>
          </div>
          <button id="introBtn" class="iconbtn" title="Intro openen">📖</button>
        </div>

        <div class="flex items-center gap-2">
        <!-- Theme toggle -->
        <button id="themeToggle" class="toggle" title="Schakel donker/licht">
          <div class="knob">
            <svg id="sunIcon" viewBox="0 0 24 24" style="width:14px;height:14px"><path fill="currentColor" d="M12 4a1 1 0 0 1 1-1h0a1 1 0 1 1-2 0h0a1 1 0 0 1 1 1Zm0 17a1 1 0 1 1-2 0a1 1 0 0 1 2 0ZM4 13a1 1 0 1 1 0-2a1 1 0 0 1 0 2Zm17 0a1 1 0 1 1 0-2a1 1 0 0 1 0 2ZM6.2 6.2a1 1 0 1 1 1.4-1.4a1 1 0 0 1-1.4 1.4Zm10.2 13a1 1 0 1 1 1.4-1.4a1 1 0 0 1-1.4 1.4Zm0-14.4a1 1 0 1 1 1.4 1.4a1 1 0 0 1-1.4-1.4ZM6.2 18.2a1 1 0 1 1 1.4 1.4a1 1 0 0 1-1.4-1.4ZM12 7a5 5 0 1 1 0 10a5 5 0 0 1 0-10Z"/></svg>
            <svg id="moonIcon" viewBox="0 0 24 24" style="display:none;width:14px;height:14px"><path fill="currentColor" d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 1 0 21 12.79Z"/></svg>
          </div>
        </button>

        <input id="username" type="text" placeholder="Jouw naam…"/>
        <button id="saveName" class="btn btn-ghost">Opslaan</button>
        <button id="myListBtn" class="btn btn-primary">🧑‍💻 Mijn taken</button>
        <button id="statsBtn" class="btn btn-primary">📊 Statistieken</button>
        <button id="bulkModeBtn" class="btn btn-ghost" onclick="toggleBulkMode()">🔧 Bulk</button>
        

        <div class="notif-wrap">
          <button id="notifBtn" class="btn btn-bell" title="Meldingen">🔔</button>
          <span id="notifDot" class="notif-dot" style="display:none;"></span>
          <span id="notifCount" class="notif-count" style="display:none;">0</span>
        </div>
      </div>
    </header>

    <section class="card mb-4">
      <div class="flex flex-wrap items-center gap-2 w-full">
        <div class="pill">Status:
          <select id="statusFilter" class="ml-2">
            <option value="concept" selected>Concept</option>
            <option value="">Alle</option>
            <option value="ongoing">Ongoing</option>
            <option value="stuck">Stagnatie</option>
            <option value="m.approved">Valideren</option>
            <option value="approved">Approved</option>
            <option value="dup">Dubbel (2×)</option>
          </select>
        </div>
        <div class="pill">Sorteren:
          <select id="sortSelect" class="ml-2">
            <option value="az" selected>A tot Z</option>
            <option value="za">Z tot A</option>
            <option value="size_asc">Grootte laag → hoog</option>
            <option value="size_desc">Grootte hoog → laag</option>
            <option value="claims">Claims</option>
          </select>
        </div>
        <input id="search" type="text" placeholder="Zoek op naam…"/>
        <button id="refresh" class="btn btn-ghost">Vernieuwen</button>
        <span id="lastUpdated" class="text-xs" style="color:var(--muted); margin-left:auto">—</span>
      </div>
    </section>

    <section id="list" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"></section>
  </div>

  <!-- Progress Bar -->
  <div id="progressBar" class="progress-bar">
    <div id="progressFill" class="progress-fill"></div>
  </div>

  <!-- Bulk Controls -->
  <div id="bulkControls" class="bulk-controls">
    <div class="bulk-selection">
      <span id="selectedCount">0</span> geselecteerd
      <button class="btn btn-ghost" onclick="selectAll()" style="padding:4px 8px;font-size:12px">Alles</button>
      <button class="btn btn-ghost" onclick="deselectAll()" style="padding:4px 8px;font-size:12px">Niets</button>
    </div>
    <div class="bulk-actions">
      <button id="bulkClaimBtn" class="btn btn-primary" onclick="bulkClaim()" disabled>Claimen</button>
      <button id="bulkStuckBtn" class="btn btn-warn" onclick="bulkStuck()" disabled>Stagnatie</button>
      <button id="bulkValidateBtn" class="btn btn-ok" onclick="bulkValidate()" disabled>Valideren</button>
      <button id="bulkApproveBtn" class="btn btn-accent" onclick="bulkApprove()" disabled style="display:none">Approved</button>
      <button id="bulkDisapproveBtn" class="btn btn-warn" onclick="bulkDisapprove()" disabled style="display:none">Afkeur</button>
      <button class="btn btn-ghost" onclick="toggleBulkMode()">Sluiten</button>
    </div>
  </div>

  <!-- Sneltoetsen verwijderd -->

  <dialog id="introDialog" class="w-[50vw] max-w-3xl">
    <div class="relative w-full bg-[var(--card)] text-[var(--fg)] rounded-lg shadow-lg overflow-hidden">
      <div id="introPage" class="grid grid-cols-1 md:grid-cols-2 h-[70vh] overflow-hidden">
        <div class="order-1 md:order-2 h-1/2 md:h-full"><img id="introImg" class="w-full h-full rounded-lg object-contain" alt="" /></div>
        <div class="p-6 flex flex-col order-2 md:order-1 h-1/2 md:h-full">
          <h3 id="introTitle" class="text-xl font-bold mb-4"></h3>
          <div id="introText" class="text-base leading-relaxed space-y-2 flex-1 overflow-y-auto"></div>
        </div>
      </div>
      <div class="flex gap-2 absolute bottom-4 right-4">
        <button id="introPrev" class="btn btn-ghost">Vorige</button>
        <button id="introNext" class="btn btn-primary">Volgende</button>
        <button id="introClose" class="btn btn-warn">Sluiten</button>
      </div>
    </div>
  </dialog>

  <!-- Dialogs -->
  <dialog id="stuckDialog" class="w-full max-w-md">
    <form method="dialog" class="card">
      <h3 class="text-lg font-semibold mb-2">Markeer als Stagnatie</h3>
      <p class="text-sm" style="color:var(--muted)">Beschrijf kort wat er vastloopt (optioneel):</p>
      <textarea id="stuckNote" class="w-full h-24"></textarea>
      <div class="flex justify-end gap-2 mt-3">
        <button value="cancel" class="btn btn-ghost">Annuleren</button>
        <button id="confirmStuck" value="default" class="btn btn-primary">Opslaan</button>
      </div>
    </form>
  </dialog>

  <dialog id="disapproveDialog" class="w-full max-w-md">
    <form method="dialog" class="card">
      <h3 class="text-lg font-semibold mb-2">Afkeur (Valideren → Ongoing)</h3>
      <p class="text-sm" style="color:var(--muted)">Waarom afgekeurd? (korte opmerking):</p>
      <textarea id="disapproveNote" class="w-full h-24"></textarea>
      <div class="flex justify-end gap-2 mt-3">
        <button value="cancel" class="btn btn-ghost">Annuleren</button>
        <button id="confirmDisapprove" value="default" class="btn btn-warn">Afkeur</button>
      </div>
    </form>
  </dialog>

  <!-- Meldingen -->
  <dialog id="notifDialog" class="w-full max-w-lg">
    <form method="dialog" class="card">
      <h3 class="text-lg font-semibold mb-2">Meldingen</h3>
      <div id="notifList" class="space-y-2 max-h-96 overflow-auto text-sm"></div>
      <div class="flex justify-between mt-3">
        <button id="clearNotif" class="btn btn-ghost">Verwijder meldingen</button>
        <button class="btn btn-primary">Sluiten</button>
      </div>
    </form>
  </dialog>

  <!-- COMPACTE STATISTIEKEN DIALOG -->
  <!-- STATISTIEKEN DASHBOARD ZOALS AFBEELDING -->
  <dialog id="statsDialog" class="w-full max-w-7xl">
    <form method="dialog" class="card stats-compact">
      <h1 class="text-2xl font-bold mb-6" style="color: var(--foreground);">Statistieken Dashboard</h1>

      <!-- KPI CARDS GRID ZOALS IN AFBEELDING -->
      <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; margin-bottom: 24px;">
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
          <div style="font-size: 14px; color: var(--muted-foreground); margin-bottom: 8px;">Totaal bestanden</div>
          <div id="kpiTotal" style="font-size: 36px; font-weight: bold; color: var(--foreground);">2671</div>
        </div>
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
          <div style="font-size: 14px; color: var(--muted-foreground); margin-bottom: 8px;">% Approved</div>
          <div id="kpiPctApproved" style="font-size: 36px; font-weight: bold; color: var(--foreground);">85%</div>
          <div style="font-size: 12px; color: var(--muted-foreground);">Aantal: <span id="kpiApprovedCount">0</span></div>
        </div>
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
          <div style="font-size: 14px; color: var(--muted-foreground); margin-bottom: 8px;">Duplicaten</div>
          <div id="kpiDup" style="font-size: 36px; font-weight: bold; color: var(--foreground);">11</div>
        </div>
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
          <div style="font-size: 14px; color: var(--muted-foreground); margin-bottom: 8px;">Open taken</div>
          <div id="kpiOpen" style="font-size: 36px; font-weight: bold; color: var(--foreground);">11</div>
        </div>
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
          <div style="font-size: 14px; color: var(--muted-foreground); margin-bottom: 8px;">Concept afname</div>
          <div id="kpiConceptDelta" style="font-size: 36px; font-weight: bold; color: var(--foreground);">0</div>
          <div style="font-size: 12px; color: var(--muted-foreground);">Start: {{ initial_concept_count }}</div>
        </div>
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
          <div style="font-size: 14px; color: var(--muted-foreground); margin-bottom: 8px;">Concept afname/dag</div>
          <div id="kpiConceptDaily" style="font-size: 36px; font-weight: bold; color: var(--foreground);">0</div>
        </div>
      </div>

      <!-- CHARTS GRID - PIE + VALIDEREN TREND -->
      <div style="display: flex; justify-content: center; gap: 24px; margin-bottom: 24px;">
        <!-- Status Verdeling Pie Chart -->
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; max-width: 600px; width: 100%;">
          <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Status verdeling</h3>
          <div style="display: flex; gap: 20px; align-items: center; justify-content: center;">
            <canvas id="pieStatus" width="200" height="200"></canvas>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
              <div style="display: flex; align-items: center; gap: 8px; color: var(--brand);">
                <div style="width: 16px; height: 16px; background: var(--brand); border-radius: 2px;"></div>
                <span>Concept: <span id="conceptCount">384</span> (<span id="conceptPct">14%</span>)</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 16px; height: 16px; background: #fbbf24; border-radius: 2px;"></div>
                <span>Ongoing: <span id="ongoingCount">0</span> (<span id="ongoingPct">0%</span>)</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 16px; height: 16px; background: #10b981; border-radius: 2px;"></div>
                <span>Valideren: <span id="validateCount">27</span> (<span id="validatePct">1%</span>)</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 16px; height: 16px; background: #ef4444; border-radius: 2px;"></div>
                <span>Stagnatie: <span id="stuckLegendCount">0</span> (<span id="stuckPct">0%</span>)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Valideren Trend Bar Chart -->
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; max-width: 600px; width: 100%;">
          <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Valideren per week</h3>
          <canvas id="validateTrend" width="540" height="200"></canvas>
        </div>
      </div>

      <div class="flex justify-end mt-4">
        <button class="btn btn-primary">Sluiten</button>
      </div>
    </form>
  </dialog>

  <script>
    // =========== Backup popover ===========
    const backupBtn = document.getElementById('backupBtn');
    const backupPop = document.getElementById('backupPop');
    const backupWrap = document.getElementById('backupWrap');
    const passwordSection = document.getElementById('passwordSection');
    const backupPassword = document.getElementById('backupPassword');
    const backupsList = document.getElementById('backupsList');
    const backupsContent = document.getElementById('backupsContent');
    let isAuthenticated = false;

    function notifyBackup(title, message, isError = false) {
      let shouldAlert = isError;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        shouldAlert = true;
      }

      if (typeof showNotification === 'function') {
        try {
          showNotification(title, message);
        } catch (_) {
          shouldAlert = true;
        }
      }

      if (shouldAlert) {
        alert(`${isError ? '❌' : 'ℹ️'} ${message}`);
      }
    }

    async function createBackup(type = 'kort') {
      try {
        const res = await fetch('/api/create_backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password: 'Trescal',
            backup_type: type || 'kort'
          })
        });

        const data = await res.json().catch(() => ({ ok: false, error: 'Onbekend antwoord van server' }));

        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Backup aanmaken mislukt');
        }

        notifyBackup('Backup aangemaakt', data.message || 'Backup succesvol aangemaakt');

        // Toon direct de lijst zodat gebruiker kan zien dat de backup bestaat.
        await loadAndShowBackups(type);
      } catch (err) {
        notifyBackup('Backup mislukt', err.message || 'Onbekende fout', true);
      }
    }

    async function loadAndShowBackups(type = '') {
      if (!backupsList || !backupsContent) return;

      backupsList.style.display = 'block';
      backupsContent.innerHTML = '<div style="color: var(--muted); text-align: center;">Laden…</div>';

      try {
        const res = await fetch('/api/backups');
        const data = await res.json().catch(() => ({ ok: false, error: 'Onleesbaar serverantwoord' }));

        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Backups konden niet worden opgehaald');
        }

        let backups = Array.isArray(data.backups) ? data.backups.slice() : [];
        if (type) {
          backups = backups.filter(b => (b.type || '') === type);
        }

        if (!backups.length) {
          const msg = type
            ? 'Geen backups gevonden voor dit type.'
            : 'Geen backups gevonden.';
          backupsContent.innerHTML = `<div style="color: var(--muted); text-align: center;">${msg}</div>`;
          return;
        }

        const formatSize = (bytes) => {
          if (!bytes && bytes !== 0) return '';
          if (bytes < 1024) return `${bytes} B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        };

        backupsContent.innerHTML = backups.map(b => {
          const label = b.display_name || b.filename;
          const size = formatSize(b.size);
          const timestamp = b.timestamp ? new Date(b.timestamp).toLocaleString() : '';
          const meta = [timestamp, size, b.filename].filter(Boolean).join(' • ');
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 4px;border-bottom:1px solid var(--border);gap:8px;">
              <div style="flex:1 1 auto;min-width:0;">
                <div style="font-weight:600;font-size:12px;">${label}</div>
                <div style="font-size:10px;color:var(--muted);word-break:break-all;">${meta}</div>
              </div>
              <button class="btn btn-ghost" style="font-size:11px;padding:4px 6px;" onclick="window.restoreBackup('${b.filename}')">Herstel</button>
            </div>
          `;
        }).join('');
      } catch (err) {
        backupsContent.innerHTML = `<div style="color: var(--warn, #b91c1c); text-align: center;">${err.message || 'Kon backups niet laden.'}</div>`;
        notifyBackup('Backups laden mislukt', err.message || 'Onbekende fout', true);
      }
    }

    function updateBackupVisibility(){
      const n = (typeof getUserName === 'function') ? getUserName() : '';
      backupWrap.style.display = (n && n.toLowerCase() === 'willy') ? 'block' : 'none';
    }
    
    function closeBackup(){ 
      backupPop.style.display='none'; 
      passwordSection.style.display='none';
      backupPassword.value = '';
      isAuthenticated = false;
    }
    
    backupBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      backupPop.style.display = (backupPop.style.display==='block' ? 'none' : 'block');
    });
    document.addEventListener('click',(e)=>{ if(!backupWrap.contains(e.target)) closeBackup(); });
    document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeBackup(); });

    // Logo tooltip
    const logoWrap = document.getElementById('logoWrap');
    const titleTooltip = document.getElementById('titleTooltip');
    if(logoWrap && titleTooltip){
      logoWrap.addEventListener('mousemove', e=>{
        titleTooltip.style.display='block';
        const x = e.clientX;
        const y = e.clientY + 16;
        titleTooltip.style.left = x + 'px';
        titleTooltip.style.top  = y + 'px';
      });
      logoWrap.addEventListener('mouseleave', ()=>{ titleTooltip.style.display='none'; });
    }

    const downloadBtn = document.getElementById('downloadBtn');
    const downloadTip = document.getElementById('downloadTip');
    if(downloadBtn && downloadTip){
      downloadBtn.removeAttribute('title');
      downloadBtn.addEventListener('mouseenter', ()=>{ downloadTip.style.display='block'; });
      downloadBtn.addEventListener('mouseleave', ()=>{ downloadTip.style.display='none'; });
    }

    const downloadWrap = document.getElementById('downloadWrap');
    function hideDownload(){
      if(downloadWrap) downloadWrap.style.display = 'none';
    }
    if(/pywebview/i.test(navigator.userAgent) || window.pywebview){
      hideDownload();
    } else {
      window.addEventListener('pywebviewready', hideDownload);
    }

    // =========== Intro Popup ===========
    const INTRO_VERSION = '1';
    const introDialog = document.getElementById('introDialog');
    const introTitle = document.getElementById('introTitle');
    const introText = document.getElementById('introText');
    const introImg = document.getElementById('introImg');
    const introPrev = document.getElementById('introPrev');
    const introNext = document.getElementById('introNext');
    const introClose = document.getElementById('introClose');
    const introBtn = document.getElementById('introBtn');

    function storageGet(k){
      try{ return localStorage.getItem(k); }catch(e){
        const m=document.cookie.match(new RegExp('(?:^|; )'+k+'=([^;]*)'));
        return m?decodeURIComponent(m[1]):null;
      }
    }
    function storageSet(k,v){
      try{ localStorage.setItem(k,v); }catch(e){
        document.cookie=k+'='+encodeURIComponent(v)+'; Max-Age=31536000; path=/';
      }
    }

    if(storageGet('docflow_intro_version') !== INTRO_VERSION){
      storageSet('docflow_intro_version', INTRO_VERSION);
      storageSet('docflow_intro_dismissed', 'false');
      storageSet('docflow_intro_page', '0');
    }

    const pages=[
    {
      title:'Welkom bij DocFlow!',
      htmlText:`DocFlow helpt je documenten van Concept → Approved snel, duidelijk en foutvrij te laten stromen.<br><br>Je ziet in één oogopslag waar elk bestand staat, wie eraan werkt en wat de volgende stap is.<br><br>Met slimme filters, bulkacties en meldingen werk je sneller en consistenter, zonder zoeken in mappen.<br><br>Klaar met valideren? Met één klik verplaats je het document naar Approved — inclusief automatische historie.`,
      imageName:'welcome.png',
      imageFit:'contain'
    },
    {
      title:'Autonoom werken, maximale flow',
      htmlText:`In DocFlow neem je zelf de regie: claim een document, los blokkades op of markeer het als <em>Stuck</em> met een korte notitie.<br><br>Door de eenvoudige stappen en duidelijke statuskleuren kan iedereen autonoom doorwerken zonder micromanagement.<br><br>Resultaat: minder wachttijd, minder handovers, meer focus op kwaliteit.<br><br>Deze manier van werken is innovatief maar simpel: jij beslist de volgende actie, DocFlow borgt het proces.`,
      imageName:'autonomy.png',
      imageFit:'contain'
    },
    {
      title:'Het proces',
      htmlText:`Documenten starten in de Concept-map en zijn klaar om gevalideerd te worden.<br><br>Je kunt ze claimen, waarna ze in mijn taken verschijnen en zichtbaar is dat jij ermee bezig bent.<br><br>Loop je vast, zet de status op Stagnatie met een korte toelichting zodat anderen kunnen helpen.<br><br>Is het document goed, klik op Valideren. De verantwoordelijken doen een steekproef en plaatsen het vervolgens definitief in de Approved-map.<br><br>…en dat is het hele proces!`,
      imageName:'process.png',
      imageFit:'contain'
    }
  ];

  let currentPage=parseInt(storageGet('docflow_intro_page')||'0',10);
  function renderPage(i){
    currentPage=i;
    storageSet('docflow_intro_page', String(i));
    const p=pages[i];
    introTitle.innerHTML=p.title;
    introText.innerHTML=p.htmlText;
    introImg.src='/intro-image/'+p.imageName;
    introImg.style.objectFit=p.imageFit||'contain';
    introImg.style.objectPosition='center';
    introImg.style.maxWidth='100%';
    introImg.style.maxHeight='100%';
    introPrev.style.display = i===0 ? 'none' : 'inline-flex';
    introNext.style.display = i===pages.length-1 ? 'none' : 'inline-flex';
    introClose.style.display = 'inline-flex';
    if(i===pages.length-1){
      introClose.focus();
    }else{
      introNext.focus();
    }
  }

  let lastFocus=null;

  function openIntro(forceFirst=false){
    storageSet('docflow_intro_dismissed','false');
    if(forceFirst){ currentPage=0; }
    renderPage(currentPage);
    lastFocus=document.activeElement;
    introDialog.showModal();
    document.addEventListener('keydown',keyHandler);
  }
  function closeIntro(){
    storageSet('docflow_intro_dismissed','true');
    introDialog.close();
    document.removeEventListener('keydown',keyHandler);
    if(lastFocus) lastFocus.focus();
  }
  function next(){
    if(currentPage<pages.length-1) renderPage(currentPage+1); else closeIntro();
  }
  function prev(){
    if(currentPage>0) renderPage(currentPage-1);
  }
  function keyHandler(e){
    if(e.key==='Escape'){ e.preventDefault(); closeIntro(); }
    if(e.key==='ArrowRight'){ e.preventDefault(); next(); }
    if(e.key==='ArrowLeft'){ e.preventDefault(); prev(); }
  }
  introPrev.addEventListener('click',prev);
  introNext.addEventListener('click',next);
  introClose.addEventListener('click',closeIntro);
  if(introBtn){ introBtn.addEventListener('click',()=>openIntro(true)); }

  if(storageGet('docflow_intro_dismissed')!=='true'){
    openIntro();
  }

    // Password verification
    document.getElementById('verifyPasswordBtn').onclick = () => {
      if (backupPassword.value === 'Trescal') {
        isAuthenticated = true;
        passwordSection.style.display = 'none';
        showNotification('✅ Geautoriseerd voor backup acties', 'success');
      } else {
        showNotification('❌ Onjuist wachtwoord', 'error');
      }
    };
    
    document.getElementById('cancelPasswordBtn').onclick = () => {
      passwordSection.style.display = 'none';
      backupPassword.value = '';
    };

    // Backup action buttons
    document.querySelectorAll('.backup-action-btn').forEach(btn => {
      btn.onclick = (e) => {
        if (!isAuthenticated) {
          passwordSection.style.display = 'block';
          backupPassword.focus();
          return;
        }
        
        const type = e.target.dataset.type;
        const action = e.target.dataset.action;
        
        if (action === 'create') {
          createBackup(type);
        } else if (action === 'restore') {
          loadAndShowBackups(type);
        }
      };
    });

    // =========== Theme (dark / light) ===========
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');
    function applyTheme(t){
      const root=document.documentElement;
      const knob = document.getElementById('themeToggle');
      if(t==='dark'){ root.classList.add('dark'); knob.classList.add('dark'); sunIcon.style.display='none'; moonIcon.style.display='block'; }
      else { root.classList.remove('dark'); knob.classList.remove('dark'); sunIcon.style.display='block'; moonIcon.style.display='none'; }
    }
    function getTheme(){ return localStorage.getItem('docflow_theme') || 'light'; }
    function setTheme(t){ localStorage.setItem('docflow_theme', t); applyTheme(t); }
    applyTheme(getTheme());
    themeToggle.addEventListener('click', ()=>{ setTheme(getTheme()==='dark' ? 'light' : 'dark'); });

    // =========== Naam / Notifs / List ===========
    const nameInput = document.getElementById('username');
    const saveNameBtn = document.getElementById('saveName');
    const myListBtn = document.getElementById('myListBtn');
    const statsBtn = document.getElementById('statsBtn');
    const notifBtn = document.getElementById('notifBtn');
    const notifList = document.getElementById('notifList');
    const clearNotifBtn = document.getElementById('clearNotif');

    const statusFilter = document.getElementById('statusFilter');
    const sortSelect = document.getElementById('sortSelect');
    const searchInput = document.getElementById('search');
    const refreshBtn = document.getElementById('refresh');
    const listEl = document.getElementById('list');
    const lastUpdated = document.getElementById('lastUpdated');

    function getUserName(){ return localStorage.getItem('docflow_user') || ''; }
    function setUserName(v){ localStorage.setItem('docflow_user', v); }
    nameInput.value = getUserName();
    updateBackupVisibility();
    saveNameBtn.onclick = () => { setUserName(nameInput.value.trim()); alert('Naam opgeslagen.'); pollNotifications(true); updateBackupVisibility(); };

    // icons + links
    function svgExcel(){return `<svg class="svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" fill="#185C37"></rect><rect x="7" y="4" width="10" height="16" rx="1" fill="#21A366"></rect><rect x="9" y="6" width="6" height="12" rx="0.5" fill="#107C41"></rect><rect x="3.5" y="3.5" width="9" height="17" rx="1.5" fill="#33C481" opacity=".9"></rect><path d="M11 9 L8.8 9 L7.7 10.9 L6.6 9 L4.5 9 L6.8 12 L4.5 15 L6.6 15 L7.7 13.1 L8.8 15 L11 15 L8.7 12 L11 9Z" fill="white"/></svg>`;}
    function svgWord(){return `<svg class="svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" fill="#1E3A8A"></rect><rect x="7" y="4" width="10" height="16" rx="1" fill="#3B82F6"></rect><path d="M5.5 8h3l1 5 1-3 1 3 1-5h3l-2.5 8h-3l-1-3-1 3h-3L5.5 8z" fill="white"/></svg>`;}
    function svgPdf(){return `<svg class="svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" fill="#B91C1C"></rect><path d="M7 8h5a2 2 0 0 1 0 4H9v4H7V8zm7 0h4v2h-2v2h2v2h-4V8z" fill="white"/></svg>`;}
    function svgDoc(){return `<svg class="svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="14" height="18" rx="2" fill="#6B7280"></rect><rect x="7" y="7" width="8" height="1.8" fill="white"/><rect x="7" y="10" width="8" height="1.8" fill="white"/><rect x="7" y="13" width="6" height="1.8" fill="white"/></svg>`;}
    function iconFor(n){ n=(n||'').toLowerCase(); if(n.endsWith('.xlsx')||n.endsWith('.xls')) return svgExcel(); if(n.endsWith('.docx')||n.endsWith('.doc')) return svgWord(); if(n.endsWith('.pdf')) return svgPdf(); return svgDoc(); }
    function fileHrefFromUNC(unc){ const p=unc.replace(/\\/g,'/').replace(/^\/\//,'/////'); return 'file:'+p; }
    function excelHrefFromUNC(unc){ return `ms-excel:ofe|u|${unc}`; }
    function linkFor(doc){ const n=(doc.name||'').toLowerCase(); return (n.endsWith('.xlsx')||n.endsWith('.xls'))?excelHrefFromUNC(doc.path):fileHrefFromUNC(doc.path); }

    // VERBETERDE ERROR HANDLING - onderdruk file access errors
    function showOpenHint(cardId, unc){
      const el=document.getElementById(cardId); if(!el) return;
      const hint=el.querySelector('.hint'); if(hint){
        // Geen storende error meer - alleen een rustige hint
        hint.innerHTML=`<small style="color:var(--muted)">Tip: Als het bestand niet opent, <button class="btn btn-ghost" style="padding:2px 6px;font-size:11px" onclick="navigator.clipboard.writeText('${unc.replace(/\\/g,'\\\\')}')">kopieer dan het pad</button></small>`;
        hint.classList.add('show');
        // Auto-verbergen na 3 seconden
        setTimeout(() => {
          hint.innerHTML = '';
          hint.classList.remove('show');
        }, 3000);
      }
    }

    let currentListMode='all', pendingStuckPath=null, pendingDisapprovePath=null, lastCount=0;

    function showLoadingPlaceholders(){
      listEl.innerHTML = Array.from({length:3}).map(()=>`
        <article class="card doc-card">
          <div class="doc-top">
            <div class="namewrap">
              <div class="iconbtn shimmer"></div>
              <div class="shimmer" style="width:150px;height:16px;border-radius:4px;"></div>
            </div>
            <div class="shimmer" style="width:60px;height:16px;border-radius:4px;"></div>
          </div>
          <div class="shimmer" style="width:80%;height:14px;margin-top:12px;border-radius:4px;"></div>
          <div class="actions" style="margin-top:auto;display:flex;gap:8px;">
            <div class="shimmer" style="width:80px;height:28px;border-radius:8px;"></div>
            <div class="shimmer" style="width:80px;height:28px;border-radius:8px;"></div>
          </div>
        </article>`).join('');
    }

    async function loadDocs(showLoading=false){
      if(showLoading) showLoadingPlaceholders();
      const params=new URLSearchParams(); const sort=sortSelect.value||'az';
      if(currentListMode==='all'){
        if(statusFilter.value) params.set('status', statusFilter.value);
        if(searchInput.value) params.set('q', searchInput.value);
        params.set('user', getUserName()); params.set('sort', sort);
        const res=await fetch('/api/docs?'+params.toString()); const data=await res.json();
        renderList(data.items||[]); lastCount=(data&&data.count)||(data.items||[]).length||0;
      }else{
        params.set('user', getUserName()); if(searchInput.value) params.set('q', searchInput.value);
        params.set('sort', sort);
        const res=await fetch('/api/mylist?'+params.toString()); const data=await res.json();
        renderList(data.items||[]); lastCount=(data&&data.count)||(data.items||[]).length||0;
      }
      lastUpdated.textContent='Bijgewerkt: '+new Date().toLocaleTimeString()+' — '+lastCount+' bestanden';
    }

    function statusBadge(s){
      const cls={concept:'status-concept',ongoing:'status-ongoing',stuck:'status-stuck','m.approved':'status-mapproved',approved:'status-approved'}[s]||'status-concept';
      const lab={concept:'Concept',ongoing:'Ongoing',stuck:'Stagnatie','m.approved':'Valideren',approved:'Approved'}[s]||s;
      return `<span class="badge ${cls}">${lab}</span>`;
    }
    function dupBadge(dup){ return dup?`<span class="badge status-dup" title="Dezelfde bestandsnaam in Concept én Approved">2×</span>`:''; }

    function avatarFor(name, path){
      if(!name) return '';
      const me=getUserName(); const isMe=me && name.toLowerCase()==me.toLowerCase();
      const x=isMe?`<button class="btn btn-ghost" style="padding:2px 6px;border-radius:999px" title="Verwijder" onclick="unassignDoc('${encodeURIComponent(path)}');event.stopPropagation();">×</button>`:'';
      return `<span class="badge" style="background:rgba(148,163,184,.15);border:1px solid var(--border);color:var(--fg)">${name}${x}</span>`;
    }

    function renderList(items){
      if(!Array.isArray(items)) items=[];
      listEl.innerHTML = items.map((doc,idx)=>{
        const cardId='card_'+idx;
        const assignees=(doc.assignees||[]).map(n=>avatarFor(n,doc.path)).join(' ');
        const href=linkFor(doc);
        const sizeTxt = (typeof doc.size==='number' && doc.size>=0) ? `<div class="doc-size">${(doc.size/1024).toFixed(1)} KB</div>` : '';

        // acties
        let actions = `
          <button class="btn btn-primary btn-action" onclick="startDoc('${encodeURIComponent(doc.path)}')">Claimen</button>
          <button class="btn btn-warn btn-action" onclick="openStuck('${encodeURIComponent(doc.path)}')">Stagnatie</button>
          <button class="btn btn-ok btn-action" onclick="markMApproved('${encodeURIComponent(doc.path)}')">Valideren</button>`;
        if(doc.status==='m.approved'){
          actions = `
            <button class="btn btn-accent btn-action" onclick="finalizeApprove('${encodeURIComponent(doc.path)}')">Naar Approved</button>
            <button class="btn btn-warn btn-action" onclick="openDisapprove('${encodeURIComponent(doc.path)}')">Afkeur</button>`;
        }

        const noteHtml = doc.notes ? `<div class="note-area">${doc.notes}</div>` : `<div class="note-area">&nbsp;</div>`;

        return `
        <article class="card doc-card" id="${cardId}" data-path="${encodeURIComponent(doc.path)}" data-status="${doc.status}">
          <div class="doc-top">
            <div class="namewrap">
              <a class="iconbtn" href="${href}" target="_blank" rel="noopener" onclick="setTimeout(()=>showOpenHint('${cardId}','${doc.path.replace(/\\/g,'\\\\')}'),200)">${iconFor(doc.name)}</a>
              <div>
                <div class="doc-title">${doc.name}</div>
                ${sizeTxt}
              </div>
            </div>
            <div class="flex items-center gap-2">${statusBadge(doc.status)} ${dupBadge(doc.dup_concept_approved)}</div>
          </div>

          ${noteHtml}

          <div class="mt-2 flex items-center gap-2 flex-wrap">${assignees}</div>

          <div class="actions">${actions}</div>

          <div class="hint" style="margin-top:6px;"></div>
        </article>`;
      }).join('');
      
      // Re-add checkboxes if bulk mode is active
      if (bulkMode) {
        addSelectionCheckboxes();
      }
    }

    // ===== NIEUWE FEATURES: BULK OPERATIONS =====
    let selectedDocs = new Set();
    let bulkMode = false;

    function toggleBulkMode() {
      bulkMode = !bulkMode;
      document.body.classList.toggle('bulk-mode', bulkMode);
      const bulkControls = document.getElementById('bulkControls');
      if (bulkMode) {
        bulkControls.classList.add('show');
        addSelectionCheckboxes();
      } else {
        bulkControls.classList.remove('show');
        selectedDocs.clear();
        removeSelectionCheckboxes();
      }
      updateBulkSelection();
    }

    function addSelectionCheckboxes() {
      document.querySelectorAll('.doc-card').forEach((card, idx) => {
        if (!card.querySelector('.select-checkbox')) {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'select-checkbox';
          checkbox.addEventListener('change', (e) => {
            const path = decodeURIComponent(card.dataset.path);
            if (e.target.checked) {
              selectedDocs.add(path);
              card.classList.add('selected');
            } else {
              selectedDocs.delete(path);
              card.classList.remove('selected');
            }
            updateBulkSelection();
          });
          card.style.position = 'relative';
          card.appendChild(checkbox);
        }
      });
    }

    function removeSelectionCheckboxes() {
      document.querySelectorAll('.select-checkbox').forEach(cb => cb.remove());
      document.querySelectorAll('.doc-card').forEach(card => {
        card.classList.remove('selected');
        card.style.position = '';
      });
    }

    function updateBulkSelection() {
      const count = selectedDocs.size;
      document.getElementById('selectedCount').textContent = count;
      document.getElementById('bulkClaimBtn').disabled = count === 0;
      document.getElementById('bulkStuckBtn').disabled = count === 0;
      document.getElementById('bulkValidateBtn').disabled = count === 0;
      
      // Check if any selected docs are in m.approved status
      const hasMapproved = Array.from(selectedDocs).some(path => {
        const card = document.querySelector(`[data-path="${encodeURIComponent(path)}"]`);
        return card && card.dataset.status === 'm.approved';
      });
      
      document.getElementById('bulkApproveBtn').style.display = hasMapproved ? 'inline-block' : 'none';
      document.getElementById('bulkDisapproveBtn').style.display = hasMapproved ? 'inline-block' : 'none';
      document.getElementById('bulkApproveBtn').disabled = count === 0 || !hasMapproved;
      document.getElementById('bulkDisapproveBtn').disabled = count === 0 || !hasMapproved;
    }

    function selectAll() {
      document.querySelectorAll('.select-checkbox').forEach(cb => {
        cb.checked = true;
        cb.dispatchEvent(new Event('change'));
      });
    }

    function deselectAll() {
      document.querySelectorAll('.select-checkbox').forEach(cb => {
        cb.checked = false;
        cb.dispatchEvent(new Event('change'));
      });
    }

    async function bulkClaim() {
      await bulkOperation('/api/start', 'Bulk claimen');
    }

    async function bulkStuck() {
      const note = prompt('Optionele opmerking voor stagnatie:') || '';
      await bulkOperation('/api/stuck', 'Bulk stagnatie', { note });
    }

    async function bulkValidate() {
      await bulkOperation('/api/mark_mapproved', 'Bulk valideren');
    }

    async function bulkApprove() {
      if (!confirm('Geselecteerde documenten naar Approved verplaatsen?')) return;
      await bulkOperation('/api/finalize_approve', 'Bulk approved');
    }

    async function bulkDisapprove() {
      const note = prompt('Reden voor afkeuring:') || '';
      await bulkOperation('/api/disapprove', 'Bulk afkeur', { note });
    }

    async function bulkOperation(endpoint, operationName, extraData = {}) {
      const user = getUserName();
      if (!user) {
        alert('Vul eerst je naam in.');
        return;
      }
      
      if (selectedDocs.size === 0) return;
      
      const paths = Array.from(selectedDocs);
      showProgress(true);
      
      let successCount = 0;
      let errors = [];
      
      try {
        for (const path of paths) {
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path, user, ...extraData })
            });
            
            if (response.ok) {
              successCount++;
            } else {
              const error = await response.json();
              errors.push(`${path}: ${error.error || 'Onbekende fout'}`);
            }
          } catch (error) {
            errors.push(`${path}: ${error.message}`);
          }
        }
        
        let message = `${operationName} voltooid:\\n✓ ${successCount} documenten verwerkt`;
        if (errors.length > 0) {
          message += `\\n⚠ ${errors.length} fouten:\\n${errors.slice(0, 5).join('\\n')}`;
          if (errors.length > 5) message += `\\n... en ${errors.length - 5} meer`;
        }
        alert(message);
        
        loadDocs();
        toggleBulkMode();
      } catch (error) {
        alert(`Fout bij ${operationName}: ${error.message}`);
      } finally {
        showProgress(false);
      }
    }

    // ===== PROGRESS BAR =====
    function showProgress(show, percent = 0) {
      const progressBar = document.getElementById('progressBar');
      const progressFill = document.getElementById('progressFill');
      
      if (show) {
        progressBar.classList.add('active');
        progressFill.style.width = percent + '%';
      } else {
        progressBar.classList.remove('active');
        setTimeout(() => {
          progressFill.style.width = '0%';
        }, 300);
      }
    }

    // ===== KEYBOARD SHORTCUTS =====
    let shortcutsVisible = false;
    
    function toggleShortcutsHelp() {
      shortcutsVisible = !shortcutsVisible;
      const help = document.getElementById('shortcutsHelp');
      help.classList.toggle('show', shortcutsVisible);
    }

    document.addEventListener('keydown', (e) => {
      // Ignore if typing in input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      switch(e.key.toLowerCase()) {
        case 'r':
          if (!e.ctrlKey) {
            e.preventDefault();
            loadDocs();
          }
          break;
        case 'b':
          e.preventDefault();
          toggleBulkMode();
          break;
        case 's':
          if (!e.ctrlKey) {
            e.preventDefault();
            document.getElementById('statsBtn').click();
          }
          break;
        case 'n':
          e.preventDefault();
          document.getElementById('notifBtn').click();
          break;
        case 'm':
          e.preventDefault();
          document.getElementById('myListBtn').click();
          break;
        case 'escape':
          if (bulkMode) {
            toggleBulkMode();
          }
          break;
        case '?':
          e.preventDefault();
          toggleShortcutsHelp();
          break;
        case 'a':
          if (e.ctrlKey && bulkMode) {
            e.preventDefault();
            selectAll();
          }
          break;
      }
    });

    // ===== BROWSER NOTIFICATIONS =====
    let notificationPermission = 'default';
    
    async function requestNotificationPermission() {
      if ('Notification' in window) {
        notificationPermission = await Notification.requestPermission();
        if (notificationPermission === 'granted') {
          subscribeToNotifications();
        }
      }
    }
    
    function subscribeToNotifications() {
      // In a real app, you would register a service worker here
      // For now, just store the preference
      localStorage.setItem('docflow_notifications_enabled', 'true');
    }
    
    function showNotification(title, body) {
      if (notificationPermission === 'granted' && 
          localStorage.getItem('docflow_notifications_enabled') === 'true') {
        new Notification(title, { 
          body, 
          icon: '/favicon.ico',
          badge: '/favicon.ico'
        });
      }
    }

    // Export function removed as requested

    // Actions
    async function startDoc(p){ const user=getUserName(); if(!user){ alert('Vul eerst je naam in.'); return;} const path=decodeURIComponent(p); const r=await fetch('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,user})}); if(!r.ok){ const e=await r.json(); alert(e.error||'Fout'); return;} loadDocs(); }
    function openStuck(p){ const user=getUserName(); if(!user){ alert('Vul eerst je naam in.'); return;} pendingStuckPath=decodeURIComponent(p); document.getElementById('stuckDialog').showModal(); }
    document.getElementById('confirmStuck').onclick = async (e)=>{ e.preventDefault(); const user=getUserName(); const note=document.getElementById('stuckNote').value; if(!pendingStuckPath) return; await fetch('/api/stuck',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:pendingStuckPath,user,note})}); pendingStuckPath=null; document.getElementById('stuckNote').value=''; document.getElementById('stuckDialog').close(); loadDocs(); };
    function openDisapprove(p){ const user=getUserName(); if(!user){ alert('Vul eerst je naam in.'); return;} pendingDisapprovePath=decodeURIComponent(p); document.getElementById('disapproveDialog').showModal(); }
    document.getElementById('confirmDisapprove').onclick = async (e)=>{ e.preventDefault(); const user=getUserName(); const note=document.getElementById('disapproveNote').value; if(!pendingDisapprovePath) return; const r=await fetch('/api/disapprove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:pendingDisapprovePath,user,note})}); const d=await r.json().catch(()=>({})); if(!r.ok||!(d&&d.ok)){ alert((d&&d.error)||'Fout'); return;} pendingDisapprovePath=null; document.getElementById('disapproveNote').value=''; document.getElementById('disapproveDialog').close(); loadDocs(); };
    async function markMApproved(p){ const user=getUserName(); if(!user){ alert('Vul eerst je naam in.'); return;} const path=decodeURIComponent(p); const r=await fetch('/api/mark_mapproved',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,user})}); if(!r.ok){ const e=await r.json().catch(()=>({})); alert((e&&e.error)||'Fout'); return;} loadDocs(); }
    async function finalizeApprove(p){
      const user = getUserName(); 
      if(!user){ alert('Vul eerst je naam in.'); return; }

      const path = decodeURIComponent(p);

      // In de viewer: client-side move
      if (window.pywebview?.api?.move_to_approved) {
        if (!confirm('Verplaatsen naar Approved-map en afronden?')) return;
        const res = await pywebview.api.move_to_approved(path);
        if (!res?.ok) { 
          alert(res?.error || 'Kon niet verplaatsen'); 
          return; 
        }
        // Scanner detecteert het bestand in Approved binnen ~20s
        loadDocs();
        return;
      }

      // In de browser: bestaande server-call
      const r = await fetch('/api/finalize_approve', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ path, user })
      });
      const d = await r.json().catch(()=>({}));
      if (!r.ok || !d.ok) { 
        alert(d.error || 'Fout bij verplaatsen'); 
        return; 
      }
      loadDocs();
    }
    async function unassignDoc(p){ const user=getUserName(); if(!user){ alert('Vul eerst je naam in.'); return;} if(!confirm('Zeker dat je jezelf wilt verwijderen?')) return; const path=decodeURIComponent(p); const r=await fetch('/api/unassign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,user})}); if(!r.ok){ const e=await r.json().catch(()=>({})); alert((e&&e.error)||'Fout'); return;} loadDocs(); } window.unassignDoc=unassignDoc;

    refreshBtn.onclick = () => loadDocs(true);

    function setStatusDisabled(disabled){ statusFilter.disabled=disabled; statusFilter.classList.toggle('opacity-50', disabled); }
    statusFilter.onchange=()=>{ currentListMode='all'; loadDocs(true); };
    sortSelect.onchange=()=>{ loadDocs(true); };

    // Debounce zoekinput
    let searchTimer=null;
    searchInput.oninput=()=>{ clearTimeout(searchTimer); searchTimer=setTimeout(()=>loadDocs(true), 250); };

    myListBtn.onclick=()=>{ currentListMode = (currentListMode==='all'?'mine':'all'); myListBtn.textContent=(currentListMode==='all'?'🧑‍💻 Mijn taken':'📄 Alles'); setStatusDisabled(currentListMode==='mine'); loadDocs(true); };

    // ===== Meldingen =====
    function notifSince(){ // pak de laatste 'cleared' of 'seen'
      const cleared = localStorage.getItem('docflow_notif_cleared');
      const seen    = localStorage.getItem('docflow_notif_seen');
      return cleared || seen || new Date(Date.now()-7*24*3600*1000).toISOString();
    }
    document.getElementById('notifBtn').onclick = async ()=>{
      const user=getUserName(); if(!user){ alert('Vul eerst je naam.'); return; }
      const res=await fetch(`/api/changes?user=${encodeURIComponent(user)}&since=${encodeURIComponent(notifSince())}&limit=200`);
      const data=await res.json().catch(()=>({items:[]}));
      renderNotif(data.items||[]); localStorage.setItem('docflow_notif_seen', new Date().toISOString());
      setNotifIndicator(0); document.getElementById('notifDialog').showModal();
    };
    clearNotifBtn.onclick = async (e)=>{
      e.preventDefault();
      const user = getUserName();
      if (!user) { alert('Vul eerst je naam in.'); return; }
      
      // Server-side dismissal
      try {
        const res = await fetch('/api/notifications/dismiss', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ user })
        });
        if (!res.ok) {
          console.error('Failed to dismiss notifications on server');
        }
      } catch (err) {
        console.error('Error dismissing notifications:', err);
      }
      
      // Local dismissal (fallback)
      localStorage.setItem('docflow_notif_cleared', new Date().toISOString());
      notifList.innerHTML = '<div class="text-sm" style="color:var(--muted)">Alle meldingen verwijderd.</div>';
      setNotifIndicator(0);
    };

    function tsLocal(ts){ try{ return new Date(ts).toLocaleString(); } catch(e){ return ts||''; } }
    function labelFor(ev){
      const e=ev.event; const by=ev.by?` door ${ev.by}`:'';
      if(e==='start') return `Geclaimd${by}`;
      if(e==='stuck') return `Stagnatie${by}${ev.note?` — ${ev.note}`:''}`;
      if(e==='mark_mapproved') return `Gemarkeerd voor valideren${by}`;
      if(e==='disapprove') return `Afgekeurd${by}${ev.note?` — ${ev.note}`:''}`;
      if(e==='finalize_approve_move') return `Verplaatst naar Approved${by}`;
      if(e==='returned_to_concept') return `Terug naar Concept (detectie)`;
      if(e==='move_to_approved_detected') return `In Approved gedetecteerd`;
      if(e==='auto_back_to_concept_no_assignees') return `Automatisch terug naar Concept (niemand toegewezen)`;
      if(e==='unassign') return `Assignee verwijderd${by}`;
      if(e==='indexed') return `Nieuw gedetecteerd (${ev.where})`;
      if(e==='bulk_assign') return `Bulk toegewezen${by}`;
      return e;
    }
    function renderNotif(items){
      notifList.innerHTML = items.map(it => `
        <div class="flex items-start gap-2">
          <div class="w-28 text-xs" style="color:var(--muted)">${tsLocal(it.ts)}</div>
          <div style="color:var(--fg)"><div class="font-medium">${it.doc_name || '(zonder naam)'}</div><div>${labelFor(it)}</div></div>
        </div><hr style="border-color:var(--border)"/>`).join('');
    }
    function setNotifIndicator(n){
      const dot=document.getElementById('notifDot'); const count=document.getElementById('notifCount');
      if(n>0){ dot.style.display='block'; count.style.display='block'; count.textContent = n>99?'99+':String(n); }
      else { dot.style.display='none'; count.style.display='none'; }
    }
    async function pollNotifications(){
      const user=getUserName(); if(!user){ setNotifIndicator(0); return; }
      const since=notifSince();
      const res=await fetch(`/api/changes?user=${encodeURIComponent(user)}&since=${encodeURIComponent(since)}&limit=5`);
      const data=await res.json().catch(()=>({count:0})); setNotifIndicator(data.count||0);
    }

    // ===== COMPACTE STATISTIEKEN =====
    const statsDialog = document.getElementById('statsDialog');
    if(statsDialog) statsDialog.addEventListener('close', ()=> document.body.classList.remove('modal-open'));
    statsBtn.onclick = async ()=>{
      const res = await fetch('/api/docs'); const data = await res.json().catch(()=>({items:[]}));
      const items = (data.items || []).filter(d=>!d.ignored);

      const counts = {concept:0, ongoing:0, stuck:0, 'm.approved':0, approved:0};
      let total=0, dupCount=0, openCount=0;

      // Helper functies voor werkdag-berekeningen
      function addBusinessDays(date, days){
        const result = new Date(date);
        let remaining = Math.abs(days);
        const step = days >= 0 ? 1 : -1;
        while(remaining > 0){
          result.setDate(result.getDate() + step);
          const day = result.getDay();
          if(day !== 0 && day !== 6) remaining--;
        }
        return result;
      }
      function businessDaysBetween(start, end){
        let count = 0;
        const cur = new Date(start);
        while(cur < end){
          const day = cur.getDay();
          if(day !== 0 && day !== 6) count++;
          cur.setDate(cur.getDate() + 1);
        }
        return count;
      }
      function formatDM(dt){
        const m = (dt.getMonth()+1).toString().padStart(2,'0');
        const d = dt.getDate().toString().padStart(2,'0');
        return `${d}/${m}`;
      }
      function getWeekNumber(dt){
        const temp = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
        const dayNum = temp.getUTCDay() || 7;
        temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(temp.getUTCFullYear(),0,1));
        return Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
      }

      // Dynamische 11-weekse valideren-venster vanaf week 35
      function weeksInYear(year){
        const d=new Date(year,11,31);
        const w=getWeekNumber(d);
        return w===1?52:w;
      }
      function getMondayOfISOWeek(week, year){
        const simple=new Date(year,0,1+(week-1)*7);
        const dow=simple.getDay();
        const diff=dow<=4?1-dow:8-dow;
        simple.setDate(simple.getDate()+diff);
        return simple;
      }
      const current=new Date();
      const currentWeek=getWeekNumber(current);
      const currentYear=current.getFullYear();
      let startWeek=35; let startYear=currentYear;
      if(currentWeek>=50 || currentWeek<=3){
        startWeek=45;
        if(currentWeek<=3) startYear=currentYear-1;
      } else if(currentWeek>=45){
        startWeek=40;
      }

      const weeks=[];
      let w=startWeek; let y=startYear;
      for(let i=0;i<11;i++){
        const maxW=weeksInYear(y);
        if(w>maxW){ w=1; y++; }
        const s=getMondayOfISOWeek(w,y);
        const e=addBusinessDays(s,4);
        weeks.push({start:new Date(s), end:new Date(e), weekNo:w});
        w++;
      }

      const valBuckets=[];
      for(const w of weeks){
        valBuckets.push({weekNo:w.weekNo, start:w.start, end:w.end, endExclusive:addBusinessDays(w.end,1), count:0, people:{}});
      }

      for(const d of items){
        if(d.status in counts) counts[d.status]++; total++;
        if(d.dup_concept_approved) dupCount++;
        if(d.status==='ongoing' || d.status==='m.approved' || d.status==='stuck') openCount++;

        const hist = d.history || [];
        let valEv=null;
        for(const ev of hist){ if(!valEv && ev.event==='mark_mapproved') valEv = ev; }
        if(valEv){
          const tVal = new Date(valEv.ts);
          const by = valEv.by || 'Onbekend';
          for(const b of valBuckets){
            if(tVal>=b.start && tVal<b.endExclusive){
              b.count++;
              b.people[by] = (b.people[by]||0) + 1;
              break;
            }
          }
        }
      }

      const pctApproved = total? Math.round((counts.approved/total)*100)      : 0;
      const nonApprovedTotal = total - counts.approved;
      const pctConcept  = nonApprovedTotal? Math.round((counts.concept / nonApprovedTotal) * 100)       : 0;
      const pctOngoing  = nonApprovedTotal? Math.round((counts.ongoing / nonApprovedTotal) * 100)       : 0;
      const pctValidate = nonApprovedTotal? Math.round((counts['m.approved'] / nonApprovedTotal) * 100) : 0;
      const pctStuck    = nonApprovedTotal? Math.round((counts.stuck / nonApprovedTotal) * 100)         : 0;

      // KPI's
      document.getElementById('kpiTotal').textContent = String(total);
      document.getElementById('kpiPctApproved').textContent = pctApproved + '%';
      document.getElementById('kpiApprovedCount').textContent = String(counts.approved);
      document.getElementById('kpiDup').textContent = String(dupCount);
      document.getElementById('kpiOpen').textContent = String(openCount);
      const conceptStart = {{ initial_concept_count }};
      const conceptDiff = conceptStart - counts.concept;
      document.getElementById('kpiConceptDelta').textContent = String(conceptDiff);
      const conceptStartDate = new Date('{{ initial_concept_date }}');
      const now = new Date();
      const daysElapsed = Math.max(1, businessDaysBetween(conceptStartDate, now));
      const conceptDaily = (conceptDiff / daysElapsed).toFixed(1);
      document.getElementById('kpiConceptDaily').textContent = conceptDaily;

      // Update de individuele count spans in de legend
      if(document.getElementById('conceptCount')) document.getElementById('conceptCount').textContent = String(counts.concept);
      if(document.getElementById('conceptPct')) document.getElementById('conceptPct').textContent = pctConcept + '%';
      if(document.getElementById('ongoingCount')) document.getElementById('ongoingCount').textContent = String(counts.ongoing);
      if(document.getElementById('ongoingPct')) document.getElementById('ongoingPct').textContent = pctOngoing + '%';
      if(document.getElementById('validateCount')) document.getElementById('validateCount').textContent = String(counts['m.approved']);
      if(document.getElementById('validatePct')) document.getElementById('validatePct').textContent = pctValidate + '%';
      if(document.getElementById('stuckLegendCount')) document.getElementById('stuckLegendCount').textContent = String(counts.stuck);
      if(document.getElementById('stuckPct')) document.getElementById('stuckPct').textContent = pctStuck + '%';

      // Charts
      drawPie('pieStatus', [
        {label:'Concept', value:counts.concept, color:'#0077C8'},
        {label:'Ongoing', value:counts.ongoing, color:'#fbbf24'},
        {label:'Valideren', value:counts['m.approved'], color:'#10b981'},
        {label:'Stagnatie', value:counts.stuck, color:'#ef4444'},
      ]);
      drawBar('validateTrend', valBuckets, '#10b981');

      statsDialog.scrollTop = 0;
      statsDialog.style.top = '5vh';
      document.body.classList.add('modal-open');
      statsDialog.showModal();
    };

    // ===== OUDE BACKUP FUNCTIONALITEIT VERWIJDERD (verplaatst naar header popup) =====

    window.restoreBackup = async (filename) => {
      if (!confirm(`⚠️ Weet je zeker dat je wilt herstellen van backup: ${filename}?\n\nDit overschrijft alle huidige gegevens!`)) {
        return;
      }
      
      const password = prompt('🔒 Voer wachtwoord in voor herstel:');
      if (!password) return;
      
      try {
        const res = await fetch('/api/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, password })
        });
        
        const data = await res.json();
        
        if (data.ok) {
          alert('✅ ' + data.message + '\n\nPagina wordt herladen...');
          window.location.reload();
        } else {
          alert('❌ ' + (data.error || 'Onbekende fout'));
        }
      } catch (e) {
        alert('❌ Fout bij herstellen backup');
      }
    };

    function baseColors(){
      const dark = document.documentElement.classList.contains('dark');
      return dark
        ? ['#475569','#3B82F6','#F59E0B','#818CF8','#10B981','#E5E7EB']
        : ['#CBD5E1','#60A5FA','#F59E0B','#A78BFA','#10B981','#1F2937'];
    }

    function shadeColor(color, percent){
      const f=parseInt(color.slice(1),16), t=percent<0?0:255, p=Math.abs(percent);
      const R=f>>16, G=f>>8&0x00FF, B=f&0x0000FF;
      return "#" + (0x1000000 + (Math.round((t-R)*p)+R)*0x10000 + (Math.round((t-G)*p)+G)*0x100 + (Math.round((t-B)*p)+B)).toString(16).slice(1);
    }

    const tooltip=document.createElement('div');
    tooltip.style.position='fixed';
    tooltip.style.pointerEvents='none';
    tooltip.style.background='rgba(0,0,0,0.75)';
    tooltip.style.color='#fff';
    tooltip.style.padding='4px 8px';
    tooltip.style.borderRadius='4px';
    tooltip.style.fontSize='12px';
    tooltip.style.display='none';
    document.body.appendChild(tooltip);

    function drawPie(canvasId, series){
      const c = document.getElementById(canvasId);
      const ctx = c.getContext('2d');
      const total = series.reduce((s,x)=>s+x.value,0)||1;
      const cx = c.width/2, cy = c.height/2;
      const r  = Math.min(cx,cy) - 10;
      const fallback = baseColors();
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--card') || '#fff';
      const segments=[];
      let ang=-Math.PI/2;
      series.forEach((s,i)=>{
        const slice=(s.value/total)*Math.PI*2;
        const color=s.color || fallback[i%fallback.length];
        segments.push({start:ang,end:ang+slice,label:s.label,value:s.value,color});
        ang+=slice;
      });

      function render(hover=-1){
        ctx.clearRect(0,0,c.width,c.height);
        segments.forEach((seg,i)=>{
          ctx.beginPath();
          ctx.moveTo(cx,cy);
          ctx.arc(cx,cy,r,seg.start,seg.end);
          ctx.closePath();
          ctx.fillStyle=i===hover?shadeColor(seg.color,-0.2):seg.color;
          ctx.fill();
          ctx.strokeStyle=bg;
          ctx.lineWidth=1;
          ctx.stroke();
        });
        ctx.beginPath();
        ctx.fillStyle=bg;
        ctx.arc(cx,cy,r*0.55,0,Math.PI*2);
        ctx.fill();
      }
      render();

      c.onmousemove=e=>{
        const rect=c.getBoundingClientRect();
        const x=e.clientX-rect.left-cx, y=e.clientY-rect.top-cy;
        const dist=Math.sqrt(x*x+y*y);
        if(dist>r || dist<r*0.55){ tooltip.style.display='none'; render(); return; }
        let angle=Math.atan2(y,x);
        if(angle < -Math.PI/2) angle += 2*Math.PI;
        let idx=-1;
        for(let i=0;i<segments.length;i++){
          const seg=segments[i];
          if(angle>=seg.start && angle<seg.end){ idx=i; break; }
        }
        render(idx);
        if(idx>=0){
          const seg=segments[idx];
          tooltip.style.display='block';
          tooltip.textContent=`${seg.label}: ${seg.value}`;
          tooltip.style.left=(e.clientX+10)+'px';
          tooltip.style.top=(e.clientY+10)+'px';
        } else {
          tooltip.style.display='none';
        }
      };
      c.onmouseleave=()=>{ tooltip.style.display='none'; render(); };
    }

    function drawBar(canvasId, buckets, color){
      const c=document.getElementById(canvasId); const ctx=c.getContext('2d');
      const pad=25, w=c.width, h=c.height;
      const values=buckets.map(b=>b.count);
      const labels=buckets.map(b=>'W'+b.weekNo);
      const maxV=Math.max(1, ...values);
      const bw=(w - pad*2) / values.length - 6;
      let hover=-1; let rects=[];

      function render(){
        ctx.clearRect(0,0,w,h);
        ctx.font="10px system-ui";
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border') || '#e5e7eb';
        ctx.beginPath(); ctx.moveTo(pad,h-pad); ctx.lineTo(w-pad,h-pad); ctx.stroke();
        rects=[];
        for(let i=0;i<values.length;i++){
          const x=pad + i*((w-pad*2)/values.length);
          const bh=(h-pad*2)*(values[i]/maxV);
          const barColor = i===hover ? shadeColor(color || '#0077C8', -0.2) : (color || '#0077C8');
          ctx.fillStyle=barColor;
          ctx.fillRect(x+3, h-pad-bh, bw, bh);
          ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground') || '#64748b';
          ctx.textAlign = "center";
          ctx.fillText(String(values[i]), x + bw/2, h-pad-bh-4);
          ctx.fillText(labels[i], x + bw/2, h-pad+12);
          rects.push({x:x+3, y:h-pad-bh, w:bw, h:bh, bucket:buckets[i]});
        }
      }
      render();

      c.onmousemove=e=>{
        const r=c.getBoundingClientRect();
        const mx=e.clientX - r.left, my=e.clientY - r.top;
        let idx=-1;
        for(let i=0;i<rects.length;i++){
          const b=rects[i];
          if(mx>=b.x && mx<=b.x+b.w && my>=b.y && my<=b.y+b.h){ idx=i; break; }
        }
        if(idx!==hover){ hover=idx; render(); }
        if(idx>=0){
          const b=rects[idx].bucket;
          tooltip.style.display='block';
          const people = Object.entries(b.people||{})
            .sort((a,b)=>b[1]-a[1])
            .map(([n,c])=>`${n}: ${c}`)
            .join('<br>');
          tooltip.innerHTML=`Week ${b.weekNo}: ${b.count}<br>${formatDM(b.start)} - ${formatDM(b.end)}${people? '<br>'+people : ''}`;
          tooltip.style.left=(e.clientX+10)+'px';
          tooltip.style.top=(e.clientY+10)+'px';
        } else {
          tooltip.style.display='none';
        }
      };
      c.onmouseleave=()=>{ hover=-1; render(); tooltip.style.display='none'; };
    }

    function drawLine(canvasId, labels, values){
      const c=document.getElementById(canvasId); const ctx=c.getContext('2d');
      ctx.clearRect(0,0,c.width,c.height);
      const colors=baseColors();
      const pad=30, w=c.width, h=c.height;
      const maxV=Math.max(1, ...values);
      ctx.font="10px system-ui";
      
      // Draw axes
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border') || '#e5e5e5';
      ctx.beginPath(); 
      ctx.moveTo(pad,h-pad); 
      ctx.lineTo(w-pad,h-pad); // x-axis
      ctx.moveTo(pad,pad);
      ctx.lineTo(pad,h-pad); // y-axis
      ctx.stroke();
      
      // Draw grid lines
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border') || '#f0f0f0';
      ctx.globalAlpha = 0.3;
      for(let i = 1; i <= 4; i++){
        const y = pad + (h-2*pad) * i / 4;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(w-pad, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      
      // Draw line
      if(values.length > 1){
        ctx.beginPath();
        ctx.strokeStyle = colors[1] || '#0077C8';
        ctx.lineWidth = 2;
        for(let i=0; i<values.length; i++){
          const x = pad + (w-2*pad) * i / (values.length - 1);
          const y = h - pad - (h-2*pad) * (values[i] / maxV);
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = colors[1] || '#0077C8';
        for(let i=0; i<values.length; i++){
          const x = pad + (w-2*pad) * i / (values.length - 1);
          const y = h - pad - (h-2*pad) * (values[i] / maxV);
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Draw labels
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground') || '#666';
      ctx.textAlign = "center";
      for(let i=0; i<labels.length; i+=Math.ceil(labels.length/8)){ // Show max 8 labels
        const x = pad + (w-2*pad) * i / (labels.length - 1);
        ctx.fillText(labels[i], x, h-pad+15);
      }
    }

    // ===== INITIALISATIE =====
    function setStatusDisabled(disabled){ statusFilter.disabled=disabled; statusFilter.classList.toggle('opacity-50', disabled); }
    
    // Initialize app
    setStatusDisabled(false);
    
    // Request notification permission
    requestNotificationPermission();
    
    // Start polling and loading
    setInterval(loadDocs, 20000);
    setInterval(pollNotifications, 10000);
    pollNotifications();
    loadDocs(true);
    
    // Show welcome notification
    setTimeout(() => {
      showNotification('DocFlow v4.0', 'Nieuwe functies: Trescal branding!');
    }, 2000);

    // ===== FILE OPENING HANDLER =====
    function uncToFileURL(unc){
      const noBack = unc.replace(/\\/g,'/');       // \\srv\share -> //srv/share
      const noLead = noBack.replace(/^\/+/, '');   // //srv/share -> srv/share
      return 'file://///' + encodeURI(noLead);     // encode spaties correct
    }

    document.addEventListener('click', async (e) => {
      const a = e.target.closest('a.iconbtn');
      if (!a) return;

      const card = a.closest('.doc-card');
      const unc  = decodeURIComponent(card?.dataset?.path || '');

      // In de VIEWER: native openen via Python
      if (window.pywebview && pywebview.api?.open_file) {
        e.preventDefault();
        try {
          const res = await pywebview.api.open_file(unc);
          if (!res?.ok) alert(res?.error || 'Kon bestand niet openen');
        } catch (err) {
          alert('Kon bestand niet openen: ' + err);
        }
      } else {
        // In de BROWSER: fallback naar file://
        const fileUrl = uncToFileURL(unc);
        e.preventDefault();
        window.location.href = fileUrl;
      }
    });
  </script>
</body>
</html>
"""
      
# ---------------------- STARTUP ----------------------
def run_app(host: Optional[str] = None, port: Optional[int] = None, debug: bool = False) -> None:
    """Start the Flask app with sane defaults."""
    resolved_host = host or DEFAULT_HOST
    resolved_port = port or DEFAULT_PORT
    app.run(host=resolved_host, port=resolved_port, debug=debug)


if __name__ == "__main__":
    run_app()
