import { Injectable } from '@nestjs/common';
import { Verdict, OperationType, AuditCheckStatus, InputType } from '@marie/shared';
import type { Signal } from '@marie/shared';
import type { AuditCheck, AuditSection, AuditSeverity } from '@marie/shared';
import type { IAnalysisProvider, ProviderResult, SubOperationEmitter, SignalEmitter } from './analysis-provider.interface';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const MOCK_IMAGE_TEXT =
  '⚠️ [Chronopost] Votre colis est en attente de livraison. ' +
  'Des frais de douane impayés (1,99€) bloquent votre envoi. ' +
  'Réglez immédiatement : https://bit.ly/chr0n0-fr — ' +
  "Sans paiement sous 24h votre colis sera retourné à l'expéditeur.";

/** Groupes de règles — chaque groupe devient une sous-opération visible */
const RULE_GROUPS = [
  {
    type: OperationType.Analysis,
    label: 'Vérification des liens',
    rules: [
      {
        type: 'shortened_url', pattern: /bit\.ly|tinyurl|goo\.gl|ow\.ly|rb\.gy/i,
        label: 'Lien raccourci suspect', weight: 30,
        description: "Les liens raccourcis (bit.ly, tinyurl…) masquent la vraie destination. Les arnaqueurs s'en servent pour vous rediriger vers des sites piégés.",
      },
      {
        type: 'suspicious_link', pattern: /https?:\/\/[^\s]{30,}/i,
        label: 'Lien suspect (URL longue)', weight: 20,
        description: "Cette URL très longue ou inhabituelle ne correspond pas à un service légitime. Vérifiez l'adresse exacte avant de cliquer.",
      },
    ],
  },
  {
    type: OperationType.Analysis,
    label: "Détection de l'urgence",
    rules: [
      {
        type: 'urgency', pattern: /urgent|immédiatement|dans les \d+\s*h|expiré|24h|48h|retourné/i,
        label: 'Ton urgent ou menaçant', weight: 20,
        description: "Les messages qui créent une pression temporelle (« 24h », « immédiatement ») cherchent à vous empêcher de réfléchir. Prenez toujours le temps de vérifier.",
      },
      {
        type: 'fees_scam', pattern: /frais (de douane|de livraison|impayés?)|paiement (requis|nécessaire)/i,
        label: 'Faux frais à payer', weight: 25,
        description: "Aucun transporteur ou organisme officiel ne vous demandera de payer des frais impromptus par SMS ou email. C'est une arnaque classique.",
      },
    ],
  },
  {
    type: OperationType.Analysis,
    label: "Identification de l'expéditeur",
    rules: [
      {
        type: 'impersonation', pattern: /la poste|ameli|caf\b|cpam|impôts|dgfip|chronopost|colissimo|banque postale/i,
        label: "Usurpation d'organisme officiel", weight: 25,
        description: "Ce message usurpe l'identité d'un organisme connu (La Poste, CAF, banque…). Contactez toujours l'organisme via son site officiel pour vérifier.",
      },
      {
        type: 'account_threat', pattern: /compte.{0,25}(bloqué|suspendu|fermé|désactivé)/i,
        label: 'Menace de suspension', weight: 25,
        description: "La menace de blocage de compte est une technique d'intimidation courante. Votre banque ou service ne vous contacte jamais ainsi.",
      },
      {
        type: 'prize_scam', pattern: /gagné|gagnant|cadeau|récompense|offre exceptionnelle/i,
        label: 'Arnaque aux gains', weight: 20,
        description: "Vous n'avez participé à aucun concours ? Alors vous n'avez rien gagné. Ces messages servent à récupérer vos données personnelles.",
      },
    ],
  },
  {
    type: OperationType.Analysis,
    label: 'Recherche de demandes suspectes',
    rules: [
      {
        type: 'credential_request', pattern: /mot de passe|identifiant|informations? (bancaires?|personnelles?)/i,
        label: "Demande d'identifiants", weight: 35,
        description: "Aucun service légitime ne vous demande votre mot de passe ou vos coordonnées bancaires par message. Ne communiquez jamais ces informations.",
      },
      {
        type: 'otp_request', pattern: /code (otp|de vérification|reçu par sms|de confirmation)/i,
        label: 'Demande de code OTP', weight: 40,
        description: "Un code OTP est personnel et ne doit jamais être partagé. Si quelqu'un vous le demande, c'est pour accéder à votre compte à votre place.",
      },
    ],
  },
];

