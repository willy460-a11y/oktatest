"""Configuration helpers for Okta integration."""

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass
class OktaSettings:
    """Resolved Okta configuration loaded from environment variables."""

    domain: str
    issuer: str
    client_id: str
    client_secret: str
    redirect_uri: str

    @property
    def metadata_url(self) -> str:
        return f"{self.issuer.rstrip('/')}/.well-known/openid-configuration"


@lru_cache
def load_okta_settings() -> OktaSettings:
    """Load and validate Okta settings from the environment.

    Raises:
        ValueError: if required environment variables are missing.
    """

    domain = os.environ.get("OKTA_DOMAIN", "").strip()
    issuer = os.environ.get("OKTA_ISSUER", "").strip()
    client_id = os.environ.get("OKTA_CLIENT_ID", "").strip()
    client_secret = os.environ.get("OKTA_CLIENT_SECRET", "").strip()
    redirect_uri = os.environ.get("OKTA_REDIRECT_URI", "").strip()

    if not issuer and domain:
        issuer = f"https://{domain}/oauth2/default"

    if not redirect_uri:
        redirect_uri = "http://localhost:5000/api/auth/okta/callback"

    missing = [
        name
        for name, value in {
            "OKTA_DOMAIN": domain,
            "OKTA_ISSUER": issuer,
            "OKTA_CLIENT_ID": client_id,
            "OKTA_CLIENT_SECRET": client_secret,
            "OKTA_REDIRECT_URI": redirect_uri,
        }.items()
        if not value
    ]

    if missing:
        raise ValueError(
            "Okta is not configured. Set the following environment variables: "
            + ", ".join(missing)
        )

    issuer = issuer.replace("{domain}", domain) if domain else issuer

    return OktaSettings(
        domain=domain,
        issuer=issuer,
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
    )
