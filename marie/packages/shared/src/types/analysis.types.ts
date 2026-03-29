export enum Verdict {
  LikelySafe = 'likely_safe',
  Suspicious = 'suspicious',
  HighRisk = 'high_risk',
}

export enum AnalysisStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

export enum InputType {
  Text = 'text',
  Image = 'image',
}

export interface Signal {
  type: string;
  label: string;
  weight: number;
  description?: string; // explication pédagogique affichée dans l'UI
  matchText?: string;   // extrait du texte qui a déclenché ce signal
  matchStart?: number;  // position dans le texte original
  matchEnd?: number;
}

export enum AuditCheckStatus {
  Passed = 'passed',
  Flagged = 'flagged',
  Unavailable = 'unavailable',
}

export type AuditSeverity = 'info' | 'warning' | 'danger';

export interface AuditEvidence {
  label: string;
  excerpt?: string;
  value?: string;
}

export interface AuditCheck {
  id: string;
  label: string;
  status: AuditCheckStatus;
  summary: string;
  signalTypes: string[];
  evidences: AuditEvidence[];
}

export interface AuditSection {
  id: string;
  label: string;
  severity: AuditSeverity;
  summary: string;
  checks: AuditCheck[];
}

export interface AnalysisResult {
  riskScore: number;
  verdict: Verdict;
  confidence: number;
  signals: Signal[];
  auditSections: AuditSection[];
  shortSummary: string;
  explanation: string;
  recommendedActions: string[];
  notice?: string; // message informatif affiché dans l'UI (ex: analyse IA non disponible)
}

export interface Analysis {
  id: string;
  status: AnalysisStatus;
  inputType: InputType;
  rawContent: string | null;
  createdAt: string;
  completedAt: string | null;
  result: AnalysisResult | null;
}

