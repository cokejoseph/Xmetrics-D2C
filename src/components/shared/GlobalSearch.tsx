import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Search, X, User, ShoppingBag, Package, AlertTriangle,
  Truck, ArrowUpRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import type { Customer, Order, Product, Exception } from '../../types'

// ── Types ──────────────────────────────────────────────────────────────────────

type ResultItem =
  | { kind: 'section'; label: string }
  | { kind: 'customer'; data: Customer; meta?: string }
  | { kind: 'order'; data: Order; context?: string }
  | { kind: 'product'; data: Product }
  | { kind: 'exception'; data: Exception }
  | { kind: 'shipment'; orderId: string; awb: string; courier: string; orderNum: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}` }

const CHANNEL_SHORT: Record<string, string> = {
  SHOPIFY: 'Shopify', WHATSAPP: 'WA', MANUAL: 'Manual',
  AMAZON: 'Amazon', FLIPKART: 'Flipkart', WOOCOMMERCE: 'WC', MEESHO: 'Meesho',
}
const STATUS_COLOR: Record<string, string> = {
  DELIVERED: 'text-green-600', CONFIRMED: 'text-blue-600', PROCESSING: 'text-blue-500',
  PACKING: 'text-amber-600', SHIPPED: 'text-sky-600', IN_TRANSIT: 'text-sky-600',
  OUT_FOR_DELIVERY: 'text-violet-600', RTO_INITIATED: 'text-red-500', CANCELLED: 'text-gray-400',
  READY_TO_SHIP: 'text-amber-500',
}
const SEV_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-600', HIGH: 'text-red-500', MEDIUM: 'text-amber-600', LOW: 'text-blue-500',
}
const SEV_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500', HIGH: 'bg-red-400', MEDIUM: 'bg-amber-400', LOW: 'bg-blue-400',
}

// ── Search engine ─────────────────────────────────────────────────────────────

function runSearch(
  q: string,
  orders: Order[],
  customers: Customer[],
  products: Product[],
  exceptions: Exception[],
): ResultItem[] {
  const lq = q.toLowerCase().trim()
  if (lq.length < 2) return []

  const results: ResultItem[] = []

  // 1 ── Customer matches
  const matchedCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(lq) ||
    c.phone.includes(lq) ||
    (c.email ?? '').toLowerCase().includes(lq) ||
    c.city.toLowerCase().includes(lq)
  )
  const matchedCustomerIds = new Set(matchedCustomers.map(c => c.id))

  if (matchedCustomers.length > 0) {
    results.push({ kind: 'section', label: 'Customers' })
    for (const c of matchedCustomers.slice(0, 3)) {
      const orderCount = orders.filter(o => o.customer_id === c.id).length
      results.push({
        kind: 'customer',
        data: c,
        meta: `${orderCount} order${orderCount !== 1 ? 's' : ''} · ${fmt(c.total_spent)} lifetime`,
      })
    }

    // Cross-entity: show their orders
    const customerOrders = orders
      .filter(o => o.customer_id && matchedCustomerIds.has(o.customer_id))
      .slice(0, 4)
    if (customerOrders.length > 0) {
      const label = matchedCustomers.length === 1
        ? `${matchedCustomers[0].name}'s Orders`
        : 'Their Orders'
      results.push({ kind: 'section', label })
      for (const o of customerOrders) {
        results.push({ kind: 'order', data: o })
      }
    }

    // Cross-entity: exceptions linked to their orders
    const customerOrderIds = new Set(
      orders.filter(o => o.customer_id && matchedCustomerIds.has(o.customer_id)).map(o => o.id)
    )
    const customerExceptions = exceptions.filter(e => e.order_id && customerOrderIds.has(e.order_id))
    if (customerExceptions.length > 0) {
      results.push({ kind: 'section', label: 'Related Exceptions' })
      for (const e of customerExceptions.slice(0, 3)) {
        results.push({ kind: 'exception', data: e })
      }
    }
  }

  // 2 ── Order matches (direct — not already shown via customer)
  const shownOrderIds = new Set(
    results.filter(r => r.kind === 'order').map(r => (r as { kind: 'order'; data: Order }).data.id)
  )
  const matchedOrders = orders.filter(o =>
    !shownOrderIds.has(o.id) && (
      o.order_number.toLowerCase().includes(lq) ||
      (o.external_ref ?? '').toLowerCase().includes(lq) ||
      o.customer?.name.toLowerCase().includes(lq) ||
      o.customer?.phone.includes(lq) ||
      o.shipping_address.city?.toLowerCase().includes(lq) ||
      o.shipping_address.pincode?.includes(lq)
    )
  )
  if (matchedOrders.length > 0) {
    results.push({ kind: 'section', label: 'Orders' })
    for (const o of matchedOrders.slice(0, 4)) {
      results.push({ kind: 'order', data: o })
    }

    // Cross-entity: exceptions for these orders
    const directOrderIds = new Set(matchedOrders.slice(0, 4).map(o => o.id))
    const orderExceptions = exceptions.filter(e => e.order_id && directOrderIds.has(e.order_id))
    if (orderExceptions.length > 0) {
      results.push({ kind: 'section', label: 'Exceptions for These Orders' })
      for (const e of orderExceptions.slice(0, 3)) {
        results.push({ kind: 'exception', data: e })
      }
    }

    // Cross-entity: shipments for these orders
    const shipmentItems: ResultItem[] = []
    for (const o of matchedOrders.slice(0, 4)) {
      for (const s of o.shipments ?? []) {
        shipmentItems.push({
          kind: 'shipment',
          orderId: o.id,
          awb: s.awb_number,
          courier: s.courier,
          orderNum: o.order_number,
        })
      }
    }
    if (shipmentItems.length > 0) {
      results.push({ kind: 'section', label: 'Shipments' })
      results.push(...shipmentItems.slice(0, 3))
    }
  }

  // 3 ── Product matches
  const matchedProducts = products.filter(p =>
    p.name.toLowerCase().includes(lq) ||
    p.sku.toLowerCase().includes(lq) ||
    p.category.toLowerCase().includes(lq)
  )
  if (matchedProducts.length > 0) {
    results.push({ kind: 'section', label: 'Products' })
    for (const p of matchedProducts.slice(0, 3)) {
      results.push({ kind: 'product', data: p })
    }

    // Cross-entity: recent orders containing matched products
    const matchedProductIds = new Set(matchedProducts.map(p => p.id))
    const productOrders = orders.filter(o =>
      !shownOrderIds.has(o.id) &&
      o.items?.some(item => item.product_id && matchedProductIds.has(item.product_id))
    )
    if (productOrders.length > 0) {
      const label = matchedProducts.length === 1
        ? `Orders with "${matchedProducts[0].name}"`
        : 'Orders with These Products'
      results.push({ kind: 'section', label })
      for (const o of productOrders.slice(0, 3)) {
        results.push({ kind: 'order', data: o })
      }
    }
  }

  // 4 ── Exception matches (not already shown)
  const shownExIds = new Set(
    results.filter(r => r.kind === 'exception').map(r => (r as { kind: 'exception'; data: Exception }).data.id)
  )
  const matchedExceptions = exceptions.filter(e =>
    !shownExIds.has(e.id) && (
      e.title.toLowerCase().includes(lq) ||
      e.description.toLowerCase().includes(lq) ||
      e.order?.order_number.toLowerCase().includes(lq) ||
      e.type.toLowerCase().includes(lq)
    )
  )
  if (matchedExceptions.length > 0) {
    results.push({ kind: 'section', label: 'Exceptions' })
    for (const e of matchedExceptions.slice(0, 4)) {
      results.push({ kind: 'exception', data: e })
    }
  }

  // 5 ── AWB / shipment matches (not already shown)
  const awbMatches: ResultItem[] = []
  for (const o of orders) {
    for (const s of o.shipments ?? []) {
      if (
        s.awb_number.toLowerCase().includes(lq) ||
        (s.tracking_number ?? '').toLowerCase().includes(lq)
      ) {
        awbMatches.push({
          kind: 'shipment',
          orderId: o.id,
          awb: s.awb_number,
          courier: s.courier,
          orderNum: o.order_number,
        })
      }
    }
  }
  if (awbMatches.length > 0) {
    results.push({ kind: 'section', label: 'Shipments' })
    results.push(...awbMatches.slice(0, 3))
  }

  return results
}

