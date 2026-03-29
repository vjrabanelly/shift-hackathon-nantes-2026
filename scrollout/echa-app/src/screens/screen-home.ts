import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, scrolloutDots, domainColors, palette } from '../styles/theme.js';
import '../components/scrollout-logo.js';
import { openInstagram } from '../services/native-bridge.js';
import { getStats, type DbStats, type SubjectInsight } from '../services/db-bridge.js';

/** User profile archetype (same logic as wrapped) */
function getUserProfile(s: DbStats): { name: string; desc: string } {
  const top = s.topDomains?.[0];
  if (!top) return { name: 'L\'explorateur', desc: 'Ton feed est trop recent pour te cerner.' };
  const topDomain = top.domain;
  const total = s.topDomains.reduce((a, d) => a + d.count, 0);
  const topPct = total ? Math.round((top.count / total) * 100) : 0;
  const polPct = (() => {
    const pol = s.political;
    if (!pol) return 0;
    const t = Object.values(pol).reduce((a, b) => a + b, 0);
    return t ? Math.round(((pol[2] || 0) + (pol[3] || 0) + (pol[4] || 0)) / t * 100) : 0;
  })();
  if (polPct > 40) return { name: 'Le militant', desc: 'L\'algorithme t\'enferme dans un flux politique.' };
  if (topDomain.includes('information') || topDomain.includes('politique'))
    return { name: 'L\'informe', desc: 'Un flux continu d\'actualite.' };
  if (topDomain.includes('divertissement') && topPct > 50)
    return { name: 'Le zappeur', desc: 'Divertissement court en boucle.' };
  if (topDomain.includes('lifestyle'))
    return { name: 'L\'inspire', desc: 'Lifestyle et bien-etre en tete.' };
  if (topDomain.includes('sport'))
    return { name: 'Le supporter', desc: 'Le sport domine ton feed.' };
  if (topPct < 30)
    return { name: 'L\'eclectique', desc: 'Un feed varie, aucun domaine ne domine.' };
  return { name: 'L\'absorbe', desc: 'L\'algorithme te nourrit methodiquement.' };
}

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

/** Compute dwell per domain from multiple sources */
function computeDwellByDomain(s: DbStats): Map<string, { totalDwellMs: number; count: number }> {
  const map = new Map<string, { totalDwellMs: number; count: number }>();

  // 1. From subjectInsights: each has domains[] + totalDwellMs
  for (const si of s.subjectInsights || []) {
    for (const d of si.domains || []) {
      const key = safeLabel(d).toLowerCase();
      const cur = map.get(key) || { totalDwellMs: 0, count: 0 };
      cur.totalDwellMs += si.totalDwellMs || 0;
      cur.count += si.count || 0;
      map.set(key, cur);
    }
  }
  // Also from preciseSubjectInsights
  for (const psi of s.preciseSubjectInsights || []) {
    for (const d of psi.domains || []) {
      const key = safeLabel(d).toLowerCase();
      if (map.has(key)) continue; // already covered above
      const cur = map.get(key) || { totalDwellMs: 0, count: 0 };
      cur.totalDwellMs += psi.totalDwellMs || 0;
      cur.count += psi.count || 0;
      map.set(key, cur);
    }
  }

  // 2. Fallback: distribute totalDwellMs proportionally across domains by post count
  if (map.size === 0 && s.totalDwellMs > 0) {
    const domains = s.topDomainsReal?.length ? s.topDomainsReal : s.topDomains;
    const total = domains?.reduce((a, d) => a + d.count, 0) || 1;
    for (const d of domains || []) {
      const key = safeLabel(d.domain).toLowerCase();
      map.set(key, {
        totalDwellMs: Math.round(s.totalDwellMs * d.count / total),
        count: d.count,
      });
    }
  }

  // 3. Also try matching dwellByTopic entries to domain names (fuzzy)
  for (const dt of s.dwellByTopic || []) {
    const topicKey = safeLabel(dt.topic).toLowerCase();
    // Try to find a domain that contains this topic name
    for (const [domKey, val] of map) {
      if (domKey.includes(topicKey) || topicKey.includes(domKey.replace(/_/g, ' '))) {
        // Merge if the domain dwell is still 0
        if (val.totalDwellMs === 0) {
          val.totalDwellMs = dt.totalDwellMs;
        }
      }
    }
    // If topic matches an exact domain
    if (!map.has(topicKey)) {
      map.set(topicKey, { totalDwellMs: dt.totalDwellMs, count: dt.count });
    }
  }

  return map;
}

