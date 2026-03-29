import prisma from '../src/db/client'

async function main() {
  // Delete enrichments for sport-mistagged posts
  const sportEnriched = await prisma.postEnriched.findMany({
    where: {
      OR: [
        { mainTopics: { contains: 'sport' } },
        { secondaryTopics: { contains: 'sport' } },
        { subjects: { contains: 'football' } },
        { subjects: { contains: 'fitness' } },
      ],
    },
    select: { id: true, postId: true },
  })

  console.log(`Found ${sportEnriched.length} sport-mistagged enrichments to delete`)

  if (sportEnriched.length > 0) {
    await prisma.postEnriched.deleteMany({
      where: { id: { in: sportEnriched.map(e => e.id) } },
    })
    console.log('Deleted. These posts will be re-enriched on next run.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
