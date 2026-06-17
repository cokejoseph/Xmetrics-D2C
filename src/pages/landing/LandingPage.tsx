import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingDown, Zap, MessageSquare,
  Check, ChevronDown, ArrowRight, Shield, Clock, X as XIcon,
  Truck, ShoppingCart, AlertTriangle, BarChart2, Users,
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

// ─── Integration flow SVG ─────────────────────────────────────────────────────
const FLOW_NODES = [
  { x: 95,  y: 64,  label: 'Shopify' },
  { x: 95,  y: 216, label: 'Razorpay' },
  { x: 705, y: 64,  label: 'Shiprocket' },
  { x: 705, y: 216, label: 'WhatsApp' },
]
const FLOW_PATHS = [
  'M150,64 C260,64 290,140 384,140',
  'M150,216 C260,216 290,140 384,140',
  'M650,64 C540,64 510,140 416,140',
  'M650,216 C540,216 510,140 416,140',
]

function IntegrationFlow() {
  return (
    <svg viewBox="0 0 800 280" className="w-full max-w-3xl mx-auto" aria-label="Shopify, Razorpay, Shiprocket and WhatsApp feeding into Xmetrics">
      <defs>
        <linearGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      {FLOW_PATHS.map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke="#DBEAFE" strokeWidth="1.5" />
          <path d={d} fill="none" stroke="#3B82F6" strokeWidth="1.5" opacity="0.65" className="flow-line" />
          <circle r="3.5" fill="#2563EB">
            <animateMotion dur={`${2.4 + i * 0.5}s`} repeatCount="indefinite" path={d} />
          </circle>
        </g>
      ))}
      <circle cx="400" cy="140" r="46" fill="rgba(37,99,235,0.07)">
        <animate attributeName="r" values="46;56;46" dur="3.2s" repeatCount="indefinite" />
      </circle>
      <rect x="368" y="108" width="64" height="64" rx="18" fill="url(#coreGrad)" />
      <text x="400" y="150" textAnchor="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="Inter, sans-serif">xM</text>
      {FLOW_NODES.map(n => (
        <g key={n.label}>
          <rect x={n.x - 55} y={n.y - 18} width="110" height="36" rx="18" fill="white" stroke="#E5E7EB" />
          <text x={n.x} y={n.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="600" fill="#374151" fontFamily="Inter, sans-serif">{n.label}</text>
        </g>
      ))}
    </svg>
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

function HeroMockup() {
  const cardRef = useRef<HTMLDivElement>(null)
  const [revenue, setRevenue] = useState(84320)
  const [feedIdx, setFeedIdx] = useState(0)
  useEffect(() => {
    const t1 = setInterval(() => setRevenue(r => r > 98500 ? 84320 : r + 120 + Math.floor(Math.random() * 740)), 2600)
    const t2 = setInterval(() => setFeedIdx(i => i + 1), 3400)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [])
  const feed = Array.from({ length: 4 }, (_, k) => ORDER_POOL[(feedIdx + k) % ORDER_POOL.length])
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
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <div className="ml-3 flex-1 max-w-xs bg-white border border-gray-100 rounded-md px-3 py-1 text-[10px] text-gray-400">
              app.xmetrics.app/dashboard
            </div>
          </div>
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="sm:col-span-3 space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: 'Revenue Today', value: <span key={revenue} className="animate-tick-flash">₹{revenue.toLocaleString('en-IN')}</span>, delta: '+12.4%', up: true },
                  { label: 'RTO Rate', value: '11.2%' as React.ReactNode, delta: '−8.1%', up: false },
                  { label: 'Exceptions', value: '3' as React.ReactNode, delta: '2 new', up: false },
                ].map(k => (
                  <div key={k.label} className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                    <p className="text-[9px] text-gray-400 font-medium mb-0.5 truncate">{k.label}</p>
                    <p className="text-sm font-bold text-gray-900">{k.value}</p>
                    <p className={`text-[9px] font-semibold ${k.up ? 'text-green-500' : 'text-brand-500'}`}>{k.delta}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-gray-600">Revenue — 14 days</p>
                  <span className="flex items-center gap-1 text-[9px] text-green-500 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" /> Live
                  </span>
                </div>
                <svg viewBox="0 0 300 80" className="w-full h-20" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="heroChartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path className="animate-chart-fill"
                    d="M0,62 C25,58 40,50 60,52 C85,54 95,38 120,40 C145,42 155,30 180,28 C205,26 215,34 240,24 C262,16 280,14 300,10 L300,80 L0,80 Z"
                    fill="url(#heroChartFill)" />
                  <path className="animate-draw-line"
                    d="M0,62 C25,58 40,50 60,52 C85,54 95,38 120,40 C145,42 155,30 180,28 C205,26 215,34 240,24 C262,16 280,14 300,10"
                    fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
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
      <div className="hidden md:flex absolute -left-10 top-16 items-center gap-2 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 animate-float">
        <Shield size={14} className="text-green-500" />
        <span className="text-[11px] font-semibold text-gray-700">RTO blocked — ₹2,899 saved</span>
      </div>
      <div className="hidden md:flex absolute -right-8 bottom-12 items-center gap-2 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 animate-float" style={{ animationDelay: '1.5s' }}>
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
        <span className="font-semibold text-white">Founding access open</span>
        {' — '}Get Growth plan at <span className="font-semibold text-amber-300">₹2,999/mo for life</span>
        {' · '}Only 45 founder spots
        <Link to="/founding" className="ml-2 underline underline-offset-2 font-semibold text-brand-300 hover:text-white transition-colors">
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
    <section id="features" className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <AnimateIn className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything your ops team needs</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            One platform that connects your tools and surfaces the right signal at the right time.
          </p>
        </AnimateIn>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Wide bottom card */}
          <AnimateIn className="md:col-span-3" delay={0}>
            <SpotlightCard className="bento-glow bg-gray-950 text-white border border-white/5 rounded-2xl p-7 transition-all duration-200 hover:-translate-y-1">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
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
const COMPARE_ROWS = [
  { feature: 'Unified order view',        legacy: false,              xm: true },
  { feature: 'Real-time RTO scoring',     legacy: false,              xm: true },
  { feature: 'Exception detection',       legacy: 'Manual',           xm: true },
  { feature: 'Daily ops brief',           legacy: '2–3 hours',        xm: '8 min' },
  { feature: '7-stage fulfillment',       legacy: 'Shiprocket only',  xm: true },
  { feature: 'Demand forecasting',        legacy: false,              xm: true },
  { feature: 'Payment reconciliation',    legacy: 'Excel',            xm: true },
  { feature: 'WhatsApp integration',      legacy: false,              xm: true },
  { feature: 'Pincode intelligence',      legacy: false,              xm: true },
]

function ComparisonTable() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <AnimateIn className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Your current stack vs Xmetrics</h2>
          <p className="text-gray-500">Stop context-switching. Every ops signal, one place.</p>
        </AnimateIn>

        <AnimateIn delay={100}>
          <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-card">
            {/* Header */}
            <div className="grid grid-cols-3 bg-gray-950 px-6 py-4">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">Feature</span>
              <span className="text-xs font-semibold text-white/40 uppercase tracking-widest text-center">6-tab mess</span>
              <span className="text-xs font-bold text-brand-400 uppercase tracking-widest text-center">Xmetrics</span>
            </div>
            {/* Rows */}
            {COMPARE_ROWS.map((row, i) => (
              <div key={row.feature}
                className={`compare-row grid grid-cols-3 px-6 py-3.5 items-center ${i < COMPARE_ROWS.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <span className="text-sm text-gray-700 font-medium">{row.feature}</span>
                <div className="text-center">
                  {row.legacy === false
                    ? <span className="text-gray-200 font-bold text-base">✗</span>
                    : <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2.5 py-0.5 font-medium">{row.legacy}</span>
                  }
                </div>
                <div className="text-center">
                  {row.xm === true
                    ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                        <Check size={11} className="text-green-600" />
                      </span>
                    : <span className="text-xs text-brand-600 bg-brand-50 rounded-full px-2.5 py-0.5 font-semibold">{row.xm}</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </AnimateIn>
      </div>
    </section>
  )
}

// ─── FAQ item ─────────────────────────────────────────────────────────────────
const FAQS = [
  { q: 'How does the RTO scoring actually work?', a: 'Xmetrics analyses pincode delivery history, address quality, phone signal strength, COD patterns, and customer history. Each order gets a risk score (0–100) that maps to Ship (green), Verify (yellow), or Hold (red). This happens instantly on order creation.' },
  { q: 'When do I get access?', a: "Founding customers get access within 48 hours. You'll get a dedicated onboarding call to sync your Shopify store and Shiprocket account. Full training included." },
  { q: 'Which platforms do you integrate with?', a: 'Xmetrics connects with Shopify (orders + products), Shiprocket (fulfillment + tracking), Razorpay (payments + settlements), and WhatsApp Business (alerts + daily brief). More integrations are on the roadmap.' },
  { q: 'Is my data safe?', a: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We are hosted on Supabase (AWS Mumbai), with row-level security ensuring each brand can only access its own data. We never share or sell your data.' },
  { q: 'Can I cancel anytime?', a: 'Absolutely. No lock-ins, no cancellation fees. You can cancel your subscription at any time from the Billing settings page. Your data remains accessible for 30 days after cancellation.' },
  { q: 'Do you offer a free trial?', a: "Yes — use the live demo to explore the full app with real-looking seed data before signing up. When you're ready, the Starter plan gives you 14 days free to try with your own store data." },
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

// ─── Pricing plans ────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Starter', price: '₹2,499', period: '/mo', orders: 'Up to 1,000 orders/mo', highlight: false,
    badge: null,
    features: ['Up to 1,000 orders / month', '1 warehouse', '3 team members', 'All integrations', 'RTO scoring', 'Daily briefs'],
  },
  {
    name: 'Growth', price: '₹4,999', period: '/mo', orders: 'Up to 3,000 orders/mo', highlight: true,
    badge: 'MOST POPULAR',
    features: ['Up to 3,000 orders / month', '3 warehouses', '5 team members', 'Demand forecast', 'Pincode intelligence', 'Priority support'],
  },
  {
    name: 'Scale', price: '₹9,999', period: '/mo', orders: 'Up to 10,000 orders/mo', highlight: false,
    badge: null,
    features: ['Up to 10,000 orders / month', 'Unlimited warehouses', '15 team members', 'Custom RTO rules', 'API access', 'Dedicated CSM'],
  },
]

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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">x</span>
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
            <Link to="/signup"
              className={`text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200 hover:-translate-y-px ${
                scrolled
                  ? 'bg-gray-950 text-white hover:bg-gray-800 shadow-sm'
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

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
            <MagneticLink to="/signup"
              className="flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-50 shadow-lg hover:shadow-xl text-sm">
              Start Free Trial <ArrowRight size={16} />
            </MagneticLink>
          </div>

          <p className="mb-14 text-white/35 text-xs animate-fade-in" style={{ animationDelay: '360ms' }}>
            No credit card required · 14-day free trial · Cancel anytime
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
          { value: '10 min', label: 'Order to Shipping\nrather than 8 hours' },
          { value: '1',      label: 'Dashboard\ninstead of 5 tools' },
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

      {/* ── INTEGRATION FLOW ───────────────────────────────────────────── */}
      <section className="py-14 bg-white border-b border-gray-50">
        <AnimateIn className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-6">Works with your stack</p>
          <IntegrationFlow />
        </AnimateIn>
      </section>

      {/* ── PROBLEM ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <AnimateIn className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Running a D2C brand on 6 different tabs?</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Most brands cobble together Shopify, Shiprocket, Razorpay, WhatsApp, and Excel.
              It works — until it doesn't.
            </p>
          </AnimateIn>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { icon: <ShoppingCart size={20} className="text-red-500" />, title: 'No unified order view', desc: 'Order status lives in Shopify, tracking in Shiprocket, payment in Razorpay. You switch tabs 40 times a day.' },
              { icon: <TrendingDown size={20} className="text-orange-500" />, title: 'RTO decisions are guesswork', desc: 'You accept every COD order and absorb 25–35% returns. No data, no scoring, no way to stop it.' },
              { icon: <AlertTriangle size={20} className="text-amber-500" />, title: 'Exceptions arrive too late', desc: 'Stuck shipments, failed payments, NDR escalations — you find out after the customer complains.' },
              { icon: <Clock size={20} className="text-blue-500" />, title: 'Daily ops take 2+ hours', desc: 'Stitching together reports, chasing teams on WhatsApp, manually reconciling returns and COD.' },
            ].map((item, i) => (
              <AnimateIn key={item.title} delay={i * 80}>
                <SpotlightCard className="flex gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-card transition-all duration-200">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-white border border-gray-100 flex items-center justify-center shadow-sm">{item.icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1 text-sm">{item.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </SpotlightCard>
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

      {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
      <section className="py-24 bg-gray-50">
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
                {i < 2 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px bg-gradient-to-r from-brand-200 via-brand-100 to-transparent" />
                )}
                <div className="w-12 h-12 rounded-2xl bg-white border border-brand-100 shadow-sm flex items-center justify-center mx-auto mb-4">{step.icon}</div>
                <div className="text-xs font-bold mb-1 bg-gradient-to-r from-brand-600 to-sky-500 bg-clip-text text-transparent">{step.step}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ───────────────────────────────────────────── */}
      <ComparisonTable />

      {/* ── PRICING ────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-gray-50 relative overflow-hidden">
        <ParticleFieldLight />
        <div className="max-w-5xl mx-auto px-6">
          <AnimateIn className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-500">Pay based on order volume. Upgrade or downgrade anytime.</p>
          </AnimateIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {PLANS.map((plan, i) => (
              <AnimateIn key={plan.name} delay={i * 100}>
                <div className={`relative rounded-2xl border p-6 flex flex-col h-full hover:-translate-y-1 transition-all duration-200 ${
                  plan.highlight
                    ? 'border-brand-600 bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-[0_12px_40px_rgba(37,99,235,0.35)] hover:shadow-[0_16px_56px_rgba(37,99,235,0.5)]'
                    : 'border-gray-100 bg-white hover:shadow-card-hover'
                }`}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-400 text-gray-900 text-[10px] font-bold rounded-full tracking-wide">
                      {plan.badge}
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className={`font-bold mb-2 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                    <div className="flex items-end gap-1">
                      <span className={`text-3xl font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.price}</span>
                      <span className={`text-sm mb-1 ${plan.highlight ? 'text-white/70' : 'text-gray-400'}`}>{plan.period}</span>
                    </div>
                    <p className={`text-xs mt-1 ${plan.highlight ? 'text-white/60' : 'text-gray-400'}`}>{plan.orders}</p>
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs">
                        <Check size={13} className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-white' : 'text-green-500'}`} />
                        <span className={plan.highlight ? 'text-white/80' : 'text-gray-600'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to={`/signup?plan=${plan.name.toUpperCase()}`} className={`block text-center text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                    plan.highlight ? 'bg-white text-brand-600 hover:bg-brand-50' : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                  }`}>
                    Get Started
                  </Link>
                </div>
              </AnimateIn>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-8">
            All plans include a 14-day free trial. No credit card required.
          </p>
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
              <a href="mailto:hello@xmetrics.app" className="text-brand-600 hover:underline">Email us</a>
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
      <section className="py-28 bg-[#060610] text-white relative overflow-hidden">
        <div className="absolute dark-grid-bg inset-0 opacity-60" />
        <ParticleField />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
        <AnimateIn className="relative max-w-2xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] rounded-full px-4 py-1.5 text-xs text-white/40 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" />
            Founding access open · Limited spots
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Your ops team deserves<br />
            <span className="bg-gradient-to-r from-brand-400 to-sky-400 bg-clip-text text-transparent">
              better tools.
            </span>
          </h2>
          <p className="text-white/50 mb-10 text-lg leading-relaxed">
            Start free. Connect your store in 10 minutes.<br />Run tomorrow's ops in 8.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <MagneticLink to="/signup"
              className="flex items-center gap-2 bg-white text-gray-950 font-semibold px-8 py-3.5 rounded-xl hover:bg-gray-100 shadow-lg hover:shadow-xl text-sm">
              Start Free Trial <ArrowRight size={16} />
            </MagneticLink>
          </div>
        </AnimateIn>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-white py-14 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">x</span>
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
                <a href="mailto:hello@xmetrics.app" className="block hover:text-white transition-colors">Contact</a>
                <a href="mailto:hello@xmetrics.app" className="block hover:text-white transition-colors">Careers</a>
                <a href="mailto:hello@xmetrics.app" className="block hover:text-white transition-colors">Blog</a>
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
