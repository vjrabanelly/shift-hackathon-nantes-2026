import { SearchCandidate, SearchTrace, TrackSource } from '@partyjam/shared'
import { searchMusicCandidates } from '@partyjam/connectors'
import { PartyStore } from './store'

interface AgentTurnResult {
  session: ReturnType<PartyStore['getSession']>
  assistant_message: string
  candidates: SearchCandidate[]
  search_traces: SearchTrace[]
}

export async function createAgentTurn(
  store: PartyStore,
  eventId: string,
  guestId: string,
  message: string,
  joystick?: { valence: number; energy: number }
): Promise<AgentTurnResult> {
  const trimmedMessage = message.trim()
  if (!trimmedMessage) {
    throw new Error('empty_message')
  }

  store.ensureGuest(eventId, guestId)
  store.ensureSession(eventId, guestId)

  if (joystick) {
    store.updateJoystick(eventId, guestId, joystick.valence, joystick.energy)
  }

  const referenceCandidate = inferReferenceCandidate(store, eventId, guestId, trimmedMessage)
  const intents = detectQueryIntents(trimmedMessage)

  const request = store.recordRequest(eventId, guestId, trimmedMessage)
  store.appendMessage(eventId, guestId, {
    role: 'user',
    text: trimmedMessage
  })

  const collective = store.getCollectivePosition(eventId)
  const searchResult = await searchMusicCandidates({
    query: trimmedMessage,
    event_id: eventId,
    guest_id: guestId,
    vibe_config: store.getEvent(eventId).vibe_config,
    joystick: collective,
    now_playing: store.getNowPlaying(eventId)?.track ?? null,
    queue: store.getQueueTracks(eventId),
    rejected_candidate_ids: store.getSession(eventId, guestId).rejected_candidate_ids,
    reference_candidate: referenceCandidate ?? undefined,
    intents,
    max_candidates: 3
  })
  const candidates = selectVerifiedCandidates(trimmedMessage, searchResult.candidates)
  const searchTraces = searchResult.search_traces

  store.replacePendingCandidates(eventId, guestId, candidates)

  const assistantMessage = await composeAssistantReply({
    message: trimmedMessage,
    candidates,
    mood: collective,
    search_traces: searchTraces
  })

  const session = store.appendMessage(eventId, guestId, {
    role: 'assistant',
    text: assistantMessage,
    candidates,
    search_traces: searchTraces,
    decision: 'idle'
  })

  if (candidates.length === 1 && candidates[0].confidence > 0.9) {
    const latestRequest = store.getLatestRequestForGuest(eventId, guestId)
    if (latestRequest && latestRequest.id === request.id) {
      latestRequest.status = 'pending'
    }
  }

  return {
    session,
    assistant_message: assistantMessage,
    candidates,
    search_traces: searchTraces
  }
}

export async function rejectCandidate(
  store: PartyStore,
  eventId: string,
  guestId: string,
  candidateId: string
): Promise<AgentTurnResult> {
  store.rejectCandidate(eventId, guestId, candidateId)
  const latestRequest = store.getLatestRequestForGuest(eventId, guestId)
  if (!latestRequest) {
    const fallback = "Je n'ai plus le contexte de la demande. Dis-moi juste le prochain style ou morceau que tu veux chercher."
    const session = store.appendMessage(eventId, guestId, {
      role: 'assistant',
      text: fallback,
      candidates: [],
      decision: 'rejected'
    })
    return {
      session,
      assistant_message: fallback,
      candidates: [],
      search_traces: []
    }
  }

  const collective = store.getCollectivePosition(eventId)
  const searchResult = await searchMusicCandidates({
    query: latestRequest.raw_text,
    event_id: eventId,
    guest_id: guestId,
    vibe_config: store.getEvent(eventId).vibe_config,
    joystick: collective,
    now_playing: store.getNowPlaying(eventId)?.track ?? null,
    queue: store.getQueueTracks(eventId),
    rejected_candidate_ids: store.getSession(eventId, guestId).rejected_candidate_ids,
    reference_candidate: inferReferenceCandidate(store, eventId, guestId, latestRequest.raw_text) ?? undefined,
    intents: detectQueryIntents(latestRequest.raw_text),
    max_candidates: 3
  })
  const candidates = selectVerifiedCandidates(latestRequest.raw_text, searchResult.candidates)
  const searchTraces = searchResult.search_traces

  store.replacePendingCandidates(eventId, guestId, candidates)
  const assistantMessage =
    candidates.length > 0
      ? "Je retire cette piste. J'ai relancé les agents de recherche web, bases musique et vérification audio pour te proposer autre chose."
      : "Je n'ai plus de bon match immédiat. Reformule avec un artiste, une ambiance, une décennie ou un BPM approximatif."

  const session = store.appendMessage(eventId, guestId, {
    role: 'assistant',
    text: assistantMessage,
    candidates,
    search_traces: searchTraces,
    decision: 'rejected'
  })

  return {
    session,
    assistant_message: assistantMessage,
    candidates,
    search_traces: searchTraces
  }
}