@Injectable()
export class MockAnalysisProvider implements IAnalysisProvider {
  async analyzeText(content: string, emitSub: SubOperationEmitter, emitSignal: SignalEmitter): Promise<ProviderResult> {
    await delay(200);
    const signals = await this.runGroups(content, emitSub, emitSignal);
    return this.buildResult(signals, InputType.Text);
  }

  async analyzeImage(_buffer: Buffer, _mimeType: string, emitSub: SubOperationEmitter, emitSignal: SignalEmitter): Promise<ProviderResult> {
    await emitSub(OperationType.Ocr, "Extraction du texte de l'image", async () => {
      await delay(400);
    });
    const signals = await this.runGroups(MOCK_IMAGE_TEXT, emitSub, emitSignal);
    const result = this.buildResult(signals, InputType.Image);
    result.notice = "Analyse IA non disponible (ANTHROPIC_API_KEY non configuré) — résultat basé sur des règles de détection de base.";
    return result;
  }

  // ─── Logique privée ───────────────────────────────────────────────

  private async runGroups(text: string, emitSub: SubOperationEmitter, emitSignal: SignalEmitter): Promise<Signal[]> {
    const allSignals: Signal[] = [];

    for (const group of RULE_GROUPS) {
      await emitSub(group.type, group.label, async () => {
        await delay(100 + Math.random() * 150);
        for (const rule of group.rules) {
          const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', '') + 'g');
          const match = pattern.exec(text);
          if (match) {
            allSignals.push({
              type: rule.type, label: rule.label, weight: rule.weight,
              description: rule.description,
              matchText: match[0].slice(0, 60),
              matchStart: match.index,
              matchEnd: match.index + match[0].length,
            });
          }
        }
        // Remonter les signaux trouvés jusqu'ici après chaque groupe
        if (allSignals.length > 0) emitSignal([...allSignals]);
      });
    }

    return allSignals;
  }

  private buildResult(signals: Signal[], inputType: InputType): ProviderResult & { notice?: string } {
    const riskScore  = Math.min(100, signals.reduce((s, r) => s + r.weight, 0));
    const confidence = Math.min(95, 55 + signals.length * 8);
    const verdict    = riskScore >= 70 ? Verdict.HighRisk : riskScore >= 40 ? Verdict.Suspicious : Verdict.LikelySafe;
    return {
      signals,
      riskScore,
      verdict,
      confidence,
      auditSections: this.buildAuditSections(signals, inputType),
      ...this.buildExplanation(signals, verdict, riskScore),
    };
  }

