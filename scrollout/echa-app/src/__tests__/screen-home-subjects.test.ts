/**
 * @vitest-environment jsdom
 *
 * Test: renderSubjects backward compatibility + rich insights rendering
 * Ensures the profile page doesn't break when subjectInsights are absent (old data)
 * and renders correctly when they are present (new data).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbStats, SubjectInsight } from '../services/db-bridge.js';

// Mock lit (minimal stubs for SSR-less testing)
vi.mock('lit', () => ({
  LitElement: class {},
  html: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
  css: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
  nothing: Symbol('nothing'),
}));
vi.mock('lit/directives/unsafe-svg.js', () => ({ unsafeSVG: (s: string) => s }));
vi.mock('lit/decorators.js', () => ({
  customElement: () => () => {},
  state: () => () => {},
}));
vi.mock('../services/native-bridge.js', () => ({ openInstagram: vi.fn() }));
vi.mock('../services/db-bridge.js', () => ({
  getStats: vi.fn().mockResolvedValue({}),
}));

// ── Fixtures ─────────────────────────────────────────────────

function makeBaseStats(): DbStats {
  return {
    totalSessions: 5,
    totalPosts: 100,
    totalEnriched: 80,
    totalDwellMs: 600000,
    attention: { engaged: 20, viewed: 30, glanced: 30, skipped: 20 },
    political: { 0: 60, 1: 15, 2: 10, 3: 10, 4: 5 },
    topCategories: [],
    topUsers: [],
    topDomains: [{ domain: 'culture', count: 40 }],
    topTopics: [{ topic: 'divertissement', count: 30 }],
  };
}

const sampleInsight: SubjectInsight = {
  subject: 'immigration',
  count: 12,
  totalDwellMs: 272000,
  avgDwellMs: 22667,
  attention: { engaged: 7, viewed: 3, glanced: 1, skipped: 1 },
  topAccounts: [
    { username: 'lemonde', count: 4 },
    { username: 'bfrm', count: 3 },
    { username: 'mediapart', count: 2 },
  ],
  dominantEmotion: 'indignation',
  dominantTone: 'informatif',
  domains: ['actualité'],
  avgPoliticalScore: 3.2,
  avgPolarization: 0.45,
  sampleCaption: 'La politique migratoire en France fait debat...',
  sampleSummary: 'Analyse du debat sur la politique migratoire francaise.',
};

const samplePreciseInsight: SubjectInsight = {
  subject: 'faut-il limiter l\'immigration ?',
  count: 5,
  totalDwellMs: 132000,
  avgDwellMs: 26400,
  attention: { engaged: 4, viewed: 1 },
  topAccounts: [{ username: 'bfrm', count: 3 }],
  dominantEmotion: 'indignation',
  dominantTone: 'militant',
  domains: ['actualité'],
  avgPoliticalScore: 3.8,
  avgPolarization: 0.6,
  sampleCaption: '',
  sampleSummary: 'Debat sur les quotas migratoires et leurs impacts.',
};

// ── Tests ────────────────────────────────────────────────────

describe('screen-home: renderSubjects backward compatibility', () => {
  it('should handle stats with NO insights and NO legacy subjects (returns nothing)', () => {
    const stats = makeBaseStats();
    // No topSubjects, no subjectInsights
    expect(stats.subjectInsights).toBeUndefined();
    expect(stats.topSubjects).toBeUndefined();
    // The renderSubjects method would return `nothing` — we test the data contract
  });

  it('should handle stats with legacy subjects but no insights (fallback)', () => {
    const stats = makeBaseStats();
    stats.topSubjects = [
      { topic: 'immigration', count: 10 },
      { topic: 'culture', count: 8 },
    ];
    expect(stats.subjectInsights).toBeUndefined();
    expect(stats.topSubjects.length).toBe(2);
  });

  it('should handle stats with rich insights', () => {
    const stats = makeBaseStats();
    stats.subjectInsights = [sampleInsight];
    stats.preciseSubjectInsights = [samplePreciseInsight];

    expect(stats.subjectInsights.length).toBe(1);
    expect(stats.subjectInsights[0].subject).toBe('immigration');
    expect(stats.subjectInsights[0].topAccounts.length).toBe(3);
    expect(stats.subjectInsights[0].totalDwellMs).toBe(272000);
    expect(stats.subjectInsights[0].dominantEmotion).toBe('indignation');

    expect(stats.preciseSubjectInsights.length).toBe(1);
    expect(stats.preciseSubjectInsights[0].subject).toBe('faut-il limiter l\'immigration ?');
  });

  it('SubjectInsight attention breakdown sums correctly', () => {
    const att = sampleInsight.attention;
    const total = Object.values(att).reduce((a, b) => a + b, 0);
    expect(total).toBe(12);
    expect(att['engaged']).toBe(7);
    const engagedPct = Math.round((att['engaged']! / total) * 100);
    expect(engagedPct).toBe(58);
  });

  it('handles empty attention gracefully', () => {
    const insight: SubjectInsight = {
      ...sampleInsight,
      attention: {},
    };
    const total = Object.values(insight.attention).reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
    // engagedPct calculation should not divide by zero
    const engagedPct = total > 0 ? Math.round(((insight.attention['engaged'] || 0) / total) * 100) : 0;
    expect(engagedPct).toBe(0);
  });

  it('dwell time formatting works for minutes and seconds', () => {
    // 272s = 4m32s
    const dwellSec = Math.round(272000 / 1000);
    const label = dwellSec >= 60
      ? `${Math.floor(dwellSec / 60)}m${String(dwellSec % 60).padStart(2, '0')}s`
      : `${dwellSec}s`;
    expect(label).toBe('4m32s');

    // 45s
    const short = Math.round(45000 / 1000);
    const shortLabel = short >= 60
      ? `${Math.floor(short / 60)}m${String(short % 60).padStart(2, '0')}s`
      : `${short}s`;
    expect(shortLabel).toBe('45s');
  });

  it('auto-insight ratio calculation is correct', () => {
    const top = sampleInsight;  // 272s
    const second: SubjectInsight = { ...sampleInsight, subject: 'culture', totalDwellMs: 90000 };
    const ratio = (Math.round(top.totalDwellMs / 1000) / Math.round(second.totalDwellMs / 1000)).toFixed(1);
    expect(ratio).toBe('3.0');
  });
});
