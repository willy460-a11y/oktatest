# Backend API Specificatie: Statistieken Endpoints

## Overzicht
Dit document beschrijft de nieuwe API endpoints die nodig zijn voor de statistieken functionaliteit in DocFlow.

---

## 📊 GET `/api/stats`

**Beschrijving:** Haal statistiek metadata en weekly validation data op.

### Response Format (JSON)
```json
{
  "ok": true,
  "metadata": {
    "start_date": "2024-01-15T10:30:00Z",
    "initial_concept_count": 417
  },
  "weekly_validation": [
    { "week": "W35", "count": 15 },
    { "week": "W36", "count": 23 },
    { "week": "W37", "count": 18 },
    { "week": "W38", "count": 31 },
    { "week": "W39", "count": 27 }
  ]
}
```

### Response Fields

#### `metadata` object:
- **`start_date`** (string, ISO 8601): Datum/tijd wanneer de statistiek tracking is gestart
- **`initial_concept_count`** (number): Aantal concept documenten bij start van tracking

#### `weekly_validation` array:
- **`week`** (string): Week nummer in formaat "W{nr}" (bijv. "W35", "W36")
- **`count`** (number): Aantal documenten dat die week gevalideerd is (verplaatst naar approved)

### Implementatie Details

**Weekly Validation Berekening:**
- Tel het aantal documenten dat per week de status `approved` heeft gekregen
- Gebruik de `history` events met `event: "finalize_approve_move"` of detecties van approved
- Groepeer per ISO week nummer (gebruik Python's `datetime.isocalendar()[1]`)
- Toon laatste 11 weken (of minder als tracking korter dan 11 weken actief is)

**Metadata Opslag:**
De backend moet deze metadata persistent opslaan (bijv. in een JSON file):
```python
# stats_metadata.json
{
    "start_date": "2024-01-15T10:30:00Z",
    "initial_concept_count": 417
}
```

Bij eerste run (als bestand niet bestaat):
- Zet `start_date` naar huidige datum/tijd
- Tel huidige aantal concept documenten als `initial_concept_count`

---

## 🔄 POST `/api/stats/reset`

**Beschrijving:** Reset de statistieken (admin only). Dit zet de start datum naar nu en update het initiële concept aantal.

### Request Body (JSON)
```json
{
  "user": "john.doe",
  "initial_concept_count": 342
}
```

### Request Fields
- **`user`** (string, required): Gebruikersnaam die de reset uitvoert (voor audit logging)
- **`initial_concept_count`** (number, optional): Nieuw initieel concept aantal. Als niet opgegeven, tel dan het huidige aantal concept documenten.

### Response Format (JSON)
```json
{
  "ok": true
}
```

### Error Response (HTTP 403)
```json
{
  "ok": false,
  "error": "Admin rechten vereist"
}
```

### Implementatie Details

**Admin Check:**
- Implementeer een admin check (bijv. lijst van admin gebruikers in config)
- Return HTTP 403 als gebruiker geen admin is

**Reset Actie:**
1. Zet `start_date` naar huidige datum/tijd
2. Update `initial_concept_count`:
   - Als `initial_concept_count` in request: gebruik die waarde
   - Anders: tel huidige aantal concept documenten
3. Sla metadata op
4. **(Optioneel)** Maak een history event aan voor audit trail

**Audit Logging:**
```python
# Voorbeeld logging
logger.info(f"Stats reset by {user}: start_date={new_start_date}, initial_concept={initial_count}")
```

---

## 💾 Implementatie Voorbeeld (Python Flask)

```python
import json
from datetime import datetime, timedelta
from pathlib import Path
from flask import jsonify, request

STATS_METADATA_FILE = Path("data/stats_metadata.json")
ADMIN_USERS = ["admin", "john.doe", "jane.smith"]  # Configureer dit

def load_stats_metadata():
    """Laad of initialiseer stats metadata"""
    if STATS_METADATA_FILE.exists():
        with open(STATS_METADATA_FILE, 'r') as f:
            return json.load(f)
    else:
        # Eerste keer: initialiseer
        concept_count = len([d for d in documents if d['status'] == 'concept'])
        metadata = {
            "start_date": datetime.utcnow().isoformat() + "Z",
            "initial_concept_count": concept_count
        }
        save_stats_metadata(metadata)
        return metadata

def save_stats_metadata(metadata):
    """Sla stats metadata op"""
    STATS_METADATA_FILE.parent.mkdir(exist_ok=True)
    with open(STATS_METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

def calculate_weekly_validation(documents):
    """Bereken weekly validation counts"""
    from collections import defaultdict
    
    weekly_counts = defaultdict(int)
    
    for doc in documents:
        for event in doc.get('history', []):
            # Tel finalize_approve_move events
            if event['event'] == 'finalize_approve_move':
                event_date = datetime.fromisoformat(event['ts'].replace('Z', '+00:00'))
                week_num = event_date.isocalendar()[1]
                year = event_date.year
                week_label = f"W{week_num}"
                weekly_counts[week_label] += 1
    
    # Sorteer en return laatste 11 weken
    sorted_weeks = sorted(weekly_counts.items(), key=lambda x: int(x[0][1:]))[-11:]
    return [{"week": week, "count": count} for week, count in sorted_weeks]

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """GET /api/stats endpoint"""
    try:
        metadata = load_stats_metadata()
        weekly_validation = calculate_weekly_validation(documents)
        
        return jsonify({
            "ok": True,
            "metadata": metadata,
            "weekly_validation": weekly_validation
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route('/api/stats/reset', methods=['POST'])
def reset_stats():
    """POST /api/stats/reset endpoint (admin only)"""
    try:
        data = request.json
        user = data.get('user')
        
        # Admin check
        if user not in ADMIN_USERS:
            return jsonify({
                "ok": False, 
                "error": "Admin rechten vereist"
            }), 403
        
        # Bepaal initial_concept_count
        initial_count = data.get('initial_concept_count')
        if initial_count is None:
            initial_count = len([d for d in documents if d['status'] == 'concept'])
        
        # Reset metadata
        metadata = {
            "start_date": datetime.utcnow().isoformat() + "Z",
            "initial_concept_count": initial_count
        }
        save_stats_metadata(metadata)
        
        # Log de actie
        logger.info(f"Stats reset by {user}: start_date={metadata['start_date']}, initial_concept={initial_count}")
        
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
```

---

## 🧪 Testing

### Test GET /api/stats
```bash
curl http://localhost:5000/api/stats
```

**Expected Response:**
```json
{
  "ok": true,
  "metadata": {
    "start_date": "2024-01-15T10:30:00Z",
    "initial_concept_count": 417
  },
  "weekly_validation": [
    { "week": "W35", "count": 15 },
    { "week": "W36", "count": 23 }
  ]
}
```

### Test POST /api/stats/reset
```bash
curl -X POST http://localhost:5000/api/stats/reset \
  -H "Content-Type: application/json" \
  -d '{
    "user": "admin",
    "initial_concept_count": 350
  }'
```

**Expected Response:**
```json
{
  "ok": true
}
```

---

## 📝 Notities

1. **Persistentie:** Zorg dat `stats_metadata.json` persistent opgeslagen wordt (niet in `/tmp`)
2. **Admin Configuratie:** Configureer admin gebruikers in een config file of environment variable
3. **Week Nummering:** Gebruik ISO week nummering (Python: `datetime.isocalendar()[1]`)
4. **Timezone:** Gebruik UTC voor alle timestamps
5. **Error Handling:** Return proper HTTP status codes (403 voor unauthorized, 500 voor server errors)

---

## 🔗 Frontend Integratie

De frontend gebruikt deze endpoints via `/lib/api.ts`:
- `getStats()` - Haalt stats op
- `resetStats(user, initial_concept_count?)` - Reset stats (admin only)

De StatsDialog component toont:
- Start datum prominent in een banner
- Aantal dagen sinds start
- Initieel concept aantal
- Admin "Reset statistieken" knop (alleen zichtbaar voor admins)
- Weekly validation bar chart (gebruikt backend data)
