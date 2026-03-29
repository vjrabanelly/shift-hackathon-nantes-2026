import type { Signal, Verdict, OperationType, AuditSection } from '@marie/shared';

export const ANALYSIS_PROVIDER = Symbol('ANALYSIS_PROVIDER');

export interface ProviderResult {
  signals: Signal[];
  riskScore: number;
  verdict: Verdict;
  confidence: number;
  auditSections: AuditSection[];
  shortSummary: string;
  explanation: string;
  recommendedActions: string[];
  notice?: string;
}

/** Fonction passée au provider pour émettre des sous-opérations en temps réel */
export type SubOperationEmitter = (
  operationType: OperationType,
  label: string,
  fn: () => Promise<void>,
) => Promise<void>;

/** Fonction passée au provider pour remonter des signaux au fil de la détection */
export type SignalEmitter = (signals: Signal[]) => void;

export interface IAnalysisProvider {
  analyzeText(content: string, emitSub: SubOperationEmitter, emitSignal: SignalEmitter): Promise<ProviderResult>;
  analyzeImage(buffer: Buffer, mimeType: string, emitSub: SubOperationEmitter, emitSignal: SignalEmitter): Promise<ProviderResult>;
}
