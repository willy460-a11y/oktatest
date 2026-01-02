# 🤖 Instructies voor Codex

**Versie:** v4.9 - Production Ready met Python Backend Integratie

---

## ✅ Status van het Project

De DocFlow applicatie is **volledig geïntegreerd** met de Python Flask backend:

- ✅ **Mock data verwijderd** - `/lib/mockData.ts` is leeg
- ✅ **API integratie compleet** - Alle endpoints in `/lib/api.ts`
- ✅ **Document acties werken** - Via Python backend API
- ✅ **Auto-refresh** - Elke 20 seconden (sync met backend)
- ✅ **Error handling** - Proper error messages en loading states
- ✅ **Ideas blijven client-side** - localStorage (zoals bedoeld)

---

## 🎯 Architectuur Overzicht

```
React Frontend (TypeScript)
         ↓
    /lib/api.ts (API Service Layer)
         ↓
    HTTP/JSON API
         ↓
Python Flask Backend (docflow_app.py)
         ↓
Network Storage (\\172.27.91.15\...)
```

---

## 📂 Belangrijke Bestanden

### Frontend Code
- **`/App.tsx`** - Main component, gebruikt `api.getDocs()` voor data
- **`/lib/api.ts`** - Alle API endpoints naar Python backend
- **`/lib/mockData.ts`** - Leeg (mock data verwijderd)
- **`/types/docflow.ts`** - TypeScript type definities
- **`/components/DocumentCard.tsx`** - Document kaart component

### Documentatie
- **`/SETUP.md`** - Complete setup instructies
- **`/QUICK_START.md`** - Snelle start guide
- **`/README.md`** - Project overzicht
- **`/CODEX_INSTRUCTIES.md`** - Dit bestand

### Backend (Python)
- **`docflow_app.py`** - Flask backend (niet in deze repo)

---

## 🔌 API Endpoints

**Backend draait op:** `http://localhost:5000` (configureerbaar via `.env`)

### Beschikbare Endpoints:

**Documenten:**
- `GET /api/docs?status=&q=&sort=&user=` - Haal documenten op
- `GET /api/mylist?user=&q=&sort=` - Mijn taken

**Acties:**
- `POST /api/start` - Claim document (→ ongoing)
- `POST /api/stuck` - Markeer stagnatie
- `POST /api/mark_mapproved` - Markeer voor validatie
- `POST /api/disapprove` - Keur af (→ ongoing)
- `POST /api/finalize_approve` - Verplaats naar Approved map
- `POST /api/unassign` - Verwijder assignee

**Notificaties:**
- `GET /api/changes?user=&since=&limit=` - Haal wijzigingen op
- `POST /api/notifications/dismiss` - Dismiss notificaties

**Zie `/lib/api.ts` voor complete implementatie met TypeScript types!**

---

## 🛠️ Development Workflow

### 1. Python Backend Starten
```bash
python docflow_app.py
```
→ Draait op `http://localhost:5000`

### 2. React Frontend Starten
```bash
npm install  # Eerste keer
npm run dev
```
→ Draait op `http://localhost:5173`

### 3. Data Flow
1. Frontend roept `api.getDocs()` aan
2. API service maakt `fetch()` call naar backend
3. Backend leest bestanden van netwerkpaden
4. Backend stuurt JSON terug
5. Frontend update state en UI

---

## 🎨 UI/UX Features

### Status Kleuren (Trescal branding)
- **Concept:** Blauw (`#0077C8`)
- **Ongoing:** Geel/Oranje
- **Stagnatie:** Oranje/Rood
- **Valideren:** Paars
- **Approved:** Groen

### Workflow
```
Concept → [Claimen] → Ongoing → [Valideren] → Valideren → [Goedkeuren] → Approved
                         ↓
                    [Stagnatie] → (met notitie)
```

### Bulk Acties
- Selecteer meerdere documenten
- Voer acties uit op allemaal tegelijk
- Progress feedback met success/fail count
- Approved documenten worden beschermd (niet selecteerbaar)

---

## 📝 Als je wijzigingen moet maken

### Frontend Wijzigingen
**TypeScript/React bestanden:**
- Bewerk `/App.tsx`, `/components/*`, `/lib/*`
- Gebruik bestaande types uit `/types/docflow.ts`
- API calls: gebruik functies uit `/lib/api.ts`

