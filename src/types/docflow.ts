export type DocumentStatus = 'concept' | 'ongoing' | 'stuck' | 'm.approved' | 'approved';

export interface HistoryEvent {
  event: string;
  ts: string;
  status?: DocumentStatus;
  by?: string;
  note?: string;
  where?: string;
  assignees_snapshot?: string[];
}

export interface Document {
  path: string;
  name: string;
  status: DocumentStatus;
  assignees: string[];
  history: HistoryEvent[];
  last_seen_in_concept: string | null;
  last_seen_in_approved: string | null;
  notes: string;
  ignored: boolean;
  from_concept: boolean;
  approved_from_concept: boolean;
  size: number;
  dup_concept_approved: boolean;
}

export interface Stats {
  total: number;
  concept: number;
  ongoing: number;
  stuck: number;
  'm.approved': number;
  approved: number;
  duplicates: number;
  openTasks: number;
}

export type IdeaStatus = 'new' | 'rejected' | 'in-progress' | 'done';

export interface IdeaMetadata {
  ipAddress?: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  screenResolution: string;
}

export interface Idea {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  votes: number;
  status: IdeaStatus;
  votedBy: Set<string>; // Voor tracking wie gestemd heeft (lokaal)
  metadata: IdeaMetadata;
  adminNote?: string; // Admin notitie voor het idee
}
