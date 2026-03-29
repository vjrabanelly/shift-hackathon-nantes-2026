import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  SseEventType, OperationType, AnalysisStatus, InputType,
  type AnalysisResult, type SseEvent,
} from '@marie/shared';
import { StreamingService } from '../modules/streaming/streaming.service';
import { InMemoryStore } from '../modules/analyses/in-memory.store';
import { ANALYSIS_PROVIDER, type IAnalysisProvider, type ProviderResult, type SubOperationEmitter, type SignalEmitter } from '../modules/provider/analysis-provider.interface';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

@Injectable()
export class AnalysisOrchestrator {
  private readonly logger = new Logger(AnalysisOrchestrator.name);

  constructor(
    private readonly streaming: StreamingService,
    private readonly store: InMemoryStore,
    @Inject(ANALYSIS_PROVIDER) private readonly provider: IAnalysisProvider,
  ) {}

  // ─── Entrées publiques ────────────────────────────────────────────

  async runTextAnalysis(analysisId: string, content: string): Promise<void> {
    const emit = this.emitter(analysisId);
    try {
      this.store.updateStatus(analysisId, AnalysisStatus.Running);
      emit(SseEventType.AnalysisCreated, { inputType: InputType.Text });

      // Étape 1 — ingestion (séquentielle)
      await this.runOperation(analysisId, OperationType.Ingestion, 'Lecture du message', async () => {
        await delay(300);
        return {};
      });

      // Étape 2 — appel provider avec sous-opérations
      let providerResult!: ProviderResult;
      await this.runOperation(analysisId, OperationType.Analysis, 'Analyse du contenu', async (opId) => {
        providerResult = await this.provider.analyzeText(content, this.makeSubEmitter(analysisId, opId), this.makeSignalEmitter(analysisId));
        return {};
      });

      // Étapes 3 & 4 — scoring + explication en parallèle
      await Promise.all([
        this.runOperation(analysisId, OperationType.Scoring, 'Calcul du score de risque', async () => {
          await delay(200);
          emit(SseEventType.SignalsDetected, { signals: providerResult.signals, count: providerResult.signals.length });
          emit(SseEventType.ScoreUpdated, { riskScore: providerResult.riskScore, verdict: providerResult.verdict, confidence: providerResult.confidence });
          return {};
        }),
        this.runOperation(analysisId, OperationType.Explanation, 'Génération des conseils', async () => {
          await delay(350);
          emit(SseEventType.ExplanationGenerated, {
            shortSummary: providerResult.shortSummary,
            explanation: providerResult.explanation,
            recommendedActions: providerResult.recommendedActions,
          });
          return {};
        }),
      ]);

      const result: AnalysisResult = {
        riskScore: providerResult.riskScore,
        verdict: providerResult.verdict,
        confidence: providerResult.confidence,
        signals: providerResult.signals,
        auditSections: providerResult.auditSections,
        shortSummary: providerResult.shortSummary,
        explanation: providerResult.explanation,
        recommendedActions: providerResult.recommendedActions,
        notice: providerResult.notice,
      };

      this.store.updateResult(analysisId, result);
      emit(SseEventType.AnalysisCompleted, result);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      this.logger.error(`[text:${analysisId}] ${message}`, err instanceof Error ? err.stack : undefined);
      emit(SseEventType.AnalysisFailed, { error: message });
      this.store.setFailed(analysisId);
    } finally {
      this.streaming.complete(analysisId);
    }
  }

  async runImageAnalysis(analysisId: string, buffer: Buffer, mimeType: string): Promise<void> {
    const emit = this.emitter(analysisId);
    try {
      this.store.updateStatus(analysisId, AnalysisStatus.Running);
      emit(SseEventType.AnalysisCreated, { inputType: InputType.Image });

      // Étape 1 — analyse image (OCR + détection, gérés par le provider via sous-opérations)
      let providerResult!: ProviderResult;
      await this.runOperation(analysisId, OperationType.Analysis, "Analyse de l'image", async (opId) => {
        providerResult = await this.provider.analyzeImage(buffer, mimeType, this.makeSubEmitter(analysisId, opId), this.makeSignalEmitter(analysisId));
        return {};
      });

      await Promise.all([
        this.runOperation(analysisId, OperationType.Scoring, 'Calcul du score de risque', async () => {
          await delay(200);
          emit(SseEventType.SignalsDetected, { signals: providerResult.signals, count: providerResult.signals.length });
          emit(SseEventType.ScoreUpdated, { riskScore: providerResult.riskScore, verdict: providerResult.verdict, confidence: providerResult.confidence });
          return {};
        }),
        this.runOperation(analysisId, OperationType.Explanation, 'Génération des conseils', async () => {
          await delay(350);
          emit(SseEventType.ExplanationGenerated, {
            shortSummary: providerResult.shortSummary,
            explanation: providerResult.explanation,
            recommendedActions: providerResult.recommendedActions,
          });
          return {};
        }),
      ]);

      const result: AnalysisResult = {
        riskScore: providerResult.riskScore,
        verdict: providerResult.verdict,
        confidence: providerResult.confidence,
        signals: providerResult.signals,
        auditSections: providerResult.auditSections,
        shortSummary: providerResult.shortSummary,
        explanation: providerResult.explanation,
        recommendedActions: providerResult.recommendedActions,
        notice: providerResult.notice,
      };

      this.store.updateResult(analysisId, result);
      emit(SseEventType.AnalysisCompleted, result);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      this.logger.error(`[image:${analysisId}] ${message}`, err instanceof Error ? err.stack : undefined);
      emit(SseEventType.AnalysisFailed, { error: message });
      this.store.setFailed(analysisId);
    } finally {
      this.streaming.complete(analysisId);
    }
  }

  // ─── Helpers privés ───────────────────────────────────────────────

  /**
   * Enveloppe une étape avec operation.started / operation.completed / operation.failed.
   * Chaque opération a son propre UUID indépendant de l'analysisId.
   */
  private async runOperation<T>(
    analysisId: string,
    operationType: OperationType,
    label: string,
    fn: (operationId: string) => Promise<T>,
    parentOperationId?: string,
  ): Promise<T> {
    const operationId = uuidv4();
    const emit = this.emitter(analysisId);
    const startedAt = Date.now();

    emit(SseEventType.OperationStarted, { operationId, operationType, label, parentOperationId });

    try {
      const result = await fn(operationId);
      emit(SseEventType.OperationCompleted, { operationId, operationType, durationMs: Date.now() - startedAt, parentOperationId });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Erreur inconnue';
      this.logger.warn(`[op:${operationType}] "${label}" failed — ${error}`);
      emit(SseEventType.OperationFailed, { operationId, operationType, error, durationMs: Date.now() - startedAt, parentOperationId });
      throw err;
    }
  }

  /** Crée un émetteur de signaux partiels (pendant l'analyse) */
  private makeSignalEmitter(analysisId: string): SignalEmitter {
    const emit = this.emitter(analysisId);
    return (signals) => emit(SseEventType.SignalsDetected, { signals, count: signals.length });
  }

  /** Crée un émetteur de sous-opérations lié à une opération parente */
  private makeSubEmitter(analysisId: string, parentOperationId: string): SubOperationEmitter {
    return (operationType, label, fn) =>
      this.runOperation<void>(analysisId, operationType, label, async () => { await fn(); }, parentOperationId);
  }

  private emitter(analysisId: string) {
    return (type: SseEventType, data: unknown) => {
      this.streaming.sendEvent(analysisId, {
        event: type,
        analysisId,
        timestamp: new Date().toISOString(),
        data,
      } as SseEvent);
    };
  }
}