// ── Row renderers ─────────────────────────────────────────────────────────────

function CustomerRow({ data, meta }: { data: Customer; meta?: string }) {
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
        <User size={13} className="text-purple-600 dark:text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{data.name}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{data.phone} · {data.city}, {data.state}</p>
      </div>
      {meta && <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0">{meta}</span>}
      <ArrowUpRight size={12} className="text-gray-300 dark:text-gray-700 shrink-0" />
    </div>
  )
}

function OrderRow({ data }: { data: Order }) {
  const statusLabel = data.fulfillment_status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
        <ShoppingBag size={13} className="text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{data.order_number}</p>
          <span className={`text-[10px] font-medium ${STATUS_COLOR[data.fulfillment_status] ?? 'text-gray-500'}`}>
            {statusLabel}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
          {data.customer?.name ?? data.shipping_address.name ?? '—'} · {fmt(data.gross_amount - data.discount_amount)} · {CHANNEL_SHORT[data.channel] ?? data.channel}
        </p>
      </div>
      <ArrowUpRight size={12} className="text-gray-300 dark:text-gray-700 shrink-0" />
    </div>
  )
}

function ProductRow({ data }: { data: Product }) {
  const stockColor = data.inventory_count === 0 ? 'text-red-500' : data.inventory_count <= data.reorder_threshold ? 'text-amber-500' : 'text-green-600'
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="w-7 h-7 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
        <Package size={13} className="text-green-600 dark:text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{data.name}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
          SKU: {data.sku} · {fmt(data.selling_price)}
        </p>
      </div>
      <span className={`text-[11px] font-medium shrink-0 ${stockColor}`}>
        {data.inventory_count === 0 ? 'Out of stock' : `${data.inventory_count} units`}
      </span>
      <ArrowUpRight size={12} className="text-gray-300 dark:text-gray-700 shrink-0" />
    </div>
  )
}

