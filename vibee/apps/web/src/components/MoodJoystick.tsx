import { useEffect, useRef, useState } from 'react'
import { mixCornerColor, rgbToCss, MOOD_MAP } from '../lib/moodColor'

interface Props {
  /** Called when user moves joystick. x and y are in [0, 1]. */
  onPositionChange?: (x: number, y: number) => void
  /** Initial joystick position. Defaults to { x: 0.7, y: 0.62 } */
  initialPos?: { x: number; y: number }
}

export function MoodJoystick({ onPositionChange, initialPos = { x: 0.7, y: 0.62 } }: Props) {
  const [joystickPos, setJoystickPos] = useState(initialPos)
  const [isDragging, setIsDragging] = useState(false)
  const [selectionConfirmed, setSelectionConfirmed] = useState(false)
  const [selectionDirty, setSelectionDirty] = useState(false)
  const [audioLevel, setAudioLevel] = useState(1)

  const joystickCardRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<number | null>(null)
  const timeRef = useRef(0)

  useEffect(() => {
    if (!isDragging) {
      setJoystickPos(initialPos)
    }
  }, [initialPos.x, initialPos.y])

  const colorBlend = mixCornerColor(joystickPos.x, joystickPos.y)
  const currentMood = MOOD_MAP[colorBlend.dominant]
  const energyPercent = Math.round((1 - joystickPos.y) * 100)
  const brightnessPercent = Math.round(joystickPos.x * 100)
  const intensityFactor = (joystickPos.x + joystickPos.y) / 2
  const moodDisplayLabel = colorBlend.label

  const accentColor = rgbToCss(colorBlend.rgb)
  const accentColorSoft = rgbToCss(colorBlend.rgb, 0.12)
  const accentColorGlow = rgbToCss(colorBlend.rgb, 0.22)

  // Audio level animation
  useEffect(() => {
    const animate = () => {
      timeRef.current += currentMood.speed
      const noise = Math.sin(timeRef.current * 0.8) * 0.3 + 1.0
      setAudioLevel(noise)
      requestRef.current = requestAnimationFrame(animate)
    }
    requestRef.current = requestAnimationFrame(animate)
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [currentMood])

  const stopDragging = () => setIsDragging(false)

  const handleJoystickMove = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !joystickCardRef.current) return
    const rect = joystickCardRef.current.getBoundingClientRect()
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
    const padding = 24
    const x = Math.max(0, Math.min(1, (clientX - rect.left - padding) / (rect.width - padding * 2)))
    const y = Math.max(0, Math.min(1, (clientY - rect.top - padding) / (rect.height - padding * 2)))
    setJoystickPos({ x, y })
    setSelectionDirty(true)
    setSelectionConfirmed(false)
  }

  const handleConfirm = () => {
    setSelectionConfirmed(true)
    setSelectionDirty(false)
    onPositionChange?.(joystickPos.x, joystickPos.y)
  }

  const selectionPrompt = (() => {
    if (colorBlend.isBlend) {
      const horizontalPrompt = joystickPos.x > 0.5 ? 'plus de relance ?' : 'plus de texture ?'
      const verticalPrompt = joystickPos.y > 0.5 ? 'plus de douceur ?' : 'plus de tension ?'
      return brightnessPercent > energyPercent ? horizontalPrompt : verticalPrompt
    }
    switch (colorBlend.dominant) {
      case 'ambient': return 'plus de texture ?'
      case 'festive': return 'plus de groove ?'
      case 'chill': return 'plus de douceur ?'
      case 'intense': return 'plus de tension ?'
    }
  })()

  return (
    <div
      ref={joystickCardRef}
      className="touch-none select-none rounded-[14px] p-2.5 sm:rounded-[16px] sm:p-3"
      style={{ background: 'linear-gradient(180deg, rgba(20, 22, 25, 0.96) 0%, rgba(15, 17, 19, 0.98) 100%)', borderColor: 'rgba(255,255,255,0.03)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)' }}
      onMouseDown={() => setIsDragging(true)}
      onMouseMove={handleJoystickMove}
      onMouseUp={stopDragging}
      onMouseLeave={stopDragging}
      onTouchStart={() => setIsDragging(true)}
      onTouchMove={handleJoystickMove}
      onTouchEnd={stopDragging}
    >
      <div className="text-left">
        <div className="text-[10px] font-['Manrope'] uppercase tracking-[0.2em] text-white/48 sm:text-[11px] sm:tracking-[0.24em]">mood de la party</div>
        <div
          className="mt-1 font-['Manrope'] normal-case text-white/70 sm:mt-1.5"
          style={{ fontSize: 'clamp(12px, 3.4vw, 14px)' }}
        >
          Déplace le point sur la carte pour choisir ta vibe
        </div>
      </div>

      <div
        className="relative mt-2.5 overflow-hidden rounded-[10px] border sm:mt-3 sm:rounded-[12px]"
        style={{
          height: 'clamp(112px, 17svh, 172px)',
          background: 'linear-gradient(180deg, rgba(11, 13, 15, 0.98) 0%, rgba(9, 10, 12, 1) 100%)',
          borderColor: 'rgba(255,255,255,0.035)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* Background glow at cursor position */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at ${joystickPos.x * 100}% ${joystickPos.y * 100}%, ${accentColorGlow} 0%, transparent 24%),
              linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.005))
            `,
          }}
        />

        {/* Particle field */}
        <div className="absolute inset-0">
          {Array.from({ length: 81 }).map((_, index) => {
            const x = (index % 9) / 8
            const y = Math.floor(index / 9) / 8
            const dx = x - joystickPos.x
            const dy = y - joystickPos.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            const proximity = Math.max(0, 1 - distance / 0.38)
            const pull = proximity * (8 + audioLevel * 4)
            const driftX = Math.sin(timeRef.current * 0.55 + index * 0.7) * 1.4
            const driftY = Math.cos(timeRef.current * 0.45 + index * 0.9) * 1.4
            const attractionX = -dx * pull
            const attractionY = -dy * pull

            return (
              <div
                key={index}
                className="absolute h-[2px] w-[2px] rounded-full transition-all duration-500 sm:h-[3px] sm:w-[3px]"
                style={{
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  backgroundColor: proximity > 0 ? accentColor : 'rgba(255,255,255,0.055)',
                  opacity: 0.18 + proximity * 0.72,
                  transform: `translate(-50%, -50%) translate(${driftX + attractionX}px, ${driftY + attractionY}px) scale(${0.7 + proximity * 1.45})`,
                  boxShadow:
                    proximity > 0.28
                      ? `0 0 ${4 + proximity * 12}px ${rgbToCss(colorBlend.rgb, 0.5)}`
                      : 'none',
                }}
              />
            )
          })}
        </div>

        {/* Crosshair lines */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[1px] w-full bg-white/8" />
          <div className="absolute h-full w-[1px] bg-white/8" />
        </div>

        {/* Corner labels */}
        <div className="absolute left-2 top-2 text-[8px] font-['Manrope'] uppercase tracking-[0.08em] text-white/54 sm:left-3 sm:top-3 sm:text-[9px] sm:tracking-[0.14em]">ambiant</div>
        <div className="absolute right-2 top-2 text-[8px] font-['Manrope'] uppercase tracking-[0.08em] text-white/54 sm:right-3 sm:top-3 sm:text-[9px] sm:tracking-[0.14em]">festif</div>
        <div className="absolute bottom-2 left-2 text-[8px] font-['Manrope'] uppercase tracking-[0.08em] text-white/54 sm:bottom-3 sm:left-3 sm:text-[9px] sm:tracking-[0.14em]">calme</div>
        <div className="absolute bottom-2 right-2 text-[8px] font-['Manrope'] uppercase tracking-[0.08em] text-white/54 sm:bottom-3 sm:right-3 sm:text-[9px] sm:tracking-[0.14em]">intense</div>

        {/* Blob cursor */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${joystickPos.x * 100}%`,
            top: `${joystickPos.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            transition: isDragging ? 'none' : 'all 0.35s cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        >
          <div className="relative">
            <div
              className="absolute inset-0 scale-[2.4] blur-2xl opacity-70"
              style={{
                background: `radial-gradient(circle, ${accentColorSoft} 0%, ${rgbToCss(colorBlend.rgb, 0.05)} 50%, transparent 78%)`,
              }}
            />
            <svg
              viewBox="0 0 100 100"
              className="relative z-10"
              style={{ width: 'clamp(32px, 9.5vw, 54px)', height: 'clamp(32px, 9.5vw, 54px)' }}
            >
              <path
                fill={accentColor}
                d={(() => {
                  const numPoints = 32
                  const radius = 20 + audioLevel * 7
                  const points = []
                  for (let i = 0; i < numPoints; i++) {
                    const angle = (i / numPoints) * Math.PI * 2
                    const beat =
                      Math.sin(timeRef.current * 0.24 + i * 0.9) * (3 + audioLevel * 2.4) +
                      Math.cos(timeRef.current * 0.14 + i * 1.8) * (2.2 + intensityFactor * 1.8)
                    const directionalStretch =
                      Math.cos(angle - timeRef.current * 0.12) * (2 + audioLevel * 1.8)
                    const r = radius + beat + directionalStretch
                    points.push({ x: 50 + Math.cos(angle) * r, y: 50 + Math.sin(angle) * r })
                  }
                  let d = `M ${points[0].x} ${points[0].y}`
                  for (let i = 0; i < numPoints; i++) {
                    const p1 = points[i]
                    const p2 = points[(i + 1) % numPoints]
                    const prev = points[(i - 1 + numPoints) % numPoints]
                    const next = points[(i + 2) % numPoints]
                    const cp1x = p1.x + (p2.x - prev.x) / 6
                    const cp1y = p1.y + (p2.y - prev.y) / 6
                    const cp2x = p2.x - (next.x - p1.x) / 6
                    const cp2y = p2.y - (next.y - p1.y) / 6
                    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
                  }
                  return d
                })()}
              />
              <circle cx="50" cy="50" r="2" fill="white" opacity="0.55" />
            </svg>
          </div>
        </div>
      </div>

      {/* Confirm button */}
      <button
        type="button"
        onClick={handleConfirm}
        className="mt-2 w-full rounded-[10px] border px-3 py-1.5 text-center font-['Manrope'] text-[10px] uppercase tracking-[0.12em] transition-all sm:mt-2.5 sm:rounded-[14px] sm:px-4 sm:py-2 sm:text-[11px]"
        style={{
          borderColor: selectionDirty ? rgbToCss(colorBlend.rgb, 0.42) : 'rgba(255,255,255,0.06)',
          background: selectionDirty
            ? `linear-gradient(135deg, ${rgbToCss(colorBlend.rgb, 0.82)}, ${rgbToCss(colorBlend.rgb, 0.66)})`
            : 'rgba(255,255,255,0.06)',
          color: selectionDirty ? 'white' : 'rgba(255,255,255,0.7)',
          boxShadow: selectionDirty ? 'inset 0 1px 0 rgba(255,255,255,0.18)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {selectionConfirmed ? 'Vibe envoyée' : 'Envoyer mon choix'}
      </button>
    </div>
  )
}
