/**
 * Graph Ingest Mobile — Ontological knowledge graph builder.
 *
 * Transforms enrichments into a real knowledge graph:
 * 1. Entity resolution via alias dictionaries (ontology.ts)
 * 2. Observations: post → entity typed relationships
 * 3. Structural edges: Person→Org, Theme→Domain, theme proximity
 * 4. Backfill for existing enrichments
 */
import { canonicalizeEntity, generateStructuralEdges, type StructuralEdge } from './ontology.js';

// ── Types ──────────────────────────────────────────────────────

export interface ObservationInput {
  entityName: string;
  entityType: string;
  relation: string;
  stance?: string;
  intensity?: number;
  confidence: number;
  evidence?: string;
  source: string;
}

export interface MobileEnrichment {
  mainTopics: string;
  secondaryTopics: string;
  subjects?: string;
  preciseSubjects?: string;
  politicalActors: string;
  institutions?: string;
  narrativeFrame: string;
  primaryEmotion: string;
  tone: string;
  confidenceScore: number;
  provider: string;
  persons?: string;
  organizations?: string;
  countries?: string;
  audienceTarget?: string;
}

// ── Plugin access ──────────────────────────────────────────────

function getPlugin(): any {
  return (window as any).Capacitor?.Plugins?.InstaWebView;
}

// ── Helpers ────────────────────────────────────────────────────

function safeParseArray(json: string | undefined): any[] {
  try { return JSON.parse(json || '[]'); } catch { return []; }
}

