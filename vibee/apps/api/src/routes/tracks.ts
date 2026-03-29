import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

export async function tracksRoutes(app: FastifyInstance) {
  // DELETE /events/:id/tracks/:trackId — admin removes a track
  app.delete<{
    Params: { id: string; trackId: string }
    Headers: { 'x-admin-token'?: string }
  }>('/:id/tracks/:trackId', async (req, reply) => {
    const { id: eventId, trackId } = req.params
    const adminToken = req.headers['x-admin-token']

    // Verify admin token
    const { data: event } = await supabase
      .from('events')
      .select('admin_token')
      .eq('id', eventId)
      .single()

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    if (event.admin_token !== adminToken) {
      return reply.status(403).send({ error: 'Invalid admin token' })
    }

    // Delete the track
    const { error } = await supabase
      .from('tracks')
      .delete()
      .eq('id', trackId)
      .eq('event_id', eventId)  // Ensure track belongs to this event

    if (error) {
      return reply.status(500).send({ error: 'Failed to delete track' })
    }

    return reply.status(204).send()
  })
}
