import prisma from '../src/db/client'
import { createWriteStream } from 'fs'
import path from 'path'

async function main() {
  const postCount = await prisma.post.count()
  const enrichedCount = await prisma.postEnriched.count()
  console.log(`Posts: ${postCount}, Enriched: ${enrichedCount}`)

  // Get all posts with enrichment data
  const posts = await prisma.post.findMany({
    include: { enrichment: true, session: true },
  })

  // CSV header
  const headers = [
    'id', 'sessionId', 'sessionDate', 'username', 'displayName',
    'mediaType', 'caption', 'hashtags', 'imageDesc', 'ocrText', 'subtitles',
    'attentionLevel', 'dwellTimeMs', 'isSponsored', 'isSuggested', 'category',
    // Enrichment fields
    'enrichProvider', 'enrichModel',
    'normalizedText', 'semanticSummary', 'keywordTerms',
    'domains', 'mainTopics', 'secondaryTopics', 'subjects', 'preciseSubjects',
    'contentDomain', 'audienceTarget',
    'persons', 'organizations', 'politicalActors',
    'tone', 'primaryEmotion', 'emotionIntensity',
    'politicalExplicitnessScore', 'politicalIssueTags',
    'polarizationScore', 'conflictSignal', 'enemyDesignationSignal',
    'axisEconomic', 'axisSocietal', 'axisAuthority', 'axisSystem', 'dominantAxis',
    'mediaCategory', 'mediaQuality',
    'narrativeFrame', 'callToActionType',
    'confidenceScore', 'reviewFlag', 'reviewReason',
    'audioTranscription', 'mediaMessage', 'mediaIntent',
  ]

  const csvPath = path.join(__dirname, '..', 'data', 'analysis-export.csv')
  const ws = createWriteStream(csvPath)
  ws.write(headers.join(';') + '\n')

  for (const post of posts) {
    const e = post.enrichment
    const row = [
      post.id,
      post.sessionId,
      post.session?.capturedAt?.toISOString() ?? '',
      post.username,
      post.displayName,
      post.mediaType,
      esc(post.caption),
      esc(post.hashtags),
      esc(post.imageDesc),
      esc(post.ocrText),
      esc(post.subtitles),
      post.attentionLevel,
      post.dwellTimeMs,
      post.isSponsored,
      post.isSuggested,
      post.category,
      // Enrichment
      e?.provider ?? '',
      e?.model ?? '',
      esc(e?.normalizedText),
      esc(e?.semanticSummary),
      esc(e?.keywordTerms),
      esc(e?.domains),
      esc(e?.mainTopics),
      esc(e?.secondaryTopics),
      esc(e?.subjects),
      esc(e?.preciseSubjects),
      e?.contentDomain ?? '',
      e?.audienceTarget ?? '',
      esc(e?.persons),
      esc(e?.organizations),
      esc(e?.politicalActors),
      e?.tone ?? '',
      e?.primaryEmotion ?? '',
      e?.emotionIntensity ?? '',
      e?.politicalExplicitnessScore ?? '',
      esc(e?.politicalIssueTags),
      e?.polarizationScore ?? '',
      e?.conflictSignal ?? '',
      e?.enemyDesignationSignal ?? '',
      e?.axisEconomic ?? '',
      e?.axisSocietal ?? '',
      e?.axisAuthority ?? '',
      e?.axisSystem ?? '',
      e?.dominantAxis ?? '',
      e?.mediaCategory ?? '',
      e?.mediaQuality ?? '',
      esc(e?.narrativeFrame),
      e?.callToActionType ?? '',
      e?.confidenceScore ?? '',
      e?.reviewFlag ?? '',
      esc(e?.reviewReason),
      esc(e?.audioTranscription),
      esc(e?.mediaMessage),
      esc(e?.mediaIntent),
    ]
    ws.write(row.join(';') + '\n')
  }

  ws.end()
  console.log(`\nCSV exported: ${csvPath} (${posts.length} rows)`)

  // Quick stats
  const enriched = posts.filter(p => p.enrichment)
  console.log(`\n--- Stats ---`)
  console.log(`Total posts: ${posts.length}`)
  console.log(`Enriched: ${enriched.length}`)
  console.log(`Not enriched: ${posts.length - enriched.length}`)

  if (enriched.length > 0) {
    const avgPol = enriched.reduce((s, p) => s + (p.enrichment!.politicalExplicitnessScore), 0) / enriched.length
    const avgPolar = enriched.reduce((s, p) => s + (p.enrichment!.polarizationScore), 0) / enriched.length
    const avgConf = enriched.reduce((s, p) => s + (p.enrichment!.confidenceScore), 0) / enriched.length
    console.log(`Avg political score: ${avgPol.toFixed(2)}`)
    console.log(`Avg polarization: ${avgPolar.toFixed(2)}`)
    console.log(`Avg confidence: ${avgConf.toFixed(2)}`)

    // Top domains
    const domainCounts: Record<string, number> = {}
    for (const p of enriched) {
      try {
        const domains = JSON.parse(p.enrichment!.domains)
        for (const d of domains) domainCounts[d] = (domainCounts[d] || 0) + 1
      } catch {}
    }
    console.log(`\nTop domains:`)
    Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([d, c]) => {
      console.log(`  ${d}: ${c}`)
    })

    // Top topics
    const topicCounts: Record<string, number> = {}
    for (const p of enriched) {
      try {
        const topics = JSON.parse(p.enrichment!.mainTopics)
        for (const t of topics) topicCounts[t] = (topicCounts[t] || 0) + 1
      } catch {}
    }
    console.log(`\nTop topics:`)
    Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([t, c]) => {
      console.log(`  ${t}: ${c}`)
    })

    // Review flags
    const flagged = enriched.filter(p => p.enrichment!.reviewFlag)
    console.log(`\nReview flagged: ${flagged.length}/${enriched.length}`)
  }
}

function esc(val: string | null | undefined): string {
  if (!val) return ''
  return '"' + val.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '') + '"'
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
