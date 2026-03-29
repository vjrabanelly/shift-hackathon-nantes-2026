import prisma from '../src/db/client.js';

async function main() {
  const totalPosts = await prisma.post.count();
  const enriched = await prisma.postEnriched.count();
  const sessions = await prisma.session.count();

  // Domain distribution
  const allEnriched = await prisma.postEnriched.findMany({
    select: {
      domains: true,
      mainTopics: true,
      subjects: true,
      preciseSubjects: true,
      politicalExplicitnessScore: true,
      polarizationScore: true,
      tone: true,
      primaryEmotion: true,
      narrativeFrame: true,
      confidenceScore: true,
      axisEconomic: true,
      axisSocietal: true,
      axisAuthority: true,
      axisSystem: true,
      mediaCategory: true,
      persons: true,
      politicalActors: true,
      postId: true,
    },
  });

  // Posts with attention data
  const posts = await prisma.post.findMany({
    select: {
      id: true,
      username: true,
      mediaType: true,
      attentionLevel: true,
      dwellTimeMs: true,
      category: true,
      isSponsored: true,
      isSuggested: true,
    },
  });

  // Domain counts
  const domainCounts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  const subjectCounts: Record<string, number> = {};
  const toneCounts: Record<string, number> = {};
  const emotionCounts: Record<string, number> = {};
  const narrativeCounts: Record<string, number> = {};
  const mediaCatCounts: Record<string, number> = {};
  let polSum = 0, polarSum = 0, confSum = 0;
  let polCount = 0;
  const polDistrib = [0, 0, 0, 0, 0]; // 0-4

  for (const e of allEnriched) {
    try {
      const domains = JSON.parse(e.domains || '[]');
      for (const d of domains) domainCounts[d] = (domainCounts[d] || 0) + 1;
    } catch {}
    try {
      const topics = JSON.parse(e.mainTopics || '[]');
      for (const t of topics) topicCounts[t] = (topicCounts[t] || 0) + 1;
    } catch {}
    try {
      const subjects = JSON.parse(e.subjects || '[]');
      for (const s of subjects) {
        const label = typeof s === 'string' ? s : s.label || s.id;
        subjectCounts[label] = (subjectCounts[label] || 0) + 1;
      }
    } catch {}

    if (e.tone) toneCounts[e.tone] = (toneCounts[e.tone] || 0) + 1;
    if (e.primaryEmotion) emotionCounts[e.primaryEmotion] = (emotionCounts[e.primaryEmotion] || 0) + 1;
    if (e.narrativeFrame) narrativeCounts[e.narrativeFrame] = (narrativeCounts[e.narrativeFrame] || 0) + 1;
    if (e.mediaCategory) mediaCatCounts[e.mediaCategory] = (mediaCatCounts[e.mediaCategory] || 0) + 1;

    polSum += e.politicalExplicitnessScore;
    polarSum += e.polarizationScore;
    confSum += e.confidenceScore;
    polDistrib[e.politicalExplicitnessScore]++;
    polCount++;
  }

  // Attention distribution
  const attentionCounts: Record<string, number> = {};
  const mediaTypeCounts: Record<string, number> = {};
  let totalDwell = 0;
  for (const p of posts) {
    attentionCounts[p.attentionLevel] = (attentionCounts[p.attentionLevel] || 0) + 1;
    mediaTypeCounts[p.mediaType] = (mediaTypeCounts[p.mediaType] || 0) + 1;
    totalDwell += p.dwellTimeMs;
  }

  // Top usernames
  const userCounts: Record<string, number> = {};
  for (const p of posts) userCounts[p.username] = (userCounts[p.username] || 0) + 1;
  const topUsers = Object.entries(userCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Axes moyens
  let axEco = 0, axSoc = 0, axAuth = 0, axSys = 0, axCount = 0;
  for (const e of allEnriched) {
    if (e.axisEconomic || e.axisSocietal || e.axisAuthority || e.axisSystem) {
      axEco += e.axisEconomic;
      axSoc += e.axisSocietal;
      axAuth += e.axisAuthority;
      axSys += e.axisSystem;
      axCount++;
    }
  }

  const sort = (obj: Record<string, number>) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]);

  console.log(JSON.stringify({
    overview: { totalPosts, enriched, sessions },
    domains: sort(domainCounts),
    topics: sort(topicCounts).slice(0, 15),
    subjects: sort(subjectCounts).slice(0, 20),
    tones: sort(toneCounts),
    emotions: sort(emotionCounts),
    narratives: sort(narrativeCounts),
    mediaCategories: sort(mediaCatCounts),
    attention: sort(attentionCounts),
    mediaTypes: sort(mediaTypeCounts),
    political: {
      avgScore: polCount ? (polSum / polCount).toFixed(2) : 0,
      avgPolarization: polCount ? (polarSum / polCount).toFixed(2) : 0,
      avgConfidence: polCount ? (confSum / polCount).toFixed(2) : 0,
      distribution: polDistrib,
      politicalPosts: polDistrib[2] + polDistrib[3] + polDistrib[4],
      polarizingPosts: allEnriched.filter(e => e.polarizationScore >= 0.5).length,
    },
    axes: axCount ? {
      economic: (axEco / axCount).toFixed(2),
      societal: (axSoc / axCount).toFixed(2),
      authority: (axAuth / axCount).toFixed(2),
      system: (axSys / axCount).toFixed(2),
    } : null,
    topUsers,
    totalDwellMs: totalDwell,
    sponsored: posts.filter(p => p.isSponsored).length,
    suggested: posts.filter(p => p.isSuggested).length,
  }, null, 2));
}

main().then(() => process.exit(0));
