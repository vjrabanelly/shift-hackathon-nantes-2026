import { LitElement, html, css, nothing } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { customElement, state, query } from 'lit/decorators.js';
import { theme, palette, scrolloutDots, domainColors } from '../styles/theme.js';
import { getGraphStats, backfillGraph, type GraphStats } from '../services/graph-ingest-mobile.js';
import { getStats, type DbStats } from '../services/db-bridge.js';

const ico = (path: string, size = 18, color = 'currentColor') => html`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;">${unsafeSVG(path)}</svg>`;

// ── Entity type config ────────────────────────────────────────

const TYPE_CFG: Record<string, { color: string; label: string }> = {
  Theme:          { color: palette.bleuIndigo, label: 'Thème' },
  Subject:        { color: palette.bleuCiel, label: 'Sujet' },
  PreciseSubject: { color: palette.violet, label: 'S. précis' },
  Person:         { color: palette.orange, label: 'Personne' },
  Organization:   { color: palette.rose, label: 'Org.' },
  Institution:    { color: palette.jaune, label: 'Institution' },
  Country:        { color: palette.vertEau, label: 'Pays' },
  Media:          { color: palette.orange, label: 'Média' },
  Domain:         { color: palette.vertMenthe, label: 'Domaine' },
  Narrative:      { color: palette.rouge, label: 'Narratif' },
  Emotion:        { color: palette.vertMenthe, label: 'Émotion' },
  Audience:       { color: palette.textDim, label: 'Audience' },
};

// ── Diversity index (Shannon entropy normalized 0-1) ──────────

export function computeDiversityIndex(items: Array<{ count: number }>): number {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0 || items.length <= 1) return 0;
  const entropy = items.reduce((h, i) => {
    const p = i.count / total;
    return p > 0 ? h - p * Math.log(p) : h;
  }, 0);
  return entropy / Math.log(items.length);
}

function diversityLabel(idx: number): { text: string; color: string } {
  if (idx >= 0.8) return { text: 'Très diversifié', color: palette.vertMenthe };
  if (idx >= 0.6) return { text: 'Diversifié', color: palette.bleuCiel };
  if (idx >= 0.4) return { text: 'Concentré', color: palette.jaune };
  if (idx >= 0.2) return { text: 'Peu diversifié', color: palette.orange };
  return { text: 'Bulle informationnelle', color: palette.rouge };
}

// ── Force-directed graph ──────────────────────────────────────

interface GNode {
  id: string; name: string; type: string; mentions: number;
  x: number; y: number; vx: number; vy: number; radius: number;
}
interface GEdge { source: string; target: string; relation: string; weight: number; }

function simulate(nodes: GNode[], edges: GEdge[], width: number, height: number) {
  const cx = width / 2, cy = height / 2;
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 * 2.5;
    const r = 30 + (i / nodes.length) * Math.min(width, height) * 0.35;
    n.x = cx + Math.cos(angle) * r;
    n.y = cy + Math.sin(angle) * r;
    n.vx = 0; n.vy = 0;
  });

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  for (let iter = 0; iter < 200; iter++) {
    const alpha = 1 - iter / 200;
    const repulsion = 2500 * alpha;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = a.radius + b.radius + 12;
        const effectiveDist = Math.max(dist, minDist * 0.5);
        const force = repulsion / (effectiveDist * effectiveDist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
        if (dist < minDist) {
          const push = (minDist - dist) * 0.3;
          a.vx -= (dx / dist) * push; a.vy -= (dy / dist) * push;
          b.vx += (dx / dist) * push; b.vy += (dy / dist) * push;
        }
      }
    }
    for (const edge of edges) {
      const a = nodeMap.get(edge.source), b = nodeMap.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealDist = 70 + a.radius + b.radius;
      const force = (dist - idealDist) * 0.008 * alpha * Math.min(edge.weight, 3);
      a.vx += (dx / dist) * force; a.vy += (dy / dist) * force;
      b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force;
    }
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.008 * alpha;
      n.vy += (cy - n.y) * 0.008 * alpha;
      n.vx *= 0.8; n.vy *= 0.8;
      n.x += n.vx; n.y += n.vy;
      const pad = n.radius + 6;
      n.x = Math.max(pad, Math.min(width - pad, n.x));
      n.y = Math.max(pad, Math.min(height - pad, n.y));
    }
  }
}

