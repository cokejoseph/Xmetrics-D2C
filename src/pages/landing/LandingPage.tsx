import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingDown, Zap, MessageSquare,
  Check, ChevronDown, ArrowRight, Shield, Clock, X as XIcon,
  Truck, ShoppingCart, AlertTriangle, BarChart2, Users,
  RotateCcw, TrendingUp,
} from 'lucide-react'

// ─── Scroll-triggered fade-in wrapper ────────────────────────────────────────
function AnimateIn({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.08 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`${className} ${visible ? 'animate-fade-in-up' : 'opacity-0'}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}

// ─── Scroll progress bar ──────────────────────────────────────────────────────
function ScrollProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const max = el.scrollHeight - el.clientHeight
      setProgress(max > 0 ? (el.scrollTop / max) * 100 : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div
      className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-brand-500 via-sky-400 to-brand-400 transition-[width] duration-75"
      style={{ width: `${progress}%` }}
    />
  )
}

// ─── Spotlight card ───────────────────────────────────────────────────────────
function SpotlightCard({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <div className={`spotlight-card ${className}`} onMouseMove={handleMove}>
      {children}
    </div>
  )
}

// ─── Word-by-word reveal ──────────────────────────────────────────────────────
function RevealWords({ text, baseDelay = 0 }: { text: string; baseDelay?: number }) {
  const words = text.split(' ')
  return (
    <>
      {words.map((word, i) => (
        <span key={i} className="word-reveal-wrap" style={{ marginRight: i < words.length - 1 ? '0.28em' : 0 }}>
          <span className="word-reveal" style={{ animationDelay: `${baseDelay + i * 75}ms` }}>
            {word}
          </span>
        </span>
      ))}
    </>
  )
}

// ─── Typewriter — cycles through phrases ─────────────────────────────────────
function TypeWriter({ phrases }: { phrases: string[] }) {
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = phrases[phraseIdx]
    const delay = deleting ? 38 : charIdx === current.length ? 2200 : 68
    const t = setTimeout(() => {
      if (!deleting && charIdx < current.length) {
        setCharIdx(c => c + 1)
      } else if (!deleting && charIdx === current.length) {
        setDeleting(true)
      } else if (deleting && charIdx > 0) {
        setCharIdx(c => c - 1)
      } else {
        setDeleting(false)
        setPhraseIdx(i => (i + 1) % phrases.length)
      }
    }, delay)
    return () => clearTimeout(t)
  }, [charIdx, deleting, phraseIdx, phrases])

  return (
    <span className="text-brand-300">
      {phrases[phraseIdx].slice(0, charIdx)}
      <span className="animate-cursor-blink text-white/60">|</span>
    </span>
  )
}

// ─── Particle network — dark hero backdrop ────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => { canvas.width = canvas.offsetWidth * dpr; canvas.height = canvas.offsetHeight * dpr }
    resize()
    window.addEventListener('resize', resize)
    const N = 68
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.22 * dpr, vy: (Math.random() - 0.5) * 0.22 * dpr,
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
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const d = Math.hypot(dx, dy)
          if (d < LINK) {
            ctx.strokeStyle = `rgba(147,197,253,${(1 - d / LINK) * 0.35})`
            ctx.lineWidth = 0.7 * dpr
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke()
          }
        }
      }
      ctx.fillStyle = 'rgba(186,230,253,0.8)'
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill() }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-80 pointer-events-none" />
}

function ParticleFieldLight() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => { canvas.width = canvas.offsetWidth * dpr; canvas.height = canvas.offsetHeight * dpr }
    resize()
    window.addEventListener('resize', resize)
    const N = 22
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.12 * dpr, vy: (Math.random() - 0.5) * 0.12 * dpr,
      r: (Math.random() * 1.1 + 0.4) * dpr,
    }))
    const LINK = 110 * dpr
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
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const d = Math.hypot(dx, dy)
          if (d < LINK) {
            ctx.strokeStyle = `rgba(37,99,235,${(1 - d / LINK) * 0.08})`
            ctx.lineWidth = 0.5 * dpr
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke()
          }
        }
      }
      ctx.fillStyle = 'rgba(37,99,235,0.18)'
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill() }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" />
}

// ─── Magnetic CTA ─────────────────────────────────────────────────────────────
function MagneticLink({ to, className = '', children }: { to: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
    el.style.transform = `translate(${dx * 0.22}px, ${dy * 0.35}px)`
  }
  const onLeave = () => { if (ref.current) ref.current.style.transform = '' }
  return (
    <Link ref={ref} to={to} onMouseMove={onMove} onMouseLeave={onLeave}
      className={`btn-shine ${className}`}
      style={{ transition: 'transform 0.18s ease-out, box-shadow 0.2s ease' }}>
      {children}
    </Link>
  )
}


// ─── Hero dashboard mockup ────────────────────────────────────────────────────
const ORDER_POOL = [
  { id: '#3412', name: 'Ananya S.', city: 'Bengaluru', amount: '₹1,249', method: 'UPI',  score: 12, verdict: 'SHIP'   },
  { id: '#3411', name: 'Rahul M.', city: 'Patna',     amount: '₹2,899', method: 'COD',  score: 78, verdict: 'HOLD'   },
  { id: '#3410', name: 'Priya K.', city: 'Mumbai',    amount: '₹849',   method: 'Card', score: 8,  verdict: 'SHIP'   },
  { id: '#3409', name: 'Vikram T.',city: 'Indore',    amount: '₹1,599', method: 'COD',  score: 46, verdict: 'VERIFY' },
  { id: '#3408', name: 'Meera J.', city: 'Jaipur',   amount: '₹2,149', method: 'COD',  score: 64, verdict: 'HOLD'   },
  { id: '#3407', name: 'Arjun N.', city: 'Kochi',    amount: '₹999',   method: 'UPI',  score: 11, verdict: 'SHIP'   },
  { id: '#3406', name: 'Divya R.', city: 'Hyderabad',amount: '₹1,749', method: 'Card', score: 18, verdict: 'SHIP'   },
] as const

const VERDICT_STYLE: Record<string, string> = {
  SHIP: 'bg-green-50 text-green-600 border-green-100',
  VERIFY: 'bg-amber-50 text-amber-600 border-amber-100',
  HOLD: 'bg-red-50 text-red-600 border-red-100',
}
function scoreColor(s: number) { return s >= 60 ? 'bg-red-400' : s >= 35 ? 'bg-amber-400' : 'bg-green-400' }

const CHANNEL_BARS = [
  { label: 'Shopify',   pct: 58, color: 'bg-brand-500' },
  { label: 'WhatsApp',  pct: 27, color: 'bg-green-500' },
  { label: 'Manual',    pct: 15, color: 'bg-amber-400' },
]

function HeroMockup() {
  const cardRef = useRef<HTMLDivElement>(null)
  const [revenue, setRevenue]       = useState(84320)
  const [rtoTenths, setRtoTenths]   = useState(112)   // 112 = 11.2%
  const [exceptions, setExceptions] = useState(3)
  const [feedIdx, setFeedIdx]       = useState(0)

  useEffect(() => {
    const t1 = setInterval(() => setRevenue(r => r > 98500 ? 84320 : r + 120 + Math.floor(Math.random() * 740)), 2600)
    const t2 = setInterval(() => setFeedIdx(i => i + 1), 3400)
    const t3 = setInterval(() => {
      setRtoTenths(r => {
        const delta = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 4) + 1)
        return Math.max(80, Math.min(140, r + delta))
      })
    }, 3800)
    const t4 = setInterval(() => setExceptions(([2, 3, 3, 4, 3, 2])[Math.floor(Math.random() * 6)]), 5500)
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); clearInterval(t4) }
  }, [])

  const feed = Array.from({ length: 3 }, (_, k) => ORDER_POOL[(feedIdx + k) % ORDER_POOL.length])
  const rtoDisplay = (rtoTenths / 10).toFixed(1) + '%'

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current; if (!card) return
    const r = e.currentTarget.getBoundingClientRect()
    const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5
    card.style.transform = `rotateX(${4 - dy * 6}deg) rotateY(${dx * 6}deg)`
  }
  const handleLeave = () => { if (cardRef.current) cardRef.current.style.transform = 'rotateX(4deg)' }

  return (
    <div className="relative max-w-3xl mx-auto animate-float-slow" style={{ perspective: '1200px' }}
      onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <div className="absolute -inset-6 bg-brand-500/25 blur-3xl rounded-full" />
      <div ref={cardRef}
        className="relative rounded-2xl shadow-2xl p-[1.5px] text-left animate-border-pan bg-[linear-gradient(120deg,rgba(96,165,250,0.55),rgba(255,255,255,0.3),rgba(14,165,233,0.65),rgba(96,165,250,0.55))]"
        style={{ transform: 'rotateX(4deg)', transition: 'transform 0.15s ease-out' }}>
        <div className="bg-white rounded-[14.5px] overflow-hidden">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <div className="ml-3 flex-1 max-w-xs bg-white border border-gray-100 rounded-md px-3 py-1 text-[10px] text-gray-400">
              app.xmetrics.in/dashboard
            </div>
          </div>

          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-5 gap-4">
            {/* Left column */}
            <div className="sm:col-span-3 space-y-3">

              {/* KPI row — all three now animate */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                  <p className="text-[9px] text-gray-400 font-medium mb-0.5 truncate">Revenue Today</p>
                  <p className="text-sm font-bold text-gray-900">
                    <span key={revenue} className="animate-tick-flash">₹{revenue.toLocaleString('en-IN')}</span>
                  </p>
                  <p className="text-[9px] font-semibold text-green-500">+12.4%</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                  <p className="text-[9px] text-gray-400 font-medium mb-0.5 truncate">RTO Rate</p>
                  <p className="text-sm font-bold text-gray-900">
                    <span key={rtoTenths} className="animate-tick-flash">{rtoDisplay}</span>
                  </p>
                  <p className="text-[9px] font-semibold text-brand-500">
                    {rtoTenths <= 105 ? '↓ improving' : '−8.1%'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                  <p className="text-[9px] text-gray-400 font-medium mb-0.5 truncate">Exceptions</p>
                  <p className="text-sm font-bold text-gray-900">
                    <span key={exceptions} className="animate-tick-flash">{exceptions}</span>
                  </p>
                  <p className="text-[9px] font-semibold text-brand-500">
                    {exceptions > 3 ? `${exceptions - 3} new` : exceptions < 3 ? 'clearing' : '2 new'}
                  </p>
                </div>
              </div>

              {/* Revenue area chart */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-gray-600">Revenue — 14 days</p>
                  <span className="flex items-center gap-1 text-[9px] text-green-500 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" /> Live
                  </span>
                </div>
                <svg viewBox="0 0 300 72" className="w-full h-[72px]" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="heroChartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path className="animate-chart-fill"
                    d="M0,56 C25,52 40,44 60,46 C85,48 95,34 120,36 C145,38 155,26 180,24 C205,22 215,30 240,20 C262,12 280,10 300,6 L300,72 L0,72 Z"
                    fill="url(#heroChartFill)" />
                  <path className="animate-draw-line"
                    d="M0,56 C25,52 40,44 60,46 C85,48 95,34 120,36 C145,38 155,26 180,24 C205,22 215,30 240,20 C262,12 280,10 300,6"
                    fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                  {/* Axis labels */}
                  {['Day 1','','','Day 7','','','Day 14'].map((l, i) => l ? (
                    <text key={i} x={i * 50} y={70} fontSize="6" fill="#9CA3AF" textAnchor="middle">{l}</text>
                  ) : null)}
                </svg>
              </div>

              {/* Channel split — fills the empty bottom space */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] font-semibold text-gray-600 mb-2">Channel split — today</p>
                <div className="space-y-1.5">
                  {CHANNEL_BARS.map((ch, i) => (
                    <div key={ch.label} className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-400 w-14 shrink-0">{ch.label}</span>
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${ch.color} rounded-full animate-score-fill`}
                          style={{ width: `${ch.pct}%`, animationDelay: `${900 + i * 200}ms` }} />
                      </div>
                      <span className="text-[9px] text-gray-500 font-semibold w-7 text-right">{ch.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column — incoming orders */}
            <div className="sm:col-span-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-600 mb-2.5">Incoming Orders · RTO Score</p>
              <div className="space-y-2">
                {feed.map((o, i) => (
                  <div key={o.id} className="bg-white rounded-lg border border-gray-100 p-2 animate-slide-in-row"
                    style={{ animationDelay: i === 0 && feedIdx > 0 ? '0ms' : `${800 + i * 250}ms` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-gray-900">{o.name}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${VERDICT_STYLE[o.verdict]}`}>{o.verdict}</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-gray-400 mb-1.5">
                      <span>{o.city} · {o.method}</span>
                      <span className="font-medium text-gray-600">{o.amount}</span>
                    </div>
                    <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full animate-score-fill ${scoreColor(o.score)}`}
                        style={{ width: `${o.score}%`, animationDelay: i === 0 && feedIdx > 0 ? '150ms' : `${1000 + i * 250}ms` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges — top corners, outside the card on wider viewports */}
      <div className="hidden lg:flex absolute -left-44 top-14 items-center gap-2 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 animate-float">
        <Shield size={14} className="text-green-500" />
        <span className="text-[11px] font-semibold text-gray-700">RTO blocked — ₹2,899 saved</span>
      </div>
      <div className="hidden lg:flex absolute -right-44 top-24 items-center gap-2 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 animate-float" style={{ animationDelay: '1.5s' }}>
        <MessageSquare size={14} className="text-brand-500" />
        <span className="text-[11px] font-semibold text-gray-700">Daily brief sent · 7:00 AM</span>
      </div>
    </div>
  )
}

// ─── RTO live demo ────────────────────────────────────────────────────────────
const DEMO_ORDERS = [
  { name: 'Rohan Gupta', city: 'Gurugram, 122001', amount: '₹3,499', method: 'COD', score: 81, verdict: 'HOLD' as const, factors: ['Pincode RTO rate 28%', 'COD above brand AOV ×2.1', 'First-time customer'] },
  { name: 'Sneha Iyer', city: 'Chennai, 600041', amount: '₹1,199', method: 'UPI', score: 9, verdict: 'SHIP' as const, factors: ['Prepaid order', '3 successful deliveries', 'Pincode RTO rate 4%'] },
  { name: 'Amit Verma', city: 'Lucknow, 226010', amount: '₹1,899', method: 'COD', score: 48, verdict: 'VERIFY' as const, factors: ['COD order', 'Pincode RTO rate 16%', 'Address quality: medium'] },
]
const VERDICT_BIG: Record<string, { bg: string; label: string }> = {
  SHIP: { bg: 'bg-green-500', label: 'Ship it' },
  VERIFY: { bg: 'bg-amber-500', label: 'Verify first' },
  HOLD: { bg: 'bg-red-500', label: 'Hold order' },
}

function RtoDemo() {
  const [idx, setIdx] = useState(0)
  const order = DEMO_ORDERS[idx]
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % DEMO_ORDERS.length), 3600)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="relative max-w-md mx-auto">
      <div className="absolute -inset-4 bg-brand-500/15 blur-2xl rounded-full" />
      <div className="relative bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" /> Scoring live
          </span>
          <span className="text-[10px] text-gray-300 font-medium">{idx + 1} / {DEMO_ORDERS.length}</span>
        </div>
        <div key={idx} className="animate-fade-in">
          <div className="flex items-start justify-between mb-4">
            <div><p className="font-semibold text-gray-900 text-sm">{order.name}</p><p className="text-xs text-gray-400">{order.city}</p></div>
            <div className="text-right"><p className="font-bold text-gray-900 text-sm">{order.amount}</p><p className="text-xs text-gray-400">{order.method}</p></div>
          </div>
          <div className="mb-1.5 flex items-end justify-between">
            <span className="text-xs font-medium text-gray-500">RTO Risk Score</span>
            <span className="text-2xl font-bold text-gray-900">{order.score}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
            <div className={`h-full rounded-full animate-score-fill ${scoreColor(order.score)}`} style={{ width: `${order.score}%` }} />
          </div>
          <ul className="space-y-1.5 mb-5">
            {order.factors.map((f, i) => (
              <li key={f} className="flex items-center gap-2 text-xs text-gray-500 animate-slide-in-row" style={{ animationDelay: `${200 + i * 150}ms` }}>
                <span className="w-1 h-1 rounded-full bg-brand-400 shrink-0" />{f}
              </li>
            ))}
          </ul>
          <div className={`${VERDICT_BIG[order.verdict].bg} text-white text-center text-sm font-bold py-2.5 rounded-xl`}>
            {VERDICT_BIG[order.verdict].label}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Announcement banner ──────────────────────────────────────────────────────
function AnnouncementBar({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="relative bg-gradient-to-r from-[#1a1a35] via-brand-900 to-[#1a1a35] text-white text-xs py-2.5 px-4 text-center flex items-center justify-center gap-2 z-[60]">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 announce-dot" />
      <span className="text-white/80">
        <span className="font-semibold text-white">Founding access</span>
        {' — '}<span className="font-semibold text-amber-300">₹2,999/mo for life</span>
        {' · '}<span className="font-semibold text-white">Only 5 spots left</span>
        <Link to="/checkout?plan=GROWTH" className="ml-2 underline underline-offset-2 font-semibold text-brand-300 hover:text-white transition-colors">
          Claim spot →
        </Link>
      </span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss announcement"
        className="absolute right-4 text-white/40 hover:text-white transition-colors"
      >
        <XIcon size={13} />
      </button>
    </div>
  )
}


// ─── Features — bento grid ────────────────────────────────────────────────────
function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-white relative overflow-hidden">
      <ParticleFieldLight />
      <div className="max-w-5xl mx-auto px-6 relative">
        <AnimateIn className="mb-14">
          <span className="text-[11px] font-bold uppercase tracking-widest text-brand-500">Platform</span>
          <h2 className="text-4xl font-bold text-gray-900 mt-3 mb-4 max-w-lg leading-tight">Everything your ops team needs</h2>
          <p className="text-gray-500 max-w-lg text-[15px] leading-relaxed">
            From the moment an order lands to the rupee that settles — one dashboard, seven modules.
          </p>
        </AnimateIn>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* RTO Intelligence — large dark hero card spanning 2 cols */}
          <AnimateIn className="md:col-span-2" delay={0}>
            <SpotlightCard className="bento-glow group relative h-full bg-gradient-to-br from-gray-950 via-brand-950 to-gray-950 text-white border border-white/5 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
              <div className="absolute -top-16 -right-16 w-56 h-56 bg-brand-500/20 rounded-full blur-3xl group-hover:bg-brand-500/30 transition-colors duration-500" />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mb-4 shadow-lg shadow-brand-600/30">
                  <Shield size={20} className="text-white" />
                </div>
                <h3 className="font-bold text-white text-lg mb-2">Real-time RTO Intelligence</h3>
                <p className="text-white/50 text-sm leading-relaxed max-w-md mb-5">
                  Every order scored 0–100 the instant it lands — pincode history, COD patterns,
                  address quality, and customer track record fused into one Ship / Verify / Hold verdict.
                </p>
                <div className="flex items-center gap-3">
                  {[
                    { label: 'Ship', color: 'from-green-400 to-green-500', w: 'w-2/3' },
                    { label: 'Verify', color: 'from-amber-400 to-amber-500', w: 'w-1/3' },
                    { label: 'Hold', color: 'from-red-400 to-red-500', w: 'w-1/4' },
                  ].map(b => (
                    <div key={b.label} className="flex-1">
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${b.color} ${b.w} rounded-full`} />
                      </div>
                      <span className="text-[10px] text-white/40 font-medium mt-1 block">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SpotlightCard>
          </AnimateIn>

          {/* Daily Brief — accent gradient card */}
          <AnimateIn delay={80}>
            <SpotlightCard className="bento-glow group h-full bg-gradient-to-br from-brand-600 to-brand-800 text-white border border-brand-500/30 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 shadow-[0_8px_30px_rgba(37,99,235,0.25)] hover:shadow-[0_12px_44px_rgba(37,99,235,0.4)]">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center mb-4">
                <MessageSquare size={20} className="text-white" />
              </div>
              <h3 className="font-bold text-white text-lg mb-2">8-minute Daily Brief</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Revenue, true profit, RTO health, and your action list — delivered to WhatsApp at 7 AM.
                Two hours of reporting, compressed into eight minutes.
              </p>
            </SpotlightCard>
          </AnimateIn>

          {/* Returns — blue tint */}
          <AnimateIn delay={120}>
            <SpotlightCard className="group h-full bg-sky-50/60 border border-sky-100 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 hover:border-sky-200 hover:bg-sky-50 hover:shadow-card">
              <div className="w-11 h-11 rounded-xl bg-brand-100 border border-brand-200/60 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <RotateCcw size={20} className="text-brand-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">Returns &amp; Refunds</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Eligibility checks, fraud flags, Shiprocket reverse pickup, and one-click Razorpay
                refunds — the full return lifecycle, automated end to end.
              </p>
            </SpotlightCard>
          </AnimateIn>

          {/* Exceptions — amber tint */}
          <AnimateIn delay={160}>
            <SpotlightCard className="group h-full bg-amber-50/60 border border-amber-100 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 hover:border-amber-200 hover:bg-amber-50 hover:shadow-card">
              <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-200/60 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">Exception Radar</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Stuck shipments, failed payments, NDR escalations, low stock — caught and queued
                before your customer ever notices.
              </p>
            </SpotlightCard>
          </AnimateIn>

          {/* Demand Forecast — green tint */}
          <AnimateIn delay={200}>
            <SpotlightCard className="group h-full bg-green-50/60 border border-green-100 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 hover:border-green-200 hover:bg-green-50 hover:shadow-card">
              <div className="w-11 h-11 rounded-xl bg-green-100 border border-green-200/60 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp size={20} className="text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">Demand Forecast</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Per-SKU velocity and stockout dates from your last 30 days of sales —
                reorder before you run dry, never sit on dead stock.
              </p>
            </SpotlightCard>
          </AnimateIn>

          {/* Fulfillment — wide bottom card */}
          <AnimateIn className="md:col-span-3" delay={240}>
            <SpotlightCard className="bento-glow bg-gray-950 text-white border border-white/5 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                    <Truck size={20} className="text-sky-400" />
                  </div>
                  <h3 className="font-bold text-white text-lg mb-2">Fulfillment Workflow — 7 stages</h3>
                  <p className="text-white/50 text-sm leading-relaxed max-w-xl">
                    From Packed → Dispatched → In Transit → Delivered. Bulk AWB generation, pickup scheduling,
                    tracking updates, and COD reconciliation — all in one linear workflow.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap md:flex-col md:items-end shrink-0">
                  {['Bulk AWB generation', 'Pickup scheduling', 'COD reconciliation', 'NDR management'].map(tag => (
                    <span key={tag} className="text-[10px] font-semibold bg-white/8 border border-white/10 text-white/60 px-2.5 py-1 rounded-full whitespace-nowrap">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </SpotlightCard>
          </AnimateIn>
        </div>
      </div>
    </section>
  )
}

// ─── Comparison table ─────────────────────────────────────────────────────────
const COMPARE_ROWS: { feature: string; legacy: string | false; xm: string | true }[] = [
  { feature: 'Unified order view',        legacy: false,              xm: true },
  { feature: 'Real-time RTO scoring',     legacy: false,              xm: true },
  { feature: 'Exception detection',       legacy: 'Manual',           xm: true },
  { feature: 'Returns & refund automation', legacy: false,            xm: true },
  { feature: 'Daily ops brief',           legacy: '2–3 hours',        xm: '8 min' },
  { feature: '7-stage fulfillment',       legacy: 'Shiprocket only',  xm: true },
  { feature: 'Demand forecasting',        legacy: false,              xm: true },
  { feature: 'Payment reconciliation',    legacy: 'Excel',            xm: true },
  { feature: 'WhatsApp integration',      legacy: false,              xm: true },
  { feature: 'Pincode intelligence',      legacy: false,              xm: true },
]

function ComparisonTable() {
  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-3xl mx-auto px-6">
        <AnimateIn className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Your current stack vs Xmetrics</h2>
          <p className="text-gray-500">Stop context-switching. Every ops signal, one place.</p>
        </AnimateIn>

        <AnimateIn delay={100}>
          <div className="rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200">
            {/* Header */}
            <div className="grid grid-cols-3 bg-gray-950">
              <div className="px-6 py-5">
                <span className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Feature</span>
              </div>
              <div className="px-4 py-5 border-l border-white/[0.06] text-center">
                <span className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Your current stack</span>
              </div>
              <div className="px-4 py-5 border-l border-white/[0.06] text-center bg-brand-600/20">
                <span className="text-[11px] font-bold text-brand-300 uppercase tracking-widest">Xmetrics</span>
              </div>
            </div>

            {/* Rows */}
            {COMPARE_ROWS.map((row, i) => (
              <div key={row.feature}
                className={`group grid grid-cols-3 items-center bg-white ${i < COMPARE_ROWS.length - 1 ? 'border-b border-gray-100' : ''} hover:bg-gray-50/70 transition-colors`}>
                {/* Feature */}
                <div className="px-6 py-4 border-r border-gray-100">
                  <span className="text-sm font-semibold text-gray-800 inline-block transition-transform duration-200 group-hover:translate-x-1">{row.feature}</span>
                </div>
                {/* Legacy column */}
                <div className="px-4 py-4 border-r border-gray-100 flex items-center justify-center">
                  {row.legacy === false ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-50 border border-red-100">
                      <XIcon size={13} className="text-red-500" strokeWidth={2.5} />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                      {row.legacy}
                    </span>
                  )}
                </div>
                {/* Xmetrics column */}
                <div className="px-4 py-4 flex items-center justify-center bg-green-50/40">
                  {row.xm === true ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 border border-green-200 transition-transform duration-200 group-hover:scale-110 group-hover:bg-green-200">
                      <Check size={13} className="text-green-600" strokeWidth={2.5} />
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-bold text-green-700 bg-green-100 border border-green-200 rounded-full px-3 py-1 transition-transform duration-200 group-hover:scale-105">
                      {row.xm}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Footer CTA row */}
            <div className="grid grid-cols-3 bg-gray-50 border-t border-gray-100">
              <div className="px-6 py-4" />
              <div className="px-4 py-4 border-l border-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-400 font-medium">Multiple tools</span>
              </div>
              <div className="px-4 py-4 border-l border-gray-100 flex items-center justify-center bg-green-50/60">
                <Link to="/signup" className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors">
                  Get started →
                </Link>
              </div>
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  )
}

// ─── FAQ item ─────────────────────────────────────────────────────────────────
const FAQS = [
  { q: 'Do you offer a free trial?', a: "Yes — use the live demo to explore the full app with real-looking data before signing up. Founding customers also get a 14-day window after signup to test with their own store data before being charged." },
  { q: 'Can I cancel anytime?', a: 'Absolutely. No lock-ins, no cancellation fees. You can cancel your subscription at any time from the Billing settings page. Your data remains accessible for 30 days after cancellation.' },
  { q: 'When do I get access?', a: "Founding customers get access within 48 hours. You'll get a dedicated onboarding call to sync your Shopify store and Shiprocket account. Full training included." },
  { q: 'Which platforms do you integrate with?', a: 'Xmetrics connects with Shopify (orders + products), Shiprocket (fulfillment + tracking), Razorpay (payments + settlements), and WhatsApp Business (alerts + daily brief). More integrations are on the roadmap.' },
  { q: 'Is my data safe?', a: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We are hosted on Supabase (AWS Mumbai), with row-level security ensuring each brand can only access its own data. We never share or sell your data.' },
  { q: 'How does the RTO scoring actually work?', a: 'Xmetrics analyses pincode delivery history, address quality, phone signal strength, COD patterns, and customer history. Each order gets a risk score (0–100) that maps to Ship (green), Verify (yellow), or Hold (red). This happens instantly on order creation.' },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden cursor-pointer bg-white hover:border-gray-200 transition-colors"
      onClick={() => setOpen(o => !o)}>
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <span className="font-medium text-gray-900 text-sm">{q}</span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </div>
      <div className={`overflow-hidden border-t border-gray-50 ${open ? 'accordion-enter' : 'accordion-exit'}`}
        style={{ maxHeight: open ? '500px' : '0px', transition: 'max-height 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <div className="px-6 py-5 text-sm text-gray-600 leading-relaxed">{a}</div>
      </div>
    </div>
  )
}


// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const [showAnnouncement, setShowAnnouncement] = useState(true)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const html = document.documentElement
    const wasDark = html.classList.contains('dark')
    html.classList.remove('dark')
    return () => { if (wasDark) html.classList.add('dark') }
  }, [])

  const annHeight = showAnnouncement ? 36 : 0

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── ANNOUNCEMENT BAR — fixed at very top ─────────────────────── */}
      {showAnnouncement && (
        <div className="fixed top-0 inset-x-0 z-[61]">
          <AnnouncementBar onDismiss={() => setShowAnnouncement(false)} />
        </div>
      )}

      {/* ── NAVBAR — transparent → frosted glass on scroll ─────────────── */}
      <nav
        className={`fixed inset-x-0 z-50 h-16 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md border-b border-gray-100/80 shadow-[0_1px_12px_rgba(0,0,0,0.06)]'
            : 'bg-transparent border-b border-transparent'
        }`}
        style={{ top: annHeight }}
      >
        {scrolled && <ScrollProgress />}
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm overflow-hidden p-0.5">
              <img src="/logo.svg" alt="Xmetrics" className="w-full h-full object-contain" />
            </div>
            <span className={`font-semibold text-lg transition-colors duration-300 ${scrolled ? 'text-gray-900' : 'text-white'}`}>
              Xmetrics
            </span>
          </div>
          <div className={`hidden md:flex items-center gap-8 text-sm transition-colors duration-300 ${scrolled ? 'text-gray-500' : 'text-white/75'}`}>
            {['#features', '#pricing', '#faq'].map((href, i) => (
              <a key={href} href={href}
                className={`transition-colors ${scrolled ? 'hover:text-gray-900' : 'hover:text-white'}`}>
                {['Features', 'Pricing', 'FAQ'][i]}
              </a>
            ))}
            <Link to="/login" className={`transition-colors ${scrolled ? 'hover:text-gray-900' : 'hover:text-white'}`}>
              Sign In
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className={`md:hidden text-sm font-medium transition-colors ${scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white'}`}>
              Sign In
            </Link>
            <Link to="/checkout"
              className={`text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200 hover:-translate-y-px ${
                scrolled
                  ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
                  : 'bg-white/15 text-white border border-white/30 hover:bg-white/25 backdrop-blur-sm'
              }`}>
              Get Started →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section
        className="pb-20 bg-brand-gradient text-white relative overflow-hidden"
        style={{ paddingTop: `${annHeight + 96}px` }}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          e.currentTarget.style.setProperty('--hx', `${e.clientX - r.left}px`)
          e.currentTarget.style.setProperty('--hy', `${e.clientY - r.top}px`)
        }}
      >
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] bg-brand-500/30 rounded-full blur-3xl animate-aurora" />
        <div className="absolute top-1/3 -right-40 w-[520px] h-[520px] bg-sky-500/25 rounded-full blur-3xl animate-aurora-2" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <ParticleField />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(620px circle at var(--hx, 50%) var(--hy, 35%), rgba(96,165,250,0.14), transparent 65%)' }} />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-medium mb-8 animate-fade-in-up backdrop-blur"
            style={{ animationDelay: '0ms' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" />
            Built for Indian D2C brands
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.15] tracking-tight mb-4">
            <RevealWords text="Every order. Every rupee." baseDelay={80} />
            <br />
            <span className="bg-gradient-to-r from-brand-300 via-white to-sky-300 bg-clip-text text-transparent animate-shimmer-text animate-fade-in-up"
              style={{ animationDelay: '400ms' }}>
              One command centre.
            </span>
          </h1>

          {/* Typewriter subtitle */}
          <p className="text-xl text-white/60 mb-3 animate-fade-in-up font-medium tracking-tight" style={{ animationDelay: '500ms' }}>
            Stop losing revenue to{' '}
            <TypeWriter phrases={['RTO returns.', 'missed exceptions.', 'tab switching.', 'manual reconciliation.', 'delayed ops reviews.']} />
          </p>

          <p className="text-base text-white/50 max-w-xl mx-auto mb-10 leading-relaxed animate-fade-in-up" style={{ animationDelay: '160ms' }}>
            Xmetrics scores every order in real time, flags exceptions before customers complain,
            and compresses your daily ops review into 8 minutes.
          </p>

          <div className="flex items-center justify-center mb-6 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
            <MagneticLink to="/signup"
              className="flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-50 shadow-lg hover:shadow-xl text-sm">
              Start Free Trial <ArrowRight size={16} />
            </MagneticLink>
          </div>

          <p className="mb-14 text-white/35 text-xs animate-fade-in" style={{ animationDelay: '360ms' }}>
            No credit card required
          </p>

          <div className="animate-fade-in-up" style={{ animationDelay: '320ms' }}>
            <HeroMockup />
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
      </section>

      {/* ── STATS TICKER ───────────────────────────────────────────────── */}
      {(() => {
        const stats = [
          { value: '35%',    label: 'Avg RTO reduction' },
          { value: '₹2.4L',  label: 'Saved per 1,000 orders' },
          { value: '99.9%',  label: 'Platform uptime' },
          { value: '7',      label: 'Modules' },
          { value: '10 min', label: 'Daily ops review' },
          { value: '1',      label: 'Dashboard for\nyour full ops stack' },
        ]
        return (
          <section className="relative bg-gray-950 text-white py-10 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />
            <div className="absolute left-0 inset-y-0 w-28 bg-gradient-to-r from-gray-950 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 inset-y-0 w-28 bg-gradient-to-l from-gray-950 to-transparent z-10 pointer-events-none" />
            <div className="animate-ticker">
              {[...stats, ...stats].map((s, i) => (
                <div key={i} className="flex items-center shrink-0">
                  <div className="px-16 text-center">
                    <p className="text-3xl font-bold text-brand-400 mb-1 tracking-tight">{s.value}</p>
                    <p className="text-sm text-gray-400 whitespace-pre-line">{s.label}</p>
                  </div>
                  <div className="w-px h-10 bg-white/10 shrink-0" />
                </div>
              ))}
            </div>
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />
          </section>
        )
      })()}


      {/* ── PROBLEM ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <AnimateIn className="mb-14">
            <span className="text-[11px] font-bold uppercase tracking-widest text-red-400">The problem</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-3 mb-4 max-w-2xl leading-tight">Running a D2C brand<br />on 6 different tabs?</h2>
            <p className="text-gray-500 max-w-lg leading-relaxed text-[15px]">
              Most brands stitch together Shopify, Shiprocket, Razorpay, WhatsApp, and Excel.
              It works — until a high-RTO order ships and nobody finds out for three days.
            </p>
          </AnimateIn>

          {/* Hero pain card */}
          <AnimateIn className="mb-4">
            <div className="relative bg-brand-gradient rounded-2xl p-8 overflow-hidden hover:-translate-y-1 transition-all duration-300 border border-white/[0.08] shadow-[0_8px_32px_rgba(37,99,235,0.3)] hover:shadow-[0_16px_48px_rgba(37,99,235,0.45)]">
              <div className="absolute inset-0 rounded-2xl pointer-events-none" />
              <span className="absolute right-6 top-3 text-[110px] font-black text-white/[0.09] select-none leading-none tracking-tight pointer-events-none">40×</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-3 block relative">Tab switching — every day</span>
              <h3 className="text-2xl font-bold text-white mb-3 relative">No unified order view</h3>
              <p className="text-white/45 max-w-lg text-sm leading-relaxed relative">Order status in Shopify. Tracking in Shiprocket. Payment in Razorpay. Your ops team switches context{' '}
                <span className="text-white/75 font-semibold">40 times a day</span> for a single order — and still misses things.</p>
            </div>
          </AnimateIn>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { stat: '25–35%', label: 'avg RTO rate without scoring', icon: <TrendingDown size={15} className="text-orange-400" />, title: 'RTO is pure guesswork', desc: 'No pincode data. No COD pattern scoring. You accept every order and absorb the losses.' },
              { stat: '2+ hrs', label: 'wasted every morning', icon: <Clock size={15} className="text-amber-400" />, title: 'Ops review takes forever', desc: 'Stitching reports, chasing teams on WhatsApp, manually reconciling returns and COD.' },
              { stat: '∞', label: 'alerts you never see', icon: <AlertTriangle size={15} className="text-red-400" />, title: 'Exceptions arrive too late', desc: 'Stuck shipments, NDR escalations, failed payments — found out after the customer complains.' },
            ].map((item, i) => (
              <AnimateIn key={item.title} delay={100 + i * 80}>
                <div className="bg-white border border-gray-200 rounded-2xl p-6 h-full hover:border-brand-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200">
                  <p className="text-3xl font-black text-gray-900 leading-none mb-0.5">{item.stat}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-4">{item.label}</p>
                  <div className="flex items-center gap-1.5 mb-2">
                    {item.icon}
                    <h3 className="font-semibold text-gray-800 text-sm">{item.title}</h3>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <AnimateIn className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Up and running in 10 minutes</h2>
            <p className="text-gray-500">No dev work, no data migration. Just connect and go.</p>
          </AnimateIn>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { step: '01', title: 'Connect your store', desc: 'Link Shopify, Shiprocket, and Razorpay using OAuth. No API keys to manage.', icon: <ShoppingCart size={20} className="text-brand-600" /> },
              { step: '02', title: 'Every order gets scored', desc: 'Xmetrics immediately scores each order for RTO risk and flags exceptions in real time.', icon: <BarChart2 size={20} className="text-brand-600" /> },
              { step: '03', title: 'Run ops in 8 minutes', desc: "Open your daily brief, resolve exceptions, approve fulfillment — and you're done.", icon: <Zap size={20} className="text-brand-600" /> },
            ].map((step, i) => (
              <AnimateIn key={step.step} delay={i * 100} className="relative text-center">
                {/* Oversized watermark step number */}
                <span className="absolute left-1/2 -translate-x-1/2 -top-3 text-[96px] font-black text-gray-900/[0.04] leading-none select-none pointer-events-none">{step.step}</span>
                {i < 2 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px bg-gradient-to-r from-brand-200 via-brand-100 to-transparent" />
                )}
                <div className="relative w-12 h-12 rounded-2xl bg-white border border-brand-100 shadow-sm flex items-center justify-center mx-auto mb-4">{step.icon}</div>
                <div className="relative text-xs font-bold mb-1 bg-gradient-to-r from-brand-600 to-sky-500 bg-clip-text text-transparent">{step.step}</div>
                <h3 className="relative font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="relative text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── RTO LIVE DEMO ──────────────────────────────────────────────── */}
      <section className="py-24 bg-gray-50 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center">
          <AnimateIn>
            <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 rounded-full px-3 py-1 text-xs font-semibold mb-5">
              <Shield size={12} /> RTO Intelligence
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
              Watch an order get scored<br />in real time
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              The moment an order lands, Xmetrics weighs pincode delivery history, COD patterns,
              address quality, and customer track record into a single 0–100 risk score — then
              tells you exactly what to do with it.
            </p>
            <ul className="space-y-3">
              {[
                { icon: <Check size={14} className="text-green-500" />, text: 'Green orders ship automatically — no review needed' },
                { icon: <AlertTriangle size={14} className="text-amber-500" />, text: 'Yellow orders get a WhatsApp confirmation nudge' },
                { icon: <Shield size={14} className="text-red-500" />, text: 'Red orders hold for manual review before dispatch' },
              ].map(item => (
                <li key={item.text} className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center shadow-sm shrink-0">{item.icon}</span>
                  {item.text}
                </li>
              ))}
            </ul>
          </AnimateIn>
          <AnimateIn delay={150}><RtoDemo /></AnimateIn>
        </div>
      </section>

      {/* ── FEATURES BENTO ─────────────────────────────────────────────── */}
      <FeaturesSection />

      {/* ── COMPARISON TABLE ───────────────────────────────────────────── */}
      <ComparisonTable />

      {/* ── PRICING ────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <AnimateIn className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-500">One plan for growing D2C brands. Additional plans available inside the app.</p>
          </AnimateIn>

          <AnimateIn className="max-w-md mx-auto">
            <div className="relative rounded-2xl border border-white/[0.12] bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#1e40af] text-white shadow-[0_24px_64px_rgba(37,99,235,0.45)] p-8 hover:-translate-y-1 transition-transform duration-300">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/[0.04] to-transparent pointer-events-none" />

              {/* Spot badge */}
              <div className="inline-flex items-center gap-2 bg-amber-400/15 border border-amber-400/25 rounded-full px-3 py-1 mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-amber-300">Only 5 spots left</span>
              </div>

              <h3 className="font-bold text-white text-xl mb-1">Growth Plan</h3>
              <p className="text-white/60 text-sm mb-5">Up to 3,000 orders / month</p>

              <div className="flex items-end gap-2 mb-1">
                <span className="text-5xl font-bold text-white">₹2,999</span>
                <span className="text-white/60 mb-1.5">/mo</span>
              </div>
              <p className="text-white/40 text-xs mb-7">Locked for life — price never increases for founders</p>

              <ul className="space-y-3 mb-8">
                {[
                  'Up to 3,000 orders / month',
                  '1 warehouse · 5 team members',
                  'All integrations — Shopify, Shiprocket, WhatsApp, Razorpay',
                  'Real-time RTO scoring & review queue',
                  'Demand forecast & pincode intelligence',
                  'Daily ops briefs with WhatsApp export',
                  'Priority support',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check size={14} className="mt-0.5 shrink-0 text-white/80" />
                    <span className="text-white/75">{f}</span>
                  </li>
                ))}
              </ul>

              <Link to="/checkout?plan=GROWTH"
                className="block text-center text-sm font-bold py-3.5 rounded-xl bg-white text-brand-700 hover:bg-brand-50 transition-colors shadow-lg">
                Claim your founder spot →
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 bg-white relative overflow-hidden">
        <ParticleFieldLight />
        <div className="max-w-2xl mx-auto px-6">
          <AnimateIn className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently asked questions</h2>
            <p className="text-gray-500">
              Still have questions?{' '}
              <a href="mailto:joe@xmetrics.in" className="text-brand-600 hover:underline">Email us</a>
            </p>
          </AnimateIn>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <AnimateIn key={faq.q} delay={i * 60}>
                <FaqItem q={faq.q} a={faq.a} />
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
      <section
        className="py-28 bg-brand-gradient text-white relative overflow-hidden"
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          e.currentTarget.style.setProperty('--hx', `${e.clientX - r.left}px`)
          e.currentTarget.style.setProperty('--hy', `${e.clientY - r.top}px`)
        }}
      >
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] bg-brand-500/30 rounded-full blur-3xl animate-aurora" />
        <div className="absolute top-1/3 -right-40 w-[520px] h-[520px] bg-sky-500/25 rounded-full blur-3xl animate-aurora-2" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <ParticleField />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(620px circle at var(--hx, 50%) var(--hy, 35%), rgba(96,165,250,0.14), transparent 65%)' }} />
        <AnimateIn className="relative max-w-2xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] rounded-full px-4 py-1.5 text-xs text-white/40 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" />
            Founding access open · Limited spots
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            35% fewer RTOs.<br />
            <span className="bg-gradient-to-r from-brand-400 to-sky-400 bg-clip-text text-transparent">
              8 minutes a day. Starting tomorrow.
            </span>
          </h2>
          <p className="text-white/50 mb-10 text-lg leading-relaxed">
            Connect your store in 10 minutes.<br />5 founder spots remaining.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <MagneticLink to="/checkout?plan=GROWTH"
              className="flex items-center gap-2 bg-white text-gray-950 font-semibold px-8 py-3.5 rounded-xl hover:bg-gray-100 shadow-lg hover:shadow-xl text-sm">
              Claim Founder Spot <ArrowRight size={16} />
            </MagneticLink>
            <a href="mailto:joe@xmetrics.in" className="text-white/45 hover:text-white/80 text-sm transition-colors">
              or talk to us →
            </a>
          </div>
        </AnimateIn>
      </section>

      {/* ── SECURITY TRUST STRIP ───────────────────────────────────────── */}
      <div className="bg-gray-950 border-t border-white/[0.05] py-5">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><Shield size={11} className="text-green-500/70" /> TLS 1.3 · AES-256 encryption</span>
          <span className="hidden sm:block w-px h-3 bg-white/10" />
          <span className="flex items-center gap-1.5"><Shield size={11} className="text-green-500/70" /> Per-brand data isolation</span>
          <span className="hidden sm:block w-px h-3 bg-white/10" />
          <span className="flex items-center gap-1.5"><Shield size={11} className="text-green-500/70" /> Hosted on AWS Mumbai</span>
          <span className="hidden sm:block w-px h-3 bg-white/10" />
          <span className="flex items-center gap-1.5"><Shield size={11} className="text-green-500/70" /> Data never shared or sold</span>
        </div>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-white py-14 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm overflow-hidden p-0.5">
                  <img src="/logo.svg" alt="Xmetrics" className="w-full h-full object-contain" />
                </div>
                <span className="font-semibold text-white">Xmetrics</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">
                Operations command centre for Indian D2C brands. RTO intelligence, order management, and daily ops briefs.
              </p>
              <div className="mt-4 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" />
                <span className="text-xs text-gray-500">All systems operational</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-12 gap-y-2 text-sm text-gray-500">
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-3">Product</p>
                <a href="#features" className="block hover:text-white transition-colors">Features</a>
                <a href="#pricing" className="block hover:text-white transition-colors">Pricing</a>
                <a href="#faq" className="block hover:text-white transition-colors">FAQ</a>
              </div>
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-3">Company</p>
                <a href="mailto:joe@xmetrics.in" className="block hover:text-white transition-colors">Contact</a>
              </div>
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-3">Account</p>
                <Link to="/signup" className="block hover:text-white transition-colors">Sign Up</Link>
                <Link to="/login" className="block hover:text-white transition-colors">Sign In</Link>
                <Link to="/login" className="block hover:text-white transition-colors">Demo</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <p>© {new Date().getFullYear()} Xmetrics. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><Users size={11} /> Built for Indian D2C</span>
              <span>·</span>
              <span>TLS 1.3 · AES-256 · AWS Mumbai</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
