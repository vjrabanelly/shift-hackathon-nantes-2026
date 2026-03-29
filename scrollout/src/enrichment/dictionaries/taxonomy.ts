/**
 * Taxonomie à 5 niveaux pour la classification de contenu Instagram.
 *
 * Niveau 1 — Domaine (~6)      : macro-agrégation pour profil utilisateur
 * Niveau 2 — Thème (~24)       : classification multi-label principale
 * Niveau 3 — Sujet (~150)      : sous-catégorie stable dans le temps
 * Niveau 4 — Sujet précis      : proposition débattable, pivot pour le matching cross-perspectives
 * Niveau 5 — Marqueur/Entité   : détecté dynamiquement (politicalActors, persons, etc.)
 *
 * Les niveaux 1-4 sont définis ici. Le niveau 5 est détecté par les autres dictionnaires.
 */

// ─── Interfaces ──────────────────────────────────────────────

export interface KnownPosition {
  label: string;
  typicalNarratives: string[];
  typicalActors: string[];
}

export interface PreciseSubject {
  id: string;
  statement: string;           // proposition débattable
  knownPositions: KnownPosition[];
}

export interface Subject {
  id: string;
  label: string;
  keywords: string[];          // termes discriminants pour ce sujet
  preciseSubjects: PreciseSubject[];
}

export interface Theme {
  id: string;
  label: string;
  domainId: string;
  subjects: Subject[];
}

export interface Domain {
  id: string;
  label: string;
  themeIds: string[];
}

export interface TaxonomyMatch {
  domainId: string;
  themeId: string;
  subjectId: string | null;
  preciseSubjectId: string | null;
  matchCount: number;
}

// ─── Domaines (Niveau 1) ────────────────────────────────────

export const DOMAINS: Domain[] = [
  {
    id: 'politique_societe',
    label: 'Politique & Soci\u00e9t\u00e9',
    themeIds: ['politique', 'geopolitique', 'immigration', 'securite', 'justice', 'societe', 'feminisme', 'masculinite', 'identite'],
  },
  {
    id: 'economie_travail',
    label: '\u00c9conomie & Travail',
    themeIds: ['economie', 'business'],
  },
  {
    id: 'information_savoirs',
    label: 'Information & Savoirs',
    themeIds: ['actualite', 'education', 'technologie', 'sante'],
  },
  {
    id: 'culture_divertissement',
    label: 'Culture & Divertissement',
    themeIds: ['culture', 'humour', 'divertissement', 'sport'],
  },
  {
    id: 'lifestyle_bienetre',
    label: 'Lifestyle & Bien-être',
    themeIds: ['lifestyle', 'beaute', 'developpement_personnel', 'food', 'voyage', 'maison_jardin'],
  },
  {
    id: 'vie_quotidienne',
    label: 'Vie quotidienne',
    themeIds: ['animaux', 'parentalite', 'automobile', 'shopping'],
  },
  {
    id: 'ecologie_environnement',
    label: '\u00c9cologie & Environnement',
    themeIds: ['ecologie'],
  },
  {
    id: 'religion_spiritualite',
    label: 'Religion & Spiritualit\u00e9',
    themeIds: ['religion'],
  },
];

// ─── Thèmes + Sujets + Sujets Précis (Niveaux 2-4) ────────

