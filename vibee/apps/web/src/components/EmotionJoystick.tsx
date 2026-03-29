import { useState, useRef, useCallback } from 'react'

interface Props {
  onPositionChange: (valence: number, energy: number) => void
  collective: { valence: number; energy: number }
}

export function EmotionJoystick({ onPositionChange, collective }: Props) {
  const [myPos, setMyPos] = useState({ valence: 0, energy: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const padRef = useRef<HTMLDivElement>(null)
  const pendingPos = useRef<{ valence: number; energy: number } | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleCallback = useCallback(
    (valence: number, energy: number) => {
      pendingPos.current = { valence, energy }
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        if (pendingPos.current) {
          onPositionChange(pendingPos.current.valence, pendingPos.current.energy)
          pendingPos.current = null
        }
      }, 500)
    },
    [onPositionChange]
  )

  const computePos = useCallback((e: React.PointerEvent) => {
    if (!padRef.current) return null
    const rect = padRef.current.getBoundingClientRect()
    const rawX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const rawY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    return { valence: rawX * 2 - 1, energy: -(rawY * 2 - 1) }
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      const pos = computePos(e)
      if (pos) setMyPos(pos)
    },
    [computePos]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      const pos = computePos(e)
      if (pos) setMyPos(pos)
    },
    [isDragging, computePos]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(false)
      const pos = computePos(e)
      if (pos) {
        setMyPos(pos)
        scheduleCallback(pos.valence, pos.energy)
      }
    },
    [computePos, scheduleCallback]
  )

  const toLeftPercent = (valence: number) => `${((valence + 1) / 2) * 100}%`
  const toTopPercent = (energy: number) => `${((-energy + 1) / 2) * 100}%`

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-white/50">⚡ Intense</span>

      <div className="flex items-center gap-1">
        <span className="text-xs text-white/50">😢</span>

        <div
          ref={padRef}
          className="relative w-64 h-64 rounded-xl cursor-crosshair touch-none select-none overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-px bg-white/10" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-full w-px bg-white/10" />
          </div>

          <span className="absolute top-2 right-2 text-xs text-white/30">Euphoric</span>
          <span className="absolute top-2 left-2 text-xs text-white/30">Intense</span>
          <span className="absolute bottom-2 right-2 text-xs text-white/30">Peaceful</span>
          <span className="absolute bottom-2 left-2 text-xs text-white/30">Melancholic</span>

          <div
            className="absolute w-5 h-5 rounded-full bg-yellow-400 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: toLeftPercent(collective.valence),
              top: toTopPercent(collective.energy),
              boxShadow: '0 0 12px 4px rgba(250, 204, 21, 0.6)',
              transition: 'left 0.3s ease, top 0.3s ease',
            }}
          />

          <div
            className="absolute w-4 h-4 rounded-full bg-white border-2 border-purple-400 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: toLeftPercent(myPos.valence),
              top: toTopPercent(myPos.energy),
            }}
          />
        </div>

        <span className="text-xs text-white/50">😊</span>
      </div>

      <span className="text-xs text-white/50">🧘 Chill</span>
    </div>
  )
}
