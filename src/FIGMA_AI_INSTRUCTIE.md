# 📌 Instructie voor Figma AI - DocFlow Frontend

## ⚠️ BELANGRIJK: Lees dit VOLLEDIG voordat je code genereert!

Deze instructie zorgt ervoor dat de frontend **direct werkt** met de Python Flask backend zonder lege schermen.

---

## 1️⃣ API Base URL

```typescript
const API_BASE_URL = 'http://localhost:5000';
```

**Development:** `http://localhost:5000`  
**Productie:** Configureerbaar via `.env` → `VITE_API_URL`

---

## 2️⃣ Backend API Endpoints

### 📥 GET Endpoints

| Endpoint | Doel | Query Params |
|----------|------|--------------|
| `GET /api/docs` | Haal alle documenten op | `?status=concept&q=search&user=name` |
| `GET /api/mylist` | Mijn toegewezen taken | `?user=name` |

### 📤 POST Endpoints (Acties)

| Endpoint | Body | Actie |
|----------|------|-------|
| `POST /api/start` | `{path, user}` | Claim document |
| `POST /api/stuck` | `{path, user, note}` | Markeer stagnatie |
| `POST /api/mark_mapproved` | `{path, user}` | Klaar voor validatie |
| `POST /api/disapprove` | `{path, user, note}` | Keur af |
| `POST /api/finalize_approve` | `{path, user}` | Finaliseer goedkeuring |
| `POST /api/unassign` | `{path, user}` | Verwijder assignee |

---

## 3️⃣ Backend JSON Response Structuur

### ✅ CORRECT - Dit stuurt de backend:

```json
{
  "ok": true,
  "count": 11,
  "items": [
    {
      "path": "\\\\172.27.91.15\\common$\\Quality\\Concept\\SOP-001.docx",
      "name": "SOP-001.docx",
      "status": "concept",
      "assignees": ["Jan Jansen"],
      "history": [
        {
          "event": "indexed",
          "ts": "2025-11-16T17:42:47Z",
          "status": "concept",
          "where": "concept",
          "assignees_snapshot": []
        }
      ],
      "last_seen_in_concept": "2025-11-16T17:42:47Z",
      "last_seen_in_approved": null,
      "notes": "",
      "ignored": false,
      "from_concept": true,
      "approved_from_concept": false,
      "size": 6185,
      "dup_concept_approved": false
    }
  ]
}
```

### 🔑 Belangrijke Keys:

- `ok` → boolean (success status)
- `count` → number (aantal documenten)
- **`items`** → **Document[] (HIER ZITTEN DE DOCUMENTEN!)** ⚠️

---

## 4️⃣ TypeScript Types (EXACTE structuur)

### Document Interface

```typescript
export interface Document {
  path: string;                          // Volledig bestandspad
  name: string;                          // Bestandsnaam
  status: 'concept' | 'ongoing' | 'stuck' | 'm.approved' | 'approved';
  assignees: string[];                   // Toegewezen gebruikers
  history: HistoryEvent[];               // Event log
  last_seen_in_concept: string | null;   // ISO timestamp
  last_seen_in_approved: string | null;  // ISO timestamp
  notes: string;                         // Notities
  ignored: boolean;                      // Genegeerd?
  from_concept: boolean;                 // Van concept folder?
  approved_from_concept: boolean;        // Approved vanuit concept?
  size: number;                          // Bestandsgrootte (bytes)
  dup_concept_approved: boolean;         // Duplicaat?
}

export interface HistoryEvent {
  event: string;                         // 'indexed', 'start', 'stuck', etc.
  ts: string;                            // ISO timestamp
  status?: string;                       // Status na event
  where?: string;                        // 'concept' of 'approved'
  by?: string;                           // Wie deed de actie
  note?: string;                         // Optionele notitie
  assignees_snapshot?: string[];         // Assignees op dat moment
}
```

---

## 5️⃣ Frontend API Service Layer

### ✅ CORRECT - Zo moet de frontend API calls doen:

```typescript
// /lib/api.ts

const API_BASE_URL = 'http://localhost:5000';

interface GetDocsResponse {
  ok: boolean;
  count: number;
  items: Document[];  // ⚠️ LET OP: items, NIET documents!
}

export async function getDocs(params: {
  status?: string;
  search?: string;
  user?: string;
} = {}): Promise<Document[]> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('q', params.search);
  if (params.user) searchParams.set('user', params.user);

  const response = await fetch(`${API_BASE_URL}/api/docs?${searchParams.toString()}`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data: GetDocsResponse = await response.json();
  
  // ⚠️ BELANGRIJK: Return data.items, NIET data.documents!
  return data.items || [];
}
```

---

## 6️⃣ Frontend Component - Documents Ophalen

### ✅ CORRECT - Zo moet App.tsx documenten laden:

