# 📄 DocFlow — Document Management System

Modern document management systeem voor Trescal gebouwd met React, TypeScript en Python Flask.

---

## 🎯 Wat is DocFlow?

DocFlow helpt bij het beheren van documenten van **Concept → Approved**. De applicatie:

- 📁 Leest documenten van netwerkpaden
- 🔄 Tracks document statussen en workflow
- 👥 Ondersteunt multi-user samenwerking
- 📊 Toont statistieken en progress
- 💡 Bevat een ideeënbox voor gebruikers feedback
- 🌓 Dark/Light mode support
- 🎨 Trescal branding (#0077C8)

---

## 🏗️ Architectuur

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  React Frontend (TypeScript)                           │
│  • ShadCN UI Components                                │
│  • Tailwind CSS                                        │
│  • Motion animations                                   │
│  • Recharts visualisaties                             │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTP/JSON API
                 │
┌────────────────▼────────────────────────────────────────┐
│                                                         │
│  Python Flask Backend                                  │
│  • Document scanning                                   │
│  • State management (JSON)                             │
│  • File operations                                     │
│  • Backup systeem                                      │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Reads/Writes
                 │
┌────────────────▼────────────────────────────────────────┐
│                                                         │
│  Network Storage                                       │
│  • \\172.27.91.15\...\Concept (input)                 │
│  • \\172.27.91.15\...\Approved (output)               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

**Zie [`/QUICK_START.md`](./QUICK_START.md) voor gedetailleerde instructies!**

### Kort overzicht:

1. **Start Python backend:**
   ```bash
   python docflow_app.py
   ```

2. **Start React frontend:**
   ```bash
   npm install
   npm run dev
   ```

3. **Open app:** `http://localhost:5173`

---

## 📂 Project Structuur

```
/
├── App.tsx                      # Hoofdcomponent
├── SETUP.md                     # Complete setup guide
├── QUICK_START.md              # Snelle start instructies
├── components/
│   ├── DocumentCard.tsx         # Document kaart component
│   ├── StatsDialog.tsx          # Statistieken dashboard
│   ├── NotificationDialog.tsx   # Notificaties
│   ├── IdeaDialog.tsx           # Ideeënbox
│   └── ui/                      # ShadCN UI componenten
├── lib/
│   ├── api.ts                   # API service layer
│   ├── config.ts                # App configuratie
│   └── mockData.ts              # (leeg - niet meer gebruikt)
├── types/
│   └── docflow.ts               # TypeScript type definities
└── styles/
    └── globals.css              # Global styles + Trescal kleuren
```

---

## 🎨 Features

### Document Management
- ✅ Real-time document scanning (elke 20 sec)
- ✅ Status tracking (Concept → Ongoing → Stagnatie → Valideren → Approved)
- ✅ Multi-user assignments
- ✅ Notes en historie
- ✅ Duplicate detection

### Workflow Acties
- ✅ Claimen (concept → ongoing)
- ✅ Stagnatie markeren (met notitie)
- ✅ Valideren (→ m.approved)
- ✅ Afkeuren (terug naar ongoing)
- ✅ Finaliseren (verplaats naar Approved map)
- ✅ Bulk acties (meerdere documenten tegelijk)

### UI/UX
- ✅ Dark/Light mode
- ✅ Responsive design
- ✅ Motion animations
- ✅ Toast notifications
- ✅ Loading states
- ✅ Error handling

### Extra Features
- ✅ Statistieken dashboard met charts
- ✅ Notificaties systeem
- ✅ Ideeënbox met stemmen
- ✅ Admin mode (Easter egg: 5x logo klik)
- ✅ Intro tour voor nieuwe gebruikers

---

## 🔧 Technologie Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **ShadCN/UI** - Component library
- **Motion** - Animations
- **Recharts** - Data visualisatie
- **Sonner** - Toast notifications

### Backend
- **Python 3.x** - Backend language
- **Flask** - Web framework
- **JSON** - State storage
- **Threading** - Background scanning

---

## 🌐 API Endpoints

Alle endpoints zitten in `docflow_app.py`:

### Documents
- `GET /api/docs` - Alle documenten
- `GET /api/mylist` - Mijn taken

### Actions
- `POST /api/start` - Claim document
- `POST /api/stuck` - Markeer stagnatie
- `POST /api/mark_mapproved` - Markeer voor validatie
- `POST /api/disapprove` - Keur af
- `POST /api/finalize_approve` - Verplaats naar Approved
- `POST /api/unassign` - Verwijder assignee

### Notifications
- `GET /api/changes` - Wijzigingen/notificaties
- `POST /api/notifications/dismiss` - Dismiss notificaties

Zie `/lib/api.ts` voor complete API client implementatie.

---

## 🎨 Branding

DocFlow gebruikt Trescal's huisstijl:

- **Primary color:** `#0077C8` (Trescal blauw)
- **Dark mode primary:** `#38bdf8` (lighter blauw)
- **Typography:** System fonts voor optimale performance
- **Logo:** Trescal logo in header

Kleuren zijn geconfigureerd in `/styles/globals.css` als CSS custom properties.

---

## 👥 Gebruik

### Voor Gebruikers

1. **Naam invoeren** - Vul je naam in de header in
2. **Document claimen** - Klik "Claimen" op een concept document
3. **Status updates** - Gebruik "Stagnatie" of "Valideren" knoppen
4. **Mijn taken** - Switch naar "Mijn taken" om je toegewezen documenten te zien

### Voor Validators

1. **Valideren documenten** - Check documenten in "Valideren" tab
2. **Goedkeuren** - Klik "Naar Approved" om te verplaatsen
3. **Afkeuren** - Klik "Afkeur" met notitie waarom

### Voor Admin (Easter Egg)

Klik 5x op het Trescal logo om admin mode te activeren:
- 🗑️ Delete ideeën
- 📝 Status wijzigen van ideeën
- 💬 Admin notities toevoegen

---

## 🔒 Beveiliging & Data

### Ideas (Client-side)
- Opgeslagen in localStorage
- Geen backend nodig
- Blijft lokaal per browser

### Documents (Backend)
- State in `state.json` (backend)
- Backups in `/backups` directory
- 3 backup types: kort (10x), halfuur (10x), dag (7x)

### Network Paden
Configuratie staat in `docflow_app.py`:
```python
CONCEPT_DIR  = r"\\172.27.91.15\common-zoetermeer$\Quality\RvA\RvA Templates\Concept"
APPROVED_DIR = r"\\172.27.91.15\common-zoetermeer$\Quality\RvA\RvA Templates\Approved"
```

---

## 📊 Status Flow

```
┌─────────┐
│ CONCEPT │ ← Start (nieuw document in Concept map)
└────┬────┘
     │ Claimen
     ▼
┌─────────┐
│ ONGOING │ ← Actief mee bezig
└────┬────┘
     │ ├─→ Valideren
     │ └─→ Stagnatie (met notitie)
     ▼              ▼
┌──────────┐   ┌──────────┐
│VALIDEREN │   │STAGNATIE │
└────┬─────┘   └────┬─────┘
     │              │ Fix issue
     │ Goedkeuren   └─→ Terug naar ONGOING
     ▼
┌──────────┐
│ APPROVED │ ← Definitief (in Approved map)
└──────────┘
```

---

## 🆘 Support

### Hulp nodig?

1. **Check [`/SETUP.md`](./SETUP.md)** - Complete setup instructies
2. **Check [`/QUICK_START.md`](./QUICK_START.md)** - Snelle start guide
3. **Browser console** - Open F12 voor error messages
4. **Backend logs** - Check `docflow.log` in backend directory

### Common Issues

**Backend niet bereikbaar?**
→ Check of `python docflow_app.py` draait
→ Test: `curl http://localhost:5000/api/docs`

**Logo laadt niet?**
→ Voor productie: vervang `figma:asset/...` import met `./assets/trescal-logo.png`

**Documenten laden niet?**
→ Check netwerk toegang tot `\\172.27.91.15\...` paden
→ Check backend logs voor permission errors

---

## 📝 Changelog

### v4.9 (Huidig)
- ✅ Volledige API integratie met Python backend
- ✅ Mock data verwijderd
- ✅ Bulk acties geïmplementeerd
- ✅ Complete error handling
- ✅ Auto-refresh elke 20 seconden
- ✅ Loading states en offline detection

---

## 📄 Licentie

Proprietary - Trescal Internal Use Only

---

## 👨‍💻 Voor Developers (Codex)

**Key Files:**
- `/lib/api.ts` - Alle API endpoints
- `/App.tsx` - Main component met state management
- `/types/docflow.ts` - TypeScript type definities
- `docflow_app.py` - Python Flask backend

**Development:**
```bash
# Frontend
npm run dev        # Start dev server
npm run build      # Build voor productie
npm run preview    # Preview productie build

# Backend
python docflow_app.py  # Start Flask server (port 5000)
```

**API calls pattern:**
```typescript
import * as api from './lib/api';

// Fetch documenten
const docs = await api.getDocs({ status: 'concept' });

// Document actie
await api.startDocument(path, username);
```

**Mock data is verwijderd!** Alle data komt van Python backend via `/api/*` endpoints.

---

**Laatst bijgewerkt:** November 14, 2025
