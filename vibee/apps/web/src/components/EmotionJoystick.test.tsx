import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EmotionJoystick } from './EmotionJoystick'

function renderJoystick(onPositionChange = vi.fn()) {
  const collective = { valence: 0, energy: 0 }
  render(<EmotionJoystick onPositionChange={onPositionChange} collective={collective} />)
  return { onPositionChange }
}

function getPad() {
  // The pad has cursor-crosshair class
  return document.querySelector('.cursor-crosshair') as HTMLElement
}

/** Mock getBoundingClientRect so position math works predictably */
function mockPadRect(pad: HTMLElement) {
  pad.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    width: 256,
    height: 256,
    right: 256,
    bottom: 256,
  } as DOMRect)
}

describe('EmotionJoystick', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the pad and axis labels', () => {
    renderJoystick()
    expect(screen.getAllByText(/Intense/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Chill/)).toBeInTheDocument()
  })

  it('does NOT call onPositionChange during drag (only on drag end)', () => {
    const { onPositionChange } = renderJoystick()
    const pad = getPad()
    mockPadRect(pad)

    fireEvent.pointerDown(pad, { clientX: 128, clientY: 128 })
    fireEvent.pointerMove(pad, { clientX: 200, clientY: 100 })
    fireEvent.pointerMove(pad, { clientX: 220, clientY: 80 })

    // No callback yet — drag is still in progress
    expect(onPositionChange).not.toHaveBeenCalled()
  })

  it('calls onPositionChange 500ms after drag end (debounced)', () => {
    const { onPositionChange } = renderJoystick()
    const pad = getPad()
    mockPadRect(pad)

    fireEvent.pointerDown(pad, { clientX: 128, clientY: 128 })
    fireEvent.pointerMove(pad, { clientX: 200, clientY: 100 })
    fireEvent.pointerUp(pad, { clientX: 200, clientY: 100 })

    // Not called immediately
    expect(onPositionChange).not.toHaveBeenCalled()

    // Called after 500ms
    act(() => { vi.advanceTimersByTime(500) })
    expect(onPositionChange).toHaveBeenCalledTimes(1)

    // valence: 200/256 * 2 - 1 ≈ 0.5625
    // energy: -(100/256 * 2 - 1) ≈ 0.21875
    const [valence, energy] = onPositionChange.mock.calls[0]
    expect(valence).toBeCloseTo(0.5625, 2)
    expect(energy).toBeCloseTo(0.21875, 2)
  })

  it('debounces multiple rapid drag-end events into one callback', () => {
    const { onPositionChange } = renderJoystick()
    const pad = getPad()
    mockPadRect(pad)

    // Simulates rapid taps: down-up, down-up within 500ms
    fireEvent.pointerDown(pad, { clientX: 128, clientY: 128 })
    fireEvent.pointerUp(pad, { clientX: 128, clientY: 128 })

    act(() => { vi.advanceTimersByTime(200) }) // 200ms — timer not fired yet

    fireEvent.pointerDown(pad, { clientX: 200, clientY: 100 })
    fireEvent.pointerUp(pad, { clientX: 200, clientY: 100 })

    act(() => { vi.advanceTimersByTime(500) }) // 500ms from second touch

    // Only one callback with the LAST position
    expect(onPositionChange).toHaveBeenCalledTimes(1)
    const [valence] = onPositionChange.mock.calls[0]
    expect(valence).toBeCloseTo(0.5625, 2)
  })

  it('renders collective dot with CSS transition', () => {
    render(
      <EmotionJoystick
        onPositionChange={vi.fn()}
        collective={{ valence: 0.5, energy: 0.5 }}
      />
    )
    const pad = getPad()
    // Yellow dot (collective) should have transition style
    const dots = pad.querySelectorAll('[style*="transition"]')
    expect(dots.length).toBeGreaterThan(0)
  })

  it('pad is at least 44px for touch-friendly interaction', () => {
    renderJoystick()
    const pad = getPad()
    // w-64 = 256px in Tailwind, but jsdom doesn't compute CSS
    // Verify the class is present to assert the intent
    expect(pad.className).toMatch(/w-64/)
    expect(pad.className).toMatch(/h-64/)
  })
})