  private buildAuditSections(signals: Signal[], inputType: InputType): AuditSection[] {
    const buildCheck = (
      id: string,
      label: string,
      signalTypes: string[],
      passedSummary: string,
      flaggedSummary: string,
      unavailableSummary?: string,
    ): AuditCheck => {
      const matches = signals.filter((signal) => signalTypes.includes(signal.type));
      const status = matches.length > 0
        ? AuditCheckStatus.Flagged
        : unavailableSummary
          ? AuditCheckStatus.Unavailable
          : AuditCheckStatus.Passed;

      return {
        id,
        label,
        status,
        summary:
          status === AuditCheckStatus.Flagged
            ? flaggedSummary
            : status === AuditCheckStatus.Unavailable
              ? unavailableSummary!
              : passedSummary,
        signalTypes,
        evidences: matches.map((signal) => ({
          label: signal.label,
          excerpt: signal.matchText,
        })),
      };
    };

    const computeSeverity = (checks: AuditCheck[]): AuditSeverity => {
      const flaggedCount = checks.filter((check) => check.status === AuditCheckStatus.Flagged).length;
      if (flaggedCount >= 2) return 'danger';
      if (flaggedCount === 1) return 'warning';
      return 'info';
    };

    const buildSection = (id: string, label: string, checks: AuditCheck[]): AuditSection => {
      const flaggedChecks = checks.filter((check) => check.status === AuditCheckStatus.Flagged);
      const unavailableChecks = checks.filter((check) => check.status === AuditCheckStatus.Unavailable);
      let summary = 'Aucun élément problématique détecté dans cette famille de contrôles.';

      if (flaggedChecks.length > 0) {
        summary = `${flaggedChecks.length} contrôle${flaggedChecks.length > 1 ? 's' : ''} ont remonté un risque dans cette section.`;
      } else if (unavailableChecks.length > 0) {
        summary = 'Section partiellement renseignée avec les informations actuellement disponibles.';
      }

      return {
        id,
        label,
        severity: computeSeverity(checks),
        summary,
        checks,
      };
    };

    const sections: AuditSection[] = [
      buildSection('link-audit', 'Liens et destinations', [
        buildCheck(
          'shortened-links',
          'Masquage de destination',
          ['shortened_url'],
          'Aucun lien raccourci détecté.',
          'Un lien raccourci masque la destination réelle et augmente le risque.',
        ),
        buildCheck(
          'link-shape',
          'Structure de lien inhabituelle',
          ['suspicious_link'],
          'Aucune URL anormalement longue ou trompeuse détectée.',
          'Une URL longue ou inhabituelle a été détectée dans le contenu.',
        ),
      ]),
      buildSection('pressure-audit', 'Pression et manipulation', [
        buildCheck(
          'urgency-pressure',
          'Pression temporelle',
          ['urgency', 'account_threat'],
          'Le message ne force pas d’action immédiate.',
          'Le message pousse à agir vite ou menace de conséquences rapides.',
        ),
        buildCheck(
          'financial-pressure',
          'Demande financière opportuniste',
          ['fees_scam', 'prize_scam'],
          'Aucune demande d’argent ni promesse trop belle pour être vraie détectée.',
          'Le contenu utilise un prétexte financier classique d’arnaque.',
        ),
      ]),
      buildSection('identity-audit', 'Identité et crédibilité', [
        buildCheck(
          'sender-credibility',
          'Usurpation de confiance',
          ['impersonation'],
          'Aucun organisme sensible ou marque de confiance n’est usurpé ici.',
          'Le message semble emprunter l’identité d’un organisme ou service connu.',
        ),
      ]),
      buildSection('request-audit', 'Demandes sensibles', [
        buildCheck(
          'credential-request',
          'Collecte d’identifiants ou données',
          ['credential_request'],
          'Aucune demande directe de mot de passe ou d’information sensible détectée.',
          'Le contenu demande des informations qui ne devraient jamais être partagées par message.',
        ),
        buildCheck(
          'otp-request',
          'Collecte de code temporaire',
          ['otp_request'],
          'Aucun code OTP ou code de vérification n’est demandé.',
          'Le message cherche à obtenir un code de validation à usage unique.',
        ),
      ]),
    ];

    if (inputType === InputType.Image) {
      sections.push(
        buildSection('image-audit', 'Contexte image', [
          buildCheck(
            'ocr-source',
            'Lecture du texte de l’image',
            [],
            '',
            '',
            'Analyse fondée sur le texte extrait de l’image. Les éléments purement visuels ne sont pas encore audités.',
          ),
        ]),
      );
    }

    return sections;
  }

  private buildExplanation(signals: Signal[], verdict: Verdict, score: number) {
    if (verdict === Verdict.HighRisk) {
      return {
        shortSummary: `Arnaque très probable (score ${score}/100)`,
        explanation:
          `Ce message présente ${signals.length} signal${signals.length > 1 ? 's' : ''} caractéristique${signals.length > 1 ? 's' : ''} d'une arnaque : ` +
          signals.map((s) => s.label.toLowerCase()).join(', ') + '. ' +
          'Ce type de message cherche à vous pousser à agir vite sans réfléchir.',
        recommendedActions: [
          'Ne cliquez sur aucun lien dans ce message.',
          'Ne communiquez aucun code, mot de passe ou information bancaire.',
          'Signalez le message sur signal-spam.fr ou au 33700 (SMS).',
          'Si vous avez déjà cliqué, changez vos mots de passe immédiatement.',
        ],
      };
    }
    if (verdict === Verdict.Suspicious) {
      return {
        shortSummary: `Message douteux — prudence (score ${score}/100)`,
        explanation: `Ce message contient quelques éléments suspects (${signals.map((s) => s.label.toLowerCase()).join(', ')}). Il n'est pas forcément frauduleux, mais mérite vérification.`,
        recommendedActions: [
          'Vérifiez l\'expéditeur en le contactant via un canal officiel.',
          'Ne cliquez pas directement sur les liens.',
          'En cas de doute, appelez le service concerné.',
        ],
      };
    }
    return {
      shortSummary: `Aucun signal suspect détecté (score ${score}/100)`,
      explanation: 'Ce message ne présente pas de caractéristiques typiques des arnaques connues. Il semble légitime.',
      recommendedActions: ['Restez vigilant même sur des messages en apparence légitimes.'],
    };
  }
}
