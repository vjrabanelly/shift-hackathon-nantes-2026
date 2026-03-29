import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { SeedTrack } from '@partyjam/shared'

interface SeedRow {
  title: string
  artist: string
  youtube_id: string
}

export function AdminCreateView() {
  const navigate = useNavigate()

  const [eventName, setEventName] = useState('')
  const [vibeDescription, setVibeDescription] = useState('')
  const [energyProfile, setEnergyProfile] = useState<
    'chill' | 'moderate' | 'intense' | 'chill_to_intense' | ''
  >('')
  const [genreAllow, setGenreAllow] = useState('')
  const [genreBlock, setGenreBlock] = useState('')
  const [seedRows, setSeedRows] = useState<SeedRow[]>([
    { title: '', artist: '', youtube_id: '' },
  ])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addSeedRow = () =>
    setSeedRows((rows) => [...rows, { title: '', artist: '', youtube_id: '' }])

  const removeSeedRow = (i: number) =>
    setSeedRows((rows) => rows.filter((_, idx) => idx !== i))

  const updateSeedRow = (i: number, field: keyof SeedRow, value: string) =>
    setSeedRows((rows) =>
      rows.map((row, idx) => (idx === i ? { ...row, [field]: value } : row))
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!eventName.trim()) {
      setError('Event name is required')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const seedPlaylist: SeedTrack[] = seedRows
        .filter((r) => r.title.trim() || r.artist.trim())
        .map((r) => ({
          title: r.title.trim(),
          artist: r.artist.trim(),
          ...(r.youtube_id.trim() ? { youtube_id: r.youtube_id.trim() } : {}),
        }))

      const data = await api.createEvent({
        name: eventName.trim(),
        vibe_config: {
          ...(vibeDescription.trim() ? { context: vibeDescription.trim() } : {}),
          ...(energyProfile ? { energy_profile: energyProfile } : {}),
          ...(genreAllow.trim()
            ? {
                genre_allow: genreAllow
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : {}),
          ...(genreBlock.trim()
            ? {
                genre_block: genreBlock
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : {}),
        },
        ...(seedPlaylist.length ? { seed_playlist: seedPlaylist } : {}),
      })

      localStorage.setItem(`admin_token_${data.event_id}`, data.admin_token)

      navigate(`/admin/${data.event_id}?token=${data.admin_token}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold mb-8 text-center">Create Event</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Name */}
          <div>
            <label htmlFor="eventName" className="block text-sm font-medium mb-2">
              Event Name <span className="text-red-400">*</span>
            </label>
            <input
              id="eventName"
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Hackathon Party"
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500"
              disabled={submitting}
            />
          </div>

          {/* Vibe Description */}
          <div>
            <label htmlFor="vibeDescription" className="block text-sm font-medium mb-2">
              Vibe Description
            </label>
            <textarea
              id="vibeDescription"
              value={vibeDescription}
              onChange={(e) => setVibeDescription(e.target.value)}
              placeholder="Describe the vibe you're going for..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 resize-none"
              disabled={submitting}
            />
          </div>

          {/* Energy Profile */}
          <div>
            <label htmlFor="energyProfile" className="block text-sm font-medium mb-2">
              Energy Profile
            </label>
            <select
              id="energyProfile"
              value={energyProfile}
              onChange={(e) =>
                setEnergyProfile(
                  e.target.value as 'chill' | 'moderate' | 'intense' | 'chill_to_intense' | ''
                )
              }
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500"
              disabled={submitting}
            >
              <option value="">Select energy profile...</option>
              <option value="chill">Chill</option>
              <option value="moderate">Moderate</option>
              <option value="intense">Intense</option>
              <option value="chill_to_intense">Chill to Intense</option>
            </select>
          </div>

          {/* Genre Allow List */}
          <div>
            <label htmlFor="genreAllow" className="block text-sm font-medium mb-2">
              Genre Allow List (comma-separated)
            </label>
            <input
              id="genreAllow"
              type="text"
              value={genreAllow}
              onChange={(e) => setGenreAllow(e.target.value)}
              placeholder="pop, rock, hip-hop"
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500"
              disabled={submitting}
            />
          </div>

          {/* Genre Block List */}
          <div>
            <label htmlFor="genreBlock" className="block text-sm font-medium mb-2">
              Genre Block List (comma-separated)
            </label>
            <input
              id="genreBlock"
              type="text"
              value={genreBlock}
              onChange={(e) => setGenreBlock(e.target.value)}
              placeholder="metal, country"
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500"
              disabled={submitting}
            />
          </div>

          {/* Seed Playlist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Seed Playlist</label>
              <button
                type="button"
                onClick={addSeedRow}
                className="text-sm text-purple-400 hover:text-purple-300"
                disabled={submitting}
              >
                + Add Track
              </button>
            </div>
            <div className="space-y-2">
              {seedRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={row.title}
                    onChange={(e) => updateSeedRow(i, 'title', e.target.value)}
                    placeholder="Title"
                    className="flex-1 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 text-sm"
                    disabled={submitting}
                  />
                  <input
                    type="text"
                    value={row.artist}
                    onChange={(e) => updateSeedRow(i, 'artist', e.target.value)}
                    placeholder="Artist"
                    className="flex-1 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 text-sm"
                    disabled={submitting}
                  />
                  <input
                    type="text"
                    value={row.youtube_id}
                    onChange={(e) => updateSeedRow(i, 'youtube_id', e.target.value)}
                    placeholder="YouTube ID"
                    className="flex-1 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 text-sm"
                    disabled={submitting}
                  />
                  {seedRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSeedRow(i)}
                      className="px-2 py-2 text-gray-400 hover:text-red-400"
                      disabled={submitting}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-semibold transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  )
}
