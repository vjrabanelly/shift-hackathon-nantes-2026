import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { theme } from '../styles/theme.js';
import { COGNITIVE_METRICS, type CognitiveMetricKey, type VisualizationMode } from '../services/cognitive-bubble.js';
import type { SessionSummary } from '../services/db-bridge.js';

export interface CognitionControlsChangeDetail {
  sessionId?: string;
  mode?: VisualizationMode;
  primaryMetric?: CognitiveMetricKey;
  secondaryMetric?: CognitiveMetricKey;
  chromaPower?: number;
}

@customElement('cognition-controls')
export class CognitionControls extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: block;
      }

      .panel {
        background: linear-gradient(180deg, rgba(56, 151, 240, 0.10), rgba(255, 255, 255, 0.02));
        border: 1px solid rgba(56, 151, 240, 0.18);
        border-radius: 18px;
        padding: 14px;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
      }

      .head {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 12px;
        margin-bottom: 14px;
      }

      .title {
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.6px;
        text-transform: uppercase;
      }

      .subtitle {
        margin-top: 4px;
        font-size: 11px;
        color: var(--text-dim);
        line-height: 1.45;
      }

      .refresh {
        border: 1px solid var(--border);
        background: var(--surface2);
        color: var(--text);
        border-radius: var(--radius-sm);
        font: inherit;
        font-size: 11px;
        font-weight: 700;
        padding: 8px 10px;
        cursor: pointer;
        flex-shrink: 0;
      }

      .refresh:active {
        opacity: 0.75;
      }

      .grid {
        display: grid;
        gap: 12px;
      }

      .field {
        display: grid;
        gap: 6px;
      }

      .field label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-dim);
      }

      select,
      input[type='range'] {
        width: 100%;
      }

      select {
        appearance: none;
        background: var(--surface2);
        border: 1px solid var(--border);
        color: var(--text);
        padding: 11px 12px;
        border-radius: 12px;
        font: inherit;
        font-size: 13px;
        outline: none;
      }

      select:focus {
        border-color: var(--accent);
      }

      .mode-group {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }

      .mode {
        border: 1px solid var(--border);
        background: var(--surface2);
        color: var(--text-dim);
        border-radius: 12px;
        padding: 10px 8px;
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      .mode.active {
        background: rgba(56, 151, 240, 0.16);
        border-color: rgba(56, 151, 240, 0.5);
        color: var(--text);
      }

      .range-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .range-value {
        width: 40px;
        text-align: right;
        font-size: 12px;
        font-weight: 800;
        color: var(--accent);
      }

      input[type='range'] {
        appearance: none;
        background: transparent;
        height: 28px;
      }

      input[type='range']::-webkit-slider-runnable-track {
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(56, 151, 240, 0.25), rgba(193, 53, 132, 0.35));
      }

      input[type='range']::-webkit-slider-thumb {
        appearance: none;
        margin-top: -6px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--text);
        border: 2px solid var(--accent);
      }

      input[type='range']::-moz-range-track {
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(56, 151, 240, 0.25), rgba(193, 53, 132, 0.35));
      }

      input[type='range']::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--text);
        border: 2px solid var(--accent);
      }

      .session-meta {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 10px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        background: var(--surface2);
        color: var(--text-dim);
        border: 1px solid var(--border);
      }

      .chip strong {
        color: var(--text);
      }

      .hint {
        margin-top: 4px;
        font-size: 10px;
        color: var(--text-muted);
        line-height: 1.4;
      }

      .disabled {
        opacity: 0.6;
        pointer-events: none;
      }
    `,
  ];

  @property({ type: Array }) sessions: SessionSummary[] = [];
  @property({ type: String }) selectedSessionId = '';
  @property({ type: String }) mode: VisualizationMode = 'bubble';
  @property({ type: String }) primaryMetric: CognitiveMetricKey = 'durationTotalMs';
  @property({ type: String }) secondaryMetric: CognitiveMetricKey = 'engagement';
  @property({ type: Number }) chromaPower = 65;
  @property({ type: Boolean }) loading = false;

  private emitChange(detail: CognitionControlsChangeDetail) {
    this.dispatchEvent(new CustomEvent<CognitionControlsChangeDetail>('cognition-change', {
      detail,
      bubbles: true,
      composed: true,
    }));
  }

  private onSessionChange(event: Event) {
    this.emitChange({ sessionId: (event.target as HTMLSelectElement).value });
  }

  private onModeChange(mode: VisualizationMode) {
    this.emitChange({ mode });
  }

  private onPrimaryChange(event: Event) {
    this.emitChange({ primaryMetric: (event.target as HTMLSelectElement).value as CognitiveMetricKey });
  }

  private onSecondaryChange(event: Event) {
    this.emitChange({ secondaryMetric: (event.target as HTMLSelectElement).value as CognitiveMetricKey });
  }

  private onChromaChange(event: Event) {
    this.emitChange({ chromaPower: Number((event.target as HTMLInputElement).value) });
  }

  private refresh() {
    this.dispatchEvent(new CustomEvent('cognition-refresh', {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const primaryDefinition = COGNITIVE_METRICS.find(metric => metric.key === this.primaryMetric);
    const secondaryDefinition = COGNITIVE_METRICS.find(metric => metric.key === this.secondaryMetric);

    return html`
      <section class="panel ${this.loading ? 'disabled' : ''}">
        <div class="head">
          <div>
            <div class="title">Bulle cognitive</div>
            <div class="subtitle">
              Choisissez le mode et 2 dimensions issues de SQLite: champs posts, champs post_enriched ou agrégations directes calculées dessus.
            </div>
          </div>
          <button class="refresh" @click=${this.refresh} ?disabled=${this.loading}>
            ${this.loading ? 'Chargement...' : 'Rafraîchir'}
          </button>
        </div>

        <div class="grid">
          <div class="field">
            <label>Mode</label>
            <div class="mode-group">
              ${(['bubble', 'bar', 'radar'] as VisualizationMode[]).map(mode => html`
                <button class="mode ${this.mode === mode ? 'active' : ''}" @click=${() => this.onModeChange(mode)}>
                  ${mode === 'bubble' ? 'Bulles' : mode === 'bar' ? 'Barres' : 'Radar'}
                </button>
              `)}
            </div>
          </div>

          <div class="field">
            <label for="primary">Dimension primaire</label>
            <select id="primary" .value=${this.primaryMetric} @change=${this.onPrimaryChange}>
              ${COGNITIVE_METRICS.map(metric => html`
                <option value=${metric.key}>${metric.label}</option>
              `)}
            </select>
            <div class="hint">${primaryDefinition?.description ?? ''}</div>
          </div>

          <div class="field">
            <label for="secondary">Dimension secondaire</label>
            <select id="secondary" .value=${this.secondaryMetric} @change=${this.onSecondaryChange}>
              ${COGNITIVE_METRICS.map(metric => html`
                <option value=${metric.key}>${metric.label}</option>
              `)}
            </select>
            <div class="hint">${secondaryDefinition?.description ?? ''}</div>
          </div>

          <div class="field">
            <label for="chroma">Puissance chromatique</label>
            <div class="range-row">
              <input
                id="chroma"
                type="range"
                min="0"
                max="100"
                step="1"
                .value=${String(this.chromaPower)}
                @input=${this.onChromaChange}
              />
              <div class="range-value">${this.chromaPower}</div>
            </div>
            <div class="hint">Contraste perceptuel de la couche secondaire, de discret à affirmé.</div>
          </div>
        </div>

        <div class="session-meta">
          <span class="chip"><strong>${this.mode}</strong></span>
          <span class="chip"><strong>${this.primaryMetric}</strong></span>
          <span class="chip"><strong>${this.secondaryMetric}</strong></span>
          <span class="chip"><strong>${this.chromaPower}</strong>/100</span>
        </div>
      </section>
    `;
  }
}