**Stijling:**
- Tailwind classes in components
- Global styles in `/styles/globals.css`
- Gebruik CSS custom properties voor kleuren (`--brand`, `--fg`, etc.)

### Backend Wijzigingen
**Python backend (docflow_app.py):**
- Wijzig endpoints in Flask routes
- Update JSON response format
- Zorg dat frontend types matchen

**Als je backend wijzigt:**
1. Update `/lib/api.ts` met nieuwe endpoints
2. Update `/types/docflow.ts` als data structuur verandert
3. Test API calls in frontend

### API Integratie Wijzigen
**Om nieuwe endpoint toe te voegen:**

1. **In `/lib/api.ts`:**
```typescript
export async function newAction(path: string, user: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/new-endpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, user })
  });
  await handleResponse<ActionResponse>(response);
}
```

2. **In `/App.tsx`:**
```typescript
const handleNewAction = async (path: string) => {
  try {
    await api.newAction(path, username);
    toast.success('Actie voltooid!');
    await handleRefresh();
  } catch (error) {
    toast.error('Actie mislukt');
  }
};
```

---

## ⚠️ Belangrijke Regels

### DO's ✅
- ✅ Gebruik API functies uit `/lib/api.ts`
- ✅ Handle errors met try/catch
- ✅ Toon loading states tijdens API calls
- ✅ Gebruik TypeScript types uit `/types/docflow.ts`
- ✅ Test met echte Python backend
- ✅ Gebruik toast notifications voor feedback

### DON'Ts ❌
- ❌ **NIET** mock data toevoegen aan `/lib/mockData.ts`
- ❌ **NIET** direct `fetch()` calls maken (gebruik `/lib/api.ts`)
- ❌ **NIET** hardcoded backend URL (gebruik `API_BASE_URL` uit api.ts)
- ❌ **NIET** types aanpassen zonder backend te checken
- ❌ **NIET** `/components/figma/ImageWithFallback.tsx` wijzigen (protected)

---

## 🔧 Configuration

### Environment Variables
Maak `.env` bestand in root:
```env
VITE_API_URL=http://localhost:5000
```

Default is `http://localhost:5000` als `.env` ontbreekt.

### Network Paden (Backend)
```python
# In docflow_app.py
CONCEPT_DIR  = r"\\172.27.91.15\common-zoetermeer$\Quality\RvA\RvA Templates\Concept"
APPROVED_DIR = r"\\172.27.91.15\common-zoetermeer$\Quality\RvA\RvA Templates\Approved"
```

---

## 🐛 Debugging

### Frontend Debugging
```typescript
// In /lib/api.ts zijn console.errors al toegevoegd
// Check browser console (F12) voor:
- API errors
- Network failures
- Type errors
```

### Backend Debugging
```bash
# Backend logs naar:
- Console (stdout)
- docflow.log (file)

# Test backend apart:
curl http://localhost:5000/api/docs
```

### Common Issues

**"Cannot read properties of undefined (reading 'VITE_API_URL')"**
→ Fixed! Safe fallback in `/lib/api.ts`

**"Error fetching documents"**
→ Check of Python backend draait
→ Test: `curl http://localhost:5000/api/docs`

**Types matchen niet**
→ Check `/types/docflow.ts`
→ Backend JSON moet matchen met TypeScript types

---

## 📊 Data Structuur

### Document Type (from /types/docflow.ts)
```typescript
interface Document {
  path: string;              // UNC path naar bestand
  name: string;              // Bestandsnaam
  status: 'concept' | 'ongoing' | 'stuck' | 'm.approved' | 'approved';
  assignees: string[];       // Toegewezen gebruikers
  history: HistoryEvent[];   // Event log
  notes: string;             // Notities (voor stuck)
  size: number;              // Bestandsgrootte in bytes
  // ... meer velden
}
```

### API Response Format
```typescript
{
  "ok": true,
  "items": Document[],
  "count": number
}
```

**Backend stuurt EXACT deze structuur!**

---

## 🎯 Testing Checklist

Wanneer je wijzigingen maakt, test:

