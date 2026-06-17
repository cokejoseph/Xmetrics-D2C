import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    const N = 68
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.22 * dpr,
      vy: (Math.random() - 0.5) * 0.22 * dpr,
      r: (Math.random() * 1.6 + 0.6) * dpr,
    }))
    const LINK = 150 * dpr

    let raf = 0
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      }
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d = Math.hypot(dx, dy)
          if (d < LINK) {
            ctx.strokeStyle = `rgba(147,197,253,${(1 - d / LINK) * 0.35})`
            ctx.lineWidth = 0.7 * dpr
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.stroke()
          }
        }
      }
      ctx.fillStyle = 'rgba(186,230,253,0.8)'
      for (const p of pts) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-80 pointer-events-none" />
}

export default function AuthShell({
  children,
  width = 'max-w-sm',
}: {
  children: React.ReactNode
  width?: string
}) {
  return (
    <div className="min-h-screen bg-brand-gradient flex items-center justify-center p-4 relative overflow-hidden">
      <ParticleField />
      {/* aurora glow orbs */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] bg-brand-500/30 rounded-full blur-3xl animate-aurora" />
      <div className="absolute -bottom-40 -right-32 w-[460px] h-[460px] bg-sky-500/25 rounded-full blur-3xl animate-aurora-2" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />

      <div className={`relative w-full ${width}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8 animate-fade-in-up">
          <img src="/logo-light.svg" alt="Xmetrics" className="w-10 h-10 object-contain" />
          <span className="text-white font-semibold text-2xl">Xmetrics</span>
        </div>

        {/* Card with soft glow */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="absolute -inset-3 bg-brand-500/20 blur-2xl rounded-3xl" />
          <div className="relative bg-white rounded-2xl p-8 shadow-2xl border border-white/20">
            {children}
          </div>
        </div>

        {/* Back to website */}
        <div className="mt-6 text-center animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <Link to="/" className="text-white/60 hover:text-white text-sm transition-colors">
            ← Back to website
          </Link>
        </div>
      </div>
    </div>
  )
}
