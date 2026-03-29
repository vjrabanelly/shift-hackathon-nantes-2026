/**
 * Taxonomy Extract — Dumps all 5 enrichment levels to an HTML report.
 * Usage: npx tsx scripts/taxonomy-extract.ts
 */
import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import path from 'path';

const db = new Database(path.join(__dirname, '..', 'data', 'echa_device_now.db'));

function parse(s: string): any[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

const rows = db.prepare(`
  SELECT domains, mainTopics, secondaryTopics, subjects, preciseSubjects,
         politicalActors, institutions, persons, organizations, countries,
         tone, primaryEmotion, narrativeFrame, mediaCategory, confidenceScore
  FROM PostEnriched WHERE confidenceScore > 0
`).all() as any[];

const domainCounts: Record<string, number> = {};
const themeCounts: Record<string, { main: number; sec: number }> = {};
const subjectCounts: Record<string, number> = {};
const preciseMap: Record<string, { stmt: string; count: number; pos: Record<string, number> }> = {};
const entityMap: Record<string, { type: string; count: number }> = {};
const toneCounts: Record<string, number> = {};
const emotionCounts: Record<string, number> = {};
const narrativeCounts: Record<string, number> = {};
const categoryCounts: Record<string, number> = {};

for (const r of rows) {
  for (const d of parse(r.domains)) if (d) domainCounts[d] = (domainCounts[d] || 0) + 1;

  for (const t of parse(r.mainTopics)) if (t) {
    themeCounts[t] = themeCounts[t] || { main: 0, sec: 0 };
    themeCounts[t].main++;
  }
  for (const t of parse(r.secondaryTopics)) if (t) {
    themeCounts[t] = themeCounts[t] || { main: 0, sec: 0 };
    themeCounts[t].sec++;
  }

  for (const s of parse(r.subjects)) {
    const l = typeof s === 'string' ? s : s?.label;
    if (l) subjectCounts[l] = (subjectCounts[l] || 0) + 1;
  }

  for (const ps of parse(r.preciseSubjects)) {
    if (!ps?.id) continue;
    preciseMap[ps.id] = preciseMap[ps.id] || { stmt: ps.statement || ps.id, count: 0, pos: {} };
    preciseMap[ps.id].count++;
    const p = ps.position || 'neutre';
    preciseMap[ps.id].pos[p] = (preciseMap[ps.id].pos[p] || 0) + 1;
  }

  const addE = (arr: any[], type: string) => {
    for (const e of arr) if (e) {
      entityMap[e] = entityMap[e] || { type, count: 0 };
      entityMap[e].count++;
    }
  };
  addE(parse(r.politicalActors), 'Acteur politique');
  addE(parse(r.persons), 'Personne');
  addE(parse(r.organizations), 'Organisation');
  addE(parse(r.institutions), 'Institution');
  addE(parse(r.countries), 'Pays');

  if (r.tone) toneCounts[r.tone] = (toneCounts[r.tone] || 0) + 1;
  if (r.primaryEmotion) emotionCounts[r.primaryEmotion] = (emotionCounts[r.primaryEmotion] || 0) + 1;
  if (r.narrativeFrame && r.narrativeFrame !== 'aucun')
    narrativeCounts[r.narrativeFrame] = (narrativeCounts[r.narrativeFrame] || 0) + 1;
  if (r.mediaCategory) categoryCounts[r.mediaCategory] = (categoryCounts[r.mediaCategory] || 0) + 1;
}

// Sample posts with richest taxonomy
const samples = db.prepare(`
  SELECT p.id as postId, p.username, substr(p.caption, 1, 150) as caption, p.dwellTimeMs,
         e.domains, e.mainTopics, e.secondaryTopics, e.subjects, e.preciseSubjects,
         e.politicalActors, e.persons, e.organizations, e.institutions, e.countries,
         e.tone, e.primaryEmotion, e.narrativeFrame, e.semanticSummary,
         e.confidenceScore, e.politicalExplicitnessScore, e.polarizationScore
  FROM Post p INNER JOIN PostEnriched e ON e.postId = p.id
  WHERE e.confidenceScore > 0.1
  ORDER BY e.confidenceScore DESC LIMIT 25
`).all() as any[];

const sort = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
const sortThemes = Object.entries(themeCounts)
  .map(([k, v]) => ({ name: k, main: v.main, sec: v.sec, total: v.main + v.sec }))
  .sort((a, b) => b.total - a.total);

// ── Domain → Theme mapping from taxonomy ──
const DOMAIN_LABELS: Record<string, string> = {
  politique_societe: 'Politique & Societe',
  economie_travail: 'Economie & Travail',
  information_savoirs: 'Information & Savoirs',
  culture_divertissement: 'Culture & Divertissement',
  lifestyle_bienetre: 'Lifestyle & Bien-etre',
  vie_quotidienne: 'Vie quotidienne',
  ecologie_environnement: 'Ecologie & Environnement',
  religion_spiritualite: 'Religion & Spiritualite',
};

const THEME_TO_DOMAIN: Record<string, string> = {
  politique: 'politique_societe', geopolitique: 'politique_societe',
  immigration: 'politique_societe', securite: 'politique_societe',
  justice: 'politique_societe', societe: 'politique_societe',
  feminisme: 'politique_societe', masculinite: 'politique_societe',
  identite: 'politique_societe',
  economie: 'economie_travail', business: 'economie_travail',
  actualite: 'information_savoirs', education: 'information_savoirs',
  technologie: 'information_savoirs', sante: 'information_savoirs',
  culture: 'culture_divertissement', humour: 'culture_divertissement',
  divertissement: 'culture_divertissement', sport: 'culture_divertissement',
  lifestyle: 'lifestyle_bienetre', beaute: 'lifestyle_bienetre',
  developpement_personnel: 'lifestyle_bienetre', food: 'lifestyle_bienetre',
  voyage: 'lifestyle_bienetre', maison_jardin: 'lifestyle_bienetre',
  animaux: 'vie_quotidienne', parentalite: 'vie_quotidienne',
  automobile: 'vie_quotidienne', shopping: 'vie_quotidienne',
  ecologie: 'ecologie_environnement', religion: 'religion_spiritualite',
};

// ── Generate HTML ──

function bar(count: number, max: number, color: string) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return `<div style="background:${color};height:20px;width:${pct}%;border-radius:3px;min-width:2px;"></div>`;
}

