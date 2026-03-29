import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'
import { TrackResolver } from '../services/track-resolver'

export async function requestsRoutes(app: FastifyInstance) {
  // POST /events/:id/requests — guest submits a music request
  app.post<{
    Params: { id: string }
    Body: { guest_id: string; raw_text: string }
  }>('/:id/requests', async (req, reply) => {
    const { id: eventId } = req.params
    const { guest_id, raw_text } = req.body

    if (!guest_id?.trim()) {
      return reply.status(400).send({ error: 'guest_id is required' })
    }

    if (!raw_text?.trim()) {
      return reply.status(400).send({ error: 'raw_text is required' })
    }

    // Verify event and guest exist
    const [{ data: event }, { data: guest }] = await Promise.all([
      supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .single(),
      supabase
        .from('guests')
        .select('id')
        .eq('id', guest_id)
        .eq('event_id', eventId)
        .maybeSingle(),
    ])

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    if (!guest) {
      return reply.status(404).send({ error: 'Guest not found for this event' })
    }

    // Insert request row immediately
    const { data: request, error } = await supabase
      .from('requests')
      .insert({
        event_id: eventId,
        guest_id,
        raw_text: raw_text.trim(),
        status: 'pending',
      })
      .select()
      .single()

    if (error || !request) {
      app.log.error(error, 'Failed to insert request')
      return reply.status(500).send({ error: 'Failed to create request' })
    }

    // Respond immediately — resolution is async
    reply.status(202).send({ request_id: request.id, status: 'pending' })

    // Fire-and-forget: resolve track in background
    TrackResolver.resolve(raw_text.trim(), eventId, guest_id, request.id)
      .catch((err) => console.error('[requests] TrackResolver error:', err))
  })
}
