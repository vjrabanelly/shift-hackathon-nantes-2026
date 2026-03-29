import { css } from 'lit';

/**
 * Scrollout Design System — aligned with scrollout-site brand identity.
 * 9-color palette, Averia Sans Libre font, dark theme.
 */
export const theme = css`
  @import url('https://fonts.googleapis.com/css2?family=Averia+Sans+Libre:wght@300;400;700&display=swap');

  :host {
    /* Backgrounds */
    --bg: #0a0a0a;
    --surface: #141414;
    --surface2: #1a1a1a;
    --surface3: #222;
    --surface-dark: #111;
    --border: #2a2a2a;
    --border-light: #333;
    --border-soft: #ccc;

    /* Text */
    --text: #f0f0f0;
    --text-dim: #b0b0b0;
    --text-muted: #777;
    --text-soft: #999;
    --text-faint: #555;
    --white: #fff;

    /* Scrollout 9-color palette */
    --jaune: #FFFF66;
    --vert-menthe: #90EE90;
    --bleu-indigo: #5B3FE8;
    --orange: #FF6B00;
    --rose: #DA70D6;
    --violet: #8B22CC;
    --rouge: #FF0000;
    --bleu-ciel: #B0E0FF;
    --vert-eau: #90DDAA;

    /* Semantic aliases */
    --accent: var(--bleu-indigo);
    --green: var(--vert-menthe);
    --yellow: var(--jaune);
    --red: var(--rouge);
    --purple: var(--violet);

    /* Overlays */
    --overlay-light: rgba(255, 255, 255, 0.04);
    --overlay-medium: rgba(255, 255, 255, 0.08);
    --overlay-strong: rgba(255, 255, 255, 0.15);
    --scrim: rgba(0, 0, 0, 0.6);
    --scrim-heavy: rgba(0, 0, 0, 0.85);

    /* Accent glows */
    --glow-accent: rgba(107, 107, 255, 0.08);
    --glow-accent-strong: rgba(107, 107, 255, 0.4);

    /* Radii */
    --radius: 16px;
    --radius-sm: 10px;
    --radius-pill: 999px;

    /* Shadows (dark-adapted) */
    --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.3);
    --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.2);

    /* Fonts */
    --font-heading: 'Averia Sans Libre', sans-serif;
    --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    --font-mono: 'SF Mono', 'Roboto Mono', monospace;

    font-family: var(--font-body);
  }
`;

/* ── JS Palette (for canvas, inline JS, color maps) ──────────── */

export const palette = {
  jaune: '#FFFF66',
  vertMenthe: '#90EE90',
  bleuIndigo: '#5B3FE8',
  orange: '#FF6B00',
  rose: '#DA70D6',
  violet: '#8B22CC',
  rouge: '#FF0000',
  bleuCiel: '#B0E0FF',
  vertEau: '#90DDAA',
  white: '#fff',
  bg: '#0a0a0a',
  surface: '#141414',
  surface2: '#1a1a1a',
  surface3: '#222',
  surfaceDark: '#111',
  border: '#2a2a2a',
  borderLight: '#333',
  text: '#f0f0f0',
  textDim: '#b0b0b0',
  textMuted: '#777',
  textSoft: '#999',
  textFaint: '#555',
} as const;

/** Political score color scale (0–4) */
export const polColors = [palette.textFaint, palette.vertMenthe, palette.jaune, palette.orange, palette.rouge];
export const polLabels = ['Apolitique', 'Social', 'Indirect', 'Explicite', 'Militant'];

/** Attention level colors */
export const attentionColors: Record<string, string> = {
  engaged: palette.vertMenthe,
  viewed: palette.bleuIndigo,
  glanced: palette.jaune,
  skipped: palette.textFaint,
};

/** Domain colors for content diet visualization */
export const domainColors: Record<string, string> = {
  'actualité': palette.orange,
  'politique': palette.rouge,
  'divertissement': palette.rose,
  'lifestyle': palette.vertEau,
  'culture': palette.violet,
  'société': palette.bleuIndigo,
  'sport': palette.jaune,
  'technologie': palette.bleuCiel,
  'business': palette.vertMenthe,
};

/** Scrollout color dots (brand identity) — legacy, kept for loading animations */
export const scrolloutDots = [palette.jaune, palette.vertMenthe, palette.bleuIndigo, palette.orange, palette.rose, palette.violet, palette.rouge, palette.bleuCiel, palette.vertEau];