function badge(text: string, color: string) {
  return `<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:12px;font-size:12px;background:${color}20;color:${color};border:1px solid ${color}40;">${text}</span>`;
}

const TYPE_COLORS: Record<string, string> = {
  'Acteur politique': '#FF7B33', Personne: '#3399FF', Organisation: '#E84BE8',
  Institution: '#FFD700', Pays: '#44CC88', Domain: '#66FF66',
};

const domainEntries = sort(domainCounts);
const maxDomain = domainEntries[0]?.[1] || 1;
const maxTheme = sortThemes[0]?.total || 1;
const subjectEntries = sort(subjectCounts);
const maxSubject = subjectEntries[0]?.[1] || 1;
const entityEntries = Object.entries(entityMap)
  .map(([name, v]) => ({ name, ...v }))
  .sort((a, b) => b.count - a.count);
const maxEntity = entityEntries[0]?.count || 1;
const preciseEntries = Object.values(preciseMap).sort((a, b) => b.count - a.count);

// Group themes by domain
const themesByDomain: Record<string, typeof sortThemes> = {};
for (const t of sortThemes) {
  const domId = THEME_TO_DOMAIN[t.name] || 'unknown';
  themesByDomain[domId] = themesByDomain[domId] || [];
  themesByDomain[domId].push(t);
}

