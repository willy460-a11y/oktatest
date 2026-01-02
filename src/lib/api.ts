// API Service Layer - Connects to Python Flask backend
// ⚠️ DEPLOYMENT: Update API_BASE_URL for production environment

import { Document } from '../types/docflow';
import { API_CONFIG } from './config';

// ===================== CONFIGURATION =====================
export const API_BASE_URL = API_CONFIG.BASE_URL;

// ===================== ERROR HANDLING =====================
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
      throw new ApiError(errorMessage, response.status, errorData);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(errorMessage, response.status);
    }
  }

  try {
    return await response.json();
  } catch (e) {
    throw new ApiError('Invalid JSON response from server');
  }
}

function withCredentials(options: RequestInit = {}): RequestInit {
  return {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  } satisfies RequestInit;
}

// ===================== AUTH =====================

export interface CurrentUserResponse {
  ok: boolean;
  user?: {
    id?: string;
    name?: string;
    email?: string;
  };
  error?: string;
}

export async function getCurrentUser(): Promise<CurrentUserResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/okta/user`, withCredentials());
  return handleResponse<CurrentUserResponse>(response);
}

// ===================== DOCUMENT ENDPOINTS =====================

export interface GetDocsParams {
  status?: string;
  search?: string;
  sort?: string;
  user?: string;
}

export interface GetDocsResponse {
  ok: boolean;
  items: Document[];
  count: number;
}

/**
 * Haal documenten op met optionele filters
 */
export async function getDocs(params: GetDocsParams = {}): Promise<Document[]> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('q', params.search);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.user) searchParams.set('user', params.user);

  const response = await fetch(
    `${API_BASE_URL}/api/docs?${searchParams.toString()}`,
    withCredentials()
  );
  const data = await handleResponse<GetDocsResponse>(response);
  return data.items || [];
}

/**
 * Haal "mijn taken" op voor een gebruiker
 */
export async function getMyList(params: { user: string; search?: string; sort?: string }): Promise<Document[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('user', params.user);
  if (params.search) searchParams.set('q', params.search);
  if (params.sort) searchParams.set('sort', params.sort);

  const response = await fetch(
    `${API_BASE_URL}/api/mylist?${searchParams.toString()}`,
    withCredentials()
  );
  const data = await handleResponse<GetDocsResponse>(response);
  return data.items || [];
}

// ===================== DOCUMENT ACTIONS =====================

interface ActionParams {
  path: string;
  user: string;
  note?: string;
}

interface ActionResponse {
  ok: boolean;
  error?: string;
}

/**
 * Claim een document (status -> ongoing)
 */
export async function startDocument(path: string, user: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/start`,
    withCredentials({
      method: 'POST',
      body: JSON.stringify({ path, user })
    })
  );
  await handleResponse<ActionResponse>(response);
}

/**
 * Markeer document als stagnatie (status -> stuck)
 */
export async function markStuck(path: string, user: string, note: string = ''): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/stuck`,
    withCredentials({
      method: 'POST',
      body: JSON.stringify({ path, user, note })
    })
  );
  await handleResponse<ActionResponse>(response);
}

/**
 * Markeer document voor validatie (status -> m.approved)
 */
export async function markForValidation(path: string, user: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/mark_mapproved`,
    withCredentials({
      method: 'POST',
      body: JSON.stringify({ path, user })
    })
  );
  await handleResponse<ActionResponse>(response);
}

/**
 * Keur document af (status m.approved -> ongoing)
 */
export async function disapproveDocument(path: string, user: string, note: string = ''): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/disapprove`,
    withCredentials({
      method: 'POST',
      body: JSON.stringify({ path, user, note })
    })
  );
  await handleResponse<ActionResponse>(response);
}

/**
 * Finaliseer en verplaats naar Approved map
 */
export async function finalizeApprove(path: string, user: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/finalize_approve`,
    withCredentials({
      method: 'POST',
      body: JSON.stringify({ path, user })
    })
  );
  await handleResponse<ActionResponse>(response);
}

/**
 * Verwijder gebruiker van document assignees
 */
export async function unassignUser(path: string, user: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/unassign`,
    withCredentials({
      method: 'POST',
      body: JSON.stringify({ path, user })
    })
  );
  await handleResponse<ActionResponse>(response);
}

// ===================== NOTIFICATIONS =====================

export interface ChangeEvent {
  ts: string;
  event: string;
  status?: string;
  by?: string;
  note?: string;
  where?: string;
  doc_name?: string;
  path?: string;
}

export interface GetChangesResponse {
  ok: boolean;
  count: number;
  items: ChangeEvent[];
}

/**
 * Haal wijzigingen/notificaties op voor een gebruiker
 */
export async function getChanges(params: {
  user: string;
  since?: string;
  limit?: number;
}): Promise<{ count: number; items: ChangeEvent[] }> {
  const searchParams = new URLSearchParams();
  searchParams.set('user', params.user);
  if (params.since) searchParams.set('since', params.since);
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(
    `${API_BASE_URL}/api/changes?${searchParams.toString()}`,
    withCredentials()
  );
  const data = await handleResponse<GetChangesResponse>(response);
  return { count: data.count || 0, items: data.items || [] };
}

/**
 * Dismiss notificaties voor een gebruiker
 */
export async function dismissNotifications(user: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/dismiss`,
    withCredentials({
      method: 'POST',
      body: JSON.stringify({ user })
    })
  );
  await handleResponse<ActionResponse>(response);
}

// ===================== STATISTICS =====================

export interface WeeklyValidation {
  week: string;
  count: number;
}

export interface StatsMetadata {
  start_date: string; // ISO datetime wanneer tracking begonnen is
  initial_concept_count: number; // Aantal concept documenten bij start
}

export interface GetStatsResponse {
  ok: boolean;
  metadata: StatsMetadata;
  weekly_validation: WeeklyValidation[];
}

/**
 * Haal statistiek metadata en weekly validation data op
 */
export async function getStats(): Promise<GetStatsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/stats`, withCredentials());
  return await handleResponse<GetStatsResponse>(response);
}

/**
 * Reset statistieken (admin only)
 */
export async function resetStats(params: {
  user: string;
  initial_concept_count?: number;
}): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/stats/reset`,
    withCredentials({
      method: 'POST',
      body: JSON.stringify(params)
    })
  );
  await handleResponse<ActionResponse>(response);
}

// ===================== HEALTH CHECK =====================

/**
 * Check of de backend bereikbaar is
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(
      `${API_BASE_URL}/api/docs?status=concept&limit=1`,
      withCredentials({
        signal: controller.signal
      })
    );
    clearTimeout(timeoutId);
    
    return response.ok;
  } catch (e) {
    console.error('Backend health check failed:', e);
    return false;
  }
}

// ===================== EXPORT CONFIG =====================
export const config = {
  apiBaseUrl: API_BASE_URL,
  scanInterval: 20000, // Backend scant elke 20 seconden
};
