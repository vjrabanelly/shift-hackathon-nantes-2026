import { LitElement, html, css, nothing } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { customElement, state } from 'lit/decorators.js';
import { theme, polColors, scrolloutDots, domainColors, attentionColors, palette } from '../styles/theme.js';
import { getStats, type DbStats, type SubjectInsight } from '../services/db-bridge.js';

/** Inline Lucide-style SVG icon helper */
const ico = (path: string, size = 18, color = 'currentColor') => html`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;">${unsafeSVG(path)}</svg>`;

/** Safe label extractor */
function safeLabel(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') {
    if (val.startsWith('{') || val.startsWith('[')) {
      try { return safeLabel(JSON.parse(val)); } catch { /* not JSON */ }
    }
    return val;
  }
  if (Array.isArray(val)) return val.map(safeLabel).filter(Boolean).join(', ');
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>;
    return String(o.label || o.name || o.id || o.topic || o.domain || o.narrative || o.tone || o.emotion || '');
  }
  return String(val);
}

const FUN_ICONS = {
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 010 3.4l-2.6 2.6a2.4 2.4 0 01-3.4 0L2.7 8.7a2.4 2.4 0 010-3.4l2.6-2.6a2.4 2.4 0 013.4 0z"/><path d="M14.5 12.5l2-2"/><path d="M11.5 9.5l2-2"/><path d="M8.5 6.5l2-2"/><path d="M17.5 15.5l2-2"/>',
  gauge: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M12 6v6l4 2"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.15.5-2.5 1.5-3.5z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  fish: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6-3.56 0-7.56-2.54-8.5-6z"/><path d="M2.5 12S1 10 1 8s1.5-3 1.5-3"/><path d="M2.5 12S1 14 1 16s1.5 3 1.5 3"/><circle cx="18.5" cy="10.5" r="0.5" fill="currentColor" stroke="none"/>',
};

// ── Persona detection ───────────────────────────────────────
interface Persona {
  label: string;
  emoji: string;
  desc: string;
  color: string;
}

function detectPersona(s: DbStats): Persona {
  const topDomain = safeLabel(s.topDomainsReal?.[0]?.domain || s.topDomains[0]?.domain || '');
  const topTopic = safeLabel(s.topTopics[0]?.topic || '');
  const polEntries = Object.entries(s.political);
  const totalPol = polEntries.reduce((a, [, c]) => a + (c as number), 0);
  const politicalPosts = polEntries.filter(([sc]) => parseInt(sc) >= 2).reduce((a, [, c]) => a + (c as number), 0);
  const politicalPct = totalPol > 0 ? politicalPosts / totalPol : 0;
  const avgPolar = s.avgPolarization ?? 0;
  const topEmotion = safeLabel(s.topEmotions?.[0]?.emotion || '');
  const engagedPct = s.attention['engaged'] ? (s.attention['engaged'] / Object.values(s.attention).reduce((a, b) => a + b, 0)) : 0;
  const skippedPct = s.attention['skipped'] ? (s.attention['skipped'] / Object.values(s.attention).reduce((a, b) => a + b, 0)) : 0;

  if (politicalPct > 0.35 && avgPolar > 0.3)
    return { label: 'L\'Engage', emoji: '!!', desc: 'Tu vis ton feed comme un terrain de conviction. L\'algorithme le sait et te nourrit.', color: 'var(--rouge)' };
  if (politicalPct > 0.2)
    return { label: 'Le Vigilant', emoji: '!?', desc: 'Tu gardes un oeil sur l\'actualite politique. L\'algorithme amplifie cette vigilance.', color: 'var(--orange)' };
  if (skippedPct > 0.6)
    return { label: 'Le Zappeur', emoji: '>>', desc: 'Tu scrolles vite, tu cherches le contenu qui merite ton arret. L\'algorithme court apres toi.', color: 'var(--jaune)' };
  if (engagedPct > 0.35)
    return { label: 'L\'Immersif', emoji: '~~', desc: 'Tu prends le temps. Chaque post capte ton regard. L\'algorithme te connait bien.', color: 'var(--vert-menthe)' };
  if (topEmotion === 'amusement' || topEmotion === 'humour' || topDomain.includes('divertissement'))
    return { label: 'Le Spectateur', emoji: '//', desc: 'Ton feed est un theatre. Divertissement, humour, evasion — l\'algorithme te sert du plaisir.', color: 'var(--rose)' };
  if (topDomain.includes('lifestyle') || topTopic.includes('lifestyle'))
    return { label: 'L\'Inspire', emoji: '##', desc: 'Mode, bien-etre, lifestyle — ton feed est un mood board algorithmique.', color: 'var(--vert-eau)' };
  if (topDomain.includes('information') || topDomain.includes('actualite'))
    return { label: 'L\'Informe', emoji: '<>', desc: 'Tu consommes de l\'info. L\'algorithme te maintient dans un flux continu d\'actualite.', color: 'var(--bleu-ciel)' };
  return { label: 'L\'Explorateur', emoji: '**', desc: 'Ton feed est eclectique. L\'algorithme ne t\'a pas encore enferme dans une bulle.', color: 'var(--bleu-indigo)' };
}

// ── Emotion icons & labels ──────────────────────────────────
const emotionMeta: Record<string, { icon: string; color: string }> = {
  'indignation': { icon: '!!', color: 'var(--rouge)' },
  'colere': { icon: '!!', color: 'var(--rouge)' },
  'amusement': { icon: ':)', color: 'var(--jaune)' },
  'humour': { icon: ':)', color: 'var(--jaune)' },
  'curiosite': { icon: '?', color: 'var(--bleu-ciel)' },
  'empathie': { icon: '<3', color: 'var(--rose)' },
  'nostalgie': { icon: '~', color: 'var(--violet)' },
  'fierte': { icon: '^', color: 'var(--vert-menthe)' },
  'inquietude': { icon: '..', color: 'var(--orange)' },
  'admiration': { icon: '*', color: 'var(--bleu-indigo)' },
  'tristesse': { icon: ':(', color: 'var(--text-muted)' },
  'surprise': { icon: '!?', color: 'var(--jaune)' },
  'degout': { icon: 'x', color: 'var(--rouge)' },
  'peur': { icon: '!!', color: 'var(--orange)' },
  'joie': { icon: ':D', color: 'var(--vert-menthe)' },
  'neutre': { icon: '--', color: 'var(--text-muted)' },
  'inspiration': { icon: '*', color: 'var(--bleu-indigo)' },
  'motivation': { icon: '>>', color: 'var(--vert-menthe)' },
  'ennui': { icon: '..', color: 'var(--text-muted)' },
};

function getEmotionMeta(emotion: string) {
  const key = emotion.toLowerCase().trim();
  return emotionMeta[key] || { icon: '~', color: 'var(--bleu-ciel)' };
}

const toneMeta: Record<string, { color: string }> = {
  'informatif': { color: 'var(--bleu-ciel)' },
  'humoristique': { color: 'var(--jaune)' },
  'militant': { color: 'var(--rouge)' },
  'promotionnel': { color: 'var(--orange)' },
  'educatif': { color: 'var(--bleu-indigo)' },
  'inspirant': { color: 'var(--vert-menthe)' },
  'provocateur': { color: 'var(--rouge)' },
  'emotionnel': { color: 'var(--rose)' },
  'neutre': { color: 'var(--text-muted)' },
  'critique': { color: 'var(--orange)' },
  'sensationnel': { color: 'var(--rouge)' },
  'personnel': { color: 'var(--violet)' },
  'conversationnel': { color: 'var(--vert-eau)' },
};

