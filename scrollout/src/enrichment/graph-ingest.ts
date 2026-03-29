/**
 * Graph Ingest — Transforme un PostEnriched en observations de graphe de connaissances.
 *
 * Pipeline : PostEnriched (plat) → extractObservations() → resolveEntity() → persist
 *
 * Le PostEnriched reste le cache dénormalisé pour les requêtes simples.
 * Le graphe (KnowledgeEntity + Observation) est la couche d'intelligence sémantique.
 */
import prisma from '../db/client';

// ─── Types ──────────────────────────────────────────────────────

export interface ObservationInput {
  postId: string;
  entityName: string;
  entityType: string;
  relation: string;
  stance?: string;
  intensity?: number;
  confidence: number;
  evidence?: string;
  source: string;
}

export interface MergedEnrichment {
  normalizedText: string;
  semanticSummary: string;
  mainTopics: string;       // JSON array
  secondaryTopics: string;  // JSON array
  subjects: string;         // JSON array [{id, themeId, label}]
  preciseSubjects: string;  // JSON array [{id, statement, position, confidence}]
  persons: string;          // JSON array
  organizations: string;    // JSON array
  institutions: string;     // JSON array
  countries: string;        // JSON array
  politicalActors: string;  // JSON array
  narrativeFrame: string;
  primaryEmotion: string;
  tone: string;
  audienceTarget: string;
  confidenceScore: number;
  provider: string;
}

// ─── Canonicalization ───────────────────────────────────────────

/**
 * Normalise un nom d'entité en forme canonique.
 * lowercase, trim, suppression accents pour le matching, mais garde la forme originale en alias.
 */
export function canonicalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, ' ');
}

// ─── Entity Resolution ─────────────────────────────────────────

/**
 * Résout une entité : exact match → alias match → création.
 * Retourne l'ID de l'entité dans le graphe.
 */
