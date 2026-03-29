/**
 * Taxonomy Compare — Rules vs GPT-4o-mini vs GPT-4.1-nano
 * Usage: npx tsx scripts/taxonomy-compare-nano.ts
 */
import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import path from 'path';

const dbMini = new Database(path.join(__dirname, '..', 'data', 'echa_device_now.db'));
const dbNano = new Database(path.join(__dirname, '..', 'data', 'echa_device_nano.db'));

function parse(s: string): any[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

function queryPosts(db: Database.Database, provider: string, limit = 100) {
  return db.prepare(`
    SELECT p.id as postId, p.username, substr(p.caption, 1, 200) as caption,
           p.dwellTimeMs, p.attentionLevel,
           e.provider, e.model, e.domains, e.mainTopics, e.secondaryTopics,
           e.subjects, e.preciseSubjects, e.politicalActors, e.institutions,
           e.tone, e.primaryEmotion, e.narrativeFrame, e.semanticSummary,
           e.confidenceScore, e.politicalExplicitnessScore, e.polarizationScore,
           e.mediaCategory
    FROM posts p INNER JOIN post_enriched e ON e.postId = p.id
    WHERE e.provider = ?
    ORDER BY e.confidenceScore DESC
    LIMIT ?
  `).all(provider, limit) as any[];
}

const miniPosts = queryPosts(dbMini, 'openai', 72);
const nanoPosts = queryPosts(dbNano, 'openai', 357);
const rulesPosts = queryPosts(dbNano, 'rules', 72);

function aggregateStats(rows: any[]) {
  const domainCounts: Record<string, number> = {};
  const themeCounts: Record<string, number> = {};
  const subjectCounts: Record<string, number> = {};
  const toneCounts: Record<string, number> = {};
  const emotionCounts: Record<string, number> = {};
  const narrativeCounts: Record<string, number> = {};
  let confSum = 0;
  let hasSubjects = 0;
  let hasTone = 0;
  let hasSummary = 0;

  for (const r of rows) {
    for (const d of parse(r.domains)) if (d) domainCounts[d] = (domainCounts[d] || 0) + 1;
    for (const t of parse(r.mainTopics)) if (t) themeCounts[t] = (themeCounts[t] || 0) + 1;
    const subs = parse(r.subjects);
    for (const s of subs) {
      const l = typeof s === 'string' ? s : s?.label;
      if (l) subjectCounts[l] = (subjectCounts[l] || 0) + 1;
    }
    if (subs.length > 0) hasSubjects++;
    if (r.tone) { toneCounts[r.tone] = (toneCounts[r.tone] || 0) + 1; hasTone++; }
    if (r.primaryEmotion) emotionCounts[r.primaryEmotion] = (emotionCounts[r.primaryEmotion] || 0) + 1;
    if (r.narrativeFrame && r.narrativeFrame !== 'aucun') narrativeCounts[r.narrativeFrame] = (narrativeCounts[r.narrativeFrame] || 0) + 1;
    if (r.semanticSummary) hasSummary++;
    confSum += r.confidenceScore || 0;
  }

  const sort = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  return {
    count: rows.length,
    avgConfidence: rows.length > 0 ? Math.round(confSum / rows.length * 100) / 100 : 0,
    hasSubjects, hasTone, hasSummary,
    domains: sort(domainCounts),
    themes: sort(themeCounts),
    subjects: sort(subjectCounts),
    tones: sort(toneCounts),
    emotions: sort(emotionCounts),
    narratives: sort(narrativeCounts),
  };
}

const miniStats = aggregateStats(miniPosts);
const nanoStats = aggregateStats(nanoPosts);
const rulesStats = aggregateStats(rulesPosts);

function badge(text: string, color: string) {
  return `<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:12px;font-size:11px;background:${color}18;color:${color};border:1px solid ${color}30;">${text}</span>`;
}

function statBlock(label: string, stats: ReturnType<typeof aggregateStats>, color: string) {
  return `
    <div style="flex:1;min-width:280px;">
      <h3 style="color:${color};margin-bottom:8px;font-size:15px;">${label}</h3>
      <div style="font-size:12px;color:#888;margin-bottom:12px;">
        ${stats.count} posts | conf: ${stats.avgConfidence} | summaries: ${stats.hasSummary} | tones: ${stats.hasTone} | sujets L3: ${stats.hasSubjects}
      </div>
      <h4 style="color:#666;font-size:10px;text-transform:uppercase;margin:10px 0 4px;">Themes</h4>
      <div>${stats.themes.slice(0, 10).map(([n, c]) => badge(`${n} ${c}`, color)).join('')}</div>
      <h4 style="color:#666;font-size:10px;text-transform:uppercase;margin:10px 0 4px;">Sujets L3</h4>
      <div>${stats.subjects.length > 0 ? stats.subjects.slice(0, 15).map(([n, c]) => badge(`${n} ${c}`, color)).join('') : '<span style="color:#444;">aucun</span>'}</div>
      <h4 style="color:#666;font-size:10px;text-transform:uppercase;margin:10px 0 4px;">Ton</h4>
      <div>${stats.tones.length > 0 ? stats.tones.map(([n, c]) => badge(`${n} ${c}`, color)).join('') : '<span style="color:#444;">aucun</span>'}</div>
      <h4 style="color:#666;font-size:10px;text-transform:uppercase;margin:10px 0 4px;">Emotion</h4>
      <div>${stats.emotions.length > 0 ? stats.emotions.map(([n, c]) => badge(`${n} ${c}`, color)).join('') : '<span style="color:#444;">aucun</span>'}</div>
      <h4 style="color:#666;font-size:10px;text-transform:uppercase;margin:10px 0 4px;">Narratif</h4>
      <div>${stats.narratives.length > 0 ? stats.narratives.map(([n, c]) => badge(`${n} ${c}`, color)).join('') : '<span style="color:#444;">aucun</span>'}</div>
    </div>`;
}

function postCard(r: any, labelColor: string) {
  const mains = parse(r.mainTopics);
  const subs = parse(r.subjects).map((s: any) => typeof s === 'string' ? s : s?.label).filter(Boolean);
  return `
    <div style="background:#161616;border:1px solid #222;border-radius:8px;padding:12px;margin-bottom:6px;border-left:3px solid ${labelColor};">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-weight:600;font-size:13px;color:#fff;">@${r.username}</span>
        <span style="font-size:10px;color:#666;">${r.model || r.provider} | ${(r.confidenceScore * 100).toFixed(0)}%</span>
      </div>
      ${r.semanticSummary ? `<div style="font-size:13px;color:#ddd;margin-bottom:4px;">${r.semanticSummary}</div>` : ''}
      <div style="font-size:11px;color:#888;">
        ${mains.map((t: string) => `<span style="color:#8B8BFF;">${t}</span>`).join(', ')}
        ${subs.length ? ` → ${subs.slice(0, 4).map((s: string) => `<span style="color:#88CCFF;">${s}</span>`).join(', ')}` : ''}
      </div>
      ${r.tone || r.primaryEmotion ? `<div style="margin-top:3px;">${r.tone ? badge(r.tone, '#888') : ''}${r.primaryEmotion ? badge(r.primaryEmotion, '#6BE88B') : ''}</div>` : ''}
    </div>`;
}

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Scrollout — Rules vs 4o-mini vs 4.1-nano</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', sans-serif; background: #0d0d0d; color: #e0e0e0; padding: 20px; line-height: 1.5; }
  h1 { font-size: 24px; color: #fff; margin-bottom: 4px; }
  .sub { color: #888; margin-bottom: 24px; font-size: 13px; }
  h2 { font-size: 16px; color: #aaa; border-bottom: 1px solid #222; padding-bottom: 6px; margin: 28px 0 14px; }
  .cols { display: flex; gap: 20px; flex-wrap: wrap; }
  .col { flex: 1; min-width: 300px; }
</style>
</head>
<body>

<h1>Rules vs GPT-4o-mini vs GPT-4.1-nano</h1>
<p class="sub">Comparaison qualite d'enrichissement — ${new Date().toLocaleDateString('fr-FR')}</p>

<h2>Agregats</h2>
<div style="display:flex;gap:20px;flex-wrap:wrap;">
  ${statBlock('GPT-4.1-nano (nouveau)', nanoStats, '#88CCFF')}
  ${statBlock('GPT-4o-mini (precedent)', miniStats, '#6BE88B')}
  ${statBlock('Rules-only', rulesStats, '#FF7B33')}
</div>

<h2>Posts GPT-4.1-nano (${nanoPosts.length})</h2>
${nanoPosts.slice(0, 50).map(p => postCard(p, '#88CCFF')).join('')}

<h2>Posts GPT-4o-mini (${miniPosts.length})</h2>
${miniPosts.slice(0, 50).map(p => postCard(p, '#6BE88B')).join('')}

<h2>Posts Rules-only (sample ${rulesPosts.length})</h2>
${rulesPosts.slice(0, 30).map(p => postCard(p, '#FF7B33')).join('')}

<div style="text-align:center;padding:40px;color:#333;font-size:11px;">Scrollout — Model Compare — ${new Date().toISOString().slice(0, 16)}</div>
</body>
</html>`;

const outPath = path.join(__dirname, '..', 'data', 'taxonomy-compare-nano.html');
writeFileSync(outPath, html, 'utf-8');
console.log(`Written: ${outPath} (nano:${nanoPosts.length}, mini:${miniPosts.length}, rules:${rulesPosts.length})`);
