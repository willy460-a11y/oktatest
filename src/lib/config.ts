// ===================== CONFIG =====================
// DocFlow Configuratie voor netwerk paden en API settings

/**
 * Netwerk paden voor document folders
 * Deze moeten overeenkomen met de Python backend configuratie
 */
export const NETWORK_PATHS = {
  CONCEPT_DIR: String.raw`\\172.27.91.15\common-zoetermeer$\Quality\RvA\RvA Templates\Concept`,
  APPROVED_DIR: String.raw`\\172.27.91.15\common-zoetermeer$\Quality\RvA\RvA Templates\Approved`,
} as const;

/**
 * API Configuratie
 * Voor productie: pas BASE_URL aan naar je backend URL
 * Of gebruik environment variables als je een build tool hebt die dat ondersteunt
 */
const resolveBaseUrl = (envValue?: string) => {
  const trimmed = envValue?.trim();
  if (trimmed) {
    return trimmed.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

export const API_CONFIG = {
  // Gebruik VITE_API_URL voor afwijkende hosts/poorten. Anders dezelfde origin als de frontend.
  BASE_URL: resolveBaseUrl(
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : undefined
  ),
  ENDPOINTS: {
    // Document endpoints
    DOCS: '/api/docs',
    MY_LIST: '/api/mylist',
    CHANGES: '/api/changes',
    
    // Action endpoints
    START: '/api/start',
    STUCK: '/api/stuck',
    MARK_M_APPROVED: '/api/mark_mapproved',
    DISAPPROVE: '/api/disapprove',
    FINALIZE_APPROVE: '/api/finalize_approve',
    UNASSIGN: '/api/unassign',
    
    // Backup endpoints
    BACKUPS: '/api/backups',
    CREATE_BACKUP: '/api/create_backup',
    RESTORE: '/api/restore',
    
    // Notification endpoints
    NOTIFICATIONS_SUBSCRIBE: '/api/notifications/subscribe',
    NOTIFICATIONS_DISMISS: '/api/notifications/dismiss',
    
    // Stats endpoints
    STATS_PERFORMANCE: '/api/stats/performance',
    
    // Static file endpoints
    LOGO: '/logo',
    DOWNLOAD_VIEWER: '/download-viewer',
    INTRO_IMAGE: '/intro-image',
  },
  TIMEOUT: 30000, // 30 seconden
} as const;

export const FILE_HELPER_CONFIG = {
  // Optioneel override via VITE_FILE_HELPER_URL; default = dezelfde origin als de frontend.
  BASE_URL: resolveBaseUrl(
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FILE_HELPER_URL : undefined
  ),
} as const;

/**
 * Scan & Polling Configuratie
 */
export const SCAN_CONFIG = {
  // Scanner interval (moet matchen met backend)
  SCAN_INTERVAL_SECONDS: 20,
  
  // Notification polling interval
  NOTIFICATION_POLL_INTERVAL: 10000, // 10 seconden
  
  // Document refresh interval
  DOCUMENT_REFRESH_INTERVAL: 20000, // 20 seconden
} as const;

/**
 * Initial Statistics Baseline
 */
export const STATS_BASELINE = {
  INITIAL_CONCEPT_COUNT: 417,
  INITIAL_CONCEPT_DATE: '2025-08-21',
  INITIAL_VALIDATE_DATE: '2025-08-28',
} as const;

/**
 * App Configuratie
 */
export const APP_CONFIG = {
  NAME: 'DocFlow',
  VERSION: '4.9',
  EDITION: 'Web Edition',
  COMPANY: 'Trescal',
  BRAND_COLOR: '#0077C8',
  
  // Auto refresh interval (in milliseconds)
  AUTO_REFRESH_INTERVAL: 60000, // 1 minuut
  
  // Local storage keys
  STORAGE_KEYS: {
    USER: 'docflow_user',
    THEME: 'docflow_theme',
    IDEAS: 'docflow_ideas',
    ADMIN: 'docflow_admin_session', // Tijdelijk, niet veilig voor productie
  },
  
  // Admin Easter Egg
  ADMIN_LOGO_CLICKS: 5,
  ADMIN_CLICK_TIMEOUT: 2000, // 2 seconden
} as const;

/**
 * Document Status Configuratie
 */
export const DOCUMENT_STATUS = {
  CONCEPT: 'concept',
  ONGOING: 'ongoing',
  STUCK: 'stuck',
  M_APPROVED: 'm.approved',
  APPROVED: 'approved',
} as const;

/**
 * Idea Status Configuratie
 */
export const IDEA_STATUS = {
  NEW: 'new',
  IN_PROGRESS: 'in-progress',
  DONE: 'done',
  REJECTED: 'rejected',
} as const;

/**
 * Helper functie om netwerkpad te formatteren voor API
 */
export function formatNetworkPath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Helper functie om te checken of een pad in CONCEPT of APPROVED folder zit
 */
export function getPathType(path: string): 'concept' | 'approved' | 'unknown' {
  const normalizedPath = path.toLowerCase();
  
  if (normalizedPath.includes('concept')) {
    return 'concept';
  }
  
  if (normalizedPath.includes('approved')) {
    return 'approved';
  }
  
  return 'unknown';
}

/**
 * Voor backend: Export configuratie in Python formaat
 * Gebruik dit in je backend documentatie
 */
export const PYTHON_CONFIG = `
# ===================== CONFIG =====================
CONCEPT_DIR  = r"${NETWORK_PATHS.CONCEPT_DIR}"
APPROVED_DIR = r"${NETWORK_PATHS.APPROVED_DIR}"
API_HOST     = "0.0.0.0"
API_PORT     = 8000
`;

// ⚠️ DEPLOYMENT FIX: Voor productie
// Verplaats NETWORK_PATHS naar environment variables of backend configuratie
// De frontend hoeft deze paden meestal niet te weten, alleen de backend

export default {
  NETWORK_PATHS,
  API_CONFIG,
  APP_CONFIG,
  DOCUMENT_STATUS,
  IDEA_STATUS,
};

/**
 * Backup wachtwoord (voor admin functionaliteit)
 * ⚠️ In productie: verplaats naar backend environment variable
 */
export const BACKUP_PASSWORD = 'Trescal';
