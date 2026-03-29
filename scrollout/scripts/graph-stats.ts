import prisma from '../src/db/client';

async function main() {
  const byType = await prisma.$queryRawUnsafe<{ type: string; c: number }[]>(
    'SELECT type, COUNT(*) as c FROM KnowledgeEntity GROUP BY type ORDER BY c DESC',
  );
  console.log('=== Entités par type ===');
  for (const t of byType) console.log(`  ${t.type}: ${t.c}`);

  const byRel = await prisma.$queryRawUnsafe<{ relation: string; c: number }[]>(
    'SELECT relation, COUNT(*) as c FROM Observation GROUP BY relation ORDER BY c DESC',
  );
  console.log('\n=== Observations par relation ===');
  for (const r of byRel) console.log(`  ${r.relation}: ${r.c}`);

  // Co-occurrences : entités les plus souvent vues ensemble dans un même post
  const coOccurrences = await prisma.$queryRawUnsafe<{ e1: string; e2: string; co: number }[]>(`
    SELECT ke1.canonicalName as e1, ke2.canonicalName as e2, COUNT(*) as co
    FROM Observation o1
    JOIN Observation o2 ON o1.postId = o2.postId AND o1.entityId < o2.entityId
    JOIN KnowledgeEntity ke1 ON o1.entityId = ke1.id
    JOIN KnowledgeEntity ke2 ON o2.entityId = ke2.id
    WHERE ke1.type NOT IN ('Audience', 'Emotion')
      AND ke2.type NOT IN ('Audience', 'Emotion')
    GROUP BY o1.entityId, o2.entityId
    HAVING co >= 3
    ORDER BY co DESC
    LIMIT 20
  `);
  console.log('\n=== Top co-occurrences (≥3) ===');
  for (const c of coOccurrences) console.log(`  ${c.co}x  ${c.e1} ↔ ${c.e2}`);
}

main().catch(console.error);
