"""Client registration helper for Okta OAuth."""

from authlib.integrations.flask_client import OAuth
from flask import Flask

from .config import OktaSettings


oauth = OAuth()


def ensure_okta_client(app: Flask, settings: OktaSettings) -> OAuth:
    """Register the Okta OAuth client once per app instance."""
    if app.config.get("OKTA_CLIENT_REGISTERED"):
        return oauth

    oauth.init_app(app)
    oauth.register(
        name="okta",
        client_id=settings.client_id,
        client_secret=settings.client_secret,
        server_metadata_url=settings.metadata_url,
        client_kwargs={"scope": "openid profile email"},
    )

    app.config["OKTA_CLIENT_REGISTERED"] = True
    return oauth
