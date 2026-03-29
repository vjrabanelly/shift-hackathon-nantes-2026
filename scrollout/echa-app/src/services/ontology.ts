/**
 * Ontology — Entity resolution, structural edges, knowledge graph intelligence.
 *
 * This is the brain of the knowledge graph. It knows:
 * - Who is who (entity resolution via alias dictionaries)
 * - How things relate (Person→Organization, Theme→Domain, Subject→Theme)
 * - What goes with what (co-occurrence → inferred edges)
 *
 * All data lives in the mobile SQLite. No PC dependency.
 */

// ── Entity Alias Dictionary ────────────────────────────────────
// Maps canonical names to known aliases for entity resolution.
// Built from political-actors.ts knowledge + common variations.

export interface EntityDef {
  canonical: string;
  type: 'Person' | 'Organization' | 'Institution' | 'Theme' | 'Domain' | 'Media';
  aliases: string[];
  edges?: Array<{ target: string; relation: string }>;
}

export const ENTITY_DICTIONARY: EntityDef[] = [
  // ── Personnalités politiques ─────────────────────────────
  {
    canonical: 'Emmanuel Macron', type: 'Person',
    aliases: ['macron', 'emmanuel macron', 'e. macron', 'le president', 'president macron', 'emmanuelmacron'],
    edges: [{ target: 'Renaissance', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Marine Le Pen', type: 'Person',
    aliases: ['le pen', 'marine le pen', 'mlp', 'marinelepen'],
    edges: [{ target: 'Rassemblement National', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Jordan Bardella', type: 'Person',
    aliases: ['bardella', 'jordan bardella', 'jordanbardella'],
    edges: [{ target: 'Rassemblement National', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Jean-Luc Melenchon', type: 'Person',
    aliases: ['melenchon', 'mélenchon', 'jean-luc melenchon', 'jlmelenchon', 'jlm'],
    edges: [{ target: 'La France Insoumise', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Eric Zemmour', type: 'Person',
    aliases: ['zemmour', 'eric zemmour'],
    edges: [{ target: 'Reconquete', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Gabriel Attal', type: 'Person',
    aliases: ['attal', 'gabriel attal'],
    edges: [{ target: 'Renaissance', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Francois Bayrou', type: 'Person',
    aliases: ['bayrou', 'francois bayrou', 'françois bayrou'],
    edges: [{ target: 'MoDem', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Francois Ruffin', type: 'Person',
    aliases: ['ruffin', 'francois ruffin', 'françois ruffin'],
    edges: [{ target: 'La France Insoumise', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Sandrine Rousseau', type: 'Person',
    aliases: ['rousseau', 'sandrine rousseau', 'sandrine_rousseau'],
    edges: [{ target: 'EELV', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Marine Tondelier', type: 'Person',
    aliases: ['tondelier', 'marine tondelier', 'marinetondelier'],
    edges: [{ target: 'EELV', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Raphael Glucksmann', type: 'Person',
    aliases: ['glucksmann', 'raphael glucksmann', 'raphaël glucksmann'],
    edges: [{ target: 'Place Publique', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Gerald Darmanin', type: 'Person',
    aliases: ['darmanin', 'gerald darmanin', 'gérald darmanin'],
    edges: [{ target: 'Renaissance', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Nicolas Sarkozy', type: 'Person',
    aliases: ['sarkozy', 'nicolas sarkozy'],
    edges: [{ target: 'Les Republicains', relation: 'affiliatedWith' }],
  },
  {
    canonical: 'Edouard Philippe', type: 'Person',
    aliases: ['philippe', 'edouard philippe', 'édouard philippe'],
    edges: [{ target: 'Horizons', relation: 'affiliatedWith' }],
  },

  // ── Partis politiques ────────────────────────────────────
  {
    canonical: 'Rassemblement National', type: 'Organization',
    aliases: ['rn', 'rassemblement national', 'front national', 'fn'],
    edges: [{ target: 'politique', relation: 'belongsTo' }],
  },
  {
    canonical: 'La France Insoumise', type: 'Organization',
    aliases: ['lfi', 'la france insoumise', 'france insoumise'],
    edges: [{ target: 'politique', relation: 'belongsTo' }],
  },
  {
    canonical: 'Renaissance', type: 'Organization',
    aliases: ['renaissance', 'lrem', 'en marche', 'la republique en marche'],
    edges: [{ target: 'politique', relation: 'belongsTo' }],
  },
  {
    canonical: 'Les Republicains', type: 'Organization',
    aliases: ['lr', 'les republicains', 'les républicains', 'ump'],
    edges: [{ target: 'politique', relation: 'belongsTo' }],
  },
  {
    canonical: 'EELV', type: 'Organization',
    aliases: ['eelv', 'europe ecologie', 'europe écologie', 'les verts', 'ecologistes'],
    edges: [{ target: 'ecologie', relation: 'belongsTo' }, { target: 'politique', relation: 'belongsTo' }],
  },
  {
    canonical: 'Parti Socialiste', type: 'Organization',
    aliases: ['ps', 'parti socialiste'],
    edges: [{ target: 'politique', relation: 'belongsTo' }],
  },
  {
    canonical: 'MoDem', type: 'Organization',
    aliases: ['modem', 'mouvement democrate', 'mouvement démocrate'],
    edges: [{ target: 'politique', relation: 'belongsTo' }],
  },
  {
    canonical: 'Reconquete', type: 'Organization',
    aliases: ['reconquete', 'reconquête'],
    edges: [{ target: 'politique', relation: 'belongsTo' }],
  },
  {
    canonical: 'Horizons', type: 'Organization',
    aliases: ['horizons'],
    edges: [{ target: 'politique', relation: 'belongsTo' }],
  },
  {
    canonical: 'Place Publique', type: 'Organization',
    aliases: ['place publique'],
    edges: [{ target: 'politique', relation: 'belongsTo' }],
  },

  // ── Institutions ─────────────────────────────────────────
  {
    canonical: 'Assemblee Nationale', type: 'Institution',
    aliases: ['assemblee nationale', 'assemblée nationale', 'l\'assemblee'],
    edges: [{ target: 'politique', relation: 'belongsTo' }],
  },
  {
    canonical: 'Senat', type: 'Institution',
    aliases: ['senat', 'sénat'],
    edges: [{ target: 'politique', relation: 'belongsTo' }],
  },
  {
    canonical: 'Elysee', type: 'Institution',
    aliases: ['elysee', 'élysée', 'palais de l\'elysee'],
    edges: [{ target: 'Emmanuel Macron', relation: 'associatedWith' }],
  },
  {
    canonical: 'Commission Europeenne', type: 'Institution',
    aliases: ['commission europeenne', 'commission européenne'],
    edges: [{ target: 'geopolitique', relation: 'belongsTo' }],
  },
  {
    canonical: 'ONU', type: 'Institution',
    aliases: ['onu', 'nations unies'],
    edges: [{ target: 'geopolitique', relation: 'belongsTo' }],
  },

  // ── Medias ───────────────────────────────────────────────
  {
    canonical: 'Mediapart', type: 'Media',
    aliases: ['mediapart'],
    edges: [{ target: 'actualite', relation: 'belongsTo' }],
  },
  {
    canonical: 'Le Monde', type: 'Media',
    aliases: ['le monde', 'lemondefr'],
    edges: [{ target: 'actualite', relation: 'belongsTo' }],
  },
  {
    canonical: 'Liberation', type: 'Media',
    aliases: ['liberation', 'libération', 'libe'],
    edges: [{ target: 'actualite', relation: 'belongsTo' }],
  },
  {
    canonical: 'Le Figaro', type: 'Media',
    aliases: ['le figaro', 'figaro', 'lefigarofr'],
    edges: [{ target: 'actualite', relation: 'belongsTo' }],
  },
  {
    canonical: 'Hugo Decrypte', type: 'Media',
    aliases: ['hugodecrypte', 'hugo decrypte'],
    edges: [{ target: 'actualite', relation: 'belongsTo' }],
  },
];

// ── Theme → Domain structural edges ────────────────────────────

export const THEME_TO_DOMAIN: Record<string, string> = {
  politique: 'Politique & Societe',
  geopolitique: 'Politique & Societe',
  immigration: 'Politique & Societe',
  securite: 'Politique & Societe',
  justice: 'Politique & Societe',
  societe: 'Politique & Societe',
  feminisme: 'Politique & Societe',
  masculinite: 'Politique & Societe',
  identite: 'Politique & Societe',
  economie: 'Economie & Travail',
  business: 'Economie & Travail',
  actualite: 'Information & Savoirs',
  education: 'Information & Savoirs',
  technologie: 'Information & Savoirs',
  sante: 'Information & Savoirs',
  culture: 'Culture & Divertissement',
  humour: 'Culture & Divertissement',
  divertissement: 'Culture & Divertissement',
  sport: 'Culture & Divertissement',
  lifestyle: 'Lifestyle & Bien-etre',
  beaute: 'Lifestyle & Bien-etre',
  developpement_personnel: 'Lifestyle & Bien-etre',
  food: 'Lifestyle & Bien-etre',
  voyage: 'Lifestyle & Bien-etre',
  maison_jardin: 'Lifestyle & Bien-etre',
  animaux: 'Vie quotidienne',
  parentalite: 'Vie quotidienne',
  automobile: 'Vie quotidienne',
  shopping: 'Vie quotidienne',
  ecologie: 'Ecologie & Environnement',
  religion: 'Religion & Spiritualite',
};

// ── Related themes (bidirectional thematic proximity) ───────────

export const RELATED_THEMES: Array<[string, string]> = [
  ['politique', 'geopolitique'],
  ['politique', 'economie'],
  ['politique', 'immigration'],
  ['politique', 'securite'],
  ['immigration', 'securite'],
  ['immigration', 'identite'],
  ['ecologie', 'politique'],
  ['ecologie', 'economie'],
  ['feminisme', 'identite'],
  ['feminisme', 'societe'],
  ['masculinite', 'identite'],
  ['culture', 'divertissement'],
  ['culture', 'humour'],
  ['sport', 'divertissement'],
  ['lifestyle', 'beaute'],
  ['lifestyle', 'food'],
  ['business', 'technologie'],
  ['sante', 'developpement_personnel'],
  ['actualite', 'politique'],
];

// ── Entity Resolution Engine ───────────────────────────────────

function canonicalize(name: string): string {
  return name.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// Build lookup index: alias → EntityDef
const aliasIndex = new Map<string, EntityDef>();
for (const def of ENTITY_DICTIONARY) {
  aliasIndex.set(canonicalize(def.canonical), def);
  for (const alias of def.aliases) {
    aliasIndex.set(canonicalize(alias), def);
  }
}

/**
 * Resolve an entity name to its canonical form and type.
 * Returns the canonical EntityDef if found, or null if unknown.
 */
export function resolveEntityLocal(name: string): EntityDef | null {
  return aliasIndex.get(canonicalize(name)) || null;
}

/**
 * Given an observation's entityName, return the canonical name and full alias list.
 * Falls back to the raw name if not in the dictionary.
 */
export function canonicalizeEntity(name: string, type: string): {
  canonical: string;
  type: string;
  aliases: string[];
} {
  const resolved = resolveEntityLocal(name);
  if (resolved) {
    return {
      canonical: resolved.canonical,
      type: resolved.type,
      aliases: resolved.aliases,
    };
  }
  // Unknown entity — use cleaned name as canonical
  return {
    canonical: name.trim(),
    type,
    aliases: [name.trim().toLowerCase()],
  };
}

// ── Structural Edge Generation ─────────────────────────────────

export interface StructuralEdge {
  sourceCanonical: string;
  sourceType: string;
  targetCanonical: string;
  targetType: string;
  relation: string;
  weight: number;
}

/**
 * Generate all structural edges from the ontology dictionaries.
 * These are facts about the world, not observations from posts.
 */
export function generateStructuralEdges(): StructuralEdge[] {
  const edges: StructuralEdge[] = [];

  // 1. Edges from entity dictionary (Person→Org, Org→Theme, etc.)
  for (const def of ENTITY_DICTIONARY) {
    if (def.edges) {
      for (const edge of def.edges) {
        const targetDef = resolveEntityLocal(edge.target);
        edges.push({
          sourceCanonical: def.canonical,
          sourceType: def.type,
          targetCanonical: targetDef?.canonical || edge.target,
          targetType: targetDef?.type || 'Theme',
          relation: edge.relation,
          weight: 1.0,
        });
      }
    }
  }

  // 2. Theme → Domain edges
  for (const [theme, domain] of Object.entries(THEME_TO_DOMAIN)) {
    edges.push({
      sourceCanonical: theme,
      sourceType: 'Theme',
      targetCanonical: domain,
      targetType: 'Domain',
      relation: 'belongsTo',
      weight: 1.0,
    });
  }

  // 3. Related themes (bidirectional)
  for (const [a, b] of RELATED_THEMES) {
    edges.push({
      sourceCanonical: a, sourceType: 'Theme',
      targetCanonical: b, targetType: 'Theme',
      relation: 'relatedTo', weight: 0.6,
    });
  }

  return edges;
}
