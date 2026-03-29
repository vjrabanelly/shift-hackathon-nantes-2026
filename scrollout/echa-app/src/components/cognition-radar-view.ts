import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { theme } from '../styles/theme.js';
import { COGNITIVE_METRICS, type CognitiveMetricKey, type CognitiveThemeAggregate } from '../services/cognitive-bubble.js';

const RADAR_AXES: CognitiveMetricKey[] = [
  'frequency',
  'durationTotalMs',
  'durationAverageMs',
  'engagement',
  'politicalScore',
  'confidence',
];

@customElement('cognition-radar-view')
export class CognitionRadarView extends LitElement {
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

      .card {
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 14px;
      }

      .chart {
        display: grid;
        gap: 14px;
      }

      .svg-wrap {
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
      }

      svg {
        width: 100%;
        height: auto;
        display: block;
      }

      .axis-label {
        font-size: 10px;
        fill: var(--text);
      }

      .axis-value {
        font-size: 9px;
        fill: var(--text-dim);
      }

      .grid {
        fill: none;
        stroke: rgba(255, 255, 255, 0.08);
        stroke-width: 1;
      }

      .radar-outline {
        fill: rgba(56, 151, 240, 0.12);
        stroke: rgba(56, 151, 240, 0.85);
        stroke-width: 2.2;
      }

      .axis-line {
        stroke: rgba(255, 255, 255, 0.10);
        stroke-width: 1;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .metric {
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 10px 12px;
      }

      .metric .label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-dim);
        margin-bottom: 5px;
      }

      .metric .value {
        font-size: 15px;
        font-weight: 800;
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
  @property({ type: String }) subtitle = '';

  private metricLabel(key: CognitiveMetricKey): string {
    return COGNITIVE_METRICS.find(metric => metric.key === key)?.label ?? key;
  }

  private metricUnit(key: CognitiveMetricKey): string {
    return COGNITIVE_METRICS.find(metric => metric.key === key)?.unit ?? '';
  }

  private profileValues(): Record<CognitiveMetricKey, number> {
    if (this.themes.length === 0) {
      return RADAR_AXES.reduce((acc, key) => {
        acc[key] = 0;
        return acc;
      }, {} as Record<CognitiveMetricKey, number>);
    }

    const weightTotal = this.themes.reduce((sum, theme) => sum + Math.max(theme.postCount, 1), 0) || 1;
    return RADAR_AXES.reduce((acc, key) => {
      const weighted = this.themes.reduce((sum, theme) => {
        const value = theme.normalizedMetrics?.[key] ?? 0;
        const weight = Math.max(theme.postCount, 1);
        return sum + (value * weight);
      }, 0);
      acc[key] = weighted / weightTotal;
      return acc;
    }, {} as Record<CognitiveMetricKey, number>);
  }

  private pointFor(value: number, index: number, count: number, radius: number, center: number) {
    const angle = (-Math.PI / 2) + (index * (Math.PI * 2 / count));
    const r = radius * (Math.max(0, Math.min(100, value)) / 100);
    return {
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
      angle,
    };
  }

  render() {
    if (this.themes.length === 0) {
      return html`
        <div class="empty">
          <div>
            <strong>Aucun radar à afficher</strong>
            <div>Chargez une session enrichie pour construire le profil.</div>
          </div>
        </div>
      `;
    }

    const values = this.profileValues();
    const count = RADAR_AXES.length;
    const center = 180;
    const radius = 122;

    const axisPoints = RADAR_AXES.map((key, index) => this.pointFor(100, index, count, radius, center));
    const rings = [20, 40, 60, 80, 100];
    const radarPoints = RADAR_AXES.map((key, index) => this.pointFor(values[key], index, count, radius, center));
    const polygon = radarPoints.map(p => `${p.x},${p.y}`).join(' ');

    return html`
      <div class="frame">
        <div class="legend">
          <div>
            <h3>Radar session</h3>
            <p>${this.subtitle || 'Profil global agrégé de la session sélectionnée, normalisé sur 0-100.'}</p>
          </div>
          <div class="pills">
            <span class="pill">${this.themes.length} thèmes</span>
            <span class="pill">${count} axes</span>
            <span class="pill">profil normalisé</span>
          </div>
        </div>

        <div class="card chart">
          <div class="svg-wrap">
            <svg viewBox="0 0 360 360" role="img" aria-label="Radar de profil cognitif">
              <g>
                ${rings.map(level => {
                  const r = radius * (level / 100);
                  return html`<polygon class="grid" points="${axisPoints.map(p => `${center + Math.cos(p.angle) * r},${center + Math.sin(p.angle) * r}`).join(' ')}"></polygon>`;
                })}
                ${axisPoints.map(p => html`<line class="axis-line" x1=${center} y1=${center} x2=${p.x} y2=${p.y}></line>`)}
                <polygon class="radar-outline" points=${polygon}></polygon>
              </g>

              ${RADAR_AXES.map((key, index) => {
                const p = axisPoints[index];
                const labelR = radius + 18;
                const labelX = center + Math.cos(p.angle) * labelR;
                const labelY = center + Math.sin(p.angle) * labelR;
                const anchor = Math.abs(Math.cos(p.angle)) < 0.2 ? 'middle' : Math.cos(p.angle) > 0 ? 'start' : 'end';
                const value = values[key];
                return html`
                  <text class="axis-label" x=${labelX} y=${labelY - 2} text-anchor=${anchor}>${this.metricLabel(key)}</text>
                  <text class="axis-value" x=${labelX} y=${labelY + 10} text-anchor=${anchor}>${Math.round(value)} ${this.metricUnit(key)}</text>
                `;
              })}
            </svg>
          </div>
        </div>

        <div class="summary-grid">
          ${RADAR_AXES.map(key => html`
            <div class="metric">
              <div class="label">${this.metricLabel(key)}</div>
              <div class="value">${Math.round(values[key])} / 100</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }
}
