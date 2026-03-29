import { describe, it, expect } from 'vitest';
import { applyRules } from '../rules-engine';

describe('applyRules', () => {
  it('score 0 sur un post beauté/lifestyle', () => {
    const result = applyRules({
      normalizedText: 'Nouveau tuto maquillage, routine skincare du matin avec mon sérum préféré',
      hashtags: ['skincare', 'beauty', 'routine'],
      username: 'beautygirl',
    });
    expect(result.politicalExplicitnessScore).toBe(0);
    expect(result.polarizationScore).toBe(0);
    expect(result.mainTopics).toContain('beaute');
  });

  it('score 3+ sur un post mentionnant des acteurs politiques', () => {
    const result = applyRules({
      normalizedText: 'Macron annonce une nouvelle réforme, Mélenchon réagit vivement',
      hashtags: [],
      username: 'infos24h',
    });
    expect(result.politicalExplicitnessScore).toBeGreaterThanOrEqual(3);
    expect(result.politicalActors.length).toBeGreaterThan(0);
  });

  it('score 4 sur un post militant avec hashtags', () => {
    const result = applyRules({
      normalizedText: 'Tous en grève demain, mobilisation générale contre cette réforme',
      hashtags: ['#grevegeneral', '#reformedesretraites', '#onlacherien'],
      username: 'militant_cgt',
    });
    expect(result.politicalExplicitnessScore).toBe(4);
    expect(result.activismSignal).toBe(true);
  });

  it('détecte la polarisation dans un texte indigné', () => {
    const result = applyRules({
      normalizedText: "C'est scandaleux ! Les élites se moquent du peuple, c'est inadmissible",
      hashtags: [],
      username: 'citoyen_enerve',
    });
    expect(result.polarizationScore).toBeGreaterThan(0.2);
    expect(result.ingroupOutgroupSignal).toBe(true);
  });

  it('confiance basse sur texte très court', () => {
    const result = applyRules({
      normalizedText: 'Lol',
      hashtags: [],
      username: 'random',
    });
    expect(result.confidenceScore).toBeLessThan(0.5);
  });

  it('confiance plus haute avec texte long + hashtags', () => {
    const result = applyRules({
      normalizedText: 'Un long texte avec beaucoup de contenu sur la politique française et les réformes du gouvernement et les partis politiques',
      hashtags: ['politique', 'france', 'reforme'],
      username: 'analyste',
    });
    expect(result.confidenceScore).toBeGreaterThan(0.5);
  });

  // ── Axes politiques ─────────────────────────────────────────────────

  it('axe économique gauche sur texte redistribution/services publics', () => {
    const result = applyRules({
      normalizedText: 'Il faut taxer les riches pour financer les services publics et la sécurité sociale. La redistribution est essentielle pour la justice sociale.',
      hashtags: [],
      username: 'analyste_eco',
    });
    expect(result.politicalAxes.economic).toBeLessThan(0);
    expect(result.dominantAxis).toBe('economic');
  });

  it('axe économique droite sur texte libéral/entrepreneuriat', () => {
    const result = applyRules({
      normalizedText: 'La compétitivité passe par la baisse des impôts et la flexibilité du marché du travail. Vive l\'entrepreneuriat et la libre entreprise.',
      hashtags: [],
      username: 'analyste_eco',
    });
    expect(result.politicalAxes.economic).toBeGreaterThan(0);
  });

  it('axe sociétal conservateur sur texte identitaire/tradition', () => {
    const result = applyRules({
      normalizedText: 'Les valeurs traditionnelles et l\'identité nationale sont menacées par le wokisme et le communautarisme.',
      hashtags: [],
      username: 'debatteur',
    });
    expect(result.politicalAxes.societal).toBeGreaterThan(0);
  });

  it('axe autorité sur texte sécuritaire', () => {
    const result = applyRules({
      normalizedText: 'Tolérance zéro ! Il faut rétablir l\'ordre avec les forces de l\'ordre et la vidéosurveillance.',
      hashtags: [],
      username: 'securite_dabord',
    });
    expect(result.politicalAxes.authority).toBeGreaterThan(0);
  });

  it('axe système anti-système sur texte contestataire', () => {
    const result = applyRules({
      normalizedText: 'Les élites corrompues nous mentent, cette oligarchie doit dégager. Démocratie directe et RIC maintenant !',
      hashtags: [],
      username: 'citoyen_libre',
    });
    expect(result.politicalAxes.system).toBeLessThan(0);
  });

  it('axes neutres sur post apolitique', () => {
    const result = applyRules({
      normalizedText: 'Nouveau tuto maquillage, routine skincare du matin',
      hashtags: ['beauty'],
      username: 'beautygirl',
    });
    expect(result.politicalAxes.economic).toBe(0);
    expect(result.politicalAxes.societal).toBe(0);
    expect(result.politicalAxes.authority).toBe(0);
    expect(result.politicalAxes.system).toBe(0);
    expect(result.dominantAxis).toBeNull();
  });

  it('debug contient axesMatches', () => {
    const result = applyRules({
      normalizedText: 'Taxer les riches et redistribution pour la justice sociale',
      hashtags: [],
      username: 'test',
    });
    expect(result._debug.axesMatches).toBeDefined();
    expect(result._debug.axesMatches.economic.negative.length).toBeGreaterThan(0);
  });

  // ── Comptes politiques connus ───────────────────────────────────

  it('boost score politique pour un compte connu (mathildelarrere)', () => {
    const result = applyRules({
      normalizedText: 'Une photo intéressante de mon chat',
      hashtags: [],
      username: 'mathildelarrere',
    });
    expect(result.politicalExplicitnessScore).toBeGreaterThanOrEqual(3);
    expect(result.politicalIssueTags).toContain('politique');
  });

  it('pas de boost pour un compte inconnu', () => {
    const result = applyRules({
      normalizedText: 'Une photo intéressante de mon chat',
      hashtags: [],
      username: 'random_user_12345',
    });
    expect(result.politicalExplicitnessScore).toBe(0);
  });

  it('boost score pour un média connu (mediapart)', () => {
    const result = applyRules({
      normalizedText: 'Nouvelle enquête exclusive',
      hashtags: [],
      username: 'mediapart',
    });
    expect(result.politicalExplicitnessScore).toBeGreaterThanOrEqual(2);
  });
});
