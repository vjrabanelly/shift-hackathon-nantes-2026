/**
 * Export des données enrichies en CSV pour analyse humaine.
 * Usage: npx tsx scripts/export-enrichment-csv.ts [output.csv]
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '..', 'data', 'echa.db');
const outputPath = process.argv[2] || path.join(__dirname, '..', 'data', 'enrichment-export.csv');

const db = new Database(dbPath, { readonly: true });

// Filter: mobile-only captures (accessibility, visualizer-live, webview)
// Excludes any ADB/PC-only sessions
const mobileOnly = process.argv.includes('--all') ? false : true;
const modeFilter = mobileOnly
  ? "AND s.captureMode IN ('accessibility', 'visualizer-live', 'webview')"
  : '';

const rows = db.prepare(`
  SELECT
    p.id,
    p.sessionId,
    s.captureMode,
    p.username,
    p.mediaType,
    p.attentionLevel,
    p.dwellTimeMs,
    p.isSponsored,
    p.isSuggested,
    p.category,
    p.caption,
    p.hashtags,
    e.provider,
    e.model,
    e.version,
    e.normalizedText,
    e.semanticSummary,
    e.domains,
    e.mainTopics,
    e.secondaryTopics,
    e.subjects,
    e.preciseSubjects,
    e.contentDomain,
    e.audienceTarget,
    e.politicalActors,
    e.persons,
    e.organizations,
    e.institutions,
    e.tone,
    e.primaryEmotion,
    e.emotionIntensity,
    e.politicalExplicitnessScore,
    e.polarizationScore,
    e.ingroupOutgroupSignal,
    e.conflictSignal,
    e.moralAbsoluteSignal,
    e.enemyDesignationSignal,
    e.axisEconomic,
    e.axisSocietal,
    e.axisAuthority,
    e.axisSystem,
    e.dominantAxis,
    e.mediaCategory,
    e.mediaQuality,
    e.narrativeFrame,
    e.callToActionType,
    e.confidenceScore,
    e.reviewFlag,
    e.reviewReason,
    e.mediaMessage,
    e.mediaIntent
  FROM Post p
  JOIN PostEnriched e ON e.postId = p.id
  JOIN Session s ON s.id = p.sessionId
  WHERE 1=1 ${modeFilter}
  ORDER BY p.sessionId, p.username
`).all() as Record<string, any>[];

db.close();

function jsonCompact(val: string): string {
  try {
    const arr = JSON.parse(val);
    if (Array.isArray(arr)) {
      if (arr.length === 0) return '';
      if (typeof arr[0] === 'string') return arr.join('; ');
      if (typeof arr[0] === 'object' && arr[0].id) return arr.map((o: any) => o.label || o.id).join('; ');
      if (typeof arr[0] === 'object' && arr[0].statement) return arr.map((o: any) => `${o.id}[${o.position}]`).join('; ');
      return JSON.stringify(arr);
    }
    return String(val);
  } catch {
    return String(val || '');
  }
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length > max ? s.substring(0, max) + '...' : s;
}

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const headers = [
  'id', 'session', 'captureMode', 'username', 'mediaType', 'attention', 'dwellMs',
  'sponsored', 'suggested', 'category',
  'caption_excerpt', 'hashtags',
  'provider', 'model', 'version',
  'normalized_excerpt', 'semantic_summary',
  'domains', 'mainTopics', 'secondaryTopics',
  'subjects', 'preciseSubjects',
  'contentDomain', 'audienceTarget',
  'politicalActors', 'persons', 'organizations', 'institutions',
  'tone', 'primaryEmotion', 'emotionIntensity',
  'politicalScore', 'polarizationScore',
  'ingroupOutgroup', 'conflict', 'moralAbsolute', 'enemyDesignation',
  'axisEconomic', 'axisSocietal', 'axisAuthority', 'axisSystem', 'dominantAxis',
  'mediaCategory', 'mediaQuality',
  'narrativeFrame', 'callToAction',
  'confidence', 'reviewFlag', 'reviewReason',
  'mediaMessage', 'mediaIntent',
];

const csvLines = [headers.join(';')];

for (const row of rows) {
  const line = [
    row.id,
    row.sessionId,
    row.captureMode,
    row.username,
    row.mediaType,
    row.attentionLevel,
    row.dwellTimeMs,
    row.isSponsored ? 'yes' : 'no',
    row.isSuggested ? 'yes' : 'no',
    row.category,
    truncate((row.caption || '').replace(/[\n\r]+/g, ' '), 120),
    jsonCompact(row.hashtags),
    row.provider,
    row.model,
    row.version,
    truncate((row.normalizedText || '').replace(/[\n\r]+/g, ' '), 200),
    truncate((row.semanticSummary || '').replace(/[\n\r]+/g, ' '), 200),
    jsonCompact(row.domains),
    jsonCompact(row.mainTopics),
    jsonCompact(row.secondaryTopics),
    jsonCompact(row.subjects),
    jsonCompact(row.preciseSubjects),
    row.contentDomain,
    row.audienceTarget,
    jsonCompact(row.politicalActors),
    jsonCompact(row.persons),
    jsonCompact(row.organizations),
    jsonCompact(row.institutions),
    row.tone,
    row.primaryEmotion,
    row.emotionIntensity,
    row.politicalExplicitnessScore,
    row.polarizationScore,
    row.ingroupOutgroupSignal ? 'yes' : 'no',
    row.conflictSignal ? 'yes' : 'no',
    row.moralAbsoluteSignal ? 'yes' : 'no',
    row.enemyDesignationSignal ? 'yes' : 'no',
    row.axisEconomic,
    row.axisSocietal,
    row.axisAuthority,
    row.axisSystem,
    row.dominantAxis,
    row.mediaCategory,
    row.mediaQuality,
    row.narrativeFrame,
    row.callToActionType,
    row.confidenceScore,
    row.reviewFlag ? 'yes' : 'no',
    row.reviewReason,
    truncate((row.mediaMessage || '').replace(/[\n\r]+/g, ' '), 150),
    row.mediaIntent,
  ].map(escapeCsv);

  csvLines.push(line.join(';'));
}

// BOM for Excel UTF-8 compatibility
const bom = '\uFEFF';
fs.writeFileSync(outputPath, bom + csvLines.join('\n'), 'utf-8');

console.log(`[export] ${rows.length} posts enrichis exportés → ${outputPath}`);
console.log(`[export] Colonnes: ${headers.length}`);

// Quick stats
const providers: Record<string, number> = {};
const polDist: Record<number, number> = {};
for (const row of rows) {
  providers[row.provider] = (providers[row.provider] || 0) + 1;
  const pol = row.politicalExplicitnessScore;
  polDist[pol] = (polDist[pol] || 0) + 1;
}
console.log('[export] Par provider:', JSON.stringify(providers));
console.log('[export] Distribution politique:', JSON.stringify(polDist));
