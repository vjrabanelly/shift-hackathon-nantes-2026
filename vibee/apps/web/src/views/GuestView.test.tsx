import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GuestView } from './GuestView'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock hooks and components
vi.mock('../hooks/useRealtimeJoystick', () => ({
  useRealtimeJoystick: () => ({
    collective: { valence: 0, energy: 0 },
    setCollective: vi.fn(),
  }),
}))

vi.mock('../components/NowPlayingCard', () => ({
  NowPlayingCard: () => <div data-testid="now-playing">Now Playing</div>,
}))

vi.mock('../components/QueueView', () => ({
  QueueView: ({ tracks }: any) => (
    <div data-testid="queue-view">{tracks.length} tracks</div>
  ),
}))

vi.mock('../components/MoodJoystick', () => ({
  MoodJoystick: () => <div data-testid="mood-joystick">Joystick</div>,
}))

vi.mock('../components/ChatAssist', () => ({
  ChatAssist: () => <div data-testid="chat-assist">Chat Assist</div>,
}))

const mockEventState = {
  event: { id: 'evt-1', name: 'Test Party', stream_url: '' },
  now_playing: null,
  queue: [],
  collective_joystick: { valence: 0, energy: 0 },
}

function renderGuestView(eventId = 'evt-1') {
  localStorage.setItem(
    `partyjam_guest_${eventId}`,
    JSON.stringify({ guest_id: 'guest-123', display_name: 'Alice', emoji: '🎵' })
  )
  return render(
    <MemoryRouter initialEntries={[`/join/${eventId}/play`]}>
      <Routes>
        <Route path="/join/:id/play" element={<GuestView />} />
        <Route path="/join/:id" element={<div>Join Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('GuestView', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetAllMocks()
  })

  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any
    renderGuestView()
    expect(screen.getByText('Chargement du set...')).toBeInTheDocument()
  })

  it('renders all sections after successful fetch', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEventState),
    }) as any

    renderGuestView()

    await waitFor(() => {
      expect(screen.getByText('set de Test Party')).toBeInTheDocument()
    })

    expect(screen.getByTestId('now-playing')).toBeInTheDocument()
    expect(screen.getByTestId('mood-joystick')).toBeInTheDocument()
    expect(screen.getByTestId('queue-view')).toBeInTheDocument()
    expect(screen.getByTestId('chat-assist')).toBeInTheDocument()
    expect(screen.getByText('mes suggestion')).toBeInTheDocument()
  })

  it('shows error state on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as any

    renderGuestView()

    await waitFor(() => {
      expect(screen.getByText('Session introuvable')).toBeInTheDocument()
    })
    expect(screen.getByText('Retour')).toBeInTheDocument()
  })

  it('shows error state on network error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as any

    renderGuestView()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger la session')).toBeInTheDocument()
    })
  })

  it('redirects to join page if no guestId in localStorage', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEventState),
    }) as any

    localStorage.clear() // No guest ID

    render(
      <MemoryRouter initialEntries={['/join/evt-1/play']}>
        <Routes>
          <Route path="/join/:id/play" element={<GuestView />} />
          <Route path="/join/:id" element={<div>Join Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Join Page')).toBeInTheDocument()
  })
})