export function selectCandidatePreview(
  store: PartyStore,
  eventId: string,
  guestId: string,
  candidateId: string,
  sourceId: string
): { session: ReturnType<PartyStore['getSession']>; candidate: SearchCandidate; selected_source: TrackSource } {
  const selection = store.selectPreviewSource(eventId, guestId, candidateId, sourceId)
  store.appendMessage(eventId, guestId, {
    role: 'assistant',
    text: `Je te verrouille ${selection.candidate.title} par ${selection.candidate.artist}. Écoute l'extrait intégré et dis-moi si on l'ajoute à la suite.`,
    candidates: [selection.candidate],
    decision: 'previewing'
  })

  return {
    session: selection.session,
    candidate: selection.candidate,
    selected_source: selection.source
  }
}

export function confirmCandidate(store: PartyStore, eventId: string, guestId: string, candidateId: string) {
  const latestRequest = store.getLatestRequestForGuest(eventId, guestId)
  const result = store.confirmCandidate(eventId, guestId, candidateId)
  if (latestRequest) {
    store.resolveRequest(eventId, latestRequest.id, result.track.id)
  }

  store.appendMessage(eventId, guestId, {
    role: 'assistant',
    text:
      result.track.added_by === guestId
        ? `Parfait, ${result.track.title} est maintenant ajouté dans la suite de la soirée.`
        : `${result.track.title} était déjà prévu dans la queue, donc je l'ai simplement confirmé.`,
    decision: 'queued'
  })

  return {
    session: result.session,
    track: result.track
  }
}

async function composeAssistantReply(input: {
  message: string
  candidates: SearchCandidate[]
  mood: { valence: number; energy: number }
  search_traces: SearchTrace[]
}): Promise<string> {
  const topCandidate = input.candidates[0]
  const clarificationNeeded = !topCandidate
  if (clarificationNeeded) {
    return "Je cherche encore et je recoupe plusieurs pistes. Donne-moi un artiste, un titre proche, des paroles, une tradition locale ou dis-moi si la version trouvée n'a pas le bon son."
  }

  const fallback = buildFallbackAssistantMessage(input)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return fallback
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        reasoning: {
          effort: 'low'
        },
        instructions:
          "Tu es l'agent musique du front mobile d'une soirée. Réponds en français, 2 phrases maximum, style direct et chaleureux. Mentionne le meilleur candidat, explique vite pourquoi il colle, puis demande si c'est bien le morceau recherché ou s'il faut continuer.",
        input: buildOpenAIPrompt(input)
      })
    })

    if (!response.ok) {
      return fallback
    }

    const data = (await response.json()) as {
      output_text?: string
      output?: Array<{
        content?: Array<{
          type?: string
          text?: string
        }>
      }>
    }

    const text =
      data.output_text?.trim() ??
      data.output
        ?.flatMap((item) => item.content ?? [])
        .find((content) => typeof content.text === 'string')
        ?.text?.trim()

    return text || fallback
  } catch {
    return fallback
  }
}

function buildFallbackAssistantMessage(input: {
  message: string
  candidates: SearchCandidate[]
  mood: { valence: number; energy: number }
  search_traces: SearchTrace[]
}): string {
  const topCandidate = input.candidates[0]
  if (!topCandidate) {
    return "Je n'ai pas trouvé de candidat suffisamment solide pour cette demande. Reformule avec plus de détails et je relance la recherche."
  }

  const bpm = topCandidate.metrics?.bpm ? `${Math.round(topCandidate.metrics.bpm)} BPM` : 'tempo non mesuré'
  const uncertain =
    (topCandidate.verification_status ?? 'unverified') === 'unverified' || topCandidate.confidence < 0.55

  if (uncertain) {
    return `J'ai au moins une piste à te faire écouter: ${topCandidate.title} par ${topCandidate.artist}. Ce n'est pas encore un match totalement verrouillé, mais c'est la meilleure correspondance trouvée pour l'instant, autour de ${bpm}. Dis-moi si on est proche, et je continue à affiner si besoin.`
  }

  return `${topCandidate.title} par ${topCandidate.artist} ressort en tête. ${topCandidate.why_it_matches} On est autour de ${bpm} avec une énergie ${formatEnergy(input.mood.energy)}: est-ce que c'est bien ce morceau, ou tu veux que je continue ?`
}

