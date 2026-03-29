/**
 * Final Compare — nano vs 4o-mini (same semiological prompt)
 */
import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import path from 'path';

const dbNano = new Database(path.join(__dirname, '..', 'data', 'echa_device_nano.db'));
const dbMini = new Database(path.join(__dirname, '..', 'data', 'echa_device_mini2.db'));

function parse(s: string): any[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

function queryPosts(db: Database.Database, provider: string, limit = 200) {
  return db.prepare(`
    SELECT p.id as postId, p.username, substr(p.caption, 1, 200) as caption,
           e.provider, e.model, e.domains, e.mainTopics, e.secondaryTopics,
           e.subjects, e.preciseSubjects, e.politicalActors,
           e.tone, e.primaryEmotion, e.narrativeFrame, e.semanticSummary,
           e.confidenceScore, e.politicalExplicitnessScore, e.polarizationScore
    FROM posts p INNER JOIN post_enriched e ON e.postId = p.id
    WHERE e.provider = ?
    ORDER BY e.confidenceScore DESC LIMIT ?
  `).all(provider, limit) as any[];
}

const nanoPosts = queryPosts(dbNano, 'openai', 100);
const miniPosts = queryPosts(dbMini, 'openai', 100);

function badge(t: string, c: string) {
  return `<span style="display:inline-block;padding:2px 7px;margin:1px;border-radius:10px;font-size:10px;background:${c}15;color:${c};border:1px solid ${c}25;">${t}</span>`;
}

function postCard(r: any, color: string) {
  const mains = parse(r.mainTopics);
  const subs = parse(r.subjects).map((s: any) => typeof s === 'string' ? s : s?.label).filter(Boolean);
  return `<div style="background:#141414;border:1px solid #1e1e1e;border-radius:6px;padding:10px;margin-bottom:5px;border-left:3px solid ${color};">
    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
      <b style="font-size:12px;">@${r.username}</b>
      <span style="font-size:9px;color:#555;">${(r.confidenceScore * 100).toFixed(0)}% | pol:${r.politicalExplicitnessScore}</span>
    </div>
    ${r.semanticSummary ? `<div style="font-size:12px;color:#ccc;margin-bottom:3px;">${r.semanticSummary}</div>` : ''}
    <div style="font-size:10px;">${mains.map((t: string) => `<span style="color:#8B8BFF;">${t}</span>`).join(', ')}${subs.length ? ` → ${subs.slice(0, 3).map((s: string) => `<span style="color:#88CCFF;">${s}</span>`).join(', ')}` : ''}</div>
    ${r.tone || r.primaryEmotion ? `<div style="margin-top:2px;">${r.tone ? badge(r.tone, '#888') : ''}${r.primaryEmotion ? badge(r.primaryEmotion, '#6BE88B') : ''}</div>` : ''}
  </div>`;
}

function agg(rows: any[]) {
  const tones: Record<string, number> = {};
  const emotions: Record<string, number> = {};
  const themes: Record<string, number> = {};
  const subjects: Record<string, number> = {};
  let confSum = 0, hasSummary = 0, hasSubjects = 0;
  for (const r of rows) {
    if (r.tone) tones[r.tone] = (tones[r.tone] || 0) + 1;
    if (r.primaryEmotion) emotions[r.primaryEmotion] = (emotions[r.primaryEmotion] || 0) + 1;
    for (const t of parse(r.mainTopics)) if (t) themes[t] = (themes[t] || 0) + 1;
    const s = parse(r.subjects);
    for (const x of s) { const l = typeof x === 'string' ? x : x?.label; if (l) subjects[l] = (subjects[l] || 0) + 1; }
    if (s.length) hasSubjects++;
    if (r.semanticSummary) hasSummary++;
    confSum += r.confidenceScore || 0;
  }
  const sort = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  return { count: rows.length, avgConf: (confSum / (rows.length || 1)).toFixed(2), hasSummary, hasSubjects, tones: sort(tones), emotions: sort(emotions), themes: sort(themes), subjects: sort(subjects) };
}

const ns = agg(nanoPosts);
const ms = agg(miniPosts);

const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>nano vs mini — meme prompt semiologique</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#0a0a0a;color:#ddd;padding:16px;line-height:1.4;font-size:13px}h1{font-size:22px;color:#fff;margin-bottom:4px}h2{font-size:15px;color:#999;border-bottom:1px solid #1a1a1a;padding-bottom:6px;margin:24px 0 12px}.sub{color:#666;margin-bottom:20px;font-size:12px}.cols{display:flex;gap:16px;flex-wrap:wrap}.col{flex:1;min-width:280px}</style></head><body>
<h1>GPT-4.1-nano vs GPT-4o-mini</h1>
<p class="sub">Meme prompt semiologique — ${new Date().toLocaleDateString('fr-FR')}</p>

<h2>Stats</h2>
<div class="cols">
<div class="col" style="background:#111;padding:12px;border-radius:8px;border-top:3px solid #88CCFF;">
  <b style="color:#88CCFF;">4.1-nano</b> — ${ns.count} posts, conf: ${ns.avgConf}, summaries: ${ns.hasSummary}, sujets: ${ns.hasSubjects}<br>
  <b style="font-size:10px;color:#666;">Themes:</b> ${ns.themes.slice(0, 8).map(([n, c]) => badge(`${n} ${c}`, '#88CCFF')).join('')}<br>
  <b style="font-size:10px;color:#666;">Tons:</b> ${ns.tones.map(([n, c]) => badge(`${n} ${c}`, '#88CCFF')).join('')}<br>
  <b style="font-size:10px;color:#666;">Emotions:</b> ${ns.emotions.slice(0, 6).map(([n, c]) => badge(`${n} ${c}`, '#88CCFF')).join('')}<br>
  <b style="font-size:10px;color:#666;">Sujets L3:</b> ${ns.subjects.slice(0, 10).map(([n, c]) => badge(`${n} ${c}`, '#88CCFF')).join('')}
</div>
<div class="col" style="background:#111;padding:12px;border-radius:8px;border-top:3px solid #6BE88B;">
  <b style="color:#6BE88B;">4o-mini</b> — ${ms.count} posts, conf: ${ms.avgConf}, summaries: ${ms.hasSummary}, sujets: ${ms.hasSubjects}<br>
  <b style="font-size:10px;color:#666;">Themes:</b> ${ms.themes.slice(0, 8).map(([n, c]) => badge(`${n} ${c}`, '#6BE88B')).join('')}<br>
  <b style="font-size:10px;color:#666;">Tons:</b> ${ms.tones.map(([n, c]) => badge(`${n} ${c}`, '#6BE88B')).join('')}<br>
  <b style="font-size:10px;color:#666;">Emotions:</b> ${ms.emotions.slice(0, 6).map(([n, c]) => badge(`${n} ${c}`, '#6BE88B')).join('')}<br>
  <b style="font-size:10px;color:#666;">Sujets L3:</b> ${ms.subjects.slice(0, 10).map(([n, c]) => badge(`${n} ${c}`, '#6BE88B')).join('')}
</div>
</div>

<h2>Posts cote a cote (50 premiers)</h2>
<div class="cols">
<div class="col"><h3 style="color:#88CCFF;font-size:13px;margin-bottom:8px;">4.1-nano</h3>${nanoPosts.slice(0, 50).map(p => postCard(p, '#88CCFF')).join('')}</div>
<div class="col"><h3 style="color:#6BE88B;font-size:13px;margin-bottom:8px;">4o-mini</h3>${miniPosts.slice(0, 50).map(p => postCard(p, '#6BE88B')).join('')}</div>
</div>

<div style="text-align:center;padding:30px;color:#333;font-size:10px;">Scrollout Model Compare — ${new Date().toISOString().slice(0, 16)}</div>
</body></html>`;

const out = path.join(__dirname, '..', 'data', 'taxonomy-nano-vs-mini.html');
writeFileSync(out, html, 'utf-8');
console.log(`Written: ${out} (nano:${nanoPosts.length}, mini:${miniPosts.length})`);