```typescript
import { useState, useEffect } from 'react';
import * as api from './lib/api';
import { Document } from './types/docflow';

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        // Dit geeft Document[] terug
        const docs = await api.getDocs({ status: 'all' });
        setDocuments(docs);
      } catch (error) {
        console.error('Error fetching documents:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  return (
    <div>
      {isLoading ? (
        <p>Laden...</p>
      ) : (
        <div>
          <p>Aantal documenten: {documents.length}</p>
          {documents.map((doc) => (
            <div key={doc.path}>
              <h3>{doc.name}</h3>
              <p>Status: {doc.status}</p>
              <p>Assignees: {doc.assignees.join(', ') || 'Niemand'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 7️⃣ Document Acties (POST requests)

### ✅ CORRECT - Zo moet je document acties uitvoeren:

```typescript
// Claim een document (status → ongoing)
export async function startDocument(path: string, user: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, user })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to start document`);
  }
}

// Gebruik in component:
const handleStartDocument = async (documentPath: string) => {
  try {
    await api.startDocument(documentPath, 'Jan Jansen');
    // Refresh documents na actie
    const updatedDocs = await api.getDocs();
    setDocuments(updatedDocs);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## 8️⃣ Wat Figma AI ABSOLUUT NIET mag doen

### ❌ FOUT - Deze patronen NIET gebruiken:

```typescript
// ❌ FOUT: Backend stuurt GEEN "documents" key
const docs = data.documents;  // BESTAAT NIET!

// ❌ FOUT: Backend stuurt GEEN "results" key
const docs = data.results;    // BESTAAT NIET!

// ❌ FOUT: Backend stuurt GEEN "data" wrapper
const docs = data.data.items; // BESTAAT NIET!

// ❌ FOUT: Veldnaam wijzigen
const title = doc.title;      // Moet doc.name zijn!

// ❌ FOUT: Status filtering die alles verbergt
if (doc.status === 'pending') // Status heet 'ongoing', niet 'pending'!

// ❌ FOUT: Eigen velden toevoegen die backend niet stuurt
const id = doc.id;            // Backend stuurt geen 'id', gebruik doc.path!
```

### ✅ CORRECT - Altijd gebruik maken van:

```typescript
// ✅ Documents array
const docs = data.items;

// ✅ Document naam
const name = doc.name;

// ✅ Unique key
<div key={doc.path}>

// ✅ Status filtering
if (doc.status === 'concept' || doc.status === 'ongoing' || ...)

// ✅ Assignees check
if (doc.assignees.length > 0)
```

---

## 9️⃣ Status Waardes

**Exacte status strings die de backend gebruikt:**

```typescript
type DocumentStatus = 
  | 'concept'      // Nieuw document in Concept folder
  | 'ongoing'      // In bewerking
  | 'stuck'        // Stagnatie
  | 'm.approved'   // Klaar voor management validatie
  | 'approved';    // Goedgekeurd en verplaatst naar Approved folder
```

⚠️ **Gebruik EXACT deze strings, geen variaties!**

---

## 🎯 Testing Checklist

Figma AI moet deze checks uitvoeren:

- [ ] `fetch('/api/docs')` geeft `{ok, count, items}` terug
- [ ] `data.items` is een array met documenten
- [ ] `data.items[0].name` toont bestandsnaam
- [ ] `data.items[0].status` is een van: concept, ongoing, stuck, m.approved, approved
- [ ] `documents.length` toont correct aantal
- [ ] Refresh werkt en toont documenten opnieuw
- [ ] POST acties sturen `{path, user}` in body
- [ ] Error handling werkt als backend offline is

---

## 🚀 Development Workflow

### Backend starten:
```bash
python docflow_app.py
# Draait op: http://localhost:5000
```

### Frontend starten:
```bash
npm run dev
# Draait op: http://localhost:5173
```

### Test API in browser:
```
http://localhost:5000/api/docs
```

Moet JSON tonen met `{ok: true, count: X, items: [...]}`

---

## 💡 Samenvatting voor Figma AI

1. **Backend URL:** `http://localhost:5000`
2. **Documenten ophalen:** `GET /api/docs` → `data.items`
3. **Acties:** `POST /api/start` etc. met body `{path, user}`
4. **Document key voor React:** `doc.path` (NIET doc.id)
5. **Status strings:** Exact: 'concept', 'ongoing', 'stuck', 'm.approved', 'approved'
6. **NOOIT** eigen velden verzinnen die backend niet stuurt
7. **ALTIJD** `data.items` gebruiken, NIET `data.documents`

---

## 📞 Als het nog steeds niet werkt

**Check in browser console:**

```javascript
// Test API direct in browser console:
fetch('http://localhost:5000/api/docs')
  .then(r => r.json())
  .then(d => console.log('Backend response:', d))
  .catch(e => console.error('Backend offline?', e));
```

**Verwacht output:**
```
Backend response: {ok: true, count: 11, items: Array(11)}
```

Als je `CORS error` ziet → Backend moet CORS headers sturen  
Als je `Failed to fetch` ziet → Backend draait niet of verkeerde URL

---

✅ **Volg deze instructies exact en de UI werkt!**