export const THEMES: Theme[] = [
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Politique & Société
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'politique',
    label: 'Politique',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'elections',
        label: '\u00c9lections',
        keywords: ['\u00e9lection', 'election', 'vote', 'scrutin', 'candidat', 'campagne', 'sondage', 'premier tour', 'second tour', 'urne', 'bulletin'],
        preciseSubjects: [
          {
            id: 'vote_obligatoire',
            statement: 'Le vote devrait \u00eatre obligatoire en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'ordre'], typicalActors: ['institutionnels', 'centristes'] },
              { label: 'contre', typicalNarratives: ['injustice', 'empowerment'], typicalActors: ['libertariens', 'abstentionnistes'] },
            ],
          },
          {
            id: 'proportionnelle',
            statement: 'La France devrait passer au scrutin proportionnel',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'empowerment'], typicalActors: ['petits partis', 'RN', 'LFI'] },
              { label: 'contre', typicalNarratives: ['ordre', 'declin'], typicalActors: ['partis de gouvernement', 'macronistes'] },
            ],
          },
        ],
      },
      {
        id: 'vie_politique',
        label: 'Vie politique int\u00e9rieure',
        keywords: ['d\u00e9put\u00e9', 'depute', 's\u00e9nateur', 'senateur', 'ministre', 'pr\u00e9sident', 'president', 'assembl\u00e9e', 'parlement', 'gouvernement', 'opposition', 'majorit\u00e9', 'remaniement', 'motion de censure'],
        preciseSubjects: [
          {
            id: '49_3_legitime',
            statement: 'Le recours au 49.3 est un d\u00e9ni de d\u00e9mocratie',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['LFI', 'RN', 'syndicats'] },
              { label: 'contre', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['Renaissance', 'institutionnels'] },
            ],
          },
        ],
      },
      {
        id: 'extreme_droite',
        label: 'Extr\u00eame droite',
        keywords: ['extr\u00eame droite', 'extreme droite', 'rn', 'rassemblement national', 'le pen', 'bardella', 'zemmour', 'reconqu\u00eate', 'identitaire', 'grand remplacement', 'r\u00e9migration', 'remigration'],
        preciseSubjects: [
          {
            id: 'rn_republicanise',
            statement: 'Le RN s\'est r\u00e9publicanis\u00e9 et est devenu un parti fr\u00e9quentable',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['aspiration', 'ordre'], typicalActors: ['RN', 'droite conservatrice'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'menace'], typicalActors: ['gauche', 'antifascistes', 'associations'] },
            ],
          },
        ],
      },
      {
        id: 'gauche',
        label: 'Gauche',
        keywords: ['gauche', 'lfi', 'france insoumise', 'm\u00e9lenchon', 'melenchon', 'nupes', 'nfp', 'nouveau front populaire', 'socialiste', 'communiste', 'pcf', 'eelv'],
        preciseSubjects: [
          {
            id: 'union_gauche_necessaire',
            statement: 'L\'union de la gauche est la seule alternative cr\u00e9dible',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'urgence'], typicalActors: ['NFP', 'LFI', 'militants'] },
              { label: 'contre', typicalNarratives: ['declin', 'derision'], typicalActors: ['droite', 'centre', 'PS r\u00e9formiste'] },
            ],
          },
        ],
      },
      {
        id: 'scandale_politique',
        label: 'Scandales politiques',
        keywords: ['affaire', 'scandale', 'corruption', 'mis en examen', 'proc\u00e8s', 'proces', 'fraude', 'conflit d\'int\u00e9r\u00eat', 'conflit dinteret', 'enrichissement'],
        preciseSubjects: [
          {
            id: 'elus_impunite',
            statement: 'Les élus corrompus bénéficient d\'une impunité systémique en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['Anticor', 'gauche', 'populistes'] },
              { label: 'contre', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['institutionnels', 'juristes'] },
            ],
          },
          {
            id: 'transparence_patrimoine',
            statement: 'Le patrimoine des élus devrait être entièrement public',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'denonciation'], typicalActors: ['Transparency International', 'Anticor'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['élus', 'juristes vie privée'] },
            ],
          },
        ],
      },
      {
        id: 'reforme_institutions',
        label: 'R\u00e9forme des institutions',
        keywords: ['r\u00e9forme institutionnelle', 'constitution', 'r\u00e9f\u00e9rendum', 'referendum', 'initiative citoyenne', 'vi\u00e8me r\u00e9publique', 'vieme republique', 'd\u00e9centralisation', 'decentralisation', 'r\u00e9forme constitutionnelle'],
        preciseSubjects: [
          {
            id: 'ric_necessaire',
            statement: 'Le RIC (r\u00e9f\u00e9rendum d\'initiative citoyenne) est n\u00e9cessaire',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['gilets jaunes', 'LFI', 'RN'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['constitutionnalistes', 'centristes'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'geopolitique',
    label: 'G\u00e9opolitique',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'conflit_ukraine',
        label: 'Conflit Ukraine-Russie',
        keywords: ['ukraine', 'russie', 'zelensky', 'poutine', 'putin', 'kremlin', 'donbass', 'crim\u00e9e', 'crimee', 'otan', 'nato'],
        preciseSubjects: [
          {
            id: 'livraison_armes_ukraine',
            statement: 'L\'Europe doit continuer \u00e0 livrer des armes \u00e0 l\'Ukraine',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'mobilisation'], typicalActors: ['atlantistes', 'OTAN', 'UE'] },
              { label: 'contre', typicalNarratives: ['menace', 'declin'], typicalActors: ['souverainistes', 'pacifistes', 'LFI'] },
            ],
          },
        ],
      },
      {
        id: 'conflit_israel_palestine',
        label: 'Conflit Isra\u00ebl-Palestine',
        keywords: ['isra\u00ebl', 'israel', 'palestine', 'palestinien', 'gaza', 'hamas', 'netanyahu', 'cisjordanie', 'colonisation', 'bombardement', 'g\u00e9nocide', 'genocide', 'sionisme', 'antisionisme', 'c\u00e9sez-le-feu', 'cessez le feu'],
        preciseSubjects: [
          {
            id: 'genocide_gaza',
            statement: 'Ce qui se passe \u00e0 Gaza est un g\u00e9nocide',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['pro-palestiniens', 'LFI', 'ONG'] },
              { label: 'contre', typicalNarratives: ['menace', 'ordre'], typicalActors: ['pro-isra\u00e9liens', 'CRIF', 'Renaissance'] },
            ],
          },
          {
            id: 'boycott_israel',
            statement: 'Le boycott d\'Isra\u00ebl (BDS) est un moyen de pression l\u00e9gitime',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'injustice'], typicalActors: ['BDS', 'militants pro-palestiniens'] },
              { label: 'contre', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['organisations juives', 'gouvernement fran\u00e7ais'] },
            ],
          },
        ],
      },
      {
        id: 'relations_internationales',
        label: 'Relations internationales',
        keywords: ['diplomatie', 'trait\u00e9', 'traite', 'sanctions', 'embargo', 'onu', 'g7', 'g20', 'brics', 'sommet', 'alliance', 'multilat\u00e9ral'],
        preciseSubjects: [
          {
            id: 'sanctions_efficaces',
            statement: 'Les sanctions économiques internationales sont un outil efficace',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'mobilisation'], typicalActors: ['atlantistes', 'UE', 'États-Unis'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['souverainistes', 'pays du Sud', 'BRICS'] },
            ],
          },
          {
            id: 'brics_contre_occident',
            statement: 'Les BRICS représentent une alternative crédible à l\'ordre occidental',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['pays du Sud', 'anti-impérialistes'] },
              { label: 'contre', typicalNarratives: ['menace', 'ordre'], typicalActors: ['atlantistes', 'libéraux occidentaux'] },
            ],
          },
        ],
      },
      {
        id: 'union_europeenne',
        label: 'Union europ\u00e9enne',
        keywords: ['union europ\u00e9enne', 'union europeenne', 'bruxelles', 'commission europ\u00e9enne', 'parlement europ\u00e9en', 'schengen', 'frexit', 'trait\u00e9 europ\u00e9en', 'directive europ\u00e9enne'],
        preciseSubjects: [
          {
            id: 'souverainete_vs_ue',
            statement: 'L\'UE empi\u00e8te trop sur la souverainet\u00e9 nationale',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'declin'], typicalActors: ['souverainistes', 'RN', 'LFI'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'mobilisation'], typicalActors: ['europ\u00e9istes', 'Renaissance', 'Volt'] },
            ],
          },
        ],
      },
      {
        id: 'afrique',
        label: 'Afrique & post-colonialisme',
        keywords: ['afrique', 'fran\u00e7afrique', 'francafrique', 'colonisation', 'colonialisme', 'n\u00e9ocolonialisme', 'neocolonialisme', 'sahel', 'mali', 'niger', 's\u00e9n\u00e9gal', 'senegal', 'franc cfa', 'panafricanisme'],
        preciseSubjects: [
          {
            id: 'franc_cfa_neocolonial',
            statement: 'Le franc CFA est un outil n\u00e9ocolonial',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['panafricanistes', 'd\u00e9colonialistes'] },
              { label: 'contre', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['\u00e9conomistes lib\u00e9raux', 'institutionnels'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'immigration',
    label: 'Immigration',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'immigration_clandestine',
        label: 'Immigration clandestin',
        keywords: ['clandestin', 'passeur', 'traversée', 'traversee', 'naufrage', 'manche', 'lampedusa', 'filière', 'filiere', 'sans-papiers', 'sans papiers'],
        preciseSubjects: [
          {
            id: 'regularisation_sans_papiers',
            statement: 'Les sans-papiers qui travaillent devraient \u00eatre r\u00e9gularis\u00e9s',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'empowerment'], typicalActors: ['associations', 'gauche', 'syndicats'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['droite', 'RN'] },
            ],
          },
        ],
      },
      {
        id: 'droit_asile',
        label: 'Droit d\'asile',
        keywords: ['r\u00e9fugi\u00e9', 'refugie', 'asile', 'demandeur', 'ofpra', 'cnda', 'protection internationale', 'dublin'],
        preciseSubjects: [
          {
            id: 'droit_asile_trop_genereux',
            statement: 'Le droit d\'asile en France est trop généreux et détourné',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'menace'], typicalActors: ['droite', 'RN', 'Reconquête'] },
              { label: 'contre', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['associations', 'UNHCR', 'gauche'] },
            ],
          },
        ],
      },
      {
        id: 'integration',
        label: 'Int\u00e9gration',
        keywords: ['int\u00e9gration', 'integration', 'assimilation', 'communautarisme', 'vivre ensemble', 'francisation', 'naturalisation'],
        preciseSubjects: [
          {
            id: 'assimilation_vs_integration',
            statement: 'L\'assimilation est pr\u00e9f\u00e9rable \u00e0 l\'int\u00e9gration multiculturelle',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'declin'], typicalActors: ['droite', 'r\u00e9publicains conservateurs'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['associations', 'gauche', 'd\u00e9colonialistes'] },
            ],
          },
        ],
      },
      {
        id: 'politique_migratoire',
        label: 'Politique migratoire',
        keywords: ['oqtf', 'expulsion', 'reconduite', 'quotas', 'immigration choisie', 'loi immigration', 'pacte migratoire', 'fronti\u00e8re', 'frontiere'],
        preciseSubjects: [
          {
            id: 'quotas_migratoires_ue',
            statement: 'L\'UE doit r\u00e9partir les migrants par quotas entre \u00c9tats membres',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'ordre'], typicalActors: ['europ\u00e9istes', 'ONG'] },
              { label: 'contre', typicalNarratives: ['menace', 'declin'], typicalActors: ['souverainistes', 'Orban', 'Meloni'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'securite',
    label: 'S\u00e9curit\u00e9',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'violences_urbaines',
        label: 'Violences urbaines',
        keywords: ['violence urbaine', '\u00e9meute', 'emeute', 'incendie', 'caillassage', 'banlieue', 'quartier', 'nuit de violences'],
        preciseSubjects: [
          {
            id: 'emeutes_consequence_sociale',
            statement: 'Les émeutes urbaines sont la conséquence de décennies d\'abandon des quartiers',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['gauche', 'sociologues', 'associations quartiers'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['droite', 'RN', 'syndicats police'] },
            ],
          },
          {
            id: 'couvre_feu_emeutes',
            statement: 'Le couvre-feu est une réponse adaptée aux violences urbaines',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['droite sécuritaire', 'police'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['associations libertés', 'gauche'] },
            ],
          },
        ],
      },
      {
        id: 'police',
        label: 'Police & maintien de l\'ordre',
        keywords: ['police', 'policier', 'gendarme', 'gendarmerie', 'bac', 'crs', 'brav-m', 'bavure', 'lbd', 'interpellation', 'garde \u00e0 vue'],
        preciseSubjects: [
          {
            id: 'violences_policieres_systemiques',
            statement: 'Les violences polici\u00e8res sont un probl\u00e8me syst\u00e9mique en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['gauche', 'associations', 'ACAB'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['syndicats police', 'droite'] },
            ],
          },
          {
            id: 'controles_facies',
            statement: 'Les contr\u00f4les au faci\u00e8s sont un probl\u00e8me syst\u00e9mique',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['associations antiracistes', 'D\u00e9fenseur des droits'] },
              { label: 'contre', typicalNarratives: ['ordre'], typicalActors: ['syndicats police', 'droite'] },
            ],
          },
        ],
      },
      {
        id: 'terrorisme',
        label: 'Terrorisme',
        keywords: ['terrorisme', 'terroriste', 'attentat', 'radicalisation', 'djihad', 'jihadisme', 'fiche s', 'dgsi', 'vigipirate'],
        preciseSubjects: [
          {
            id: 'fichiers_s_expulsion',
            statement: 'Toutes les fiches S devraient être expulsées ou internées',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['droite', 'RN', 'victimes attentats'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'ordre'], typicalActors: ['juristes', 'CNCDH', 'magistrats'] },
            ],
          },
          {
            id: 'amalgame_islam_terrorisme',
            statement: 'L\'amalgame entre islam et terrorisme est entretenu par les médias',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['associations musulmanes', 'gauche', 'antiracistes'] },
              { label: 'contre', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['laïques stricts', 'droite', 'éditorialistes'] },
            ],
          },
        ],
      },
      {
        id: 'delinquance',
        label: 'D\u00e9linquance & criminalit\u00e9',
        keywords: ['d\u00e9linquance', 'delinquance', 'criminalit\u00e9', 'criminalite', 'agression', 'vol', 'cambriolage', 'narcotrafic', 'trafic', 'fusillade', 'r\u00e8glement de comptes'],
        preciseSubjects: [
          {
            id: 'ensauvagement',
            statement: 'La France conna\u00eet un "ensauvagement" de la soci\u00e9t\u00e9',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'menace'], typicalActors: ['droite', 'RN', 'Cnews'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['gauche', 'sociologues', 'Le Monde'] },
            ],
          },
        ],
      },
      {
        id: 'videosurveillance',
        label: 'Surveillance & libert\u00e9s',
        keywords: ['vid\u00e9osurveillance', 'videosurveillance', 'reconnaissance faciale', 'surveillance', 'big brother', 'libert\u00e9s publiques', 'cnil'],
        preciseSubjects: [
          {
            id: 'reconnaissance_faciale_securite',
            statement: 'La reconnaissance faciale doit \u00eatre utilis\u00e9e pour la s\u00e9curit\u00e9 publique',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['droite s\u00e9curitaire', 'police'] },
              { label: 'contre', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['CNIL', 'La Quadrature', 'gauche'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'justice',
    label: 'Justice',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'justice_penale',
        label: 'Justice p\u00e9nale',
        keywords: ['tribunal', 'proc\u00e8s', 'proces', 'condamnation', 'peine', 'prison', 'amende', 'r\u00e9cidive', 'recidive', 'parquet', 'cour d\'appel', 'cassation'],
        preciseSubjects: [
          {
            id: 'laxisme_justice',
            statement: 'La justice fran\u00e7aise est trop laxiste',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'denonciation'], typicalActors: ['droite', 'RN', 'victimes'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['magistrats', 'gauche', 'avocats'] },
            ],
          },
        ],
      },
      {
        id: 'droits_fondamentaux',
        label: 'Droits fondamentaux',
        keywords: ['droit', 'libert\u00e9', 'libertes', 'cedh', 'conseil constitutionnel', 'droits de l\'homme', 'habeas corpus', '\u00e9tat de droit', 'etat de droit'],
        preciseSubjects: [
          {
            id: 'cedh_souverainete',
            statement: 'La CEDH empiète sur la souveraineté nationale',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'declin'], typicalActors: ['souverainistes', 'RN', 'droite conservatrice'] },
              { label: 'contre', typicalNarratives: ['ordre', 'mobilisation'], typicalActors: ['juristes', 'défenseurs droits humains'] },
            ],
          },
          {
            id: 'etat_urgence_libertes',
            statement: 'L\'état d\'urgence permanent menace les libertés fondamentales',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'menace'], typicalActors: ['La Quadrature', 'LDH', 'gauche'] },
              { label: 'contre', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['gouvernement', 'droite sécuritaire'] },
            ],
          },
        ],
      },
      {
        id: 'violences_sexuelles',
        label: 'Violences sexuelles & justice',
        keywords: ['viol', 'agression sexuelle', 'harc\u00e8lement', 'harcelement', 'consentement', 'plainte', 'classement sans suite', 'prescription'],
        preciseSubjects: [
          {
            id: 'presomption_innocence_metoo',
            statement: 'Le mouvement #MeToo fragilise la pr\u00e9somption d\'innocence',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'ordre'], typicalActors: ['droite conservatrice', 'avocats p\u00e9nalistes'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'empowerment'], typicalActors: ['f\u00e9ministes', 'associations victimes'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'societe',
    label: 'Soci\u00e9t\u00e9',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'precarite',
        label: 'Pr\u00e9carit\u00e9 & pauvret\u00e9',
        keywords: ['pr\u00e9carit\u00e9', 'precarite', 'pauvret\u00e9', 'pauvrete', 'sdf', 'sans-abri', 'restos du coeur', 'aide alimentaire', 'minima sociaux', 'rsa'],
        preciseSubjects: [
          {
            id: 'rsa_conditionne_travail',
            statement: 'Le RSA doit \u00eatre conditionn\u00e9 \u00e0 des heures de travail',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['droite', 'Renaissance'] },
              { label: 'contre', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['associations', 'gauche', 'ATD Quart Monde'] },
            ],
          },
        ],
      },
      {
        id: 'inegalites',
        label: 'In\u00e9galit\u00e9s sociales',
        keywords: ['in\u00e9galit\u00e9', 'inegalite', 'classe', 'bourgeoisie', 'prolétaire', 'oligarchie', 'riches', 'milliardaire', 'fracture sociale', 'ascenseur social'],
        preciseSubjects: [
          {
            id: 'taxer_super_riches',
            statement: 'Il faut taxer massivement les ultra-riches pour réduire les inégalités',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'mobilisation'], typicalActors: ['gauche', 'Oxfam', 'Attac'] },
              { label: 'contre', typicalNarratives: ['menace', 'aspiration'], typicalActors: ['libéraux', 'patronat', 'droite'] },
            ],
          },
          {
            id: 'meritocratie_mythe',
            statement: 'La méritocratie est un mythe qui justifie les inégalités',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['sociologues', 'gauche radicale'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'ordre'], typicalActors: ['libéraux', 'droite', 'entrepreneurs'] },
            ],
          },
        ],
      },
      {
        id: 'banlieues',
        label: 'Banlieues & quartiers',
        keywords: ['banlieue', 'quartier', 'cit\u00e9', 'cite', 'zup', 'qpv', 'ghetto', 's\u00e9gr\u00e9gation', 'segregation', 'politique de la ville'],
        preciseSubjects: [
          {
            id: 'politique_ville_echec',
            statement: 'La politique de la ville est un échec depuis 40 ans',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'denonciation'], typicalActors: ['habitants QPV', 'sociologues', 'élus locaux'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'ordre'], typicalActors: ['ANRU', 'gouvernement'] },
            ],
          },
          {
            id: 'mixite_sociale_imposee',
            statement: 'La mixité sociale doit être imposée par la loi dans tous les quartiers',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'injustice'], typicalActors: ['gauche', 'urbanistes', 'associations'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['maires récalcitrants', 'droite'] },
            ],
          },
        ],
      },
      {
        id: 'solidarite',
        label: 'Solidarit\u00e9 & lien social',
        keywords: ['solidarit\u00e9', 'solidarite', 'entraide', 'b\u00e9n\u00e9volat', 'benevolat', 'association', 'don', 'caritatif', 'lien social'],
        preciseSubjects: [
          {
            id: 'revenu_universel',
            statement: 'Un revenu universel inconditionnel est la meilleure réponse à la précarité',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['gauche', 'économistes hétérodoxes', 'Hamon'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['droite', 'patronat', 'libéraux'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'feminisme',
    label: 'F\u00e9minisme',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'harcelement',
        label: 'Harc\u00e8lement',
        keywords: ['harc\u00e8lement', 'harcelement', 'metoo', 'me too', 'balancetonporc', 'agression', 'harc\u00e8lement de rue', 'harcelement de rue', 'cyberharcèlement'],
        preciseSubjects: [
          {
            id: 'harcelement_rue_loi',
            statement: 'Le harcèlement de rue devrait être sanctionné par des peines de prison',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'empowerment'], typicalActors: ['féministes', 'gouvernement', 'victimes'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['juristes', 'libertaires'] },
            ],
          },
          {
            id: 'cyberharcelement_anonymat',
            statement: 'L\'anonymat en ligne devrait être supprimé pour lutter contre le cyberharcèlement',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['victimes', 'politiques', 'parents'] },
              { label: 'contre', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['défenseurs libertés numériques', 'La Quadrature'] },
            ],
          },
        ],
      },
      {
        id: 'charge_mentale',
        label: 'Charge mentale',
        keywords: ['charge mentale', 'r\u00e9partition des t\u00e2ches', 'in\u00e9galit\u00e9s domestiques', 'congé parental', 'congé paternit\u00e9'],
        preciseSubjects: [
          {
            id: 'conge_parental_egal',
            statement: 'Le congé parental devrait être identique et obligatoire pour les deux parents',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'mobilisation'], typicalActors: ['féministes', 'gauche', 'pays nordiques'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['conservateurs', 'patronat'] },
            ],
          },
        ],
      },
      {
        id: 'inegalites_salariales',
        label: 'In\u00e9galit\u00e9s salariales',
        keywords: ['in\u00e9galit\u00e9 salariale', 'inegalite salariale', '\u00e9cart de salaire', 'ecart de salaire', 'plafond de verre', 'index \u00e9galit\u00e9'],
        preciseSubjects: [
          {
            id: 'quotas_femmes_direction',
            statement: 'Des quotas de femmes dans les comités de direction sont nécessaires',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['féministes', 'gauche', 'certaines patronnes'] },
              { label: 'contre', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['libéraux', 'anti-quotas', 'méritocratie'] },
            ],
          },
          {
            id: 'ecart_salarial_choix',
            statement: 'L\'écart salarial homme-femme s\'explique principalement par des choix de carrière différents',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'derision'], typicalActors: ['libéraux', 'anti-féministes'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['féministes', 'sociologues', 'syndicats'] },
            ],
          },
        ],
      },
      {
        id: 'ivg',
        label: 'IVG & droits reproductifs',
        keywords: ['ivg', 'avortement', 'interruption', 'contraception', 'planning familial', 'droit \u00e0 l\'avortement', 'clause de conscience'],
        preciseSubjects: [
          {
            id: 'ivg_constitution',
            statement: 'L\'IVG doit \u00eatre un droit constitutionnel',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'mobilisation'], typicalActors: ['f\u00e9ministes', 'gauche', 'majorit\u00e9 transpartisane'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['conservateurs', 'religieux', 'Manif pour tous'] },
            ],
          },
        ],
      },
      {
        id: 'body_positivity',
        label: 'Body positivity & image',
        keywords: ['body positive', 'body positivity', 'grossophobie', 'normes de beaut\u00e9', 'injonction', 'body shaming'],
        preciseSubjects: [
          {
            id: 'body_positivity_sante',
            statement: 'Le body positivity peut encourager des modes de vie malsains',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'ordre'], typicalActors: ['médecins', 'conservateurs', 'fitness influenceurs'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'denonciation'], typicalActors: ['activistes body positive', 'féministes'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'masculinite',
    label: 'Masculinit\u00e9',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'redpill',
        label: 'Red pill & manosph\u00e8re',
        keywords: ['red pill', 'redpill', 'alpha', 'sigma', 'grindset', 'andrew tate', 'tate', 'mgtow', 'manosph\u00e8re', 'manosphere', 'high value', 'hypergamie', 'incel', 'blackpill', 'bluepill', 'beta', 'chad', 'simp', 'pickme', 'gynocentrisme', 'misandrie', 'feminazi', 'mra', 'mens rights'],
        preciseSubjects: [
          {
            id: 'crise_masculinite',
            statement: 'Il existe une "crise de la masculinit\u00e9" dans la soci\u00e9t\u00e9 moderne',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'victimisation'], typicalActors: ['manosph\u00e8re', 'conservateurs'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['f\u00e9ministes', 'sociologues'] },
            ],
          },
        ],
      },
      {
        id: 'masculinite_positive',
        label: 'Masculinit\u00e9 positive',
        keywords: ['masculinit\u00e9 positive', 'masculinite positive', 'homme moderne', 'paternit\u00e9', 'paternite', 'homme f\u00e9ministe', 'vuln\u00e9rabilit\u00e9', 'sant\u00e9 mentale homme', 'homme d\u00e9construit', 'charge mentale homme', 'cong\u00e9 paternit\u00e9', 'conge paternite', 'p\u00e8re au foyer', 'p\u00e8re c\u00e9libataire', 'parentalit\u00e9', 'male ally', 'soft boy'],
        preciseSubjects: [
          {
            id: 'homme_deconstruit_ridicule',
            statement: 'L\'homme déconstruit est une mode qui ridiculise la masculinité',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['derision', 'declin'], typicalActors: ['manosphère', 'conservateurs', 'red pill'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['féministes', 'psychologues', 'progressistes'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'identite',
    label: 'Identit\u00e9',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'racisme',
        label: 'Racisme & antiracisme',
        keywords: ['racisme', 'raciste', 'antiracisme', 'discrimination', 'racis\u00e9', 'racise', 'woke', 'd\u00e9colonial', 'decolonial', 'privil\u00e8ge blanc', 'privilege blanc', 'racisme syst\u00e9mique', 'diversit\u00e9', 'diversite', 'inclusion', 'repr\u00e9sentativit\u00e9', 'representativite', 'micro-agression', 'tokenisme', 'colorblind'],
        preciseSubjects: [
          {
            id: 'racisme_systemique_france',
            statement: 'Le racisme syst\u00e9mique existe en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['antiracistes', 'd\u00e9colonialistes', 'gauche'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'ordre'], typicalActors: ['universalistes r\u00e9publicains', 'droite'] },
            ],
          },
        ],
      },
      {
        id: 'lgbtq',
        label: 'LGBTQ+',
        keywords: ['lgbtq', 'lgbt', 'gay', 'lesbienne', 'transgenre', 'trans', 'non-binaire', 'non binaire', 'queer', 'pride', 'marche des fiert\u00e9s', 'pma', 'gpa', 'drag', 'homophobie', 'transphobie', 'coming out', 'rainbow', 'arc-en-ciel', 'cisgenre', 'genre fluide', 'm\u00e9genrer', 'deadname'],
        preciseSubjects: [
          {
            id: 'gpa_legaliser',
            statement: 'La GPA doit \u00eatre l\u00e9galis\u00e9e en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['associations LGBT', 'gauche lib\u00e9rale'] },
              { label: 'contre', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['conservateurs', 'f\u00e9ministes anti-GPA', 'Manif pour tous'] },
            ],
          },
          {
            id: 'transition_genre_mineurs',
            statement: 'Les transitions de genre pour les mineurs doivent \u00eatre encadr\u00e9es strictement',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'menace'], typicalActors: ['conservateurs', 'certains m\u00e9decins'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['associations trans', 'OMS'] },
            ],
          },
        ],
      },
      {
        id: 'diaspora',
        label: 'Diaspora & origines',
        keywords: ['diaspora', 'racines', 'origine', 'binational', 'double culture', 'repr\u00e9sentation', 'representation', 'visibilit\u00e9', 'visibilite', 'minorit\u00e9', 'minorite', 'communaut\u00e9', 'communaute', 'expat', 'int\u00e9gration', 'integration', 'assimilation', 'identit\u00e9 culturelle', 'm\u00e9tissage', 'metissage', 'cr\u00e9ole', 'creole', 'afro', 'maghr\u00e9bine', 'maghrebine', 'asiatique'],
        preciseSubjects: [
          {
            id: 'binationaux_loyaute',
            statement: 'La double nationalité pose un problème de loyauté',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'ordre'], typicalActors: ['droite', 'souverainistes', 'RN'] },
              { label: 'contre', typicalNarratives: ['injustice', 'empowerment'], typicalActors: ['associations diaspora', 'gauche', 'binationaux'] },
            ],
          },
          {
            id: 'representation_medias',
            statement: 'Les minorités sont sous-représentées dans les médias français',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['associations', 'CSA/Arcom', 'gauche'] },
              { label: 'contre', typicalNarratives: ['ordre', 'derision'], typicalActors: ['universalistes républicains', 'droite'] },
            ],
          },
        ],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Économie & Travail
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'economie',
    label: '\u00c9conomie',
    domainId: 'economie_travail',
    subjects: [
      {
        id: 'fiscalite',
        label: 'Fiscalit\u00e9',
        keywords: ['imp\u00f4t', 'impot', 'taxe', 'fiscal', 'isf', 'tva', 'flat tax', 'niche fiscale', 'fraude fiscale', '\u00e9vasion fiscale', 'evasion fiscale', 'paradis fiscal'],
        preciseSubjects: [
          {
            id: 'retablir_isf',
            statement: 'L\'ISF doit \u00eatre r\u00e9tabli',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'mobilisation'], typicalActors: ['gauche', 'gilets jaunes'] },
              { label: 'contre', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['droite', 'patronat', 'lib\u00e9raux'] },
            ],
          },
        ],
      },
      {
        id: 'emploi_chomage',
        label: 'Emploi & ch\u00f4mage',
        keywords: ['ch\u00f4mage', 'chomage', 'emploi', 'p\u00f4le emploi', 'pole emploi', 'france travail', 'cdi', 'cdd', 'int\u00e9rim', 'interim', 'uber', 'auto-entrepreneur', 'plein emploi'],
        preciseSubjects: [
          {
            id: 'reforme_assurance_chomage',
            statement: 'Il faut durcir les conditions d\'acc\u00e8s \u00e0 l\'assurance ch\u00f4mage',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['MEDEF', 'Renaissance', 'droite'] },
              { label: 'contre', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['syndicats', 'gauche'] },
            ],
          },
        ],
      },
      {
        id: 'pouvoir_achat',
        label: 'Pouvoir d\'achat',
        keywords: ['pouvoir d\'achat', 'pouvoir dachat', 'inflation', 'prix', 'salaire', 'smic', 'vie ch\u00e8re', 'carburant', 'loyer'],
        preciseSubjects: [
          {
            id: 'smic_augmenter',
            statement: 'Le SMIC doit \u00eatre significativement augment\u00e9',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'mobilisation'], typicalActors: ['syndicats', 'gauche'] },
              { label: 'contre', typicalNarratives: ['menace', 'ordre'], typicalActors: ['patronat', 'lib\u00e9raux'] },
            ],
          },
        ],
      },
      {
        id: 'retraites',
        label: 'Retraites',
        keywords: ['retraite', 'pension', 'r\u00e9forme des retraites', 'reforme des retraites', '64 ans', '\u00e2ge de d\u00e9part', 'age de depart', 'cotisation', 'trimestre', 'agirc', 'arrco'],
        preciseSubjects: [
          {
            id: 'reforme_retraites_64',
            statement: 'Le recul de l\'\u00e2ge de d\u00e9part \u00e0 64 ans est n\u00e9cessaire',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'ordre'], typicalActors: ['Renaissance', 'patronat', 'droite'] },
              { label: 'contre', typicalNarratives: ['injustice', 'mobilisation', 'denonciation'], typicalActors: ['syndicats', 'gauche', 'gilets jaunes'] },
            ],
          },
        ],
      },
      {
        id: 'dette_budget',
        label: 'Dette & budget',
        keywords: ['dette', 'budget', 'd\u00e9ficit', 'deficit', 'aust\u00e9rit\u00e9', 'austerite', 'dette publique', 'pib', 'agences de notation', 'maastricht'],
        preciseSubjects: [
          {
            id: 'austerite_necessaire',
            statement: 'L\'aust\u00e9rit\u00e9 budg\u00e9taire est n\u00e9cessaire pour \u00e9viter la crise',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'ordre'], typicalActors: ['lib\u00e9raux', 'Cour des comptes'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['gauche', '\u00e9conomistes h\u00e9t\u00e9rodoxes'] },
            ],
          },
        ],
      },
      {
        id: 'bourse_finance',
        label: 'Bourse & finance',
        keywords: ['bourse', 'cac', 'cac40', 'march\u00e9s financiers', 'wall street', 'sp\u00e9culation', 'trader', 'dividende', 'actionnaire'],
        preciseSubjects: [
          {
            id: 'taxe_transactions_financieres',
            statement: 'Une taxe sur les transactions financières (type Tobin) est indispensable',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'mobilisation'], typicalActors: ['Attac', 'gauche', 'altermondialistes'] },
              { label: 'contre', typicalNarratives: ['menace', 'ordre'], typicalActors: ['marchés financiers', 'libéraux', 'banques'] },
            ],
          },
          {
            id: 'speculation_immoral',
            statement: 'La spéculation boursière est fondamentalement immorale',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['anticapitalistes', 'gauche radicale'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['traders', 'libéraux', 'investisseurs'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    domainId: 'economie_travail',
    subjects: [
      {
        id: 'entrepreneuriat',
        label: 'Entrepreneuriat',
        keywords: ['entrepreneur', 'startup', 'entreprise', 'cr\u00e9ation d\'entreprise', 'lev\u00e9e de fonds', 'scale', 'pitch', 'incubateur', 'side hustle', 'solopreneur', 'freelance', 'personal branding', 'business plan', 'ceo', 'founder', 'acquisition', 'saas', 'b2b', 'b2c', 'mvp', 'product market fit'],
        preciseSubjects: [
          {
            id: 'startup_nation_echec',
            statement: 'La "startup nation" est un modèle qui profite aux riches et précarise les travailleurs',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['gauche', 'syndicats', 'anti-uberisation'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['entrepreneurs', 'La French Tech', 'Renaissance'] },
            ],
          },
          {
            id: 'auto_entrepreneur_precarite',
            statement: 'Le statut auto-entrepreneur masque une précarisation du travail',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['syndicats', 'sociologues', 'gauche'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['freelances', 'libéraux', 'patronat'] },
            ],
          },
        ],
      },
      {
        id: 'crypto_trading',
        label: 'Crypto & trading',
        keywords: ['crypto', 'bitcoin', 'ethereum', 'trading', 'blockchain', 'nft', 'defi', 'web3', 'token', 'altcoin', 'bull', 'bear', 'hodl', 'pump', 'dump', 'airdrop', 'staking', 'memecoin', 'solana', 'whale', 'diamond hands', 'to the moon', 'dyor', 'fomo'],
        preciseSubjects: [
          {
            id: 'crypto_arnaque',
            statement: 'Les cryptomonnaies sont principalement des arnaques spéculatives',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'menace'], typicalActors: ['régulateurs', 'économistes traditionnels', 'BCE'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['crypto-enthousiastes', 'libertariens', 'traders'] },
            ],
          },
          {
            id: 'bitcoin_monnaie_libre',
            statement: 'Le Bitcoin est la seule monnaie véritablement libre et décentralisée',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'revelation'], typicalActors: ['bitcoiners maximalistes', 'libertariens'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'menace'], typicalActors: ['banques centrales', 'écologistes', 'régulateurs'] },
            ],
          },
        ],
      },
      {
        id: 'coaching_hustle',
        label: 'Coaching & hustle culture',
        keywords: ['coaching', 'mindset', 'hustle', 'revenus passifs', 'formation', 'dropshipping', 'e-commerce', 'ecommerce', 'affiliation', 'money', 'libert\u00e9 financi\u00e8re', 'liberte financiere', 'argent facile', 'mlm', 'syst\u00e8me pyramidal', 'mastermind', 'mentoring', 'webinaire', 'tunnel de vente', 'scalable', 'personal brand'],
        preciseSubjects: [
          {
            id: 'hustle_culture_toxique',
            statement: 'La "hustle culture" et les formations en ligne sont toxiques et arnaquent les gens',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['anti-hustle', 'journalistes'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['influenceurs business', 'coachs'] },
            ],
          },
        ],
      },
      {
        id: 'investissement',
        label: 'Investissement',
        keywords: ['investissement', 'immobilier', 'scpi', 'assurance vie', 'pea', 'bourse', 'patrimoine', 'rente', 'etf', 'dividende', 'crowdfunding', 'rentier', 'rendement', 'portefeuille', 'action', 'obligation', 'livret a', 'plus-value'],
        preciseSubjects: [
          {
            id: 'immobilier_bulle',
            statement: 'L\'immobilier français est en bulle et devrait être régulé drastiquement',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['locataires', 'jeunes', 'gauche'] },
              { label: 'contre', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['propriétaires', 'agents immobiliers', 'investisseurs'] },
            ],
          },
          {
            id: 'rente_immorale',
            statement: 'Vivre de ses rentes est immoral quand d\'autres travaillent',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['anticapitalistes', 'travailleurs'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['investisseurs', 'FIRE movement', 'libéraux'] },
            ],
          },
        ],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Information & Savoirs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'actualite',
    label: 'Actualit\u00e9',
    domainId: 'information_savoirs',
    subjects: [
      {
        id: 'fait_divers',
        label: 'Faits divers',
        keywords: ['fait divers', 'drame', 'accident', 'incendie', 'meurtre', 'disparition', 'alerte enl\u00e8vement'],
        preciseSubjects: [
          {
            id: 'faits_divers_instrumentalises',
            statement: 'Les faits divers sont instrumentalisés politiquement pour alimenter le sentiment d\'insécurité',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['gauche', 'sociologues', 'médias indépendants'] },
              { label: 'contre', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['droite', 'CNews', 'victimes'] },
            ],
          },
        ],
      },
      {
        id: 'media_info',
        label: 'M\u00e9dias & information',
        keywords: ['m\u00e9dia', 'media', 'journaliste', 'journalisme', 'presse', 'r\u00e9daction', 'breaking', 'flash info', 'fake news', 'd\u00e9sinformation', 'desinformation', 'fact-checking'],
        preciseSubjects: [
          {
            id: 'medias_mainstream_fiables',
            statement: 'Les m\u00e9dias mainstream sont globalement fiables',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['journalistes', 'institutionnels'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'revelation'], typicalActors: ['m\u00e9dias alternatifs', 'populistes', 'complotistes'] },
            ],
          },
        ],
      },
      {
        id: 'catastrophe_naturelle',
        label: 'Catastrophes naturelles',
        keywords: ['s\u00e9isme', 'seisme', 'tremblement de terre', 'ouragan', 'inondation', 'tsunami', 'tornade', 'canicule', 's\u00e9cheresse', 'secheresse'],
        preciseSubjects: [
          {
            id: 'catastrophes_climat',
            statement: 'Les catastrophes naturelles sont directement liées au réchauffement climatique',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'denonciation'], typicalActors: ['climatologues', 'GIEC', 'écologistes'] },
              { label: 'contre', typicalNarratives: ['derision', 'ordre'], typicalActors: ['climato-sceptiques', 'industriels'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'education',
    label: '\u00c9ducation',
    domainId: 'information_savoirs',
    subjects: [
      {
        id: 'ecole',
        label: '\u00c9cole & syst\u00e8me scolaire',
        keywords: ['\u00e9cole', 'ecole', 'lyc\u00e9e', 'lycee', 'coll\u00e8ge', 'college', 'professeur', 'enseignant', 'rentr\u00e9e', 'rentree', 'programme scolaire', 'bac', 'baccalaur\u00e9at'],
        preciseSubjects: [
          {
            id: 'uniforme_ecole',
            statement: 'L\'uniforme doit \u00eatre impos\u00e9 \u00e0 l\'\u00e9cole',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['droite', 'Attal'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['syndicats enseignants', 'gauche'] },
            ],
          },
        ],
      },
      {
        id: 'universite',
        label: 'Universit\u00e9 & enseignement sup\u00e9rieur',
        keywords: ['universit\u00e9', 'universite', '\u00e9tudiant', 'etudiant', 'parcoursup', 'fac', 'grandes \u00e9coles', 'master', 'doctorat', 'bourse \u00e9tudiante'],
        preciseSubjects: [
          {
            id: 'selection_universite',
            statement: 'La s\u00e9lection \u00e0 l\'universit\u00e9 est n\u00e9cessaire',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['droite', 'grandes \u00e9coles'] },
              { label: 'contre', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['syndicats \u00e9tudiants', 'gauche'] },
            ],
          },
        ],
      },
      {
        id: 'ecole_privee',
        label: '\u00c9cole priv\u00e9e & in\u00e9galit\u00e9s scolaires',
        keywords: ['\u00e9cole priv\u00e9e', 'ecole privee', 'priv\u00e9 hors contrat', 'stanislas', 'mixit\u00e9 scolaire', 'carte scolaire', 's\u00e9gr\u00e9gation scolaire'],
        preciseSubjects: [
          {
            id: 'financement_ecole_privee',
            statement: 'L\'État ne devrait plus financer l\'école privée sous contrat',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['gauche', 'syndicats enseignants', 'laïques'] },
              { label: 'contre', typicalNarratives: ['ordre', 'empowerment'], typicalActors: ['enseignement catholique', 'parents école privée', 'droite'] },
            ],
          },
          {
            id: 'carte_scolaire_supprimer',
            statement: 'La carte scolaire devrait être supprimée pour permettre le libre choix',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['libéraux', 'parents classes moyennes'] },
              { label: 'contre', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['gauche', 'urbanistes', 'syndicats'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'technologie',
    label: 'Technologie',
    domainId: 'information_savoirs',
    subjects: [
      {
        id: 'ia_generative',
        label: 'IA g\u00e9n\u00e9rative',
        keywords: ['intelligence artificielle', 'chatgpt', 'openai', 'claude ai', 'midjourney', 'stable diffusion', 'ia générative', 'ia generative', 'deepfake', 'gemini ai', 'dall-e', 'copilot ai'],
        preciseSubjects: [
          {
            id: 'ia_detruit_emplois',
            statement: 'L\'IA va d\u00e9truire plus d\'emplois qu\'elle n\'en cr\u00e9e',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'urgence'], typicalActors: ['syndicats', 'technocritiques'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'inspiration'], typicalActors: ['tech optimistes', 'startups IA'] },
            ],
          },
          {
            id: 'reguler_ia',
            statement: 'L\'IA doit \u00eatre r\u00e9gul\u00e9e strictement par l\'\u00c9tat',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'ordre'], typicalActors: ['UE', 'r\u00e9gulateurs', 'AI Safety'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'menace'], typicalActors: ['startups', 'Silicon Valley', 'acc\u00e9l\u00e9rationnistes'] },
            ],
          },
        ],
      },
      {
        id: 'reseaux_sociaux',
        label: 'R\u00e9seaux sociaux & plateformes',
        keywords: ['r\u00e9seau social', 'instagram', 'tiktok', 'twitter', 'x.com', 'facebook', 'meta', 'youtube', 'snapchat', 'algorithme', 'bulle de filtre', 'addiction', 'mod\u00e9ration'],
        preciseSubjects: [
          {
            id: 'reseaux_sociaux_mineurs',
            statement: 'Les r\u00e9seaux sociaux doivent \u00eatre interdits aux moins de 16 ans',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'ordre'], typicalActors: ['parents', 'l\u00e9gislateurs', 'psychologues'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'denonciation'], typicalActors: ['plateformes', 'lib\u00e9raux'] },
            ],
          },
        ],
      },
      {
        id: 'cybersecurite',
        label: 'Cybers\u00e9curit\u00e9',
        keywords: ['cybers\u00e9curit\u00e9', 'cybersecurite', 'hacker', 'piratage', 'ransomware', 'phishing', 'donn\u00e9es personnelles', 'rgpd', 'fuite de donn\u00e9es'],
        preciseSubjects: [
          {
            id: 'rgpd_frein_innovation',
            statement: 'Le RGPD freine l\'innovation européenne face aux géants américains',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'declin'], typicalActors: ['startups', 'tech européenne', 'libéraux'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'ordre'], typicalActors: ['CNIL', 'défenseurs vie privée', 'La Quadrature'] },
            ],
          },
        ],
      },
      {
        id: 'tech_gadgets',
        label: 'Tech & gadgets',
        keywords: ['smartphone', 'iphone', 'android', 'apple', 'samsung', 'google', 'app', 'application', 'gadget', 'test', 'review', 'unboxing'],
        preciseSubjects: [
          {
            id: 'apple_monopole',
            statement: 'Apple et Google exercent un monopole abusif sur les smartphones',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['UE', 'développeurs indépendants', 'Epic Games'] },
              { label: 'contre', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['Apple', 'Google', 'consommateurs satisfaits'] },
            ],
          },
          {
            id: 'obsolescence_programmee',
            statement: 'L\'obsolescence programmée devrait être un délit pénal',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'urgence'], typicalActors: ['écologistes', 'HOP', 'consommateurs'] },
              { label: 'contre', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['constructeurs', 'industrie tech'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sante',
    label: 'Sant\u00e9',
    domainId: 'information_savoirs',
    subjects: [
      {
        id: 'hopital_soins',
        label: 'H\u00f4pital & soins',
        keywords: ['h\u00f4pital', 'hopital', 'm\u00e9decin', 'medecin', 'soignant', 'infirmier', 'urgences', 'd\u00e9sert m\u00e9dical', 'desert medical', 'ap-hp', 'chu'],
        preciseSubjects: [
          {
            id: 'hopital_public_danger',
            statement: 'L\'h\u00f4pital public est en danger \u00e0 cause des coupes budg\u00e9taires',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'urgence'], typicalActors: ['soignants', 'syndicats', 'gauche'] },
              { label: 'contre', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['lib\u00e9raux', 'gestionnaires'] },
            ],
          },
        ],
      },
      {
        id: 'vaccination',
        label: 'Vaccination',
        keywords: ['vaccin', 'vaccination', 'anti-vax', 'antivax', 'pfizer', 'moderna', 'dose', 'pass sanitaire', 'obligation vaccinale'],
        preciseSubjects: [
          {
            id: 'obligation_vaccinale',
            statement: 'La vaccination obligatoire est une atteinte aux libert\u00e9s',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'menace'], typicalActors: ['anti-vax', 'libertariens'] },
              { label: 'contre', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['m\u00e9decins', 'autorit\u00e9s sanitaires'] },
            ],
          },
        ],
      },
      {
        id: 'sante_mentale',
        label: 'Sant\u00e9 mentale',
        keywords: ['sant\u00e9 mentale', 'sante mentale', 'd\u00e9pression', 'depression', 'anxi\u00e9t\u00e9', 'anxiete', 'burn-out', 'burnout', 'th\u00e9rapie', 'therapie', 'psychiatrie', 'psychologue'],
        preciseSubjects: [
          {
            id: 'sante_mentale_crise',
            statement: 'La France traverse une crise majeure de santé mentale ignorée par les pouvoirs publics',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'denonciation'], typicalActors: ['psychiatres', 'psychologues', 'étudiants'] },
              { label: 'contre', typicalNarratives: ['ordre'], typicalActors: ['gouvernement', 'gestionnaires santé'] },
            ],
          },
          {
            id: 'psychologue_rembourse',
            statement: 'Les consultations psy devraient être intégralement remboursées',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'mobilisation'], typicalActors: ['psychologues', 'patients', 'gauche'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['Sécu', 'gestionnaires budget'] },
            ],
          },
        ],
      },
      {
        id: 'drogue_addiction',
        label: 'Drogues & addictions',
        keywords: ['drogue', 'cannabis', 'l\u00e9galisation', 'legalisation', 'addiction', 'alcool', 'tabac', 'opio\u00efdes', 'opioides', 'crack', 'salle de shoot'],
        preciseSubjects: [
          {
            id: 'legalisation_cannabis',
            statement: 'Le cannabis doit \u00eatre l\u00e9galis\u00e9 en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['gauche', 'lib\u00e9raux', 'associations'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['droite', 'police', 'conservateurs'] },
            ],
          },
        ],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Culture & Divertissement
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'culture',
    label: 'Culture',
    domainId: 'culture_divertissement',
    subjects: [
      {
        id: 'cinema',
        label: 'Cin\u00e9ma',
        keywords: ['cin\u00e9ma', 'cinema', 'film', 'r\u00e9alisateur', 'realisateur', 'acteur', 'actrice', 'cannes', 'c\u00e9sar', 'cesar', 'oscar', 'blockbuster', 'box office', 'trailer', 'bande-annonce', 'bande annonce', 'avant-premi\u00e8re', 'avant premiere', 'cin\u00e9phile', 'cinephile', 'screening'],
        preciseSubjects: [
          {
            id: 'cinema_francais_declin',
            statement: 'Le cin\u00e9ma fran\u00e7ais est en d\u00e9clin face au streaming',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'denonciation'], typicalActors: ['cin\u00e9astes traditionnels', 'exploitants salles'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['plateformes', 'jeunes r\u00e9alisateurs'] },
            ],
          },
        ],
      },
      {
        id: 'musique',
        label: 'Musique',
        keywords: ['musique', 'rappeur', 'rap', 'chanteur', 'chanteuse', 'album', 'single', 'concert', 'festival', 'spotify', 'victoires de la musique', 'playlist', 'dj', 'beatmaker', 'feat', 'featuring', 'clip', 'vinyle', 'vinyl', 'rock', 'pop', 'electro', 'jazz', 'classique', 'afrobeat', 'm\u00e9lodie'],
        preciseSubjects: [
          {
            id: 'rap_violence_misogynie',
            statement: 'Le rap français véhicule trop de violence et de misogynie',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'menace'], typicalActors: ['conservateurs', 'féministes', 'parents'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'denonciation'], typicalActors: ['rappeurs', 'fans rap', 'liberté d\'expression'] },
            ],
          },
          {
            id: 'streaming_tue_musique',
            statement: 'Le streaming (Spotify, Deezer) détruit la rémunération des artistes',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['artistes indépendants', 'labels', 'syndicats'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['plateformes', 'consommateurs', 'artistes émergents'] },
            ],
          },
        ],
      },
      {
        id: 'series_tv',
        label: 'S\u00e9ries & TV',
        keywords: ['s\u00e9rie', 'serie', 'netflix', 'disney+', 'prime video', '\u00e9mission', 'emission', 't\u00e9l\u00e9r\u00e9alit\u00e9', 'telerealite', 'saison', '\u00e9pisode', 'episode', 'binge', 'spoiler', 'cliffhanger', 'recap', 'rewatch', 'showrunner', 'hbo', 'apple tv', 'canal+', 'canal plus'],
        preciseSubjects: [
          {
            id: 'netflix_culture',
            statement: 'Les plateformes de streaming uniformisent la culture mondiale',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'denonciation'], typicalActors: ['cinéastes', 'exception culturelle', 'intellos'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['consommateurs', 'créateurs indépendants'] },
            ],
          },
        ],
      },
      {
        id: 'litterature',
        label: 'Litt\u00e9rature',
        keywords: ['livre', 'roman', 'auteur', 'autrice', 'litt\u00e9rature', 'litterature', 'goncourt', 'lecture', 'librairie', 'best-seller', 'bd', 'manga', 'booktok', 'bookstagram', 'biblioth\u00e8que', 'bibliotheque', 'page turner', 'tbr', 'reading list', 'kindle'],
        preciseSubjects: [
          {
            id: 'booktok_nivellement',
            statement: 'BookTok nivelle la littérature vers le bas avec des lectures commerciales',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'denonciation'], typicalActors: ['critiques littéraires', 'libraires indépendants'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['booktokers', 'éditeurs', 'jeunes lecteurs'] },
            ],
          },
        ],
      },
      {
        id: 'art_patrimoine',
        label: 'Art & patrimoine',
        keywords: ['mus\u00e9e', 'musee', 'exposition', 'galerie', 'patrimoine', '\u0153uvre', 'oeuvre', 'artiste', 'peinture', 'sculpture', 'street art', 'beaux-arts', 'art contemporain', 'vernissage', 'biennale', 'design', 'photographie', 'illustration', 'graffiti', 'fresque', 'architecture'],
        preciseSubjects: [
          {
            id: 'ia_menace_creation',
            statement: 'L\'IA g\u00e9n\u00e9rative menace la cr\u00e9ation artistique',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['artistes', 'illustrateurs', 'syndicats'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['tech', 'startups IA', 'early adopters'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'humour',
    label: 'Humour',
    domainId: 'culture_divertissement',
    subjects: [
      {
        id: 'memes',
        label: 'M\u00e8mes & shitpost',
        keywords: ['meme', 'm\u00e8me', 'shitpost', 'mdr', 'ptdr', 'lol', 'troll', 'cursed', 'based', 'sus'],
        preciseSubjects: [
          {
            id: 'memes_propagande',
            statement: 'Les mèmes sont devenus un outil de propagande politique efficace',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['chercheurs', 'fact-checkers', 'régulateurs'] },
              { label: 'contre', typicalNarratives: ['derision', 'empowerment'], typicalActors: ['communautés mème', 'trolls', 'internautes'] },
            ],
          },
        ],
      },
      {
        id: 'humour_sketch',
        label: 'Humour & sketches',
        keywords: ['humour', 'blague', 'sketch', 'parodie', 'satire', 'stand-up', 'humoriste', 'dr\u00f4le', 'drole', 'hilarant', 'ironie'],
        preciseSubjects: [
          {
            id: 'cancel_culture_humour',
            statement: 'La cancel culture empêche les humoristes de s\'exprimer librement',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'menace'], typicalActors: ['humoristes', 'droite', 'anti-woke'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'denonciation'], typicalActors: ['militants anti-discrimination', 'féministes'] },
            ],
          },
        ],
      },
      {
        id: 'humour_politique',
        label: 'Humour politique & satire',
        keywords: ['caricature', 'satire politique', 'canard encha\u00een\u00e9', 'gorafi', 'charlie hebdo', 'd\u00e9tournement'],
        preciseSubjects: [
          {
            id: 'limites_humour',
            statement: 'L\'humour doit pouvoir rire de tout sans limites',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'derision'], typicalActors: ['humoristes', 'Charlie Hebdo'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['associations', 'militants anti-discrimination'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'divertissement',
    label: 'Divertissement',
    domainId: 'culture_divertissement',
    subjects: [
      {
        id: 'gaming',
        label: 'Jeux vid\u00e9o & gaming',
        keywords: ['jeu vid\u00e9o', 'jeu video', 'gaming', 'gamer', 'playstation', 'xbox', 'nintendo', 'switch', 'pc gaming', 'esport', 'twitch', 'stream', 'fortnite', 'minecraft', 'ps5', 'ps4', 'xbox series', 'steam', 'epic games', 'fps', 'rpg', 'mmorpg', 'battle royale', 'speedrun', 'gameplay', 'raid'],
        preciseSubjects: [
          {
            id: 'jeux_video_violence',
            statement: 'Les jeux vid\u00e9o rendent violent',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'ordre'], typicalActors: ['conservateurs', 'parents', 'politiques'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['gamers', 'chercheurs', 'industrie'] },
            ],
          },
        ],
      },
      {
        id: 'jeux_de_societe',
        label: 'Jeux de société & jeux de plateau',
        keywords: ['jeu de société', 'jeu de societe', 'jeux de société', 'jeux de societe', 'board game', 'boardgame', 'jeu de plateau', 'jeu de cartes', 'jeu de rôle', 'jeu de role', 'jdr', 'dnd', 'donjons et dragons', 'dice', 'dés', 'meeple', 'figurine', 'wargame', 'catan', 'wingspan', 'ludique', 'ludothèque', 'ludotheque', 'soirée jeux', 'boardgamegeek'],
        preciseSubjects: [
          {
            id: 'jeux_societe_meilleur_que_ecrans',
            statement: 'Les jeux de société sont meilleurs que les écrans pour le développement social',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['aspiration', 'ordre'], typicalActors: ['parents', 'éducateurs', 'ludothèques'] },
              { label: 'contre', typicalNarratives: ['derision', 'empowerment'], typicalActors: ['gamers', 'industrie jeux vidéo'] },
            ],
          },
        ],
      },
      {
        id: 'people_celebrites',
        label: 'People & c\u00e9l\u00e9brit\u00e9s',
        keywords: ['people', 'c\u00e9l\u00e9brit\u00e9', 'celebrite', 'star', 'buzz', 'viral', 'influenceur', 'influenceuse', 'youtubeur', 'tiktokeur', 'gossip', 'paparazzi', 'tapis rouge', 'red carpet', 'interview', 'podcast', 'clash', 'drama'],
        preciseSubjects: [
          {
            id: 'influenceurs_reguler',
            statement: 'Les influenceurs devraient être régulés comme des médias',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['DGCCRF', 'législateurs', 'consommateurs'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'menace'], typicalActors: ['influenceurs', 'agences', 'plateformes'] },
            ],
          },
          {
            id: 'culture_celebrite_toxique',
            statement: 'La culture de la célébrité sur les réseaux sociaux est toxique pour la jeunesse',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['psychologues', 'parents', 'éducateurs'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['influenceurs', 'jeunes', 'plateformes'] },
            ],
          },
        ],
      },
      {
        id: 'telerealite',
        label: 'T\u00e9l\u00e9r\u00e9alit\u00e9',
        keywords: ['t\u00e9l\u00e9r\u00e9alit\u00e9', 'telerealite', 'reality', 'les marseillais', 'koh lanta', 'secret story', 'star academy', 'candidat', 'villa', 'les anges', 'tpmp', 'touche pas \u00e0 mon poste', 'big brother', 'bachelor'],
        preciseSubjects: [
          {
            id: 'telerealite_trash',
            statement: 'La téléréalité devrait être interdite car elle exploite et humilie les participants',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'menace'], typicalActors: ['CSA/Arcom', 'intellectuels', 'éducateurs'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'derision'], typicalActors: ['candidats', 'producteurs', 'téléspectateurs'] },
            ],
          },
        ],
      },
      {
        id: 'anime_manga',
        label: 'Anime & manga',
        keywords: ['anime', 'manga', 'otaku', 'shonen', 'one piece', 'naruto', 'dragon ball', 'cosplay', 'japanimation', 'webtoon', 'shojo', 'seinen', 'isekai', 'demon slayer', 'jujutsu kaisen', 'crunchyroll', 'fan art', 'figurine', 'waifu'],
        preciseSubjects: [
          {
            id: 'anime_representation',
            statement: 'Les anime/manga véhiculent des stéréotypes sexistes et raciaux problématiques',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['féministes', 'critiques culturels'] },
              { label: 'contre', typicalNarratives: ['derision', 'empowerment'], typicalActors: ['fans anime', 'otakus', 'mangakas'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sport',
    label: 'Sport',
    domainId: 'culture_divertissement',
    subjects: [
      {
        id: 'football',
        label: 'Football',
        keywords: ['football', 'ligue 1', 'champions league', 'psg', 'coupe du monde', 'mbappe', 'mbapp\u00e9', 'ballon d\'or', 'mercato', 'premier league', 'bundesliga', 'penalty', 'carton rouge', 'transfert foot', 'supporter foot', 'ultras', 'tifo', 'derby foot', 'classico'],
        preciseSubjects: [
          {
            id: 'foot_argent_tue',
            statement: 'L\'argent du football (transferts, salaires, Qatar/Arabie) dénature ce sport',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'declin'], typicalActors: ['supporters traditionnels', 'petits clubs', 'ultras'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'ordre'], typicalActors: ['dirigeants clubs', 'ligues', 'investisseurs'] },
            ],
          },
          {
            id: 'psg_ligue1',
            statement: 'Le PSG tue la compétitivité de la Ligue 1',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'declin'], typicalActors: ['supporters rivaux', 'journalistes sportifs'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['supporters PSG', 'Qatar Sports Investments'] },
            ],
          },
        ],
      },
      {
        id: 'sports_combat',
        label: 'Sports de combat & MMA',
        keywords: ['mma', 'ufc', 'boxe', 'kickboxing', 'judo', 'karat\u00e9', 'karate', 'octogone', 'sparring', 'muay thai', 'bjj', 'jiu-jitsu', 'grappling'],
        preciseSubjects: [
          {
            id: 'mma_violence',
            statement: 'Le MMA est un sport trop violent qui devrait être plus encadré',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'ordre'], typicalActors: ['médecins', 'conservateurs', 'certains politiques'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'derision'], typicalActors: ['combattants', 'fans MMA', 'promoteurs'] },
            ],
          },
        ],
      },
      {
        id: 'jo_competition',
        label: 'JO & comp\u00e9titions internationales',
        keywords: ['jeux olympiques', 'olympique', 'paralympique', 'champion du monde', 'médaille d\'or', 'medaille d\'or', 'coupe du monde', 'championnat du monde', 'paris 2024', 'record du monde', 'qualifications', 'équipe de france', 'equipe de france'],
        preciseSubjects: [
          {
            id: 'jo_sportswashing',
            statement: 'Les JO et grandes compétitions sont du sportswashing pour pays autoritaires',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['ONG droits humains', 'journalistes', 'militants'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'mobilisation'], typicalActors: ['CIO', 'FIFA', 'pays hôtes'] },
            ],
          },
          {
            id: 'athletes_trans_competition',
            statement: 'Les athlètes transgenres devraient pouvoir concourir dans leur genre d\'identification',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['associations trans', 'progressistes'] },
              { label: 'contre', typicalNarratives: ['ordre', 'injustice'], typicalActors: ['sportives cisgenres', 'fédérations', 'conservateurs'] },
            ],
          },
        ],
      },
      {
        id: 'fitness',
        label: 'Fitness & musculation',
        keywords: ['musculation', 'fitness', 'crossfit', 'marathon', 'prise de masse', 'coach sportif', 'workout', 'deadlift', 'bench press', 'cardio', 'hiit', 'whey'],
        preciseSubjects: [
          {
            id: 'sport_feminin_sous_mediatise',
            statement: 'Le sport f\u00e9minin est sous-m\u00e9diatis\u00e9',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['sportives', 'f\u00e9ministes', 'associations'] },
              { label: 'contre', typicalNarratives: ['ordre'], typicalActors: ['m\u00e9dias traditionnels', 'conservateurs'] },
            ],
          },
        ],
      },
      {
        id: 'autres_sports',
        label: 'Autres sports',
        keywords: ['tennis', 'rugby', 'basket', 'nba', 'cyclisme', 'tour de france', 'f1', 'formule 1', 'natation', 'athl\u00e9tisme', 'golf', 'ski', 'padel', 'surf', 'escalade', 'climbing', 'trail', 'triathlon', 'volley', 'handball', 'patinage'],
        preciseSubjects: [
          {
            id: 'dopage_sport',
            statement: 'Le dopage est inévitable dans le sport de haut niveau et devrait être toléré',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['derision', 'revelation'], typicalActors: ['certains athlètes', 'libertariens'] },
              { label: 'contre', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['AMA', 'fédérations', 'sport propre'] },
            ],
          },
        ],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Lifestyle & Bien-être
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    domainId: 'lifestyle_bienetre',
    subjects: [
      {
        id: 'mode',
        label: 'Mode & luxe',
        keywords: ['mode', 'fashion', 'ootd', 'outfit', 'luxe', 'haute couture', 'tendance', 'vintage', 'streetwear', 'fast fashion', 'shein', 'zara', 'haul', 'try on', 'grwm', 'capsule wardrobe'],
        preciseSubjects: [
          {
            id: 'fast_fashion_interdire',
            statement: 'La fast fashion devrait être interdite ou lourdement taxée',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'urgence'], typicalActors: ['écologistes', 'créateurs locaux'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['consommateurs', 'marques low cost'] },
            ],
          },
        ],
      },
      {
        id: 'organisation_productivite',
        label: 'Organisation & productivité',
        keywords: ['organisation', 'productivité', 'productivite', 'routine', 'morning routine', 'planning', 'bullet journal', 'notion', 'to-do', 'time management'],
        preciseSubjects: [
          {
            id: 'productivite_obsession',
            statement: 'L\'obsession de la productivité est un symptôme de la culture capitaliste qui rend malade',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'declin'], typicalActors: ['anti-hustle', 'psychologues', 'slow movement'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['coaches productivité', 'entrepreneurs'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'food',
    label: 'Cuisine & gastronomie',
    domainId: 'lifestyle_bienetre',
    subjects: [
      {
        id: 'recettes',
        label: 'Recettes & cuisine maison',
        keywords: ['recette', 'cuisine', 'food', 'foodporn', 'cooking', 'fait maison', 'batch cooking', 'meal prep', 'pâtisserie', 'patisserie', 'boulangerie', 'gâteau', 'gateau', 'tarte', 'dessert', 'plat', 'ingrédient', 'ingredient'],
        preciseSubjects: [
          {
            id: 'cuisine_maison_luxe',
            statement: 'Cuisiner maison est devenu un luxe que les classes populaires ne peuvent pas se permettre',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['travailleurs précaires', 'sociologues'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['influenceurs cuisine', 'batch cookers'] },
            ],
          },
        ],
      },
      {
        id: 'restaurants',
        label: 'Restaurants & sorties food',
        keywords: ['restaurant', 'gastronomie', 'chef', 'brunch', 'bistro', 'étoilé', 'michelin', 'terrasse', 'bar', 'café', 'foodie', 'street food', 'fast food', 'brasserie', 'dégustation'],
        preciseSubjects: [
          {
            id: 'fast_food_interdire_pub',
            statement: 'La publicité pour le fast food devrait être interdite comme le tabac',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'denonciation'], typicalActors: ['nutritionnistes', 'OMS', 'écologistes'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'ordre'], typicalActors: ['industrie food', 'libéraux', 'consommateurs'] },
            ],
          },
        ],
      },
      {
        id: 'alimentation_saine',
        label: 'Alimentation saine & régimes',
        keywords: ['vegan', 'végétarien', 'vegetarien', 'alimentation bio', 'produit bio', 'sans gluten', 'healthy', 'nutrition', 'protéines', 'proteines', 'calories', 'régime alimentaire', 'détox', 'detox', 'superaliment', 'smoothie'],
        preciseSubjects: [
          {
            id: 'veganisme_imperatif',
            statement: 'Le véganisme est un impératif éthique',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'denonciation'], typicalActors: ['associations animales', 'L214'] },
              { label: 'contre', typicalNarratives: ['derision', 'ordre'], typicalActors: ['agriculteurs', 'traditionalistes'] },
            ],
          },
        ],
      },
      {
        id: 'boissons',
        label: 'Boissons & cocktails',
        keywords: ['cocktail', 'bière artisanale', 'craft beer', 'whisky', 'spiritueux', 'barista', 'latte art', 'matcha latte', 'sommelier', 'dégustation vin', 'dégustation bière', 'mixologie', 'bar à vin'],
        preciseSubjects: [
          {
            id: 'pub_alcool_interdire',
            statement: 'Toute publicité pour l\'alcool devrait être totalement interdite',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'denonciation'], typicalActors: ['addictologues', 'associations santé'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'ordre'], typicalActors: ['vignerons', 'industrie alcool', 'libéraux'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'voyage',
    label: 'Voyage & découverte',
    domainId: 'lifestyle_bienetre',
    subjects: [
      {
        id: 'destinations',
        label: 'Destinations & itinéraires',
        keywords: ['voyage', 'travel', 'destination', 'vacances', 'séjour', 'itinéraire', 'city trip', 'escapade', 'week-end', 'paradis', 'plage', 'île', 'montagne'],
        preciseSubjects: [
          {
            id: 'tourisme_masse_detruit',
            statement: 'Le tourisme de masse détruit les destinations et devrait être limité',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'urgence'], typicalActors: ['écologistes', 'locaux', 'Venise/Barcelone'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['industrie tourisme', 'compagnies aériennes'] },
            ],
          },
        ],
      },
      {
        id: 'aventure_backpack',
        label: 'Aventure & backpacking',
        keywords: ['backpack', 'road trip', 'nomade', 'van life', 'vanlife', 'randonnée', 'randonnee', 'trek', 'aventure', 'camping', 'bivouac', 'sac à dos'],
        preciseSubjects: [
          {
            id: 'nomadisme_digital_privilege',
            statement: 'Le nomadisme digital est un privilège de riches occidentaux qui gentrifie les pays du Sud',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['locaux pays concernés', 'critiques sociaux'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['digital nomads', 'freelances', 'influenceurs voyage'] },
            ],
          },
        ],
      },
      {
        id: 'transport_hebergement',
        label: 'Transport & hébergement',
        keywords: ['aéroport', 'aeroport', 'hôtel', 'hotel', 'airbnb', 'avion', 'billet', 'vol', 'train', 'croisière', 'croisiere', 'auberge', 'gîte', 'glamping'],
        preciseSubjects: [
          {
            id: 'airbnb_interdire',
            statement: 'Airbnb devrait être interdit dans les grandes villes pour protéger le logement',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['locataires', 'mairies', 'gauche'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['propriétaires', 'touristes', 'Airbnb'] },
            ],
          },
          {
            id: 'avion_taxer',
            statement: 'L\'avion devrait être beaucoup plus taxé voire interdit pour les vols courts',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'denonciation'], typicalActors: ['écologistes', 'flygskam', 'SNCF'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'menace'], typicalActors: ['compagnies aériennes', 'ruraux', 'industrie tourisme'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'maison_jardin',
    label: 'Maison & jardin',
    domainId: 'lifestyle_bienetre',
    subjects: [
      {
        id: 'deco_interieur',
        label: 'Déco & intérieur',
        keywords: ['décoration', 'decoration', 'déco intérieur', 'deco interieur', 'aménagement', 'amenagement', 'ikea', 'cocooning', 'design intérieur', 'design interieur', 'meuble', 'salon', 'chambre', 'scandinave', 'bohème', 'minimaliste'],
        preciseSubjects: [
          {
            id: 'ikea_uniformisation',
            statement: 'IKEA et la déco Instagram uniformisent les intérieurs et tuent l\'authenticité',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'denonciation'], typicalActors: ['designers', 'artisans', 'anti-consuméristes'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['consommateurs', 'IKEA', 'influenceuses déco'] },
            ],
          },
        ],
      },
      {
        id: 'bricolage',
        label: 'Bricolage & rénovation',
        keywords: ['bricolage', 'rénovation', 'renovation', 'travaux', 'peinture', 'carrelage', 'parquet', 'diy', 'do it yourself', 'leroy merlin', 'castorama', 'outillage'],
        preciseSubjects: [
          {
            id: 'renovation_energetique_obligatoire',
            statement: 'La rénovation énergétique obligatoire des passoires thermiques est injuste pour les petits propriétaires',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'menace'], typicalActors: ['petits propriétaires', 'artisans', 'droite'] },
              { label: 'contre', typicalNarratives: ['urgence', 'ordre'], typicalActors: ['écologistes', 'gouvernement', 'locataires'] },
            ],
          },
        ],
      },
      {
        id: 'jardinage',
        label: 'Jardinage & plantes',
        keywords: ['jardin', 'jardinage', 'plante', 'potager', 'fleur', 'terrasse', 'balcon', 'arrosage', 'semis', 'bouture', 'compost', 'plant mom', 'urban jungle', 'monstera', 'succulent'],
        preciseSubjects: [
          {
            id: 'potager_autosuffisance',
            statement: 'L\'autosuffisance alimentaire par le potager est un idéal réaliste',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['permaculteurs', 'survivalistes', 'écologistes'] },
              { label: 'contre', typicalNarratives: ['derision', 'ordre'], typicalActors: ['agronomes', 'réalistes', 'agriculteurs pros'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'beaute',
    label: 'Beaut\u00e9',
    domainId: 'lifestyle_bienetre',
    subjects: [
      {
        id: 'skincare',
        label: 'Skincare',
        keywords: ['skincare', 'soin', 'cr\u00e8me', 'creme', 's\u00e9rum', 'serum', 'nettoyant', 'routine soin', 'acn\u00e9', 'acne', 'peau', 'hydratant', 'spf', 'niacinamide', 'retinol', 'vitamine c', 'the ordinary', 'cerave', 'routine', 'glow', 'clean beauty', 'dermatologue'],
        preciseSubjects: [
          {
            id: 'standards_beaute_toxiques',
            statement: 'Les standards de beaut\u00e9 sur Instagram sont toxiques',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['body positive', 'f\u00e9ministes', 'psychologues'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['influenceuses beaut\u00e9', 'marques'] },
            ],
          },
        ],
      },
      {
        id: 'maquillage',
        label: 'Maquillage',
        keywords: ['maquillage', 'makeup', 'mascara', 'rouge \u00e0 l\u00e8vres', 'foundation', 'fond de teint', 'tuto', 'tutorial', 'contouring', 'grwm', 'get ready with me', 'fenty', 'sephora', 'palette', 'highlighter', 'blush', 'liner', 'gloss', 'primer', 'setting spray'],
        preciseSubjects: [
          {
            id: 'test_animaux_cosmetiques',
            statement: 'Les tests sur animaux pour les cosmétiques devraient être totalement bannis mondialement',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'mobilisation'], typicalActors: ['associations animales', 'consommateurs', 'marques cruelty-free'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['industrie cosmétique Chine', 'régulateurs'] },
            ],
          },
        ],
      },
      {
        id: 'coiffure',
        label: 'Coiffure',
        keywords: ['coiffure', 'cheveux', 'hair', 'coloration', 'coupe', 'lissage', 'boucles', 'natural hair', 'balayage', 'ombr\u00e9', 'ombre', 'braids', 'tresses', 'twist', 'silk press', 'curly girl', 'shampoing'],
        preciseSubjects: [
          {
            id: 'appropriation_culturelle_coiffure',
            statement: 'Porter des tresses ou dreadlocks quand on est blanc est de l\'appropriation culturelle',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['militants antiracistes', 'communautés afro'] },
              { label: 'contre', typicalNarratives: ['derision', 'empowerment'], typicalActors: ['universalistes', 'défenseurs liberté individuelle'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'developpement_personnel',
    label: 'D\u00e9veloppement personnel',
    domainId: 'lifestyle_bienetre',
    subjects: [
      {
        id: 'meditation_mindfulness',
        label: 'M\u00e9ditation & pleine conscience',
        keywords: ['m\u00e9ditation', 'meditation', 'pleine conscience', 'mindfulness', 'respiration', 'yoga', 'zen', 'calme', 'stress', 'relaxation', 'sophrologie', 'hypnose', 'coh\u00e9rence cardiaque', 'coherence cardiaque', 'ancrage', 'grounding', 'self-care', 'morning routine', 'journaling'],
        preciseSubjects: [
          {
            id: 'mindfulness_recupere_capitalisme',
            statement: 'La pleine conscience a été récupérée par le capitalisme pour éviter de questionner les conditions de travail',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['critiques sociaux', 'gauche', 'McMindfulness'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['coachs', 'apps méditation', 'pratiquants'] },
            ],
          },
        ],
      },
      {
        id: 'motivation',
        label: 'Motivation & citations',
        keywords: ['motivation', 'confiance en soi', 'affirmation', 'r\u00e9silience', 'resilience', 'citation', 'quote', 'inspirant', 'growth', 'croissance personnelle', 'discipline', 'objectif', 'vision board', 'gratitude', 'never give up', 'focus', 'achieve', 'manifest'],
        preciseSubjects: [
          {
            id: 'pensee_positive_toxique',
            statement: 'La positivité toxique ("good vibes only") est nocive et invalide les émotions négatives',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'empowerment'], typicalActors: ['psychologues', 'critiques dev perso'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['influenceurs motivation', 'coachs'] },
            ],
          },
        ],
      },
      {
        id: 'spiritualite_new_age',
        label: 'Spiritualit\u00e9 & new age',
        keywords: ['spiritualit\u00e9', 'spiritualite', 'loi d\'attraction', 'manifestation', 'chakra', '\u00e9nergie', 'energie', 'astrologie', 'tarot', 'cristal', 'pleine lune', 'horoscope', 'signe astro', 'lithoth\u00e9rapie', 'lithotherapie', 'oracle', 'soin \u00e9nerg\u00e9tique', 'reiki'],
        preciseSubjects: [
          {
            id: 'coaching_charlatanisme',
            statement: 'Le coaching en d\u00e9veloppement personnel est souvent du charlatanisme',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['sceptiques', 'journalistes', 'scientifiques'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['coachs', 'influenceurs dev perso'] },
            ],
          },
        ],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Vie quotidienne
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'animaux',
    label: 'Animaux',
    domainId: 'vie_quotidienne',
    subjects: [
      {
        id: 'chiens',
        label: 'Chiens',
        keywords: ['chien', 'chiot', 'puppy', 'dog', 'golden retriever', 'berger', 'labrador', 'bouledogue', 'caniche', 'husky', 'promenade chien', 'dressage', 'croquettes'],
        preciseSubjects: [
          {
            id: 'races_dangereuses_interdire',
            statement: 'Certaines races de chiens dangereuses devraient être interdites',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['victimes morsures', 'législateurs', 'vétérinaires'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'denonciation'], typicalActors: ['éleveurs', 'propriétaires', 'associations canines'] },
            ],
          },
        ],
      },
      {
        id: 'chats',
        label: 'Chats',
        keywords: ['chat', 'chaton', 'kitten', 'cat', 'miaou', 'félin', 'felin', 'ronron', 'litière', 'litiere', 'croquettes chat', 'siamois', 'persan', 'maine coon'],
        preciseSubjects: [
          {
            id: 'chats_libres_interdire',
            statement: 'Les chats devraient être gardés en intérieur pour protéger la biodiversité',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'denonciation'], typicalActors: ['ornithologues', 'écologistes', 'LPO'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'derision'], typicalActors: ['propriétaires de chats', 'vétérinaires'] },
            ],
          },
        ],
      },
      {
        id: 'animaux_divers',
        label: 'Autres animaux & protection',
        keywords: ['animal', 'animaux', 'spa', 'refuge', 'adoption', 'maltraitance animale', 'vétérinaire', 'veterinaire', 'hamster', 'lapin', 'poisson', 'perroquet', 'reptile', 'cheval', 'équitation', 'aquarium', 'terrarium'],
        preciseSubjects: [
          {
            id: 'elevage_intensif',
            statement: 'L\'élevage intensif devrait être interdit',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'urgence'], typicalActors: ['L214', 'véganistes', 'écologistes'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['éleveurs', 'FNSEA', 'industrie agro'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'parentalite',
    label: 'Parentalité & famille',
    domainId: 'vie_quotidienne',
    subjects: [
      {
        id: 'grossesse_naissance',
        label: 'Grossesse & naissance',
        keywords: ['grossesse', 'enceinte', 'bébé', 'bebe', 'naissance', 'accouchement', 'maternité', 'maternite', 'prénatal', 'prenatal', 'échographie', 'baby shower', 'congé maternité', 'sage-femme'],
        preciseSubjects: [
          {
            id: 'accouchement_medicalise',
            statement: 'L\'accouchement est trop médicalisé en France et les femmes manquent de choix',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'denonciation'], typicalActors: ['collectifs naissance', 'sages-femmes', 'doulas'] },
              { label: 'contre', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['obstétriciens', 'hôpitaux'] },
            ],
          },
          {
            id: 'sharenting',
            statement: 'Exposer ses enfants sur les réseaux sociaux (sharenting) devrait être interdit',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'ordre'], typicalActors: ['CNIL', 'pédiatres', 'défenseurs droits enfants'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'derision'], typicalActors: ['parents influenceurs', 'familles connectées'] },
            ],
          },
        ],
      },
      {
        id: 'education_enfants',
        label: 'Éducation & vie de famille',
        keywords: ['enfant', 'maman', 'papa', 'parent', 'famille', 'parentalité', 'parentalite', 'éducation bienveillante', 'montessori', 'crèche', 'creche', 'garde', 'école maternelle', 'goûter', 'activité enfant', 'mère au foyer', 'père au foyer', 'momlife'],
        preciseSubjects: [
          {
            id: 'ecrans_enfants',
            statement: 'Les écrans devraient être interdits aux enfants avant 6 ans',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['pédiatres', 'psychologues', 'parents inquiets'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'derision'], typicalActors: ['parents pragmatiques', 'industrie tech'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'automobile',
    label: 'Automobile & moto',
    domainId: 'vie_quotidienne',
    subjects: [
      {
        id: 'voitures',
        label: 'Voitures',
        keywords: ['voiture', 'auto', 'automobile', 'bmw', 'mercedes', 'audi', 'porsche', 'ferrari', 'lamborghini', 'tesla', 'berline', 'suv', 'cabriolet', 'tuning', 'carrosserie', 'moteur', 'chevaux', 'cv', 'permis de conduire'],
        preciseSubjects: [
          {
            id: 'suv_interdire_ville',
            statement: 'Les SUV devraient être interdits en ville',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'urgence'], typicalActors: ['écologistes', 'mairie Paris', 'piétons'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'menace'], typicalActors: ['automobilistes', 'constructeurs', 'familles'] },
            ],
          },
          {
            id: 'voiture_autonome',
            statement: 'La voiture autonome va rendre nos routes plus sûres',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['aspiration', 'empowerment'], typicalActors: ['Tesla', 'tech optimistes', 'assureurs'] },
              { label: 'contre', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['syndicats chauffeurs', 'sceptiques tech'] },
            ],
          },
        ],
      },
      {
        id: 'moto',
        label: 'Motos & deux-roues',
        keywords: ['moto', 'motard', 'biker', 'scooter', 'harley', 'ducati', 'yamaha', 'kawasaki', 'casque moto', 'roadster', 'sportive', 'trail moto', 'enduro', 'supermotard'],
        preciseSubjects: [
          {
            id: 'circulation_interfiles',
            statement: 'La circulation inter-files des motos devrait être définitivement autorisée',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['motards', 'FFMC', 'usagers quotidiens'] },
              { label: 'contre', typicalNarratives: ['menace', 'ordre'], typicalActors: ['automobilistes', 'sécurité routière'] },
            ],
          },
        ],
      },
      {
        id: 'vehicules_electriques',
        label: 'Véhicules électriques',
        keywords: ['véhicule électrique', 'vehicule electrique', 'voiture électrique', 'voiture electrique', 'tesla', 'borne de recharge', 'autonomie', 'batterie', 'hybride'],
        preciseSubjects: [
          {
            id: 'fin_thermique_2035',
            statement: 'L\'interdiction des véhicules thermiques en 2035 est réaliste',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'aspiration'], typicalActors: ['écologistes', 'constructeurs EV'] },
              { label: 'contre', typicalNarratives: ['menace', 'injustice'], typicalActors: ['automobilistes', 'industrie pétrolière', 'ruraux'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'shopping',
    label: 'Shopping & bons plans',
    domainId: 'vie_quotidienne',
    subjects: [
      {
        id: 'hauls_reviews',
        label: 'Hauls & avis produits',
        keywords: ['haul', 'unboxing', 'review', 'avis', 'test produit', 'comparatif', 'meilleur', 'top produit', 'indispensable', 'coup de coeur', 'must have', 'wishlist', 'favoris'],
        preciseSubjects: [
          {
            id: 'placements_produits_trompeurs',
            statement: 'Les placements de produits déguisés des influenceurs sont de la publicité mensongère',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['DGCCRF', 'consommateurs', 'législateurs'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'derision'], typicalActors: ['influenceurs', 'marques', 'agences'] },
            ],
          },
        ],
      },
      {
        id: 'bons_plans',
        label: 'Bons plans & promos',
        keywords: ['bon plan', 'promo', 'soldes', 'réduction', 'reduction', 'code promo', 'black friday', 'vente privée', 'occasion', 'seconde main', 'vinted', 'leboncoin', 'deal', 'pas cher', 'amazon'],
        preciseSubjects: [
          {
            id: 'black_friday_boycotter',
            statement: 'Le Black Friday est un symbole de surconsommation à boycotter',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'mobilisation'], typicalActors: ['écologistes', 'anti-consuméristes', 'Green Friday'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['commerçants', 'consommateurs', 'Amazon'] },
            ],
          },
          {
            id: 'amazon_trop_puissant',
            statement: 'Amazon est trop puissant et détruit le commerce local',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'urgence'], typicalActors: ['libraires', 'commerçants locaux', 'écologistes'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['consommateurs', 'Amazon', 'libéraux'] },
            ],
          },
        ],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Écologie & Environnement
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'ecologie',
    label: '\u00c9cologie',
    domainId: 'ecologie_environnement',
    subjects: [
      {
        id: 'rechauffement_climatique',
        label: 'R\u00e9chauffement climatique',
        keywords: ['r\u00e9chauffement', 'rechauffement', 'climat', 'climatique', 'co2', 'carbone', 'giec', 'cop', 'accord de paris', '+1.5', '+2\u00b0', 'bilan carbone'],
        preciseSubjects: [
          {
            id: 'decroissance_necessaire',
            statement: 'La d\u00e9croissance est n\u00e9cessaire pour sauver le climat',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'mobilisation'], typicalActors: ['\u00e9cologistes radicaux', 'd\u00e9croissants'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'ordre'], typicalActors: ['lib\u00e9raux', 'tech optimistes', 'croissance verte'] },
            ],
          },
        ],
      },
      {
        id: 'transition_energetique',
        label: 'Transition \u00e9nerg\u00e9tique',
        keywords: ['renouvelable', '\u00e9olienne', 'eolienne', 'solaire', 'nucl\u00e9aire', 'nucleaire', 'hydrog\u00e8ne', 'hydrogene', 'transition \u00e9nerg\u00e9tique', 'sobri\u00e9t\u00e9', 'sobriete'],
        preciseSubjects: [
          {
            id: 'nucleaire_indispensable',
            statement: 'Le nucl\u00e9aire est indispensable \u00e0 la transition \u00e9nerg\u00e9tique',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['Jancovici', 'pro-nucl\u00e9aire', 'Renaissance'] },
              { label: 'contre', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['Greenpeace', 'EELV', 'anti-nucl\u00e9aire'] },
            ],
          },
        ],
      },
      {
        id: 'pollution',
        label: 'Pollution',
        keywords: ['pollution', 'plastique', 'pesticide', 'pfas', 'polluant', 'qualit\u00e9 de l\'air', 'qualite de lair', 'particules fines', 'microplastique'],
        preciseSubjects: [
          {
            id: 'plastique_usage_unique_interdire',
            statement: 'Tout plastique à usage unique devrait être interdit immédiatement',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'mobilisation'], typicalActors: ['écologistes', 'UE', 'associations océans'] },
              { label: 'contre', typicalNarratives: ['menace', 'ordre'], typicalActors: ['industrie plastique', 'commerçants', 'pays en développement'] },
            ],
          },
          {
            id: 'pollueur_payeur',
            statement: 'Les grandes entreprises polluantes devraient payer la totalité de la dépollution',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'mobilisation'], typicalActors: ['écologistes', 'ONG', 'gauche'] },
              { label: 'contre', typicalNarratives: ['menace', 'ordre'], typicalActors: ['industriels', 'patronat', 'libéraux'] },
            ],
          },
        ],
      },
      {
        id: 'biodiversite',
        label: 'Biodiversit\u00e9',
        keywords: ['biodiversit\u00e9', 'biodiversite', 'extinction', 'esp\u00e8ce menac\u00e9e', 'espece menacee', 'd\u00e9forestation', 'deforestation', 'oc\u00e9an', 'ocean', 'corail', 'faune', 'flore'],
        preciseSubjects: [
          {
            id: 'sixieme_extinction',
            statement: 'Nous vivons la sixième extinction de masse et la politique ne fait rien',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'denonciation'], typicalActors: ['scientifiques', 'IPBES', 'écologistes'] },
              { label: 'contre', typicalNarratives: ['derision', 'ordre'], typicalActors: ['climato-sceptiques', 'industriels'] },
            ],
          },
          {
            id: 'droits_nature',
            statement: 'La nature devrait avoir des droits juridiques au même titre que les personnes',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'aspiration'], typicalActors: ['juristes environnementaux', 'écologistes radicaux'] },
              { label: 'contre', typicalNarratives: ['derision', 'ordre'], typicalActors: ['juristes classiques', 'industriels'] },
            ],
          },
        ],
      },
      {
        id: 'agriculture',
        label: 'Agriculture & alimentation durable',
        keywords: ['agriculture', 'agriculture bio', 'pesticide', 'ogm', 'permaculture', 'circuit court', 'paysan', 'fnsea', 'conf\u00e9d\u00e9ration paysanne', 'glyphosate'],
        preciseSubjects: [
          {
            id: 'interdire_glyphosate',
            statement: 'Le glyphosate doit \u00eatre totalement interdit',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'urgence'], typicalActors: ['\u00e9cologistes', 'consommateurs'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['FNSEA', 'industrie agrochimique'] },
            ],
          },
        ],
      },
      {
        id: 'militants_ecolo',
        label: 'Militants \u00e9colo & d\u00e9sob\u00e9issance',
        keywords: ['extinction rebellion', 'xr', 'derni\u00e8re r\u00e9novation', 'derniere renovation', 'blocage', 'd\u00e9sob\u00e9issance civile', 'desobeissance civile', '\u00e9co-terrorisme', 'eco-terrorisme', 'activiste climat'],
        preciseSubjects: [
          {
            id: 'desobeissance_civile_climat',
            statement: 'Les actions de d\u00e9sob\u00e9issance civile pour le climat sont l\u00e9gitimes',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'mobilisation'], typicalActors: ['XR', 'Derni\u00e8re R\u00e9novation', 'jeunes pour le climat'] },
              { label: 'contre', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['droite', 'Darmanin', 'automobilistes'] },
            ],
          },
        ],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Religion & Spiritualité
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'religion',
    label: 'Religion',
    domainId: 'religion_spiritualite',
    subjects: [
      {
        id: 'laicite',
        label: 'La\u00efcit\u00e9',
        keywords: ['la\u00efcit\u00e9', 'laicite', 'loi 1905', 's\u00e9paration \u00e9glise \u00e9tat', 'separation eglise etat', 'neutralit\u00e9', 'signes religieux', 'burkini', 'voile', 'loi s\u00e9paratisme', 'pros\u00e9lytisme', 'charlie hebdo'],
        preciseSubjects: [
          {
            id: 'voile_espace_public',
            statement: 'Le voile doit \u00eatre interdit dans l\'espace public',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['la\u00efques stricts', 'droite', 'RN'] },
              { label: 'contre', typicalNarratives: ['injustice', 'empowerment'], typicalActors: ['associations musulmanes', 'gauche', 'f\u00e9ministes intersectionnelles'] },
            ],
          },
          {
            id: 'abaya_ecole',
            statement: 'L\'interdiction de l\'abaya \u00e0 l\'\u00e9cole est justifi\u00e9e',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre'], typicalActors: ['gouvernement', 'la\u00efques'] },
              { label: 'contre', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['associations', 'LFI'] },
            ],
          },
        ],
      },
      {
        id: 'islam_france',
        label: 'Islam en France',
        keywords: ['islam', 'musulman', 'mosqu\u00e9e', 'mosquee', 'ramadan', 'halal', 'imam', 'islamisme', 'islamophobie', 'radicalisation', 's\u00e9paratisme', 'abaya', 'hijab', 'iftar', 'eid', 'a\u00efd', 'aid', 'haram', 'salam', 'mashallah', 'inshallah', 'oumma', 'coran', 'deen'],
        preciseSubjects: [
          {
            id: 'islamophobie_france',
            statement: 'L\'islamophobie est un probl\u00e8me r\u00e9el en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['associations musulmanes', 'gauche', 'CCIF'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'ordre'], typicalActors: ['la\u00efques', 'droite', 'universalistes'] },
            ],
          },
        ],
      },
      {
        id: 'christianisme',
        label: 'Christianisme',
        keywords: ['chr\u00e9tien', 'chretien', 'catholique', '\u00e9glise', 'eglise', 'pape', 'messe', 'pri\u00e8re', 'priere', 'no\u00ebl', 'noel', 'p\u00e2ques', 'paques', 'vatican', '\u00e9vang\u00e9lique', 'bible', 'j\u00e9sus', 'jesus', 'gospel', 'b\u00e9n\u00e9diction', 'benediction', 'foi', 'croyant', 'dieu', 'seigneur', 'amen', 'car\u00eame', 'careme', 'communion', 'bapt\u00eame', 'bapteme'],
        preciseSubjects: [
          {
            id: 'racines_chretiennes_france',
            statement: 'La France a des racines chrétiennes qu\'il faut défendre',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'ordre'], typicalActors: ['droite conservatrice', 'catholiques tradis', 'Reconquête'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'empowerment'], typicalActors: ['laïques', 'gauche', 'historiens'] },
            ],
          },
          {
            id: 'pedocriminalite_eglise',
            statement: 'L\'Église catholique n\'a pas suffisamment répondu aux scandales de pédocriminalité',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['victimes', 'CIASE', 'médias'] },
              { label: 'contre', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['hiérarchie catholique', 'fidèles'] },
            ],
          },
        ],
      },
      {
        id: 'antisemitisme',
        label: 'Antis\u00e9mitisme',
        keywords: ['antis\u00e9mitisme', 'antisemitisme', 'juif', 'juda\u00efsme', 'judaisme', 'synagogue', 'shoah', 'holocauste', 'crif', 'kippa', '\u00e9toile de david', 'shabbat', 'torah', 'hanouka', 'kippour', 'casher'],
        preciseSubjects: [
          {
            id: 'antisionisme_antisemitisme',
            statement: 'L\'antisionisme est une forme déguisée d\'antisémitisme',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'menace'], typicalActors: ['CRIF', 'gouvernement', 'organisations juives'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['pro-palestiniens', 'gauche', 'universitaires'] },
            ],
          },
          {
            id: 'antisemitisme_hausse',
            statement: 'L\'antisémitisme progresse dangereusement en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'menace'], typicalActors: ['CRIF', 'communauté juive', 'gouvernement'] },
              { label: 'contre', typicalNarratives: ['derision', 'denonciation'], typicalActors: ['relativistes', 'certains à gauche'] },
            ],
          },
        ],
      },
    ],
  },
];

