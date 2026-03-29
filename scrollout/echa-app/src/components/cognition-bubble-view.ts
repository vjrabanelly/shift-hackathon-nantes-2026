import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { theme } from '../styles/theme.js';
import { COGNITIVE_METRICS, type CognitiveMetricKey, type CognitiveThemeAggregate } from '../services/cognitive-bubble.js';

@customElement('cognition-bubble-view')
export class CognitionBubbleView extends LitElement {
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

      .canvas {
        min-height: 320px;
        padding: 16px;
        border-radius: 18px;
        background:
          radial-gradient(circle at 15% 20%, rgba(56, 151, 240, 0.14), transparent 22%),
          radial-gradient(circle at 78% 30%, rgba(193, 53, 132, 0.15), transparent 24%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.14));
        border: 1px solid rgba(56, 151, 240, 0.16);
        overflow: hidden;
      }

      .bubble-wrap {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 14px;
      }

      .bubble {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 50%;
        color: var(--white);
        text-align: center;
        padding: 12px;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);
        transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        position: relative;
        overflow: hidden;
      }

      .bubble-ring {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
      }

      .bubble:active {
        transform: scale(0.98);
      }

      .bubble:hover {
        box-shadow: 0 14px 38px rgba(0, 0, 0, 0.34);
      }

      .bubble::after {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 30% 22%, rgba(255, 255, 255, 0.24), transparent 28%);
        pointer-events: none;
      }

      .bubble-inner {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 4px;
        place-items: center;
      }

      .bubble-name {
        font-size: 12px;
        font-weight: 800;
        line-height: 1.1;
        max-width: 9ch;
      }

      .bubble-value {
        font-size: 10px;
        opacity: 0.9;
      }

      .bubble-meta {
        font-size: 9px;
        opacity: 0.8;
      }

      .bubble-secondary {
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.2px;
        padding: 3px 6px;
        border-radius: 999px;
        background: rgba(10, 10, 10, 0.26);
        border: 1px solid rgba(255, 255, 255, 0.16);
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
    const saturation = 18 + (this.chromaPower * 0.72);
    const contrastBoost = this.chromaPower / 100;
    const lightness = 24 + (secondary * (0.08 + contrastBoost * 0.18));
    return `linear-gradient(145deg, hsl(${hue} ${saturation}% ${lightness + 12 + contrastBoost * 8}%), hsl(${hue - 18} ${Math.max(18, saturation - 14)}% ${lightness - contrastBoost * 4}%))`;
  }

  private sizeFor(theme: CognitiveThemeAggregate): number {
    const normalized = theme.normalizedMetrics?.[this.primaryMetric] ?? 0;
    return Math.round(74 + (normalized / 100) * 94);
  }

  private ringStyle(theme: CognitiveThemeAggregate): string {
    const secondary = Math.max(0, Math.min(100, theme.normalizedMetrics?.[this.secondaryMetric] ?? 0));
    const contrastBoost = this.chromaPower / 100;
    const sweep = Math.max(14, Math.round((secondary / 100) * 360));
    const inset = Math.round(11 - contrastBoost * 7);
    const ringOpacity = 0.18 + contrastBoost * 0.78;
    const idleOpacity = 0.06 + contrastBoost * 0.2;
    const blur = 4 + contrastBoost * 16;
    return [
      `inset:${inset}px`,
      `opacity:${0.55 + contrastBoost * 0.45}`,
      `background:conic-gradient(rgba(255,255,255,${ringOpacity}) 0deg ${sweep}deg, rgba(255,255,255,${idleOpacity}) ${sweep}deg 360deg)`,
      `box-shadow:0 0 ${blur}px rgba(255,255,255,${0.08 + contrastBoost * 0.32})`,
      `mask:radial-gradient(circle, transparent calc(100% - ${3 + contrastBoost * 5}px), #000 calc(100% - ${2 + contrastBoost * 5}px))`,
      `-webkit-mask:radial-gradient(circle, transparent calc(100% - ${3 + contrastBoost * 5}px), #000 calc(100% - ${2 + contrastBoost * 5}px))`,
    ].join(';');
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
            <strong>Aucune bulle à afficher</strong>
            <div>Chargez une session enrichie pour peupler la vue.</div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="frame">
        <div class="legend">
          <div>
            <h3>Bulles thématiques</h3>
            <p>La taille suit ${this.metricLabel(this.primaryMetric)} et la couleur suit ${this.metricLabel(this.secondaryMetric)} avec une puissance chromatique ${this.chromaPower}/100.</p>
          </div>
          <div class="pills">
            <span class="pill">${sortedThemes.length} thèmes</span>
            <span class="pill">taille: ${this.metricLabel(this.primaryMetric)}</span>
            <span class="pill">couleur: ${this.metricLabel(this.secondaryMetric)}</span>
          </div>
        </div>

        <div class="canvas">
          <div class="bubble-wrap">
            ${sortedThemes.map(theme => {
              const size = this.sizeFor(theme);
              const primary = theme.normalizedMetrics?.[this.primaryMetric] ?? 0;
              const secondary = theme.normalizedMetrics?.[this.secondaryMetric] ?? 0;
              return html`
                <button
                  type="button"
                  class="bubble"
                  style="width:${size}px;height:${size}px;background:${this.colorFor(theme)}"
                  title="${theme.themeLabel}"
                  @click=${() => this.selectTheme(theme.themeId)}
                >
                  <div class="bubble-ring" style=${this.ringStyle(theme)}></div>
                  <div class="bubble-inner">
                    <div class="bubble-name">${theme.themeLabel}</div>
                    <div class="bubble-value">${Math.round(primary)} / 100</div>
                    <div class="bubble-meta">${theme.postCount} posts</div>
                    <div class="bubble-secondary">${this.metricLabel(this.secondaryMetric)} ${Math.round(secondary)} / 100</div>
                  </div>
                </button>
              `;
            })}
          </div>
        </div>
      </div>
    `;
  }
}
