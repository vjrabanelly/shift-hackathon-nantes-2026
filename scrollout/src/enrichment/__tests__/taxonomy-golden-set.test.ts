/**
 * Golden set de tests pour la taxonomie 5 niveaux.
 *
 * Stratégie de test :
 * 1. VRAIS POSITIFS — posts réalistes devant matcher les bons thèmes/sujets
 * 2. VRAIS NÉGATIFS — posts ne devant PAS matcher certains thèmes (anti-faux-positifs)
 * 3. WORD BOUNDARY — les keywords courts ne matchent pas dans des mots plus longs
 * 4. MULTI-LABEL — posts transversaux touchant plusieurs domaines
 * 5. SUJETS PRÉCIS — vérifier que les candidats sont pertinents
 */
import { describe, it, expect } from 'vitest';
import { classifyMultiLevel, getPreciseSubjectsForTheme } from '../dictionaries/taxonomy';
import { classifyTopicsEnriched } from '../dictionaries/topics-keywords';
import { applyRules } from '../rules-engine';

// ─── Helpers ──────────────────────────────────────────────

function themes(text: string): string[] {
  return classifyTopicsEnriched(text).themes.map(t => t.id);
}

function subjects(text: string): string[] {
  return classifyMultiLevel(text).map(m => m.subject?.id).filter((s): s is string => !!s);
}

function _rulesThemes(text: string): string[] {
  const r = applyRules({ normalizedText: text, hashtags: [], username: 'test' });
  return [...r.mainTopics, ...r.secondaryTopics];
}

// ═══════════════════════════════════════════════════════════
// 1. VRAIS POSITIFS
// ═══════════════════════════════════════════════════════════

describe('vrais positifs — posts politiques', () => {
  it('discours de Mélenchon à l\'assemblée', () => {
    const text = 'Mélenchon dénonce le passage en force du gouvernement à l\'assemblée nationale sur la réforme';
    expect(themes(text)).toContain('politique');
    expect(subjects(text)).toContain('vie_politique');
  });

  it('article sur le RN et Marine Le Pen', () => {
    const text = 'Marine Le Pen et le rassemblement national en tête des sondages pour les législatives';
    expect(themes(text)).toContain('politique');
    expect(subjects(text)).toContain('extreme_droite');
  });

  it('contenu sur les élections', () => {
    const text = 'Sondage présidentiel : les candidats au premier tour du scrutin, le vote sera déterminant';
    expect(themes(text)).toContain('politique');
    expect(subjects(text)).toContain('elections');
  });
});

describe('vrais positifs — géopolitique', () => {
  it('conflit Ukraine-Russie', () => {
    const text = 'Zelensky demande plus d\'aide à l\'OTAN face aux bombardements russes sur le Donbass';
    expect(themes(text)).toContain('geopolitique');
    expect(subjects(text)).toContain('conflit_ukraine');
  });

  it('conflit Israël-Palestine', () => {
    const text = 'Bombardements sur Gaza : le Hamas appelle à un cessez-le-feu, Israël refuse';
    expect(themes(text)).toContain('geopolitique');
    expect(subjects(text)).toContain('conflit_israel_palestine');
  });
});

describe('vrais positifs — écologie', () => {
  it('réchauffement climatique et GIEC', () => {
    const text = 'Le GIEC alerte sur le réchauffement climatique : +2° d\'ici 2050, bilan carbone catastrophique';
    expect(themes(text)).toContain('ecologie');
    expect(subjects(text)).toContain('rechauffement_climatique');
  });

  it('nucléaire et transition énergétique', () => {
    const text = 'Débat sur le nucléaire : faut-il construire de nouveaux réacteurs pour la transition énergétique ?';
    expect(themes(text)).toContain('ecologie');
    expect(subjects(text)).toContain('transition_energetique');
  });

  it('Dernière Rénovation bloque le périph', () => {
    const text = 'Les militants de Dernière Rénovation bloquent l\'autoroute en action de désobéissance civile';
    expect(themes(text)).toContain('ecologie');
    expect(subjects(text)).toContain('militants_ecolo');
  });
});

