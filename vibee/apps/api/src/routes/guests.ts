import { FastifyPluginAsync } from 'fastify'
import { supabase } from '../lib/supabase'
import type { JoinEventRequest, JoinEventResponse } from '@partyjam/shared'

const PARTY_EMOJIS = [
  '🎵', '🎸', '🎹', '🥁', '🎷', '🎺', '🎻', '🎤', '🎧', '🦄',
  '🔥', '⚡', '🌈', '🎉', '🍕', '🚀', '🌟', '💃', '🕺', '🐝',
  '🎊', '✨', '🦋', '🍾', '🥳',
]

export const guestsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Params: { id: string }
    Body: JoinEventRequest
  }>('/:id/join', async (req, reply) => {
    const { id: eventId } = req.params
    const { display_name } = req.body

    if (!display_name || display_name.trim().length === 0) {
      return reply.code(400).send({ error: 'display_name is required' })
    }
    if (display_name.trim().length > 30) {
      return reply.code(400).send({ error: 'display_name must be 30 characters or fewer' })
    }

    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single()

    if (!event) {
      return reply.code(404).send({ error: 'Event not found' })
    }

    const emoji = PARTY_EMOJIS[Math.floor(Math.random() * PARTY_EMOJIS.length)]

    const { data: guest, error } = await supabase
      .from('guests')
      .insert({
        event_id: eventId,
        display_name: display_name.trim(),
        emoji,
      })
      .select()
      .single()

    if (error || !guest) {
      app.log.error(error, 'Failed to insert guest')
      return reply.code(500).send({ error: 'Failed to join event' })
    }

    const response: JoinEventResponse = {
      guest_id: guest.id,
      display_name: guest.display_name,
      emoji: guest.emoji,
      event_id: eventId,
    }

    return reply.code(201).send(response)
  })
}
