import { describe, it, expect } from 'vitest';
import { resolveEntityLocal, canonicalizeEntity, generateStructuralEdges, ENTITY_DICTIONARY, THEME_TO_DOMAIN } from '../services/ontology';

describe('ontology — entity resolution', () => {
  it('resolves "macron" to "Emmanuel Macron"', () => {
    const def = resolveEntityLocal('macron');
    expect(def).not.toBeNull();
    expect(def!.canonical).toBe('Emmanuel Macron');
    expect(def!.type).toBe('Person');
  });

  it('resolves "emmanuel macron" to same entity', () => {
    const def = resolveEntityLocal('Emmanuel Macron');
    expect(def!.canonical).toBe('Emmanuel Macron');
  });

  it('resolves Instagram handle "emmanuelmacron"', () => {
    const def = resolveEntityLocal('emmanuelmacron');
    expect(def!.canonical).toBe('Emmanuel Macron');
  });

  it('resolves "le pen" to "Marine Le Pen"', () => {
    const def = resolveEntityLocal('le pen');
    expect(def!.canonical).toBe('Marine Le Pen');
  });

  it('resolves "rn" to "Rassemblement National"', () => {
    const def = resolveEntityLocal('rn');
    expect(def!.canonical).toBe('Rassemblement National');
    expect(def!.type).toBe('Organization');
  });

  it('resolves "lfi" to "La France Insoumise"', () => {
    const def = resolveEntityLocal('lfi');
    expect(def!.canonical).toBe('La France Insoumise');
  });

  it('resolves with accent variations', () => {
    const def = resolveEntityLocal('mélenchon');
    expect(def!.canonical).toBe('Jean-Luc Melenchon');
  });

  it('resolves institutions', () => {
    const def = resolveEntityLocal('assemblée nationale');
    expect(def!.canonical).toBe('Assemblee Nationale');
    expect(def!.type).toBe('Institution');
  });

  it('resolves media', () => {
    const def = resolveEntityLocal('mediapart');
    expect(def!.canonical).toBe('Mediapart');
    expect(def!.type).toBe('Media');
  });

  it('returns null for unknown entities', () => {
    expect(resolveEntityLocal('random person 12345')).toBeNull();
  });
});

describe('ontology — canonicalizeEntity', () => {
  it('uses canonical name for known entities', () => {
    const result = canonicalizeEntity('bardella', 'Person');
    expect(result.canonical).toBe('Jordan Bardella');
    expect(result.type).toBe('Person');
  });

  it('falls back to raw name for unknowns', () => {
    const result = canonicalizeEntity('Some Random Dude', 'Person');
    expect(result.canonical).toBe('Some Random Dude');
    expect(result.type).toBe('Person');
  });

  it('preserves resolved type over input type', () => {
    // "rn" is an Organization, even if called as Theme
    const result = canonicalizeEntity('rn', 'Theme');
    expect(result.type).toBe('Organization');
  });
});

describe('ontology — structural edges', () => {
  it('generates edges from entity dictionary', () => {
    const edges = generateStructuralEdges();
    expect(edges.length).toBeGreaterThan(30);

    // Macron → Renaissance
    const macronEdge = edges.find(e =>
      e.sourceCanonical === 'Emmanuel Macron' && e.targetCanonical === 'Renaissance'
    );
    expect(macronEdge).toBeDefined();
    expect(macronEdge!.relation).toBe('affiliatedWith');
  });

  it('generates Theme → Domain edges', () => {
    const edges = generateStructuralEdges();
    const politiqueDomain = edges.find(e =>
      e.sourceCanonical === 'politique' && e.relation === 'belongsTo' && e.sourceType === 'Theme'
    );
    expect(politiqueDomain).toBeDefined();
    expect(politiqueDomain!.targetType).toBe('Domain');
  });

  it('generates relatedTo edges between themes', () => {
    const edges = generateStructuralEdges();
    const related = edges.filter(e => e.relation === 'relatedTo');
    expect(related.length).toBeGreaterThan(10);
    // politique ↔ economie
    const polEco = related.find(e =>
      e.sourceCanonical === 'politique' && e.targetCanonical === 'economie'
    );
    expect(polEco).toBeDefined();
  });

  it('covers all themes in THEME_TO_DOMAIN', () => {
    const edges = generateStructuralEdges();
    const themeEdges = edges.filter(e => e.sourceType === 'Theme' && e.relation === 'belongsTo' && e.targetType === 'Domain');
    const coveredThemes = new Set(themeEdges.map(e => e.sourceCanonical));
    for (const theme of Object.keys(THEME_TO_DOMAIN)) {
      expect(coveredThemes.has(theme)).toBe(true);
    }
  });

  it('all entity dictionary persons have affiliatedWith edges', () => {
    const persons = ENTITY_DICTIONARY.filter(d => d.type === 'Person' && d.edges?.some(e => e.relation === 'affiliatedWith'));
    expect(persons.length).toBeGreaterThan(10);
  });
});
