import prisma from '../src/db/client'

async function main() {
  // Find all posts tagged with sport in any enrichment field
  const enriched = await prisma.postEnriched.findMany({
    include: { post: true },
  })

  console.log('=== POSTS CATÉGORISÉS "SPORT" ===\n')

  const sportPosts = enriched.filter(e => {
    const fields = [e.domains, e.mainTopics, e.secondaryTopics, e.subjects, e.contentDomain]
    return fields.some(f => /sport/i.test(f))
  })

  console.log(`Total enrichis: ${enriched.length}`)
  console.log(`Tagués sport: ${sportPosts.length}\n`)

  for (const e of sportPosts) {
    const p = e.post
    console.log(`--- @${p.username} (${p.mediaType}) ---`)
    console.log(`  caption: "${p.caption.slice(0, 120)}"`)
    console.log(`  allText: "${p.allText.slice(0, 150)}"`)
    console.log(`  imageDesc: "${p.imageDesc.slice(0, 100)}"`)
    console.log(`  ocrText: "${p.ocrText.slice(0, 100)}"`)
    console.log(`  hashtags: ${p.hashtags}`)
    console.log(`  normalizedText: "${e.normalizedText.slice(0, 150)}"`)
    console.log(`  → domains: ${e.domains}`)
    console.log(`  → mainTopics: ${e.mainTopics}`)
    console.log(`  → secondaryTopics: ${e.secondaryTopics}`)
    console.log(`  → subjects: ${e.subjects}`)
    console.log(`  → contentDomain: ${e.contentDomain}`)
    console.log(`  → provider: ${e.provider} / model: ${e.model}`)
    console.log(`  → confidence: ${e.confidenceScore}`)
    console.log()
  }

  // Also check the rules engine — what triggers "sport"?
  console.log('\n=== ANALYSE DES DÉCLENCHEURS ===')

  // Check dictionaries for sport keywords
  const { topicsKeywords } = await import('../src/enrichment/dictionaries/topics-keywords')
  const sportKeywords = topicsKeywords.find((t: any) => t.topic === 'sport' || t.id === 'sport')
  console.log('\nDico topics-keywords "sport":', JSON.stringify(sportKeywords, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
