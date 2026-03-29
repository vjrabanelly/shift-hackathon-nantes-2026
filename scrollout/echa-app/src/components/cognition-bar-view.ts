import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { theme } from '../styles/theme.js';
import { COGNITIVE_METRICS, type CognitiveMetricKey, type CognitiveThemeAggregate } from '../services/cognitive-bubble.js';

@customElement('cognition-bar-view')
export class CognitionBarView extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: block;
      }

      .frame {
        display: grid;
        gap: 14px;
      }

      .legend {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
      }

      .legend h3 {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.6px;
      }

      .legend p {
        font-size: 11px;
        line-height: 1.4;
        color: var(--text-dim);
      }

      .pills {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .pill {
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: var(--text);
        font-size: 11px;
        font-weight: 700;
      }

      .bars {
        display: grid;
        gap: 10px;
      }

      .bar-card {
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 12px;
      }

      .bar-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
        margin-bottom: 8px;
      }

      .bar-name {
        font-size: 13px;
        font-weight: 800;
      }

      .bar-meta {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
        font-size: 10px;
        color: var(--text-dim);
      }

      .track {
        position: relative;
        height: 14px;
        border-radius: 999px;
        background: var(--bg);
        overflow: hidden;
      }

      .fill {
        height: 100%;
        border-radius: inherit;
        transition: width 180ms ease;
      }

      .secondary-track {
        position: relative;
        height: var(--secondary-height, 6px);
        margin-top: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        overflow: hidden;
      }

      .secondary-fill {
        height: 100%;
        border-radius: inherit;
        background: var(--secondary-fill, rgba(255, 255, 255, 0.92));
        transition: width 180ms ease;
      }

      .secondary-legend {
        margin-top: 6px;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 10px;
        color: var(--text-dim);
      }

      .track-foot {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-top: 8px;
        font-size: 10px;
        color: var(--text-muted);
      }

      .empty {
        display: grid;
        place-items: center;
        min-height: 240px;
        color: var(--text-dim);
        text-align: center;
        padding: 18px;
      }

      .empty strong {
        display: block;
        color: var(--text);
        margin-bottom: 6px;
      }
    `,
  ];

  @property({ type: Array }) themes: CognitiveThemeAggregate[] = [];
  @property({ type: String }) primaryMetric: CognitiveMetricKey = 'durationTotalMs';
  @property({ type: String }) secondaryMetric: CognitiveMetricKey = 'engagement';
  @property({ type: Number }) chromaPower = 65;

  private selectTheme(themeId: string) {
    this.dispatchEvent(new CustomEvent<{ themeId: string }>('theme-selected', {
      detail: { themeId },
      bubbles: true,
      composed: true,
    }));
  }

  private metricLabel(key: CognitiveMetricKey): string {
    return COGNITIVE_METRICS.find(metric => metric.key === key)?.label ?? key;
  }

  private metricUnit(key: CognitiveMetricKey): string {
    return COGNITIVE_METRICS.find(metric => metric.key === key)?.unit ?? '';
  }

  private colorFor(theme: CognitiveThemeAggregate): string {
    const secondary = theme.normalizedMetrics?.[this.secondaryMetric] ?? 0;
    const hue = 205 + (secondary * 0.9);
    const saturation = 18 + (this.chromaPower * 0.7);
    const contrastBoost = this.chromaPower / 100;
    const lightness = 28 + (secondary * (0.06 + contrastBoost * 0.14));
    return `linear-gradient(90deg, hsl(${hue} ${saturation}% ${lightness + 10 + contrastBoost * 8}%), hsl(${hue - 16} ${Math.max(18, saturation - 14)}% ${lightness - contrastBoost * 5}%))`;
  }

  private secondaryTrackStyle(theme: CognitiveThemeAggregate): string {
    const secondary = theme.normalizedMetrics?.[this.secondaryMetric] ?? 0;
    const contrastBoost = this.chromaPower / 100;
    const hue = 205 + (secondary * 0.9);
    const alpha = 0.25 + contrastBoost * 0.75;
    const height = 4 + Math.round(contrastBoost * 8);
    return `--secondary-height:${height}px;--secondary-fill:linear-gradient(90deg, rgba(255,255,255,${0.35 + contrastBoost * 0.45}), hsl(${hue} ${52 + contrastBoost * 34}% ${68 - contrastBoost * 12}% / ${alpha}))`;
  }

  render() {
    const sortedThemes = [...this.themes].sort((a, b) => {
      const aValue = a.normalizedMetrics?.[this.primaryMetric] ?? 0;
      const bValue = b.normalizedMetrics?.[this.primaryMetric] ?? 0;
      return bValue - aValue;
    });

    if (sortedThemes.length === 0) {
      return html`
        <div class="empty">
          <div>
            <strong>Aucune barre à afficher</strong>
            <div>Chargez une session enrichie pour peupler la vue.</div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="frame">
        <div class="legend">
          <div>
            <h3>Barres thématiques</h3>
            <p>La longueur suit ${this.metricLabel(this.primaryMetric)} et la couleur encode ${this.metricLabel(this.secondaryMetric)} avec une puissance chromatique ${this.chromaPower}/100.</p>
          </div>
          <div class="pills">
            <span class="pill">${sortedThemes.length} thèmes</span>
            <span class="pill">longueur: ${this.metricLabel(this.primaryMetric)}</span>
            <span class="pill">couleur: ${this.metricLabel(this.secondaryMetric)}</span>
          </div>
        </div>

        <div class="bars">
          ${sortedThemes.map(theme => {
            const primary = theme.normalizedMetrics?.[this.primaryMetric] ?? 0;
            const secondary = theme.normalizedMetrics?.[this.secondaryMetric] ?? 0;
            return html`
              <article class="bar-card" role="button" tabindex="0" @click=${() => this.selectTheme(theme.themeId)}>
                <div class="bar-head">
                  <div class="bar-name">${theme.themeLabel}</div>
                  <div class="bar-meta">
                    <span>${theme.postCount} posts</span>
                    <span>${Math.round(primary)} / 100</span>
                    <span>${Math.round(secondary)} / 100</span>
                  </div>
                </div>

                <div class="track" aria-label="${theme.themeLabel} ${this.metricLabel(this.primaryMetric)}">
                  <div class="fill" style="width:${Math.round(primary)}%;background:${this.colorFor(theme)}"></div>
                </div>

                <div class="secondary-track" style=${this.secondaryTrackStyle(theme)} aria-label="${theme.themeLabel} ${this.metricLabel(this.secondaryMetric)}">
                  <div class="secondary-fill" style="width:${Math.round(secondary)}%"></div>
                </div>

                <div class="secondary-legend">
                  <span>${this.metricLabel(this.secondaryMetric)}</span>
                  <span>${Math.round(secondary)} / 100</span>
                </div>

                <div class="track-foot">
                  <span>${Math.round(theme.totalDwellTimeMs / 1000)}s cumulés</span>
                  <span>${Math.round(theme.engagementScore)} engagement</span>
                </div>
              </article>
            `;
          })}
        </div>
      </div>
    `;
  }
}