// ─── Index & Lookup Helpers ─────────────────────────────────

const _themeById = new Map<string, Theme>();
const _domainById = new Map<string, Domain>();
const _subjectById = new Map<string, { subject: Subject; theme: Theme }>();
const _preciseSubjectById = new Map<string, { ps: PreciseSubject; subject: Subject; theme: Theme }>();
const _domainByThemeId = new Map<string, Domain>();

function _buildIndexes() {
  if (_themeById.size > 0) return; // already built
  for (const d of DOMAINS) {
    _domainById.set(d.id, d);
    for (const tId of d.themeIds) _domainByThemeId.set(tId, d);
  }
  for (const t of THEMES) {
    _themeById.set(t.id, t);
    for (const s of t.subjects) {
      _subjectById.set(s.id, { subject: s, theme: t });
      for (const ps of s.preciseSubjects) {
        _preciseSubjectById.set(ps.id, { ps, subject: s, theme: t });
      }
    }
  }
}

export function getThemeById(id: string): Theme | undefined {
  _buildIndexes();
  return _themeById.get(id);
}

export function getDomainForTheme(themeId: string): Domain | undefined {
  _buildIndexes();
  return _domainByThemeId.get(themeId);
}

export function getSubjectById(id: string): { subject: Subject; theme: Theme } | undefined {
  _buildIndexes();
  return _subjectById.get(id);
}

