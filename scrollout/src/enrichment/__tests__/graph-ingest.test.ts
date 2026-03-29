import { describe, it, expect } from 'vitest';
import { canonicalize, extractObservations } from '../graph-ingest';
import type { MergedEnrichment } from '../graph-ingest';

// ─── canonicalize ───────────────────────────────────────────────

describe('canonicalize', () => {
  it('lowercases and trims', () => {
    expect(canonicalize('  Emmanuel Macron  ')).toBe('emmanuel macron');
  });

  it('strips accents', () => {
    expect(canonicalize('Élisabeth Borne')).toBe('elisabeth borne');
    expect(canonicalize('François Hollande')).toBe('francois hollande');
  });

  it('normalizes whitespace', () => {
    expect(canonicalize('Jean-Luc   Mélenchon')).toBe('jean-luc melenchon');
  });

  it('handles empty string', () => {
    expect(canonicalize('')).toBe('');
  });
});

// ─── extractObservations ────────────────────────────────────────

function makeMerged(overrides: Partial<MergedEnrichment> = {}): MergedEnrichment {
  return {
    normalizedText: 'test post content',
    semanticSummary: 'test summary',
    mainTopics: '[]',
    secondaryTopics: '[]',
    subjects: '[]',
    preciseSubjects: '[]',
    persons: '[]',
    organizations: '[]',
    institutions: '[]',
    countries: '[]',
    politicalActors: '[]',
    narrativeFrame: '',
    primaryEmotion: '',
    tone: 'neutral',
    audienceTarget: '',
    confidenceScore: 0.8,
    provider: 'openai',
    ...overrides,
  };
}

describe('extractObservations', () => {
  it('returns empty array for empty enrichment', () => {
    const obs = extractObservations('post1', makeMerged());
    expect(obs).toEqual([]);
  });

  it('extracts main topics as isAbout with intensity 1.0', () => {
    const obs = extractObservations('post1', makeMerged({
      mainTopics: JSON.stringify(['politique', 'economie']),
    }));
    expect(obs).toHaveLength(2);
    expect(obs[0]).toMatchObject({
      postId: 'post1',
      entityName: 'politique',
      entityType: 'Theme',
      relation: 'isAbout',
      intensity: 1.0,
    });
    expect(obs[1].entityName).toBe('economie');
  });

  it('extracts secondary topics with intensity 0.5', () => {
    const obs = extractObservations('post1', makeMerged({
      secondaryTopics: JSON.stringify(['humour']),
    }));
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({
      relation: 'isAbout',
      intensity: 0.5,
      entityName: 'humour',
    });
  });

  it('extracts persons as mentions', () => {
    const obs = extractObservations('post1', makeMerged({
      persons: JSON.stringify(['Emmanuel Macron', 'Marine Le Pen']),
    }));
    expect(obs).toHaveLength(2);
    expect(obs.every(o => o.relation === 'mentions')).toBe(true);
    expect(obs.every(o => o.entityType === 'Person')).toBe(true);
  });

  it('deduplicates politicalActors already in persons', () => {
    const obs = extractObservations('post1', makeMerged({
      persons: JSON.stringify(['Emmanuel Macron']),
      politicalActors: JSON.stringify(['Emmanuel Macron', 'Jordan Bardella']),
    }));
    const personNames = obs.filter(o => o.entityType === 'Person').map(o => o.entityName);
    expect(personNames).toEqual(['Emmanuel Macron', 'Jordan Bardella']);
  });

  it('extracts narrative frame as uses', () => {
    const obs = extractObservations('post1', makeMerged({
      narrativeFrame: 'declin',
    }));
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({
      entityName: 'declin',
      entityType: 'Narrative',
      relation: 'uses',
    });
  });

  it('skips narrative frame "aucun"', () => {
    const obs = extractObservations('post1', makeMerged({
      narrativeFrame: 'aucun',
    }));
    expect(obs).toHaveLength(0);
  });

  it('extracts emotion as evokes', () => {
    const obs = extractObservations('post1', makeMerged({
      primaryEmotion: 'colère',
    }));
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({
      entityName: 'colère',
      entityType: 'Emotion',
      relation: 'evokes',
    });
  });

  it('skips neutral emotion', () => {
    const obs = extractObservations('post1', makeMerged({
      primaryEmotion: 'neutre',
    }));
    expect(obs).toHaveLength(0);
  });

  it('extracts precise subjects with stance', () => {
    const obs = extractObservations('post1', makeMerged({
      preciseSubjects: JSON.stringify([{
        id: 'ps-immigration-01',
        statement: 'Faut-il limiter l\'immigration ?',
        position: 'contre',
        confidence: 0.9,
      }]),
    }));
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({
      entityType: 'PreciseSubject',
      relation: 'takesPosition',
      stance: 'contre',
      confidence: 0.9,
    });
  });

  it('extracts organizations, institutions, countries', () => {
    const obs = extractObservations('post1', makeMerged({
      organizations: JSON.stringify(['Greenpeace']),
      institutions: JSON.stringify(['Assemblée nationale']),
      countries: JSON.stringify(['France', 'Allemagne']),
    }));
    expect(obs).toHaveLength(4);
    expect(obs.find(o => o.entityType === 'Organization')?.entityName).toBe('Greenpeace');
    expect(obs.find(o => o.entityType === 'Institution')?.entityName).toBe('Assemblée nationale');
    expect(obs.filter(o => o.entityType === 'Country')).toHaveLength(2);
  });

  it('extracts audience target', () => {
    const obs = extractObservations('post1', makeMerged({
      audienceTarget: 'militant',
    }));
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({
      entityName: 'militant',
      entityType: 'Audience',
      relation: 'targets',
    });
  });

  it('handles complex post with multiple facets', () => {
    const obs = extractObservations('post1', makeMerged({
      mainTopics: JSON.stringify(['politique', 'immigration']),
      secondaryTopics: JSON.stringify(['securite']),
      persons: JSON.stringify(['Marine Le Pen']),
      organizations: JSON.stringify(['RN']),
      countries: JSON.stringify(['France']),
      narrativeFrame: 'menace',
      primaryEmotion: 'peur',
      audienceTarget: 'grand public',
    }));
    // 2 main + 1 secondary + 1 person + 1 org + 1 country + 1 narrative + 1 emotion + 1 audience = 9
    expect(obs).toHaveLength(9);
  });

  it('handles malformed JSON gracefully', () => {
    const obs = extractObservations('post1', makeMerged({
      mainTopics: 'not valid json',
      persons: '{broken}',
    }));
    expect(obs).toHaveLength(0);
  });
});
