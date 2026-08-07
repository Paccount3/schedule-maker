import { useEffect, useRef } from 'react'

interface ConfettiCelebrationProps {
  trigger: number
  onComplete?: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rotation: number
  spin: number
  color: string
  life: number
  maxLife: number
}

const COLORS = [
  '#34d399',
  '#22c55e',
  '#a3e635',
  '#fbbf24',
  '#f472b6',
  '#60a5fa',
  '#c084fc',
  '#fb7185',
]

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function createParticles(count: number, width: number, height: number): Particle[] {
  const originX = width * 0.5
  const originY = height * 0.35

  return Array.from({ length: count }, () => {
    const angle = randomBetween(-Math.PI, Math.PI)
    const speed = randomBetween(6, 16)
    return {
      x: originX + randomBetween(-40, 40),
      y: originY + randomBetween(-20, 20),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - randomBetween(4, 10),
      w: randomBetween(6, 12),
      h: randomBetween(4, 9),
      rotation: randomBetween(0, Math.PI * 2),
      spin: randomBetween(-0.25, 0.25),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 0,
      maxLife: randomBetween(90, 130),
    }
  })
}

export function ConfettiCelebration({ trigger, onComplete }: ConfettiCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!trigger) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let particles = createParticles(160, window.innerWidth, window.innerHeight)

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles = particles.filter((p) => {
        p.life += 1
        p.vy += 0.18
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.spin

        const alpha = 1 - p.life / p.maxLife
        if (alpha <= 0) return false

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
        return true
      })

      if (particles.length > 0) {
        raf = requestAnimationFrame(tick)
      } else {
        onCompleteRef.current?.()
      }
    }

    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [trigger])

  if (!trigger) return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[200]"
      aria-hidden
    />
  )
}