export function getPreciseSubjectById(id: string): { ps: PreciseSubject; subject: Subject; theme: Theme } | undefined {
  _buildIndexes();
  return _preciseSubjectById.get(id);
}

export function getAllPreciseSubjects(): PreciseSubject[] {
  _buildIndexes();
  return Array.from(_preciseSubjectById.values()).map(v => v.ps);
}

export function getPreciseSubjectsForTheme(themeId: string): PreciseSubject[] {
  const theme = getThemeById(themeId);
  if (!theme) return [];
  return theme.subjects.flatMap(s => s.preciseSubjects);
}

// ─── Matching helpers ───────────────────────────────────────

/**
 * Cache de regex word-boundary par keyword.
 * Utilise \b pour les mots courts (<= 4 chars) afin d'éviter les faux positifs.
 * Pour les mots longs, includes() suffit (risque de sous-chaîne minimal).
 */
const _kwRegexCache = new Map<string, RegExp>();

function _matchKeyword(kw: string, text: string): boolean {
  // Mots très longs (>= 7 chars) : includes suffit, aucun faux positif réaliste
  if (kw.length >= 7) return text.includes(kw);

  // Mots courts et moyens (< 7 chars) : word boundary obligatoire
  // Raison : "macro" matchait dans "emmanuelmacron", "gains" dans "bargains", etc.
  let re = _kwRegexCache.get(kw);
  if (!re) {
    // Escape regex special chars
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // \b ne fonctionne pas bien avec les accents → on utilise (?:^|[\s.,;:!?'"()\-/]) et idem après
    re = new RegExp(`(?:^|[\\s.,;:!?'"()\\-/])${escaped}(?:$|[\\s.,;:!?'"()\\-/])`, 'i');
    _kwRegexCache.set(kw, re);
  }
  return re.test(text);
}

