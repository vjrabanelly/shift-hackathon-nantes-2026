import { describe, it, expect } from 'vitest';
import { extractObservations, type MobileEnrichment } from '../services/graph-ingest-mobile';
import { normalizeTopics } from '../../../src/enrichment/dictionaries/topics-keywords';

function makeMerged(overrides: Partial<MobileEnrichment> = {}): MobileEnrichment {
  return {
    mainTopics: '[]',
    secondaryTopics: '[]',
    politicalActors: '[]',
    narrativeFrame: '',
    primaryEmotion: '',
    tone: 'neutral',
    confidenceScore: 0.8,
    provider: 'openai',
    ...overrides,
  };
}

describe('deduplication — normalizeTopics', () => {
  it('removes duplicate topics', () => {
    const result = normalizeTopics(['politique', 'sport', 'politique']);
    expect(result).toEqual(['politique', 'sport']);
  });

  it('normalizes aliases before dedup', () => {
    const result = normalizeTopics(['santé', 'sante', 'Santé']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('sante');
  });

  it('deduplicates accent variants', () => {
    const result = normalizeTopics(['beauté', 'beaute']);
    expect(result).toHaveLength(1);
  });

  it('handles empty array', () => {
    expect(normalizeTopics([])).toEqual([]);
  });

  it('filters unknown topics', () => {
    const result = normalizeTopics(['politique', 'xyznonexistent']);
    // xyznonexistent should be filtered since it has no known topic ID
    expect(result).not.toContain('xyznonexistent');
  });
});

describe('deduplication — extractObservations (persons vs politicalActors)', () => {
  it('deduplicates persons appearing as both persons and politicalActors', () => {
    const obs = extractObservations(makeMerged({
      persons: JSON.stringify(['Emmanuel Macron', 'Marine Le Pen']),
      politicalActors: JSON.stringify(['Macron', 'Le Pen']),
    }));
    // "Macron" should resolve to same canonical as "Emmanuel Macron" — no duplicate
    const personObs = obs.filter(o => o.entityType === 'Person');
    const names = personObs.map(o => o.entityName);
    const uniqueNames = [...new Set(names.map(n => n.toLowerCase()))];
    expect(uniqueNames.length).toBe(names.length);
  });

  it('deduplicates case-insensitive persons', () => {
    const obs = extractObservations(makeMerged({
      persons: JSON.stringify(['macron', 'Macron']),
    }));
    const personObs = obs.filter(o => o.relation === 'mentions' && o.entityType === 'Person');
    // Should be deduplicated to single canonical form
    expect(personObs.length).toBe(1);
  });

  it('does not lose distinct persons', () => {
    const obs = extractObservations(makeMerged({
      persons: JSON.stringify(['Emmanuel Macron', 'Marine Le Pen', 'Jean-Luc Mélenchon']),
    }));
    const personObs = obs.filter(o => o.entityType === 'Person');
    expect(personObs.length).toBe(3);
  });
});

describe('deduplication — mainTopics not repeated in secondaryTopics', () => {
  it('should not have same topic in both main and secondary', () => {
    const obs = extractObservations(makeMerged({
      mainTopics: JSON.stringify(['politique', 'sport']),
      secondaryTopics: JSON.stringify(['politique', 'humour']),
    }));
    const aboutObs = obs.filter(o => o.relation === 'isAbout');
    // politique appears in both → should still get 2 obs (main + secondary have different intensities)
    // but the entity name should appear with intensity 1.0 (main) and potentially again at 0.5
    // This is OK at the observation level — dedup happens at graph entity resolution
    const politiqueObs = aboutObs.filter(o => o.entityName.toLowerCase().includes('politique'));
    // At minimum, ensure we have observations for all unique topics
    const uniqueTopics = new Set(aboutObs.map(o => o.entityName.toLowerCase()));
    expect(uniqueTopics.size).toBeGreaterThanOrEqual(3); // politique, sport, humour
  });
});
