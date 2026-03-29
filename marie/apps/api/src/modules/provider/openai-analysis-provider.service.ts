import { Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";
import {
  AuditCheckStatus,
  InputType,
  OperationType,
  Verdict,
} from "@marie/shared";
import type {
  AuditCheck,
  AuditSection,
  AuditSeverity,
  Signal,
} from "@marie/shared";
import type {
  IAnalysisProvider,
  ProviderResult,
  SignalEmitter,
  SubOperationEmitter,
} from "./analysis-provider.interface";
import { inspect } from "node:util";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Types internes ───────────────────────────────────────────────────────────

interface RawSignal {
  type: string;
  label: string;
  weight: number;
  description: string;
  excerpt: string | null;
  matchStart: number | null;
  matchEnd: number | null;
}

interface ImageResult {
  imageType: string;
  platform: string | null;
  isAiGenerated: boolean;
  aiGeneratedConfidence: number;
  aiGeneratedReason: string | null;
  extractedText: string;
  sender: string | null;
  timestamp: string | null;
  subject: string | null;
  links: string[];
  hasQrCode: boolean;
  claimedOrganization: string | null;
  fraudSignals: RawSignal[];
  summary: string;
}

interface MetadataResult {
  sender: string | null;
  claimedOrganization: string | null;
}

interface SignalsResult {
  fraudSignals: RawSignal[];
  summary: string;
}

interface VtUrlStats {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
}

interface VisionWebDetection {
  fullMatchingImages?: { url: string }[];
  partialMatchingImages?: { url: string }[];
  webEntities?: { description: string; score: number }[];
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

const SIGNAL_TYPES = `Signal types (use exactly these type values):
Direct fraud: shortened_url | suspicious_link | urgency | fees_scam | impersonation | account_threat | prize_scam | credential_request | otp_request
Psychological manipulation: authority_manipulation | fear_manipulation | false_legitimacy | isolation_tactic | artificial_scarcity
Visual (image only): ai_generated | official_logo_misuse | qr_code_redirect | visual_manipulation`;

const META_SCHEMA = `{"sender": "string|null (phone/name)", "claimedOrganization": "string|null (org the message pretends to be from)"}`;

const FRAUD_SCHEMA = `{"fraudSignals": [{"type": "string", "label": "string (French, short)", "weight": number (10-40), "description": "string (French)", "excerpt": "string|null", "matchStart": number|null, "matchEnd": number|null}], "summary": "string (one sentence in French)"}`;

const PSYCH_SCHEMA = `{"fraudSignals": [{"type": "string", "label": "string (French, short)", "weight": number (10-40), "description": "string (French, explain the tactic)", "excerpt": "string|null", "matchStart": number|null, "matchEnd": number|null}]}`;

const IMAGE_SCHEMA = `{
  "imageType": "sms_screenshot|whatsapp_screenshot|email_screenshot|chat_screenshot|document|photo|unknown",
  "platform": "string|null",
  "isAiGenerated": boolean,
  "aiGeneratedConfidence": number (0-100),
  "aiGeneratedReason": "string|null",
  "extractedText": "string (ALL visible text)",
  "sender": "string|null",
  "timestamp": "string|null",
  "subject": "string|null",
  "links": ["string"],
  "hasQrCode": boolean,
  "claimedOrganization": "string|null",
  "fraudSignals": [{ "type": "string", "label": "string (French, short)", "weight": number (10-40), "description": "string (French + psychological tactic)", "excerpt": "string|null", "matchStart": null, "matchEnd": null }],
  "summary": "string (one French sentence)"
}`;

// ─── Provider ─────────────────────────────────────────────────────────────────

@Injectable()
export class OpenAiAnalysisProvider implements IAnalysisProvider {
  private readonly logger = new Logger(OpenAiAnalysisProvider.name);
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // ── Texte ──────────────────────────────────────────────────────────────────

  async analyzeText(
    content: string,
    emitSub: SubOperationEmitter,
    emitSignal: SignalEmitter,
  ): Promise<ProviderResult> {
    const regexUrls = this.extractUrls(content);
    let sender: string | null = null;
    let claimedOrg: string | null = null;
    let summary = '';
    let signals: Signal[] = [];

    // ── Étape 1 : métadonnées ──────────────────────────────────────────────────
    await emitSub(OperationType.Analysis, "Extraction des métadonnées", async () => {
      try {
        const res = await this.client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are a message parser. Return ONLY valid JSON." },
            { role: "user", content: `Extract metadata from this message. Return: ${META_SCHEMA}\n\nMessage:\n${content}` },
          ],
        });
        const r = this.parseJson<MetadataResult>(res.choices[0]?.message.content ?? '', { sender: null, claimedOrganization: null });
        sender = r.sender;
        claimedOrg = r.claimedOrganization;
      } catch (err) {
        this.logger.warn(inspect(err, { depth: null }));
        if (err instanceof OpenAI.RateLimitError) { this.logger.warn('OpenAI rate limit (metadata)'); return; }
        this.logger.error('OpenAI metadata extraction failed', err instanceof Error ? err.stack : String(err));
      }
    });

    // ── Étape 2 : fraudes directes ─────────────────────────────────────────────
    await emitSub(OperationType.Analysis, "Détection des fraudes directes", async () => {
      try {
        const res = await this.client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are a fraud detection expert for French messages. Return ONLY valid JSON." },
            { role: "user", content: `Detect direct fraud signals. Return: ${FRAUD_SCHEMA}\n\nUse only these types: shortened_url | suspicious_link | urgency | fees_scam | impersonation | account_threat | prize_scam | credential_request | otp_request\n\nMessage:\n${content}` },
          ],
        });
        const r = this.parseJson<SignalsResult>(res.choices[0]?.message.content ?? '', { fraudSignals: [], summary: '' });
        signals = [...signals, ...this.mapSignals(r.fraudSignals)];
        if (!summary) summary = r.summary;
        if (signals.length > 0) emitSignal(signals);
      } catch (err) {
        this.logger.warn(inspect(err, { depth: null }));
        if (err instanceof OpenAI.RateLimitError) { this.logger.warn('OpenAI rate limit (fraud)'); return; }
        this.logger.error('OpenAI fraud detection failed', err instanceof Error ? err.stack : String(err));
      }
    });

    // ── Étape 3 : manipulation psychologique ───────────────────────────────────
    await emitSub(OperationType.Analysis, "Analyse des manipulations psychologiques", async () => {
      try {
        const res = await this.client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are a social engineering expert. Return ONLY valid JSON." },
            { role: "user", content: `Detect psychological manipulation tactics. Return: ${PSYCH_SCHEMA}\n\nUse only these types: authority_manipulation | fear_manipulation | false_legitimacy | isolation_tactic | artificial_scarcity\n\nExamples:\n- authority_manipulation: false authority claims (weight 25)\n- fear_manipulation: account closure threat (weight 30)\n- false_legitimacy: fake case numbers, official-sounding language (weight 20)\n- isolation_tactic: "don't tell anyone" (weight 35)\n- artificial_scarcity: "2h only", "last chance" (weight 20)\n\nMessage:\n${content}` },
          ],
        });
        const r = this.parseJson<{ fraudSignals: RawSignal[] }>(res.choices[0]?.message.content ?? '', { fraudSignals: [] });
        const psychSignals = this.mapSignals(r.fraudSignals);
        signals = [...signals, ...psychSignals];
        if (psychSignals.length > 0) emitSignal(signals);
      } catch (err) {
        this.logger.warn(inspect(err, { depth: null }));
        if (err instanceof OpenAI.RateLimitError) { this.logger.warn('OpenAI rate limit (psychology)'); return; }
        this.logger.error('OpenAI psychology analysis failed', err instanceof Error ? err.stack : String(err));
      }
    });

    // ── Étapes 4 & 5 : enrichissements ────────────────────────────────────────
    const vtSignals = await this.checkUrlReputation(regexUrls, emitSub, signals);
    signals = [...signals, ...vtSignals];
    if (vtSignals.length > 0) emitSignal(signals);

    const senderSignals = await this.verifySender(sender, claimedOrg, emitSub, signals);
    signals = [...signals, ...senderSignals];
    if (senderSignals.length > 0) emitSignal(signals);

    return this.buildResult(signals, InputType.Text, summary);
  }

  // ── Image ──────────────────────────────────────────────────────────────────

  async analyzeImage(
    buffer: Buffer,
    mimeType: string,
    emitSub: SubOperationEmitter,
    emitSignal: SignalEmitter,
  ): Promise<ProviderResult> {
    let rawImageResult: ImageResult | null = null;
    let rateLimited = false;

    await emitSub(OperationType.Ocr, "Lecture de l'image par IA", async () => {
      try {
        const base64 = buffer.toString("base64");
        const res = await this.client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are a cybersecurity expert specializing in scam image analysis. Return ONLY valid JSON.",
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64}` },
                },
                {
                  type: "text",
                  text:
                    `Analyze this image for scams, manipulation, and fraud. Return this JSON schema:\n${IMAGE_SCHEMA}\n\n${SIGNAL_TYPES}\n\nPay special attention to:\n- Official logos used fraudulently (La Poste, CAF, banks, AMELI…)\n- AI-generated or manipulated images (artifacts, inconsistent shadows, garbled text)\n- QR codes with unknown destinations\n- Psychological manipulation tactics`,
                },
              ],
            },
          ],
          max_tokens: 2048,
        });
        rawImageResult = this.parseJson<ImageResult | null>(
          res.choices[0]?.message.content ?? "",
          null,
        );
      } catch (err) {
        this.logger.warn(inspect(err, { depth: null }));

        if (err instanceof OpenAI.RateLimitError) {
          this.logger.warn("OpenAI rate limit hit (image)");
          rateLimited = true;
          return;
        }
        this.logger.error(
          "OpenAI image analysis failed",
          err instanceof Error ? err.stack : String(err),
        );
        throw err;
      }
    });

    if (rateLimited) {
      return {
        ...this.buildResult([], InputType.Image, ""),
        notice: "Quota OpenAI dépassé. Réessayez dans quelques instants.",
      };
    }

    if (rawImageResult === null) {
      return this.buildResult(
        [],
        InputType.Image,
        "Impossible d'analyser l'image.",
      );
    }
    const ir: ImageResult = rawImageResult;

    let signals = this.mapSignals(ir.fraudSignals);

    if (ir.isAiGenerated && ir.aiGeneratedConfidence >= 55) {
      signals.push({
        type: "ai_generated",
        label: "Contenu potentiellement généré par IA",
        weight: 25,
        description: ir.aiGeneratedReason ??
          "Cette image présente des caractéristiques d'un contenu généré ou manipulé par IA.",
      });
    }

    if (ir.hasQrCode) {
      signals.push({
        type: "qr_code_redirect",
        label: "QR code présent",
        weight: 20,
        description:
          "Un QR code peut rediriger vers n'importe quelle URL. Ne le scannez pas si vous doutez de la source.",
      });
    }

    emitSignal(signals);

    const webSignals = await this.searchImageOnWeb(buffer, emitSub, signals);
    signals = [...signals, ...webSignals];
    if (webSignals.length > 0) emitSignal(signals);

    const vtSignals = await this.checkUrlReputation(
      ir.links ?? [],
      emitSub,
      signals,
    );
    signals = [...signals, ...vtSignals];
    if (vtSignals.length > 0) emitSignal(signals);

    const senderSignals = await this.verifySender(
      ir.sender,
      ir.claimedOrganization,
      emitSub,
      signals,
    );
    signals = [...signals, ...senderSignals];
    if (senderSignals.length > 0) emitSignal(signals);

    const summary = [
      ir.summary,
      ir.extractedText
        ? `\n\nTexte extrait : « ${ir.extractedText.slice(0, 300)}${
          ir.extractedText.length > 300 ? "…" : ""
        } »`
        : "",
      ir.sender ? `\nExpéditeur : ${ir.sender}` : "",
      ir.timestamp ? ` · ${ir.timestamp}` : "",
      ir.platform ? ` · Plateforme : ${ir.platform}` : "",
    ].join("");

    return this.buildResult(signals, InputType.Image, summary);
  }

  // ── Enrichissements ───────────────────────────────────────────────────────

  private async checkUrlReputation(
    urls: string[],
    emitSub: SubOperationEmitter,
    currentSignals: Signal[],
  ): Promise<Signal[]> {
    const newSignals: Signal[] = [];

    await emitSub(
      OperationType.Analysis,
      "Vérification de réputation des liens (VirusTotal)",
      async () => {
        const apiKey = process.env.VIRUSTOTAL_API_KEY;
        if (!apiKey || urls.length === 0) return;
        for (const url of urls.slice(0, 4)) {
          try {
            const urlId = Buffer.from(url).toString("base64url").replace(
              /=/g,
              "",
            );
            const res = await fetch(
              `https://www.virustotal.com/api/v3/urls/${urlId}`,
              {
                headers: { "x-apikey": apiKey },
              },
            );
            if (!res.ok) { this.logger.warn(`VirusTotal returned ${res.status} for ${url.slice(0, 60)}`); continue; }
            const data = await res.json() as {
              data: { attributes: { last_analysis_stats: VtUrlStats } };
            };
            const stats = data.data.attributes.last_analysis_stats;
            if (stats.malicious >= 2) {
              newSignals.push({
                type: "malicious_url_confirmed",
                label: "URL malveillante confirmée",
                weight: 40,
                description:
                  `${stats.malicious} moteur(s) de sécurité ont identifié cette URL comme malveillante sur VirusTotal.`,
                matchText: url.slice(0, 80),
              });
            } else if (stats.malicious === 1 || stats.suspicious >= 2) {
              newSignals.push({
                type: "suspicious_url_flagged",
                label: "URL signalée comme suspecte",
                weight: 25,
                description: `Cette URL a été signalée suspecte par ${
                  stats.malicious + stats.suspicious
                } moteur(s) sur VirusTotal.`,
                matchText: url.slice(0, 80),
              });
            }
          } catch (err) { this.logger.warn(`VirusTotal lookup failed for ${url}: ${err instanceof Error ? err.message : String(err)}`); }
        }
      },
    );

    return newSignals;
  }

  private async searchImageOnWeb(
    buffer: Buffer,
    emitSub: SubOperationEmitter,
    currentSignals: Signal[],
  ): Promise<Signal[]> {
    const newSignals: Signal[] = [];

    await emitSub(
      OperationType.Analysis,
      "Recherche d'image inversée (Google Vision)",
      async () => {
        const apiKey = process.env.GOOGLE_VISION_API_KEY;
        if (!apiKey) return;
        try {
          const res = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requests: [{
                  image: { content: buffer.toString("base64") },
                  features: [{ type: "WEB_DETECTION", maxResults: 10 }, {
                    type: "LOGO_DETECTION",
                    maxResults: 5,
                  }],
                }],
              }),
            },
          );
          if (!res.ok) { this.logger.warn(`Google Vision returned ${res.status}`); return; }
          const data = await res.json() as {
            responses: [
              {
                webDetection?: VisionWebDetection;
                logoAnnotations?: { description: string }[];
              },
            ];
          };
          const web = data.responses[0]?.webDetection;
          const logos = data.responses[0]?.logoAnnotations ?? [];

          if ((web?.fullMatchingImages?.length ?? 0) > 0) {
            newSignals.push({
              type: "recycled_image",
              label: "Image identique déjà répertoriée en ligne",
              weight: 35,
              description: `Cette image exacte apparaît sur ${
                web!.fullMatchingImages!.length
              } page(s) web — probablement recyclée d'une campagne d'arnaque.`,
            });
          } else if ((web?.partialMatchingImages?.length ?? 0) >= 3) {
            newSignals.push({
              type: "template_image",
              label: "Image similaire à un modèle existant",
              weight: 20,
              description: `Cette image ressemble à ${
                web!.partialMatchingImages!.length
              } visuels répertoriés en ligne — possible template d'arnaque.`,
            });
          }
          if (logos.length > 0) {
            const names = logos.map((l) => l.description).join(", ");
            const alreadyFlagged = currentSignals.some((s) =>
              ["official_logo_misuse", "impersonation"].includes(s.type)
            );
            if (!alreadyFlagged) {
              newSignals.push({
                type: "official_logo_detected",
                label: `Logo officiel détecté : ${names}`,
                weight: 15,
                description:
                  `Le logo de "${names}" est présent. Vérifiez que ce message provient bien du canal officiel de cet organisme.`,
              });
            }
          }
        } catch (err) { this.logger.warn(`Google Vision failed: ${err instanceof Error ? err.message : String(err)}`); }
      },
    );

    return newSignals;
  }

  private async verifySender(
    sender: string | null,
    claimedOrg: string | null,
    emitSub: SubOperationEmitter,
    currentSignals: Signal[],
  ): Promise<Signal[]> {
    const newSignals: Signal[] = [];

    await emitSub(
      OperationType.Analysis,
      "Vérification de l'expéditeur",
      async () => {
        if (!sender) return;
        const clean = sender.replace(/\s/g, "");
        const isFrenchMobile = /^(\+33[67]|0[67])\d{8}$/.test(clean);
        const isForeignNonEU =
          /^\+(?!33|32|49|39|34|31|41|44|352|353|358|47|46|45|351|30|48|420|421|36|40|359|371|370|372|356|357|386|385|387|381|382|383|389|355|373)/
            .test(clean);

        if (isFrenchMobile && claimedOrg) {
          newSignals.push({
            type: "sender_format_mismatch",
            label: "Expéditeur mobile incompatible avec un organisme",
            weight: 30,
            description:
              `Le numéro mobile "${sender}" est utilisé pour imiter "${claimedOrg}". Les organismes légitimes utilisent des numéros courts ou des expéditeurs nommés.`,
            matchText: sender,
          });
        }

        const numKey = process.env.NUMVERIFY_API_KEY;
        if (numKey && isFrenchMobile) {
          try {
            const normalized = clean.startsWith("0")
              ? clean.replace(/^0/, "+33")
              : clean;
            const r = await fetch(
              `http://apilayer.net/api/validate?access_key=${numKey}&number=${
                encodeURIComponent(normalized)
              }&country_code=FR`,
            );
            const d = await r.json() as {
              valid: boolean;
              line_type: string;
              carrier: string;
            };
            if (d.valid && d.line_type === "mobile" && claimedOrg) {
              newSignals.push({
                type: "carrier_mismatch",
                label: `Ligne mobile (${d.carrier}) incompatible`,
                weight: 20,
                description:
                  `Ce numéro est une ligne mobile ${d.carrier}. Incompatible avec un expéditeur professionnel comme "${claimedOrg}".`,
                matchText: sender,
              });
            }
          } catch (err) { this.logger.warn(`Numverify failed: ${err instanceof Error ? err.message : String(err)}`); }
        }

        if (isForeignNonEU && claimedOrg) {
          newSignals.push({
            type: "foreign_number_impersonation",
            label: "Numéro étranger imitant un organisme français",
            weight: 30,
            description:
              `Ce message provient d'un numéro international (${sender}) mais prétend émaner de "${claimedOrg}".`,
            matchText: sender,
          });
        }

        await delay(50);
      },
    );

    return newSignals;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private extractUrls(text: string): string[] {
    const matches = text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
    return [...new Set(matches)];
  }

  private mapSignals(raw: RawSignal[]): Signal[] {
    return (raw ?? []).map((s) => ({
      type: s.type,
      label: s.label,
      weight: Math.min(40, Math.max(5, s.weight ?? 10)),
      description: s.description,
      matchText: s.excerpt ?? undefined,
      matchStart: s.matchStart ?? undefined,
      matchEnd: s.matchEnd ?? undefined,
    }));
  }

  private parseJson<T>(text: string, fallback: T): T {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ??
        text.match(/(\{[\s\S]*\})/);
      return JSON.parse(match ? match[1] : text) as T;
    } catch {
      return fallback;
    }
  }

  private buildResult(
    signals: Signal[],
    inputType: InputType,
    summary: string,
  ): ProviderResult {
    const riskScore = Math.min(100, signals.reduce((s, r) => s + r.weight, 0));
    const confidence = Math.min(95, 72 + signals.length * 4);
    const verdict = riskScore >= 70
      ? Verdict.HighRisk
      : riskScore >= 40
      ? Verdict.Suspicious
      : Verdict.LikelySafe;
    return {
      signals,
      riskScore,
      verdict,
      confidence,
      auditSections: this.buildAuditSections(signals, inputType),
      ...this.buildExplanation(signals, verdict, riskScore, summary),
    };
  }

  private buildAuditSections(
    signals: Signal[],
    inputType: InputType,
  ): AuditSection[] {
    const check = (
      id: string,
      label: string,
      types: string[],
      passedSummary: string,
      flaggedSummary: string,
      unavailableSummary?: string,
    ): AuditCheck => {
      const matches = signals.filter((s) => types.includes(s.type));
      const status = matches.length > 0
        ? AuditCheckStatus.Flagged
        : unavailableSummary
        ? AuditCheckStatus.Unavailable
        : AuditCheckStatus.Passed;
      return {
        id,
        label,
        status,
        signalTypes: types,
        summary: status === AuditCheckStatus.Flagged
          ? flaggedSummary
          : status === AuditCheckStatus.Unavailable
          ? unavailableSummary!
          : passedSummary,
        evidences: matches.map((s) => ({
          label: s.label,
          excerpt: s.matchText,
        })),
      };
    };
    const section = (
      id: string,
      label: string,
      checks: AuditCheck[],
    ): AuditSection => {
      const flagged =
        checks.filter((c) => c.status === AuditCheckStatus.Flagged).length;
      const unavail =
        checks.filter((c) => c.status === AuditCheckStatus.Unavailable).length;
      const severity: AuditSeverity = flagged >= 2
        ? "danger"
        : flagged === 1
        ? "warning"
        : "info";
      const summary = flagged > 0
        ? `${flagged} contrôle${flagged > 1 ? "s" : ""} ont remonté un risque.`
        : unavail > 0
        ? "Section partiellement renseignée."
        : "Aucun élément problématique.";
      return { id, label, severity, summary, checks };
    };
    return [
      section("link-audit", "Liens et réputation", [
        check(
          "shortened-links",
          "Liens raccourcis ou masqués",
          ["shortened_url"],
          "Aucun lien raccourci.",
          "Un lien raccourci masque la vraie destination.",
        ),
        check(
          "url-reputation",
          "Réputation des liens (VirusTotal)",
          [
            "malicious_url_confirmed",
            "suspicious_url_flagged",
            "suspicious_link",
          ],
          "Aucune URL malveillante connue.",
          "Une ou plusieurs URLs ont été signalées sur VirusTotal.",
        ),
        check(
          "qr-code",
          "QR codes",
          ["qr_code_redirect"],
          "Aucun QR code détecté.",
          "Un QR code est présent — destination inconnue.",
        ),
      ]),
      section("pressure-audit", "Pression et manipulation psychologique", [
        check(
          "urgency-pressure",
          "Pression temporelle ou menace",
          ["urgency", "account_threat", "artificial_scarcity"],
          "Aucune pression temporelle.",
          "Le message force une action urgente.",
        ),
        check(
          "psychological-manipulation",
          "Techniques de manipulation",
          [
            "fear_manipulation",
            "authority_manipulation",
            "false_legitimacy",
            "isolation_tactic",
          ],
          "Aucune technique de manipulation identifiée.",
          "Des techniques de manipulation psychologique ont été identifiées.",
        ),
        check(
          "financial-pressure",
          "Pression financière",
          ["fees_scam", "prize_scam"],
          "Aucune demande financière suspecte.",
          "Le contenu utilise un prétexte financier classique.",
        ),
      ]),
      section("identity-audit", "Identité et authenticité", [
        check(
          "sender-credibility",
          "Expéditeur",
          [
            "sender_format_mismatch",
            "carrier_mismatch",
            "foreign_number_impersonation",
          ],
          "Format d'expéditeur cohérent.",
          "Le format de l'expéditeur est incompatible avec l'organisme déclaré.",
        ),
        check(
          "impersonation",
          "Usurpation d'identité",
          ["impersonation"],
          "Aucune usurpation détectée.",
          "Le message usurpe l'identité d'un organisme connu.",
        ),
        check(
          "visual-integrity",
          "Intégrité visuelle",
          [
            "ai_generated",
            "visual_manipulation",
            "official_logo_misuse",
            "official_logo_detected",
            "recycled_image",
            "template_image",
          ],
          "Aucune manipulation visuelle détectée.",
          "Des éléments visuels suspects ont été détectés.",
        ),
      ]),
      section("request-audit", "Demandes sensibles", [
        check(
          "credential-request",
          "Données personnelles",
          ["credential_request"],
          "Aucune demande d'informations sensibles.",
          "Le message demande des informations qui ne doivent jamais être partagées.",
        ),
        check(
          "otp-request",
          "Code OTP ou de validation",
          ["otp_request"],
          "Aucun code OTP demandé.",
          "Le message tente d'obtenir un code de validation à usage unique.",
        ),
      ]),
      ...(inputType === InputType.Image
        ? [
          section("image-audit", "Analyse visuelle IA", [
            check(
              "ocr-source",
              "Extraction et classification",
              [],
              "",
              "",
              "Contenu extrait et analysé visuellement par IA (gpt-4o-mini + Google Vision).",
            ),
          ]),
        ]
        : []),
    ];
  }

  private buildExplanation(
    signals: Signal[],
    verdict: Verdict,
    score: number,
    summary: string,
  ) {
    const list = signals.map((s) => s.label.toLowerCase()).join(", ");
    if (verdict === Verdict.HighRisk) {
      return {
        shortSummary: `Arnaque très probable (score ${score}/100)`,
        explanation: summary ||
          `Ce contenu présente ${signals.length} signal${
            signals.length > 1 ? "s" : ""
          } d'arnaque : ${list}.`,
        recommendedActions: [
          "Ne cliquez sur aucun lien et ne scannez aucun QR code.",
          "Ne communiquez aucun code, mot de passe ou information bancaire.",
          "Signalez le message sur signal-spam.fr ou au 33700 (SMS).",
          "Si vous avez déjà cliqué, changez vos mots de passe immédiatement.",
        ],
      };
    }
    if (verdict === Verdict.Suspicious) {
      return {
        shortSummary: `Message douteux — prudence (score ${score}/100)`,
        explanation: summary ||
          `Ce contenu contient des éléments suspects (${list}).`,
        recommendedActions: [
          "Vérifiez l'expéditeur via le site ou numéro officiel de l'organisme.",
          "Ne cliquez pas directement sur les liens.",
          "En cas de doute, appelez directement le service concerné.",
        ],
      };
    }
    return {
      shortSummary: `Aucun signal suspect détecté (score ${score}/100)`,
      explanation: summary ||
        "Ce contenu ne présente pas de caractéristiques typiques des arnaques connues.",
      recommendedActions: [
        "Restez vigilant, même sur des messages en apparence légitimes.",
      ],
    };
  }
}
