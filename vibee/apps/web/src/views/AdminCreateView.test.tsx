import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminCreateView } from './AdminCreateView'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../lib/api', () => ({
  api: {
    createEvent: vi.fn(),
  },
}))

import { api } from '../lib/api'

function renderAdminCreateView() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<AdminCreateView />} />
        <Route path="/admin/:eventId" element={<div data-testid="admin-view">Admin View</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AdminCreateView', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders the create event form', () => {
    renderAdminCreateView()
    expect(screen.getByRole('heading', { name: 'Create Event' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Event Name/)).toBeInTheDocument()
  })

  it('shows validation error when event name is empty', async () => {
    renderAdminCreateView()
    const submitButton = screen.getByRole('button', { name: /Create Event/i })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(screen.getByText('Event name is required')).toBeInTheDocument()
    })
  })

  it('calls api.createEvent with event name on submit', async () => {
    const mockCreate = vi.mocked(api.createEvent)
    mockCreate.mockResolvedValue({
      event_id: 'evt-123',
      admin_token: 'tok-abc',
      join_url: 'http://localhost/join/evt-123',
      stream_url: 'http://localhost:3000/stream/playlist.m3u8',
    } as any)

    renderAdminCreateView()

    const nameInput = screen.getByLabelText(/Event Name/)
    fireEvent.change(nameInput, { target: { value: 'Hackathon Party' } })

    const submitButton = screen.getByRole('button', { name: /Create Event/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Hackathon Party' })
      )
    })
  })

  it('redirects to admin view after successful creation', async () => {
    const mockCreate = vi.mocked(api.createEvent)
    mockCreate.mockResolvedValue({
      event_id: 'evt-123',
      admin_token: 'tok-abc',
      join_url: 'http://localhost/join/evt-123',
      stream_url: 'http://localhost:3000/stream/playlist.m3u8',
    } as any)

    // Mock localStorage since jsdom environment may not support it
    const localStorageMock = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() }
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

    renderAdminCreateView()

    const nameInput = screen.getByLabelText(/Event Name/)
    fireEvent.change(nameInput, { target: { value: 'Hackathon Party' } })

    const submitButton = screen.getByRole('button', { name: /Create Event/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByTestId('admin-view')).toBeInTheDocument()
    })
  })

  it('shows error message when creation fails', async () => {
    const mockCreate = vi.mocked(api.createEvent)
    mockCreate.mockRejectedValue(new Error('Server error'))

    renderAdminCreateView()

    const nameInput = screen.getByLabelText(/Event Name/)
    fireEvent.change(nameInput, { target: { value: 'Hackathon Party' } })

    const submitButton = screen.getByRole('button', { name: /Create Event/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })
})
