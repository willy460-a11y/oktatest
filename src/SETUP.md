# DocFlow Setup Guide

## ✅ Stap 1: Python Backend Starten

1. **Navigeer naar de Python directory:**
   ```bash
   cd path/to/docflow_app.py
   ```

2. **Start de Flask server:**
   ```bash
   python docflow_app.py
   ```

3. **Controleer de output:**
   ```
   Starting DocFlow — Project template v4.9 on:
     • Local   -> http://127.0.0.1:5000
     • Network -> http://172.27.91.XXX:5000
   ```

4. **Noteer het Network IP adres** voor stap 3!

---

## ✅ Stap 2: React Frontend Configureren

1. **Kopieer de environment configuratie:**
   ```bash
   cp .env.example .env
   ```

2. **Open `.env` en update de API URL:**
   ```env
   # Voor local development (zelfde computer)
   VITE_API_URL=http://localhost:5000

   # Voor andere computers in hetzelfde netwerk
   VITE_API_URL=http://172.27.91.XXX:5000
   ```
   
   **Vervang** `172.27.91.XXX` met het Network IP uit stap 1!

---

## ✅ Stap 3: React Frontend Starten

1. **Installeer dependencies (eerste keer):**
   ```bash
   npm install
   ```

2. **Start de development server:**
   ```bash
   npm run dev
   ```

3. **Open de applicatie:**
   ```
   http://localhost:5173
   ```

---

## 🔍 Troubleshooting

### Backend bereikbaar?

Test of de Python backend werkt:
```bash
curl http://localhost:5000/api/docs?status=concept
```

Je zou JSON terug moeten krijgen met documents.

### Frontend kan backend niet bereiken?

**Symptoom:** Rode error melding "Kan geen verbinding maken met de server"

**Oplossing:**
1. Controleer of Python backend draait (zie stap 1)
2. Controleer `.env` bestand - staat de juiste URL erin?
3. Voor andere computers: gebruik het **Network IP** niet `localhost`
4. Firewall blokkeren? Test met `telnet 172.27.91.XXX 5000`

### CORS errors in browser console?

De Python backend heeft CORS al geconfigureerd in Flask. Als je toch errors ziet:

1. Stop beide servers
2. Start eerst de Python backend
3. Dan pas de React frontend

---

## 📁 Bestandsstructuur

```
/
├── docflow_app.py          # Python Flask backend
├── src/
│   ├── App.tsx             # React hoofdcomponent
│   ├── lib/
│   │   └── api.ts          # API service layer
│   └── ...
├── .env                    # Jouw configuratie (NIET committen!)
├── .env.example            # Template voor .env
└── SETUP.md               # Deze file!
```

---

## 🚀 Production Deployment

### Backend (Python)

1. **Gebruik een production WSGI server:**
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 docflow_app:app
   ```

2. **Of met waitress (Windows):**
   ```bash
   pip install waitress
   waitress-serve --host=0.0.0.0 --port=5000 docflow_app:app
   ```

### Frontend (React)

1. **Build de productie versie:**
   ```bash
   npm run build
   ```

2. **Serve de `dist` folder** met een web server (nginx, Apache, IIS)

3. **Update `.env` met productie API URL**

---

## 💡 Tips voor Codex

Hey Codex! 👋

De app is nu volledig geïntegreerd met de Python backend.

**Belangrijke bestanden:**
- `/lib/api.ts` - Alle API calls naar Flask
- `/App.tsx` - Gebruikt nu `api.getDocs()` i.p.v. mock data
- `docflow_app.py` - Python Flask backend (draait op poort 5000)

**API Endpoints die beschikbaar zijn:**
- `GET /api/docs` - Alle documenten
- `POST /api/start` - Claim document
- `POST /api/stuck` - Markeer stagnatie
- `POST /api/mark_mapproved` - Markeer voor validatie
- `POST /api/disapprove` - Afkeuren
- `POST /api/finalize_approve` - Naar Approved verplaatsen
- `POST /api/unassign` - Unassign gebruiker

**Als je de app aanpast:**
1. Frontend (React/TypeScript) - bewerk `/src` files
2. Backend (Python/Flask) - bewerk `docflow_app.py`
3. API integratie - bewerk `/lib/api.ts`

**Mock data is verwijderd!** Alle data komt nu van de Python backend.
Ideas blijven wel client-side opgeslagen in localStorage (zoals bedoeld).

Succes! 🚀
