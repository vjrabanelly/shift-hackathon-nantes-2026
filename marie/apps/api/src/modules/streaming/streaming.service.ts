import { Injectable, Logger } from '@nestjs/common';
import { ReplaySubject, Observable } from 'rxjs';
import type { SseEvent } from '@marie/shared';

/** Durée de rétention d'un stream après complétion (ms) */
const STREAM_TTL_MS = 60_000;

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly streams = new Map<string, ReplaySubject<SseEvent>>();

  /**
   * Crée un stream pour une nouvelle analyse.
   * ReplaySubject bufferise tous les events : un frontend qui se connecte
   * en retard (ou se reconnecte) reçoit l'intégralité des events passés.
   */
  createStream(analysisId: string): void {
    if (!this.streams.has(analysisId)) {
      this.streams.set(analysisId, new ReplaySubject<SseEvent>());
    }
  }

  /**
   * Retourne l'observable du stream — null si l'analyse est inconnue.
   * Fonctionne même après complétion (ReplaySubject rejoue les events).
   */
  getStream(analysisId: string): Observable<SseEvent> | null {
    return this.streams.get(analysisId) ?? null;
  }

  /** Pousse un event vers tous les abonnés actifs de cette analyse. */
  sendEvent(analysisId: string, event: SseEvent): void {
    this.streams.get(analysisId)?.next(event);
  }

  /**
   * Termine le stream et programme son nettoyage après STREAM_TTL_MS.
   * Pendant ce délai, un frontend peut encore se connecter et rejouer
   * tous les events depuis le début.
   */
  complete(analysisId: string): void {
    const subject = this.streams.get(analysisId);
    if (!subject) return;

    subject.complete();

    setTimeout(() => {
      this.streams.delete(analysisId);
      this.logger.debug(`Stream ${analysisId} nettoyé`);
    }, STREAM_TTL_MS);
  }

  /** Nombre de streams actifs (utile pour le monitoring). */
  activeCount(): number {
    return this.streams.size;
  }
}
