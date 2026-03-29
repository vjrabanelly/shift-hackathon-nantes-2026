/**
 * Compare v3 — factual prompt (mini) vs prescriptive (mini v2) vs nano
 */
import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import path from 'path';

const dbFactual = new Database(path.join(__dirname, '..', 'data', 'echa_device_factual.db'));
const dbPrescriptive = new Database(path.join(__dirname, '..', 'data', 'echa_device_mini2.db'));
const dbNano = new Database(path.join(__dirname, '..', 'data', 'echa_device_nano.db'));

function parse(s: string): any[] { try { return JSON.parse(s || '[]'); } catch { return []; } }

function query(db: Database.Database, limit = 80) {
  return db.prepare(`
    SELECT p.id as postId, p.username, substr(p.caption, 1, 200) as caption,
           e.provider, e.model, e.mainTopics, e.subjects, e.tone, e.primaryEmotion,
           e.narrativeFrame, e.semanticSummary, e.confidenceScore, e.politicalExplicitnessScore
    FROM posts p INNER JOIN post_enriched e ON e.postId = p.id
    WHERE e.provider = 'openai' AND length(e.semanticSummary) > 5
    ORDER BY e.confidenceScore DESC LIMIT ?
  `).all(limit) as any[];
}

const factual = query(dbFactual, 80);
const prescriptive = query(dbPrescriptive, 80);
const nano = query(dbNano, 80);

function badge(t: string, c: string) {
  return `<span style="display:inline-block;padding:2px 6px;margin:1px;border-radius:8px;font-size:10px;background:${c}12;color:${c};border:1px solid ${c}20;">${t}</span>`;
}

function card(r: any, color: string) {
  const mains = parse(r.mainTopics);
  const subs = parse(r.subjects).map((s: any) => typeof s === 'string' ? s : s?.label).filter(Boolean);
  return `<div style="background:#131313;border:1px solid #1c1c1c;border-radius:6px;padding:9px;margin-bottom:4px;border-left:3px solid ${color};">
    <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
      <b style="font-size:11px;">@${r.username}</b>
      <span style="font-size:9px;color:#444;">${(r.confidenceScore * 100).toFixed(0)}%</span>
    </div>
    <div style="font-size:12px;color:#ccc;margin-bottom:2px;">${r.semanticSummary}</div>
    <div style="font-size:10px;color:#666;">${mains.join(', ')}${subs.length ? ' → ' + subs.slice(0, 3).join(', ') : ''}</div>
    ${r.tone ? `<div style="margin-top:2px;">${badge(r.tone, '#888')}${r.primaryEmotion ? badge(r.primaryEmotion, '#6BE88B') : ''}</div>` : ''}
  </div>`;
}

const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prompt factuel vs prescriptif vs nano</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#0a0a0a;color:#ddd;padding:16px;line-height:1.4;font-size:13px}h1{font-size:20px;color:#fff;margin-bottom:4px}.sub{color:#555;margin-bottom:16px;font-size:11px}h2{font-size:14px;color:#888;border-bottom:1px solid #1a1a1a;padding-bottom:4px;margin:20px 0 10px}.cols{display:flex;gap:12px}.col{flex:1;min-width:0;overflow:hidden}</style></head><body>
<h1>Prompt factuel vs prescriptif vs nano</h1>
<p class="sub">Meme modele 4o-mini (factuel vs prescriptif) + nano — ${new Date().toLocaleDateString('fr-FR')}</p>

<h2>Cote a cote (50 premiers, tries par confiance)</h2>
<div class="cols">
<div class="col"><div style="color:#4FC3F7;font-size:12px;font-weight:700;margin-bottom:6px;">FACTUEL (v3) — ${factual.length} posts</div>${factual.slice(0, 50).map(p => card(p, '#4FC3F7')).join('')}</div>
<div class="col"><div style="color:#6BE88B;font-size:12px;font-weight:700;margin-bottom:6px;">PRESCRIPTIF (v2) — ${prescriptive.length} posts</div>${prescriptive.slice(0, 50).map(p => card(p, '#6BE88B')).join('')}</div>
<div class="col"><div style="color:#FF7B33;font-size:12px;font-weight:700;margin-bottom:6px;">NANO — ${nano.length} posts</div>${nano.slice(0, 50).map(p => card(p, '#FF7B33')).join('')}</div>
</div>
</body></html>`;

const out = path.join(__dirname, '..', 'data', 'taxonomy-v3-compare.html');
writeFileSync(out, html, 'utf-8');
console.log(`Written: ${out} (factual:${factual.length}, prescriptive:${prescriptive.length}, nano:${nano.length})`);
