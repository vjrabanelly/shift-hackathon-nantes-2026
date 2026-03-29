import { applyRules } from '../src/enrichment/rules-engine'
import { classifyTopicsEnriched } from '../src/enrichment/dictionaries/topics-keywords'
import { classifyMultiLevel, matchKeyword, THEMES } from '../src/enrichment/dictionaries/taxonomy'
import prisma from '../src/db/client'

async function main() {
  // Get the 2 sport-tagged posts
  const enriched = await prisma.postEnriched.findMany({
    where: {
      OR: [
        { mainTopics: { contains: 'sport' } },
        { secondaryTopics: { contains: 'sport' } },
        { subjects: { contains: 'sport' } },
        { subjects: { contains: 'football' } },
        { subjects: { contains: 'fitness' } },
      ],
    },
    include: { post: true },
  })

  const sportTheme = THEMES.find(t => t.id === 'sport')!
  const allSportKeywords = sportTheme.subjects.flatMap(s => s.keywords)

  console.log(`Found ${enriched.length} sport-tagged posts\n`)

  for (const e of enriched) {
    const p = e.post
    console.log(`\n=== @${p.username} ===`)
    console.log(`normalizedText: "${e.normalizedText.slice(0, 300)}"`)

    // Check which sport keywords match
    const text = `${e.normalizedText} ${p.username}`.toLowerCase()
    const matches: string[] = []
    for (const kw of allSportKeywords) {
      if (matchKeyword(kw, text)) {
        matches.push(kw)
      }
    }
    console.log(`\nSport keywords matched: [${matches.join(', ')}]`)

    // Full rules debug
    const rules = applyRules({
      normalizedText: e.normalizedText,
      hashtags: (() => { try { return JSON.parse(p.hashtags) } catch { return [] } })(),
      username: p.username,
    })
    console.log(`\nRules result:`)
    console.log(`  mainTopics: [${rules.mainTopics}]`)
    console.log(`  subjects: ${JSON.stringify(rules.subjects.map(s => `${s.id}(${s.matchCount})`))}`)
    console.log(`  debug topicMatches: ${JSON.stringify(rules._debug.topicMatches)}`)
  }

  // Also check ALL posts — which ones have sport keywords in their text?
  console.log('\n\n=== SCAN GLOBAL: posts avec keywords sport dans le texte ===')
  const allPosts = await prisma.post.findMany()
  let sportHits = 0
  for (const p of allPosts) {
    const text = `${p.caption} ${p.allText} ${p.imageDesc} ${p.username}`.toLowerCase()
    const matches: string[] = []
    for (const kw of allSportKeywords) {
      if (matchKeyword(kw, text)) matches.push(kw)
    }
    if (matches.length > 0) {
      sportHits++
      console.log(`  @${p.username}: [${matches.join(', ')}] — "${p.caption.slice(0, 60)}"`)
    }
  }
  console.log(`\nTotal posts avec au moins 1 keyword sport: ${sportHits}/${allPosts.length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