function drawGraph(
  ctx: CanvasRenderingContext2D, nodes: GNode[], edges: GEdge[],
  width: number, height: number, selectedId: string | null,
) {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, width * dpr, height * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const connectedToSelected = new Set<string>();
  if (selectedId) {
    for (const e of edges) {
      if (e.source === selectedId) connectedToSelected.add(e.target);
      if (e.target === selectedId) connectedToSelected.add(e.source);
    }
  }
  const sortedByMentions = [...nodes].sort((a, b) => b.mentions - a.mentions);
  const topLabelIds = new Set(sortedByMentions.slice(0, 10).map(n => n.id));

  for (const edge of edges) {
    const a = nodeMap.get(edge.source), b = nodeMap.get(edge.target);
    if (!a || !b) continue;
    const isSelected = selectedId && (a.id === selectedId || b.id === selectedId);
    const dimmed = selectedId && !isSelected;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    if (isSelected) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    } else if (dimmed) {
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 0.5; ctx.setLineDash([]);
    } else if (edge.relation === 'coOccurrence') {
      const w = Math.min(edge.weight, 10);
      ctx.strokeStyle = `rgba(107,107,255,${0.06 + w * 0.015})`; ctx.lineWidth = 0.5 + w * 0.1; ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 0.8; ctx.setLineDash([4, 4]);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }

  const sortedForDraw = [...nodes].sort((a, b) => a.radius - b.radius);
  for (const n of sortedForDraw) {
    const cfg = TYPE_CFG[n.type] || { color: palette.textFaint };
    const isSelected = n.id === selectedId;
    const connected = selectedId ? connectedToSelected.has(n.id) : false;
    const dimmed = selectedId && !isSelected && !connected;
    if (isSelected) {
      const grad = ctx.createRadialGradient(n.x, n.y, n.radius, n.x, n.y, n.radius + 12);
      grad.addColorStop(0, cfg.color + '40'); grad.addColorStop(1, cfg.color + '00');
      ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 12, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    if (dimmed) {
      ctx.fillStyle = cfg.color + '18'; ctx.strokeStyle = 'transparent';
    } else {
      const grad = ctx.createRadialGradient(n.x - n.radius * 0.3, n.y - n.radius * 0.3, 0, n.x, n.y, n.radius);
      grad.addColorStop(0, cfg.color + 'DD'); grad.addColorStop(1, cfg.color + '99');
      ctx.fillStyle = grad; ctx.strokeStyle = cfg.color;
    }
    ctx.fill(); ctx.lineWidth = isSelected ? 2 : 0.5; ctx.stroke();
    const showLabel = isSelected || connected || (!selectedId && topLabelIds.has(n.id));
    if (showLabel) {
      const fontSize = isSelected ? 11 : connected ? 10 : 9;
      ctx.font = `${isSelected ? '700' : '500'} ${fontSize}px Averia Sans Libre, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const label = n.name.length > 16 ? n.name.slice(0, 14) + '..' : n.name;
      const labelY = n.y + n.radius + 4;
      ctx.fillStyle = 'rgba(10,10,10,0.7)'; ctx.fillText(label, n.x + 1, labelY + 1);
      ctx.fillStyle = dimmed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)';
      ctx.fillText(label, n.x, labelY);
    }
  }
  ctx.restore();
}

// ── Domain icon paths ─────────────────────────────────────────

const DOMAIN_ICONS: Record<string, string> = {
  'politique':       '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/>',
  'actualité':       '<path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="10" y1="6" x2="16" y2="6"/><line x1="10" y1="10" x2="16" y2="10"/>',
  'divertissement':  '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  'lifestyle':       '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/>',
  'culture':         '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  'sport':           '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20"/><path d="M2 12h20"/>',
  'technologie':     '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  'économie':        '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  'écologie':        '<path d="M2 22c1-6 4-12 14-14M22 2S18 6 16 10"/>',
  'religion':        '<path d="M12 2v20M2 12h20M12 2l-4 4h8z"/>',
  'société':         '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
};

// ── Component ─────────────────────────────────────────────────

@customElement('screen-knowledge')
export class ScreenKnowledge extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 16px; padding-bottom: 40px; }

      /* Header */
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
      .title { font-family: var(--font-heading); font-size: 22px; font-weight: 700; }
      .subtitle { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
      .refresh { background: var(--surface3); border: 1px solid var(--border); color: var(--text-dim); padding: 6px 14px; border-radius: var(--radius-pill); font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; cursor: pointer; }
      .refresh:active { opacity: 0.7; }

      /* Diversity hero */
      .diversity { background: var(--surface2); border-radius: var(--radius); padding: 16px; margin-bottom: 14px; display: flex; align-items: center; gap: 16px; }
      .div-ring { width: 64px; height: 64px; flex-shrink: 0; position: relative; }
      .div-ring svg { width: 100%; height: 100%; }
      .div-ring .div-val { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--font-heading); font-size: 18px; font-weight: 900; }
      .div-info { flex: 1; min-width: 0; }
      .div-label { font-family: var(--font-heading); font-size: 14px; font-weight: 700; }
      .div-desc { font-size: 11px; color: var(--text-muted); margin-top: 2px; line-height: 1.4; }
      .div-meta { display: flex; gap: 12px; margin-top: 8px; font-family: var(--font-mono); font-size: 9px; color: var(--text-dim); text-transform: uppercase; }

      /* Thematic map (treemap-style) */
      .thematic { margin-bottom: 14px; }
      .section-title { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-dim); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
      .treemap { display: flex; flex-wrap: wrap; gap: 4px; }
      .tree-block { border-radius: var(--radius-sm); padding: 10px; display: flex; flex-direction: column; gap: 4px; min-height: 60px; cursor: default; transition: opacity 0.15s; position: relative; overflow: hidden; }
      .tree-block::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent); pointer-events: none; }
      .tree-block:active { opacity: 0.85; }
      .tree-domain { font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: rgba(0,0,0,0.85); display: flex; align-items: center; gap: 5px; position: relative; }
      .tree-count { font-family: var(--font-mono); font-size: 9px; color: rgba(0,0,0,0.5); position: relative; }
      .tree-topics { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; position: relative; }
      .tree-pill { font-size: 8px; padding: 2px 6px; border-radius: var(--radius-pill); background: rgba(0,0,0,0.15); color: rgba(0,0,0,0.7); font-family: var(--font-mono); white-space: nowrap; }

      /* Actors section */
      .actors { background: var(--surface2); border-radius: var(--radius); padding: 14px; margin-bottom: 14px; }
      .actor-group { margin-bottom: 10px; }
      .actor-group:last-child { margin-bottom: 0; }
      .actor-type { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; display: flex; align-items: center; gap: 5px; }
      .actor-list { display: flex; flex-wrap: wrap; gap: 5px; }
      .actor-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; padding: 5px 10px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.04); border: 1px solid var(--border); cursor: default; }
      .actor-pill .count { font-family: var(--font-mono); font-size: 8px; color: var(--text-muted); }

      /* Narrative section */
      .narratives { background: var(--surface2); border-radius: var(--radius); padding: 14px; margin-bottom: 14px; }
      .nar-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
      .nar-label { font-size: 11px; width: 90px; flex-shrink: 0; text-transform: capitalize; }
      .nar-bar-wrap { flex: 1; height: 18px; background: rgba(255,255,255,0.04); border-radius: 6px; overflow: hidden; position: relative; }
      .nar-bar { height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px; font-family: var(--font-mono); font-size: 8px; color: rgba(0,0,0,0.7); min-width: 24px; }
      .nar-sub { display: flex; gap: 8px; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); }
      .nar-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; padding: 4px 8px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.04); }
      .nar-chip .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

      /* Graph section (collapsible) */
      .graph-section { margin-bottom: 14px; }
      .graph-toggle { display: flex; align-items: center; justify-content: space-between; background: var(--surface2); border-radius: var(--radius); padding: 12px 14px; cursor: pointer; border: 1px solid var(--border); }
      .graph-toggle:active { opacity: 0.85; }
      .graph-toggle-left { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 500; }
      .graph-toggle-meta { font-family: var(--font-mono); font-size: 9px; color: var(--text-muted); }
      .graph-arrow { transition: transform 0.25s; font-size: 14px; color: var(--text-muted); }
      .graph-arrow.open { transform: rotate(180deg); }

      .graph-wrap { background: var(--surface2); border-radius: 0 0 var(--radius) var(--radius); overflow: hidden; margin-top: -1px; border: 1px solid var(--border); border-top: none; }
      canvas { display: block; width: 100%; touch-action: none; }
      .graph-legend { display: flex; flex-wrap: wrap; gap: 10px; padding: 8px 12px; border-top: 1px solid var(--border); }
      .legend-item { display: flex; align-items: center; gap: 4px; font-size: 9px; color: var(--text-dim); }
      .legend-dot { width: 7px; height: 7px; border-radius: 50%; }

      /* Detail card */
      .detail { background: linear-gradient(135deg, var(--surface2), var(--surface3)); border-radius: var(--radius); padding: 14px; margin-bottom: 14px; border: 1px solid var(--border); }
      .detail-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
      .detail-badge { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; font-family: var(--font-heading); }
      .detail-name { font-family: var(--font-heading); font-size: 16px; font-weight: 700; }
      .detail-type { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
      .detail-stat { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); margin-top: 2px; }
      .detail-connections { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .conn-tag { font-size: 10px; padding: 4px 10px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.04); border: 1px solid var(--border); display: inline-flex; align-items: center; gap: 4px; }
      .conn-rel { font-family: var(--font-mono); font-size: 7px; color: var(--text-muted); text-transform: uppercase; }

      /* Co-occurrences */
      .section { background: var(--surface2); border-radius: var(--radius); padding: 14px; margin-bottom: 14px; }
      .slabel { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-dim); margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 6px; }
      .cooc-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
      .cooc-row:last-child { border-bottom: none; }
      .cooc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
      .cooc-e { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 34%; font-weight: 500; }
      .cooc-cnt { font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); background: var(--surface3); padding: 2px 8px; border-radius: var(--radius-pill); margin-left: auto; flex-shrink: 0; }

      /* Timeline */
      .tl-row { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border); }
      .tl-row:last-child { border-bottom: none; }
      .tl-week { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); width: 70px; flex-shrink: 0; padding-top: 3px; }
      .tl-bars { flex: 1; display: flex; gap: 4px; flex-wrap: wrap; }
      .tl-chip { height: 22px; border-radius: 6px; display: flex; align-items: center; padding: 0 8px; font-size: 9px; font-family: var(--font-mono); font-weight: 500; color: rgba(0,0,0,0.8); white-space: nowrap; overflow: hidden; }

      /* Empty/Loading */
      .empty, .loading { text-align: center; padding: 40px 20px; color: var(--text-dim); }
      .empty h3 { font-family: var(--font-heading); font-size: 16px; color: var(--text); margin: 12px 0 4px; }
      .empty p { font-size: 12px; margin: 0; }
      .loading .dots { display: flex; justify-content: center; gap: 6px; margin-bottom: 12px; }
      .loading .dots span { width: 8px; height: 8px; border-radius: 50%; animation: pulse 1.5s ease-in-out infinite; }
      .loading .dots span:nth-child(2) { animation-delay: .15s; }
      .loading .dots span:nth-child(3) { animation-delay: .3s; }
      @keyframes pulse { 0%,100% { opacity:.3; transform:scale(.8); } 50% { opacity:1; transform:scale(1.2); } }
    `,
  ];

  @state() private graphStats: GraphStats | null = null;
  @state() private dbStats: DbStats | null = null;
  @state() private loading = true;
  @state() private selectedNode: GNode | null = null;
  @state() private graphExpanded = false;
  @query('canvas') private canvas!: HTMLCanvasElement;

  private graphNodes: GNode[] = [];
  private graphEdges: GEdge[] = [];

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  private async loadData() {
    this.loading = true;
    const [, gs, ds] = await Promise.all([
      backfillGraph(),
      getGraphStats(),
      getStats(),
    ]);
    this.graphStats = gs;
    this.dbStats = ds;
    this.loading = false;
    if (gs?.graphNodes?.length) this.buildGraph();
  }

  private buildGraph() {
    const s = this.graphStats!;
    const maxMentions = Math.max(...(s.graphNodes || []).map(n => n.mentions), 1);
    this.graphNodes = (s.graphNodes || []).map(n => ({
      ...n,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 5 + Math.log2(1 + n.mentions) / Math.log2(1 + maxMentions) * 16,
    }));
    this.graphEdges = s.graphEdges || [];
    if (this.graphExpanded) this.updateComplete.then(() => this.renderGraph());
  }

  private renderGraph() {
    const canvas = this.canvas;
    if (!canvas) return;
    const w = canvas.parentElement!.getBoundingClientRect().width;
    const h = 340;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.height = h + 'px';
    simulate(this.graphNodes, this.graphEdges, w, h);
    drawGraph(canvas.getContext('2d')!, this.graphNodes, this.graphEdges, w, h, this.selectedNode?.id || null);
  }

  private onCanvasTap(e: MouseEvent | TouchEvent) {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.changedTouches[0].clientY : e.clientY;
    const x = cx - rect.left, y = cy - rect.top;
    let closest: GNode | null = null;
    let minDist = Infinity;
    for (const n of this.graphNodes) {
      const d = Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2);
      if (d < n.radius + 14 && d < minDist) { closest = n; minDist = d; }
    }
    this.selectedNode = closest?.id === this.selectedNode?.id ? null : closest;
    drawGraph(canvas.getContext('2d')!, this.graphNodes, this.graphEdges,
      rect.width, 340, this.selectedNode?.id || null);
  }

  private toggleGraph() {
    this.graphExpanded = !this.graphExpanded;
    if (this.graphExpanded && this.graphNodes.length) {
      this.updateComplete.then(() => this.renderGraph());
    }
  }

  // ── Render ─────────────────────────────────────────────────

  render() {
    if (this.loading) return html`
      <div class="header"><div><div class="title">Univers</div></div></div>
      <div class="loading">
        <div class="dots">${scrolloutDots.slice(0, 3).map(c => html`<span style="background:${c}"></span>`)}</div>
        <div style="font-size:12px">Analyse de ton univers...</div>
      </div>
    `;

    const gs = this.graphStats;
    const ds = this.dbStats;
    const hasData = (gs && gs.totalEntities > 0) || (ds && ds.totalEnriched > 0);

    if (!hasData) return html`
      <div class="header"><div><div class="title">Univers</div></div></div>
      <div class="empty">
        ${ico('<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="10" stroke-dasharray="3 3"/>', 40, 'var(--text-muted)')}
        <h3>Univers vide</h3>
        <p>Parcourez Instagram pour que votre univers se construise.</p>
      </div>
    `;

    return html`
      <div class="header">
        <div>
          <div class="title">Univers</div>
          <div class="subtitle">${ds?.totalEnriched || 0} posts analyses &middot; ${gs?.totalEntities || 0} entites</div>
        </div>
        <button class="refresh" @click=${() => this.loadData()}>Refresh</button>
      </div>

      ${this._diversity(ds)}
      ${this._thematicMap(ds)}
      ${this._actors(gs)}
      ${this._narratives(ds)}
      ${this._graphSection(gs)}
      ${this.selectedNode ? this._detail() : nothing}
      ${this._coOccurrences(gs)}
      ${this._timeline(gs)}
    `;
  }

  // ── Diversity index ────────────────────────────────────────

  private _diversity(ds: DbStats | null) {
    const domains = ds?.topDomainsReal?.length ? ds.topDomainsReal : ds?.topDomains || [];
    if (!domains.length) return nothing;

    const items = domains.map(d => ({ count: ('count' in d) ? d.count : 0 }));
    const idx = computeDiversityIndex(items);
    const { text, color } = diversityLabel(idx);
    const pct = Math.round(idx * 100);
    const totalPosts = ds?.totalEnriched || 0;
    const topicCount = ds?.topTopics?.length || 0;

    // SVG ring
    const r = 26, circ = 2 * Math.PI * r;
    const offset = circ * (1 - idx);

    return html`
      <div class="diversity">
        <div class="div-ring">
          <svg viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--surface3)" stroke-width="5"/>
            <circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="5"
              stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
              stroke-linecap="round" transform="rotate(-90 32 32)"/>
          </svg>
          <div class="div-val" style="color:${color}">${pct}</div>
        </div>
        <div class="div-info">
          <div class="div-label" style="color:${color}">${text}</div>
          <div class="div-desc">Mesure la variete des domaines dans votre feed. Un score eleve signifie une exposition equilibree.</div>
          <div class="div-meta">
            <span>${domains.length} domaines</span>
            <span>${topicCount} themes</span>
            <span>${totalPosts} posts</span>
          </div>
        </div>
      </div>
    `;
  }

  // ── Thematic map ───────────────────────────────────────────

  private _thematicMap(ds: DbStats | null) {
    const domains = ds?.topDomainsReal?.length ? ds.topDomainsReal : ds?.topDomains || [];
    if (!domains.length) return nothing;

    const total = domains.reduce((s, d) => s + d.count, 0);
    if (total === 0) return nothing;

    // Build domain → topics mapping from topTopics
    const topicsByDomain = new Map<string, Array<{ topic: string; count: number }>>();
    // Simple heuristic: map topics to their most likely domain based on the topics list
    const topics = ds?.topTopics || [];
    const dwellByTopic = ds?.dwellByTopic || [];

    // Get topics with dwell data for richer display
    const topicDwell = new Map(dwellByTopic.map(t => [t.topic, t]));

    return html`
      <div class="thematic">
        <div class="section-title">
          ${ico('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>', 14, 'var(--text-dim)')}
          Carte thematique
        </div>
        <div class="treemap">
          ${domains.slice(0, 8).map(d => {
            const pct = (d.count / total) * 100;
            const width = Math.max(pct, 20);
            const domainKey = d.domain.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const color = (domainColors as Record<string, string>)[d.domain]
              || (domainColors as Record<string, string>)[domainKey]
              || palette.bleuIndigo;
            const iconPath = DOMAIN_ICONS[domainKey] || DOMAIN_ICONS['société'];
            // Find related topics for this domain
            const relatedTopics = topics
              .filter(t => this._topicMatchesDomain(t.topic, d.domain))
              .slice(0, 3);

            return html`
              <div class="tree-block" style="flex-basis:calc(${width}% - 4px);flex-grow:1;background:${color};">
                <div class="tree-domain">
                  ${ico(iconPath, 13, 'rgba(0,0,0,0.6)')}
                  ${this._formatDomain(d.domain)}
                </div>
                <div class="tree-count">${d.count} posts &middot; ${Math.round(pct)}%</div>
                ${relatedTopics.length ? html`
                  <div class="tree-topics">
                    ${relatedTopics.map(t => {
                      const dwell = topicDwell.get(t.topic);
                      const extra = dwell ? ` · ${Math.round(dwell.avgDwellMs / 1000)}s` : '';
                      return html`<span class="tree-pill">${this._formatTopic(t.topic)}${extra}</span>`;
                    })}
                  </div>
                ` : nothing}
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private _topicMatchesDomain(topic: string, domain: string): boolean {
    const d = domain.toLowerCase();
    const t = topic.toLowerCase();
    const mapping: Record<string, string[]> = {
      'politique': ['politique', 'geopolitique', 'immigration', 'securite', 'justice', 'feminisme', 'masculinite'],
      'actualité': ['actualite', 'actualité'],
      'divertissement': ['divertissement', 'humour', 'gaming', 'jeux'],
      'lifestyle': ['lifestyle', 'beaute', 'beauté', 'food', 'voyage', 'maison', 'developpement_personnel', 'mode'],
      'culture': ['culture', 'musique', 'cinema', 'art', 'litterature'],
      'sport': ['sport', 'football', 'fitness'],
      'technologie': ['technologie', 'tech', 'ia', 'crypto'],
      'économie': ['economie', 'économie', 'business', 'finance'],
      'écologie': ['ecologie', 'écologie', 'environnement', 'climat'],
      'société': ['societe', 'société', 'education', 'sante', 'santé', 'religion', 'identite'],
    };
    const keywords = mapping[d] || mapping[d.normalize('NFD').replace(/[\u0300-\u036f]/g, '')] || [];
    const tNorm = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return keywords.some(k => tNorm.includes(k));
  }

  private _formatDomain(d: string): string {
    return d.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  private _formatTopic(t: string): string {
    return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Key actors ─────────────────────────────────────────────

  private _actors(gs: GraphStats | null) {
    if (!gs?.entityGroups?.length) return nothing;

    // Show Person, Organization, Media, Institution groups
    const relevantTypes = ['Person', 'Organization', 'Media', 'Institution', 'Country'];
    const groups = gs.entityGroups
      .filter(g => relevantTypes.includes(g.type) && g.members.length > 0)
      .sort((a, b) => {
        const aTotal = a.members.reduce((s, m) => s + m.mentions, 0);
        const bTotal = b.members.reduce((s, m) => s + m.mentions, 0);
        return bTotal - aTotal;
      });

    if (!groups.length) return nothing;

    return html`
      <div class="actors">
        <div class="section-title">
          ${ico('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>', 14, 'var(--text-dim)')}
          Acteurs cles
        </div>
        ${groups.map(g => {
          const cfg = TYPE_CFG[g.type] || { color: palette.textFaint, label: g.type };
          return html`
            <div class="actor-group">
              <div class="actor-type" style="color:${cfg.color}">${cfg.label}s</div>
              <div class="actor-list">
                ${g.members.slice(0, 8).map(m => html`
                  <span class="actor-pill" style="border-color:${cfg.color}30">
                    <span style="color:${cfg.color}">${m.name}</span>
                    <span class="count">${m.mentions}x</span>
                  </span>
                `)}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  // ── Narratives & emotions ──────────────────────────────────

  private _narratives(ds: DbStats | null) {
    const narratives = ds?.topNarratives || [];
    const tones = ds?.topTones || [];
    const emotions = ds?.topEmotions || [];
    if (!narratives.length && !tones.length && !emotions.length) return nothing;

    const maxNar = narratives[0]?.count || 1;
    const narColors = [palette.rouge, palette.orange, palette.jaune, palette.bleuCiel, palette.vertMenthe];

    return html`
      <div class="narratives">
        <div class="section-title">
          ${ico('<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>', 14, 'var(--text-dim)')}
          Recits & tonalite
        </div>

        ${narratives.length ? html`
          ${narratives.slice(0, 5).map((n, i) => {
            const pct = (n.count / maxNar) * 100;
            const color = narColors[i % narColors.length];
            return html`
              <div class="nar-row">
                <div class="nar-label">${n.narrative}</div>
                <div class="nar-bar-wrap">
                  <div class="nar-bar" style="width:${Math.max(pct, 12)}%;background:${color}">${n.count}</div>
                </div>
              </div>
            `;
          })}
        ` : nothing}

        ${(tones.length || emotions.length) ? html`
          <div class="nar-sub">
            ${tones.slice(0, 3).map(t => html`
              <span class="nar-chip">
                <span class="dot" style="background:${palette.bleuIndigo}"></span>
                ${t.tone} <span style="color:var(--text-muted);font-family:var(--font-mono);font-size:8px">${t.count}</span>
              </span>
            `)}
            ${emotions.filter(e => e.emotion !== 'neutre').slice(0, 3).map(e => html`
              <span class="nar-chip">
                <span class="dot" style="background:${palette.rose}"></span>
                ${e.emotion} <span style="color:var(--text-muted);font-family:var(--font-mono);font-size:8px">${e.count}</span>
              </span>
            `)}
          </div>
        ` : nothing}
      </div>
    `;
  }

  // ── Graph (collapsible) ────────────────────────────────────

  private _graphSection(gs: GraphStats | null) {
    if (!this.graphNodes.length) return nothing;

    return html`
      <div class="graph-section">
        <div class="graph-toggle" @click=${() => this.toggleGraph()}>
          <div class="graph-toggle-left">
            ${ico('<circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="12" y1="8" x2="5" y2="16"/><line x1="12" y1="8" x2="19" y2="16"/>', 16, 'var(--bleu-indigo)')}
            Graphe de connaissances
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="graph-toggle-meta">${this.graphNodes.length} noeuds &middot; ${this.graphEdges.length} liens</span>
            <span class="graph-arrow ${this.graphExpanded ? 'open' : ''}">&#9660;</span>
          </div>
        </div>

        ${this.graphExpanded ? html`
          <div class="graph-wrap">
            <canvas @click=${(e: MouseEvent) => this.onCanvasTap(e)} @touchend=${(e: TouchEvent) => this.onCanvasTap(e)}></canvas>
            <div class="graph-legend">
              ${[...new Set(this.graphNodes.map(n => n.type))].filter(t => t !== 'Audience').map(t => {
                const cfg = TYPE_CFG[t] || { color: palette.textFaint, label: t };
                return html`<span class="legend-item"><span class="legend-dot" style="background:${cfg.color}"></span>${cfg.label}</span>`;
              })}
            </div>
          </div>
        ` : nothing}
      </div>
    `;
  }

  // ── Node detail ────────────────────────────────────────────

  private _detail() {
    const n = this.selectedNode!;
    const cfg = TYPE_CFG[n.type] || { color: palette.textFaint, label: n.type };
    const connections = this.graphEdges
      .filter(e => e.source === n.id || e.target === n.id)
      .map(e => {
        const otherId = e.source === n.id ? e.target : e.source;
        const other = this.graphNodes.find(gn => gn.id === otherId);
        return other ? { name: other.name, type: other.type, relation: e.relation } : null;
      })
      .filter(Boolean) as Array<{ name: string; type: string; relation: string }>;

    const seen = new Set<string>();
    const unique = connections.filter(c => {
      if (seen.has(c.name)) return false;
      seen.add(c.name); return true;
    }).sort((a, b) => {
      if (a.relation !== 'coOccurrence' && b.relation === 'coOccurrence') return -1;
      if (a.relation === 'coOccurrence' && b.relation !== 'coOccurrence') return 1;
      return 0;
    });

    const REL: Record<string, string> = {
      affiliatedWith: 'affilié', belongsTo: 'dans', relatedTo: 'lié à',
      coOccurrence: 'vu avec', associatedWith: 'associé',
    };

    return html`
      <div class="detail">
        <div class="detail-head">
          <div class="detail-badge" style="background:${cfg.color};color:var(--bg)">${n.name[0].toUpperCase()}</div>
          <div>
            <div class="detail-name">${n.name}</div>
            <div class="detail-type" style="color:${cfg.color}">${cfg.label}</div>
            <div class="detail-stat">${n.mentions} mentions &middot; ${unique.length} connexions</div>
          </div>
        </div>
        ${unique.length ? html`
          <div class="detail-connections">
            ${unique.slice(0, 10).map(c => {
              const cc = TYPE_CFG[c.type] || { color: palette.textFaint };
              const isStructural = c.relation !== 'coOccurrence';
              return html`
                <span class="conn-tag" style="${isStructural ? `border-color:${cc.color}40` : ''}">
                  <span class="conn-rel">${REL[c.relation] || c.relation}</span>
                  <span style="color:${cc.color};font-weight:${isStructural ? '600' : '400'}">${c.name}</span>
                </span>
              `;
            })}
          </div>
        ` : nothing}
      </div>
    `;
  }

  // ── Co-occurrences ─────────────────────────────────────────

  private _coOccurrences(gs: GraphStats | null) {
    if (!gs?.coOccurrences?.length) return nothing;
    const interesting = gs.coOccurrences.filter(c => c.type1 !== c.type2);
    const shown = interesting.length >= 3 ? interesting : gs.coOccurrences;

    return html`
      <div class="section">
        <div class="slabel">
          ${ico('<path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3m10 0h3a2 2 0 002-2v-3"/>', 14, 'var(--vert-menthe)')}
          Connexions observees
        </div>
        ${shown.slice(0, 8).map(c => {
          const c1 = TYPE_CFG[c.type1] || { color: palette.textFaint };
          const c2 = TYPE_CFG[c.type2] || { color: palette.textFaint };
          return html`
            <div class="cooc-row">
              <span class="cooc-dot" style="background:${c1.color}"></span>
              <span class="cooc-e" style="color:${c1.color}">${c.entity1}</span>
              <span style="color:var(--text-muted);font-size:8px">&harr;</span>
              <span class="cooc-e" style="color:${c2.color}">${c.entity2}</span>
              <span class="cooc-cnt">${c.count}x</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  // ── Timeline ───────────────────────────────────────────────

  private _timeline(gs: GraphStats | null) {
    if (!gs?.timeline?.length) return nothing;
    return html`
      <div class="section">
        <div class="slabel">
          ${ico('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', 14, 'var(--bleu-ciel)')}
          Evolution
        </div>
        ${gs.timeline.slice(0, 4).map(w => {
          const maxCount = w.entities[0]?.count || 1;
          return html`
            <div class="tl-row">
              <div class="tl-week">${w.week}</div>
              <div class="tl-bars">
                ${w.entities.slice(0, 6).map(e => {
                  const pct = Math.max(20, (e.count / maxCount) * 100);
                  const node = this.graphNodes.find(n => n.name === e.name);
                  const cfg = TYPE_CFG[node?.type || 'Theme'] || { color: palette.bleuIndigo };
                  return html`<span class="tl-chip" style="width:${pct}%;background:${cfg.color}">${e.name}</span>`;
                })}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}
