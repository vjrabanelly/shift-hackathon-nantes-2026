import { describe, it, expect } from 'vitest';
import {
  DOMAINS, THEMES,
  classifyMultiLevel, getDomainsFromThemes, getDomainForTheme,
  getThemeById, getSubjectById, getPreciseSubjectById,
  getAllPreciseSubjects, getPreciseSubjectsForTheme,
  getTaxonomyStats,
} from '../dictionaries/taxonomy';
import { classifyTopicsEnriched } from '../dictionaries/topics-keywords';

describe('taxonomy structure', () => {
  it('has 8 domains', () => {
    expect(DOMAINS).toHaveLength(8);
  });

  it('has 31 themes', () => {
    expect(THEMES).toHaveLength(31);
  });

  it('every theme has a valid domainId', () => {
    const domainIds = new Set(DOMAINS.map(d => d.id));
    for (const theme of THEMES) {
      expect(domainIds.has(theme.domainId)).toBe(true);
    }
  });

  it('every domain references existing themes', () => {
    const themeIds = new Set(THEMES.map(t => t.id));
    for (const domain of DOMAINS) {
      for (const tId of domain.themeIds) {
        expect(themeIds.has(tId)).toBe(true);
      }
    }
  });

  it('all themes are referenced by exactly one domain', () => {
    const allRefs = DOMAINS.flatMap(d => d.themeIds);
    expect(allRefs).toHaveLength(THEMES.length);
    expect(new Set(allRefs).size).toBe(THEMES.length);
  });

  it('has a reasonable number of subjects and precise subjects', () => {
    const stats = getTaxonomyStats();
    expect(stats.subjects).toBeGreaterThan(50);
    expect(stats.preciseSubjects).toBeGreaterThan(20);
  });

  it('precise subjects all have at least 2 known positions', () => {
    const all = getAllPreciseSubjects();
    for (const ps of all) {
      expect(ps.knownPositions.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('precise subjects all have a non-empty statement', () => {
    const all = getAllPreciseSubjects();
    for (const ps of all) {
      expect(ps.statement.length).toBeGreaterThan(10);
    }
  });
});

describe('taxonomy lookups', () => {
  it('getThemeById returns the correct theme', () => {
    const theme = getThemeById('politique');
    expect(theme).toBeDefined();
    expect(theme!.label).toBe('Politique');
    expect(theme!.subjects.length).toBeGreaterThan(0);
  });

  it('getDomainForTheme maps themes to domains', () => {
    const domain = getDomainForTheme('immigration');
    expect(domain).toBeDefined();
    expect(domain!.id).toBe('politique_societe');
  });

  it('getSubjectById returns subject with parent theme', () => {
    const result = getSubjectById('elections');
    expect(result).toBeDefined();
    expect(result!.subject.label).toBe('Élections');
    expect(result!.theme.id).toBe('politique');
  });

  it('getPreciseSubjectById returns full chain', () => {
    const result = getPreciseSubjectById('reforme_retraites_64');
    expect(result).toBeDefined();
    expect(result!.ps.statement).toContain('64 ans');
    expect(result!.subject.id).toBe('retraites');
    expect(result!.theme.id).toBe('economie');
  });

  it('getPreciseSubjectsForTheme returns all precise subjects for a theme', () => {
    const ps = getPreciseSubjectsForTheme('ecologie');
    expect(ps.length).toBeGreaterThanOrEqual(3);
    const ids = ps.map(p => p.id);
    expect(ids).toContain('nucleaire_indispensable');
    expect(ids).toContain('desobeissance_civile_climat');
  });

  it('getDomainsFromThemes deduplicates', () => {
    const domains = getDomainsFromThemes(['politique', 'immigration', 'securite']);
    expect(domains).toEqual(['politique_societe']);
  });

  it('getDomainsFromThemes returns multiple domains', () => {
    const domains = getDomainsFromThemes(['politique', 'sport', 'beaute']);
    expect(domains).toHaveLength(3);
    expect(domains).toContain('politique_societe');
    expect(domains).toContain('culture_divertissement');
    expect(domains).toContain('lifestyle_bienetre');
  });
});

describe('classifyMultiLevel', () => {
  it('classifies a political text at 3 levels', () => {
    const results = classifyMultiLevel(
      "Mélenchon dénonce le recours au 49.3 pour la réforme des retraites à l'assemblée"
    );
    expect(results.length).toBeGreaterThan(0);

    // Should find politique theme
    const politiqueMatches = results.filter(r => r.theme.id === 'politique');
    expect(politiqueMatches.length).toBeGreaterThan(0);

    // Should find vie_politique or reforme_institutions subject
    const subjects = results.map(r => r.subject?.id).filter(Boolean);
    expect(subjects.length).toBeGreaterThan(0);

    // Domain should be politique_societe
    const domains = new Set(results.map(r => r.domain.id));
    expect(domains.has('politique_societe')).toBe(true);
  });

  it('classifies a beauty text correctly', () => {
    const results = classifyMultiLevel('Nouveau sérum skincare routine maquillage tuto');
    const themes = new Set(results.map(r => r.theme.id));
    expect(themes.has('beaute')).toBe(true);

    const domains = new Set(results.map(r => r.domain.id));
    expect(domains.has('lifestyle_bienetre')).toBe(true);
  });

  it('classifies ecology with precise subject candidates', () => {
    const results = classifyMultiLevel(
      'Le nucléaire est indispensable pour la transition énergétique et réduire le CO2'
    );
    const subjects = results.map(r => r.subject?.id).filter(Boolean);
    expect(subjects).toContain('transition_energetique');

    // Check that precise subjects are available for this theme
    const ps = getPreciseSubjectsForTheme('ecologie');
    const ids = ps.map(p => p.id);
    expect(ids).toContain('nucleaire_indispensable');
  });

  it('returns empty for nonsense text', () => {
    const results = classifyMultiLevel('xyz abc 123');
    expect(results).toHaveLength(0);
  });
});

describe('classifyTopicsEnriched', () => {
  it('returns themes, subjects, and domains', () => {
    const result = classifyTopicsEnriched(
      "Gaza bombardement cessez le feu Palestine Israël"
    );
    expect(result.themes.length).toBeGreaterThan(0);
    expect(result.subjects.length).toBeGreaterThan(0);
    expect(result.domains.length).toBeGreaterThan(0);

    const themeIds = result.themes.map(t => t.id);
    expect(themeIds).toContain('geopolitique');

    const subjectIds = result.subjects.map(s => s.id);
    expect(subjectIds).toContain('conflit_israel_palestine');
  });

  it('backward compat: themes match classifyTopics output format', () => {
    const result = classifyTopicsEnriched('Le président annonce une réforme');
    for (const t of result.themes) {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('label');
      expect(t).toHaveProperty('matchCount');
    }
  });

  it('does NOT classify generic French text as sport (false positive regression)', () => {
    const falsePositiveCases = [
      'Le but de cette vidéo est de vous montrer comment bien investir',
      'Mon goal cette année : lancer mon business en ligne',
      'Ce match parfait entre couleurs et textures pour ta déco',
      'Je suis en train de running une campagne publicitaire',
      'Le record de vues sur cette vidéo est incroyable',
      'La sélection des meilleurs produits beauté de la semaine',
      'Les bleus à l\'âme quand tu réalises que tout change',
      'Formation coaching : développe ton mindset entrepreneurial',
    ];
    for (const text of falsePositiveCases) {
      const result = classifyTopicsEnriched(text);
      const themeIds = result.themes.map(t => t.id);
      expect(themeIds, `"${text}" should NOT be classified as sport`).not.toContain('sport');
    }
  });

  it('still classifies actual sport content correctly', () => {
    const sportCases = [
      'Le PSG remporte la Champions League après un match incroyable',
      'Séance de musculation et fitness au programme ce matin',
      'Les Jeux Olympiques 2024 à Paris : athlète français en finale',
      'Combat UFC ce soir : le champion du monde de MMA',
    ];
    for (const text of sportCases) {
      const result = classifyTopicsEnriched(text);
      const themeIds = result.themes.map(t => t.id);
      expect(themeIds, `"${text}" SHOULD be classified as sport`).toContain('sport');
    }
  });
});
