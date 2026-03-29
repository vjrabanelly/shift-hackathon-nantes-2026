(function() {
  'use strict';

  // ============================================================================
  // TOPICS DICTIONARY
  // ============================================================================

  const TOPICS = [
    {
      id: 'actualite',
      label: 'Actualité',
      keywords: ['breaking', 'flash info', 'alerte info', 'dernière minute', 'derniere minute', 'urgent', 'en direct', 'journal', 'jt', 'bfm', 'cnews', 'lci', 'france info', 'franceinfo', 'le monde', 'libération', 'figaro', 'mediapart', 'reuters', 'afp'],
    },
    {
      id: 'politique',
      label: 'Politique',
      keywords: ['élection', 'election', 'vote', 'scrutin', 'candidat', 'député', 'depute', 'sénateur', 'senateur', 'ministre', 'président', 'president', 'loi', 'projet de loi', 'réforme', 'reforme', 'parlement', 'politique', 'campagne'],
    },
    {
      id: 'geopolitique',
      label: 'Géopolitique',
      keywords: ['géopolitique', 'geopolitique', 'diplomatie', 'conflit', 'guerre', 'traité', 'traite', 'sanctions', 'embargo', 'otan', 'nato', 'onu', 'union européenne', 'moyen-orient', 'moyen orient', 'ukraine', 'russie', 'chine', 'usa', 'états-unis', 'etats-unis'],
    },
    {
      id: 'economie',
      label: 'Économie',
      keywords: ['économie', 'economie', 'inflation', 'bourse', 'cac40', 'pib', 'chômage', 'chomage', 'emploi', 'salaire', 'smic', 'pouvoir d\'achat', 'pouvoir dachat', 'croissance', 'récession', 'recession', 'dette', 'budget', 'impôt', 'impot', 'taxe', 'fiscal'],
    },
    {
      id: 'ecologie',
      label: 'Écologie',
      keywords: ['écologie', 'ecologie', 'climat', 'climatique', 'réchauffement', 'rechauffement', 'co2', 'carbone', 'renouvelable', 'biodiversité', 'biodiversite', 'pollution', 'plastique', 'déforestation', 'deforestation', 'environnement', 'giec', 'cop', 'vert', 'durable'],
    },
    {
      id: 'immigration',
      label: 'Immigration',
      keywords: ['immigration', 'immigré', 'immigre', 'migrant', 'migrants', 'réfugié', 'refugie', 'asile', 'frontière', 'frontiere', 'clandestin', 'sans-papiers', 'sans papiers', 'expulsion', 'régularisation', 'regularisation', 'oqtf', 'lampedusa', 'calais'],
    },
    {
      id: 'securite',
      label: 'Sécurité',
      keywords: ['sécurité', 'securite', 'police', 'gendarmerie', 'délinquance', 'delinquance', 'criminalité', 'criminalite', 'agression', 'vol', 'cambriolage', 'terrorisme', 'attentat', 'vidéosurveillance', 'prison', 'garde à vue', 'interpellation'],
    },
    {
      id: 'justice',
      label: 'Justice',
      keywords: ['justice', 'tribunal', 'procès', 'proces', 'condamnation', 'acquittement', 'avocat', 'magistrat', 'juge', 'peine', 'amende', 'prison', 'détention', 'detention', 'plainte', 'garde à vue', 'instruction', 'parquet', 'cour d\'appel'],
    },
    {
      id: 'sante',
      label: 'Santé',
      keywords: ['santé', 'sante', 'hôpital', 'hopital', 'médecin', 'medecin', 'soignant', 'infirmier', 'vaccin', 'vaccination', 'covid', 'maladie', 'épidémie', 'epidemie', 'urgences', 'sécurité sociale', 'securite sociale', 'médicament', 'medicament', 'ars'],
    },
    {
      id: 'religion',
      label: 'Religion',
      keywords: ['religion', 'religieux', 'islam', 'musulman', 'chrétien', 'chretien', 'catholique', 'juif', 'judaïsme', 'judaisme', 'laïcité', 'laicite', 'voile', 'mosquée', 'mosquee', 'église', 'eglise', 'synagogue', 'ramadan', 'prière', 'priere', 'dieu', 'allah', 'bible', 'coran'],
    },
    {
      id: 'education',
      label: 'Éducation',
      keywords: ['éducation', 'education', 'école', 'ecole', 'lycée', 'lycee', 'collège', 'college', 'université', 'universite', 'professeur', 'enseignant', 'bac', 'baccalauréat', 'baccalaureat', 'parcoursup', 'étudiant', 'etudiant', 'rentrée', 'rentree', 'programme scolaire'],
    },
    {
      id: 'culture',
      label: 'Culture',
      keywords: ['culture', 'art', 'musée', 'musee', 'exposition', 'cinéma', 'cinema', 'film', 'série', 'serie', 'livre', 'littérature', 'litterature', 'théâtre', 'theatre', 'concert', 'festival', 'patrimoine', 'artiste', 'œuvre', 'oeuvre'],
    },
    {
      id: 'humour',
      label: 'Humour',
      keywords: ['mdr', 'ptdr', 'lol', 'humour', 'blague', 'sketch', 'parodie', 'satire', 'drôle', 'drole', 'hilarant', 'mort de rire', 'troll', 'ironie', 'meme', 'mème', 'shitpost'],
    },
    {
      id: 'divertissement',
      label: 'Divertissement',
      keywords: ['divertissement', 'entertainment', 'tv', 'télé', 'tele', 'émission', 'emission', 'téléréalité', 'telerealite', 'reality', 'people', 'célébrité', 'celebrite', 'star', 'buzz', 'viral', 'trend', 'tendance', 'challenge'],
    },
    {
      id: 'lifestyle',
      label: 'Lifestyle',
      keywords: ['lifestyle', 'mode de vie', 'routine', 'morning routine', 'organisation', 'productivité', 'productivite', 'minimalisme', 'slow life', 'bien-être', 'bien etre', 'bienetre', 'self care', 'selfcare', 'cocooning', 'home', 'déco', 'deco', 'intérieur', 'interieur'],
    },
    {
      id: 'beaute',
      label: 'Beauté',
      keywords: ['beauté', 'beaute', 'maquillage', 'makeup', 'skincare', 'soin', 'crème', 'creme', 'sérum', 'serum', 'mascara', 'rouge à lèvres', 'foundation', 'fond de teint', 'coiffure', 'cheveux', 'ongles', 'nails', 'glow', 'tutorial', 'tuto'],
    },
    {
      id: 'sport',
      label: 'Sport',
      keywords: ['sport', 'foot', 'football', 'rugby', 'tennis', 'basket', 'nba', 'ligue 1', 'champions league', 'psg', 'om', 'match', 'goal', 'but', 'joueur', 'athlète', 'athlete', 'musculation', 'fitness', 'crossfit', 'running', 'marathon', 'jeux olympiques'],
    },
    {
      id: 'business',
      label: 'Business',
      keywords: ['business', 'entrepreneur', 'startup', 'entreprise', 'investissement', 'crypto', 'bitcoin', 'trading', 'freelance', 'revenus', 'passifs', 'formation', 'coaching', 'mindset', 'succès', 'succes', 'hustle', 'dropshipping', 'e-commerce', 'ecommerce'],
    },
    {
      id: 'developpement_personnel',
      label: 'Développement personnel',
      keywords: ['développement personnel', 'developpement personnel', 'motivation', 'confiance en soi', 'méditation', 'meditation', 'pleine conscience', 'mindfulness', 'gratitude', 'affirmation', 'loi d\'attraction', 'manifestation', 'croissance personnelle', 'résilience', 'resilience', 'stoïcisme', 'stoicisme'],
    },
    {
      id: 'technologie',
      label: 'Technologie',
      keywords: ['technologie', 'tech', 'ia', 'intelligence artificielle', 'ai', 'chatgpt', 'openai', 'robot', 'smartphone', 'iphone', 'android', 'apple', 'google', 'meta', 'microsoft', 'app', 'application', 'algorithme', 'data', 'cloud', 'cyber'],
    },
    {
      id: 'feminisme',
      label: 'Féminisme',
      keywords: ['féminisme', 'feminisme', 'féministe', 'feministe', 'patriarcat', 'sexisme', 'sexiste', 'misogynie', 'inégalité', 'inegalite', 'genre', 'droit des femmes', 'empowerment', 'sororité', 'sororite', 'charge mentale', 'harcèlement', 'harcelement', 'consentement', 'metoo'],
    },
    {
      id: 'masculinite',
      label: 'Masculinité',
      keywords: ['masculinité', 'masculinite', 'virilité', 'virilite', 'red pill', 'redpill', 'alpha', 'sigma', 'grindset', 'andrew tate', 'tate', 'mgtow', 'manosphere', 'masculinisme', 'homme moderne', 'high value', 'stoïque', 'stoique', 'discipline'],
    },
    {
      id: 'identite',
      label: 'Identité',
      keywords: ['identité', 'identite', 'identitaire', 'communauté', 'communaute', 'diaspora', 'racines', 'origine', 'culture', 'tradition', 'fierté', 'fierte', 'appartenance', 'représentation', 'representation', 'visibilité', 'visibilite', 'minorité', 'minorite', 'lgbtq', 'queer', 'transgenre', 'non-binaire'],
    },
    {
      id: 'societe',
      label: 'Société',
      keywords: ['société', 'societe', 'social', 'solidarité', 'solidarite', 'précarité', 'precarite', 'pauvreté', 'pauvrete', 'inégalités', 'inegalites', 'classe moyenne', 'banlieue', 'quartier', 'discrimination', 'intégration', 'integration', 'vivre ensemble', 'lien social', 'fracture sociale'],
    },
  ];

  function classifyTopics(text) {
    const lower = text.toLowerCase();
    const results = [];
    for (const topic of TOPICS) {
      const matchCount = topic.keywords.filter(kw => lower.includes(kw)).length;
      if (matchCount > 0) {
        results.push({ id: topic.id, label: topic.label, matchCount });
      }
    }
    return results.sort((a, b) => b.matchCount - a.matchCount);
  }

  // ============================================================================
  // POLITICAL ACTORS DICTIONARY
  // ============================================================================

  const POLITICAL_PARTIES = new Set([
    'lfi', 'la france insoumise', 'france insoumise', 'npa', 'nouveau parti anticapitaliste',
    'pcf', 'parti communiste', 'eelv', 'europe écologie', 'les verts',
    'ps', 'parti socialiste', 'place publique', 'génération.s', 'générations',
    'renaissance', 'lrem', 'en marche', 'la république en marche', 'modem',
    'mouvement démocrate', 'horizons', 'edouard philippe',
    'lr', 'les républicains', 'républicains', 'ump',
    'rn', 'rassemblement national', 'front national', 'fn', 'reconquête', 'reconquete',
    'zemmour', 'patriotes', 'les patriotes',
    'lutte ouvrière', 'lutte ouvriere', 'debout la france', 'dlf',
  ]);

  const POLITICAL_FIGURES = new Set([
    'macron', 'emmanuel macron', 'borne', 'attal', 'bayrou',
    'mélenchon', 'melenchon', 'ruffin', 'panot', 'autain', 'roussel',
    'jadot', 'tondelier', 'hidalgo', 'glucksmann',
    'retailleau', 'wauquiez', 'ciotti', 'pécresse', 'sarkozy',
    'le pen', 'marine le pen', 'bardella', 'zemmour', 'maréchal',
    'philippe', 'edouard philippe', 'dupont-moretti', 'darmanin',
  ]);

  const INSTITUTIONS = new Set([
    'assemblée nationale', 'assemblee nationale', 'sénat', 'senat',
    'élysée', 'elysee', 'matignon', 'gouvernement',
    'conseil constitutionnel', 'conseil d\'état', 'conseil detat',
    'parlement', 'parlement européen', 'commission européenne',
    'onu', 'otan', 'nato', 'g7', 'g20',
    'préfecture', 'prefecture', 'mairie', 'conseil municipal',
    'conseil régional', 'conseil départemental',
    'cour des comptes', 'défenseur des droits',
    'cnil', 'arcom', 'autorité de la concurrence',
  ]);

  const ACTIVISM_TERMS = new Set([
    'manifestation', 'manif', 'grève', 'greve', 'blocage',
    'pétition', 'petition', 'mobilisation', 'rassemblement',
    'boycott', 'boycotter', 'occupation', 'sit-in',
    'désobéissance civile', 'desobeissance civile',
    'collectif', 'mouvement social', 'lutte',
    'militant', 'militante', 'militants', 'militantes',
    'activiste', 'activistes', 'engagement citoyen',
  ]);

  const SHORT_TERMS = new Set(['lfi', 'npa', 'pcf', 'eelv', 'ps', 'lr', 'rn', 'fn', 'dlf']);

  function termPresent(text, term) {
    if (term.length <= 3 || SHORT_TERMS.has(term)) {
      const regex = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      return regex.test(text);
    }
    return text.includes(term);
  }

  function detectPoliticalActors(text) {
    const lower = text.toLowerCase();
    const parties = Array.from(POLITICAL_PARTIES).filter(p => termPresent(lower, p));
    const figures = Array.from(POLITICAL_FIGURES).filter(f => termPresent(lower, f));
    const institutions = Array.from(INSTITUTIONS).filter(i => termPresent(lower, i));
    const activismTerms = Array.from(ACTIVISM_TERMS).filter(a => termPresent(lower, a));
    return { parties, figures, institutions, activismTerms };
  }

  // ============================================================================
  // POLITICAL ACCOUNTS DICTIONARY
  // ============================================================================

  const POLITICAL_ACCOUNTS = new Map([
    ['mathildelarrere', { minPoliticalScore: 3, tags: ['histoire', 'politique', 'gauche'] }],
    ['music.politique', { minPoliticalScore: 3, tags: ['politique', 'culture'] }],
    ['mediapart', { minPoliticalScore: 2, tags: ['politique', 'investigation'] }],
    ['braborian', { minPoliticalScore: 2, tags: ['politique', 'dessin'] }],
    ['lemondefr', { minPoliticalScore: 2, tags: ['actualites', 'politique'] }],
    ['liberation', { minPoliticalScore: 2, tags: ['actualites', 'politique'] }],
    ['lefigarofr', { minPoliticalScore: 2, tags: ['actualites', 'politique'] }],
    ['france.inter', { minPoliticalScore: 1, tags: ['actualites', 'culture'] }],
    ['franceinfo', { minPoliticalScore: 2, tags: ['actualites'] }],
    ['hugodecrypte', { minPoliticalScore: 2, tags: ['actualites', 'vulgarisation'] }],
    ['blast_info', { minPoliticalScore: 3, tags: ['politique', 'investigation'] }],
    ['off.investigation', { minPoliticalScore: 3, tags: ['politique', 'investigation'] }],
    ['emmanuelmacron', { minPoliticalScore: 3, tags: ['politique', 'executif'] }],
    ['jabordelern', { minPoliticalScore: 3, tags: ['politique', 'lfi'] }],
    ['marinelepen', { minPoliticalScore: 3, tags: ['politique', 'rn'] }],
    ['jordanbardella', { minPoliticalScore: 3, tags: ['politique', 'rn'] }],
    ['rapabordelern', { minPoliticalScore: 3, tags: ['politique', 'lfi'] }],
    ['jlmelenchon', { minPoliticalScore: 3, tags: ['politique', 'lfi'] }],
    ['marabordelern', { minPoliticalScore: 3, tags: ['politique', 'lfi'] }],
    ['sandrine_rousseau', { minPoliticalScore: 3, tags: ['politique', 'ecologie'] }],
    ['marinetondelier', { minPoliticalScore: 3, tags: ['politique', 'eelv'] }],
    ['attabordelern', { minPoliticalScore: 3, tags: ['politique', 'association'] }],
    ['greenpeacefr', { minPoliticalScore: 2, tags: ['ecologie', 'militantisme'] }],
    ['amnestyfrance', { minPoliticalScore: 2, tags: ['droits-humains'] }],
    ['oxfamfrance', { minPoliticalScore: 2, tags: ['justice-sociale'] }],
    ['reporterssf', { minPoliticalScore: 2, tags: ['liberte-presse'] }],
  ]);

  function detectPoliticalAccount(username) {
    return POLITICAL_ACCOUNTS.get(username.toLowerCase()) || null;
  }

  // ============================================================================
  // POLITICAL AXES DICTIONARY
  // ============================================================================

  const ECONOMIC_LEFT = [
    'redistribution', 'justice sociale', 'service public', 'services publics',
    'nationalisation', 'nationaliser', 'bien commun', 'biens communs',
    'état providence', 'etat providence', 'protection sociale',
    'smic', 'augmentation des salaires', 'hausse des salaires',
    'taxer les riches', 'impôt sur la fortune', 'isf', 'egalité salariale',
    'anticapitalisme', 'anticapitaliste', 'exploitation',
    'précarité', 'precarite', 'travailleurs', 'classe ouvrière', 'classe ouvriere',
    'gratuité', 'gratuite', 'droit au logement', 'retraite à 60',
    'sécurité sociale', 'securite sociale', 'cotisations',
    'pouvoir d\'achat', 'pouvoir d achat', 'vie chère', 'vie chere',
    'lutte des classes', 'prolétariat', 'proletariat',
    'coopérative', 'cooperative', 'mutualisme', 'économie solidaire',
  ];

  const ECONOMIC_RIGHT = [
    'libre entreprise', 'entrepreneuriat', 'compétitivité', 'competitivite',
    'libéralisme', 'liberalisme', 'libéral', 'liberal',
    'privatisation', 'privatiser', 'dérégulation', 'deregulation',
    'baisse des impôts', 'baisser les impôts', 'trop d\'impôts',
    'charges sociales', 'alléger les charges', 'simplification',
    'croissance', 'pib', 'attractivité', 'attractivite',
    'start-up nation', 'startup', 'innovation',
    'mérite', 'merite', 'méritocratie', 'meritocratie',
    'dette publique', 'déficit', 'deficit', 'rigueur budgétaire',
    'réforme des retraites', 'reforme des retraites', 'travailler plus',
    'flexibilité', 'flexibilite', 'marché du travail', 'marche du travail',
    'auto-entrepreneur', 'initiative privée', 'libre échange',
  ];

  const SOCIETAL_PROGRESSIVE = [
    'mariage pour tous', 'mariage homosexuel', 'homoparentalité',
    'droits lgbt', 'lgbtqia', 'pride', 'fierté', 'fierte',
    'transidentité', 'transidentite', 'non-binaire',
    'pma pour toutes', 'pma', 'gpa', 'ivg', 'droit à l\'avortement',
    'féminisme', 'feminisme', 'féministe', 'feministe',
    'égalité femmes hommes', 'egalite femmes hommes', 'parité', 'parite',
    'antiracisme', 'antiraciste', 'décolonial', 'decolonial',
    'intersectionnalité', 'intersectionnalite',
    'inclusion', 'inclusif', 'inclusive', 'diversité', 'diversite',
    'multiculturalisme', 'vivre ensemble',
    'dépénalisation', 'depenalisation', 'cannabis', 'légalisation',
    'laïcité ouverte', 'laicite ouverte',
    'euthanasie', 'fin de vie', 'droit de mourir',
    'écriture inclusive', 'ecriture inclusive',
  ];

  const SOCIETAL_CONSERVATIVE = [
    'valeurs traditionnelles', 'tradition', 'traditions',
    'famille traditionnelle', 'cellule familiale',
    'natalité', 'natalite', 'politique nataliste',
    'manif pour tous', 'manifpourtous',
    'anti-ivg', 'pro-vie', 'provie',
    'identité nationale', 'identite nationale', 'identité française',
    'racines', 'héritage', 'heritage', 'patrimoine culturel',
    'civilisation', 'civilisationnel', 'judéo-chrétien', 'chrétienté',
    'ordre moral', 'déclin moral', 'declin moral',
    'décadence', 'decadence', 'dégénérescence',
    'communautarisme', 'communautariste',
    'wokisme', 'woke', 'anti-woke', 'cancel culture',
    'théorie du genre', 'theorie du genre', 'idéologie du genre',
    'grand remplacement', 'remigration', 'assimilation',
    'autorité parentale', 'autorite parentale',
  ];

  const LIBERTARIAN = [
    'liberté d\'expression', 'liberte d expression', 'liberté de la presse',
    'libertés individuelles', 'libertes individuelles',
    'vie privée', 'vie privee', 'surveillance de masse',
    'anti-surveillance', 'big brother', 'état policier', 'etat policier',
    'désobéissance civile', 'desobeissance civile',
    'droit de manifester', 'liberté de réunion',
    'censure', 'anti-censure', 'liberté d\'opinion',
    'autodétermination', 'autodetermination', 'autonomie',
    'décentralisation', 'decentralisation',
    'anarchisme', 'anarchiste', 'autogestion',
    'libertaire', 'libertarien',
    'données personnelles', 'donnees personnelles', 'rgpd', 'cnil',
    'lanceur d\'alerte', 'lanceur d alerte', 'whistleblower',
  ];

  const AUTHORITARIAN = [
    'ordre', 'ordre public', 'rétablir l\'ordre', 'retablir l ordre',
    'autorité', 'autorite', 'autorité de l\'état', 'fermeté', 'fermete',
    'tolérance zéro', 'tolerance zero', 'main forte',
    'sécurité', 'securite', 'sécuritaire', 'securitaire',
    'police', 'forces de l\'ordre', 'forces de l ordre', 'gendarmerie',
    'vidéosurveillance', 'videosurveillance', 'caméras',
    'peines plancher', 'prison', 'incarcération', 'incarceration',
    'expulsion', 'expulser', 'oqtf', 'reconduite à la frontière',
    'déchéance de nationalité', 'decheance de nationalite',
    'état d\'urgence', 'etat d urgence', 'couvre-feu',
    'contrôle aux frontières', 'controle aux frontieres',
    'interdiction', 'interdire', 'réprimer', 'reprimer',
    'souveraineté', 'souverainete', 'souverainisme',
    'armée', 'armee', 'service militaire', 'service national',
  ];

  const ANTI_SYSTEM = [
    'système', 'systeme', 'anti-système', 'anti-systeme', 'antisystème',
    'oligarchie', 'ploutocratie', 'les élites', 'les elites',
    'caste', 'les puissants', 'les corrompus', 'corruption',
    'ils nous mentent', 'on nous ment', 'médias mainstream', 'medias mainstream',
    'désinformation', 'desinformation', 'propagande',
    'révolution', 'revolution', 'insurrection', 'soulèvement',
    'dégagisme', 'degagisme', 'tous pourris', 'bande de',
    'démocratie directe', 'democratie directe', 'ric', 'référendum',
    'sixième république', 'sixieme republique',
    'constituante', 'assemblée constituante',
    'abstention', 'vote blanc', 'boycott électoral',
    'dégage', 'degage', 'qu\'ils partent', 'dehors',
    'complot', 'conspiration', 'face cachée',
  ];

  const INSTITUTIONAL = [
    'réforme', 'reforme', 'réformer', 'reformer',
    'dialogue social', 'concertation', 'négociation', 'negociation',
    'consensus', 'compromis', 'modération', 'moderation',
    'institutions', 'institutionnel', 'républicain', 'republicain',
    'état de droit', 'etat de droit', 'constitution',
    'démocratie représentative', 'democratie representative',
    'élections', 'elections', 'vote', 'voter', 'bulletin',
    'parlement', 'parlementaire', 'débat parlementaire',
    'loi', 'projet de loi', 'proposition de loi', 'amendement',
    'commission', 'commission parlementaire', 'rapport',
    'expertise', 'expert', 'technocratie',
    'europe', 'construction européenne', 'construction europeenne',
    'multilatéralisme', 'multilateralisme', 'coopération internationale',
    'stabilité', 'stabilite', 'continuité', 'continuite',
  ];

  const AXES = [
    { name: 'economic', negative: ECONOMIC_LEFT, positive: ECONOMIC_RIGHT },
    { name: 'societal', negative: SOCIETAL_PROGRESSIVE, positive: SOCIETAL_CONSERVATIVE },
    { name: 'authority', negative: LIBERTARIAN, positive: AUTHORITARIAN },
    { name: 'system', negative: ANTI_SYSTEM, positive: INSTITUTIONAL },
  ];

  function detectPoliticalAxes(text) {
    const lower = text.toLowerCase();
    const scores = { economic: 0, societal: 0, authority: 0, system: 0 };
    const matches = {};

    for (const axis of AXES) {
      const negMatches = axis.negative.filter(t => lower.includes(t));
      const posMatches = axis.positive.filter(t => lower.includes(t));
      matches[axis.name] = { negative: negMatches, positive: posMatches };

      const negWeight = Math.min(negMatches.length, 5);
      const posWeight = Math.min(posMatches.length, 5);
      const total = negWeight + posWeight;

      if (total > 0) {
        scores[axis.name] = Math.round(((posWeight - negWeight) / total) * 100) / 100;
      }
    }

    let maxMatches = 0;
    let dominant = null;
    for (const axis of AXES) {
      const total = matches[axis.name].negative.length + matches[axis.name].positive.length;
      if (total > maxMatches) {
        maxMatches = total;
        dominant = axis.name;
      }
    }
    if (maxMatches < 2) dominant = null;

    return { scores, matches, dominant };
  }

  // ============================================================================
  // CONFLICT VOCABULARY DICTIONARY
  // ============================================================================

  const INDIGNATION_TERMS = [
    'scandale', 'scandaleux', 'honteux', 'honte', 'inadmissible', 'inacceptable',
    'intolérable', 'intolerable', 'révoltant', 'revoltant', 'dégueulasse', 'degueulasse',
    'ignoble', 'abject', 'écœurant', 'ecoeurant', 'insupportable',
    'c\'est la honte', 'on en a marre', 'ras le bol', 'ras-le-bol',
    'y en a assez', 'trop c\'est trop', 'jusqu\'à quand', 'jusqua quand',
    'on se fout de nous', 'on nous prend pour des cons',
  ];

  const BINARY_OPPOSITION = [
    'les élites', 'les elites', 'le système', 'le systeme', 'la caste',
    'les puissants', 'les riches', 'les nantis', 'le peuple', 'les gens d\'en haut',
    'eux contre nous', 'nous contre eux', 'les vrais français', 'les vrais francais',
    'la france d\'en bas', 'ces gens-là', 'ces gens la',
    'les mondialistes', 'les bien-pensants', 'la pensée unique', 'la bienpensance',
    'le wokisme', 'woke', 'les wokistes', 'la gauche caviar',
    'les bobos', 'la bourgeoisie',
    'les islamistes', 'les intégristes', 'les collabos',
    'les traîtres', 'les traitres', 'les vendus',
  ];

  const CONFLICT_TERMS = [
    'guerre', 'combat', 'combattre', 'ennemi', 'ennemis', 'adversaire',
    'attaque', 'attaquer', 'détruire', 'destruction', 'envahir', 'invasion',
    'résistance', 'resistance', 'résister', 'se battre', 'se soulever',
    'écraser', 'anéantir', 'éliminer', 'éradiquer', 'purge',
    'trahison', 'complot', 'conspiration', 'manipulation',
  ];

  const MORAL_ABSOLUTE = [
    'le mal absolu', 'le bien contre le mal', 'c\'est criminel',
    'génocide', 'genocide', 'crime contre l\'humanité', 'crime contre l humanite',
    'fascisme', 'fasciste', 'fascistes', 'nazisme', 'nazi', 'nazis',
    'dictature', 'totalitarisme', 'totalitaire',
    'barbarie', 'sauvagerie', 'monstrueux', 'monstrueuse',
    'diabolique', 'maléfique', 'pervers', 'perverse',
    'complice', 'complicité', 'responsable de morts',
    'sang sur les mains',
  ];

  const CAUSAL_SIMPLIFICATION = [
    'c\'est à cause de', 'c est a cause de', 'c\'est la faute de', 'c est la faute de',
    'tout ça à cause', 'tout ca a cause', 'la seule raison', 'l\'unique responsable',
    'voilà la vérité', 'voila la verite', 'la vérité qu\'on vous cache',
    'on ne vous dit pas', 'ce qu\'ils ne veulent pas', 'ils ne veulent pas que vous',
    'ouvrez les yeux', 'réveillez-vous', 'reveillez-vous',
    'la preuve que', 'ça prouve bien que', 'ca prouve bien que',
  ];

  const ENEMY_DESIGNATION = [
    'ennemi du peuple', 'ennemi de la france', 'ennemi de la nation',
    'danger pour la france', 'danger pour nos enfants', 'menace pour',
    'il faut les virer', 'dehors', 'dégagez', 'degagez',
    'à la porte', 'cassez-vous', 'hors de france',
    'on n\'en veut pas', 'on n en veut pas', 'on ne veut plus',
  ];

  const POLARIZATION_CATEGORIES = [
    { name: 'indignation', terms: INDIGNATION_TERMS, weight: 0.15 },
    { name: 'binary_opposition', terms: BINARY_OPPOSITION, weight: 0.25 },
    { name: 'conflict', terms: CONFLICT_TERMS, weight: 0.20 },
    { name: 'moral_absolute', terms: MORAL_ABSOLUTE, weight: 0.20 },
    { name: 'causal_simplification', terms: CAUSAL_SIMPLIFICATION, weight: 0.10 },
    { name: 'enemy_designation', terms: ENEMY_DESIGNATION, weight: 0.10 },
  ];

  function detectPolarization(text) {
    const lower = text.toLowerCase();
    const matches = {};
    let totalScore = 0;

    for (const cat of POLARIZATION_CATEGORIES) {
      const found = cat.terms.filter(t => lower.includes(t));
      if (found.length > 0) {
        matches[cat.name] = found;
        totalScore += cat.weight * Math.min(1 + (found.length - 1) * 0.5, 1.5);
      }
    }

    const score = Math.min(totalScore, 1);

    return {
      score,
      signals: {
        ingroupOutgroup: (matches['binary_opposition']?.length ?? 0) > 0,
        conflict: (matches['conflict']?.length ?? 0) > 0,
        moralAbsolute: (matches['moral_absolute']?.length ?? 0) > 0,
        enemyDesignation: (matches['enemy_designation']?.length ?? 0) > 0,
      },
      matches,
    };
  }

  // ============================================================================
  // MILITANT HASHTAGS DICTIONARY
  // ============================================================================

  const POLITICAL_HASHTAGS = new Set([
    'justiceclimatique', 'justicesociale', 'urgenceclimatique', 'greve', 'grevegeneral',
    'onlacherien', 'reformedesretraites', 'retraites', 'convergencedesluttes',
    'anticapitalisme', 'anticapitaliste', 'melenchon', 'nupes', 'unionpopulaire',
    'nouveau front populaire', 'nfp',
    'ecologie', 'derniere renovation', 'derniererenovation', 'extinctionrebellion',
    'stopepr', 'stopmegabassines', 'megabassines', 'zadiste', 'zad',
    'noussommeslanature', 'enr', 'transitionenergetique',
    'manifpourtous', 'lamanifpourtous', 'tradwave', 'identitaire',
    'remigration', 'grandremplacment', 'reconquete', 'zemmour', 'bardella',
    'stopimmigration', 'francedabord', 'patriote', 'patriotes',
    'metoo', 'metooinceste', 'balancetonporc', 'balancetontiktokeur',
    'feminisme', 'feministe', 'droitdesfemmes', 'ivg', 'egalite',
    'transphobie', 'lgbtqia', 'pride', 'fiertés',
    'reveillezvous', 'ouvrezlesyeux', 'censure', 'libertedexpression',
    'dictature', 'dictatureSanitaire', 'passeportSanitaire', 'bigpharma',
    'greatreset', 'nwo', 'manipulation', 'desinformation',
    'freepalestine', 'standwithpalestine', 'standwithisrael',
    'stopwar', 'nowar', 'ukraine', 'russie', 'gaza', 'genocide',
    'logementpourtous', 'sdf', 'precarite', 'samu social',
    'discriminations', 'racisme', 'antiracisme', 'islamophobie',
    'antisemitisme', 'violencespolicières', 'violencespolicieres',
  ]);

  const SOCIETAL_HASHTAGS = new Set([
    'bienetre', 'santemental', 'santementale', 'burnout',
    'inclusion', 'diversite', 'handicap', 'accessibilite',
    'education', 'ecole', 'enseignement', 'numerique',
    'alimentation', 'bio', 'vegan', 'veganisme',
    'sante', 'hopital', 'soignants', 'desertmedical',
    'logement', 'immobilier', 'loyer', 'gentrification',
    'pouvoirdachat', 'inflation', 'salaire', 'smic',
  ]);

  function analyzeHashtags(hashtags) {
    const normalized = hashtags.map(h => h.toLowerCase().replace(/^#/, '').replace(/[_\s]/g, ''));
    const politicalHashtags = normalized.filter(h => POLITICAL_HASHTAGS.has(h));
    const societalHashtags = normalized.filter(h => SOCIETAL_HASHTAGS.has(h));

    let politicalLevel = 0;
    if (politicalHashtags.length >= 3) politicalLevel = 4;
    else if (politicalHashtags.length >= 1) politicalLevel = 3;
    else if (societalHashtags.length >= 2) politicalLevel = 2;
    else if (societalHashtags.length >= 1) politicalLevel = 1;

    return { politicalHashtags, societalHashtags, politicalLevel };
  }

  // ============================================================================
  // MEDIA CATEGORY CLASSIFICATION
  // ============================================================================

  const ENTERTAINMENT_MARKERS = [
    'mdr', 'lol', 'ptdr', 'xd', '😂', '🤣', 'mort de rire',
    'funny', 'drôle', 'drole', 'humour', 'blague', 'sketch', 'prank',
    'meme', 'memes', 'trend', 'trending', 'viral', 'challenge',
    'dance', 'danse', 'musique', 'music', 'clip', 'concert',
    'série', 'serie', 'film', 'cinéma', 'cinema', 'netflix', 'disney',
    'gaming', 'gamer', 'jeu vidéo', 'jeu video', 'esport',
    'recette', 'cuisine', 'food', 'foodporn', 'restaurant',
    'voyage', 'travel', 'vacances', 'plage', 'sunset',
    'mode', 'fashion', 'outfit', 'ootd', 'look', 'haul',
    'makeup', 'maquillage', 'skincare', 'routine', 'tuto beauté',
    'fitness', 'workout', 'gym', 'musculation', 'yoga',
    'cute', 'adorable', 'aww', 'pet', 'chien', 'chat', 'chaton',
  ];

  const INFORMATION_MARKERS = [
    'selon', 'd\'après', 'd apres', 'source', 'sources',
    'rapport', 'étude', 'etude', 'enquête', 'enquete',
    'statistiques', 'chiffres', 'données', 'donnees',
    'communiqué', 'communique', 'officiel', 'officiellement',
    'breaking', 'alerte info', 'dernière heure', 'derniere heure',
    'flash info', 'info', 'actu', 'actualité', 'actualite',
    'journal', 'presse', 'reportage', 'investigation',
    'bfm', 'cnews', 'france info', 'le monde', 'libération', 'liberation',
    'figaro', 'mediapart', 'reuters', 'afp', 'ap news',
    'fact-check', 'factcheck', 'vérification', 'verification',
    'déclaration', 'declaration', 'annonce', 'annoncé', 'annonce',
    'bilan', 'résultats', 'resultats',
  ];

  const OPINION_MARKERS = [
    'je pense', 'je crois', 'à mon avis', 'a mon avis', 'selon moi',
    'mon opinion', 'mon point de vue', 'personnellement',
    'je suis convaincu', 'il faut que', 'on devrait',
    'tribune', 'édito', 'edito', 'éditorial', 'editorial',
    'chronique', 'billet', 'coup de gueule',
    'il est temps', 'il est urgent', 'il faut agir',
    'je dénonce', 'je denonce', 'je m\'oppose', 'je m oppose',
    'mon analyse', 'à mes yeux', 'a mes yeux',
    'thread', '🧵', 'unpopular opinion', 'hot take',
    'débat', 'debat', 'polémique', 'polemique', 'controverse',
  ];

  const INTOX_MARKERS = [
    'on ne vous dit pas', 'on nous cache', 'la vérité cachée', 'la verite cachee',
    'ce que les médias', 'ce que les medias', 'les médias mentent', 'les medias mentent',
    'révélation', 'revelation', 'exclusif', 'choquant',
    'ils ne veulent pas que vous', 'on vous ment',
    'complot', 'conspiration', 'planifié', 'planifie',
    'nouvel ordre mondial', 'nwo', 'great reset',
    'big pharma', 'big tech', 'deep state', 'état profond',
    'ouvrez les yeux', 'réveillez-vous', 'reveillez-vous',
    'preuve irréfutable', 'preuves accablantes',
    'censuré', 'censure', 'supprimé par', 'interdit de diffusion',
    'fausse flag', 'false flag', 'mise en scène', 'mise en scene',
    'officiellement interdit', 'ils ont peur',
  ];

  const PUB_MARKERS = [
    'sponsorisé', 'sponsorise', 'sponsored', 'ad', 'partenariat',
    'collaboration', 'collab', '#pub', '#ad', '#sponsored',
    'lien en bio', 'link in bio', 'code promo', 'réduction', 'reduction',
    '-20%', '-30%', '-50%', 'offre limitée', 'offre limitee',
    'livraison gratuite', 'achetez', 'acheter maintenant',
    'profitez', 'bon plan', 'deal', 'promo',
    'affiliation', 'affilié', 'marque', 'produit offert',
    'unboxing', 'test produit', 'review', 'avis',
  ];

  const EDUCATION_MARKERS = [
    'saviez-vous', 'le saviez-vous', 'did you know',
    'explication', 'expliqué', 'explique', 'comment fonctionne',
    'tutoriel', 'tuto', 'guide', 'apprendre', 'cours',
    'formation', 'masterclass', 'conférence', 'conference', 'ted',
    'science', 'scientifique', 'recherche', 'découverte', 'decouverte',
    'histoire', 'historique', 'documentaire',
    'vulgarisation', 'pédagogie', 'pedagogie',
    'définition', 'definition', 'concept', 'théorie', 'theorie',
    'astuce', 'conseil', 'tips', 'hack', 'lifehack',
  ];

  const FACTUAL_MARKERS = [
    'selon une étude', 'selon une etude', 'd\'après les chiffres',
    'source :', 'sources :', 'référence', 'reference',
    'rapport officiel', 'données publiques', 'donnees publiques',
    'insee', 'eurostat', 'oms', 'who',
    'peer reviewed', 'revue scientifique', 'méta-analyse',
    'fact-check', 'vérifié', 'verifie',
  ];

  const EMOTIONAL_MARKERS = [
    '😭', '💔', '🥺', '😡', '🤬', '❤️', '🙏',
    'bouleversant', 'émouvant', 'emouvant', 'touchant',
    'larmes', 'pleurer', 'cœur brisé', 'coeur brise',
    'magnifique', 'merveilleux', 'incroyable',
    'terrible', 'horrible', 'atroce', 'tragique', 'drame',
  ];

  const SENSATIONAL_MARKERS = [
    '🔥', '💣', '⚡', '‼️', '❗',
    'incroyable', 'hallucinant', 'fou', 'dingue', 'ouf',
    'vous n\'allez pas croire', 'vous n allez pas croire',
    'choc', 'choquant', 'stupéfiant', 'stupefiant',
    'énorme', 'enorme', 'scandale', 'bombe', 'explosion',
    'jamais vu', 'sans précédent', 'sans precedent',
    'clickbait', 'putaclic',
  ];

  const MISLEADING_MARKERS = INTOX_MARKERS.slice(0, 10).concat([
    'fake news', 'infox', 'désinformation',
    'manipulé', 'manipule', 'truqué', 'truque',
    'hors contexte', 'sorti de son contexte',
    'date ancienne', 'photo ancienne', 'recycled',
  ]);

  const CATEGORIES = [
    { name: 'intox', markers: INTOX_MARKERS, weight: 1.3 },
    { name: 'pub', markers: PUB_MARKERS, weight: 1.2 },
    { name: 'information', markers: INFORMATION_MARKERS, weight: 1.0 },
    { name: 'opinion', markers: OPINION_MARKERS, weight: 1.0 },
    { name: 'education', markers: EDUCATION_MARKERS, weight: 1.0 },
    { name: 'divertissement', markers: ENTERTAINMENT_MARKERS, weight: 0.8 },
  ];

  const QUALITIES = [
    { name: 'trompeur', markers: MISLEADING_MARKERS, weight: 1.3 },
    { name: 'sensationnel', markers: SENSATIONAL_MARKERS, weight: 1.1 },
    { name: 'émotionnel', markers: EMOTIONAL_MARKERS, weight: 1.0 },
    { name: 'factuel', markers: FACTUAL_MARKERS, weight: 1.0 },
  ];

  function scoreCategory(text, configs) {
    let best = null;
    for (const cat of configs) {
      const matches = cat.markers.filter(m => text.includes(m));
      const score = matches.length * cat.weight;
      if (score > 0 && (!best || score > best.score)) {
        best = { name: cat.name, score, matches };
      }
    }
    return best;
  }

  function classifyMedia(text, isSponsored) {
    const lower = text.toLowerCase();
    if (isSponsored) {
      const quality = scoreCategory(lower, QUALITIES);
      return {
        category: 'pub',
        quality: quality?.name || 'neutre',
        categoryMatches: ['sponsored'],
        qualityMatches: quality?.matches || [],
      };
    }
    const cat = scoreCategory(lower, CATEGORIES);
    const qual = scoreCategory(lower, QUALITIES);
    return {
      category: cat?.name || '',
      quality: qual?.name || 'neutre',
      categoryMatches: cat?.matches || [],
      qualityMatches: qual?.matches || [],
    };
  }

  // ============================================================================
  // TEXT NORMALIZATION
  // ============================================================================

  function stripUrls(text) {
    return text.replace(/https?:\/\/\S+/gi, '').replace(/www\.\S+/gi, '');
  }

  function stripMentions(text) {
    return text.replace(/@[\w.]+/g, '');
  }

  function reduceEmojis(text) {
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
    let consecutive = 0;
    let result = '';
    let lastIndex = 0;

    try {
      for (const match of text.matchAll(emojiRegex)) {
        const idx = match.index;
        const before = text.slice(lastIndex, idx);

        if (before.trim() === '' && consecutive > 0) {
          consecutive++;
        } else {
          consecutive = 1;
        }

        result += before;
        if (consecutive <= 2) {
          result += match[0];
        }
        lastIndex = idx + match[0].length;
      }
      result += text.slice(lastIndex);
      return result;
    } catch (e) {
      // Fallback if emoji regex not supported
      return text;
    }
  }

  function stripInstagramUI(text) {
    const uiPatterns = [
      /Home\s+Reels\s+Envoyer un message\s+Rechercher et explorer\s+Profil/gi,
      /Plus d'actions pour cette publication/gi,
      /Photo de profil de \S+/gi,
      /\S+ a publié un\(e\) \S+ le \d+ \w+/gi,
      /Suggestions?\s+Suivre/gi,
      /\d+ J'aime,?\s*\d* commentaires?/gi,
      /Voir la traduction/gi,
      /Photo \d+ de \d+ de .+?,/gi,
      /Suggestion Photo de .+?,/gi,
    ];
    let result = text;
    for (const pattern of uiPatterns) {
      result = result.replace(pattern, '');
    }
    return result;
  }

  function normalizeWhitespace(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function deduplicateSegments(segments) {
    const seen = new Set();
    const unique = [];

    for (const segment of segments) {
      const trimmed = segment.trim();
      if (!trimmed) continue;

      const normalized = trimmed.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

      let isDuplicate = false;
      for (const existing of seen) {
        if (existing.includes(normalized) || normalized.includes(existing)) {
          isDuplicate = true;
          if (normalized.length > existing.length) {
            seen.delete(existing);
            seen.add(normalized);
            const idx = unique.findIndex(u =>
              u.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ') === existing
            );
            if (idx !== -1) unique[idx] = trimmed;
          }
          break;
        }
      }

      if (!isDuplicate) {
        seen.add(normalized);
        unique.push(trimmed);
      }
    }

    return unique.join('\n\n');
  }

  function detectLanguage(text) {
    const lower = text.toLowerCase();
    const frWords = ['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'est', 'sont', 'dans', 'pour', 'avec', 'sur', 'pas', 'qui', 'que', 'nous', 'vous', 'cette', 'ces', 'mais', 'aussi', 'comme', 'plus', 'tout', 'bien', 'très', 'ça'];
    const enWords = ['the', 'is', 'are', 'was', 'were', 'have', 'has', 'with', 'for', 'this', 'that', 'from', 'been', 'will', 'would', 'could', 'should', 'their', 'they', 'your', 'about', 'just', 'more', 'very'];

    const words = lower.split(/\s+/);
    let frCount = 0;
    let enCount = 0;

    for (const word of words) {
      if (frWords.includes(word)) frCount++;
      if (enWords.includes(word)) enCount++;
    }

    if (frCount === 0 && enCount === 0) return 'unknown';
    if (frCount > enCount) return 'fr';
    if (enCount > frCount) return 'en';
    return 'fr';
  }

  function normalizePostText(input) {
    const cleanCaption = normalizeWhitespace(reduceEmojis(stripUrls(stripMentions(input.caption || ''))));
    const cleanImageDesc = normalizeWhitespace(input.imageDesc || '');
    const cleanAllText = normalizeWhitespace(stripInstagramUI(reduceEmojis(stripUrls(stripMentions(input.allText || '')))));

    const segments = [cleanCaption, cleanImageDesc, cleanAllText];

    if (input.ocrText?.trim()) {
      segments.push('[OCR] ' + normalizeWhitespace(input.ocrText));
    }
    if (input.subtitles?.trim()) {
      segments.push('[SUBTITLES] ' + normalizeWhitespace(input.subtitles));
    }
    if (input.audioTranscription?.trim()) {
      segments.push('[AUDIO_TRANSCRIPT] ' + normalizeWhitespace(input.audioTranscription));
    }

    const normalizedText = deduplicateSegments(segments);
    const language = detectLanguage(normalizedText);

    const keywordTerms = (input.hashtags || [])
      .map(h => h.replace(/^#/, '').toLowerCase())
      .filter(h => h.length > 2);

    return { normalizedText, language, keywordTerms };
  }

  // ============================================================================
  // RULES ENGINE
  // ============================================================================

  function applyRules(input) {
    const { normalizedText, hashtags, username } = input;
    const textForAnalysis = (normalizedText || '') + ' ' + (username || '');

    // Topics
    const topicResults = classifyTopics(textForAnalysis);
    const mainTopics = topicResults.slice(0, 3).map(t => t.id);
    const secondaryTopics = topicResults.slice(3, 6).map(t => t.id);

    // Political actors
    const actors = detectPoliticalActors(textForAnalysis);
    const allPoliticalActors = [...actors.parties, ...actors.figures];

    // Hashtags
    const hashtagResult = analyzeHashtags(hashtags || []);

    // Political score (0-4)
    let politicalScore = hashtagResult.politicalLevel;

    if (actors.figures.length > 0) politicalScore = Math.max(politicalScore, 3);
    if (actors.parties.length > 0) politicalScore = Math.max(politicalScore, 3);
    if (actors.institutions.length >= 2) politicalScore = Math.max(politicalScore, 2);
    else if (actors.institutions.length > 0) politicalScore = Math.max(politicalScore, 1);
    if (actors.activismTerms.length >= 2) politicalScore = Math.max(politicalScore, 4);
    else if (actors.activismTerms.length > 0) politicalScore = Math.max(politicalScore, 3);

    // Political issue tags
    const politicalIssueTags = [];
    const politicalTopics = ['politique', 'geopolitique', 'immigration', 'securite', 'justice', 'ecologie'];
    for (const t of topicResults) {
      if (politicalTopics.includes(t.id)) politicalIssueTags.push(t.id);
    }
    if (politicalIssueTags.length > 0 && politicalScore < 2) politicalScore = 2;

    // Known political accounts
    const knownAccount = detectPoliticalAccount(username || '');
    if (knownAccount) {
      politicalScore = Math.max(politicalScore, knownAccount.minPoliticalScore);
      for (const tag of knownAccount.tags) {
        if (!politicalIssueTags.includes(tag)) politicalIssueTags.push(tag);
      }
    }

    // Polarization
    const polarization = detectPolarization(textForAnalysis);

    let adjustedPolarization = polarization.score;
    if (hashtagResult.politicalLevel >= 3 && polarization.score > 0.1) {
      adjustedPolarization = Math.min(adjustedPolarization * 1.3, 1);
    }

    // Political axes
    const axes = detectPoliticalAxes(textForAnalysis);

    // Media classification
    const media = classifyMedia(textForAnalysis, input.isSponsored || false);

    // Confidence score
    const textLength = normalizedText?.length || 0;
    const signalCount = topicResults.length + allPoliticalActors.length + hashtagResult.politicalHashtags.length;
    let confidence = 0.3;
    if (textLength > 100) confidence += 0.2;
    if (textLength > 300) confidence += 0.1;
    if (signalCount >= 3) confidence += 0.2;
    if (signalCount >= 6) confidence += 0.1;
    if ((hashtags || []).length > 0) confidence += 0.1;
    confidence = Math.min(confidence, 1);

    return {
      mainTopics,
      secondaryTopics,
      politicalActors: allPoliticalActors,
      institutions: actors.institutions,
      activismSignal: actors.activismTerms.length > 0 || hashtagResult.politicalLevel >= 4,
      politicalExplicitnessScore: Math.min(politicalScore, 4),
      politicalIssueTags,
      polarizationScore: Math.round(adjustedPolarization * 100) / 100,
      ingroupOutgroupSignal: polarization.signals.ingroupOutgroup,
      conflictSignal: polarization.signals.conflict,
      moralAbsoluteSignal: polarization.signals.moralAbsolute,
      enemyDesignationSignal: polarization.signals.enemyDesignation,
      politicalAxes: axes.scores,
      dominantAxis: axes.dominant,
      mediaCategory: media.category,
      mediaQuality: media.quality,
      confidenceScore: Math.round(confidence * 100) / 100,
      normalizedText: normalizedText || '',
    };
  }

  // ============================================================================
  // MAIN ENRICHMENT FUNCTION (IIFE EXPORT)
  // ============================================================================

  window.__echaEnrich = function(post) {
    // Post structure: {username, caption, fullCaption, imageAlts, hashtags, allText}
    // imageAlts can be array or string — normalize to string
    const alts = Array.isArray(post.imageAlts) ? post.imageAlts.join(' ') : (post.imageAlts || '');
    const input = {
      caption: post.caption || '',
      imageDesc: alts,
      allText: post.allText || post.fullCaption || '',
      hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
    };

    const normalization = normalizePostText(input);

    const rulesResult = applyRules({
      normalizedText: normalization.normalizedText,
      hashtags: post.hashtags || [],
      username: post.username || '',
      isSponsored: post.isSponsored || false,
    });

    return {
      mainTopics: rulesResult.mainTopics,
      secondaryTopics: rulesResult.secondaryTopics,
      politicalActors: rulesResult.politicalActors,
      institutions: rulesResult.institutions,
      activismSignal: rulesResult.activismSignal,
      politicalExplicitnessScore: rulesResult.politicalExplicitnessScore,
      politicalIssueTags: rulesResult.politicalIssueTags,
      polarizationScore: rulesResult.polarizationScore,
      ingroupOutgroupSignal: rulesResult.ingroupOutgroupSignal,
      conflictSignal: rulesResult.conflictSignal,
      moralAbsoluteSignal: rulesResult.moralAbsoluteSignal,
      enemyDesignationSignal: rulesResult.enemyDesignationSignal,
      politicalAxes: rulesResult.politicalAxes,
      dominantAxis: rulesResult.dominantAxis,
      mediaCategory: rulesResult.mediaCategory,
      mediaQuality: rulesResult.mediaQuality,
      confidenceScore: rulesResult.confidenceScore,
      normalizedText: normalization.normalizedText,
      language: normalization.language,
    };
  };

})();
