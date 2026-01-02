"""Flask blueprint implementing the Okta auth flow."""
 
from urllib.parse import quote, urlparse
 
from flask import Blueprint, current_app, jsonify, redirect, request, session
 
from .client import ensure_okta_client
from .config import load_okta_settings
 
 
okta_bp = Blueprint("okta_auth", __name__, url_prefix="/api/auth/okta")
 
# ✅ Pas aan als jouw startpagina anders is
DEFAULT_DESTINATION = "/"
 
 
def user_is_authenticated() -> bool:
    return bool(session.get("okta_user"))
 
 
def _safe_next_url(next_url: str | None) -> str:
    """
    Only allow:
    - Relative URLs like "/docflow" or "/something?x=1"
    - Absolute URLs to the SAME host (rare, but safe)
    Everything else falls back to DEFAULT_DESTINATION.
 
    This prevents redirecting users back to Okta pages (which causes the 404 screen).
    """
    if not next_url:
        return DEFAULT_DESTINATION
 
    next_url = next_url.strip()
 
    # Relative path is always OK
    if next_url.startswith("/"):
        return next_url
 
    # Absolute URL: only allow if same host
    try:
        parsed = urlparse(next_url)
        if parsed.scheme in ("http", "https") and parsed.netloc == request.host:
            path = parsed.path or DEFAULT_DESTINATION
            if parsed.query:
                path = f"{path}?{parsed.query}"
            return path
    except Exception:  # noqa: BLE001
        pass
 
    return DEFAULT_DESTINATION
 
 
def _error_redirect(message: str):
    # Always redirect back to a SAFE destination
    destination = _safe_next_url(session.pop("auth_next", None) or request.args.get("next"))
    separator = "&" if "?" in destination else "?"
    return redirect(f"{destination}{separator}auth_error={quote(message)}")
 
 
@okta_bp.get("/login")
def login():
    try:
        settings = load_okta_settings()
    except ValueError as exc:  # noqa: PERF203
        return jsonify({"ok": False, "error": str(exc)}), 503
 
    oauth = ensure_okta_client(current_app, settings)
 
    # ✅ Store only a safe destination (prevents redirecting back to Okta pages)
    desired_next = request.args.get("next") or request.referrer
    session["auth_next"] = _safe_next_url(desired_next)
 
    return oauth.okta.authorize_redirect(redirect_uri=settings.redirect_uri)
 
 
@okta_bp.get("/callback")
def callback():
    try:
        settings = load_okta_settings()
        oauth = ensure_okta_client(current_app, settings)
        token = oauth.okta.authorize_access_token()
        userinfo = token.get("userinfo") or oauth.okta.parse_id_token(token)
    except Exception:  # noqa: BLE001
        current_app.logger.exception("Okta callback failed")
        return _error_redirect("Authentication failed. Please try again.")
 
    session["okta_user"] = {
        "id": userinfo.get("sub"),
        "name": userinfo.get("name")
        or userinfo.get("preferred_username")
        or userinfo.get("email")
        or "Onbekende gebruiker",
        "email": userinfo.get("email"),
    }
    session["okta_tokens"] = {
        "access_token": token.get("access_token"),
        "id_token": token.get("id_token"),
    }
 
    # ✅ Redirect only to safe internal path
    destination = _safe_next_url(session.pop("auth_next", None))
    return redirect(destination)
 
 
@okta_bp.get("/logout")
def logout():
    session.pop("okta_user", None)
    session.pop("okta_tokens", None)
    # ✅ Avoid redirecting to "/" if your app has no root route
    return redirect(DEFAULT_DESTINATION)
 
 
@okta_bp.get("/user")
def current_user():
    if not user_is_authenticated():
        return jsonify({"ok": False, "error": "Niet ingelogd"}), 401
 
    return jsonify({"ok": True, "user": session.get("okta_user")})
 
