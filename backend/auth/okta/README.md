# Okta integratie (Flask)

Deze map bevat de Okta-authenticatielaag voor de Flask-backend van DocFlow. De implementatie gebruikt Authlib om de OIDC-flow te starten, tokens op te halen en de gebruiker in de sessie op te slaan.

## Bestanden
- `config.py`: laadt en valideert de vereiste Okta-omgevingsvariabelen.
- `client.py`: registreert de Okta OAuth-client één keer per Flask-applicatie.
- `routes.py`: levert `/api/auth/okta/*` endpoints en schrijft de gebruiker in de sessie weg.
- `__init__.py`: gemakkelijke exports voor gebruik in `docflow_app.py`.

## Nodige omgevingsvariabelen
Zet deze in `.env` of je deployment-config:

```
OKTA_DOMAIN=your-okta-domain
OKTA_ISSUER=your-okta-issuer
OKTA_CLIENT_ID=your-client-id
OKTA_CLIENT_SECRET=your-client-secret
OKTA_REDIRECT_URI=http://localhost:5000/api/auth/okta/callback
FLASK_SECRET_KEY=replace-with-a-secret
```

> Tip: als `OKTA_ISSUER` leeg is maar `OKTA_DOMAIN` staat wel ingevuld, dan wordt automatisch `https://<domain>/oauth2/default` gebruikt.

## Hoe het werkt
1. `/api/auth/okta/login` start de OIDC-flow en bewaart de gewenste `next` URL in de sessie.
2. `/api/auth/okta/callback` wisselt de code voor tokens, leest `userinfo`/ID-token en zet de gebruiker in `session["okta_user"]`.
3. `/api/auth/okta/user` geeft een 401 terug als er geen sessie is; anders de ingelogde gebruiker.
4. `/api/auth/okta/logout` wist de sessie en stuurt terug naar `/`.

## Routes koppelen
`docflow_app.py` registreert de blueprint automatisch. Alle `/api/*` routes (behalve health en de Okta-routes) worden geblokkeerd als je geen actieve Okta-sessie hebt.

## Dev quickstart
1. Installeer dependencies: `pip install -r backend/requirements.txt` (bevat Flask, Authlib en Flask-CORS).
2. Zet de env-variabelen (bijv. via `.env`).
3. Start de backend: `python docflow_app.py`.
4. Ga naar de frontend; als je geen sessie hebt, word je doorgestuurd naar Okta.
