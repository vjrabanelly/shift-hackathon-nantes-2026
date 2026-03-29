import prisma from '../src/db/client'

async function main() {
  const posts = await prisma.post.findMany({
    include: { enrichment: true },
  })

  console.log(`=== AUDIT DATA (${posts.length} posts) ===\n`)

  // --- 1. Doublons ---
  console.log('--- DOUBLONS ---')

  // Par username + caption (même post vu plusieurs fois)
  const seen = new Map<string, typeof posts>()
  for (const p of posts) {
    const key = `${p.username}::${p.caption.slice(0, 100)}`
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(p)
  }

  const dupes = [...seen.entries()].filter(([, v]) => v.length > 1)
  console.log(`Posts uniques (username+caption): ${seen.size}`)
  console.log(`Groupes de doublons: ${dupes.length}`)

  let totalDupeRows = 0
  for (const [key, group] of dupes.slice(0, 10)) {
    totalDupeRows += group.length - 1
    const [user] = key.split('::')
    console.log(`  @${user} (${group.length}x) — "${key.split('::')[1]?.slice(0, 60)}..."`)
    for (const p of group) {
      console.log(`    id=${p.id} session=${p.sessionId} dwell=${p.dwellTimeMs}ms attention=${p.attentionLevel}`)
    }
  }
  const allDupeRows = dupes.reduce((s, [, v]) => s + v.length - 1, 0)
  console.log(`\nTotal lignes en double: ${allDupeRows}/${posts.length} (${(allDupeRows/posts.length*100).toFixed(1)}%)`)

  // --- 2. Bruit UI Instagram ---
  console.log('\n--- BRUIT UI INSTAGRAM ---')

  const uiPatterns = [
    /réaction rapide/i,
    /j'aime/i,
    /\bdirect\b/i,
    /commenter/i,
    /partager/i,
    /envoyer/i,
    /plus\b/i,
    /enregistrer/i,
    /suivre/i,
    /s'abonner/i,
    /répondre/i,
    /voir les \d+ commentaires/i,
    /voir la traduction/i,
    /sponsorisé/i,
    /suggestions? pour vous/i,
    /publications? suggérées?/i,
  ]

  // Check in captions
  const noisyCaption: typeof posts = []
  const noiseHits: Record<string, number> = {}

  for (const p of posts) {
    const text = `${p.caption} ${p.allText} ${p.imageDesc}`
    for (const pat of uiPatterns) {
      const match = text.match(pat)
      if (match) {
        const label = pat.source.replace(/\\b/g, '').replace(/\\d\+/g, 'N')
        noiseHits[label] = (noiseHits[label] || 0) + 1
      }
    }
    // Check if caption IS ONLY UI noise (very short + matches)
    if (p.caption.length < 50 && uiPatterns.some(pat => pat.test(p.caption))) {
      noisyCaption.push(p)
    }
  }

  console.log('Patterns UI détectés dans le texte:')
  Object.entries(noiseHits).sort((a, b) => b[1] - a[1]).forEach(([pat, count]) => {
    console.log(`  "${pat}": ${count} posts`)
  })

  console.log(`\nPosts avec caption = pur bruit UI (< 50 chars + pattern): ${noisyCaption.length}`)
  for (const p of noisyCaption.slice(0, 10)) {
    console.log(`  @${p.username}: "${p.caption}"`)
  }

  // --- 3. Posts vides ---
  console.log('\n--- POSTS VIDES/PAUVRES ---')
  const empty = posts.filter(p => !p.caption && !p.imageDesc && !p.ocrText && !p.subtitles)
  const shortCaption = posts.filter(p => p.caption.length > 0 && p.caption.length < 10)
  console.log(`Posts sans aucun contenu textuel: ${empty.length}`)
  console.log(`Posts avec caption < 10 chars: ${shortCaption.length}`)

  // --- 4. Check allText for UI noise ---
  console.log('\n--- SAMPLE allText (5 posts) ---')
  for (const p of posts.slice(0, 5)) {
    console.log(`\n@${p.username} [${p.attentionLevel}]:`)
    console.log(`  caption: "${p.caption.slice(0, 80)}"`)
    console.log(`  allText: "${p.allText.slice(0, 150)}"`)
    console.log(`  imageDesc: "${p.imageDesc.slice(0, 80)}"`)
    console.log(`  ocrText: "${p.ocrText.slice(0, 80)}"`)
  }

  // --- 5. Enrichment on noisy data ---
  console.log('\n--- ENRICHISSEMENT SUR DONNÉES BRUITÉES ---')
  const enrichedWithNoise = posts.filter(p => {
    if (!p.enrichment) return false
    const norm = p.enrichment.normalizedText
    return /réaction rapide|j'aime|commenter|partager|envoyer/i.test(norm)
  })
  console.log(`Posts enrichis dont normalizedText contient du bruit UI: ${enrichedWithNoise.length}`)
  for (const p of enrichedWithNoise.slice(0, 5)) {
    console.log(`  @${p.username}: "${p.enrichment!.normalizedText.slice(0, 100)}"`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