function canonicalize(name: string): string {
  return name.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// ── Observation extraction with entity resolution ──────────────

/**
 * Extracts observations from enrichment WITH entity resolution.
 * Each entity is resolved to its canonical form via the ontology dictionary.
 * This means "macron", "Emmanuel Macron", "le président" all map to the same entity.
 */
export function extractObservations(enrichment: MobileEnrichment): ObservationInput[] {
  const obs: ObservationInput[] = [];
  const conf = enrichment.confidenceScore;
  const src = enrichment.provider;

  function add(name: string, type: string, relation: string, extra: Partial<ObservationInput> = {}) {
    if (!name) return;
    const resolved = canonicalizeEntity(name, type);
    obs.push({
      entityName: resolved.canonical,
      entityType: resolved.type,
      relation,
      confidence: conf,
      source: src,
      ...extra,
    });
  }

  // Main topics → isAbout (intensity 1.0)
  for (const topic of safeParseArray(enrichment.mainTopics)) {
    if (typeof topic === 'string' && topic) add(topic, 'Theme', 'isAbout', { intensity: 1.0 });
  }

  // Secondary topics → isAbout (intensity 0.5)
  for (const topic of safeParseArray(enrichment.secondaryTopics)) {
    if (typeof topic === 'string' && topic) add(topic, 'Theme', 'isAbout', { intensity: 0.5 });
  }

  // Subjects (level 3)
  for (const subj of safeParseArray(enrichment.subjects)) {
    if (subj?.label) add(subj.label, 'Subject', 'isAbout', { intensity: 0.8 });
  }

  // Precise subjects (level 4) → takesPosition with stance
  for (const ps of safeParseArray(enrichment.preciseSubjects)) {
    if (ps?.id) {
      add(ps.statement || ps.id, 'PreciseSubject', 'takesPosition', {
        stance: ps.position || 'neutre',
        intensity: ps.confidence || 0.5,
        confidence: ps.confidence || conf,
      });
    }
  }

  // Persons
  const seenCanonicals = new Set<string>();
  for (const person of safeParseArray(enrichment.persons)) {
    if (typeof person === 'string' && person) {
      const resolved = canonicalizeEntity(person, 'Person');
      if (!seenCanonicals.has(canonicalize(resolved.canonical))) {
        seenCanonicals.add(canonicalize(resolved.canonical));
        add(person, 'Person', 'mentions');
      }
    }
  }

  // Organizations
  for (const org of safeParseArray(enrichment.organizations)) {
    if (typeof org === 'string' && org) add(org, 'Organization', 'mentions');
  }

  // Institutions
  for (const inst of safeParseArray(enrichment.institutions)) {
    if (typeof inst === 'string' && inst) add(inst, 'Institution', 'mentions');
  }

  // Countries
  for (const country of safeParseArray(enrichment.countries)) {
    if (typeof country === 'string' && country) add(country, 'Country', 'mentions');
  }

  // Political actors (deduplicated against already-seen persons)
  for (const actor of safeParseArray(enrichment.politicalActors)) {
    if (typeof actor === 'string' && actor) {
      const resolved = canonicalizeEntity(actor, 'Person');
      if (!seenCanonicals.has(canonicalize(resolved.canonical))) {
        seenCanonicals.add(canonicalize(resolved.canonical));
        add(actor, 'Person', 'mentions');
      }
    }
  }

  // Narrative frame
  if (enrichment.narrativeFrame && enrichment.narrativeFrame !== 'aucun' && enrichment.narrativeFrame !== '') {
    add(enrichment.narrativeFrame, 'Narrative', 'uses');
  }

  // Emotion
  if (enrichment.primaryEmotion && enrichment.primaryEmotion !== 'neutre' && enrichment.primaryEmotion !== '') {
    add(enrichment.primaryEmotion, 'Emotion', 'evokes');
  }

  // Audience
  if (enrichment.audienceTarget && enrichment.audienceTarget !== '') {
    add(enrichment.audienceTarget, 'Audience', 'targets');
  }

  return obs;
}

// ── Graph ingest (via Capacitor plugin) ────────────────────────

export async function graphIngestMobile(
  postId: string,
  enrichment: MobileEnrichment,
): Promise<{ observationCount: number }> {
  const plugin = getPlugin();
  if (!plugin) return { observationCount: 0 };

  const observations = extractObservations(enrichment);
  if (observations.length === 0) return { observationCount: 0 };

  try {
    // Delete existing observations for idempotent re-enrichment
    if (plugin.deleteGraphObservations) {
      await plugin.deleteGraphObservations({ postId });
    }
    await plugin.saveGraphObservations({
      postId,
      observations: JSON.stringify(observations),
    });
    return { observationCount: observations.length };
  } catch (err) {
    console.error('[graph] ingest error:', err instanceof Error ? err.message : err);
    return { observationCount: 0 };
  }
}

// ── Structural edges seeding ───────────────────────────────────

let edgesSeeded = false;

/**
 * Seed structural edges from the ontology into the graph.
 * These represent world knowledge (Person→Org, Theme→Domain)
 * and are independent of any specific post.
 */
export async function seedStructuralEdges(): Promise<{ edgeCount: number }> {
  if (edgesSeeded) return { edgeCount: 0 };

  const plugin = getPlugin();
  if (!plugin?.saveGraphEdges) return { edgeCount: 0 };

  const edges = generateStructuralEdges();

  try {
    await plugin.saveGraphEdges({ edges: JSON.stringify(edges) });
    edgesSeeded = true;
    console.log(`[graph] Seeded ${edges.length} structural edges`);
    return { edgeCount: edges.length };
  } catch (err) {
    console.error('[graph] seedStructuralEdges error:', err instanceof Error ? err.message : err);
    return { edgeCount: 0 };
  }
}

// ── Graph stats query ──────────────────────────────────────────

export interface GraphStats {
  totalEntities: number;
  totalObservations: number;
  totalEdges: number;
  postsInGraph: number;
  entityTypes: Array<{ type: string; count: number }>;
  relationTypes: Array<{ relation: string; count: number }>;
  topEntities: Array<{ name: string; type: string; mentions: number }>;
  coOccurrences: Array<{ entity1: string; type1: string; entity2: string; type2: string; count: number }>;
  entityGroups: Array<{ type: string; members: Array<{ name: string; mentions: number }> }>;
  stanceDistribution: Array<{ stance: string; count: number }>;
  // For the force-directed graph
  graphNodes: Array<{ id: string; name: string; type: string; mentions: number }>;
  graphEdges: Array<{ source: string; target: string; relation: string; weight: number }>;
  // Temporal
  timeline: Array<{ week: string; entities: Array<{ name: string; count: number }> }>;
}

export async function getGraphStats(): Promise<GraphStats | null> {
  const plugin = getPlugin();
  if (!plugin) return null;

  try {
    const result = await plugin.queryGraphStats();
    return JSON.parse(result.stats || '{}') as GraphStats;
  } catch (err) {
    console.error('[graph] queryGraphStats error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Backfill : peuple le graphe depuis les enrichissements existants ──

let backfillDone = false;

export async function backfillGraph(): Promise<{ processed: number }> {
  if (backfillDone) return { processed: 0 };

  const plugin = getPlugin();
  if (!plugin?.queryEnrichedWithoutGraph) return { processed: 0 };

  // Seed structural edges first
  await seedStructuralEdges();

  let totalProcessed = 0;
  const BATCH = 50;

  while (true) {
    const result = await plugin.queryEnrichedWithoutGraph({ limit: BATCH });
    const posts: Array<MobileEnrichment & { postId: string }> = JSON.parse(result.posts || '[]');
    if (posts.length === 0) break;

    for (const post of posts) {
      try {
        const observations = extractObservations(post);
        if (observations.length > 0) {
          await plugin.saveGraphObservations({
            postId: post.postId,
            observations: JSON.stringify(observations),
          });
        }
        totalProcessed++;
      } catch {
        // skip individual errors
      }
    }

    console.log(`[graph:backfill] ${totalProcessed} posts ingested`);
    if (posts.length < BATCH) break;
  }

  backfillDone = true;
  if (totalProcessed > 0) {
    console.log(`[graph:backfill] Done — ${totalProcessed} posts ingested`);
  }
  return { processed: totalProcessed };
}