function ExceptionRow({ data }: { data: Exception }) {
  return (
    <div className="flex items-center gap-3 w-full">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        data.severity === 'CRITICAL' || data.severity === 'HIGH' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
      }`}>
        <AlertTriangle size={13} className={SEV_COLOR[data.severity] ?? 'text-gray-500'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEV_DOT[data.severity] ?? 'bg-gray-400'}`} />
          <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{data.title}</p>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{data.description}</p>
      </div>
      <ArrowUpRight size={12} className="text-gray-300 dark:text-gray-700 shrink-0" />
    </div>
  )
}

function ShipmentRow({ awb, courier, orderNum }: { awb: string; courier: string; orderNum: string }) {
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="w-7 h-7 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
        <Truck size={13} className="text-orange-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">AWB: {awb}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{courier} · {orderNum}</p>
      </div>
      <ArrowUpRight size={12} className="text-gray-300 dark:text-gray-700 shrink-0" />
    </div>
  )
}

// ── Platform detection ────────────────────────────────────────────────────────

const isMac = typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform)

// ── Main component ─────────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { orders, customers, products, exceptions } = useAppStore()

  // 200ms debounce so runSearch doesn't fire on every keystroke
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(id)
  }, [query])

  const allResults = useMemo(
    () => runSearch(debouncedQuery, orders, customers, products, exceptions),
    [debouncedQuery, orders, customers, products, exceptions]
  )

  // Only navigable items (not section headers)
  const navItems = useMemo(
    () => allResults.filter(r => r.kind !== 'section'),
    [allResults]
  )

  const totalNavCount = navItems.length
  const hasResults = totalNavCount > 0

  // Sync the dropdown open-state + reset the highlighted row whenever the query
  // or result set changes. `open` is also toggled imperatively (Escape, blur,
  // select, clear), so it can't be a pure render-derived value.
  useEffect(() => {
    setActiveIdx(-1)
    setOpen(query.length >= 2 && hasResults)
  }, [query, hasResults])

  // Navigate a result to its URL
  const getUrl = useCallback((item: ResultItem): string | null => {
    if (item.kind === 'customer') return `/customers/${item.data.id}`
    if (item.kind === 'order') return `/orders/${item.data.id}`
    if (item.kind === 'product') return `/products`
    if (item.kind === 'exception') return `/exceptions`
    if (item.kind === 'shipment') return `/orders/${item.orderId}`
    return null
  }, [])

  const handleSelect = useCallback((item: ResultItem) => {
    const url = getUrl(item)
    if (url) navigate(url)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }, [getUrl, navigate])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, totalNavCount - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      const item = navItems[activeIdx]
      if (item) handleSelect(item)
    } else if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    }
  }, [open, activeIdx, totalNavCount, navItems, handleSelect])

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Map nav index to position in allResults
  let navCounter = -1

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
        open || query
          ? 'bg-white dark:bg-white/5 border-brand-600/30 ring-2 ring-brand-600/10'
          : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10'
      }`}>
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search orders, customers, products, exceptions…"
          aria-label="Global search — orders, customers, products, exceptions"
          role="combobox"
          aria-expanded={open && hasResults}
          aria-autocomplete="list"
          className="flex-1 bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-600 text-gray-700 dark:text-gray-200 [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button onClick={() => { setQuery(''); setOpen(false) }} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={14} />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10 text-[10px] text-gray-400 dark:text-gray-600 font-mono shrink-0 select-none">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {open && hasResults && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#1E2840] rounded-xl border border-gray-100 dark:border-white/[0.05] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04),_0_12px_40px_rgba(0,0,0,0.65)] z-50 overflow-hidden animate-dropdown-in"
          style={{ maxHeight: '480px', overflowY: 'auto', minWidth: '420px' }}
        >
          {allResults.map((item, i) => {
            if (item.kind === 'section') {
              return (
                <div key={`section-${i}`} className="flex items-center gap-2 px-3 pt-3 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">{item.label}</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.05]" />
                </div>
              )
            }

            navCounter++
            const idx = navCounter
            const isActive = activeIdx === idx

            return (
              <button
                key={`item-${i}`}
                data-idx={idx}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`w-full flex items-center px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'bg-gray-50 dark:bg-white/5'
                    : 'hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                {item.kind === 'customer' && <CustomerRow data={item.data} meta={item.meta} />}
                {item.kind === 'order'    && <OrderRow data={item.data} />}
                {item.kind === 'product'  && <ProductRow data={item.data} />}
                {item.kind === 'exception' && <ExceptionRow data={item.data} />}
                {item.kind === 'shipment' && <ShipmentRow awb={item.awb} courier={item.courier} orderNum={item.orderNum} />}
              </button>
            )
          })}

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-white/[0.06] px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] text-gray-400 dark:text-gray-600">
              {totalNavCount} result{totalNavCount !== 1 ? 's' : ''} for "<span className="text-gray-600 dark:text-gray-400">{query}</span>"
            </span>
            <span className="text-[10px] text-gray-300 dark:text-gray-700 flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/5 font-mono">↑↓</kbd> navigate
              <kbd className="ml-1 px-1 py-0.5 rounded bg-gray-100 dark:bg-white/5 font-mono">↵</kbd> open
              <kbd className="ml-1 px-1 py-0.5 rounded bg-gray-100 dark:bg-white/5 font-mono">esc</kbd> close
            </span>
          </div>
        </div>
      )}

      {/* No results */}
      {open && query.length >= 2 && !hasResults && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#1E2840] rounded-xl border border-gray-100 dark:border-white/[0.05] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04),_0_12px_40px_rgba(0,0,0,0.65)] z-50 px-4 py-8 text-center animate-dropdown-in">
          <p className="text-sm text-gray-500 dark:text-gray-400">No results for "<strong>{query}</strong>"</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Try order number, customer name, SKU, or AWB</p>
        </div>
      )}
    </div>
  )
}
