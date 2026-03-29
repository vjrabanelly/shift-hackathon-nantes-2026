import type { AnalysisResult, Signal, Verdict } from './analysis.types';

export enum SseEventType {
  // ── Cycle de vie de l'analyse ──────────────────────────────────
  AnalysisCreated   = 'analysis.created',
  AnalysisCompleted = 'analysis.completed',
  AnalysisFailed    = 'analysis.failed',

  // ── Opérations individuelles (avec ID propre) ──────────────────
  OperationStarted  = 'operation.started',
  OperationCompleted= 'operation.completed',
  OperationFailed   = 'operation.failed',

  // ── Résultats métier (portés par les opérations) ───────────────
  SignalsDetected     = 'signals.detected',
  ScoreUpdated        = 'score.updated',
  ExplanationGenerated= 'explanation.generated',
}

export enum OperationType {
  Ingestion  = 'ingestion',
  Ocr        = 'ocr',
  Analysis   = 'analysis',
  Scoring    = 'scoring',
  Explanation= 'explanation',
}

// ── Base ──────────────────────────────────────────────────────────

export interface SseEventBase {
  event: SseEventType;
  analysisId: string;
  timestamp: string;
}

// ── Cycle de vie ──────────────────────────────────────────────────

export interface AnalysisCreatedEvent extends SseEventBase {
  event: SseEventType.AnalysisCreated;
  data: { inputType: string };
}

export interface AnalysisCompletedEvent extends SseEventBase {
  event: SseEventType.AnalysisCompleted;
  data: AnalysisResult;
}

export interface AnalysisFailedEvent extends SseEventBase {
  event: SseEventType.AnalysisFailed;
  data: { error: string };
}

// ── Opérations ───────────────────────────────────────────────────

export interface OperationStartedEvent extends SseEventBase {
  event: SseEventType.OperationStarted;
  data: {
    operationId: string;
    operationType: OperationType;
    label: string;
    parentOperationId?: string; // défini si c'est une sous-opération
  };
}

export interface OperationCompletedEvent extends SseEventBase {
  event: SseEventType.OperationCompleted;
  data: {
    operationId: string;
    operationType: OperationType;
    durationMs: number;
    parentOperationId?: string;
  };
}

export interface OperationFailedEvent extends SseEventBase {
  event: SseEventType.OperationFailed;
  data: {
    operationId: string;
    operationType: OperationType;
    error: string;
    durationMs: number;
    parentOperationId?: string;
  };
}

// ── Résultats métier ──────────────────────────────────────────────

export interface SignalsDetectedEvent extends SseEventBase {
  event: SseEventType.SignalsDetected;
  data: { signals: Signal[]; count: number };
}

export interface ScoreUpdatedEvent extends SseEventBase {
  event: SseEventType.ScoreUpdated;
  data: { riskScore: number; verdict: Verdict; confidence: number };
}

export interface ExplanationGeneratedEvent extends SseEventBase {
  event: SseEventType.ExplanationGenerated;
  data: { shortSummary: string; explanation: string; recommendedActions: string[] };
}

// ── Union ─────────────────────────────────────────────────────────

export type SseEvent =
  | AnalysisCreatedEvent
  | AnalysisCompletedEvent
  | AnalysisFailedEvent
  | OperationStartedEvent
  | OperationCompletedEvent
  | OperationFailedEvent
  | SignalsDetectedEvent
  | ScoreUpdatedEvent
  | ExplanationGeneratedEvent;