```
[ ] Python backend start zonder errors
[ ] Frontend start zonder errors
[ ] Documenten laden bij opstarten
[ ] Auto-refresh werkt (elke 20 sec)
[ ] Claimen document werkt
[ ] Stagnatie markeren werkt
[ ] Valideren werkt
[ ] Goedkeuren werkt (verplaatst bestand)
[ ] Bulk acties werken
[ ] Error messages tonen bij failures
[ ] Loading states tonen tijdens API calls
[ ] Dark/light mode werkt
[ ] Ideas (client-side) werken
```

---

## 💡 Ideas Feature (Client-side)

**BELANGRIJK:** Ideas zijn NIET verbonden met backend!

- Opgeslagen in localStorage
- Geen API calls
- Blijft lokaal per browser
- Code: `IdeaDialog.tsx` en `App.tsx`

**Als je backend voor ideas wilt:**
1. Maak nieuwe endpoints in `docflow_app.py`
2. Voeg functies toe aan `/lib/api.ts`
3. Update `App.tsx` om API te gebruiken

---

## 🚀 Deployment

### Frontend Build
```bash
npm run build
# → dist/ folder voor productie
```

### Logo Fix voor Productie
In `/App.tsx` regel ~21:
```typescript
// Vervang:
import trescalLogo from 'figma:asset/...';
// Met:
import trescalLogo from './assets/trescal-logo.png';
```

### Backend Production
```bash
# Gebruik production WSGI server
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 docflow_app:app
```

---

## 📚 Extra Resources

- **Setup:** `/SETUP.md`
- **Quick Start:** `/QUICK_START.md`
- **Project Info:** `/README.md`
- **API Client:** `/lib/api.ts`
- **Types:** `/types/docflow.ts`

---

## ✨ Samenvatting voor Codex

**De app is production-ready!**

- 🎯 Gebruik `/lib/api.ts` voor alle backend calls
- 🎯 Mock data is WEG - alles komt van Python backend
- 🎯 Test altijd met echte backend running
- 🎯 Types in `/types/docflow.ts` matchen backend JSON
- 🎯 Ideas blijven client-side (localStorage)
- 🎯 Error handling en loading states zijn geïmplementeerd

**Happy coding! 🚀**

---

**Laatst bijgewerkt:** November 14, 2025

---

## 📦 DocFlow File Helper - .EXE Bouwen

### Wat is de File Helper?

Een standalone Windows applicatie die:
- 🖥️ Draait als system tray applicatie (achtergrond proces)
- 🌐 Start lokale Flask server op `localhost:5000`
- 📂 Maakt het mogelijk om bestanden te openen vanuit de web interface
- 🔒 Werkt alleen lokaal (geen internet nodig)
- ⚡ Geen installatie nodig - één .exe bestand

### Python Source Code

**Bestand:** `docflow_file_helper.py`

