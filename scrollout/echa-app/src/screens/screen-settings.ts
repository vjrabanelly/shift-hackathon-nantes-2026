import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, scrolloutDots } from '../styles/theme.js';
import '../components/scrollout-logo.js';
import {
  startDaemon,
  stopDaemon,
  getDaemonStatus,
  onStatusChange,
  triggerNow,
  type DaemonStatus,
} from '../services/enrichment-daemon.js';
import { getStats, resetAllEnrichments, deduplicatePosts, type DbStats } from '../services/db-bridge.js';

@customElement('screen-settings')
export class ScreenSettings extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 16px; padding-bottom: 32px; }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      .page-title {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 700;
      }

      .section {
        background: var(--surface2);
        border-radius: var(--radius);
        padding: 16px;
        margin-bottom: 14px;
      }
      .section-label {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-dim);
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border);
      }

      /* ── Daemon status card ── */
      .daemon-card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px;
        background: var(--surface3);
        border-radius: var(--radius-sm);
        margin-bottom: 14px;
      }
      .daemon-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .daemon-indicator.on {
        background: var(--vert-menthe);
        box-shadow: 0 0 8px var(--vert-menthe);
        animation: blink 2s ease-in-out infinite;
      }
      .daemon-indicator.off { background: var(--text-muted); }
      @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      .daemon-info { flex: 1; }
      .daemon-title { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
      .daemon-detail { font-size: 11px; color: var(--text-dim); line-height: 1.5; }

      /* ── Stats row ── */
      .stats-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        margin-bottom: 14px;
      }
      .stat-mini {
        background: var(--surface3);
        border-radius: var(--radius-sm);
        padding: 10px 6px;
        text-align: center;
      }
      .stat-mini-val {
        font-family: var(--font-heading);
        font-size: 18px;
        font-weight: 700;
        line-height: 1.1;
      }
      .stat-mini-label {
        font-family: var(--font-mono);
        font-size: 8px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--text-dim);
        margin-top: 3px;
      }

      /* ── Field ── */
      .field { margin-bottom: 14px; }
      .field:last-child { margin-bottom: 0; }
      .field label {
        display: block;
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-dim);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        margin-bottom: 6px;
      }
      .field input[type="url"],
      .field input[type="password"],
      .field input[type="number"] {
        width: 100%;
        background: var(--surface3);
        border: 1px solid var(--border);
        color: var(--text);
        padding: 12px 14px;
        border-radius: var(--radius-sm);
        font-family: var(--font-body);
        font-size: 14px;
        transition: border-color 0.15s;
      }
      .field input:focus {
        outline: none;
        border-color: var(--bleu-indigo);
      }
      .hint {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 6px;
        line-height: 1.5;
      }

      /* ── Toggle row ── */
      .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid var(--border);
      }
      .toggle-row:last-child { border-bottom: none; }
      .toggle-label { font-size: 13px; }
      .toggle-desc { font-size: 11px; color: var(--text-dim); margin-top: 2px; }

      .toggle {
        position: relative;
        width: 44px;
        height: 24px;
        flex-shrink: 0;
      }
      .toggle input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .toggle-track {
        position: absolute;
        inset: 0;
        background: var(--surface3);
        border-radius: 12px;
        border: 1px solid var(--border);
        transition: background 0.2s;
        cursor: pointer;
      }
      .toggle-track::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--text-dim);
        transition: transform 0.2s, background 0.2s;
      }
      .toggle input:checked + .toggle-track {
        background: var(--bleu-indigo);
        border-color: var(--bleu-indigo);
      }
      .toggle input:checked + .toggle-track::after {
        transform: translateX(20px);
        background: var(--white);
      }

      /* ── Buttons ── */
      .btn-row {
        display: flex;
        gap: 8px;
      }
      .btn {
        border: none;
        padding: 12px 20px;
        border-radius: var(--radius-pill);
        font-size: 13px;
        font-weight: 600;
        font-family: var(--font-body);
        cursor: pointer;
        transition: transform 0.15s;
      }
      .btn:active { transform: scale(0.97); }
      .btn-primary { background: var(--bleu-indigo); color: var(--white); flex: 1; }
      .btn-danger { background: var(--rouge); color: var(--white); flex: 1; }
      .btn-secondary { background: var(--surface3); color: var(--text); border: 1px solid var(--border); }

      .status-bar {
        margin-top: 12px;
        padding: 10px 14px;
        border-radius: var(--radius-sm);
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .status-bar.ok { background: rgba(107, 232, 139, 0.1); color: var(--vert-menthe); }
      .status-bar.err { background: rgba(255, 34, 34, 0.1); color: var(--rouge); }
      .status-bar.pending { background: var(--surface3); color: var(--text-dim); }

      /* ── About ── */
      .about {
        text-align: center;
        padding: 24px 16px;
      }
      .about-logo-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 10px;
      }
      .about-logo-row svg { width: 30px; height: 30px; }
      .about-logo {
        font-family: var(--font-heading);
        font-size: 24px;
        font-weight: 900;
      }
      .about-tagline {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        margin-bottom: 6px;
      }
      .about-version {
        font-size: 11px;
        color: var(--text-muted);
        margin-bottom: 16px;
      }
      .about-manifesto {
        font-size: 13px;
        line-height: 1.6;
        color: var(--text-dim);
        max-width: 300px;
        margin: 0 auto 16px;
      }
      .about-manifesto strong { color: var(--orange); font-weight: 600; }
      .about-privacy {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-muted);
        letter-spacing: 0.02em;
      }
      .privacy-item {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
      }
      .privacy-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--vert-menthe);
        flex-shrink: 0;
      }
    `,
  ];

  @state() private apiUrl = localStorage.getItem('echa-api-url') || 'http://localhost:3000';
  @state() private status: 'idle' | 'testing' | 'ok' | 'error' = 'idle';
  @state() private statusMsg = '';
  @state() private openaiKey = localStorage.getItem('scrollout-openai-key') || '';
  @state() private daemonInterval = parseInt(localStorage.getItem('scrollout-daemon-interval') || '120');
  @state() private daemonStatus: DaemonStatus = getDaemonStatus();
  @state() private rulesOnly = localStorage.getItem('scrollout-rules-only') === 'true';
  @state() private enableTranscription = localStorage.getItem('scrollout-enable-transcription') !== 'false';
  @state() private enableVision = localStorage.getItem('scrollout-enable-vision') !== 'false';
  @state() private stats: DbStats | null = null;
  @state() private enrichMsg = '';
  @state() private dedupMsg = '';

  private unsubDaemon?: () => void;
  private statsInterval?: ReturnType<typeof setInterval>;

  connectedCallback() {
    super.connectedCallback();
    this.unsubDaemon = onStatusChange(s => { this.daemonStatus = s; });
    this.loadStats();
    // Auto-refresh stats every 5s when daemon is running
    this.statsInterval = setInterval(() => {
      if (this.daemonStatus.running) this.loadStats();
    }, 5000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubDaemon?.();
    if (this.statsInterval) clearInterval(this.statsInterval);
  }

  private async loadStats() {
    try { this.stats = await getStats(); } catch { /* */ }
  }

  private toggleDaemon() {
    if (this.daemonStatus.running) {
      stopDaemon();
    } else {
      if (!this.rulesOnly && !this.openaiKey) {
        this.statusMsg = 'Cle API OpenAI requise pour le mode LLM';
        this.status = 'error';
        return;
      }
      localStorage.setItem('scrollout-openai-key', this.openaiKey);
      localStorage.setItem('scrollout-daemon-interval', String(this.daemonInterval));
      localStorage.setItem('scrollout-rules-only', String(this.rulesOnly));
      localStorage.setItem('scrollout-enable-transcription', String(this.enableTranscription));
      localStorage.setItem('scrollout-enable-vision', String(this.enableVision));
      startDaemon({
        intervalSec: this.daemonInterval,
        batchSize: 10,
        threshold: 2,
        apiKey: this.openaiKey,
        rulesOnly: this.rulesOnly,
        enableTranscription: this.enableTranscription,
        enableVision: this.enableVision,
      });
    }
  }

  private async manualEnrich() {
    if (!this.daemonStatus.running) {
      if (!this.rulesOnly && !this.openaiKey) {
        this.statusMsg = 'Cle API OpenAI requise';
        this.status = 'error';
        return;
      }
      localStorage.setItem('scrollout-openai-key', this.openaiKey);
      startDaemon({
        intervalSec: 999999,
        batchSize: 20,
        threshold: 1,
        apiKey: this.openaiKey,
        rulesOnly: this.rulesOnly,
        enableTranscription: this.enableTranscription,
        enableVision: this.enableVision,
      });
      return;
    }
    await triggerNow();
  }

  private async resetEnrichments() {
    this.enrichMsg = 'Suppression en cours...';
    try {
      // Delete ALL enrichments (loop until none left)
      let totalDeleted = 0;
      let batch: number;
      do {
        batch = await resetAllEnrichments();
        totalDeleted += batch;
        this.enrichMsg = `Suppression: ${totalDeleted} supprimes...`;
      } while (batch > 0);

      this.enrichMsg = `${totalDeleted} enrichissements supprimes. Relance...`;
      try { this.stats = await getStats(); } catch { /* */ }

      // Stop existing daemon, restart in bulk mode
      if (this.daemonStatus.running) stopDaemon();
      const hasKey = !!this.openaiKey;
      startDaemon({
        intervalSec: 3,
        batchSize: 1000,
        threshold: 1,
        apiKey: this.openaiKey,
        rulesOnly: !hasKey,
        enableTranscription: this.enableTranscription,
        enableVision: this.enableVision,
      });

      this.enrichMsg = `${totalDeleted} posts a re-classifier. Daemon lance.`;

      // Poll stats every 5s to update UI progress
      const poll = setInterval(async () => {
        try {
          this.stats = await getStats();
          const total = this.stats?.totalPosts || 0;
          const enriched = this.stats?.totalEnriched || 0;
          const pct = total > 0 ? Math.round(enriched / total * 100) : 0;
          this.enrichMsg = `Re-classification: ${enriched}/${total} (${pct}%)`;
          if (enriched >= total * 0.95) {
            clearInterval(poll);
            this.enrichMsg = `Re-classification terminee: ${enriched}/${total}`;
          }
        } catch { /* */ }
      }, 5000);
    } catch (e: any) {
      this.enrichMsg = `Erreur: ${e.message}`;
    }
  }

  private async cleanupDuplicates() {
    this.dedupMsg = 'Recherche de doublons...';
    try {
      const removed = await deduplicatePosts();
      if (removed > 0) {
        this.dedupMsg = `${removed} doublon${removed > 1 ? 's' : ''} supprime${removed > 1 ? 's' : ''}`;
        try { this.stats = await getStats(); } catch { /* */ }
      } else {
        this.dedupMsg = 'Aucun doublon detecte';
      }
    } catch (e: any) {
      this.dedupMsg = `Erreur: ${e.message}`;
    }
  }

  private async testAndSave() {
    const url = this.apiUrl.replace(/\/+$/, '');
    this.status = 'testing';
    this.statusMsg = 'Test de connexion...';
    try {
      const res = await fetch(`${url}/api/stats`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localStorage.setItem('echa-api-url', url);
      this.status = 'ok';
      this.statusMsg = `${data.totalPosts ?? 0} posts, ${data.totalSessions ?? 0} sessions`;
    } catch (e: any) {
      this.status = 'error';
      this.statusMsg = e.message || 'Connexion impossible';
    }
  }

  render() {
    const ds = this.daemonStatus;
    const s = this.stats;
    const enrichRate = s && s.totalPosts > 0 ? Math.round(s.totalEnriched / s.totalPosts * 100) : 0;

    return html`
      <div class="page-header">
        <div class="page-title">Configuration</div>
      </div>

      <!-- Daemon status overview -->
      <div class="section">
        <div class="section-label">Moteur d'analyse</div>

        <div class="daemon-card">
          <div class="daemon-indicator ${ds.running ? 'on' : 'off'}"></div>
          <div class="daemon-info">
            <div class="daemon-title">${ds.running ? 'Enrichissement actif' : 'Enrichissement inactif'}${ds.llmEnabled ? ' (GPT)' : ds.running ? ' (rules)' : ''}</div>
            <div class="daemon-detail">
              ${ds.running
                ? ds.phase === 'rules'
                  ? html`Phase 1/2 — Rules : ${ds.rulesCount}/${ds.tickTotal} posts classes`
                  : ds.phase === 'llm'
                  ? html`Phase 2/2 — GPT : ${ds.llmCount}/${ds.tickTotal} posts raffines`
                  : ds.phase === 'done'
                  ? html`Termine : ${ds.rulesCount} rules + ${ds.llmCount} GPT${ds.lastEnrichAt ? html` — ${new Date(ds.lastEnrichAt).toLocaleTimeString()}` : ''}`
                  : html`En attente — ${ds.pendingPosts} posts a traiter${ds.lastEnrichAt ? html` — dernier ${new Date(ds.lastEnrichAt).toLocaleTimeString()}` : ''}`
                : 'Le daemon n\'est pas demarre'}
            </div>
          </div>
        </div>

        ${s ? html`
          <div class="stats-row">
            <div class="stat-mini">
              <div class="stat-mini-val" style="color:var(--bleu-indigo)">${s.totalPosts}</div>
              <div class="stat-mini-label">Posts</div>
            </div>
            <div class="stat-mini">
              <div class="stat-mini-val" style="color:var(--vert-menthe)">${s.totalEnriched}</div>
              <div class="stat-mini-label">Enrichis</div>
            </div>
            <div class="stat-mini">
              <div class="stat-mini-val" style="color:var(--jaune)">${enrichRate}%</div>
              <div class="stat-mini-label">Taux</div>
            </div>
            <div class="stat-mini">
              <div class="stat-mini-val" style="color:var(--orange)">${s.totalSessions}</div>
              <div class="stat-mini-label">Sessions</div>
            </div>
          </div>
        ` : ''}

        <div class="btn-row">
          <button
            class="btn ${ds.running ? 'btn-danger' : 'btn-primary'}"
            @click=${this.toggleDaemon}
          >
            ${ds.running ? 'Arreter' : 'Demarrer'}
          </button>
          <button class="btn btn-secondary" @click=${this.manualEnrich}>
            Enrichir maintenant
          </button>
          <button class="btn btn-danger" @click=${this.resetEnrichments}>
            Re-classifier tout
          </button>
          <button class="btn btn-secondary" @click=${this.cleanupDuplicates}>
            Nettoyer doublons
          </button>
        </div>
        ${this.dedupMsg ? html`<div style="margin-top:8px;font-size:12px;color:var(--text-dim)">${this.dedupMsg}</div>` : ''}
        ${ds.running && (ds.phase === 'rules' || ds.phase === 'llm') ? (() => {
          const current = ds.phase === 'rules' ? ds.rulesCount : ds.llmCount;
          const total = ds.tickTotal;
          const pct = total > 0 ? Math.round(current / total * 100) : 0;
          const phaseLabel = ds.phase === 'rules' ? 'Rules (classification rapide)' : 'GPT (analyse semiologique)';
          const barColor = ds.phase === 'rules' ? 'var(--jaune)' : 'var(--vert-menthe)';
          return html`
            <div style="margin-top:10px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px;">
                <span>${phaseLabel}</span>
                <span>${current}/${total} (${pct}%)</span>
              </div>
              <div style="height:6px;background:var(--surface);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width 0.5s;"></div>
              </div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">
                Total : ${ds.totalSucceeded} enrichis, ${ds.totalSkipped} ignores, ${ds.totalFailed} erreurs
              </div>
            </div>`;
        })() : ds.running && ds.phase === 'done' ? html`
          <div style="margin-top:10px;font-size:11px;color:var(--vert-menthe);">
            Dernier cycle : ${ds.rulesCount} rules + ${ds.llmCount} GPT
          </div>
        ` : ''}
        ${this.enrichMsg ? html`
          <div class="status-bar ok" style="margin-top:8px;">
            ${this.enrichMsg}
          </div>
        ` : ''}
      </div>

      <!-- LLM config -->
      <div class="section">
        <div class="section-label">Intelligence artificielle</div>

        <div class="field">
          <label>Cle API OpenAI</label>
          <input
            type="password"
            .value=${this.openaiKey}
            @input=${(e: Event) => { this.openaiKey = (e.target as HTMLInputElement).value; }}
            placeholder="sk-..."
          />
          <div class="hint">gpt-4o-mini — analyse semantique, polarisation, emotions.</div>
        </div>

        <div class="field">
          <label>Intervalle (secondes)</label>
          <input
            type="number"
            .value=${String(this.daemonInterval)}
            @input=${(e: Event) => { this.daemonInterval = parseInt((e.target as HTMLInputElement).value) || 120; }}
            min="30"
            max="3600"
          />
          <div class="hint">Frequence de verification des posts non enrichis.</div>
        </div>

        <div class="toggle-row">
          <div>
            <div class="toggle-label">Mode hors-ligne</div>
            <div class="toggle-desc">Regles locales uniquement, pas d'appel API</div>
          </div>
          <label class="toggle">
            <input
              type="checkbox"
              .checked=${this.rulesOnly}
              @change=${(e: Event) => { this.rulesOnly = (e.target as HTMLInputElement).checked; }}
            />
            <span class="toggle-track"></span>
          </label>
        </div>

        <div class="toggle-row">
          <div>
            <div class="toggle-label">Transcription video</div>
            <div class="toggle-desc">Whisper API pour reels sans texte (~$0.006/min)</div>
          </div>
          <label class="toggle">
            <input
              type="checkbox"
              .checked=${this.enableTranscription}
              ?disabled=${this.rulesOnly}
              @change=${(e: Event) => { this.enableTranscription = (e.target as HTMLInputElement).checked; }}
            />
            <span class="toggle-track"></span>
          </label>
        </div>

        <div class="toggle-row">
          <div>
            <div class="toggle-label">Analyse visuelle</div>
            <div class="toggle-desc">Vision GPT-4o pour posts sans texte (+85 tokens)</div>
          </div>
          <label class="toggle">
            <input
              type="checkbox"
              .checked=${this.enableVision}
              ?disabled=${this.rulesOnly}
              @change=${(e: Event) => { this.enableVision = (e.target as HTMLInputElement).checked; }}
            />
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <!-- Server sync (secondary) -->
      <div class="section">
        <div class="section-label">Sync PC (optionnel)</div>
        <div class="field">
          <label>URL du serveur</label>
          <input
            type="url"
            .value=${this.apiUrl}
            @input=${(e: Event) => { this.apiUrl = (e.target as HTMLInputElement).value; }}
            placeholder="http://192.168.x.x:3000"
          />
        </div>

        <button class="btn btn-secondary" style="width:100%" @click=${this.testAndSave}>Tester la connexion</button>

        ${this.status !== 'idle' ? html`
          <div class="status-bar ${this.status === 'ok' ? 'ok' : this.status === 'error' ? 'err' : 'pending'}">
            <span class="daemon-indicator ${this.status === 'ok' ? 'on' : 'off'}" style="width:8px;height:8px;"></span>
            ${this.statusMsg}
          </div>
        ` : ''}
      </div>

      <!-- About -->
      <div class="about">
        <div class="about-logo-row">
          <scrollout-logo size="30"></scrollout-logo>
          <span class="about-logo">Scrollout</span>
        </div>
        <div class="about-tagline">Reprends le controle sur ton feed</div>
        <div class="about-version">v0.1.0-alpha</div>

        <div class="about-manifesto">
          L'algorithme te connait. <strong>Toi, tu ne le connais pas.</strong><br/>
          Scrollout rend visible ce qui est invisible.
        </div>

        <div class="about-privacy">
          <div class="privacy-item"><span class="privacy-dot"></span>Aucune donnee ne quitte ton telephone</div>
          <div class="privacy-item"><span class="privacy-dot"></span>Pas de tracking, pas de cloud, pas de compte</div>
          <div class="privacy-item"><span class="privacy-dot"></span>Open source — tout le code est auditable</div>
        </div>
      </div>
    `;
  }
}
