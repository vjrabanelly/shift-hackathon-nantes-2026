/**
 * Supprime les enrichissements dont le normalizedText contient du bruit UI Instagram,
 * pour qu'ils soient ré-enrichis avec le normalizer amélioré.
 *
 * Usage: npx tsx scripts/clean-enrichments.ts [--dry-run]
 */
import prisma from '../src/db/client'
import { isCaptionPureNoise } from '../src/enrichment/normalize'

const UI_NOISE_PATTERNS = [
  /réaction rapide/i,
  /\bj'aime\b/i,
  /\bcommenter\b/i,
  /\bpartager\b/i,
  /\benvoyer\b/i,
  /\bsuivre\b/i,
  /\bactiver le son\b/i,
  /\bdirect\b/i,
  /suggestions?\s+suivre/i,
  /plus d'actions/i,
  /a publié un\(e\)/i,
  /photo de profil de/i,
  /sponsorisée/i,
]

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const enrichments = await prisma.postEnriched.findMany({
    select: { id: true, postId: true, normalizedText: true },
  })

  console.log(`Total enrichments: ${enrichments.length}`)

  // Find enrichments with UI noise in normalizedText
  const noisy = enrichments.filter(e =>
    UI_NOISE_PATTERNS.some(pat => pat.test(e.normalizedText))
  )

  console.log(`Enrichments with UI noise in normalizedText: ${noisy.length}`)

  // Also find posts with pure-noise captions that got enriched
  const posts = await prisma.post.findMany({
    where: { enrichment: { isNot: null } },
    select: { id: true, caption: true, enrichment: { select: { id: true } } },
  })

  const noisyCaptions = posts.filter(p => isCaptionPureNoise(p.caption) && p.caption.length > 0)
  console.log(`Posts with pure-noise captions (enriched): ${noisyCaptions.length}`)

  // Merge IDs to re-enrich
  const idsToDelete = new Set<string>()
  for (const e of noisy) idsToDelete.add(e.id)
  for (const p of noisyCaptions) {
    if (p.enrichment) idsToDelete.add(p.enrichment.id)
  }

  console.log(`\nTotal enrichments to delete for re-processing: ${idsToDelete.size}`)

  if (dryRun) {
    console.log('\n[DRY RUN] Sample noisy normalizedText:')
    for (const e of noisy.slice(0, 5)) {
      console.log(`  ${e.postId}: "${e.normalizedText.slice(0, 100)}"`)
    }
    console.log('\nSample pure-noise captions:')
    for (const p of noisyCaptions.slice(0, 5)) {
      console.log(`  ${p.id}: "${p.caption}"`)
    }
    return
  }

  const deleted = await prisma.postEnriched.deleteMany({
    where: { id: { in: [...idsToDelete] } },
  })
  console.log(`Deleted ${deleted.count} enrichments — these posts will be re-enriched on next run.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
