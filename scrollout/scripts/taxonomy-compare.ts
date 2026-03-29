/**
 * Taxonomy Compare — Side-by-side rules vs OpenAI enrichment.
 * Usage: npx tsx scripts/taxonomy-compare.ts
 */
import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import path from 'path';

const db = new Database(path.join(__dirname, '..', 'data', 'echa_device_now.db'));

function parse(s: string): any[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

// ── Stats by provider ──
const providers = db.prepare(`
  SELECT provider, COUNT(*) as c FROM post_enriched GROUP BY provider
`).all() as any[];
console.log('Providers:', providers);

const openaiPosts = db.prepare(`
  SELECT p.id as postId, p.username, substr(p.caption, 1, 200) as caption,
         p.dwellTimeMs, p.attentionLevel,
         e.provider, e.model, e.domains, e.mainTopics, e.secondaryTopics,
         e.subjects, e.preciseSubjects, e.politicalActors, e.institutions,
         e.tone, e.primaryEmotion, e.narrativeFrame, e.semanticSummary,
         e.confidenceScore, e.politicalExplicitnessScore, e.polarizationScore,
         e.mediaCategory
  FROM posts p INNER JOIN post_enriched e ON e.postId = p.id
  WHERE e.provider = 'openai'
  ORDER BY e.confidenceScore DESC
`).all() as any[];

const rulesPosts = db.prepare(`
  SELECT p.id as postId, p.username, substr(p.caption, 1, 200) as caption,
         p.dwellTimeMs, p.attentionLevel,
         e.provider, e.model, e.domains, e.mainTopics, e.secondaryTopics,
         e.subjects, e.preciseSubjects, e.politicalActors, e.institutions,
         e.tone, e.primaryEmotion, e.narrativeFrame, e.semanticSummary,
         e.confidenceScore, e.politicalExplicitnessScore, e.polarizationScore,
         e.mediaCategory
  FROM posts p INNER JOIN post_enriched e ON e.postId = p.id
  WHERE e.provider = 'rules'
  ORDER BY e.confidenceScore DESC
  LIMIT 72
`).all() as any[];

// ── Aggregate stats ──
function aggregateStats(rows: any[]) {
  const domainCounts: Record<string, number> = {};
  const themeCounts: Record<string, number> = {};
  const subjectCounts: Record<string, number> = {};
  const toneCounts: Record<string, number> = {};
  const emotionCounts: Record<string, number> = {};
  const narrativeCounts: Record<string, number> = {};
  let confSum = 0;

  for (const r of rows) {
    for (const d of parse(r.domains)) if (d) domainCounts[d] = (domainCounts[d] || 0) + 1;
    for (const t of parse(r.mainTopics)) if (t) themeCounts[t] = (themeCounts[t] || 0) + 1;
    for (const s of parse(r.subjects)) {
      const l = typeof s === 'string' ? s : s?.label;
      if (l) subjectCounts[l] = (subjectCounts[l] || 0) + 1;
    }
    if (r.tone) toneCounts[r.tone] = (toneCounts[r.tone] || 0) + 1;
    if (r.primaryEmotion) emotionCounts[r.primaryEmotion] = (emotionCounts[r.primaryEmotion] || 0) + 1;
    if (r.narrativeFrame && r.narrativeFrame !== 'aucun') narrativeCounts[r.narrativeFrame] = (narrativeCounts[r.narrativeFrame] || 0) + 1;
    confSum += r.confidenceScore || 0;
  }

  const sort = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  return {
    count: rows.length,
    avgConfidence: rows.length > 0 ? Math.round(confSum / rows.length * 100) / 100 : 0,
    domains: sort(domainCounts),
    themes: sort(themeCounts),
    subjects: sort(subjectCounts),
    tones: sort(toneCounts),
    emotions: sort(emotionCounts),
    narratives: sort(narrativeCounts),
  };
}

const openaiStats = aggregateStats(openaiPosts);
const rulesStats = aggregateStats(rulesPosts);

// ── HTML ──
function badge(text: string, color: string) {
  return `<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:12px;font-size:11px;background:${color}18;color:${color};border:1px solid ${color}30;">${text}</span>`;
}

function statBlock(label: string, stats: ReturnType<typeof aggregateStats>, color: string) {
  return `
    <div style="flex:1;min-width:300px;">
      <h3 style="color:${color};margin-bottom:12px;font-size:16px;">${label} (${stats.count} posts, conf. moy: ${stats.avgConfidence})</h3>

      <h4 style="color:#888;font-size:11px;text-transform:uppercase;margin:12px 0 6px;">Domaines</h4>
      <div>${stats.domains.length > 0 ? stats.domains.map(([n, c]) => badge(`${n} ${c}`, color)).join('') : '<span style="color:#555;">aucun</span>'}</div>

      <h4 style="color:#888;font-size:11px;text-transform:uppercase;margin:12px 0 6px;">Themes</h4>
      <div>${stats.themes.map(([n, c]) => badge(`${n} ${c}`, color)).join('')}</div>

      <h4 style="color:#888;font-size:11px;text-transform:uppercase;margin:12px 0 6px;">Sujets L3</h4>
      <div>${stats.subjects.length > 0 ? stats.subjects.slice(0, 20).map(([n, c]) => badge(`${n} ${c}`, color)).join('') : '<span style="color:#555;">aucun</span>'}</div>

      <h4 style="color:#888;font-size:11px;text-transform:uppercase;margin:12px 0 6px;">Ton</h4>
      <div>${stats.tones.length > 0 ? stats.tones.map(([n, c]) => badge(`${n} ${c}`, color)).join('') : '<span style="color:#555;">aucun</span>'}</div>

      <h4 style="color:#888;font-size:11px;text-transform:uppercase;margin:12px 0 6px;">Emotion</h4>
      <div>${stats.emotions.length > 0 ? stats.emotions.map(([n, c]) => badge(`${n} ${c}`, color)).join('') : '<span style="color:#555;">aucun</span>'}</div>

      <h4 style="color:#888;font-size:11px;text-transform:uppercase;margin:12px 0 6px;">Narratif</h4>
      <div>${stats.narratives.length > 0 ? stats.narratives.map(([n, c]) => badge(`${n} ${c}`, color)).join('') : '<span style="color:#555;">aucun</span>'}</div>
    </div>`;
}

function postCard(r: any) {
  const doms = parse(r.domains);
  const mains = parse(r.mainTopics);
  const subs = parse(r.subjects).map((s: any) => typeof s === 'string' ? s : s?.label).filter(Boolean);
  const precise = parse(r.preciseSubjects);
  const actors = parse(r.politicalActors);

  return `
    <div style="background:#161616;border:1px solid #222;border-radius:8px;padding:14px;margin-bottom:8px;border-left:3px solid ${r.provider === 'openai' ? '#6BE88B' : '#FF7B33'};">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-weight:600;color:#fff;">@${r.username}</span>
        <span style="font-size:11px;color:#888;">${r.provider} | conf: ${(r.confidenceScore * 100).toFixed(0)}% | pol: ${r.politicalExplicitnessScore}/4</span>
      </div>
      ${r.semanticSummary ? `<div style="font-size:13px;color:#ccc;margin-bottom:6px;">${r.semanticSummary}</div>` : ''}
      ${r.caption ? `<div style="font-size:11px;color:#666;margin-bottom:8px;font-style:italic;">${r.caption.substring(0, 120)}...</div>` : ''}
      <div style="font-size:11px;">
        ${doms.map((d: string) => `<span style="color:#66FF66;">${d}</span>`).join(' ')}
        ${mains.length ? ` → ${mains.map((t: string) => `<span style="color:#8B8BFF;">${t}</span>`).join(', ')}` : ''}
        ${subs.length ? ` → ${subs.map((s: string) => `<span style="color:#88CCFF;">${s}</span>`).join(', ')}` : ''}
      </div>
      ${r.tone || r.primaryEmotion || r.narrativeFrame ? `<div style="margin-top:4px;">
        ${r.tone ? badge('ton: ' + r.tone, '#888') : ''}
        ${r.primaryEmotion ? badge(r.primaryEmotion, '#6BE88B') : ''}
        ${r.narrativeFrame && r.narrativeFrame !== 'aucun' ? badge('narratif: ' + r.narrativeFrame, '#FF2222') : ''}
      </div>` : ''}
      ${actors.length ? `<div style="margin-top:4px;">${actors.map((a: string) => badge(a, '#FF7B33')).join('')}</div>` : ''}
    </div>`;
}

const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Scrollout — Rules vs GPT-4o-mini</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', -apple-system, sans-serif; background: #0d0d0d; color: #e0e0e0; padding: 20px; line-height: 1.5; }
  h1 { font-size: 26px; margin-bottom: 4px; color: #fff; }
  .sub { color: #888; margin-bottom: 30px; font-size: 13px; }
  h2 { font-size: 18px; color: #aaa; border-bottom: 1px solid #222; padding-bottom: 8px; margin: 30px 0 16px; }
</style>
</head>
<body>

<h1>Rules vs GPT-4o-mini — Comparaison</h1>
<p class="sub">685 posts capturés | ${openaiPosts.length} enrichis GPT | ${rulesPosts.length} rules-only (sample) | ${new Date().toLocaleDateString('fr-FR')}</p>

<!-- Stats comparison -->
<h2>Aggregats</h2>
<div style="display:flex;gap:24px;flex-wrap:wrap;">
  ${statBlock('GPT-4o-mini', openaiStats, '#6BE88B')}
  ${statBlock('Rules-only', rulesStats, '#FF7B33')}
</div>

<!-- GPT-enriched posts -->
<h2>Posts enrichis par GPT-4o-mini (${openaiPosts.length})</h2>
${openaiPosts.map(postCard).join('')}

<!-- Rules-only posts sample -->
<h2>Posts rules-only — sample (${rulesPosts.length})</h2>
${rulesPosts.slice(0, 30).map(postCard).join('')}

<div style="text-align:center;padding:40px;color:#333;font-size:12px;">
  Scrollout — Rules vs GPT Compare — ${new Date().toISOString().slice(0, 16)}
</div>
</body>
</html>`;

const outPath = path.join(__dirname, '..', 'data', 'taxonomy-compare.html');
writeFileSync(outPath, htmlContent, 'utf-8');
console.log(`Written to ${outPath} (${openaiPosts.length} GPT, ${rulesPosts.length} rules)`);
