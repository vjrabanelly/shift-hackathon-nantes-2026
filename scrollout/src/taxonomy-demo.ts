/**
 * ECHA — Démonstration de la taxonomie 5 niveaux.
 * Visualise la structure complète + l'analyse des posts réels.
 */
import prisma from './db/client';
import { DOMAINS, THEMES, getTaxonomyStats, getAllPreciseSubjects, getPreciseSubjectsForTheme } from './enrichment/dictionaries/taxonomy';
import { classifyTopicsEnriched } from './enrichment/dictionaries/topics-keywords';
import { applyRules } from './enrichment/rules-engine';

// ─── Couleurs ANSI ──────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
  bgMagenta: '\x1b[45m',
};

function bar(value: number, max: number, width = 30, char = '█'): string {
  const filled = Math.round((value / max) * width);
  return `${C.green}${char.repeat(filled)}${C.dim}${'░'.repeat(width - filled)}${C.reset}`;
}

function polarBar(score: number): string {
  if (score === 0) return `${C.dim}────────────────${C.reset}`;
  const w = 16;
  const filled = Math.round(score * w);
  const color = score < 0.3 ? C.green : score < 0.6 ? C.yellow : C.red;
  return `${color}${'█'.repeat(filled)}${C.dim}${'░'.repeat(w - filled)}${C.reset} ${score.toFixed(2)}`;
}

function polIcon(score: number): string {
  const icons = ['⚪', '🟡', '🟠', '🔴', '🔥'];
  return icons[Math.min(score, 4)];
}

function attIcon(level: string): string {
  const map: Record<string, string> = { skipped: '⏭️', glanced: '👀', viewed: '📖', engaged: '🔥' };
  return map[level] || '❓';
}

