/**
 * ECHA — Génère un rapport HTML de la taxonomie + analyse des posts.
 * Ouvre automatiquement dans le navigateur.
 */
import prisma from './db/client';
import { DOMAINS, THEMES, getTaxonomyStats, getAllPreciseSubjects } from './enrichment/dictionaries/taxonomy';
import { writeFileSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';

async function main() {
  const stats = getTaxonomyStats();
  const allPs = getAllPreciseSubjects();

  const enriched = await prisma.postEnriched.findMany({
    include: { post: true },
    orderBy: { createdAt: 'desc' },
  });

  // ─── Compute stats ──────────────────────────────────────
  const domainCounts: Record<string, number> = {};
  const themeCounts: Record<string, number> = {};
  const subjectCounts: Record<string, number> = {};
  const psCounts: Record<string, { count: number; positions: Record<string, number>; statement: string }> = {};
  let totalPol = 0, totalPolar = 0;

  for (const pe of enriched) {
    totalPol += pe.politicalExplicitnessScore;
    totalPolar += pe.polarizationScore;
    const domains: string[] = safeJson(pe.domains);
    const topics: string[] = safeJson(pe.mainTopics);
    const subjects: any[] = safeJson(pe.subjects);
    const precise: any[] = safeJson(pe.preciseSubjects);
    for (const d of domains) domainCounts[d] = (domainCounts[d] || 0) + 1;
    for (const t of topics) themeCounts[t] = (themeCounts[t] || 0) + 1;
    for (const s of subjects) { const sid = typeof s === 'string' ? s : s.id; subjectCounts[sid] = (subjectCounts[sid] || 0) + 1; }
    for (const p of precise) {
      if (!p.id) continue;
      if (!psCounts[p.id]) psCounts[p.id] = { count: 0, positions: {}, statement: p.statement || '' };
      psCounts[p.id].count++;
      psCounts[p.id].positions[p.position] = (psCounts[p.id].positions[p.position] || 0) + 1;
    }
  }

  const avgPol = enriched.length ? totalPol / enriched.length : 0;
  const avgPolar = enriched.length ? totalPolar / enriched.length : 0;
  const polPosts = enriched.filter(pe => pe.politicalExplicitnessScore >= 2).length;
  const polarPosts = enriched.filter(pe => pe.polarizationScore >= 0.3).length;

  // Shannon entropy
  const totalDomainHits = Object.values(domainCounts).reduce((a, b) => a + b, 0) || 1;
  let entropy = 0;
  for (const c of Object.values(domainCounts)) { const p = c / totalDomainHits; if (p > 0) entropy -= p * Math.log2(p); }
  const diversity = entropy / Math.log2(DOMAINS.length);

  const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
  const sortedThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const sortedSubjects = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const sortedPs = Object.entries(psCounts).sort((a, b) => b[1].count - a[1].count);

  // Interesting posts
  const interesting = enriched
    .filter(pe => pe.politicalExplicitnessScore >= 2 || pe.polarizationScore >= 0.3)
    .sort((a, b) => b.politicalExplicitnessScore - a.politicalExplicitnessScore);
  const displayPosts = interesting.length > 0 ? interesting.slice(0, 8) : enriched.slice(0, 8);

  const now = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  // ─── Generate HTML ──────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>ECHA — Rapport Taxonomie</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; background: #fff; font-size: 11px; line-height: 1.5; }
  .page { page-break-after: always; padding: 20px 0; }
  .page:last-child { page-break-after: avoid; }

  h1 { font-size: 22px; color: #0f0f23; border-bottom: 3px solid #6366f1; padding-bottom: 8px; margin-bottom: 16px; }
  h2 { font-size: 16px; color: #312e81; margin: 20px 0 10px; border-left: 4px solid #6366f1; padding-left: 10px; }
  h3 { font-size: 13px; color: #4338ca; margin: 14px 0 6px; }

  .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 20px; }
  .header .date { color: #6b7280; font-size: 11px; }
  .logo { font-size: 28px; font-weight: 900; color: #6366f1; letter-spacing: -1px; }

  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
  .stat-card { background: linear-gradient(135deg, #f0f0ff, #e8e8ff); border-radius: 8px; padding: 12px; text-align: center; }
  .stat-card .value { font-size: 24px; font-weight: 800; color: #4338ca; }
  .stat-card .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }

  .profile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
  .profile-card { background: #f8f8ff; border: 1px solid #e0e0f0; border-radius: 8px; padding: 10px; }
  .profile-card .label { font-size: 10px; color: #6b7280; }
  .profile-card .value { font-size: 16px; font-weight: 700; }

  .bar-row { display: flex; align-items: center; margin: 3px 0; gap: 8px; }
  .bar-label { width: 160px; text-align: right; font-size: 10px; color: #374151; white-space: nowrap; overflow: hidden; }
  .bar-track { flex: 1; height: 14px; background: #f0f0f5; border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
  .bar-fill.domain { background: linear-gradient(90deg, #818cf8, #6366f1); }
  .bar-fill.theme { background: linear-gradient(90deg, #67e8f9, #06b6d4); }
  .bar-fill.subject { background: linear-gradient(90deg, #86efac, #22c55e); }
  .bar-value { width: 30px; font-size: 10px; font-weight: 600; color: #4b5563; }

  .tree { font-family: 'Cascadia Code', 'Fira Code', monospace; font-size: 10px; line-height: 1.7; }
  .tree .domain { font-weight: 700; color: #4338ca; font-size: 11px; }
  .tree .theme { color: #0891b2; }
  .tree .subject { color: #16a34a; }
  .tree .precise { color: #ca8a04; font-style: italic; }
  .tree .dim { color: #9ca3af; }
  .tree .positions { color: #6b7280; font-size: 9px; }

  .post-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 8px 0; page-break-inside: avoid; }
  .post-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .post-username { font-weight: 700; font-size: 13px; color: #1e1b4b; }
  .post-type { background: #f0f0f5; padding: 2px 8px; border-radius: 10px; font-size: 9px; color: #6b7280; }
  .post-summary { color: #374151; margin: 6px 0; font-size: 11px; }
  .post-scores { display: flex; gap: 16px; margin: 8px 0; }
  .score-item { display: flex; align-items: center; gap: 4px; }
  .score-badge { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
  .score-badge.pol0 { background: #d1d5db; }
  .score-badge.pol1 { background: #fbbf24; }
  .score-badge.pol2 { background: #f97316; }
  .score-badge.pol3 { background: #ef4444; }
  .score-badge.pol4 { background: #dc2626; }
  .polar-bar { width: 80px; height: 6px; background: #f0f0f5; border-radius: 3px; overflow: hidden; display: inline-block; vertical-align: middle; }
  .polar-fill { height: 100%; border-radius: 3px; }
  .polar-low { background: #86efac; }
  .polar-med { background: #fbbf24; }
  .polar-high { background: #ef4444; }
  .post-tags { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
  .tag { padding: 1px 7px; border-radius: 10px; font-size: 9px; font-weight: 500; }
  .tag.domain { background: #ede9fe; color: #5b21b6; }
  .tag.theme { background: #ecfeff; color: #0e7490; }
  .tag.subject { background: #f0fdf4; color: #15803d; }
  .tag.precise { background: #fefce8; color: #a16207; }
  .tag.pour { border: 1px solid #22c55e; }
  .tag.contre { border: 1px solid #ef4444; }
  .tag.neutre { border: 1px solid #6b7280; }
  .post-meta { font-size: 9px; color: #9ca3af; }

  .ps-item { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 6px 10px; margin: 4px 0; border-radius: 0 6px 6px 0; }
  .ps-statement { font-style: italic; color: #78350f; }
  .ps-positions { font-size: 9px; color: #92400e; }

  .diversity-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .diversity-badge.high { background: #dcfce7; color: #15803d; }
  .diversity-badge.moderate { background: #fef9c3; color: #a16207; }
  .diversity-badge.low { background: #fee2e2; color: #b91c1c; }

  .footer { text-align: center; color: #9ca3af; font-size: 9px; margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb; }
</style>
</head>
<body>

<!-- PAGE 1 : Vue d'ensemble -->
<div class="page">
  <div class="header">
    <div><span class="logo">ECHA</span> <span style="color:#6b7280; font-size:12px;">Instagram Content Intelligence</span></div>
    <div class="date">${now}</div>
  </div>

  <h1>Rapport Taxonomie & Analyse</h1>

  <h2>Structure de la taxonomie</h2>
  <div class="stats-grid">
    <div class="stat-card"><div class="value">${stats.domains}</div><div class="label">Domaines</div></div>
    <div class="stat-card"><div class="value">${stats.themes}</div><div class="label">Thèmes</div></div>
    <div class="stat-card"><div class="value">${stats.subjects}</div><div class="label">Sujets</div></div>
    <div class="stat-card"><div class="value">${stats.preciseSubjects}</div><div class="label">Sujets précis</div></div>
  </div>

  <div style="text-align:center; margin:12px 0; color:#6b7280; font-size:10px;">
    Domaine <span style="color:#6366f1;">●</span> → Thème <span style="color:#06b6d4;">●</span> → Sujet <span style="color:#22c55e;">●</span> → Sujet précis <span style="color:#f59e0b;">●</span> → Marqueur <span style="color:#ef4444;">●</span>
  </div>

  <h2>Profil de consommation</h2>
  <div class="profile-grid">
    <div class="profile-card">
      <div class="label">Posts analysés</div>
      <div class="value">${enriched.length}</div>
    </div>
    <div class="profile-card">
      <div class="label">Score politique moyen</div>
      <div class="value">${avgPol.toFixed(2)}<span style="font-size:11px;color:#9ca3af;">/4</span></div>
    </div>
    <div class="profile-card">
      <div class="label">Polarisation moyenne</div>
      <div class="value">${avgPolar.toFixed(2)}<span style="font-size:11px;color:#9ca3af;">/1</span></div>
    </div>
    <div class="profile-card">
      <div class="label">Posts politiques</div>
      <div class="value">${polPosts} <span style="font-size:11px;color:#9ca3af;">(${enriched.length ? Math.round(polPosts/enriched.length*100) : 0}%)</span></div>
    </div>
    <div class="profile-card">
      <div class="label">Posts polarisants</div>
      <div class="value">${polarPosts} <span style="font-size:11px;color:#9ca3af;">(${enriched.length ? Math.round(polarPosts/enriched.length*100) : 0}%)</span></div>
    </div>
    <div class="profile-card">
      <div class="label">Diversité informationnelle</div>
      <div class="value">${diversity.toFixed(2)}/1 <span class="diversity-badge ${diversity > 0.7 ? 'high' : diversity > 0.4 ? 'moderate' : 'low'}">${diversity > 0.7 ? 'Diversifié' : diversity > 0.4 ? 'Modéré' : 'Bulle'}</span></div>
    </div>
  </div>

  <h2>Distribution par domaine</h2>
  ${sortedDomains.map(([id, count]) => {
    const d = DOMAINS.find(d => d.id === id);
    const pct = enriched.length ? Math.round(count / enriched.length * 100) : 0;
    const maxD = sortedDomains[0]?.[1] || 1;
    return `<div class="bar-row"><div class="bar-label">${d?.label || id}</div><div class="bar-track"><div class="bar-fill domain" style="width:${Math.round(count/maxD*100)}%"></div></div><div class="bar-value">${count} (${pct}%)</div></div>`;
  }).join('\n')}

  <h2>Top thèmes</h2>
  ${sortedThemes.map(([id, count]) => {
    const t = THEMES.find(t => t.id === id);
    const maxT = sortedThemes[0]?.[1] || 1;
    return `<div class="bar-row"><div class="bar-label">${t?.label || id}</div><div class="bar-track"><div class="bar-fill theme" style="width:${Math.round(count/maxT*100)}%"></div></div><div class="bar-value">${count}</div></div>`;
  }).join('\n')}

  <h2>Top sujets</h2>
  ${sortedSubjects.map(([id, count]) => {
    const maxS = sortedSubjects[0]?.[1] || 1;
    return `<div class="bar-row"><div class="bar-label">${id}</div><div class="bar-track"><div class="bar-fill subject" style="width:${Math.round(count/maxS*100)}%"></div></div><div class="bar-value">${count}</div></div>`;
  }).join('\n')}

  ${sortedPs.length > 0 ? `
  <h2>Sujets précis détectés</h2>
  ${sortedPs.map(([id, data]) => {
    const posStr = Object.entries(data.positions).map(([pos, n]) => `<span class="tag precise ${pos}">${pos}: ${n}</span>`).join(' ');
    return `<div class="ps-item"><div class="ps-statement">💬 "${data.statement}"</div><div class="ps-positions">${id} — ${data.count}x — ${posStr}</div></div>`;
  }).join('\n')}` : ''}
</div>

<!-- PAGE 2 : Arbre taxonomique -->
<div class="page">
  <h1>Arbre taxonomique complet</h1>
  <div class="tree">
${DOMAINS.map(domain => {
  const themes = THEMES.filter(t => domain.themeIds.includes(t.id));
  let out = `    <div class="domain">▼ ${domain.label}</div>\n`;
  for (const theme of themes) {
    out += `    <div>&nbsp;&nbsp;<span class="theme">├── ${theme.label}</span> <span class="dim">(${theme.subjects.length} sujets)</span></div>\n`;
    for (const subject of theme.subjects) {
      out += `    <div>&nbsp;&nbsp;&nbsp;&nbsp;<span class="subject">├── ${subject.label}</span> <span class="dim">[${subject.keywords.slice(0,3).join(', ')}...]</span></div>\n`;
      for (const ps of subject.preciseSubjects) {
        const positions = ps.knownPositions.map(p => p.label).join(' vs ');
        out += `    <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="precise">└── 💬 "${ps.statement}"</span> <span class="positions">(${positions})</span></div>\n`;
      }
    }
  }
  return out;
}).join('\n')}
  </div>
</div>

<!-- PAGE 3 : Fiches post -->
<div class="page">
  <h1>Fiches post détaillées</h1>
  <p style="color:#6b7280; margin-bottom:12px;">Posts à signal politique ou polarisant (score ≥ 2 ou polarisation ≥ 0.3)</p>

  ${displayPosts.map(pe => {
    const domains: string[] = safeJson(pe.domains);
    const topics: string[] = safeJson(pe.mainTopics);
    const secTopics: string[] = safeJson(pe.secondaryTopics);
    const subjects: any[] = safeJson(pe.subjects);
    const precise: any[] = safeJson(pe.preciseSubjects);
    const pol = pe.politicalExplicitnessScore;
    const polar = pe.polarizationScore;
    const polarClass = polar < 0.3 ? 'low' : polar < 0.6 ? 'med' : 'high';
    const dwellSec = (pe.post.dwellTimeMs / 1000).toFixed(1);

    return `
  <div class="post-card">
    <div class="post-header">
      <span class="post-username">@${pe.post.username || '(pub)'}</span>
      <span class="post-type">${pe.post.mediaType} · ${dwellSec}s · ${pe.post.attentionLevel}</span>
    </div>
    <div class="post-summary">${pe.semanticSummary || '<em>Pas de résumé</em>'}</div>
    <div class="post-scores">
      <div class="score-item"><span class="score-badge pol${pol}"></span> Politique: <strong>${pol}/4</strong></div>
      <div class="score-item">Polarisation: <div class="polar-bar"><div class="polar-fill polar-${polarClass}" style="width:${Math.round(polar*100)}%"></div></div> <strong>${polar.toFixed(2)}</strong></div>
      <div class="score-item">Confiance: <strong>${pe.confidenceScore.toFixed(2)}</strong></div>
    </div>
    <div class="post-tags">
      ${domains.map(d => `<span class="tag domain">${d}</span>`).join('')}
      ${[...topics, ...secTopics].map(t => `<span class="tag theme">${t}</span>`).join('')}
      ${subjects.map((s: any) => `<span class="tag subject">${typeof s === 'string' ? s : s.id}</span>`).join('')}
      ${precise.map((p: any) => `<span class="tag precise ${p.position}">${p.id} [${p.position}]</span>`).join('')}
    </div>
    <div class="post-meta">Ton: ${pe.tone} · Émotion: ${pe.primaryEmotion} · Narratif: ${pe.narrativeFrame}</div>
  </div>`;
  }).join('\n')}
</div>

<div class="footer">
  ECHA — Instagram Content Intelligence · Rapport généré le ${now} · ${enriched.length} posts analysés · Taxonomie v1 (${stats.themes} thèmes, ${stats.subjects} sujets, ${stats.preciseSubjects} sujets précis)
</div>

</body>
</html>`;

  const outPath = path.join(__dirname, '..', 'data', 'echa-taxonomy-report.html');
  writeFileSync(outPath, html);
  console.log(`Rapport généré : ${outPath}`);

  // Open in browser
  exec(`start "" "${outPath}"`, (err) => {
    if (err) console.log('Ouvre manuellement :', outPath);
  });

  await prisma.$disconnect();
}

function safeJson(str: string): any[] {
  try { return JSON.parse(str); } catch { return []; }
}

main().catch(console.error);
