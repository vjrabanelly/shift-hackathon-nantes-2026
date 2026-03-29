import { describe, it, expect } from 'vitest';
import { extractObservations, type MobileEnrichment } from '../services/graph-ingest-mobile';

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

describe('extractObservations (mobile)', () => {
  it('returns empty for empty enrichment', () => {
    expect(extractObservations(makeMerged())).toEqual([]);
  });

  it('extracts main topics as isAbout (intensity 1.0)', () => {
    const obs = extractObservations(makeMerged({
      mainTopics: JSON.stringify(['politique', 'sport']),
    }));
    expect(obs).toHaveLength(2);
    expect(obs[0]).toMatchObject({
      entityName: 'politique', entityType: 'Theme',
      relation: 'isAbout', intensity: 1.0,
    });
  });

  it('extracts secondary topics with intensity 0.5', () => {
    const obs = extractObservations(makeMerged({
      secondaryTopics: JSON.stringify(['humour']),
    }));
    expect(obs[0]).toMatchObject({ intensity: 0.5, entityName: 'humour' });
  });

  it('extracts political actors as Person mentions', () => {
    const obs = extractObservations(makeMerged({
      politicalActors: JSON.stringify(['Marine Le Pen']),
    }));
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({
      entityName: 'Marine Le Pen', entityType: 'Person', relation: 'mentions',
    });
  });

  it('deduplicates political actors already in persons', () => {
    const obs = extractObservations(makeMerged({
      persons: JSON.stringify(['Marine Le Pen']),
      politicalActors: JSON.stringify(['Marine Le Pen', 'Jordan Bardella']),
    }));
    const personNames = obs.filter(o => o.entityType === 'Person').map(o => o.entityName);
    expect(personNames).toEqual(['Marine Le Pen', 'Jordan Bardella']);
  });

  it('extracts narrative frame as uses', () => {
    const obs = extractObservations(makeMerged({ narrativeFrame: 'declin' }));
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({ entityType: 'Narrative', relation: 'uses' });
  });

  it('skips narrative "aucun"', () => {
    expect(extractObservations(makeMerged({ narrativeFrame: 'aucun' }))).toHaveLength(0);
  });

  it('extracts emotion as evokes', () => {
    const obs = extractObservations(makeMerged({ primaryEmotion: 'colere' }));
    expect(obs[0]).toMatchObject({ entityType: 'Emotion', relation: 'evokes' });
  });

  it('skips neutral emotion', () => {
    expect(extractObservations(makeMerged({ primaryEmotion: 'neutre' }))).toHaveLength(0);
  });

  it('extracts precise subjects with stance', () => {
    const obs = extractObservations(makeMerged({
      preciseSubjects: JSON.stringify([{
        id: 'ps-01', statement: 'Faut-il limiter?', position: 'contre', confidence: 0.9,
      }]),
    }));
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({
      entityType: 'PreciseSubject', relation: 'takesPosition',
      stance: 'contre', confidence: 0.9,
    });
  });

  it('handles complex post with all facets', () => {
    const obs = extractObservations(makeMerged({
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
    const obs = extractObservations(makeMerged({
      mainTopics: 'broken json',
      persons: '{{invalid',
    }));
    expect(obs).toHaveLength(0);
  });

  it('extracts audience target', () => {
    const obs = extractObservations(makeMerged({ audienceTarget: 'militant' }));
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({
      entityName: 'militant', entityType: 'Audience', relation: 'targets',
    });
  });
});