async function main() {
  // ═══════════════════════════════════════════════════════════
  // SECTION 1 : Structure de la taxonomie
  // ═══════════════════════════════════════════════════════════
  const stats = getTaxonomyStats();
  const allPs = getAllPreciseSubjects();

  console.log(`
${C.bold}${C.bgBlue} ═══════════════════════════════════════════════════════════════ ${C.reset}
${C.bold}${C.bgBlue}   ECHA — TAXONOMIE 5 NIVEAUX : STRUCTURE & DÉMONSTRATION       ${C.reset}
${C.bold}${C.bgBlue} ═══════════════════════════════════════════════════════════════ ${C.reset}

${C.bold}Architecture :${C.reset}

  ${C.blue}Niveau 1${C.reset}  ${C.bold}DOMAINE${C.reset}        ${C.dim}(macro)${C.reset}    ${stats.domains} domaines
      │
  ${C.cyan}Niveau 2${C.reset}  ${C.bold}THÈME${C.reset}          ${C.dim}(core)${C.reset}     ${stats.themes} thèmes
      │
  ${C.green}Niveau 3${C.reset}  ${C.bold}SUJET${C.reset}          ${C.dim}(granulaire)${C.reset} ${stats.subjects} sujets
      │
  ${C.yellow}Niveau 4${C.reset}  ${C.bold}SUJET PRÉCIS${C.reset}   ${C.dim}(débattable)${C.reset} ${stats.preciseSubjects} propositions
      │
  ${C.red}Niveau 5${C.reset}  ${C.bold}MARQUEUR${C.reset}       ${C.dim}(dynamique)${C.reset}  entités, personnes, événements
`);

  // ═══════════════════════════════════════════════════════════
  // SECTION 2 : Arbre de la taxonomie
  // ═══════════════════════════════════════════════════════════
  console.log(`${C.bold}${C.bgCyan} ARBRE COMPLET ${C.reset}\n`);

  for (const domain of DOMAINS) {
    const themeCount = domain.themeIds.length;
    const themes = THEMES.filter(t => domain.themeIds.includes(t.id));
    const subjectCount = themes.reduce((s, t) => s + t.subjects.length, 0);
    const psCount = themes.reduce((s, t) => s + t.subjects.reduce((ss, sub) => ss + sub.preciseSubjects.length, 0), 0);

    console.log(`  ${C.blue}${C.bold}${domain.label}${C.reset} ${C.dim}(${themeCount} thèmes, ${subjectCount} sujets, ${psCount} sujets précis)${C.reset}`);

    for (let ti = 0; ti < themes.length; ti++) {
      const theme = themes[ti];
      const isLastTheme = ti === themes.length - 1;
      const tPrefix = isLastTheme ? '└──' : '├──';

      console.log(`  ${C.dim}${tPrefix}${C.reset} ${C.cyan}${theme.label}${C.reset} ${C.dim}(${theme.subjects.length} sujets)${C.reset}`);

      for (let si = 0; si < theme.subjects.length; si++) {
        const subject = theme.subjects[si];
        const isLastSubject = si === theme.subjects.length - 1;
        const sPrefix = isLastTheme ? '    ' : '│   ';
        const sBranch = isLastSubject ? '└──' : '├──';
        const kwPreview = subject.keywords.slice(0, 3).join(', ');

        console.log(`  ${C.dim}${sPrefix}${sBranch}${C.reset} ${C.green}${subject.label}${C.reset} ${C.dim}[${kwPreview}...]${C.reset}`);

        for (let pi = 0; pi < subject.preciseSubjects.length; pi++) {
          const ps = subject.preciseSubjects[pi];
          const isLastPs = pi === subject.preciseSubjects.length - 1;
          const pPrefix = sPrefix + (isLastSubject ? '    ' : '│   ');
          const pBranch = isLastPs ? '└──' : '├──';
          const positions = ps.knownPositions.map(p => p.label).join(' vs ');

          console.log(`  ${C.dim}${pPrefix}${pBranch}${C.reset} ${C.yellow}💬 "${ps.statement}"${C.reset}`);
          console.log(`  ${C.dim}${pPrefix}${isLastPs ? '   ' : '│  '}${C.reset}    ${C.dim}↔ ${positions}${C.reset}`);
        }
      }
      console.log('');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 3 : Analyse des posts réels
  // ═══════════════════════════════════════════════════════════
  const enriched = await prisma.postEnriched.findMany({
    include: { post: true },
    orderBy: { createdAt: 'desc' },
    take: 62, // all
  });

  console.log(`\n${C.bold}${C.bgGreen} ANALYSE DES ${enriched.length} POSTS ENRICHIS ${C.reset}\n`);

  // Global stats
  const domainCounts: Record<string, number> = {};
  const themeCounts: Record<string, number> = {};
  const subjectCounts: Record<string, number> = {};
  const psCounts: Record<string, { count: number; positions: Record<string, number>; statement: string }> = {};
  let totalPol = 0;
  let totalPolar = 0;

  for (const pe of enriched) {
    totalPol += pe.politicalExplicitnessScore;
    totalPolar += pe.polarizationScore;

    const domains: string[] = (() => { try { return JSON.parse(pe.domains); } catch { return []; } })();
    const topics: string[] = (() => { try { return JSON.parse(pe.mainTopics); } catch { return []; } })();
    const subjects: any[] = (() => { try { return JSON.parse(pe.subjects); } catch { return []; } })();
    const precise: any[] = (() => { try { return JSON.parse(pe.preciseSubjects); } catch { return []; } })();

    for (const d of domains) domainCounts[d] = (domainCounts[d] || 0) + 1;
    for (const t of topics) themeCounts[t] = (themeCounts[t] || 0) + 1;
    for (const s of subjects) {
      const sid = typeof s === 'string' ? s : s.id;
      subjectCounts[sid] = (subjectCounts[sid] || 0) + 1;
    }
    for (const p of precise) {
      if (!p.id) continue;
      if (!psCounts[p.id]) psCounts[p.id] = { count: 0, positions: {}, statement: p.statement || '' };
      psCounts[p.id].count++;
      psCounts[p.id].positions[p.position] = (psCounts[p.id].positions[p.position] || 0) + 1;
    }
  }

  // Domain distribution
  const maxDomain = Math.max(...Object.values(domainCounts), 1);
  console.log(`  ${C.bold}Distribution par domaine :${C.reset}\n`);
  const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
  for (const [id, count] of sortedDomains) {
    const domain = DOMAINS.find(d => d.id === id);
    const pct = Math.round(count / enriched.length * 100);
    console.log(`  ${bar(count, maxDomain, 25)} ${C.bold}${String(count).padStart(3)}${C.reset} (${String(pct).padStart(2)}%)  ${C.blue}${domain?.label || id}${C.reset}`);
  }

  // Theme distribution
  const maxTheme = Math.max(...Object.values(themeCounts), 1);
  console.log(`\n  ${C.bold}Top 12 thèmes :${C.reset}\n`);
  const sortedThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const [id, count] of sortedThemes) {
    const theme = THEMES.find(t => t.id === id);
    console.log(`  ${bar(count, maxTheme, 20)} ${C.bold}${String(count).padStart(3)}${C.reset}  ${C.cyan}${theme?.label || id}${C.reset}`);
  }

  // Subject distribution
  console.log(`\n  ${C.bold}Top 15 sujets :${C.reset}\n`);
  const maxSubject = Math.max(...Object.values(subjectCounts), 1);
  const sortedSubjects = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [id, count] of sortedSubjects) {
    console.log(`  ${bar(count, maxSubject, 15)} ${C.bold}${String(count).padStart(3)}${C.reset}  ${C.green}${id}${C.reset}`);
  }

  // Precise subjects
  if (Object.keys(psCounts).length > 0) {
    console.log(`\n  ${C.bold}Sujets précis détectés :${C.reset}\n`);
    const sortedPs = Object.entries(psCounts).sort((a, b) => b[1].count - a[1].count);
    for (const [id, data] of sortedPs) {
      const posStr = Object.entries(data.positions).map(([pos, n]) => `${pos}:${n}`).join(' ');
      console.log(`  ${C.yellow}💬${C.reset} ${C.bold}${id}${C.reset} ${C.dim}(${data.count}x)${C.reset}`);
      console.log(`     "${data.statement || '...'}"`);
      console.log(`     ${C.dim}positions: ${posStr}${C.reset}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 4 : Fiches post détaillées
  // ═══════════════════════════════════════════════════════════
  console.log(`\n${C.bold}${C.bgYellow}${C.white} FICHES POST DÉTAILLÉES ${C.reset}\n`);

  // Select interesting posts (political + high attention)
  const interesting = enriched
    .filter(pe => pe.politicalExplicitnessScore >= 2 || pe.polarizationScore >= 0.3)
    .sort((a, b) => b.politicalExplicitnessScore - a.politicalExplicitnessScore);

  const display = interesting.length > 0 ? interesting.slice(0, 6) : enriched.slice(0, 6);

  for (const pe of display) {
    const domains: string[] = (() => { try { return JSON.parse(pe.domains); } catch { return []; } })();
    const topics: string[] = (() => { try { return JSON.parse(pe.mainTopics); } catch { return []; } })();
    const secondaryTopics: string[] = (() => { try { return JSON.parse(pe.secondaryTopics); } catch { return []; } })();
    const subjects: any[] = (() => { try { return JSON.parse(pe.subjects); } catch { return []; } })();
    const precise: any[] = (() => { try { return JSON.parse(pe.preciseSubjects); } catch { return []; } })();

    const dwellSec = pe.post.dwellTimeMs / 1000;
    const att = pe.post.attentionLevel;

    console.log(`  ${C.bold}┌─────────────────────────────────────────────────────────────┐${C.reset}`);
    console.log(`  ${C.bold}│${C.reset} ${C.bold}@${pe.post.username || '(pub)'}${C.reset}${' '.repeat(Math.max(0, 45 - (pe.post.username || '(pub)').length))}${C.dim}${pe.post.mediaType}${C.reset}  ${C.bold}│${C.reset}`);
    console.log(`  ${C.bold}├─────────────────────────────────────────────────────────────┤${C.reset}`);

    // Summary
    console.log(`  ${C.bold}│${C.reset} ${C.dim}Résumé:${C.reset} ${(pe.semanticSummary || '').substring(0, 55)}`);
    if (pe.semanticSummary && pe.semanticSummary.length > 55) {
      console.log(`  ${C.bold}│${C.reset}         ${pe.semanticSummary.substring(55, 110)}`);
    }

    // Attention
    console.log(`  ${C.bold}│${C.reset}`);
    console.log(`  ${C.bold}│${C.reset} ${attIcon(att)} Attention: ${C.bold}${att}${C.reset} (${dwellSec.toFixed(1)}s)`);

    // Political + Polarization
    console.log(`  ${C.bold}│${C.reset} ${polIcon(pe.politicalExplicitnessScore)} Politique:    ${pe.politicalExplicitnessScore}/4  ${polarBar(pe.politicalExplicitnessScore / 4)}`);
    console.log(`  ${C.bold}│${C.reset} ${pe.polarizationScore > 0.3 ? '⚡' : '○'} Polarisation: ${polarBar(pe.polarizationScore)}`);

    // Taxonomy levels
    console.log(`  ${C.bold}│${C.reset}`);
    if (domains.length > 0)
      console.log(`  ${C.bold}│${C.reset} ${C.blue}▸ Domaines:${C.reset}  ${domains.join(', ')}`);
    if (topics.length > 0)
      console.log(`  ${C.bold}│${C.reset} ${C.cyan}▸ Thèmes:${C.reset}    ${[...topics, ...secondaryTopics].join(', ')}`);
    if (subjects.length > 0) {
      const subIds = subjects.map((s: any) => typeof s === 'string' ? s : s.id);
      console.log(`  ${C.bold}│${C.reset} ${C.green}▸ Sujets:${C.reset}    ${subIds.join(', ')}`);
    }
    if (precise.length > 0) {
      console.log(`  ${C.bold}│${C.reset} ${C.yellow}▸ Sujets précis:${C.reset}`);
      for (const p of precise) {
        const posColor = p.position === 'pour' ? C.green : p.position === 'contre' ? C.red : C.dim;
        console.log(`  ${C.bold}│${C.reset}   ${C.yellow}💬${C.reset} ${p.id} ${posColor}[${p.position}]${C.reset} ${C.dim}conf=${p.confidence}${C.reset}`);
      }
    }

    // Tone & Narrative
    console.log(`  ${C.bold}│${C.reset}`);
    console.log(`  ${C.bold}│${C.reset} ${C.dim}Ton: ${pe.tone} | Émotion: ${pe.primaryEmotion} | Narratif: ${pe.narrativeFrame}${C.reset}`);

    console.log(`  ${C.bold}└─────────────────────────────────────────────────────────────┘${C.reset}\n`);
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 5 : Profil de consommation
  // ═══════════════════════════════════════════════════════════
  console.log(`${C.bold}${C.bgMagenta} PROFIL DE CONSOMMATION ${C.reset}\n`);

  const avgPol = totalPol / enriched.length;
  const avgPolar = totalPolar / enriched.length;
  const polPosts = enriched.filter(pe => pe.politicalExplicitnessScore >= 2).length;
  const polarPosts = enriched.filter(pe => pe.polarizationScore >= 0.3).length;
  const polPct = Math.round(polPosts / enriched.length * 100);
  const polarPct = Math.round(polarPosts / enriched.length * 100);

  const topDomain = sortedDomains[0];
  const topDomainPct = topDomain ? Math.round(topDomain[1] / enriched.length * 100) : 0;

  console.log(`  ${C.bold}Posts analysés:${C.reset}        ${enriched.length}`);
  console.log(`  ${C.bold}Score politique moyen:${C.reset} ${avgPol.toFixed(2)}/4`);
  console.log(`  ${C.bold}Polarisation moyenne:${C.reset}  ${avgPolar.toFixed(2)}/1`);
  console.log(`  ${C.bold}Posts politiques:${C.reset}      ${polPosts} (${polPct}%)`);
  console.log(`  ${C.bold}Posts polarisants:${C.reset}     ${polarPosts} (${polarPct}%)`);
  console.log(`  ${C.bold}Domaine dominant:${C.reset}      ${DOMAINS.find(d => d.id === topDomain?.[0])?.label || '-'} (${topDomainPct}%)`);

  // Diversity index (Shannon entropy on domains)
  const total = Object.values(domainCounts).reduce((a, b) => a + b, 0);
  let entropy = 0;
  for (const count of Object.values(domainCounts)) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(DOMAINS.length);
  const diversity = entropy / maxEntropy;

  console.log(`  ${C.bold}Indice de diversité:${C.reset}   ${diversity.toFixed(2)}/1 ${diversity > 0.7 ? '✅ diversifié' : diversity > 0.4 ? '🟡 modéré' : '🔴 bulle'}`);

  // Perspective diversity on precise subjects
  if (Object.keys(psCounts).length > 0) {
    const monoAngle = Object.values(psCounts).filter(ps => {
      const positions = Object.keys(ps.positions);
      return positions.length === 1 && ps.count >= 2;
    });
    if (monoAngle.length > 0) {
      console.log(`\n  ${C.bold}${C.yellow}⚠ Sujets vus d'un seul angle:${C.reset}`);
      for (const ps of monoAngle) {
        const pos = Object.keys(ps.positions)[0];
        console.log(`    → "${ps.statement.substring(0, 60)}" ${C.dim}(${ps.count}x, toujours "${pos}")${C.reset}`);
      }
    }
  }

  console.log(`\n${C.dim}─────────────────────────────────────────────────────────────────${C.reset}\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
