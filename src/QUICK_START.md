# ⚡ QUICK START - DocFlow met Python Backend

**Backend + Frontend in 3 stappen**

---

## 🎯 Overzicht

De app is **volledig geïntegreerd** met de Python Flask backend:
- ✅ Mock data verwijderd
- ✅ API calls geïmplementeerd
- ✅ Alle document acties werken via API
- ✅ Auto-refresh elke 20 seconden

---

## 📝 Stap 1: Python Backend Starten (2 min)

### Start de Flask server:

```bash
python docflow_app.py
```

### Je ziet:
```
Starting DocFlow — Project template v4.9 on:
  • Local   -> http://127.0.0.1:5000
  • Network -> http://172.27.91.XXX:5000
```

**✏️ Noteer het Network IP adres!**

✅ **Test:** Open `http://localhost:5000/api/docs` in browser → je moet JSON zien

---

## 📝 Stap 2: Frontend Configureren (1 min)

### Optie A: Voor development (zelfde computer)

Geen configuratie nodig! De frontend gebruikt automatisch `http://localhost:5000`

### Optie B: Voor andere computers (netwerk)

**Maak `.env` bestand in root:**
```env
VITE_API_URL=http://172.27.91.XXX:5000
```
*(Vervang XXX met het Network IP uit stap 1)*

✅ **Test:** Controleer of `.env` bestand correct is

---

## 📝 Stap 3: Frontend Starten (2 min)

```bash
# Eerste keer: installeer dependencies
npm install

# Start development server
npm run dev
```

### Open de app:
```
http://localhost:5173
```

✅ **Test:** 
- Logo zichtbaar? ✓
- Documenten laden? ✓
- Acties werken? ✓

---

## 🔧 Logo Fix (voor productie)

**In `/App.tsx` regel ~21:**

**VOOR (Figma Make):**
```tsx
import trescalLogo from 'figma:asset/a2016f0ab813f6e663df9fd04a04844064d01b0d.png';
```

**NA (Productie):**
```tsx
import trescalLogo from './assets/trescal-logo.png';
```

**Plaats je logo:**
```
/assets/trescal-logo.png
```

---

## 🎯 Checklist

```
Backend:
[ ] 1. Python backend draait op poort 5000
[ ] 2. Netwerk paden werken (CONCEPT_DIR & APPROVED_DIR)
[ ] 3. /api/docs geeft JSON terug

Frontend:
[ ] 4. .env geconfigureerd (indien nodig)
[ ] 5. npm install uitgevoerd
[ ] 6. Frontend draait op poort 5173
[ ] 7. Logo zichtbaar
[ ] 8. Documenten worden geladen
[ ] 9. Acties werken (claimen, valideren, etc.)
[ ] 10. Geen errors in console
```

---

## 🚀 Document Acties die werken

Alle acties zijn verbonden met de Python backend:

- ✅ **Claimen** → `POST /api/start`
- ✅ **Stagnatie** → `POST /api/stuck`
- ✅ **Valideren** → `POST /api/mark_mapproved`
- ✅ **Naar Approved** → `POST /api/finalize_approve`
- ✅ **Afkeuren** → `POST /api/disapprove`
- ✅ **Unassign** → `POST /api/unassign`

**Plus:**
- ✅ Bulk acties
- ✅ Auto-refresh elke 20 seconden
- ✅ Error handling
- ✅ Loading states

---

## 🆘 Troubleshooting

### Backend bereikbaar?
```bash
curl http://localhost:5000/api/docs
```
→ Moet JSON teruggeven met documents

### "Kan geen verbinding maken met de server"?
1. ✅ Check of Python backend draait
2. ✅ Check `.env` bestand (juiste URL?)
3. ✅ Voor andere computers: gebruik Network IP niet `localhost`
4. ✅ Firewall blokkeren? Test met `telnet 172.27.91.XXX 5000`

### Documenten laden niet?
1. ✅ Open browser console (F12)
2. ✅ Check for API errors
3. ✅ Test backend direct: `http://localhost:5000/api/docs`

### CORS errors?
→ Python backend heeft CORS al geconfigureerd in Flask
→ Als je toch errors ziet: stop beide servers en start opnieuw

---

## 📚 Meer Info

**Voor meer details:**
- Complete setup → `/SETUP.md`
- API documentatie → `/lib/api.ts`
- Type definities → `/types/docflow.ts`

---

## ✨ Klaar!

Je DocFlow app is nu:
- ✅ Verbonden met Python backend
- ✅ Live data van netwerkpaden
- ✅ Alle acties werken via API
- ✅ Auto-refresh voor real-time updates
- ✅ Klaar voor gebruik!

**Volgende stap:** Test alle workflows en verzamel feedback via de Ideeënbox! 💡

---

**Laatst bijgewerkt:** November 14, 2025