const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Scrollout — Taxonomy Extract</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', -apple-system, sans-serif; background: #0d0d0d; color: #e0e0e0; padding: 20px; line-height: 1.5; }
  h1 { font-size: 28px; margin-bottom: 4px; color: #fff; }
  .subtitle { color: #888; margin-bottom: 30px; font-size: 14px; }
  h2 { font-size: 18px; color: #aaa; border-bottom: 1px solid #222; padding-bottom: 8px; margin: 30px 0 16px; text-transform: uppercase; letter-spacing: 1px; }
  h2 .level { color: #666; font-size: 13px; font-weight: normal; }
  .stats-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .stat-card { background: #161616; border: 1px solid #222; border-radius: 10px; padding: 16px 20px; min-width: 140px; flex: 1; }
  .stat-card .val { font-size: 32px; font-weight: 700; color: #fff; }
  .stat-card .lbl { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 6px; }
  .row:hover { background: #1a1a1a; }
  .row .name { min-width: 200px; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .count { min-width: 40px; text-align: right; font-weight: 600; font-size: 14px; color: #fff; }
  .row .bar-container { flex: 1; }
  .row .meta { font-size: 11px; color: #666; min-width: 100px; }
  .domain-group { margin-bottom: 20px; }
  .domain-group .domain-header { font-size: 15px; font-weight: 600; color: #8B8BFF; margin-bottom: 4px; padding-left: 12px; }
  .domain-group .row .name { padding-left: 12px; }
  .precise-card { background: #161616; border: 1px solid #222; border-radius: 8px; padding: 14px 18px; margin-bottom: 10px; }
  .precise-card .statement { font-size: 14px; color: #ccc; margin-bottom: 6px; font-style: italic; }
  .precise-card .positions { display: flex; gap: 8px; flex-wrap: wrap; }
  .entity-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .sample-post { background: #161616; border: 1px solid #222; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
  .sample-post .header { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .sample-post .username { font-weight: 600; color: #fff; }
  .sample-post .confidence { font-size: 12px; color: #888; }
  .sample-post .caption { font-size: 13px; color: #999; margin-bottom: 10px; font-style: italic; }
  .sample-post .summary { font-size: 13px; color: #bbb; margin-bottom: 10px; }
  .sample-post .taxonomy-chain { font-size: 12px; margin-bottom: 6px; }
  .sample-post .taxonomy-chain .arrow { color: #444; margin: 0 4px; }
  .sample-post .taxonomy-chain .l1 { color: #66FF66; }
  .sample-post .taxonomy-chain .l2 { color: #8B8BFF; }
  .sample-post .taxonomy-chain .l3 { color: #88CCFF; }
  .sample-post .taxonomy-chain .l4 { color: #E84BE8; }
  .sample-post .taxonomy-chain .l5 { color: #FF7B33; }
  .tag-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .meta-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
  .meta-section { background: #161616; border: 1px solid #222; border-radius: 8px; padding: 14px; }
  .meta-section h3 { font-size: 13px; color: #666; margin-bottom: 8px; text-transform: uppercase; }
  .meta-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
  .meta-item .v { color: #fff; font-weight: 500; }
</style>
</head>
<body>

<h1>Scrollout Taxonomy Extract</h1>
<p class="subtitle">147 posts enrichis — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} — 5 niveaux de classification</p>

<div class="stats-row">
  <div class="stat-card"><div class="val">${rows.length}</div><div class="lbl">Posts enrichis</div></div>
  <div class="stat-card"><div class="val">${domainEntries.length}</div><div class="lbl">Domaines (L1)</div></div>
  <div class="stat-card"><div class="val">${sortThemes.length}</div><div class="lbl">Themes (L2)</div></div>
  <div class="stat-card"><div class="val">${subjectEntries.length}</div><div class="lbl">Sujets (L3)</div></div>
  <div class="stat-card"><div class="val">${preciseEntries.length}</div><div class="lbl">Sujets precis (L4)</div></div>
  <div class="stat-card"><div class="val">${entityEntries.length}</div><div class="lbl">Entites (L5)</div></div>
</div>

<!-- ═══ LEVEL 1: DOMAINES ═══ -->
<h2>Niveau 1 — Domaines <span class="level">macro-agr&eacute;gation</span></h2>
${domainEntries.map(([name, count]) => `
<div class="row">
  <div class="count">${count}</div>
  <div class="name" style="color:#66FF66;">${DOMAIN_LABELS[name] || name}</div>
  <div class="bar-container">${bar(count, maxDomain, '#66FF66')}</div>
  <div class="meta">${Math.round(count / rows.length * 100)}% des posts</div>
</div>`).join('')}

<!-- ═══ LEVEL 2: THEMES (grouped by domain) ═══ -->
<h2>Niveau 2 — Themes <span class="level">classification multi-label (main + secondary)</span></h2>
${Object.entries(themesByDomain).filter(([k]) => k !== 'unknown').map(([domId, themes]) => `
<div class="domain-group">
  <div class="domain-header">${DOMAIN_LABELS[domId] || domId}</div>
  ${themes.map(t => `
  <div class="row">
    <div class="count">${t.total}</div>
    <div class="name">${t.name}</div>
    <div class="bar-container">
      <div style="display:flex;gap:2px;">
        <div style="background:#6B6BFF;height:20px;width:${Math.round(t.main/maxTheme*100)}%;border-radius:3px 0 0 3px;min-width:${t.main>0?2:0}px;" title="principal: ${t.main}"></div>
        <div style="background:#6B6BFF60;height:20px;width:${Math.round(t.sec/maxTheme*100)}%;border-radius:0 3px 3px 0;min-width:${t.sec>0?2:0}px;" title="secondaire: ${t.sec}"></div>
      </div>
    </div>
    <div class="meta">main: ${t.main} | sec: ${t.sec}</div>
  </div>`).join('')}
</div>`).join('')}

<!-- ═══ LEVEL 3: SUJETS ═══ -->
<h2>Niveau 3 — Sujets <span class="level">sous-cat&eacute;gories stables</span></h2>
${subjectEntries.map(([name, count]) => `
<div class="row">
  <div class="count">${count}</div>
  <div class="name" style="color:#88CCFF;">${name}</div>
  <div class="bar-container">${bar(count, maxSubject, '#88CCFF')}</div>
</div>`).join('') || '<p style="color:#555;padding:12px;">Aucun sujet detect&eacute;</p>'}

<!-- ═══ LEVEL 4: SUJETS PRECIS ═══ -->
<h2>Niveau 4 — Sujets Pr&eacute;cis <span class="level">propositions d&eacute;battables avec positions</span></h2>
${preciseEntries.length > 0 ? preciseEntries.map(ps => `
<div class="precise-card">
  <div class="statement">&laquo; ${ps.stmt} &raquo;</div>
  <div style="font-size:12px;color:#888;margin-bottom:4px;">${ps.count} occurrence${ps.count > 1 ? 's' : ''}</div>
  <div class="positions">
    ${Object.entries(ps.pos).map(([pos, cnt]) =>
      badge(`${pos}: ${cnt}`, pos === 'pour' ? '#44CC88' : pos === 'contre' ? '#FF4444' : '#888')
    ).join('')}
  </div>
</div>`).join('') : '<p style="color:#555;padding:12px;">Aucun sujet pr&eacute;cis detect&eacute; (niveau 4 = propositions contest&eacute;es)</p>'}

<!-- ═══ LEVEL 5: ENTITES ═══ -->
<h2>Niveau 5 — Entit&eacute;s & Marqueurs <span class="level">d&eacute;tect&eacute;s dynamiquement</span></h2>
<div class="entity-grid" style="margin-bottom:16px;">
  ${entityEntries.map(e => badge(`${e.name} (${e.count})`, TYPE_COLORS[e.type] || '#888')).join('')}
</div>
${entityEntries.length === 0 ? '<p style="color:#555;padding:12px;">Aucune entit&eacute; detect&eacute;e</p>' : ''}
${entityEntries.length > 0 ? entityEntries.slice(0, 20).map(e => `
<div class="row">
  <div class="count">${e.count}</div>
  <div class="name" style="color:${TYPE_COLORS[e.type] || '#ccc'};">${e.name}</div>
  <div class="bar-container">${bar(e.count, maxEntity, TYPE_COLORS[e.type] || '#888')}</div>
  <div class="meta">${e.type}</div>
</div>`).join('') : ''}

<!-- ═══ META: SIGNALS ═══ -->
<h2>Signaux s&eacute;mantiques <span class="level">ton, &eacute;motion, narratif, cat&eacute;gorie</span></h2>
<div class="meta-grid">
  <div class="meta-section">
    <h3>Ton</h3>
    ${sort(toneCounts).map(([v, c]) => `<div class="meta-item"><span>${v}</span><span class="v">${c}</span></div>`).join('')}
  </div>
  <div class="meta-section">
    <h3>Emotion primaire</h3>
    ${sort(emotionCounts).map(([v, c]) => `<div class="meta-item"><span>${v}</span><span class="v">${c}</span></div>`).join('')}
  </div>
  <div class="meta-section">
    <h3>Cadre narratif</h3>
    ${sort(narrativeCounts).map(([v, c]) => `<div class="meta-item"><span>${v}</span><span class="v">${c}</span></div>`).join('')}
  </div>
  <div class="meta-section">
    <h3>Cat&eacute;gorie m&eacute;dia</h3>
    ${sort(categoryCounts).map(([v, c]) => `<div class="meta-item"><span>${v}</span><span class="v">${c}</span></div>`).join('')}
  </div>
</div>

<!-- ═══ SAMPLE POSTS ═══ -->
<h2>Exemples de posts enrichis <span class="level">25 meilleurs scores de confiance</span></h2>
${samples.map((s: any) => {
  const doms = parse(s.domains);
  const mains = parse(s.mainTopics);
  const secs = parse(s.secondaryTopics);
  const subjs = parse(s.subjects).map((x: any) => typeof x === 'string' ? x : x?.label).filter(Boolean);
  const precise = parse(s.preciseSubjects);
  const actors = parse(s.politicalActors);
  const persons = parse(s.persons);
  const orgs = parse(s.organizations);
  const insts = parse(s.institutions);
  const countries = parse(s.countries);
  const allEntities = [
    ...actors.map((a: string) => ({ name: a, type: 'Acteur politique' })),
    ...persons.map((p: string) => ({ name: p, type: 'Personne' })),
    ...orgs.map((o: string) => ({ name: o, type: 'Organisation' })),
    ...insts.map((i: string) => ({ name: i, type: 'Institution' })),
    ...countries.map((c: string) => ({ name: c, type: 'Pays' })),
  ];

  return `
<div class="sample-post">
  <div class="header">
    <span class="username">@${s.username}</span>
    <span class="confidence">confiance: ${(s.confidenceScore * 100).toFixed(0)}% | pol: ${s.politicalExplicitnessScore}/4 | polar: ${(s.polarizationScore * 100).toFixed(0)}%</span>
  </div>
  ${s.caption ? `<div class="caption">${s.caption}...</div>` : ''}
  ${s.semanticSummary ? `<div class="summary">${s.semanticSummary}</div>` : ''}
  <div class="taxonomy-chain">
    ${doms.map((d: string) => `<span class="l1">${DOMAIN_LABELS[d] || d}</span>`).join(' ')}
    ${(doms.length && mains.length) ? '<span class="arrow">&rarr;</span>' : ''}
    ${mains.map((t: string) => `<span class="l2">${t}</span>`).join(', ')}
    ${secs.length ? `<span style="color:#555;"> (+${secs.join(', ')})</span>` : ''}
    ${subjs.length ? `<span class="arrow">&rarr;</span>${subjs.map((s: string) => `<span class="l3">${s}</span>`).join(', ')}` : ''}
    ${precise.length ? `<span class="arrow">&rarr;</span>${precise.map((p: any) => `<span class="l4">${p.statement || p.id} [${p.position || '?'}]</span>`).join(', ')}` : ''}
  </div>
  ${allEntities.length ? `<div class="tag-row">${allEntities.map((e: any) => badge(e.name, TYPE_COLORS[e.type] || '#888')).join('')}</div>` : ''}
  ${s.tone || s.primaryEmotion || s.narrativeFrame ? `<div class="tag-row" style="margin-top:4px;">
    ${s.tone ? badge('ton: ' + s.tone, '#888') : ''}
    ${s.primaryEmotion ? badge(s.primaryEmotion, '#6BE88B') : ''}
    ${s.narrativeFrame && s.narrativeFrame !== 'aucun' ? badge('narratif: ' + s.narrativeFrame, '#FF2222') : ''}
  </div>` : ''}
</div>`;
}).join('')}

<div style="text-align:center;padding:40px;color:#333;font-size:12px;">
  Scrollout Taxonomy Extract &mdash; ${new Date().toISOString().slice(0, 16)} &mdash; 178 posts / 147 enrichis
</div>
</body>
</html>`;

const outPath = path.join(__dirname, '..', 'data', 'taxonomy-extract.html');
writeFileSync(outPath, htmlContent, 'utf-8');
console.log(`Written to ${outPath}`);