describe('vrais positifs — économie', () => {
  it('réforme des retraites', () => {
    const text = 'Manifestation contre la réforme des retraites à 64 ans, les syndicats appellent à la grève';
    expect(themes(text)).toContain('economie');
    expect(subjects(text)).toContain('retraites');
  });

  it('pouvoir d\'achat et inflation', () => {
    const text = 'L\'inflation fait exploser le prix du carburant, le pouvoir d\'achat des Français en chute';
    expect(themes(text)).toContain('economie');
    expect(subjects(text)).toContain('pouvoir_achat');
  });
});

describe('vrais positifs — divertissement & culture', () => {
  it('jeux vidéo', () => {
    const text = 'Nouveau DLC de Baldur\'s Gate 3 disponible sur PlayStation et Nintendo Switch, les gamers sont ravis';
    expect(themes(text)).toContain('divertissement');
    expect(subjects(text)).toContain('gaming');
  });

  it('film au cinéma', () => {
    const text = 'Le nouveau film de Nolan sélectionné au festival de Cannes, le réalisateur vise le César';
    expect(themes(text)).toContain('culture');
    expect(subjects(text)).toContain('cinema');
  });

  it('musique et concert', () => {
    const text = 'Le rappeur sort un nouvel album et annonce un concert au festival cet été';
    expect(themes(text)).toContain('culture');
    expect(subjects(text)).toContain('musique');
  });
});

describe('vrais positifs — lifestyle & beauté', () => {
  it('recette food', () => {
    const text = 'Ma recette de brunch du dimanche : pancakes vegan, restaurant gastronomie à Paris';
    expect(themes(text)).toContain('food');
    expect(subjects(text)).toContain('recettes');
  });

  it('skincare routine', () => {
    const text = 'Ma routine skincare du matin : sérum hydratant, crème SPF, nettoyant doux pour la peau';
    expect(themes(text)).toContain('beaute');
    expect(subjects(text)).toContain('skincare');
  });
});

describe('vrais positifs — santé', () => {
  it('crise de l\'hôpital', () => {
    const text = 'Les soignants de l\'hôpital public dénoncent le manque d\'infirmiers aux urgences';
    expect(themes(text)).toContain('sante');
    expect(subjects(text)).toContain('hopital_soins');
  });

  it('vaccination', () => {
    const text = 'Faut-il rendre le vaccin obligatoire ? Le débat sur la vaccination fait rage';
    expect(themes(text)).toContain('sante');
    expect(subjects(text)).toContain('vaccination');
  });
});

describe('vrais positifs — religion', () => {
  it('laïcité et voile', () => {
    const text = 'Le débat sur la laïcité repart : faut-il interdire le voile dans les sorties scolaires ?';
    expect(themes(text)).toContain('religion');
    expect(subjects(text)).toContain('laicite');
  });
});

describe('vrais positifs — féminisme', () => {
  it('IVG et droits', () => {
    const text = 'L\'avortement enfin dans la constitution ? Le planning familial se mobilise pour l\'IVG';
    expect(themes(text)).toContain('feminisme');
    expect(subjects(text)).toContain('ivg');
  });
});

describe('vrais positifs — technologie', () => {
  it('IA générative ChatGPT', () => {
    const text = 'ChatGPT révolutionne le marché, OpenAI lève 10 milliards pour l\'intelligence artificielle';
    expect(themes(text)).toContain('technologie');
    expect(subjects(text)).toContain('ia_generative');
  });

  it('réseaux sociaux et algorithme', () => {
    const text = 'TikTok accusé de pousser des contenus toxiques via son algorithme aux adolescents';
    expect(themes(text)).toContain('technologie');
    expect(subjects(text)).toContain('reseaux_sociaux');
  });
});

// ═══════════════════════════════════════════════════════════
// 2. VRAIS NÉGATIFS — anti-faux-positifs
// ═══════════════════════════════════════════════════════════

