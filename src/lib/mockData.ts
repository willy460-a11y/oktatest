import { Document, Idea } from '../types/docflow';

// ⚠️ DEVELOPMENT MODE: Mock data voor testing zonder Python backend
// In productie worden deze NIET gebruikt - data komt van Flask backend via /api/docs

export const mockDocuments: Document[] = [
  {
    path: '\\\\172.27.91.15\\common-zoetermeer$\\Quality\\RvA\\RvA Templates\\Concept\\SOP-001 Kalibratie Proces.docx',
    name: 'SOP-001 Kalibratie Proces.docx',
    status: 'concept',
    assignees: [],
    history: [
      {
        ts: new Date(Date.now() - 86400000).toISOString(),
        event: 'created',
        by: 'Systeem'
      }
    ],
    notes: '',
    size: 245000,
    created: new Date(Date.now() - 86400000).toISOString(),
    modified: new Date(Date.now() - 86400000).toISOString()
  },
  {
    path: '\\\\172.27.91.15\\common-zoetermeer$\\Quality\\RvA\\RvA Templates\\Concept\\WI-042 Temperatuur Meting.docx',
    name: 'WI-042 Temperatuur Meting.docx',
    status: 'ongoing',
    assignees: ['Jan Jansen'],
    history: [
      {
        ts: new Date(Date.now() - 172800000).toISOString(),
        event: 'created',
        by: 'Systeem'
      },
      {
        ts: new Date(Date.now() - 7200000).toISOString(),
        event: 'start',
        by: 'Jan Jansen',
        status: 'ongoing'
      }
    ],
    notes: '',
    size: 189000,
    created: new Date(Date.now() - 172800000).toISOString(),
    modified: new Date(Date.now() - 7200000).toISOString()
  },
  {
    path: '\\\\172.27.91.15\\common-zoetermeer$\\Quality\\RvA\\RvA Templates\\Concept\\QM-015 Management Review.xlsx',
    name: 'QM-015 Management Review.xlsx',
    status: 'stuck',
    assignees: ['Marie Peters'],
    history: [
      {
        ts: new Date(Date.now() - 259200000).toISOString(),
        event: 'created',
        by: 'Systeem'
      },
      {
        ts: new Date(Date.now() - 86400000).toISOString(),
        event: 'start',
        by: 'Marie Peters',
        status: 'ongoing'
      },
      {
        ts: new Date(Date.now() - 3600000).toISOString(),
        event: 'stuck',
        by: 'Marie Peters',
        status: 'stuck',
        note: 'Wacht op feedback van kwaliteitsmanager'
      }
    ],
    notes: 'Wacht op feedback van kwaliteitsmanager',
    size: 412000,
    created: new Date(Date.now() - 259200000).toISOString(),
    modified: new Date(Date.now() - 3600000).toISOString()
  },
  {
    path: '\\\\172.27.91.15\\common-zoetermeer$\\Quality\\RvA\\RvA Templates\\Concept\\PR-008 Audit Checklist.docx',
    name: 'PR-008 Audit Checklist.docx',
    status: 'm.approved',
    assignees: ['Piet Bakker', 'Lisa de Vries'],
    history: [
      {
        ts: new Date(Date.now() - 345600000).toISOString(),
        event: 'created',
        by: 'Systeem'
      },
      {
        ts: new Date(Date.now() - 172800000).toISOString(),
        event: 'start',
        by: 'Piet Bakker',
        status: 'ongoing'
      },
      {
        ts: new Date(Date.now() - 7200000).toISOString(),
        event: 'mark_mapproved',
        by: 'Piet Bakker',
        status: 'm.approved'
      }
    ],
    notes: '',
    size: 156000,
    created: new Date(Date.now() - 345600000).toISOString(),
    modified: new Date(Date.now() - 7200000).toISOString()
  },
  {
    path: '\\\\172.27.91.15\\common-zoetermeer$\\Quality\\RvA\\RvA Templates\\Approved\\SOP-099 Veiligheid Protocol.pdf',
    name: 'SOP-099 Veiligheid Protocol.pdf',
    status: 'approved',
    assignees: ['Admin'],
    history: [
      {
        ts: new Date(Date.now() - 604800000).toISOString(),
        event: 'created',
        by: 'Systeem'
      },
      {
        ts: new Date(Date.now() - 432000000).toISOString(),
        event: 'finalize_approve',
        by: 'Admin',
        status: 'approved'
      }
    ],
    notes: '',
    size: 892000,
    created: new Date(Date.now() - 604800000).toISOString(),
    modified: new Date(Date.now() - 432000000).toISOString()
  }
];

// Ideas blijven client-side in localStorage - geen backend nodig
export const mockIdeas: Idea[] = [];