@customElement('screen-transparence')
export class ScreenTransparence extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 20px 16px 32px; }

      /* ── Header ── */
      .page-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
      }
      .back-btn {
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 10px;
        width: 36px; height: 36px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; color: var(--text);
        -webkit-tap-highlight-color: transparent;
      }
      .back-btn:active { background: var(--surface3); }
      .page-title {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 900;
      }

      /* ── Persona card ── */
      .persona {
        background: var(--surface2);
        border-radius: var(--radius);
        padding: 24px 20px;
        margin-bottom: 16px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }
      .persona-badge {
        font-family: var(--font-mono);
        font-size: 32px;
        font-weight: 700;
        line-height: 1;
        margin-bottom: 8px;
      }
      .persona-label {
        font-family: var(--font-heading);
        font-size: 24px;
        font-weight: 900;
        line-height: 1.2;
        margin-bottom: 6px;
      }
      .persona-desc {
        font-size: 13px;
        color: var(--text-dim);
        line-height: 1.5;
        max-width: 300px;
        margin: 0 auto;
      }
      .persona-meta {
        display: flex;
        justify-content: center;
        gap: 16px;
        margin-top: 14px;
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      /* ── Stats row ── */
      .stats-row {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .stat-card {
        flex: 1;
        background: var(--surface2);
        border-radius: var(--radius-sm);
        padding: 14px 8px;
        text-align: center;
      }
      .stat-val {
        font-family: var(--font-heading);
        font-size: 28px;
        font-weight: 700;
        line-height: 1.1;
      }
      .stat-label {
        font-family: var(--font-mono);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-dim);
        margin-top: 4px;
      }

      /* ── Section ── */
      .section {
        background: var(--surface2);
        border-radius: var(--radius);
        padding: 16px;
        margin-bottom: 14px;
        overflow: hidden;
      }
      .section-label {
        font-family: var(--font-heading);
        font-size: 15px;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 14px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* ── DNA strip ── */
      .dna-strip {
        display: flex;
        height: 44px;
        border-radius: 12px;
        overflow: hidden;
        gap: 2px;
        margin-bottom: 12px;
      }
      .dna-seg {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        color: rgba(0,0,0,0.8);
        transition: flex 0.4s;
        min-width: 0;
        overflow: hidden;
      }
      .dna-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .dna-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
      }
      .dna-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .dna-pct {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--text-muted);
      }

      /* ── Reveal cards ── */
      .reveals {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .reveal {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 14px;
        background: var(--surface3);
        border-radius: var(--radius-sm);
        border-left: 3px solid var(--border);
      }
      .reveal-icon {
        font-size: 22px;
        line-height: 1;
        flex-shrink: 0;
        width: 28px;
        text-align: center;
        font-family: var(--font-mono);
        font-weight: 700;
      }
      .reveal-body { flex: 1; }
      .reveal-headline {
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
        margin-bottom: 3px;
      }
      .reveal-headline strong {
        font-family: var(--font-mono);
        font-weight: 700;
      }
      .reveal-detail {
        font-size: 12px;
        color: var(--text-dim);
        line-height: 1.5;
      }

      /* ── Dwell bar ── */
      .dwell-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
      }
      .dwell-row + .dwell-row { border-top: 1px solid var(--border); }
      .dwell-label {
        font-size: 14px;
        font-weight: 500;
        flex: 1;
        text-transform: capitalize;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dwell-bar-wrap {
        flex: 2;
        height: 12px;
        background: var(--surface3);
        border-radius: 6px;
        overflow: hidden;
      }
      .dwell-bar {
        height: 100%;
        border-radius: 6px;
        transition: width 0.4s;
      }
      .dwell-time {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--text-muted);
        min-width: 40px;
        text-align: right;
      }

      /* ── Fun metrics ── */
      .fun-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 12px;
      }
      .fun-card {
        background: var(--surface3);
        border-radius: var(--radius-sm);
        padding: 14px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .fun-card.full { grid-column: 1 / -1; }
      .fun-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .fun-header svg { opacity: 0.7; }
      .fun-val {
        font-family: var(--font-heading);
        font-size: 26px;
        font-weight: 700;
        line-height: 1.1;
      }
      .fun-unit {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--text-dim);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .fun-meta {
        font-size: 12px;
        color: var(--text-dim);
        line-height: 1.4;
        margin-top: 2px;
      }
      .fun-meta strong { color: var(--text); }

      /* ── Emotion bubbles ── */
      .emotion-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .emotion-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: var(--surface3);
        border-radius: var(--radius-pill);
        border: 1px solid var(--border);
        font-size: 13px;
      }
      .emotion-icon {
        font-family: var(--font-mono);
        font-size: 16px;
        font-weight: 700;
      }
      .emotion-name { text-transform: capitalize; }
      .emotion-cnt {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--text-muted);
      }

      /* ── Narrative pills ── */
      .narrative-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .narrative-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .narrative-bar-wrap {
        flex: 1;
        height: 10px;
        background: var(--surface3);
        border-radius: 5px;
        overflow: hidden;
      }
      .narrative-bar {
        height: 100%;
        border-radius: 5px;
      }
      .narrative-label {
        font-size: 14px;
        text-transform: capitalize;
        min-width: 120px;
      }
      .narrative-cnt {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--text-muted);
        min-width: 24px;
        text-align: right;
      }

      /* ── Tone strip ── */
      .tone-strip {
        display: flex;
        height: 32px;
        border-radius: 10px;
        overflow: hidden;
        gap: 2px;
        margin-bottom: 10px;
      }
      .tone-seg {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 600;
        color: rgba(0,0,0,0.8);
        min-width: 0;
        overflow: hidden;
      }
      .tone-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .tone-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        text-transform: capitalize;
      }
      .tone-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      /* ── Subject Insights ── */
      .si-list { display: flex; flex-direction: column; gap: 12px; }
      .si-card {
        background: var(--surface3);
        border-radius: var(--radius);
        padding: 16px;
        border-left: 3px solid var(--border);
        position: relative;
      }
      .si-card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      .si-subject-name {
        font-family: var(--font-heading);
        font-size: 17px;
        font-weight: 700;
        text-transform: capitalize;
        line-height: 1.3;
        flex: 1;
      }
      .si-domain-badge {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 4px 10px;
        border-radius: var(--radius-pill);
        background: var(--surface2);
        color: var(--text-muted);
        white-space: nowrap;
        flex-shrink: 0;
      }
      .si-metrics {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 10px;
      }
      .si-metric {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .si-metric-val {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 700;
        line-height: 1.1;
      }
      .si-metric-label {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--text-dim);
      }
      .si-att-bar {
        display: flex;
        height: 6px;
        border-radius: 3px;
        overflow: hidden;
        gap: 1px;
        margin-bottom: 8px;
      }
      .si-att-seg {
        height: 100%;
        min-width: 2px;
        transition: flex 0.3s;
      }
      .si-att-legend {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }
      .si-att-item {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 9px;
        font-family: var(--font-mono);
        color: var(--text-dim);
      }
      .si-att-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
      }
      .si-accounts {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .si-account {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 3px 8px;
        background: var(--surface2);
        border-radius: var(--radius-pill);
        font-size: 10px;
      }
      .si-account .at {
        color: var(--violet);
        font-weight: 600;
      }
      .si-account .acc-cnt {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-muted);
      }
      .si-tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .si-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 9px;
        border-radius: var(--radius-pill);
        border: 1px solid var(--border);
        font-size: 10px;
      }
      .si-tag-icon {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 11px;
      }
      .si-caption-wrap { margin-top: 6px; }
      .si-caption-label {
        font-family: var(--font-mono);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
      .si-caption {
        font-size: 12px;
        color: var(--text-dim);
        line-height: 1.5;
        font-style: italic;
        padding: 10px 12px;
        background: var(--surface2);
        border-radius: var(--radius-sm);
        border-left: 2px solid var(--border);
      }
      .si-caption::before {
        content: '"';
        font-size: 16px;
        font-weight: 700;
        color: var(--text-muted);
        margin-right: 2px;
      }
      .si-pol-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .si-pol-bar-wrap {
        flex: 1;
        height: 4px;
        background: var(--surface2);
        border-radius: 2px;
        overflow: hidden;
      }
      .si-pol-bar {
        height: 100%;
        border-radius: 2px;
        transition: width 0.4s;
      }
      .si-pol-label {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-muted);
        min-width: 32px;
        text-align: right;
      }
      .si-divider {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 20px 0 12px;
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-dim);
      }
      .si-divider::before, .si-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--border);
      }
      .si-insight {
        font-size: 13px;
        color: var(--text-dim);
        line-height: 1.6;
        padding: 12px 14px;
        background: var(--surface3);
        border-radius: var(--radius-sm);
        border-left: 3px solid var(--bleu-indigo);
        margin-top: 12px;
      }
      .si-insight strong { color: var(--text); }

      .psi-card {
        background: var(--surface3);
        border-radius: var(--radius-sm);
        padding: 12px 14px;
        border-left: 3px solid var(--border);
        overflow: hidden;
        word-break: break-word;
      }
      .psi-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }
      .psi-name {
        font-size: 13px;
        font-weight: 600;
        line-height: 1.3;
        text-transform: capitalize;
        flex: 1;
      }
      .psi-stats {
        display: flex;
        gap: 10px;
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        flex-shrink: 0;
      }
      .psi-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 6px;
      }
      .psi-summary {
        font-size: 11px;
        color: var(--text-dim);
        line-height: 1.5;
        padding: 6px 10px;
        background: var(--surface2);
        border-radius: var(--radius-sm);
        margin-top: 4px;
        overflow: hidden;
        word-break: break-word;
      }

      /* ── Subject cloud (fallback) ── */
      .subject-cloud {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .subject-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--surface3);
        border: 1px solid var(--border);
        border-radius: var(--radius-pill);
        padding: 7px 13px;
        font-size: 13px;
        text-transform: capitalize;
      }
      .subject-tag .cnt {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--text-muted);
      }

      /* ── Attention ── */
      .attention-visual {
        display: flex;
        gap: 3px;
        height: 36px;
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 10px;
      }
      .att-seg {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 600;
        color: var(--bg);
        min-width: 0;
        overflow: hidden;
        transition: flex 0.4s;
      }
      .att-row {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 4px;
      }
      .att-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        color: var(--text-dim);
      }
      .att-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      /* ── Top accounts ── */
      .accounts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .account {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--surface3);
        border: 1px solid var(--border);
        border-radius: var(--radius-pill);
        padding: 6px 12px;
        font-size: 13px;
      }
      .account .at { color: var(--violet); font-weight: 600; }
      .account .cnt { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); }
      .account .time {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        margin-left: 2px;
      }

      /* ── Insight ── */
      .insight {
        font-size: 13px;
        color: var(--text-dim);
        line-height: 1.6;
        padding: 12px 14px;
        background: var(--surface3);
        border-radius: var(--radius-sm);
        border-left: 3px solid var(--border);
        margin-top: 10px;
      }
      .insight strong { color: var(--text); }

      /* ── Media type pills ── */
      .media-types {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .media-pill {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 10px 14px;
        background: var(--surface3);
        border-radius: var(--radius-sm);
        min-width: 70px;
      }
      .media-pill .val {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 700;
      }
      .media-pill .lbl {
        font-family: var(--font-mono);
        font-size: 11px;
        text-transform: uppercase;
        color: var(--text-dim);
      }
    `,
  ];

  @state() private stats: DbStats | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadStats();
  }

  private async loadStats() {
    try { this.stats = await getStats(); } catch { /* */ }
  }

  private goBack() {
    this.dispatchEvent(new CustomEvent('go-home', { bubbles: true, composed: true }));
  }

  render() {
    const s = this.stats;
    if (!s || s.totalPosts === 0) {
      return html`
        <div class="page-header">
          <button class="back-btn" @click=${this.goBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span class="page-title">Transparence</span>
        </div>
        <div style="text-align:center;color:var(--text-dim);padding:40px 20px;">
          Pas encore de donnees. Lance une capture Instagram d'abord.
        </div>
      `;
    }

    const persona = detectPersona(s);
    const totalMinutes = Math.round((s.totalDwellMs || 0) / 60000);
    const totalAttention = Object.values(s.attention).reduce((a, b) => (a as number) + (b as number), 0) as number;
    const enrichPct = s.totalPosts > 0 ? Math.round(s.totalEnriched / s.totalPosts * 100) : 0;

    return html`
      <div class="page-header">
        <button class="back-btn" @click=${this.goBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <span class="page-title">Transparence</span>
      </div>

      ${this.renderPersona(s, persona, totalMinutes)}
      ${this.renderStats(s, totalMinutes, enrichPct)}
      ${this.renderFunMetrics(s)}
      ${this.renderContentDNA(s)}
      ${this.renderCaptivation(s)}
      ${this.renderEmotionalLandscape(s)}
      ${this.renderNarrativeDiet(s)}
      ${this.renderTonePalette(s)}
      ${this.renderSubjects(s)}
      ${this.renderAttention(s, totalAttention)}
      ${this.renderAlgoAndYou(s)}
      ${this.renderSignals(s)}
      ${this.renderMediaTypes(s)}
      ${this.renderSponsoredVsOrganic(s)}
      ${this.renderTopAccounts(s)}
    `;
  }

  // ── 1. Persona ──────────────────────────────────────────────

  private renderPersona(s: DbStats, persona: Persona, totalMinutes: number) {
    return html`
      <div class="persona" style="border-top: 3px solid ${persona.color};">
        <div class="persona-badge" style="color:${persona.color}">${persona.emoji}</div>
        <div class="persona-label" style="color:${persona.color}">${persona.label}</div>
        <div class="persona-desc">${persona.desc}</div>
        <div class="persona-meta">
          <span>${s.totalPosts} posts</span>
          <span>${s.totalSessions} session${s.totalSessions > 1 ? 's' : ''}</span>
          <span>${totalMinutes > 0 ? `${totalMinutes}min` : '<1min'} de scroll</span>
        </div>
      </div>
    `;
  }

  // ── 2. Stats row ────────────────────────────────────────────

  private renderStats(s: DbStats, totalMinutes: number, enrichPct: number) {
    return html`
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-val" style="color:${palette.bleuIndigo}">${s.totalPosts}</div>
          <div class="stat-label">Posts vus</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:${palette.vertMenthe}">${enrichPct}%</div>
          <div class="stat-label">Analyses</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:${palette.orange}">${totalMinutes > 0 ? `${totalMinutes}m` : '<1m'}</div>
          <div class="stat-label">Temps</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:${palette.violet}">${(s.avgConfidence ?? 0) > 0 ? `${Math.round((s.avgConfidence ?? 0) * 100)}%` : '--'}</div>
          <div class="stat-label">Confiance</div>
        </div>
      </div>
    `;
  }

  // ── 3. Fun scroll metrics ───────────────────────────────────

  private renderFunMetrics(s: DbStats) {
    if (s.totalPosts === 0) return nothing;

    const scrollMeters = s.totalPosts * 0.15;
    const scrollKm = scrollMeters / 1000;
    const dwellHours = (s.totalDwellMs || 1) / 3600000;
    const scrollSpeed = scrollMeters / dwellHours;
    const postsPerSession = s.totalSessions > 0 ? Math.round(s.totalPosts / s.totalSessions) : s.totalPosts;
    const avgMinPerSession = s.totalSessions > 0 ? Math.round((s.totalDwellMs || 0) / s.totalSessions / 60000) : 0;

    const distanceText = scrollKm >= 1 ? `${scrollKm.toFixed(1)} km` : `${Math.round(scrollMeters)} m`;
    const distanceMetaphor = scrollMeters < 10
      ? 'A peine la longueur de ton canape.'
      : scrollMeters < 50 ? 'Tu pourrais traverser une piscine olympique du pouce.'
      : scrollMeters < 100 ? 'Un terrain de foot, parcouru au pouce.'
      : scrollMeters < 324 ? `Encore ${Math.round(324 - scrollMeters)}m et tu atteins la Tour Eiffel.`
      : scrollMeters < 500 ? 'Tu as depasse la Tour Eiffel. En scrollant.'
      : scrollMeters < 1000 ? 'Bientot 1 km. Ton pouce merite une medaille.'
      : scrollKm < 5 ? `${scrollKm.toFixed(1)} km — plus loin qu'un jogging matinal.`
      : `${scrollKm.toFixed(1)} km — tu pourrais relier la gare au centre-ville.`;

    const speedMetaphor = scrollSpeed < 50
      ? { text: 'Un escargot te battrait (53 m/h).', color: palette.vertMenthe }
      : scrollSpeed < 100 ? { text: 'Vitesse d\'un escargot motive. Respect.', color: palette.vertMenthe }
      : scrollSpeed < 270 ? { text: 'Plus rapide qu\'une tortue (270 m/h). Bravo.', color: palette.bleuCiel }
      : scrollSpeed < 1000 ? { text: 'Ton pouce est un sprinter amateur.', color: palette.jaune }
      : scrollSpeed < 5000 ? { text: 'Tu scrolles plus vite qu\'une hirondelle !', color: palette.orange }
      : { text: 'Ton pouce depasse un guepard. Litteralement.', color: palette.rouge };

    const totalMin = Math.round((s.totalDwellMs || 0) / 60000);
    const timeMetaphor = totalMin < 5 ? 'Juste le temps d\'un expresso.'
      : totalMin < 15 ? 'Un episode de podcast, englouti en scroll.'
      : totalMin < 30 ? 'Tu aurais pu faire une sieste royale.'
      : totalMin < 60 ? 'Un episode de serie... en posts Instagram.'
      : totalMin < 120 ? 'Un film complet. En scroll vertical.'
      : `${Math.round(totalMin / 60)}h — un vol Paris-Londres en scroll.`;

    const contentMetaphor = s.totalPosts < 20 ? 'L\'equivalent d\'un magazine feuillete.'
      : s.totalPosts < 100 ? 'Un livre de poche, en posts.'
      : s.totalPosts < 300 ? 'L\'equivalent d\'un roman. En diagonale.'
      : s.totalPosts < 1000 ? 'Plus de posts que de pages dans Harry Potter 1.'
      : `Plus de posts qu'un dictionnaire n'a de pages.`;

    return html`
      <div class="section">
        <div class="section-label">Tes records de scroll</div>
        <div class="fun-grid">
          <div class="fun-card">
            <div class="fun-header">
              ${ico(FUN_ICONS.ruler, 16, palette.bleuIndigo)}
              <div class="fun-val" style="color:${palette.bleuIndigo}">${distanceText}</div>
            </div>
            <div class="fun-unit">scrolles au total</div>
            <div class="fun-meta">${distanceMetaphor}</div>
          </div>
          <div class="fun-card">
            <div class="fun-header">
              ${ico(FUN_ICONS.gauge, 16, speedMetaphor.color)}
              <div class="fun-val" style="color:${speedMetaphor.color}">${Math.round(scrollSpeed)} m/h</div>
            </div>
            <div class="fun-unit">vitesse de scroll</div>
            <div class="fun-meta">${speedMetaphor.text}</div>
          </div>
          <div class="fun-card">
            <div class="fun-header">
              ${ico(FUN_ICONS.flame, 16, palette.rose)}
              <div class="fun-val" style="color:${palette.rose}">${s.totalPosts}</div>
            </div>
            <div class="fun-unit">contenus engloutis</div>
            <div class="fun-meta">${contentMetaphor}</div>
          </div>
          <div class="fun-card">
            <div class="fun-header">
              ${ico(FUN_ICONS.zap, 16, palette.orange)}
              <div class="fun-val" style="color:${palette.orange}">${postsPerSession}</div>
            </div>
            <div class="fun-unit">posts / session</div>
            <div class="fun-meta">${postsPerSession > 50
              ? 'Tu ne t\'arretes jamais.'
              : postsPerSession > 20
              ? 'Un bon rythme de croisiere.'
              : 'Un scrolleur mesure.'}</div>
          </div>
        </div>
        <div class="fun-grid">
          <div class="fun-card full">
            <div class="fun-header">
              ${ico(FUN_ICONS.clock, 18, palette.violet)}
              <div class="fun-val" style="color:${palette.violet}">${totalMin > 0 ? `${totalMin} min` : '<1 min'}</div>
              <div class="fun-unit">de scroll cumule</div>
            </div>
            <div class="fun-meta">${timeMetaphor}</div>
          </div>
        </div>
        ${avgMinPerSession > 0 ? html`
          <div class="insight">
            ${ico(FUN_ICONS.fish, 14, palette.bleuCiel)}
            En moyenne, tu passes <strong>${avgMinPerSession} min</strong> par session.
            ${avgMinPerSession > 15
              ? html`C'est plus que la duree moyenne d'attention d'un poisson rouge (9s). Enfin... <strong>${Math.round(avgMinPerSession * 60 / 9)}x</strong> plus.`
              : html`Rapide et efficace — ou juste de passage ?`}
          </div>
        ` : ''}
      </div>
    `;
  }

  // ── 4. Content DNA strip ────────────────────────────────────

  private renderContentDNA(s: DbStats) {
    const domains = (s.topDomainsReal?.length ? s.topDomainsReal : s.topDomains);
    if (!domains?.length) return nothing;

    const total = domains.reduce((a, d) => a + d.count, 0);
    if (total === 0) return nothing;

    const dnaColors: Record<string, string> = {
      'culture_divertissement': palette.rose,
      'lifestyle_bienetre': palette.vertEau,
      'politique_societe': palette.rouge,
      'information_savoirs': palette.bleuCiel,
      'ecologie_environnement': palette.vertMenthe,
      'economie_travail': palette.jaune,
      'sport': palette.orange,
      'technologie': palette.bleuIndigo,
      ...domainColors,
    };

    const items = domains.slice(0, 7).map((d, i) => {
      const key = safeLabel((d as any).domain || (d as any).topic || '');
      const pct = Math.round(d.count / total * 100);
      const color = dnaColors[key.toLowerCase()] || scrolloutDots[i % scrolloutDots.length];
      return { label: key, pct, color, count: d.count };
    });

    const top = items[0];
    const topPct = top?.pct || 0;
    const insightText = topPct > 50
      ? html`Plus de la moitie de ton feed est concentre sur <strong>${top.label}</strong>. L'algorithme te cible.`
      : topPct > 30
      ? html`<strong>${top.label}</strong> domine ton feed a <strong>${topPct}%</strong>. Le reste se partage entre ${items.slice(1, 3).map(i => i.label).join(' et ')}.`
      : html`Ton feed est relativement diversifie. <strong>${items.slice(0, 3).map(i => i.label).join(', ')}</strong> se partagent ton attention.`;

    return html`
      <div class="section">
        <div class="section-label">Ton ADN de contenu</div>
        <div class="dna-strip">
          ${items.map(i => html`
            <div class="dna-seg" style="flex:${i.pct};background:${i.color}">
              ${i.pct > 10 ? `${i.pct}%` : ''}
            </div>
          `)}
        </div>
        <div class="dna-legend">
          ${items.map(i => html`
            <div class="dna-item">
              <span class="dna-dot" style="background:${i.color}"></span>
              <span style="text-transform:capitalize">${i.label.replace(/_/g, ' ')}</span>
              <span class="dna-pct">${i.pct}%</span>
            </div>
          `)}
        </div>
        <div class="insight">${insightText}</div>
      </div>
    `;
  }

  // ── 5. Captivation (dwell by topic) ─────────────────────────

  private renderCaptivation(s: DbStats) {
    const dwell = s.dwellByTopic;
    if (!dwell?.length) return nothing;

    const maxDwell = dwell[0].totalDwellMs;
    const topItems = dwell.slice(0, 6);
    const topTopic = topItems[0];
    const topAvgSec = Math.round(topTopic.avgDwellMs / 1000);
    const globalAvgSec = Math.round((s.totalDwellMs || 1) / Math.max(s.totalPosts, 1) / 1000);

    return html`
      <div class="section">
        <div class="section-label">Ce qui te captive vraiment</div>
        ${topItems.map((item, i) => {
          const totalSec = Math.round(item.totalDwellMs / 1000);
          const pct = maxDwell > 0 ? Math.round(item.totalDwellMs / maxDwell * 100) : 0;
          const color = scrolloutDots[i % scrolloutDots.length];
          return html`
            <div class="dwell-row">
              <div class="dwell-label">${safeLabel(item.topic)}</div>
              <div class="dwell-bar-wrap">
                <div class="dwell-bar" style="width:${pct}%;background:${color}"></div>
              </div>
              <div class="dwell-time">${totalSec > 60 ? `${Math.round(totalSec / 60)}m` : `${totalSec}s`}</div>
            </div>
          `;
        })}
        <div class="insight">
          Tu passes en moyenne <strong>${topAvgSec}s</strong> sur le contenu "${safeLabel(topTopic.topic)}",
          ${topAvgSec > globalAvgSec
            ? html`soit <strong>${Math.round(topAvgSec / Math.max(globalAvgSec, 1) * 10) / 10}x</strong> plus que ta moyenne globale (${globalAvgSec}s).`
            : html`en ligne avec ta moyenne globale de ${globalAvgSec}s.`
          }
          L'algorithme detecte ce comportement.
        </div>
      </div>
    `;
  }

  // ── 6. Emotional landscape ──────────────────────────────────

  private renderEmotionalLandscape(s: DbStats) {
    const emotions = s.topEmotions;
    if (!emotions?.length) return nothing;

    const total = emotions.reduce((a, e) => a + e.count, 0);
    const topEmo = emotions[0];
    const topPct = total > 0 ? Math.round(topEmo.count / total * 100) : 0;

    return html`
      <div class="section">
        <div class="section-label">Ton paysage emotionnel</div>
        <div class="emotion-grid">
          ${emotions.slice(0, 8).map(e => {
            const meta = getEmotionMeta(e.emotion);
            const pct = total > 0 ? Math.round(e.count / total * 100) : 0;
            const borderAlpha = typeof meta.color === 'string' && meta.color.startsWith('rgb')
              ? meta.color.replace(/\)/, ', 0.2)').replace(/rgb/, 'rgba')
              : meta.color;
            return html`
              <div class="emotion-chip" style="border-color:${borderAlpha}">
                <span class="emotion-icon" style="color:${meta.color}">${meta.icon}</span>
                <span class="emotion-name">${safeLabel(e.emotion)}</span>
                <span class="emotion-cnt">${pct}%</span>
              </div>
            `;
          })}
        </div>
        <div class="insight">
          <strong>${topPct}%</strong> du contenu que tu vois provoque de la <strong>${safeLabel(topEmo.emotion)}</strong>.
          ${emotions.length > 1
            ? html`Suivi de ${safeLabel(emotions[1].emotion)}${emotions.length > 2 ? ` et ${safeLabel(emotions[2].emotion)}` : ''}.`
            : ''}
          Ce cocktail emotionnel n'est pas un hasard — c'est ce que l'algorithme optimise.
        </div>
      </div>
    `;
  }

  // ── 7. Narrative diet ───────────────────────────────────────

  private renderNarrativeDiet(s: DbStats) {
    const narratives = s.topNarratives;
    if (!narratives?.length) return nothing;

    const max = narratives[0].count;
    const narrColors = [
      'var(--bleu-indigo)', 'var(--violet)', 'var(--rose)',
      'var(--orange)', 'var(--jaune)', 'var(--vert-menthe)',
      'var(--bleu-ciel)', 'var(--vert-eau)',
    ];

    return html`
      <div class="section">
        <div class="section-label">Les recits qui te nourrissent</div>
        <div class="narrative-list">
          ${narratives.slice(0, 6).map((n, i) => {
            const pct = max > 0 ? Math.round(n.count / max * 100) : 0;
            return html`
              <div class="narrative-row">
                <div class="narrative-label">${safeLabel(n.narrative)}</div>
                <div class="narrative-bar-wrap">
                  <div class="narrative-bar" style="width:${pct}%;background:${narrColors[i % narrColors.length]}"></div>
                </div>
                <div class="narrative-cnt">${n.count}</div>
              </div>
            `;
          })}
        </div>
        <div class="insight">
          Chaque post raconte une histoire avec un angle. Ton feed est domine par des recits de type
          <strong>${safeLabel(narratives[0].narrative)}</strong>. Ce cadrage influence ta perception sans que tu le remarques.
        </div>
      </div>
    `;
  }

  // ── 8. Tone palette ─────────────────────────────────────────

  private renderTonePalette(s: DbStats) {
    const tones = s.topTones;
    if (!tones?.length) return nothing;

    const total = tones.reduce((a, t) => a + t.count, 0);
    const items = tones.slice(0, 6).map(t => {
      const toneStr = safeLabel(t.tone);
      const key = toneStr.toLowerCase().trim();
      const color = toneMeta[key]?.color || 'var(--bleu-ciel)';
      const pct = total > 0 ? Math.round(t.count / total * 100) : 0;
      return { ...t, tone: toneStr, color, pct };
    });

    return html`
      <div class="section">
        <div class="section-label">La tonalite de ton feed</div>
        <div class="tone-strip">
          ${items.map(i => html`
            <div class="tone-seg" style="flex:${i.pct};background:${i.color}">
              ${i.pct > 12 ? `${i.pct}%` : ''}
            </div>
          `)}
        </div>
        <div class="tone-legend">
          ${items.map(i => html`
            <div class="tone-item">
              <span class="tone-dot" style="background:${i.color}"></span>
              ${i.tone} <span class="dna-pct">${i.pct}%</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  // ── 9. Subject Insights ─────────────────────────────────────

  private renderSubjects(s: DbStats) {
    const insights = s.subjectInsights;
    const preciseInsights = s.preciseSubjectInsights;
    const subjects = (s.topSubjects?.length ? s.topSubjects : s.topTopics) || [];
    const precise = s.topPreciseSubjects;

    const hasInsights = insights && insights.length > 0;
    const hasPreciseInsights = preciseInsights && preciseInsights.length > 0;
    const hasLegacy = subjects.length > 0 || (precise?.length || 0) > 0;

    if (!hasInsights && !hasPreciseInsights && !hasLegacy) return nothing;

    return html`
      ${hasInsights ? html`
        <div class="section">
          <div class="section-label">${ico('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>', 12)} Ce qui capte ton attention</div>
          <div class="si-list">
            ${insights!.slice(0, 8).map((si, i) => this.renderSubjectCard(si, i))}
          </div>
          ${this.renderSubjectAutoInsight(insights!)}
        </div>
      ` : (subjects?.length || 0) > 0 ? html`
        <div class="section">
          <div class="section-label">Les sujets de ton feed</div>
          <div class="subject-cloud">
            ${subjects!.slice(0, 12).map((t, i) => html`
              <span class="subject-tag" style="border-color:${scrolloutDots[i % scrolloutDots.length]}40">
                ${safeLabel(t.topic)} <span class="cnt">${t.count}</span>
              </span>
            `)}
          </div>
        </div>
      ` : ''}

      ${hasPreciseInsights ? html`
        <div class="section">
          <div class="section-label">${ico('<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>', 12)} Jusqu'ou l'algorithme va</div>
          <div class="si-list">
            ${preciseInsights!.slice(0, 6).map((psi, i) => this.renderPreciseSubjectCard(psi, i))}
          </div>
          <div class="si-insight">
            L'algorithme affine en permanence sa comprehension de tes centres d'interet.
            Ces sujets precis sont ceux ou il a detecte que tu <strong>ralentis, lis, t'engages</strong>.
            Plus tu scrolles, plus le ciblage se resserre.
          </div>
        </div>
      ` : (precise?.length || 0) > 0 ? html`
        <div class="section">
          <div class="section-label">Jusqu'ou l'algorithme va</div>
          <div class="subject-cloud">
            ${precise!.slice(0, 8).map((t, i) => html`
              <span class="subject-tag" style="border-color:${scrolloutDots[(i + 3) % scrolloutDots.length]}40">
                ${safeLabel(t.topic)} <span class="cnt">${t.count}</span>
              </span>
            `)}
          </div>
        </div>
      ` : ''}
    `;
  }

  // ── Subject card (rich) ──────────────────────────────────────

  private renderSubjectCard(si: SubjectInsight, idx: number) {
    const color = scrolloutDots[idx % scrolloutDots.length];
    const dwellSec = Math.round(si.totalDwellMs / 1000);
    const dwellLabel = dwellSec >= 60
      ? `${Math.floor(dwellSec / 60)}m${String(dwellSec % 60).padStart(2, '0')}s`
      : `${dwellSec}s`;
    const avgSec = Math.round(si.avgDwellMs / 1000);
    const attTotal = Object.values(si.attention || {}).reduce((a, b) => a + b, 0);
    const engagedPct = attTotal > 0 ? Math.round(((si.attention?.['engaged'] || 0) / attTotal) * 100) : 0;
    const emotionInfo = si.dominantEmotion ? getEmotionMeta(si.dominantEmotion) : null;
    const toneInfo = si.dominantTone ? (toneMeta[si.dominantTone.toLowerCase()] || { color: 'var(--text-muted)' }) : null;
    const domainColor = si.domains?.[0] ? (domainColors[safeLabel(si.domains[0])] || color) : color;
    const polScore = si.avgPoliticalScore ?? 0;
    const polColor = polColors[Math.min(Math.round(polScore), 4)];

    return html`
      <div class="si-card" style="border-left-color:${domainColor}">
        <div class="si-card-header">
          <div class="si-subject-name" style="color:${color}">${safeLabel(si.subject)}</div>
          ${si.domains?.[0] ? html`
            <span class="si-domain-badge" style="color:${domainColor};border:1px solid ${domainColor}40">${safeLabel(si.domains[0])}</span>
          ` : ''}
        </div>

        <div class="si-metrics">
          <div class="si-metric">
            <div class="si-metric-val" style="color:${color}">${si.count}</div>
            <div class="si-metric-label">posts</div>
          </div>
          <div class="si-metric">
            <div class="si-metric-val" style="color:${palette.bleuCiel}">${dwellLabel}</div>
            <div class="si-metric-label">temps total</div>
          </div>
          <div class="si-metric">
            <div class="si-metric-val" style="color:${palette.vertMenthe}">${avgSec}s</div>
            <div class="si-metric-label">moy/post</div>
          </div>
          <div class="si-metric">
            <div class="si-metric-val" style="color:${attentionColors.engaged}">${engagedPct}%</div>
            <div class="si-metric-label">engage</div>
          </div>
        </div>

        ${attTotal > 0 ? html`
          <div class="si-att-bar">
            ${(['engaged', 'viewed', 'glanced', 'skipped'] as const).map(level => {
              const cnt = si.attention?.[level] || 0;
              const pct = (cnt / attTotal) * 100;
              return pct > 0 ? html`
                <div class="si-att-seg" style="flex:${pct};background:${attentionColors[level]}"></div>
              ` : '';
            })}
          </div>
          <div class="si-att-legend">
            ${(['engaged', 'viewed', 'glanced', 'skipped'] as const).map(level => {
              const cnt = si.attention?.[level] || 0;
              if (cnt === 0) return '';
              return html`
                <span class="si-att-item">
                  <span class="si-att-dot" style="background:${attentionColors[level]}"></span>
                  ${level} ${cnt}
                </span>
              `;
            })}
          </div>
        ` : ''}

        ${polScore > 0.5 ? html`
          <div class="si-pol-row">
            <span class="si-att-item" style="min-width:50px">
              ${ico('<path d="M3 21h18M9 8h6M12 2v6M9 12H4l5 9M15 12h5l-5 9"/>', 12, polColor)}
              Pol.
            </span>
            <div class="si-pol-bar-wrap">
              <div class="si-pol-bar" style="width:${(polScore / 4) * 100}%;background:${polColor}"></div>
            </div>
            <span class="si-pol-label">${polScore.toFixed(1)}/4</span>
          </div>
        ` : ''}

        ${si.topAccounts?.length ? html`
          <div class="si-accounts">
            ${si.topAccounts.map(a => html`
              <span class="si-account">
                <span class="at">@${a.username}</span>
                <span class="acc-cnt">${a.count}</span>
              </span>
            `)}
          </div>
        ` : ''}

        <div class="si-tags">
          ${emotionInfo ? html`
            <span class="si-tag" style="border-color:${emotionInfo.color}">
              <span class="si-tag-icon" style="color:${emotionInfo.color}">${emotionInfo.icon}</span>
              ${safeLabel(si.dominantEmotion)}
            </span>
          ` : ''}
          ${toneInfo && si.dominantTone ? html`
            <span class="si-tag" style="border-color:${toneInfo.color}">
              <span class="si-tag-icon" style="color:${toneInfo.color}">~</span>
              ${safeLabel(si.dominantTone)}
            </span>
          ` : ''}
        </div>

        ${si.sampleCaption ? html`
          <div class="si-caption-wrap">
            <div class="si-caption-label">Exemple de post</div>
            <div class="si-caption">${safeLabel(si.sampleCaption)}</div>
          </div>
        ` : si.sampleSummary ? html`
          <div class="si-caption-wrap">
            <div class="si-caption-label">Resume type</div>
            <div class="si-caption">${safeLabel(si.sampleSummary)}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // ── Precise subject card ────────────────────────────────────

  private renderPreciseSubjectCard(psi: SubjectInsight, idx: number) {
    const color = scrolloutDots[(idx + 3) % scrolloutDots.length];
    const dwellSec = Math.round(psi.totalDwellMs / 1000);
    const dwellLabel = dwellSec >= 60
      ? `${Math.floor(dwellSec / 60)}m${String(dwellSec % 60).padStart(2, '0')}s`
      : `${dwellSec}s`;
    const attTotal = Object.values(psi.attention || {}).reduce((a, b) => a + b, 0);
    const engagedPct = attTotal > 0 ? Math.round(((psi.attention?.['engaged'] || 0) / attTotal) * 100) : 0;
    const emotionInfo = psi.dominantEmotion ? getEmotionMeta(psi.dominantEmotion) : null;
    const domainColor = psi.domains?.[0] ? (domainColors[safeLabel(psi.domains[0])] || color) : color;

    return html`
      <div class="psi-card" style="border-left-color:${domainColor}">
        <div class="psi-header">
          <div class="psi-name" style="color:${color}">${safeLabel(psi.subject)}</div>
          <div class="psi-stats">
            <span>${psi.count} posts</span>
            <span>${dwellLabel}</span>
            ${engagedPct > 0 ? html`<span style="color:${attentionColors.engaged}">${engagedPct}% eng.</span>` : ''}
          </div>
        </div>

        ${attTotal > 0 ? html`
          <div class="si-att-bar" style="margin-bottom:6px">
            ${(['engaged', 'viewed', 'glanced', 'skipped'] as const).map(level => {
              const cnt = psi.attention?.[level] || 0;
              const pct = (cnt / attTotal) * 100;
              return pct > 0 ? html`
                <div class="si-att-seg" style="flex:${pct};background:${attentionColors[level]}"></div>
              ` : '';
            })}
          </div>
        ` : ''}

        <div class="psi-row">
          ${psi.topAccounts?.length ? psi.topAccounts.slice(0, 2).map(a => html`
            <span class="si-account">
              <span class="at">@${a.username}</span>
            </span>
          `) : ''}
          ${emotionInfo ? html`
            <span class="si-tag" style="border-color:${emotionInfo.color}">
              <span class="si-tag-icon" style="color:${emotionInfo.color}">${emotionInfo.icon}</span>
              ${safeLabel(psi.dominantEmotion)}
            </span>
          ` : ''}
          ${psi.domains?.[0] ? html`
            <span class="si-domain-badge" style="color:${domainColor};border:1px solid ${domainColor}40">${safeLabel(psi.domains[0])}</span>
          ` : ''}
        </div>

        ${psi.sampleSummary ? html`
          <div class="si-caption-wrap">
            <div class="si-caption-label">Resume type</div>
            <div class="psi-summary">${safeLabel(psi.sampleSummary)}</div>
          </div>
        ` : psi.sampleCaption ? html`
          <div class="si-caption-wrap">
            <div class="si-caption-label">Exemple de post</div>
            <div class="si-caption">${safeLabel(psi.sampleCaption)}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // ── Auto-generated insight sentence ──────────────────────────

  private renderSubjectAutoInsight(insights: SubjectInsight[]) {
    if (insights.length < 2) return nothing;

    const top = insights[0];
    const topDwell = Math.round(top.totalDwellMs / 1000);
    const second = insights[1];
    const secondDwell = Math.round(second.totalDwellMs / 1000);
    const ratio = secondDwell > 0 ? (topDwell / secondDwell).toFixed(1) : '?';
    const topEngaged = Object.values(top.attention || {}).reduce((a, b) => a + b, 0) > 0
      ? Math.round(((top.attention?.['engaged'] || 0) / Object.values(top.attention || {}).reduce((a, b) => a + b, 0)) * 100)
      : 0;

    const mostPolarizing = [...insights].sort((a, b) => (b.avgPolarization || 0) - (a.avgPolarization || 0))[0];
    const hasPolarizing = (mostPolarizing.avgPolarization || 0) > 0.3 && mostPolarizing.subject !== top.subject;

    return html`
      <div class="si-insight">
        Tu passes <strong>${ratio}x plus de temps</strong> sur <strong>${safeLabel(top.subject)}</strong>
        que sur ${safeLabel(second.subject)}${topEngaged > 50
          ? html` — et tu t'y engages activement (<strong>${topEngaged}%</strong> du temps en lecture approfondie)`
          : ''}.
        ${hasPolarizing ? html`
          <br>Le sujet <strong>${safeLabel(mostPolarizing.subject)}</strong> presente le plus haut niveau
          de polarisation dans ton feed (${((mostPolarizing.avgPolarization || 0) * 100).toFixed(0)}%).
        ` : ''}
      </div>
    `;
  }

  // ── 10. Attention distribution ──────────────────────────────

  private renderAttention(s: DbStats, totalAttention: number) {
    if (totalAttention === 0) return nothing;

    const levels = ['engaged', 'viewed', 'glanced', 'skipped'] as const;
    const labels: Record<string, string> = {
      engaged: 'Engage (>5s)', viewed: 'Vu (2-5s)',
      glanced: 'Apercu (<2s)', skipped: 'Ignore (<0.5s)',
    };
    const engagedPct = Math.round(((s.attention['engaged'] || 0) / totalAttention) * 100);
    const skippedPct = Math.round(((s.attention['skipped'] || 0) / totalAttention) * 100);

    return html`
      <div class="section">
        <div class="section-label">Ton style d'attention</div>
        <div class="attention-visual">
          ${levels.map(level => {
            const count = (s.attention[level] as number) || 0;
            const pct = count / totalAttention * 100;
            return pct > 0 ? html`
              <div class="att-seg" style="flex:${pct};background:${attentionColors[level]}">${pct > 12 ? `${Math.round(pct)}%` : ''}</div>
            ` : nothing;
          })}
        </div>
        <div class="att-row">
          ${levels.map(level => {
            const count = (s.attention[level] as number) || 0;
            return count > 0 ? html`
              <div class="att-item">
                <span class="att-dot" style="background:${attentionColors[level]}"></span>
                ${labels[level]} (${count})
              </div>
            ` : nothing;
          })}
        </div>
        <div class="insight">
          ${skippedPct > 50
            ? html`Tu ignores <strong>${skippedPct}%</strong> du contenu que l'algorithme te montre. Il essaie quand meme.`
            : engagedPct > 30
            ? html`Tu t'arretes sur <strong>${engagedPct}%</strong> des posts. Tu es un consommateur attentif — l'algorithme adore ca.`
            : html`Tu alternes entre engagement et scroll rapide. L'algorithme ajuste en continu.`
          }
        </div>
      </div>
    `;
  }

  // ── 11. Algorithm & you ─────────────────────────────────────

  private renderAlgoAndYou(s: DbStats) {
    if (!s.attentionPolitical) return nothing;
    const ap = s.attentionPolitical;
    const engaged = ap['engaged'];
    const skipped = ap['skipped'];
    if (!engaged || !skipped) return nothing;

    const engagedPol = engaged.avgPolitical;
    const skippedPol = skipped.avgPolitical;
    const engagedPolar = engaged.avgPolarization;
    const diff = engagedPol - skippedPol;

    return html`
      <div class="section">
        <div class="section-label">L'algorithme et toi</div>
        <div class="reveals">
          <div class="reveal" style="border-color:${diff > 0.3 ? palette.rouge : diff > 0 ? palette.jaune : palette.vertMenthe}">
            <div class="reveal-icon" style="color:${diff > 0.3 ? palette.rouge : diff > 0 ? palette.jaune : palette.vertMenthe}">
              ${diff > 0 ? '+' : ''}${diff.toFixed(1)}
            </div>
            <div class="reveal-body">
              <div class="reveal-headline">
                ${diff > 0.3 ? 'Tu t\'arretes plus sur le contenu politique'
                  : diff > 0 ? 'Legere tendance a regarder le contenu politique'
                  : 'Tu ne t\'arretes pas plus sur le politique'}
              </div>
              <div class="reveal-detail">
                Score moyen des posts engages : ${engagedPol.toFixed(1)}/4.
                Posts ignores : ${skippedPol.toFixed(1)}/4.
                ${diff > 0 ? 'L\'algorithme detecte cet interet et t\'en montre davantage.' : ''}
              </div>
            </div>
          </div>
          ${engagedPolar > 0.2 ? html`
            <div class="reveal" style="border-color:${palette.violet}">
              <div class="reveal-icon" style="color:${palette.violet}">${engagedPolar.toFixed(2)}</div>
              <div class="reveal-body">
                <div class="reveal-headline">Le contenu qui te capte est polarisant</div>
                <div class="reveal-detail">Les posts sur lesquels tu passes du temps ont une polarisation de ${engagedPolar.toFixed(2)} en moyenne.</div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // ── 12. Polarization signals ────────────────────────────────

  private renderSignals(s: DbStats) {
    if (!s.signals || s.signals.total === 0) return nothing;
    const sig = s.signals;
    const activeSignals = [
      { name: 'Activisme', count: sig.activism, color: palette.rouge, desc: 'appels a l\'action, mobilisation' },
      { name: 'Conflit', count: sig.conflict, color: palette.orange, desc: 'vocabulaire de guerre, combat, ennemi' },
      { name: 'Absolus moraux', count: sig.moralAbsolute, color: palette.violet, desc: 'fascisme, genocide, monstrueux' },
      { name: 'Designation d\'ennemi', count: sig.enemyDesignation, color: palette.rose, desc: '"dehors", "degagez", exclusion' },
      { name: 'Nous vs Eux', count: sig.ingroupOutgroup, color: palette.jaune, desc: 'elites vs peuple, communautarisme' },
    ].filter(x => x.count > 0);

    if (activeSignals.length === 0) return nothing;
    return html`
      <div class="section">
        <div class="section-label">Signaux de polarisation</div>
        <div class="reveals">
          ${activeSignals.map(x => html`
            <div class="reveal" style="border-color:${x.color}">
              <div class="reveal-icon" style="color:${x.color};font-size:16px;">${x.count}</div>
              <div class="reveal-body">
                <div class="reveal-headline">${x.name}</div>
                <div class="reveal-detail">${x.count} post${x.count > 1 ? 's' : ''} sur ${sig.total} — ${x.desc}</div>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  // ── 13. Media types ─────────────────────────────────────────

  private renderMediaTypes(s: DbStats) {
    const types = s.mediaTypes;
    if (!types?.length) return nothing;

    const typeLabels: Record<string, string> = {
      photo: 'Photos', video: 'Videos', carousel: 'Carrousels',
      reel: 'Reels', story: 'Stories', '': 'Autre',
    };
    const typeColors: Record<string, string> = {
      photo: palette.bleuCiel, video: palette.violet, carousel: palette.orange,
      reel: palette.rose, story: palette.jaune,
    };

    return html`
      <div class="section">
        <div class="section-label">Quel format te capte</div>
        <div class="media-types">
          ${types.slice(0, 5).map(t => html`
            <div class="media-pill">
              <div class="val" style="color:${typeColors[t.type] || 'var(--text)'}">${t.count}</div>
              <div class="lbl">${typeLabels[t.type] || t.type}</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  // ── 14. Sponsored vs organic ────────────────────────────────

  private renderSponsoredVsOrganic(s: DbStats) {
    const sp = s.sponsoredStats;
    if (!sp?.sponsored) return nothing;
    const spCount = sp.sponsored?.count || 0;
    const orgCount = sp.organic?.count || 0;
    const total = spCount + orgCount;
    if (spCount === 0) return nothing;

    const spPct = total > 0 ? Math.round(spCount / total * 100) : 0;
    const spDwell = sp.sponsored?.avgDwellMs || 0;
    const orgDwell = sp.organic?.avgDwellMs || 0;
    const dwellDiff = Math.round((spDwell - orgDwell) / 1000);

    return html`
      <div class="section">
        <div class="section-label">Contenu sponsorise</div>
        <div class="reveals">
          <div class="reveal" style="border-color:${palette.jaune}">
            <div class="reveal-icon" style="color:${palette.jaune};font-size:14px;">${spPct}%</div>
            <div class="reveal-body">
              <div class="reveal-headline">${spCount} pub${spCount > 1 ? 's' : ''} dans ton feed</div>
              <div class="reveal-detail">
                Tu passes ${Math.round(spDwell / 1000)}s en moyenne sur une pub,
                vs ${Math.round(orgDwell / 1000)}s sur du contenu organique.
                ${dwellDiff > 0 ? `Les pubs te retiennent ${dwellDiff}s de plus.` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── 15. Top accounts ────────────────────────────────────────

  private renderTopAccounts(s: DbStats) {
    if (!s.topUsers?.length) return nothing;

    return html`
      <div class="section">
        <div class="section-label">Comptes les plus montres</div>
        <div class="accounts">
          ${s.topUsers.slice(0, 10).map(u => {
            const dwellSec = Math.round((u.totalDwellMs || 0) / 1000);
            return html`
              <div class="account">
                <span class="at">@${u.username}</span>
                <span class="cnt">${u.count}</span>
                ${dwellSec > 0 ? html`<span class="time">${dwellSec > 60 ? `${Math.round(dwellSec / 60)}m` : `${dwellSec}s`}</span>` : ''}
              </div>
            `;
          })}
        </div>
        ${s.polarizingAccounts?.length ? html`
          <div class="insight">
            ${s.polarizingAccounts[0].avgPolarization > 0.3
              ? html`Compte le plus polarisant : <strong>@${safeLabel(s.polarizingAccounts[0].username)}</strong> (polarisation ${s.polarizingAccounts[0].avgPolarization.toFixed(2)}).`
              : html`Aucun compte particulierement polarisant dans ton feed.`
            }
          </div>
        ` : ''}
      </div>
    `;
  }
}