@customElement('screen-home')
export class ScreenHome extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 20px 16px 32px; }

      /* ── Animations ── */
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.7); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes slideRight {
        from { opacity: 0; transform: translateX(-16px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes bubblePop {
        0% { opacity: 0; transform: scale(0); }
        70% { transform: scale(1.08); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      @keyframes dotPulse {
        0%, 100% { transform: scale(1); opacity: 0.7; }
        50% { transform: scale(1.3); opacity: 1; }
      }

      .anim-fade-up {
        animation: fadeUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
      }
      .anim-fade-in {
        animation: fadeIn 0.4s ease both;
      }

      /* ── Header ── */
      .header {
        text-align: center;
        margin-bottom: 24px;
        animation: fadeIn 0.6s ease both;
      }
      .logo-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      .logo {
        font-family: var(--font-heading);
        font-size: 38px;
        font-weight: 900;
        letter-spacing: -0.5px;
        background: linear-gradient(135deg, var(--text) 0%, var(--text-dim) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .dots-row {
        display: flex;
        gap: 5px;
        justify-content: center;
      }
      .dots-row span {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        animation: dotPulse 2s ease-in-out infinite;
      }
      .dots-row span:nth-child(2) { animation-delay: 0.1s; }
      .dots-row span:nth-child(3) { animation-delay: 0.2s; }
      .dots-row span:nth-child(4) { animation-delay: 0.3s; }
      .dots-row span:nth-child(5) { animation-delay: 0.4s; }
      .dots-row span:nth-child(6) { animation-delay: 0.5s; }
      .dots-row span:nth-child(7) { animation-delay: 0.6s; }
      .dots-row span:nth-child(8) { animation-delay: 0.7s; }
      .dots-row span:nth-child(9) { animation-delay: 0.8s; }

      /* ── Empty state ── */
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 50vh;
        gap: 20px;
        text-align: center;
        animation: fadeUp 0.6s ease both 0.2s;
      }
      .empty-hook {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 900;
        line-height: 1.3;
        margin-bottom: 4px;
      }
      .empty-hook .hl { color: var(--orange); }
      .empty-text {
        color: var(--text-dim);
        font-size: 14px;
        line-height: 1.6;
        max-width: 280px;
      }
      .btn-launch {
        background: var(--bleu-indigo);
        color: var(--white);
        border: none;
        padding: 14px 36px;
        border-radius: var(--radius-pill);
        font-size: 15px;
        font-weight: 600;
        font-family: var(--font-body);
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 4px 16px rgba(91, 63, 232, 0.35);
      }
      .btn-launch:active { transform: scale(0.97); }

      /* ── Wrapped banner (orange CTA) ── */
      .wrapped-banner {
        background: linear-gradient(135deg, var(--orange) 0%, #ff8533 100%);
        border: 4px solid rgba(255, 107, 0, 0.2);
        border-radius: 22px;
        padding: 20px 22px;
        margin-bottom: 28px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
        overflow: hidden;
        animation: fadeUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both 0.1s;
        box-shadow: 0 6px 24px rgba(255, 107, 0, 0.25);
      }
      .wrapped-banner:active { transform: scale(0.97); }
      .wb-left {
        display: flex;
        flex-direction: column;
        gap: 4px;
        z-index: 1;
      }
      .wb-title {
        font-family: var(--font-heading);
        font-weight: 900;
        font-size: 22px;
        color: var(--white);
      }
      .wb-sub {
        font-size: 13px;
        color: rgba(255,255,255,0.85);
        font-family: var(--font-heading);
      }
      .wb-bubbles {
        position: relative;
        width: 85px;
        height: 75px;
        flex-shrink: 0;
      }
      .wb-bubbles .b1 {
        position: absolute;
        width: 64px; height: 64px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        right: 0; top: 5px;
        animation: float 3s ease-in-out infinite;
      }
      .wb-bubbles .b2 {
        position: absolute;
        width: 30px; height: 30px;
        border-radius: 50%;
        background: rgba(255,255,255,0.18);
        left: 0; top: 0;
        animation: float 2.5s ease-in-out infinite 0.5s;
      }
      .wb-bubbles .b3 {
        position: absolute;
        width: 16px; height: 16px;
        border-radius: 50%;
        background: rgba(255,255,255,0.14);
        right: 2px; top: -2px;
        animation: float 2s ease-in-out infinite 1s;
      }

      /* ── Stats row (3 rounded pills) ── */
      .stats-row {
        display: flex;
        gap: 14px;
        margin-bottom: 32px;
        justify-content: center;
        animation: fadeUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both 0.2s;
      }
      .stat-pill {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        flex: 1;
      }
      .stat-circle {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        background: var(--surface2);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s, box-shadow 0.3s;
        border: 2px solid var(--border);
      }
      .stat-circle:active {
        transform: scale(0.95);
      }
      .stat-val {
        font-family: var(--font-heading);
        font-size: 28px;
        font-weight: 700;
        line-height: 1;
      }
      .stat-label {
        font-family: var(--font-heading);
        font-size: 12px;
        font-weight: 700;
        color: var(--text-muted);
        text-align: center;
        max-width: 80px;
        line-height: 1.3;
      }

      /* ── Section titles ── */
      .section-title {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 900;
        margin-bottom: 14px;
        color: var(--text);
      }

      /* ── Tabs ── */
      .tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 14px;
      }
      .tab {
        flex: 1;
        padding: 10px 16px;
        border-radius: var(--radius-pill);
        text-align: center;
        font-family: var(--font-heading);
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        border: none;
        -webkit-tap-highlight-color: transparent;
        transition: background 0.2s, color 0.2s, transform 0.15s;
      }
      .tab.active {
        background: var(--surface3);
        color: var(--text);
        border: 1px solid var(--border-light);
      }
      .tab:not(.active) {
        background: transparent;
        color: var(--text-muted);
        border: 1px solid transparent;
      }
      .tab:active { transform: scale(0.96); }

      /* ── Domain cards ── */
      .domain-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 32px;
      }
      .domain-card {
        background: var(--surface2);
        border-radius: 20px;
        padding: 16px 20px;
        overflow: hidden;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.2s, background 0.2s;
        border: 1px solid var(--border);
      }
      .domain-card:active { transform: scale(0.98); background: var(--surface3); }
      .domain-card.expanded {
        background: var(--surface3);
        border-color: var(--border-light);
      }
      .domain-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .domain-name {
        font-family: var(--font-heading);
        font-size: 20px;
        font-weight: 700;
        line-height: 1.3;
        text-transform: capitalize;
      }
      .domain-exposure {
        font-size: 13px;
        color: var(--text-muted);
        margin-top: 3px;
        font-family: var(--font-heading);
      }
      .domain-count {
        font-family: var(--font-heading);
        font-size: 13px;
        font-weight: 700;
        color: var(--text-muted);
        flex-shrink: 0;
        padding: 4px 10px;
        background: var(--surface3);
        border-radius: var(--radius-pill);
      }
      .domain-progress {
        margin-top: 10px;
        height: 4px;
        border-radius: 2px;
        background: var(--surface3);
        overflow: hidden;
      }
      .domain-progress-bar {
        height: 100%;
        border-radius: 2px;
        transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .domain-actions {
        display: flex;
        gap: 8px;
        margin-top: 14px;
        animation: fadeUp 0.25s ease both;
      }
      .domain-btn {
        flex: 1;
        background: var(--bleu-indigo);
        color: var(--white);
        padding: 10px 16px;
        border-radius: var(--radius-pill);
        font-family: var(--font-heading);
        font-size: 14px;
        font-weight: 700;
        text-align: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        border: none;
        transition: transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 2px 10px rgba(91, 63, 232, 0.3);
      }
      .domain-btn:active { transform: scale(0.96); }

      /* ── Subject items inside domain card ── */
      .subject-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid var(--border);
        animation: fadeUp 0.25s ease both;
      }
      .subject-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 0;
      }
      .subject-item + .subject-item {
        border-top: 1px solid var(--border);
      }
      .subject-info {
        flex: 1;
        min-width: 0;
      }
      .subject-name {
        font-family: var(--font-heading);
        font-size: 14px;
        font-weight: 700;
        text-transform: capitalize;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .subject-meta {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 1px;
        font-family: var(--font-heading);
      }
      .subject-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--text-muted);
        flex-shrink: 0;
      }

      /* ── Sujets majeurs (bubble chart) ── */
      .bubbles-section {
        margin-bottom: 32px;
      }
      .bubbles-subtitle {
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 20px;
        font-family: var(--font-heading);
      }
      .bubbles-chart {
        position: relative;
        width: 100%;
        height: 320px;
      }
      .bubble {
        position: absolute;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-heading);
        font-weight: 700;
        text-align: center;
        line-height: 1.15;
        padding: 14px;
        word-break: break-word;
        animation: bubblePop 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        cursor: default;
        transition: transform 0.3s;
      }
      .bubble:hover { transform: scale(1.05); }
      .bubble:nth-child(1) { animation-delay: 0.3s; }
      .bubble:nth-child(2) { animation-delay: 0.5s; }
      .bubble:nth-child(3) { animation-delay: 0.7s; }
      .bubble-count {
        display: block;
        font-size: 11px;
        font-weight: 400;
        opacity: 0.7;
        margin-top: 2px;
      }

      /* ── Transparence CTA ── */
      .transparence-cta {
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 18px 20px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.2s, background 0.2s, border-color 0.2s;
      }
      .transparence-cta:active { transform: scale(0.98); background: var(--surface3); }
      .tc-left {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .tc-title {
        font-family: var(--font-heading);
        font-weight: 900;
        font-size: 16px;
        color: var(--text);
      }
      .tc-sub {
        font-size: 12px;
        color: var(--text-dim);
      }
      .tc-arrow {
        font-size: 22px;
        color: var(--text-muted);
        transition: transform 0.2s;
      }
      .transparence-cta:active .tc-arrow { transform: translateX(4px); }

      /* ── CTA ── */
      .cta {
        text-align: center;
        margin-top: 8px;
      }
      .btn-cta {
        background: transparent;
        color: var(--bleu-indigo);
        border: 2px solid var(--bleu-indigo);
        padding: 12px 32px;
        border-radius: var(--radius-pill);
        font-size: 14px;
        font-weight: 600;
        font-family: var(--font-body);
        cursor: pointer;
        transition: transform 0.15s, background 0.15s;
      }
      .btn-cta:active { transform: scale(0.97); background: rgba(91, 63, 232, 0.08); }

      /* ── Profile illustration card ── */
      .profile-card {
        background: var(--surface2);
        border-radius: 24px;
        padding: 24px 20px 20px;
        margin-bottom: 28px;
        display: flex;
        align-items: center;
        gap: 18px;
        animation: fadeUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both 0.15s;
        border: 1px solid var(--border);
        overflow: hidden;
      }
      .profile-mascotte {
        position: relative;
        width: 80px;
        height: 80px;
        flex-shrink: 0;
      }
      .profile-mascotte .pc-bg {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: var(--rose);
        opacity: 0.2;
      }
      .profile-mascotte img {
        position: absolute;
        inset: 4px;
        width: calc(100% - 8px);
        height: calc(100% - 8px);
        object-fit: contain;
      }
      .profile-info {
        flex: 1;
        min-width: 0;
      }
      .profile-name {
        font-family: var(--font-heading);
        font-size: 20px;
        font-weight: 900;
        line-height: 1.2;
        color: var(--text);
      }
      .profile-desc {
        font-size: 13px;
        color: var(--text-dim);
        line-height: 1.4;
        margin-top: 4px;
      }
    `,
  ];

  @state() private launching = false;
  @state() private stats: DbStats | null = null;
  @state() private activeTab: 'exposure' | 'posts' = 'exposure';
  @state() private expandedDomain: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadStats();
  }

  private async loadStats() {
    try { this.stats = await getStats(); } catch { /* */ }
  }

  private openWrapped() {
    this.dispatchEvent(new CustomEvent('open-wrapped', { bubbles: true, composed: true }));
  }

  private openTransparence() {
    this.dispatchEvent(new CustomEvent('open-transparence', { bubbles: true, composed: true }));
  }

  private async launch() {
    this.launching = true;
    try {
      await openInstagram();
      this.dispatchEvent(new CustomEvent('instagram-opened', { bubbles: true, composed: true }));
    } catch (e) {
      console.warn('[Scrollout] Launch failed:', e);
    } finally {
      this.launching = false;
    }
  }

  render() {
    const s = this.stats;
    const hasData = s && s.totalPosts > 0;

    return html`
      <div class="header">
        <div class="logo-wrap">
          <span class="logo">Scrollout</span>
          <div class="dots-row">
            ${scrolloutDots.map(c => html`<span style="background:${c}"></span>`)}
          </div>
        </div>
      </div>

      ${!hasData ? html`
        <div class="empty">
          <div class="empty-hook">
            Tu scrolles.<br/>L'algorithme choisit.<br/><span class="hl">Tu ne vois rien.</span>
          </div>
          <div class="empty-text">
            Ouvre Instagram normalement.<br/>
            Scrollout analyse chaque post en arriere-plan — sans rien changer a ton experience.
          </div>
          <button class="btn-launch" @click=${this.launch} ?disabled=${this.launching}>
            ${this.launching ? 'Lancement...' : 'Ouvrir Instagram'}
          </button>
        </div>
      ` : this.renderProfile(s!)}
    `;
  }

  private renderProfile(s: DbStats) {
    const totalMinutes = Math.round((s.totalDwellMs || 0) / 60000);
    const profile = getUserProfile(s);

    // Group subjects by domain
    const domainGroups = this.buildDomainGroups(s);

    // Count distinct active subjects
    const activeSubjects = new Set([
      ...(s.subjectInsights || []).map(si => safeLabel(si.subject).toLowerCase()),
      ...(s.preciseSubjectInsights || []).map(psi => safeLabel(psi.subject).toLowerCase()),
      ...(s.topTopics || []).map(t => safeLabel(t.topic).toLowerCase()),
    ]).size || domainGroups.length;

    // For bubble chart: use subjectInsights (deeper subjects)
    const bubbleSubjects = (s.subjectInsights || [])
      .filter(si => si.count > 0)
      .sort((a, b) => b.totalDwellMs - a.totalDwellMs)
      .slice(0, 5);

    return html`
      <!-- Profile illustration -->
      <div class="profile-card">
        <div class="profile-mascotte">
          <div class="pc-bg"></div>
          <img src="assets/wrapped/s09-mascotte.svg" alt="" />
        </div>
        <div class="profile-info">
          <div class="profile-name">${profile.name}</div>
          <div class="profile-desc">${profile.desc}</div>
        </div>
      </div>

      <!-- Voir ma bulle banner -->
      <div class="wrapped-banner" @click=${this.openWrapped}>
        <div class="wb-left">
          <div class="wb-title">Voir ma bulle</div>
          <div class="wb-sub">Retrouve ton insta wrapped</div>
        </div>
        <div class="wb-bubbles">
          <div class="b1"></div>
          <div class="b2"></div>
          <div class="b3"></div>
        </div>
      </div>

      <!-- Stats row: 3 pills -->
      <div class="stats-row">
        <div class="stat-pill">
          <div class="stat-circle">
            <span class="stat-val">${totalMinutes > 0 ? String(totalMinutes).padStart(2, '0') : '00'}</span>
          </div>
          <span class="stat-label">min</span>
        </div>
        <div class="stat-pill">
          <div class="stat-circle">
            <span class="stat-val">${String(s.totalEnriched || s.totalPosts).padStart(2, '0')}</span>
          </div>
          <span class="stat-label">posts analyses</span>
        </div>
        <div class="stat-pill">
          <div class="stat-circle">
            <span class="stat-val">${String(activeSubjects).padStart(2, '0')}</span>
          </div>
          <span class="stat-label">sujets actifs</span>
        </div>
      </div>

      <!-- Mes sujets -->
      ${this.renderMesSujets(domainGroups)}

      <!-- Sujets majeurs -->
      ${this.renderSujetsMajeurs(bubbleSubjects)}

      <!-- Transparence CTA -->
      <div class="transparence-cta anim-fade-up" style="animation-delay:0.6s" @click=${this.openTransparence}>
        <div class="tc-left">
          <div class="tc-title">Transparence</div>
          <div class="tc-sub">Decouvre ce que l'algorithme sait de toi</div>
        </div>
        <span class="tc-arrow">&rarr;</span>
      </div>

      <!-- Continue capture -->
      <div class="cta anim-fade-in" style="animation-delay:0.7s">
        <button class="btn-cta" @click=${this.launch}>Continuer la capture</button>
      </div>
    `;
  }

  // ── Build domain groups from subjectInsights ─────────────────

  private buildDomainGroups(s: DbStats): Array<{
    domain: string;
    totalDwellMs: number;
    totalPosts: number;
    subjects: SubjectInsight[];
  }> {
    const map = new Map<string, { totalDwellMs: number; totalPosts: number; subjects: SubjectInsight[] }>();

    // Group subjectInsights by their primary domain
    for (const si of s.subjectInsights || []) {
      const domain = safeLabel(si.domains?.[0] || 'autre');
      const cur = map.get(domain) || { totalDwellMs: 0, totalPosts: 0, subjects: [] };
      cur.totalDwellMs += si.totalDwellMs || 0;
      cur.totalPosts += si.count || 0;
      cur.subjects.push(si);
      map.set(domain, cur);
    }

    // Also add preciseSubjectInsights subjects not already covered
    const existingSubjects = new Set((s.subjectInsights || []).map(si => safeLabel(si.subject).toLowerCase()));
    for (const psi of s.preciseSubjectInsights || []) {
      if (existingSubjects.has(safeLabel(psi.subject).toLowerCase())) continue;
      const domain = safeLabel(psi.domains?.[0] || 'autre');
      const cur = map.get(domain) || { totalDwellMs: 0, totalPosts: 0, subjects: [] };
      cur.totalDwellMs += psi.totalDwellMs || 0;
      cur.totalPosts += psi.count || 0;
      cur.subjects.push(psi);
      map.set(domain, cur);
    }

    // Fallback: if no subjectInsights, use topDomains + topTopics
    if (map.size === 0) {
      const domains = s.topDomainsReal?.length ? s.topDomainsReal : s.topDomains;
      const dwellByDomain = computeDwellByDomain(s);
      for (const d of domains || []) {
        const label = safeLabel(d.domain);
        const dw = dwellByDomain.get(label.toLowerCase());
        map.set(label, {
          totalDwellMs: dw?.totalDwellMs || 0,
          totalPosts: d.count,
          subjects: [],
        });
      }
    }

    // Sort by totalDwellMs desc, then by totalPosts
    return [...map.entries()]
      .map(([domain, data]) => ({
        domain,
        ...data,
        subjects: data.subjects.sort((a, b) => (b.totalDwellMs || 0) - (a.totalDwellMs || 0)),
      }))
      .sort((a, b) => b.totalDwellMs - a.totalDwellMs || b.totalPosts - a.totalPosts);
  }

  // ── Mes sujets ──────────────────────────────────────────────

  private renderMesSujets(groups: Array<{
    domain: string;
    totalDwellMs: number;
    totalPosts: number;
    subjects: SubjectInsight[];
  }>) {
    if (!groups.length) return nothing;

    const maxDwell = Math.max(...groups.map(g => g.totalDwellMs), 1);
    const maxPosts = Math.max(...groups.map(g => g.totalPosts), 1);

    return html`
      <div class="section-title anim-fade-up" style="animation-delay:0.3s">Mes sujets</div>
      <div class="tabs anim-fade-up" style="animation-delay:0.35s">
        <button class="tab ${this.activeTab === 'exposure' ? 'active' : ''}"
                @click=${() => { this.activeTab = 'exposure'; }}>Exposition</button>
        <button class="tab ${this.activeTab === 'posts' ? 'active' : ''}"
                @click=${() => { this.activeTab = 'posts'; }}>Posts</button>
      </div>
      <div class="domain-list">
        ${groups.slice(0, 6).map((g, i) => {
          const displayName = g.domain.replace(/_/g, ' ');
          const isExpanded = this.expandedDomain === g.domain;
          const color = domainColors[displayName.toLowerCase()] || scrolloutDots[i % scrolloutDots.length];

          const totalMin = Math.round(g.totalDwellMs / 60000);
          const totalSec = Math.round(g.totalDwellMs / 1000);
          const exposureLabel = totalMin > 0
            ? `${String(totalMin).padStart(2, '0')} min d'exposition`
            : totalSec > 0
            ? `${totalSec}s d'exposition`
            : '';

          const progressPct = this.activeTab === 'exposure'
            ? Math.round((g.totalDwellMs / maxDwell) * 100)
            : Math.round((g.totalPosts / maxPosts) * 100);

          return html`
            <div class="domain-card ${isExpanded ? 'expanded' : ''} anim-fade-up"
                 style="animation-delay:${0.4 + i * 0.06}s"
                 @click=${() => { this.expandedDomain = isExpanded ? null : g.domain; }}>
              <div class="domain-header">
                <div>
                  <div class="domain-name" style="color:${color}">${displayName}</div>
                  <div class="domain-exposure">
                    ${this.activeTab === 'exposure' ? exposureLabel : `${g.totalPosts} posts vus`}
                  </div>
                </div>
                <div class="domain-count">${g.totalPosts} posts</div>
              </div>
              <div class="domain-progress">
                <div class="domain-progress-bar" style="width:${progressPct}%;background:${color}"></div>
              </div>
              ${isExpanded ? html`
                ${g.subjects.length > 0 ? html`
                  <div class="subject-list">
                    ${g.subjects.slice(0, 5).map(si => {
                      const subName = safeLabel(si.subject);
                      const subMin = Math.round((si.totalDwellMs || 0) / 60000);
                      const subSec = Math.round((si.totalDwellMs || 0) / 1000);
                      const subDwell = subMin > 0 ? `${subMin}m` : subSec > 0 ? `${subSec}s` : '';
                      return html`
                        <div class="subject-item">
                          <div class="subject-info">
                            <div class="subject-name">${subName}</div>
                            <div class="subject-meta">
                              ${this.activeTab === 'exposure' && subDwell ? subDwell : `${si.count} posts`}
                              ${si.dominantEmotion ? html` · ${safeLabel(si.dominantEmotion)}` : ''}
                            </div>
                          </div>
                          <div class="subject-count">${si.count} posts</div>
                        </div>
                      `;
                    })}
                  </div>
                ` : ''}
                <div class="domain-actions">
                  <button class="domain-btn" @click=${(e: Event) => { e.stopPropagation(); this.dispatchEvent(new CustomEvent('search-domain', { detail: { domain: g.domain }, bubbles: true, composed: true })); }}>Recherche</button>
                  <button class="domain-btn" @click=${(e: Event) => { e.stopPropagation(); this.dispatchEvent(new CustomEvent('collect-domain', { detail: { domain: g.domain }, bubbles: true, composed: true })); }}>Collection</button>
                </div>
              ` : ''}
            </div>
          `;
        })}
      </div>
    `;
  }

  // ── Sujets majeurs (bubble chart from subjectInsights) ──────

  private renderSujetsMajeurs(subjects: SubjectInsight[]) {
    if (!subjects.length) return nothing;

    const top = subjects.slice(0, 5);
    const maxDwell = Math.max(...top.map(s => s.totalDwellMs));

    const bubbleColors = [palette.violet, palette.vertMenthe, palette.bleuCiel, palette.rose, palette.jaune];
    const bubbleTextColors = ['#fff', '#000', '#000', '#000', '#000'];

    const positions = [
      { left: 10, top: 5 },
      { left: 48, top: 38 },
      { left: 2, top: 52 },
      { left: 55, top: 5 },
      { left: 30, top: 60 },
    ];

    return html`
      <div class="bubbles-section anim-fade-up" style="animation-delay:0.5s">
        <div class="section-title">Sujets majeurs</div>
        <div class="bubbles-subtitle">Ces sujets ressortent le plus dans ton feed</div>
        <div class="bubbles-chart">
          ${top.map((si, i) => {
            const ratio = maxDwell > 0 ? si.totalDwellMs / maxDwell : 0.5;
            const size = Math.max(Math.round(180 * Math.max(ratio, 0.45)), 90);
            const label = safeLabel(si.subject).replace(/_/g, ' ');
            const fontSize = size > 150 ? 22 : size > 110 ? 16 : 13;

            return html`
              <div class="bubble" style="
                left: ${positions[i]?.left ?? 20}%;
                top: ${positions[i]?.top ?? 20}%;
                width: ${size}px;
                height: ${size}px;
                background: ${bubbleColors[i % bubbleColors.length]};
                color: ${bubbleTextColors[i % bubbleTextColors.length]};
                font-size: ${fontSize}px;
              ">
                ${label}
                <span class="bubble-count">${si.count} posts</span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }
}
