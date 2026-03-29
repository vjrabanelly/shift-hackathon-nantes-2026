import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { theme } from '../styles/theme.js';
import { COGNITIVE_METRICS, type CognitiveThemeAggregate } from '../services/cognitive-bubble.js';

@customElement('cognition-theme-detail')
export class CognitionThemeDetail extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: block;
      }

      .panel {
        display: grid;
        gap: 12px;
        padding: 14px;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(56, 151, 240, 0.08), rgba(255, 255, 255, 0.02));
        border: 1px solid rgba(56, 151, 240, 0.16);
      }

      .head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: start;
      }

      .title {
        font-size: 15px;
        font-weight: 900;
        line-height: 1.2;
      }

      .subtitle {
        margin-top: 4px;
        color: var(--text-dim);
        font-size: 11px;
        line-height: 1.4;
      }

      .badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 9px;
        border-radius: 999px;
        background: var(--surface2);
        border: 1px solid var(--border);
        font-size: 11px;
        color: var(--text-dim);
      }

      .badge strong {
        color: var(--text);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .metric {
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 10px;
      }

      .metric-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-dim);
      }

      .metric-value {
        margin-top: 6px;
        font-size: 15px;
        font-weight: 900;
      }

      .metric-note {
        margin-top: 4px;
        font-size: 10px;
        color: var(--text-muted);
        line-height: 1.4;
      }

      .section {
        display: grid;
        gap: 8px;
      }

      .section-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--text-dim);
      }

      .list {
        display: grid;
        gap: 6px;
      }

      .list-item {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 9px 10px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        font-size: 11px;
      }

      .list-item strong {
        font-size: 11px;
      }

      .empty {
        display: grid;
        place-items: center;
        min-height: 220px;
        text-align: center;
        color: var(--text-dim);
        padding: 12px;
      }

      .empty strong {
        display: block;
        color: var(--text);
        margin-bottom: 6px;
      }
    `,
  ];

  @property({ type: Object }) themeData: CognitiveThemeAggregate | null = null;

  private metricLabel(key: keyof NonNullable<CognitiveThemeAggregate['normalizedMetrics']>): string {
    return COGNITIVE_METRICS.find(metric => metric.key === key)?.label ?? String(key);
  }

  render() {
    const themeData = this.themeData;

    if (!themeData) {
      return html`
        <div class="empty">
          <div>
            <strong>Aucune thématique sélectionnée</strong>
            <div>Touchez une bulle ou une barre pour afficher son détail.</div>
          </div>
        </div>
      `;
    }

    const metrics = [
      ['frequency', themeData.postCount.toString(), 'Place occupée par cette thématique dans votre fil'],
      ['durationTotalMs', `${Math.round(themeData.totalDwellTimeMs / 1000)}s`, 'Temps total passé sur cette thématique'],
      ['durationAverageMs', `${Math.round(themeData.averageDwellTimeMs / 1000)}s`, 'Temps moyen passé sur chaque post'],
      ['engagement', `${Math.round(themeData.engagementScore)} / 100`, 'Intensité moyenne de votre attention'],
      ['engagedShare', `${Math.round(themeData.engagedShare)}%`, 'Part des posts vraiment regardés'],
      ['politicalScore', themeData.politicalScoreAverage.toFixed(2), 'Degré moyen de contenu politique'],
      ['polarization', themeData.polarizationAverage.toFixed(2), 'Niveau moyen de tension polarisante'],
      ['confidence', themeData.confidenceAverage.toFixed(2), 'Fiabilité moyenne du classement'],
    ] as const;

    return html`
      <div class="panel">
        <div class="head">
          <div>
            <div class="title">${themeData.themeLabel}</div>
            <div class="subtitle">Source: ${themeData.source} · ${themeData.enrichedPostCount} posts enrichis · id ${themeData.themeId}</div>
          </div>
        </div>

        <div class="badge-row">
          <span class="badge"><strong>${themeData.postCount}</strong> posts</span>
          <span class="badge"><strong>${Math.round(themeData.totalDwellTimeMs / 1000)}s</strong> cumulés</span>
          <span class="badge"><strong>${themeData.sampleUsers.length}</strong> comptes</span>
        </div>

        <div class="grid">
          ${metrics.map(([key, value, note]) => html`
            <div class="metric">
              <div class="metric-label">${this.metricLabel(key)}</div>
              <div class="metric-value">${value}</div>
              <div class="metric-note">${note}</div>
            </div>
          `)}
        </div>

        <div class="section">
          <div class="section-title">Comptes contributeurs</div>
          <div class="list">
            ${themeData.sampleUsers.length > 0
              ? themeData.sampleUsers.map(username => html`
                  <div class="list-item">
                    <strong>@${username}</strong>
                    <span>top source</span>
                  </div>
                `)
              : html`<div class="list-item"><strong>Aucun compte</strong><span>non disponible</span></div>`}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Exemples de posts</div>
          <div class="list">
            ${themeData.samplePostIds.length > 0
              ? themeData.samplePostIds.map(postId => html`
                  <div class="list-item">
                    <strong>${postId}</strong>
                    <span>post id</span>
                  </div>
                `)
              : html`<div class="list-item"><strong>Aucun post</strong><span>non disponible</span></div>`}
          </div>
        </div>
      </div>
    `;
  }
}
