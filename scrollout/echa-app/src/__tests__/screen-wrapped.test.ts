/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db-bridge before importing the component
vi.mock('../services/db-bridge.js', () => ({
  getStats: vi.fn().mockResolvedValue({
    totalPosts: 280,
    totalEnriched: 155,
    totalSessions: 18,
    totalDwellMs: 3726348,
    attention: { skipped: 99, glanced: 70, viewed: 57, engaged: 54 },
    political: { 0: 132, 1: 2, 2: 14, 3: 5, 4: 2 },
    avgPolarization: 0.05,
    avgConfidence: 0.68,
    topDomains: [
      { domain: 'culture_divertissement', count: 92 },
      { domain: 'lifestyle_bienetre', count: 22 },
      { domain: 'politique_societe', count: 14 },
      { domain: 'information_savoirs', count: 14 },
      { domain: 'ecologie_environnement', count: 4 },
      { domain: 'economie_travail', count: 1 },
    ],
    topTopics: [
      { topic: 'divertissement', count: 64 },
      { topic: 'culture', count: 51 },
      { topic: 'humour', count: 23 },
    ],
    topUsers: [
      { username: 'operadelyon', count: 11, totalDwellMs: 50000 },
      { username: 'larochandry', count: 8, totalDwellMs: 35000 },
    ],
    topCategories: [],
    signals: { activism: 5, conflict: 2, moralAbsolute: 1, enemyDesignation: 3, ingroupOutgroup: 4, total: 15 },
    sponsoredStats: {
      sponsored: { count: 71, avgDwellMs: 3000, avgPolitical: 0.2 },
      organic: { count: 209, avgDwellMs: 5000, avgPolitical: 0.3 },
    },
    axes: { economic: 0.29, societal: -0.14, authority: 0, system: 0 },
    topNarratives: [
      { narrative: 'hero_journey', count: 18 },
      { narrative: 'us_vs_them', count: 12 },
      { narrative: 'nostalgia', count: 8 },
    ],
    topEmotions: [
      { emotion: 'joy', count: 42 },
      { emotion: 'anger', count: 28 },
      { emotion: 'surprise', count: 15 },
      { emotion: 'sadness', count: 10 },
    ],
    dwellByTopic: [
      { topic: 'divertissement', totalDwellMs: 120000, avgDwellMs: 5000, count: 24 },
      { topic: 'culture', totalDwellMs: 100000, avgDwellMs: 4500, count: 22 },
    ],
    mediaTypes: [
      { type: 'reel', count: 120, totalDwellMs: 600000 },
      { type: 'image', count: 100, totalDwellMs: 300000 },
      { type: 'carousel', count: 60, totalDwellMs: 240000 },
    ],
    polarizingAccounts: [
      { username: 'compte_polemic', avgPolarization: 0.8, avgPolitical: 3.5, count: 15, totalDwellMs: 45000 },
      { username: 'news_extremist', avgPolarization: 0.75, avgPolitical: 3.2, count: 12, totalDwellMs: 38000 },
    ],
    attentionPolitical: {
      engaged: { avgPolitical: 1.2, avgPolarization: 0.15, count: 54 },
      viewed: { avgPolitical: 0.8, avgPolarization: 0.08, count: 57 },
      glanced: { avgPolitical: 0.6, avgPolarization: 0.05, count: 70 },
      skipped: { avgPolitical: 0.3, avgPolarization: 0.02, count: 99 },
    },
  }),
}));

vi.mock('../services/ontology.js', () => ({
  resolveEntityLocal: vi.fn(() => null),
  ENTITY_DICTIONARY: [],
}));

describe('screen-wrapped', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should be defined as a custom element', async () => {
    await import('../screens/screen-wrapped.js');
    expect(customElements.get('screen-wrapped')).toBeDefined();
  });

  it('should render 19 slides', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    expect(el.shadowRoot).toBeTruthy();
    const slides = el.shadowRoot!.querySelectorAll('.slide');
    expect(slides.length).toBe(19);
  });

  it('should navigate between slides via go()', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    expect(el.currentSlide).toBe(0);
    el.go(3);
    expect(el.currentSlide).toBe(3);
    el.go(-1);
    expect(el.currentSlide).toBe(0);
    el.go(25);
    expect(el.currentSlide).toBe(18); // clamp to 19-1
  });

  it('should dispatch close-wrapped event', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    let closed = false;
    el.addEventListener('close-wrapped', () => { closed = true; });
    el.close();
    expect(closed).toBe(true);
  });

  it('should show top domain percentage (slide 01)', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    const text = el.shadowRoot!.textContent || '';
    // 92/147 total = 63%
    expect(text).toContain('63%');
    expect(text).toContain('divertissement');
  });

  it('should show skip rate (slide 07)', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    const text = el.shadowRoot!.textContent || '';
    // 99/280 = 35%
    expect(text).toContain('35%');
    expect(text).toContain('passent sans être regardés');
  });

  it('should show narrative labels', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    const text = el.shadowRoot!.textContent || '';
    expect(text).toContain('Héroïque');
    expect(text).toContain('Nous vs Eux');
  });

  it('should show emotion labels', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    const text = el.shadowRoot!.textContent || '';
    expect(text).toContain('Joie');
    expect(text).toContain('Colère');
  });

  it('should show compass axes values', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    const text = el.shadowRoot!.textContent || '';
    expect(text).toContain('+0.29');
    expect(text).toContain('-0.14');
  });

  it('should show user profile on slide 09', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    const text = el.shadowRoot!.textContent || '';
    expect(text).toContain('Vous êtes');
    expect(text).toContain('zappeur');
  });

  it('should have share, terminer, and on continue on last slide', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    const text = el.shadowRoot!.textContent || '';
    expect(text).toContain('Partager');
    expect(text).toContain('Terminer');
    expect(text).toContain('On continue');
  });

  it('should show account names in sAccounts slide', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    const text = el.shadowRoot!.textContent || '';
    expect(text).toContain('operadelyon');
    expect(text).toContain('influence');
  });

  it('should show media types in sMediaTypes slide', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    const text = el.shadowRoot!.textContent || '';
    expect(text.toLowerCase()).toMatch(/reel|media|format/i);
  });

  it('should show signal data in sSignals slide', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    const text = el.shadowRoot!.textContent || '';
    expect(text).toContain('signaux');
  });
});
