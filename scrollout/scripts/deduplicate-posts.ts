/**
 * Déduplique les posts en DB.
 * Stratégie: même username + même caption (normalisée) → garder celui avec le meilleur engagement.
 * Les doublons sont supprimés (avec leur enrichissement).
 *
 * Usage: npx tsx scripts/deduplicate-posts.ts [--dry-run]
 */
import prisma from '../src/db/client'

const ATTENTION_RANK: Record<string, number> = {
  engaged: 4,
  viewed: 3,
  glanced: 2,
  skipped: 1,
}

function normalizeCaption(caption: string): string {
  return caption
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickBest(posts: Array<{ id: string; dwellTimeMs: number; attentionLevel: string; caption: string }>) {
  return posts.sort((a, b) => {
    // 1. Best attention level
    const aRank = ATTENTION_RANK[a.attentionLevel] ?? 0
    const bRank = ATTENTION_RANK[b.attentionLevel] ?? 0
    if (aRank !== bRank) return bRank - aRank
    // 2. Highest dwell time
    if (a.dwellTimeMs !== b.dwellTimeMs) return b.dwellTimeMs - a.dwellTimeMs
    // 3. Longest caption (more data)
    return b.caption.length - a.caption.length
  })[0]
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const posts = await prisma.post.findMany({
    select: { id: true, username: true, caption: true, dwellTimeMs: true, attentionLevel: true, sessionId: true },
  })

  console.log(`Total posts: ${posts.length}`)

  // Group by username + normalized caption
  const groups = new Map<string, typeof posts>()
  for (const p of posts) {
    const key = `${p.username}::${normalizeCaption(p.caption)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  const dupeGroups = [...groups.entries()].filter(([, v]) => v.length > 1)
  console.log(`Duplicate groups: ${dupeGroups.length}`)

  let totalToDelete = 0
  const idsToDelete: string[] = []

  for (const [key, group] of dupeGroups) {
    const best = pickBest(group)
    const toRemove = group.filter(p => p.id !== best.id)
    totalToDelete += toRemove.length

    if (dryRun) {
      const [user] = key.split('::')
      console.log(`  @${user} — keep ${best.id} (${best.attentionLevel}, ${best.dwellTimeMs}ms), remove ${toRemove.length}`)
    }

    idsToDelete.push(...toRemove.map(p => p.id))
  }

  console.log(`\nPosts to delete: ${totalToDelete}`)
  console.log(`Posts remaining: ${posts.length - totalToDelete}`)

  if (dryRun) {
    console.log('\n[DRY RUN] No changes made.')
    return
  }

  // Delete enrichments first (FK constraint)
  const deletedEnrichments = await prisma.postEnriched.deleteMany({
    where: { postId: { in: idsToDelete } },
  })
  console.log(`Deleted ${deletedEnrichments.count} enrichments`)

  // Delete duplicate posts
  const deletedPosts = await prisma.post.deleteMany({
    where: { id: { in: idsToDelete } },
  })
  console.log(`Deleted ${deletedPosts.count} posts`)

  console.log('\nDeduplication complete.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