function selectVerifiedCandidates(message: string, candidates: SearchCandidate[]): SearchCandidate[] {
  const uniqueCandidates = dedupeCandidates(candidates)

  if (uniqueCandidates.length === 0) {
    return []
  }

  const [topCandidate, secondCandidate] = uniqueCandidates
  const normalizedMessage = normalizeText(message)
  const topScore = topCandidate.confidence
  const secondScore = secondCandidate?.confidence ?? 0
  const scoreGap = topScore - secondScore

  const titleAnchor = normalizedMessage.includes(normalizeText(topCandidate.title))
  const artistAnchor = normalizedMessage.includes(normalizeText(topCandidate.artist))
  const traditionAnchor =
    (normalizedMessage.includes('tapis') || normalizedMessage.includes('tapie')) &&
    (normalizeText(topCandidate.title).includes('tapis') || topCandidate.genres.some((genre) => normalizeText(genre).includes('mariage')))
  const heritageContext =
    normalizedMessage.includes('mariage') ||
    normalizedMessage.includes('vendee') ||
    normalizedMessage.includes('vendeenne') ||
    normalizedMessage.includes('tradition') ||
    normalizedMessage.includes('danse')

  const verified =
    topScore >= 0.9 ||
    (topScore >= 0.72 && (titleAnchor || artistAnchor || traditionAnchor)) ||
    (topScore >= 0.64 && scoreGap >= 0.12 && (titleAnchor || traditionAnchor)) ||
    (traditionAnchor && heritageContext && topScore >= 0.48 && scoreGap >= 0.08)

  if (!verified) {
    const exploratory = uniqueCandidates.filter((candidate) => candidate.confidence >= 0.3)
    return exploratory.slice(0, Math.min(3, exploratory.length))
  }

  const exactEnough =
    topScore >= 0.9 ||
    (traditionAnchor && topScore >= 0.8) ||
    (titleAnchor && topScore >= 0.8) ||
    (traditionAnchor && heritageContext && topScore >= 0.48)

  if (exactEnough) {
    return uniqueCandidates.slice(0, 1)
  }

  return uniqueCandidates.slice(0, Math.min(3, uniqueCandidates.length))
}

function dedupeCandidates(candidates: SearchCandidate[]): SearchCandidate[] {
  const unique = new Map<string, SearchCandidate>()

  for (const candidate of candidates) {
    const key = `${normalizeText(candidate.title)}::${normalizeText(candidate.artist)}`
    const existing = unique.get(key)
    if (!existing || candidate.confidence > existing.confidence) {
      unique.set(key, {
        ...candidate,
        sources: dedupeSources(candidate.sources)
      })
    }
  }

  return [...unique.values()]
}

function dedupeSources(sources: TrackSource[]): TrackSource[] {
  const unique = new Map<string, TrackSource>()

  for (const source of sources) {
    const key = `${source.platform}::${source.external_id || source.url}`
    if (!unique.has(key)) {
      unique.set(key, source)
    }
  }

  return [...unique.values()]
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function detectQueryIntents(message: string): string[] {
  const normalized = normalizeText(message)
  const intents: string[] = []
  if (
    normalized.includes('parole') ||
    normalized.includes('lyrics') ||
    normalized.includes('la la') ||
    normalized.includes('chante') ||
    normalized.includes('parle') ||
    normalized.includes('dit') ||
    normalized.includes('refrain')
  ) {
    intents.push('lyrics')
  }
  if (normalized.includes('mauvais son') || normalized.includes('son pourri') || normalized.includes('bon son') || normalized.includes('audio') || normalized.includes('pourri') || normalized.includes('qualite')) {
    intents.push('quality')
  }
  if (normalized.includes('c est ca') || normalized.includes('cest ca') || normalized.includes('meme musique')) {
    intents.push('reference')
  }
  if (
    normalized.includes('qui est') ||
    normalized.includes('c est qui') ||
    normalized.includes('biographie') ||
    normalized.includes('origine') ||
    normalized.includes('tradition') ||
    normalized.includes('wikipedia')
  ) {
    intents.push('context')
  }
  return intents
}

function inferReferenceCandidate(store: PartyStore, eventId: string, guestId: string, message: string) {
  const normalized = normalizeText(message)
  if (
    !normalized.includes('son') &&
    !normalized.includes('audio') &&
    !normalized.includes('meme') &&
    !normalized.includes('c est ca')
  ) {
    return null
  }

  const session = store.getSession(eventId, guestId)
  const selectedId = Object.keys(session.selected_preview_by_candidate)[0]
  const selected = session.pending_candidates.find((candidate) => candidate.id === selectedId)
  const fallback = selected ?? session.pending_candidates[0] ?? null
  return fallback ? { title: fallback.title, artist: fallback.artist } : null
}

function buildOpenAIPrompt(input: {
  message: string
  candidates: SearchCandidate[]
  mood: { valence: number; energy: number }
}): string {
  const candidates = input.candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.title} — ${candidate.artist}; confiance=${candidate.confidence.toFixed(2)}; genres=${candidate.genres.join(', ') || 'n/a'}; raison=${candidate.why_it_matches}`
    )
    .join('\n')

  return [
    `Demande utilisateur: ${input.message}`,
    `Contexte de mood: valence=${input.mood.valence}, energy=${input.mood.energy}`,
    'Candidats proposés:',
    candidates
  ].join('\n')
}

function formatEnergy(value: number): string {
  if (value > 0.3) {
    return 'haute'
  }
  if (value < -0.2) {
    return 'basse'
  }
  return 'médiane'
}
