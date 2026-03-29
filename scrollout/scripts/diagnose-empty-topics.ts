/**
 * 014-1 : Diagnostic des posts enrichis avec mainTopics vide.
 * Identifie les patterns et causes des topics manquants.
 */
import prisma from '../src/db/client';

interface DiagnosticEntry {
  postId: string;
  username: string;
  mediaType: string;
  provider: string;
  model: string;
  confidenceScore: number;
  captionLength: number;
  normalizedTextLength: number;
  hasImageDesc: boolean;
  hasOcrText: boolean;
  hasSubtitles: boolean;
  hasAudioTranscription: boolean;
  hasMlkitLabels: boolean;
  captionPreview: string;
  normalizedTextPreview: string;
  cause: string;
}

type CauseSummary = Record<string, DiagnosticEntry[]>;

async function main() {
  // All enriched posts with empty mainTopics
  const enriched = await prisma.postEnriched.findMany({
    where: {
      OR: [
        { mainTopics: '[]' },
        { mainTopics: '' },
      ],
    },
    include: { post: true },
  });

  console.log(`\n=== DIAGNOSTIC POSTS À TOPICS VIDES ===`);
  console.log(`Posts enrichis avec mainTopics vide : ${enriched.length}\n`);

  const entries: DiagnosticEntry[] = [];
  const causes: CauseSummary = {};

  for (const e of enriched) {
    const post = e.post;
    const captionLen = post.caption?.length || 0;
    const normalizedLen = e.normalizedText?.length || 0;
    const hasImageDesc = !!(post.imageDesc && post.imageDesc.trim().length > 10);
    const hasOcr = !!(post.ocrText && post.ocrText.trim().length > 0);
    const hasSubs = !!(post.subtitles && post.subtitles.trim().length > 0);
    const hasAudio = !!(e.audioTranscription && e.audioTranscription.trim().length > 0);
    const hasMlkit = !!(post.mlkitLabels && post.mlkitLabels !== '[]' && post.mlkitLabels.trim().length > 2);

    // Determine probable cause
    let cause: string;
    if (normalizedLen < 15) {
      cause = 'texte_insuffisant';
    } else if (e.provider === 'rules' && normalizedLen < 80) {
      cause = 'rules_only_texte_court';
    } else if (e.provider === 'rules') {
      cause = 'rules_only_no_keyword_match';
    } else if (normalizedLen < 80) {
      cause = 'llm_texte_court';
    } else {
      cause = 'llm_topics_vides_malgre_texte';
    }

    const entry: DiagnosticEntry = {
      postId: post.id,
      username: post.username || '(unknown)',
      mediaType: post.mediaType,
      provider: e.provider,
      model: e.model,
      confidenceScore: e.confidenceScore,
      captionLength: captionLen,
      normalizedTextLength: normalizedLen,
      hasImageDesc,
      hasOcrText: hasOcr,
      hasSubtitles: hasSubs,
      hasAudioTranscription: hasAudio,
      hasMlkitLabels: hasMlkit,
      captionPreview: (post.caption || '').slice(0, 100),
      normalizedTextPreview: (e.normalizedText || '').slice(0, 120),
      cause,
    };

    entries.push(entry);
    if (!causes[cause]) causes[cause] = [];
    causes[cause].push(entry);
  }

  // Summary by cause
  console.log('── RÉPARTITION PAR CAUSE ──');
  for (const [cause, items] of Object.entries(causes).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${cause} : ${items.length} posts`);
    for (const item of items.slice(0, 5)) {
      console.log(`    @${item.username} [${item.mediaType}] ${item.provider} conf=${item.confidenceScore} norm=${item.normalizedTextLength}ch`);
      if (item.normalizedTextPreview) {
        console.log(`      "${item.normalizedTextPreview.slice(0, 80)}..."`);
      }
    }
    if (items.length > 5) console.log(`    ... et ${items.length - 5} autres`);
  }

  // Summary by provider
  console.log('\n── RÉPARTITION PAR PROVIDER ──');
  const byProvider: Record<string, number> = {};
  for (const e of entries) byProvider[e.provider] = (byProvider[e.provider] || 0) + 1;
  for (const [p, c] of Object.entries(byProvider)) console.log(`  ${p} : ${c}`);

  // Summary by mediaType
  console.log('\n── RÉPARTITION PAR MEDIA TYPE ──');
  const byMedia: Record<string, number> = {};
  for (const e of entries) byMedia[e.mediaType] = (byMedia[e.mediaType] || 0) + 1;
  for (const [m, c] of Object.entries(byMedia)) console.log(`  ${m} : ${c}`);

  // Top usernames
  console.log('\n── TOP USERNAMES AVEC TOPICS VIDES ──');
  const byUser: Record<string, number> = {};
  for (const e of entries) byUser[e.username] = (byUser[e.username] || 0) + 1;
  const topUsers = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [u, c] of topUsers) console.log(`  @${u} : ${c}`);

  // Confidence distribution
  console.log('\n── DISTRIBUTION CONFIDENCE ──');
  const confBuckets = { '<0.3': 0, '0.3-0.5': 0, '0.5-0.7': 0, '0.7-0.9': 0, '>0.9': 0 };
  for (const e of entries) {
    if (e.confidenceScore < 0.3) confBuckets['<0.3']++;
    else if (e.confidenceScore < 0.5) confBuckets['0.3-0.5']++;
    else if (e.confidenceScore < 0.7) confBuckets['0.5-0.7']++;
    else if (e.confidenceScore < 0.9) confBuckets['0.7-0.9']++;
    else confBuckets['>0.9']++;
  }
  for (const [b, c] of Object.entries(confBuckets)) console.log(`  ${b} : ${c}`);

  // Posts avec texte suffisant mais topics vides (les plus intéressants à corriger)
  const fixable = entries.filter(e => e.normalizedTextLength > 50);
  console.log(`\n── POSTS FIXABLES (texte > 50 chars, topics vides) : ${fixable.length} ──`);
  for (const e of fixable.slice(0, 10)) {
    console.log(`  @${e.username} [${e.mediaType}] ${e.provider} conf=${e.confidenceScore}`);
    console.log(`    "${e.normalizedTextPreview}"`);
  }

  // Global stats for comparison
  const totalEnriched = await prisma.postEnriched.count();
  const totalPosts = await prisma.post.count();
  console.log(`\n── RÉSUMÉ GLOBAL ──`);
  console.log(`  Posts totaux : ${totalPosts}`);
  console.log(`  Posts enrichis : ${totalEnriched}`);
  console.log(`  Topics vides : ${entries.length} (${(entries.length / totalEnriched * 100).toFixed(1)}%)`);
  console.log(`  Fixables (texte > 50ch) : ${fixable.length}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