export async function resolveEntity(
  name: string,
  type: string,
): Promise<{ id: string; created: boolean }> {
  const canonical = canonicalize(name);
  if (!canonical) throw new Error('Empty entity name');

  // 1. Exact match sur canonicalName
  const exact = await prisma.knowledgeEntity.findUnique({
    where: { canonicalName: canonical },
    select: { id: true },
  });
  if (exact) return { id: exact.id, created: false };

  // 2. Alias match — cherche dans le JSON aliases
  // SQLite LIKE sur le JSON sérialisé (performant pour petits volumes)
  const aliasMatch = await prisma.knowledgeEntity.findFirst({
    where: {
      type,
      aliases: { contains: `"${canonical}"` },
    },
    select: { id: true },
  });
  if (aliasMatch) return { id: aliasMatch.id, created: false };

  // 3. Création
  const created = await prisma.knowledgeEntity.create({
    data: {
      canonicalName: canonical,
      type,
      aliases: JSON.stringify([name.trim().toLowerCase()]),
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

// ─── Observation Extraction ─────────────────────────────────────

function safeParseArray(json: string): any[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Extrait les observations à partir d'un enrichissement mergé.
 * Pure function — pas d'I/O, juste de la transformation.
 */
export function extractObservations(
  postId: string,
  merged: MergedEnrichment,
): ObservationInput[] {
  const obs: ObservationInput[] = [];
  const conf = merged.confidenceScore;
  const src = merged.provider;

  // 1. Thèmes principaux → isAbout (intensity 1.0)
  for (const topic of safeParseArray(merged.mainTopics)) {
    if (typeof topic === 'string' && topic) {
      obs.push({
        postId, entityName: topic, entityType: 'Theme',
        relation: 'isAbout', intensity: 1.0,
        confidence: conf, source: src,
      });
    }
  }

  // 2. Thèmes secondaires → isAbout (intensity 0.5)
  for (const topic of safeParseArray(merged.secondaryTopics)) {
    if (typeof topic === 'string' && topic) {
      obs.push({
        postId, entityName: topic, entityType: 'Theme',
        relation: 'isAbout', intensity: 0.5,
        confidence: conf, source: src,
      });
    }
  }

  // 3. Sujets (niveau 3) → isAbout
  for (const subj of safeParseArray(merged.subjects)) {
    if (subj?.label) {
      obs.push({
        postId, entityName: subj.label, entityType: 'Subject',
        relation: 'isAbout', intensity: 0.8,
        confidence: conf, source: src,
      });
    }
  }

  // 4. Sujets précis (niveau 4) → takesPosition avec stance
  for (const ps of safeParseArray(merged.preciseSubjects)) {
    if (ps?.id) {
      obs.push({
        postId, entityName: ps.statement || ps.id, entityType: 'PreciseSubject',
        relation: 'takesPosition',
        stance: ps.position || 'neutre',
        intensity: ps.confidence || 0.5,
        confidence: ps.confidence || conf, source: src,
      });
    }
  }

  // 5. Personnes → mentions
  for (const person of safeParseArray(merged.persons)) {
    if (typeof person === 'string' && person) {
      obs.push({
        postId, entityName: person, entityType: 'Person',
        relation: 'mentions', confidence: conf, source: src,
      });
    }
  }

  // 6. Organisations → mentions
  for (const org of safeParseArray(merged.organizations)) {
    if (typeof org === 'string' && org) {
      obs.push({
        postId, entityName: org, entityType: 'Organization',
        relation: 'mentions', confidence: conf, source: src,
      });
    }
  }

  // 7. Institutions → mentions
  for (const inst of safeParseArray(merged.institutions)) {
    if (typeof inst === 'string' && inst) {
      obs.push({
        postId, entityName: inst, entityType: 'Institution',
        relation: 'mentions', confidence: conf, source: src,
      });
    }
  }

  // 8. Pays → mentions
  for (const country of safeParseArray(merged.countries)) {
    if (typeof country === 'string' && country) {
      obs.push({
        postId, entityName: country, entityType: 'Country',
        relation: 'mentions', confidence: conf, source: src,
      });
    }
  }

  // 9. Acteurs politiques → mentions (si pas déjà dans persons)
  const personNames = new Set(safeParseArray(merged.persons).map((p: string) => canonicalize(p)));
  for (const actor of safeParseArray(merged.politicalActors)) {
    if (typeof actor === 'string' && actor && !personNames.has(canonicalize(actor))) {
      obs.push({
        postId, entityName: actor, entityType: 'Person',
        relation: 'mentions', confidence: conf, source: src,
      });
    }
  }

  // 10. Narratif → uses
  if (merged.narrativeFrame && merged.narrativeFrame !== 'aucun' && merged.narrativeFrame !== '') {
    obs.push({
      postId, entityName: merged.narrativeFrame, entityType: 'Narrative',
      relation: 'uses', confidence: conf, source: src,
    });
  }

  // 11. Émotion → evokes
  if (merged.primaryEmotion && merged.primaryEmotion !== 'neutre' && merged.primaryEmotion !== '') {
    obs.push({
      postId, entityName: merged.primaryEmotion, entityType: 'Emotion',
      relation: 'evokes', confidence: conf, source: src,
    });
  }

  // 12. Audience → targets
  if (merged.audienceTarget && merged.audienceTarget !== '') {
    obs.push({
      postId, entityName: merged.audienceTarget, entityType: 'Audience',
      relation: 'targets', confidence: conf, source: src,
    });
  }

  return obs;
}

// ─── Graph Ingest (orchestration) ───────────────────────────────

/**
 * Ingère un post enrichi dans le graphe de connaissances.
 * Résout les entités, crée les observations, met à jour les compteurs.
 */
export async function graphIngest(
  postId: string,
  merged: MergedEnrichment,
): Promise<{ observationCount: number; entitiesCreated: number }> {
  const inputs = extractObservations(postId, merged);
  if (inputs.length === 0) return { observationCount: 0, entitiesCreated: 0 };

  let entitiesCreated = 0;
  const resolvedObservations: Array<{
    postId: string;
    entityId: string;
    relation: string;
    stance: string;
    intensity: number;
    confidence: number;
    evidence: string;
    source: string;
  }> = [];

  // Resolve entities + prepare observations
  for (const input of inputs) {
    const entity = await resolveEntity(input.entityName, input.entityType);
    if (entity.created) entitiesCreated++;

    resolvedObservations.push({
      postId: input.postId,
      entityId: entity.id,
      relation: input.relation,
      stance: input.stance || '',
      intensity: input.intensity || 0,
      confidence: input.confidence,
      evidence: input.evidence || '',
      source: input.source,
    });
  }

  // Delete existing observations for this post (idempotent re-enrichment)
  await prisma.observation.deleteMany({ where: { postId } });

  // Persist observations + update entity mention counts in a transaction
  const entityMentionCounts = new Map<string, number>();
  for (const obs of resolvedObservations) {
    entityMentionCounts.set(obs.entityId, (entityMentionCounts.get(obs.entityId) || 0) + 1);
  }

  await prisma.$transaction([
    // Create all observations
    ...resolvedObservations.map(obs =>
      prisma.observation.create({ data: obs }),
    ),
    // Update mention counts + lastSeenAt
    ...Array.from(entityMentionCounts.entries()).map(([entityId]) =>
      prisma.knowledgeEntity.update({
        where: { id: entityId },
        data: {
          mentionCount: { increment: 1 },
          lastSeenAt: new Date(),
        },
      }),
    ),
  ]);

  return { observationCount: resolvedObservations.length, entitiesCreated };
}