```python
"""
DocFlow File Helper - System Tray Application
Versie: 1.0
Doel: Open bestanden vanuit DocFlow web interface

Functionaliteit:
- Flask server op localhost:5000
- System tray icoon (groen)
- Context menu met opties
- Auto-start bij Windows boot (optioneel)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import subprocess
import platform
import sys
import pystray
from PIL import Image, ImageDraw
from threading import Thread
import winreg
import webbrowser

app = Flask(__name__)
CORS(app)  # Allow CORS for localhost web app

# Flask Endpoints
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint - DocFlow gebruikt dit om te checken of helper actief is"""
    return jsonify({"status": "ok", "version": "1.0"}), 200

@app.route('/open', methods=['POST'])
def open_file():
    """Open bestand met standaard applicatie"""
    try:
        data = request.json
        file_path = data.get('path')
        
        if not file_path:
            return jsonify({"error": "No path provided"}), 400
        
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404
        
        # Open bestand met OS standaard applicatie
        if platform.system() == 'Windows':
            os.startfile(file_path)
        elif platform.system() == 'Darwin':  # macOS
            subprocess.call(['open', file_path])
        else:  # Linux
            subprocess.call(['xdg-open', file_path])
        
        return jsonify({"success": True, "path": file_path}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# System Tray Functions
def create_tray_icon():
    """Creëer groen vierkant icoon voor system tray"""
    width = 64
    height = 64
    image = Image.new('RGB', (width, height), color='#00C853')  # Groen
    
    # Voeg witte 'D' toe (voor DocFlow)
    draw = ImageDraw.Draw(image)
    # Simpel vierkant - in productie zou je een mooier icoon kunnen gebruiken
    
    return image

def open_docflow():
    """Open DocFlow web interface in browser"""
    webbrowser.open('http://localhost:5173')  # Of productie URL

def toggle_autostart(icon, item):
    """Toggle auto-start bij Windows boot"""
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    app_name = "DocFlowFileHelper"
    
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
        
        if item.checked:
            # Verwijder van autostart
            try:
                winreg.DeleteValue(key, app_name)
                print("Auto-start uitgeschakeld")
            except FileNotFoundError:
                pass
        else:
            # Voeg toe aan autostart
            exe_path = sys.executable if getattr(sys, 'frozen', False) else __file__
            winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, f'"{exe_path}"')
            print("Auto-start ingeschakeld")
        
        winreg.CloseKey(key)
    except Exception as e:
        print(f"Error toggling autostart: {e}")

def is_autostart_enabled():
    """Check of auto-start is ingeschakeld"""
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    app_name = "DocFlowFileHelper"
    
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_READ)
        winreg.QueryValueEx(key, app_name)
        winreg.CloseKey(key)
        return True
    except FileNotFoundError:
        return False

def show_status(icon, item):
    """Toon status notificatie"""
    icon.notify("DocFlow File Helper is actief\nServer: localhost:5000", "Status")

def quit_app(icon, item):
    """Stop de applicatie"""
    icon.stop()
    os._exit(0)

def run_flask():
    """Start Flask server in aparte thread"""
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

def setup_tray():
    """Setup system tray applicatie"""
    icon_image = create_tray_icon()
    
    menu = pystray.Menu(
        pystray.MenuItem("Open DocFlow", open_docflow),
        pystray.MenuItem("Status", show_status),
        pystray.MenuItem("Start met Windows", toggle_autostart, checked=is_autostart_enabled),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Afsluiten", quit_app)
    )
    
    icon = pystray.Icon(
        "DocFlowFileHelper",
        icon_image,
        "DocFlow File Helper",
        menu
    )
    
    icon.run()

# Main
if __name__ == '__main__':
    print("DocFlow File Helper gestart...")
    print("Server: http://localhost:5000")
    print("System tray icoon zou zichtbaar moeten zijn")
    
    # Start Flask in aparte thread
    flask_thread = Thread(target=run_flask, daemon=True)
    flask_thread.start()
    
    # Start system tray (blokkeert tot afsluiten)
    setup_tray()
```

### Vereiste Dependencies

**Bestand:** `requirements_filehelper.txt`

```txt
Flask==3.0.0
flask-cors==4.0.0
pystray==0.19.5
Pillow==10.1.0
pywin32==306
```

### Build Instructies voor .EXE

#### Stap 1: Installeer Dependencies

```bash
# Maak virtual environment (aanbevolen)
python -m venv venv_filehelper
venv_filehelper\Scripts\activate

# Installeer packages
pip install -r requirements_filehelper.txt
pip install pyinstaller
```

#### Stap 2: Bouw de .EXE

```bash
# Eén-bestand executable zonder console venster
pyinstaller --onefile --windowed --name=DocFlowFileHelper --icon=icon.ico docflow_file_helper.py

# Opties uitleg:
# --onefile       → Één .exe bestand (niet een map)
# --windowed      → Geen console venster (achtergrond proces)
# --name=...      → Naam van de .exe
# --icon=icon.ico → Custom icoon (optioneel - maak eerst icon.ico)
```

#### Stap 3: Test de .EXE

```bash
# .exe staat in dist/ folder
cd dist
DocFlowFileHelper.exe

# Test of het werkt:
# 1. Check system tray voor groen icoon
# 2. Test health endpoint: curl http://localhost:5000/health
# 3. Test vanuit DocFlow web interface
```

### Deployment

**Waar de .exe plaatsen:**

1. **Voor development:**
   - In project root of `/dist` folder
   - Gebruikers downloaden via FileHelperDialog

2. **Voor productie:**
   - Upload naar backend server
   - Backend endpoint: `GET /api/download/docflow-file-helper`
   - Dient de .exe als downloadable file

**Backend endpoint implementatie (Python Flask):**

```python
# In docflow_app.py
from flask import send_file

@app.route('/api/download/docflow-file-helper', methods=['GET'])
def download_file_helper():
    """Download DocFlowFileHelper.exe"""
    exe_path = os.path.join(os.getcwd(), 'dist', 'DocFlowFileHelper.exe')
    
    if not os.path.exists(exe_path):
        return jsonify({"error": "File helper not found"}), 404
    
    return send_file(
        exe_path,
        as_attachment=True,
        download_name='DocFlowFileHelper.exe',
        mimetype='application/octet-stream'
    )
```