// ─── Classification multi-niveaux ───────────────────────────

export interface MultiLevelMatch {
  domain: { id: string; label: string };
  theme: { id: string; label: string };
  subject: { id: string; label: string } | null;
  matchCount: number;
  matchedKeywords: string[];
}

/**
 * Classifie un texte à travers les 3 premiers niveaux (domaine → thème → sujet).
 * Le niveau 4 (sujet précis) est déterminé par le LLM.
 * Utilise word boundaries pour les keywords courts afin d'éviter les faux positifs.
 */
export function classifyMultiLevel(text: string): MultiLevelMatch[] {
  _buildIndexes();
  const lower = text.toLowerCase();
  const results: MultiLevelMatch[] = [];

  for (const theme of THEMES) {
    for (const subject of theme.subjects) {
      const matched = subject.keywords.filter(kw => _matchKeyword(kw, lower));
      if (matched.length > 0) {
        const domain = _domainByThemeId.get(theme.id)!;
        results.push({
          domain: { id: domain.id, label: domain.label },
          theme: { id: theme.id, label: theme.label },
          subject: { id: subject.id, label: subject.label },
          matchCount: matched.length,
          matchedKeywords: matched,
        });
      }
    }
  }

  return results.sort((a, b) => b.matchCount - a.matchCount);
}

/** Exported for use in topics-keywords.ts */
export { _matchKeyword as matchKeyword };

/**
 * Déduit les domaines uniques à partir d'une liste de thèmes.
 */
export function getDomainsFromThemes(themeIds: string[]): string[] {
  _buildIndexes();
  const domainSet = new Set<string>();
  for (const tId of themeIds) {
    const d = _domainByThemeId.get(tId);
    if (d) domainSet.add(d.id);
  }
  return Array.from(domainSet);
}

// ─── Stats ──────────────────────────────────────────────────

export function getTaxonomyStats() {
  _buildIndexes();
  const subjectCount = _subjectById.size;
  const preciseSubjectCount = _preciseSubjectById.size;
  return {
    domains: DOMAINS.length,
    themes: THEMES.length,
    subjects: subjectCount,
    preciseSubjects: preciseSubjectCount,
  };
}
