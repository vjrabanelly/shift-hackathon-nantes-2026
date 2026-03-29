import { describe, it, expect } from 'vitest';
import { detectPoliticalActors } from '../dictionaries/political-actors';
import { analyzeHashtags } from '../dictionaries/militant-hashtags';
import { detectPolarization } from '../dictionaries/conflict-vocabulary';
import { classifyTopics } from '../dictionaries/topics-keywords';

describe('detectPoliticalActors', () => {
  it('détecte des figures politiques', () => {
    const result = detectPoliticalActors('Mélenchon dénonce la réforme');
    expect(result.figures).toContain('mélenchon');
  });

  it('détecte des partis', () => {
    const result = detectPoliticalActors('Le rassemblement national progresse dans les sondages');
    expect(result.parties).toContain('rassemblement national');
  });

  it('détecte des institutions', () => {
    const result = detectPoliticalActors("Débat houleux à l'assemblée nationale hier soir");
    expect(result.institutions).toContain('assemblée nationale');
  });

  it('détecte des termes militants', () => {
    const result = detectPoliticalActors('Grande manifestation prévue demain, mobilisation générale');
    expect(result.activismTerms).toContain('manifestation');
    expect(result.activismTerms).toContain('mobilisation');
  });

  it('ne fait pas de faux positif sur "lo" dans un texte normal', () => {
    const result = detectPoliticalActors('Profil Home Reels Explorer');
    expect(result.parties).not.toContain('lo');
  });

  it('ne matche pas "ps" dans "caps" ou "steps"', () => {
    const result = detectPoliticalActors('Ces caps et ces steps de danse');
    expect(result.parties).not.toContain('ps');
  });

  it('retourne vide sur un texte apolitique', () => {
    const result = detectPoliticalActors('Recette de gâteau au chocolat maison');
    expect(result.parties).toHaveLength(0);
    expect(result.figures).toHaveLength(0);
    expect(result.institutions).toHaveLength(0);
    expect(result.activismTerms).toHaveLength(0);
  });
});

describe('analyzeHashtags', () => {
  it('détecte des hashtags politiques', () => {
    const result = analyzeHashtags(['#freepalestine', '#stopwar']);
    expect(result.politicalHashtags.length).toBeGreaterThan(0);
    expect(result.politicalLevel).toBe(3);
  });

  it('détecte du niveau militant (≥3 hashtags politiques)', () => {
    const result = analyzeHashtags(['#freepalestine', '#stopwar', '#genocide']);
    expect(result.politicalLevel).toBe(4);
  });

  it('détecte des hashtags sociétaux', () => {
    const result = analyzeHashtags(['#pouvoirdachat', '#inflation']);
    expect(result.societalHashtags.length).toBeGreaterThan(0);
    expect(result.politicalLevel).toBe(2);
  });

  it('retourne 0 sur des hashtags lifestyle', () => {
    const result = analyzeHashtags(['#food', '#travel', '#ootd']);
    expect(result.politicalLevel).toBe(0);
  });
});

describe('detectPolarization', () => {
  it('détecte un texte fortement polarisant', () => {
    const result = detectPolarization(
      "C'est scandaleux ! Les élites nous mentent, cette trahison est inadmissible. " +
      "Ils sont les ennemis du peuple, il faut les virer !"
    );
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.signals.ingroupOutgroup).toBe(true);
    expect(result.signals.enemyDesignation).toBe(true);
  });

  it('détecte un texte légèrement polarisant', () => {
    const result = detectPolarization("C'est scandaleux ce qui se passe");
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(0.5);
  });

  it('retourne 0 sur un texte neutre', () => {
    const result = detectPolarization('Voici ma recette de crêpes bretonnes');
    expect(result.score).toBe(0);
    expect(result.signals.ingroupOutgroup).toBe(false);
    expect(result.signals.conflict).toBe(false);
  });
});

describe('classifyTopics', () => {
  it('classifie un texte politique', () => {
    const result = classifyTopics("Le président Macron a présenté sa réforme des retraites à l'Assemblée");
    const topicIds = result.map(t => t.id);
    expect(topicIds).toContain('politique');
  });

  it('classifie un texte beauté/lifestyle', () => {
    const result = classifyTopics('Nouveau tuto maquillage skincare routine du matin');
    const topicIds = result.map(t => t.id);
    expect(topicIds).toContain('beaute');
  });

  it('supporte le multi-label', () => {
    const result = classifyTopics(
      "Le ministre de la santé annonce une réforme de l'hôpital et des urgences"
    );
    const topicIds = result.map(t => t.id);
    expect(topicIds).toContain('sante');
    expect(topicIds).toContain('politique');
  });

  it('retourne vide sur texte sans signal', () => {
    const result = classifyTopics('Abc xyz 123');
    expect(result).toHaveLength(0);
  });
});
