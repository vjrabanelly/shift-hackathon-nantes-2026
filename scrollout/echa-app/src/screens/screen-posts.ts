import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, polColors, polLabels, domainColors, attentionColors, scrolloutDots } from '../styles/theme.js';
import { getSessions, getPosts, safeParse, type PostEntry, type SessionSummary } from '../services/db-bridge.js';

@customElement('screen-posts')
export class ScreenPosts extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 16px; padding-bottom: 32px; }

      /* ── Header ── */
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .page-title {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 700;
      }
      .refresh-btn {
        background: var(--surface3);
        border: 1px solid var(--border);
        color: var(--text-dim);
        padding: 6px 14px;
        border-radius: var(--radius-pill);
        font-size: 10px;
        font-family: var(--font-mono);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        cursor: pointer;
      }
      .refresh-btn:active { opacity: 0.7; }

      /* ── Session selector ── */
      .session-selector {
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 10px 12px;
        width: 100%;
        color: var(--text);
        font-family: var(--font-body);
        font-size: 13px;
        margin-bottom: 14px;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        cursor: pointer;
      }
      .session-selector:focus { outline: none; border-color: var(--bleu-indigo); }

      /* ── Post list ── */
      .post-list { display: flex; flex-direction: column; gap: 10px; }

      /* ── Post card ── */
      .post-card {
        background: var(--surface2);
        border-radius: var(--radius);
        padding: 14px;
        cursor: pointer;
        transition: transform 0.1s, box-shadow 0.15s;
        border: 1px solid transparent;
      }
      .post-card:active {
        transform: scale(0.98);
        border-color: var(--border);
      }

      .pc-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .pc-user {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .pc-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--surface3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        color: var(--violet);
        flex-shrink: 0;
      }
      .pc-username {
        font-weight: 600;
        font-size: 13px;
      }
      .pc-pol-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border-radius: var(--radius-pill);
        font-size: 10px;
        font-weight: 700;
        color: var(--white);
      }
      .pc-account-topics {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin-top: 2px;
      }
      .account-topic {
        font-size: 9px;
        color: var(--text-muted);
        font-style: italic;
      }

      .pc-caption {
        font-size: 13px;
        color: var(--text);
        line-height: 1.5;
        margin-bottom: 8px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .pc-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-dim);
        text-transform: uppercase;
      }
      .pc-meta-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--border-light);
      }

      .pc-tags {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
        margin-bottom: 6px;
      }
      .tag {
        display: inline-block;
        padding: 3px 8px;
        border-radius: var(--radius-pill);
        font-size: 10px;
        font-weight: 600;
      }
      .tag-topic {
        background: rgba(107, 107, 255, 0.12);
        color: var(--bleu-indigo);
      }
      .tag-ad {
        background: rgba(255, 233, 74, 0.15);
        color: var(--jaune);
      }
      .tag-sug {
        background: rgba(136, 204, 255, 0.15);
        color: var(--bleu-ciel);
      }
      .tag-narrative {
        background: rgba(232, 139, 232, 0.12);
        color: var(--rose);
      }
      .tag-review {
        background: rgba(255, 123, 51, 0.15);
        color: var(--orange);
      }

      .pc-scores {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .pc-score-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: var(--text-dim);
      }
      .score-bar {
        width: 40px;
        height: 5px;
        background: var(--bg);
        border-radius: 3px;
        overflow: hidden;
      }
      .score-bar-fill {
        height: 100%;
        border-radius: 3px;
      }

      /* ── Detail modal ── */
      .modal-bg {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        z-index: 100;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: fadeIn 0.15s;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .modal {
        background: var(--surface);
        border-radius: 20px 20px 0 0;
        width: 100%;
        max-width: 500px;
        max-height: 88vh;
        overflow-y: auto;
        padding: 20px 16px;
        padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
        animation: slideUp 0.2s ease-out;
      }
      @keyframes slideUp {
        from { transform: translateY(40px); }
        to { transform: translateY(0); }
      }
      .modal-handle {
        width: 36px;
        height: 4px;
        background: var(--border-light);
        border-radius: 2px;
        margin: 0 auto 16px;
      }

      .detail-user {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
      }
      .detail-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--surface3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
        color: var(--violet);
      }
      .detail-username {
        font-family: var(--font-heading);
        font-size: 18px;
        font-weight: 700;
      }

      .detail-section {
        margin-bottom: 16px;
      }
      .ds-label {
        font-family: var(--font-mono);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-dim);
        margin-bottom: 6px;
      }
      .ds-value {
        font-size: 13px;
        color: var(--text);
        line-height: 1.5;
      }
      .ds-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .detail-gauge {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      .detail-gauge-label {
        width: 80px;
        font-size: 11px;
        text-align: right;
        flex-shrink: 0;
      }
      .detail-gauge-track {
        flex: 1;
        height: 10px;
        background: var(--bg);
        border-radius: 5px;
        overflow: hidden;
      }
      .detail-gauge-fill {
        height: 100%;
        border-radius: 5px;
        transition: width 0.4s;
      }
      .detail-gauge-val {
        width: 36px;
        font-family: var(--font-mono);
        font-size: 11px;
        text-align: right;
        flex-shrink: 0;
      }

      .axis-row {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 5px;
      }
      .axis-label { width: 56px; font-size: 10px; text-align: right; flex-shrink: 0; }
      .axis-track {
        flex: 1;
        height: 10px;
        background: var(--bg);
        border-radius: 5px;
        position: relative;
        overflow: hidden;
      }
      .axis-center { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--border); }
      .axis-fill { position: absolute; height: 100%; border-radius: 5px; }
      .axis-val { width: 32px; font-family: var(--font-mono); font-size: 9px; text-align: right; flex-shrink: 0; }

      .detail-signals {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .signal {
        padding: 3px 8px;
        border-radius: var(--radius-pill);
        font-size: 9px;
        font-weight: 600;
      }
      .signal-on {
        background: rgba(255, 34, 34, 0.12);
        color: var(--rouge);
      }
      .signal-off {
        background: var(--surface3);
        color: var(--text-muted);
      }

      /* ── States ── */
      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 30vh;
        gap: 12px;
        color: var(--text-dim);
        font-size: 13px;
      }
      .error {
        text-align: center;
        padding: 20px;
        color: var(--rouge);
        font-size: 13px;
      }
      .empty {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-dim);
        font-size: 13px;
      }
    `,
  ];

  @state() private posts: PostEntry[] = [];
  @state() private sessions: SessionSummary[] = [];
  @state() private selectedSession = '';
  @state() private loading = true;
  @state() private error = '';
  @state() private selectedPost: PostEntry | null = null;
  @state() private accountTopics = new Map<string, string[]>();

  connectedCallback() {
    super.connectedCallback();
    this.loadSessions();
  }

  private async loadSessions() {
    try {
      this.sessions = await getSessions();
      if (this.sessions.length > 0) {
        this.selectedSession = this.sessions[0].id;
        await this.loadPosts();
      } else {
        this.loading = false;
      }
    } catch (e: any) {
      this.error = e.message || 'Erreur DB';
      this.loading = false;
    }
  }

  private async loadPosts() {
    this.loading = true;
    this.error = '';
    try {
      const limit = this.selectedSession === '' ? 500 : 100;
      this.posts = await getPosts(this.selectedSession, 0, limit);
      this.buildAccountTopics();
    } catch (e: any) {
      this.error = e.message || 'Erreur DB';
    } finally {
      this.loading = false;
    }
  }

  /** Aggregate top topics per account across all loaded posts */
  private buildAccountTopics() {
    const map = new Map<string, Map<string, number>>();
    for (const p of this.posts) {
      if (!p.username || !p.enrichment) continue;
      if (!map.has(p.username)) map.set(p.username, new Map());
      const topicCounts = map.get(p.username)!;
      for (const t of safeParse(p.enrichment.mainTopics)) {
        topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
      }
    }
    const result = new Map<string, string[]>();
    for (const [user, topicCounts] of map) {
      const sorted = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]);
      result.set(user, sorted.slice(0, 3).map(([t]) => t));
    }
    this.accountTopics = result;
  }

  private openDetail(p: PostEntry) {
    this.selectedPost = p;
  }

  private closeDetail() {
    this.selectedPost = null;
  }

  private renderAxisBar(label: string, value: number) {
    const absPct = Math.abs(value) * 50;
    const left = value < 0 ? (50 - absPct) : 50;
    const color = Math.abs(value) < 0.1 ? 'var(--text-muted)' : value < 0 ? 'var(--bleu-indigo)' : 'var(--orange)';
    const display = value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
    return html`
      <div class="axis-row">
        <span class="axis-label">${label}</span>
        <div class="axis-track">
          <div class="axis-center"></div>
          <div class="axis-fill" style="left:${left}%;width:${absPct}%;background:${color}"></div>
        </div>
        <span class="axis-val" style="color:${color}">${display}</span>
      </div>
    `;
  }

  private renderDetail() {
    const p = this.selectedPost;
    if (!p) return nothing;

    const e = p.enrichment;
    const topics = e ? safeParse(e.mainTopics) : [];
    const domains = e?.domains ? safeParse(e.domains) : [];
    const initial = (p.username || '?')[0].toUpperCase();

    return html`
      <div class="modal-bg" @click=${(ev: Event) => { if ((ev.target as HTMLElement).classList.contains('modal-bg')) this.closeDetail(); }}>
        <div class="modal">
          <div class="modal-handle"></div>

          <div class="detail-user">
            <div class="detail-avatar">${initial}</div>
            <div class="detail-username">@${p.username || '?'}</div>
            ${e ? html`<span class="pc-pol-badge" style="background:${polColors[e.politicalScore]};margin-left:auto">${polLabels[e.politicalScore]}</span>` : ''}
          </div>

          <!-- Caption -->
          <div class="detail-section">
            <div class="ds-label">Caption</div>
            <div class="ds-value">${p.caption || '—'}</div>
          </div>

          <!-- Meta grid -->
          <div class="detail-section">
            <div class="ds-grid">
              <div>
                <div class="ds-label">Type</div>
                <div class="ds-value">${p.mediaType}</div>
              </div>
              <div>
                <div class="ds-label">Attention</div>
                <div class="ds-value" style="color:${attentionColors[p.attentionLevel] || 'var(--text)'}">
                  ${p.attentionLevel} (${(p.dwellTimeMs / 1000).toFixed(1)}s)
                </div>
              </div>
            </div>
          </div>

          ${e ? html`
            <!-- Topics -->
            <div class="detail-section">
              <div class="ds-label">Themes</div>
              <div class="pc-tags">
                ${topics.map(t => html`<span class="tag tag-topic">${t}</span>`)}
                ${domains.map(d => html`<span class="tag tag-narrative">${d}</span>`)}
              </div>
            </div>

            <!-- Scores gauges -->
            <div class="detail-section">
              <div class="ds-label">Scores</div>
              <div class="detail-gauge">
                <span class="detail-gauge-label">Politique</span>
                <div class="detail-gauge-track">
                  <div class="detail-gauge-fill" style="width:${e.politicalScore / 4 * 100}%;background:${polColors[e.politicalScore]}"></div>
                </div>
                <span class="detail-gauge-val">${e.politicalScore}/4</span>
              </div>
              <div class="detail-gauge">
                <span class="detail-gauge-label">Polarisation</span>
                <div class="detail-gauge-track">
                  <div class="detail-gauge-fill" style="width:${e.polarizationScore * 100}%;background:${e.polarizationScore > 0.5 ? 'var(--rouge)' : e.polarizationScore > 0.3 ? 'var(--jaune)' : 'var(--vert-menthe)'}"></div>
                </div>
                <span class="detail-gauge-val">${(e.polarizationScore * 100).toFixed(0)}%</span>
              </div>
              <div class="detail-gauge">
                <span class="detail-gauge-label">Confiance</span>
                <div class="detail-gauge-track">
                  <div class="detail-gauge-fill" style="width:${e.confidenceScore * 100}%;background:var(--bleu-indigo)"></div>
                </div>
                <span class="detail-gauge-val">${(e.confidenceScore * 100).toFixed(0)}%</span>
              </div>
              ${e.emotionIntensity !== undefined ? html`
                <div class="detail-gauge">
                  <span class="detail-gauge-label">Emotion</span>
                  <div class="detail-gauge-track">
                    <div class="detail-gauge-fill" style="width:${(e.emotionIntensity ?? 0) * 100}%;background:var(--rose)"></div>
                  </div>
                  <span class="detail-gauge-val">${((e.emotionIntensity ?? 0) * 100).toFixed(0)}%</span>
                </div>
              ` : ''}
            </div>

            <!-- Political axes -->
            ${(e.axisEconomic !== 0 || e.axisSocietal !== 0 || e.axisAuthority !== 0 || e.axisSystem !== 0) ? html`
              <div class="detail-section">
                <div class="ds-label">Axes politiques${e.dominantAxis ? ` — dominant: ${e.dominantAxis}` : ''}</div>
                ${this.renderAxisBar('Eco', e.axisEconomic)}
                ${this.renderAxisBar('Social', e.axisSocietal)}
                ${this.renderAxisBar('Autorite', e.axisAuthority)}
                ${this.renderAxisBar('Systeme', e.axisSystem)}
              </div>
            ` : ''}

            <!-- Media meta -->
            <div class="detail-section">
              <div class="ds-grid">
                <div>
                  <div class="ds-label">Categorie</div>
                  <div class="ds-value">${e.mediaCategory || '—'}</div>
                </div>
                <div>
                  <div class="ds-label">Qualite</div>
                  <div class="ds-value">${e.mediaQuality || '—'}</div>
                </div>
                ${e.tone ? html`
                  <div>
                    <div class="ds-label">Ton</div>
                    <div class="ds-value">${e.tone}</div>
                  </div>
                ` : ''}
                ${e.primaryEmotion ? html`
                  <div>
                    <div class="ds-label">Emotion</div>
                    <div class="ds-value">${e.primaryEmotion}</div>
                  </div>
                ` : ''}
                ${e.narrativeFrame ? html`
                  <div>
                    <div class="ds-label">Narratif</div>
                    <div class="ds-value"><span class="tag tag-narrative">${e.narrativeFrame}</span></div>
                  </div>
                ` : ''}
                ${e.mediaIntent ? html`
                  <div>
                    <div class="ds-label">Intention</div>
                    <div class="ds-value">${e.mediaIntent}</div>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Semantic summary -->
            ${e.semanticSummary ? html`
              <div class="detail-section">
                <div class="ds-label">Resume semantique</div>
                <div class="ds-value">${e.semanticSummary}</div>
              </div>
            ` : ''}

            <!-- Signals -->
            ${(e.activismSignal || e.conflictSignal || e.reviewFlag) ? html`
              <div class="detail-section">
                <div class="ds-label">Signaux</div>
                <div class="detail-signals">
                  ${e.activismSignal ? html`<span class="signal signal-on">Activisme</span>` : ''}
                  ${e.conflictSignal ? html`<span class="signal signal-on">Conflit</span>` : ''}
                  ${e.reviewFlag ? html`<span class="signal signal-on">Review: ${e.reviewReason || 'divergence'}</span>` : ''}
                </div>
              </div>
            ` : ''}
          ` : html`
            <div style="color:var(--text-dim);font-size:13px;padding:16px 0;text-align:center">
              Pas encore enrichi
            </div>
          `}
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="page-header">
        <div class="page-title">Feed</div>
        <button class="refresh-btn" @click=${this.loadPosts}>Refresh</button>
      </div>

      ${this.sessions.length > 0 ? html`
        <select class="session-selector"
          @change=${(e: Event) => { this.selectedSession = (e.target as HTMLSelectElement).value; this.loadPosts(); }}>
          <option value="" ?selected=${this.selectedSession === ''}>Toutes les sessions (${this.sessions.reduce((s, x) => s + x.postCount, 0)} posts)</option>
          ${this.sessions.map(s => {
            const date = new Date(s.capturedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            return html`<option value=${s.id} ?selected=${s.id === this.selectedSession}>${date} — ${s.postCount} posts</option>`;
          })}
        </select>
      ` : ''}

      ${this.loading ? html`<div class="loading">Chargement...</div>` :
        this.error ? html`<div class="error">${this.error}</div>` :
        this.posts.length === 0 ? html`<div class="empty">Aucun post dans cette session</div>` :
        html`
          <div class="post-list">
            ${this.posts.map(p => {
              const e = p.enrichment;
              const topics = e ? safeParse(e.mainTopics).slice(0, 3) : [];
              const polScore = e?.politicalScore ?? 0;
              const polarPct = e ? Math.round(e.polarizationScore * 100) : 0;
              const polarColor = polarPct > 60 ? 'var(--rouge)' : polarPct > 30 ? 'var(--jaune)' : 'var(--vert-menthe)';
              const initial = (p.username || '?')[0].toUpperCase();
              const attColor = attentionColors[p.attentionLevel] || 'var(--text-muted)';

              const acctTopics = this.accountTopics.get(p.username || '') || [];

              return html`
                <div class="post-card" @click=${() => this.openDetail(p)}>
                  <div class="pc-top">
                    <div class="pc-user">
                      <div class="pc-avatar">${initial}</div>
                      <div>
                        <span class="pc-username">@${p.username || '?'}</span>
                        ${acctTopics.length > 0 ? html`
                          <div class="pc-account-topics">
                            ${acctTopics.map(t => html`<span class="account-topic">${t}</span>`)}
                          </div>
                        ` : ''}
                      </div>
                    </div>
                    ${e ? html`
                      <span class="pc-pol-badge" style="background:${polColors[polScore]}">${polLabels[polScore]}</span>
                    ` : ''}
                  </div>

                  ${p.caption ? html`<div class="pc-caption">${p.caption}</div>` : ''}

                  <div class="pc-meta">
                    <span style="color:${attColor}">${p.attentionLevel}</span>
                    <span class="pc-meta-dot"></span>
                    <span>${(p.dwellTimeMs / 1000).toFixed(1)}s</span>
                    <span class="pc-meta-dot"></span>
                    <span>${p.mediaType}</span>
                  </div>

                  <div class="pc-tags">
                    ${topics.map(t => html`<span class="tag tag-topic">${t}</span>`)}
                    ${p.isSponsored ? html`<span class="tag tag-ad">AD</span>` : ''}
                    ${p.isSuggested ? html`<span class="tag tag-sug">SUG</span>` : ''}
                    ${e?.narrativeFrame ? html`<span class="tag tag-narrative">${e.narrativeFrame}</span>` : ''}
                    ${e?.reviewFlag ? html`<span class="tag tag-review">Review</span>` : ''}
                  </div>

                  ${e ? html`
                    <div class="pc-scores">
                      <div class="pc-score-item">
                        Polar
                        <div class="score-bar"><div class="score-bar-fill" style="width:${polarPct}%;background:${polarColor}"></div></div>
                        ${e.polarizationScore.toFixed(2)}
                      </div>
                      <div class="pc-score-item">
                        Conf ${(e.confidenceScore * 100).toFixed(0)}%
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            })}
          </div>
        `
      }

      ${this.renderDetail()}
    `;
  }
}