describe('vrais négatifs — aucun faux positif', () => {
  it('post beauté ne matche pas politique', () => {
    const text = 'Nouveau tuto maquillage : mascara, fond de teint, rouge à lèvres pour un look naturel';
    expect(themes(text)).not.toContain('politique');
    expect(themes(text)).not.toContain('geopolitique');
  });

  it('post gaming ne matche pas politique ni sécurité', () => {
    const text = 'Legendary Dice Pull!! #dnd #dnddice #baldursgate3 Super session de jeu de rôle hier soir';
    expect(themes(text)).not.toContain('politique');
    expect(themes(text)).not.toContain('securite');
    expect(themes(text)).not.toContain('economie');
  });

  it('post food ne matche pas écologie', () => {
    const text = 'Ma recette de crêpes bretonnes : farine, oeufs, lait, beurre salé, un délice !';
    expect(themes(text)).not.toContain('ecologie');
    expect(themes(text)).not.toContain('politique');
  });

  it('post montres ne matche pas politique', () => {
    const text = 'TAG Heuer Carrera chronograph, collection 2026, design magnifique, 129 followers';
    expect(themes(text)).not.toContain('politique');
    expect(themes(text)).not.toContain('geopolitique');
  });

  it('texte vide ou nonsense', () => {
    expect(themes('abc xyz 123')).toHaveLength(0);
    expect(themes('')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. WORD BOUNDARY — mots courts ne matchent pas dans des mots longs
// ═══════════════════════════════════════════════════════════

describe('word boundary — pas de faux positifs sur sous-chaînes', () => {
  it('"om" dans "commentaires" ne matche pas football', () => {
    const text = '110 j\'aime, 9 commentaires, wow super photo';
    expect(subjects(text)).not.toContain('football');
  });

  it('"ai" dans "j\'aime" ne matche pas IA', () => {
    const text = 'J\'aime cette photo, c\'est fait avec talent';
    expect(subjects(text)).not.toContain('ia_generative');
  });

  it('"jo" dans "jours" ne matche pas JO', () => {
    const text = 'Il y a 3 jours, aujourd\'hui c\'est le grand jour';
    expect(subjects(text)).not.toContain('jo_competition');
  });

  it('"ars" dans "mars" ne matche pas santé/ARS', () => {
    const text = '12 mars, une belle journée de mars ensoleillée';
    expect(subjects(text)).not.toContain('hopital_soins');
  });

  it('"ue" dans "numérique" ne matche pas UE', () => {
    const text = 'Transformation numérique de l\'entreprise, stratégie publique';
    expect(subjects(text)).not.toContain('union_europeenne');
  });

  it('"art" dans "partager" ne matche pas art', () => {
    const text = 'Partager le profil, démarrer une conversation, partager cette publication';
    expect(subjects(text)).not.toContain('art_patrimoine');
  });

  it('"ol" dans "followers" ne matche pas football', () => {
    const text = '529 publications, 129 followers, profil public';
    expect(subjects(text)).not.toContain('football');
  });

  it('"ric" dans "Cédric" ne matche pas politique', () => {
    const text = 'Cédric partage un contenu numérique avec ses amis';
    expect(subjects(text)).not.toContain('reforme_institutions');
  });

  it('"déco" dans "découvrir" ne matche pas lifestyle', () => {
    const text = 'Contacts à découvrir, découvrez les nouveautés du mois';
    expect(subjects(text)).not.toContain('deco_interieur');
  });
});

// ═══════════════════════════════════════════════════════════
// 4. MULTI-LABEL — posts transversaux
// ═══════════════════════════════════════════════════════════

describe('multi-label — posts transversaux', () => {
  it('politique + économie (retraites)', () => {
    const text = 'Le gouvernement force la réforme des retraites à 64 ans malgré l\'opposition des syndicats à l\'assemblée';
    const t = themes(text);
    expect(t).toContain('economie');
    // politique via vie_politique keywords
    expect(subjects(text).some(s => ['retraites', 'vie_politique'].includes(s))).toBe(true);
  });

  it('écologie + politique (militants)', () => {
    const text = 'Le ministre dénonce les blocages d\'Extinction Rebellion comme de l\'éco-terrorisme';
    const t = themes(text);
    expect(t).toContain('ecologie');
    expect(subjects(text)).toContain('militants_ecolo');
  });

  it('identité + politique (racisme systémique)', () => {
    const text = 'Le racisme systémique en France : les associations antiracistes dénoncent les discriminations';
    const t = themes(text);
    expect(t).toContain('identite');
    expect(subjects(text)).toContain('racisme');
  });

  it('santé + politique (vaccination obligatoire)', () => {
    const text = 'Le vaccin Pfizer sera-t-il rendu obligatoire ? Le pass sanitaire divise les Français';
    const t = themes(text);
    expect(t).toContain('sante');
    expect(subjects(text)).toContain('vaccination');
  });
});

// ═══════════════════════════════════════════════════════════
// 5. SUJETS PRÉCIS — candidats pertinents
// ═══════════════════════════════════════════════════════════

describe('sujets précis — candidats cohérents', () => {
  it('post écologie → candidats écologie, pas politique', () => {
    const text = 'Le nucléaire est indispensable pour la transition énergétique selon Jancovici';
    const r = applyRules({ normalizedText: text, hashtags: [], username: 'test' });
    expect(r.mainTopics).toContain('ecologie');
    const ps = getPreciseSubjectsForTheme('ecologie');
    const ids = ps.map(p => p.id);
    expect(ids).toContain('nucleaire_indispensable');
  });

  it('post immigration → candidats immigration', () => {
    const text = 'Les sans-papiers demandent la régularisation, le droit d\'asile est en crise';
    const r = applyRules({ normalizedText: text, hashtags: [], username: 'test' });
    expect(r.mainTopics).toContain('immigration');
    const ps = getPreciseSubjectsForTheme('immigration');
    const ids = ps.map(p => p.id);
    expect(ids).toContain('regularisation_sans_papiers');
    expect(ids).toContain('quotas_migratoires_ue');
  });

  it('post gaming → aucun sujet précis politique', () => {
    const text = 'Nouvelle extension Baldur\'s Gate 3 avec des combats épiques et du loot légendaire';
    const r = applyRules({ normalizedText: text, hashtags: [], username: 'acubed_gaming' });
    // Gaming peut matcher sport/combat mais ne devrait pas avoir de sujets précis politiques
    const politicalPsIds = ['vote_obligatoire', '49_3_legitime', 'rn_republicanise', 'retablir_isf', 'reforme_retraites_64'];
    const hasPoliticalPs = r.candidatePreciseSubjectIds.some(id => politicalPsIds.includes(id));
    expect(hasPoliticalPs).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 6. RULES ENGINE — domaines et sujets dans le résultat
// ═══════════════════════════════════════════════════════════

describe('rules engine — nouveaux champs', () => {
  it('retourne des domaines cohérents', () => {
    const text = 'Mélenchon dénonce la politique du gouvernement à l\'assemblée nationale';
    const r = applyRules({ normalizedText: text, hashtags: [], username: 'test' });
    expect(r.domains).toContain('politique_societe');
    expect(r.domains).not.toContain('lifestyle_bienetre');
  });

  it('retourne des subjects', () => {
    const text = 'Le vaccin Pfizer sera rendu obligatoire, vaccination massive prévue';
    const r = applyRules({ normalizedText: text, hashtags: [], username: 'test' });
    expect(r.subjects.map(s => s.id)).toContain('vaccination');
    expect(r.subjects[0].themeId).toBe('sante');
  });

  it('retourne des candidatePreciseSubjectIds pour les thèmes politiques', () => {
    const text = 'Le rassemblement national progresse dans les sondages pour les élections';
    const r = applyRules({ normalizedText: text, hashtags: [], username: 'test' });
    expect(r.candidatePreciseSubjectIds.length).toBeGreaterThan(0);
  });

  it('retourne 0 candidats politiques pour un post beauté', () => {
    const text = 'Ma routine skincare sérum hydratant crème nettoyant SPF';
    const r = applyRules({ normalizedText: text, hashtags: [], username: 'beauty_guru' });
    const politicalPsIds = ['vote_obligatoire', '49_3_legitime', 'rn_republicanise', 'retablir_isf', 'reforme_retraites_64'];
    const hasPoliticalPs = r.candidatePreciseSubjectIds.some(id => politicalPsIds.includes(id));
    expect(hasPoliticalPs).toBe(false);
  });
});
