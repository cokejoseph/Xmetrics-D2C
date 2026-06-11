import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import type { SearchResult } from '../../types'

const TYPE_COLORS: Record<string, string> = {
  order: 'bg-blue-100 text-blue-700',
  customer: 'bg-purple-100 text-purple-700',
  product: 'bg-green-100 text-green-700',
  shipment: 'bg-orange-100 text-orange-700',
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { orders, customers, products } = useAppStore()

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    const q = query.toLowerCase()
    const found: SearchResult[] = []

    for (const o of orders) {
      if (found.length >= 8) break
      if (
        o.order_number.toLowerCase().includes(q) ||
        o.customer?.name.toLowerCase().includes(q) ||
        o.customer?.phone.includes(q)
      ) {
        found.push({
          type: 'order',
          id: o.id,
          primary: o.order_number,
          secondary: `${o.customer?.name ?? ''} · ₹${o.gross_amount}`,
          url: `/orders/${o.id}`,
        })
      }
    }

    for (const c of customers) {
      if (found.length >= 8) break
      if (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email?.toLowerCase().includes(q)
      ) {
        found.push({
          type: 'customer',
          id: c.id,
          primary: c.name,
          secondary: `${c.phone} · ${c.city}`,
          url: `/customers/${c.id}`,
        })
      }
    }

    for (const p of products) {
      if (found.length >= 8) break
      if (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) {
        found.push({
          type: 'product',
          id: p.id,
          primary: p.name,
          secondary: `SKU: ${p.sku} · ₹${p.selling_price}`,
          url: `/products`,
        })
      }
    }

    for (const o of orders) {
      if (found.length >= 8) break
      for (const s of o.shipments ?? []) {
        if (
          s.awb_number.toLowerCase().includes(q) ||
          (s.tracking_number ?? '').toLowerCase().includes(q)
        ) {
          found.push({
            type: 'shipment',
            id: s.id,
            primary: `AWB: ${s.awb_number}`,
            secondary: `${o.order_number} · ${s.courier}`,
            url: `/orders/${o.id}`,
          })
        }
      }
    }

    setResults(found.slice(0, 8))
    setOpen(found.length > 0)
  }, [query, orders, customers, products])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuery('')
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleSelect = (result: SearchResult) => {
    navigate(result.url)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
          open || query ? 'bg-white border-brand-600/30 ring-2 ring-brand-600/10' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search orders, customers, products…"
          className="flex-1 bg-transparent outline-none placeholder-gray-400 text-gray-700"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false) }}
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-dropdown border border-gray-100 py-1 z-50 animate-dropdown-in">
          {results.map(result => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelect(result)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left transition-colors"
            >
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${TYPE_COLORS[result.type]}`}>
                {result.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{result.primary}</p>
                <p className="text-xs text-gray-500 truncate">{result.secondary}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