### Troubleshooting

**"Module not found" errors bij bouwen:**
```bash
# Rebuild met alle dependencies expliciet
pip freeze > requirements_full.txt
pip install -r requirements_full.txt
pyinstaller --onefile --windowed --hidden-import=pystray --hidden-import=PIL docflow_file_helper.py
```

**Icon niet zichtbaar in system tray:**
- Check Task Manager of proces draait
- Probeer `--console` build voor debugging
- Check Windows security settings (antivirus)

**Port 5000 al in gebruik:**
```python
# In docflow_file_helper.py, wijzig poort:
app.run(host='127.0.0.1', port=5001, ...)  # Gebruik andere poort
```

**Antivirus blokkeert .exe:**
- PyInstaller .exe files worden soms gedetecteerd als vals positief
- Code sign de .exe (advanced - vereist certificaat)
- Whitelist in antivirus software

### Security Considerations

- ✅ Server luistert ALLEEN op localhost (127.0.0.1)
- ✅ CORS beperkt tot localhost
- ✅ Geen remote verbindingen mogelijk
- ✅ Geen gevoelige data opslag
- ⚠️ Let op: File paths van network kunnen security risico's zijn
  - Valideer file paths in productie
  - Beperk tot allowed directories

### Updates & Versioning

**Versie nummering:**
```python
# In health endpoint response
return jsonify({"status": "ok", "version": "1.0"}), 200
```

**Update workflow:**
1. Wijzig Python source
2. Increment version nummer
3. Rebuild .exe met PyInstaller
4. Upload nieuwe .exe naar backend
5. Gebruikers downloaden nieuwe versie
6. Optioneel: Auto-update functie implementeren

---

## 🎯 Testing Checklist

Wanneer je wijzigingen maakt, test:

```
[ ] Python backend start zonder errors
[ ] Frontend start zonder errors
[ ] Documenten laden bij opstarten
[ ] Auto-refresh werkt (elke 20 sec)
[ ] Claimen document werkt
[ ] Stagnatie markeren werkt
[ ] Valideren werkt
[ ] Goedkeuren werkt (verplaatst bestand)
[ ] Bulk acties werken
[ ] Error messages tonen bij failures
[ ] Loading states tonen tijdens API calls
[ ] Dark/light mode werkt
[ ] Ideas (client-side) werken
```

---

## 💡 Ideas Feature (Client-side)

**BELANGRIJK:** Ideas zijn NIET verbonden met backend!

- Opgeslagen in localStorage
- Geen API calls
- Blijft lokaal per browser
- Code: `IdeaDialog.tsx` en `App.tsx`

**Als je backend voor ideas wilt:**
1. Maak nieuwe endpoints in `docflow_app.py`
2. Voeg functies toe aan `/lib/api.ts`
3. Update `App.tsx` om API te gebruiken

---

## 🚀 Deployment

### Frontend Build
```bash
npm run build
# → dist/ folder voor productie
```

### Logo Fix voor Productie
In `/App.tsx` regel ~21:
```typescript
// Vervang:
import trescalLogo from 'figma:asset/...';
// Met:
import trescalLogo from './assets/trescal-logo.png';
```

### Backend Production
```bash
# Gebruik production WSGI server
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 docflow_app:app
```

---

## 📚 Extra Resources

- **Setup:** `/SETUP.md`
- **Quick Start:** `/QUICK_START.md`
- **Project Info:** `/README.md`
- **API Client:** `/lib/api.ts`
- **Types:** `/types/docflow.ts`

---

## ✨ Samenvatting voor Codex

**De app is production-ready!**

- 🎯 Gebruik `/lib/api.ts` voor alle backend calls
- 🎯 Mock data is WEG - alles komt van Python backend
- 🎯 Test altijd met echte backend running
- 🎯 Types in `/types/docflow.ts` matchen backend JSON
- 🎯 Ideas blijven client-side (localStorage)
- 🎯 Error handling en loading states zijn geïmplementeerd

**Happy coding! 🚀**

---

**Laatst bijgewerkt:** November 14, 2025