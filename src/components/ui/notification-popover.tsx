import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Bell, ArchiveIcon, AlertTriangle, Package, ShoppingBag, Settings, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import { buildSKUForecast } from '../../lib/forecastEngine'
import { cn } from '@/lib/utils'

type TabValue = 'all' | 'unread' | 'archived'

interface AppNotification {
  id: string
  type: 'exception' | 'order' | 'stock'
  title: string
  subtitle: string
  time: string
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  href: string
  read: boolean
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function useNotifications(): AppNotification[] {
  const { exceptions, orders, products } = useAppStore()
  const { forecasts } = React.useMemo(() => buildSKUForecast(products, orders), [products, orders])

  return React.useMemo(() => {
    const items: AppNotification[] = []

    // Unresolved exceptions
    for (const ex of exceptions.filter(e => e.status === 'UNRESOLVED').slice(0, 8)) {
      items.push({
        id: `ex-${ex.id}`,
        type: 'exception',
        title: ex.title,
        subtitle: ex.description,
        time: timeAgo(ex.created_at),
        severity: ex.severity,
        href: '/exceptions',
        read: false,
      })
    }

    // RTO review pending orders
    for (const o of orders.filter(o => o.rto_review_status === 'PENDING').slice(0, 4)) {
      items.push({
        id: `ord-${o.id}`,
        type: 'order',
        title: `High RTO Risk — ${o.order_number}`,
        subtitle: `RTO score ${o.rto_risk_score}/100 · ${o.payment_method}`,
        time: timeAgo(o.created_at),
        href: '/orders',
        read: false,
      })
    }

    // Low stock / out of stock
    for (const f of forecasts.filter(f => f.status === 'OUT_OF_STOCK' || f.status === 'REORDER_NOW').slice(0, 4)) {
      items.push({
        id: `stock-${f.product_id}`,
        type: 'stock',
        title: f.status === 'OUT_OF_STOCK' ? `Out of Stock — ${f.name}` : `Reorder Now — ${f.name}`,
        subtitle: f.status === 'OUT_OF_STOCK'
          ? 'Zero units · pending orders may fail'
          : `${f.days_of_stock}d of stock · reorder ${f.reorder_quantity} units`,
        time: 'today',
        href: '/products',
        read: f.status === 'REORDER_NOW',
      })
    }

    return items.sort((a, b) => {
      const sev = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      return (sev[a.severity ?? 'LOW'] ?? 3) - (sev[b.severity ?? 'LOW'] ?? 3)
    })
  }, [exceptions, orders, forecasts])
}

function NotificationIcon({ type, severity }: { type: AppNotification['type']; severity?: string }) {
  if (type === 'exception') {
    const color = severity === 'CRITICAL' ? 'text-red-500' : severity === 'HIGH' ? 'text-red-400' : severity === 'MEDIUM' ? 'text-amber-500' : 'text-blue-400'
    return <AlertTriangle size={15} className={color} />
  }
  if (type === 'order') return <ShoppingBag size={15} className="text-amber-500" />
  return <Package size={15} className="text-orange-500" />
}

function SeverityDot({ severity }: { severity?: string }) {
  const color = severity === 'CRITICAL' ? 'bg-red-500' : severity === 'HIGH' ? 'bg-red-400' : severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-blue-400'
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />
}

// ── Tab Panel ──────────────────────────────────────────────────────────────────

function NotificationList({ items, onClose }: { items: AppNotification[]; onClose: () => void }) {
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400 dark:text-gray-600">
        <span className="bg-gray-100 dark:bg-white/5 rounded-full p-3">
          <CheckCircle size={20} />
        </span>
        <span className="text-sm">All caught up</span>
      </div>
    )
  }

  return (
    <ol className="list-none">
      {items.map(n => (
        <li
          key={n.id}
          className="group border-b border-gray-100 dark:border-white/[0.06] last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <button
            onClick={() => { navigate(n.href); onClose() }}
            className="w-full flex items-start gap-3 px-4 py-3 text-left"
          >
            <div className="mt-0.5 shrink-0">
              <NotificationIcon type={n.type} severity={n.severity} />
            </div>
            <div className="flex flex-col flex-1 min-w-0 gap-0.5">
              <div className="flex items-center gap-1.5">
                {n.severity && <SeverityDot severity={n.severity} />}
                <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate">{n.title}</span>
              </div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">{n.subtitle}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">{n.time}</span>
            </div>
            <ArchiveIcon
              size={13}
              className="shrink-0 mt-1 text-gray-300 dark:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </button>
        </li>
      ))}
    </ol>
  )
}

function TabPanel({ tab, notifications, onClose }: { tab: TabValue; notifications: AppNotification[]; onClose: () => void }) {
  if (tab === 'unread') {
    return <NotificationList items={notifications.filter(n => !n.read)} onClose={onClose} />
  }
  if (tab === 'archived') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400 dark:text-gray-600">
        <span className="bg-gray-100 dark:bg-white/5 rounded-full p-3">
          <ArchiveIcon size={20} />
        </span>
        <span className="text-sm">No archived notifications</span>
      </div>
    )
  }
  return <NotificationList items={notifications} onClose={onClose} />
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function NotificationPopover() {
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState<TabValue>('all')
  const notifications = useNotifications()
  const unreadCount = notifications.filter(n => !n.read).length
  const navigate = useNavigate()

  const handleClose = () => setOpen(false)

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors focus:outline-none"
          aria-label="Notifications"
        >
          <Bell size={18} className={unreadCount > 0 ? 'animate-bell-ring' : undefined} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 pointer-events-none">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
            </span>
          )}
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          className={cn(
            'z-50 w-96 rounded-xl border border-gray-100 dark:border-transparent',
            'bg-white dark:bg-[#1E2840] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),_0_8px_32px_rgba(0,0,0,0.6)]',
            'outline-none overflow-hidden flex flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2',
          )}
          style={{ maxHeight: '480px' }}
        >
          {/* Header tabs */}
          <div className="flex items-center justify-between h-11 border-b border-gray-100 dark:border-white/[0.06] px-1 shrink-0">
            <div className="flex h-full">
              {(['all', 'unread', 'archived'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'px-3 h-full text-[13px] capitalize relative transition-colors',
                    tab === t
                      ? 'text-gray-900 dark:text-white font-medium'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {t}
                  {t === 'unread' && unreadCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-medium bg-red-500 text-white rounded-full">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  {tab === t && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gray-900 dark:bg-white rounded-full" />
                  )}
                </button>
              ))}
            </div>
            <button className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 mr-1 transition-colors">
              <Settings size={14} />
            </button>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <TabPanel tab={tab} notifications={notifications} onClose={handleClose} />
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-gray-100 dark:border-white/[0.06]">
            <button
              onClick={() => { navigate('/exceptions'); handleClose() }}
              className="w-full py-2.5 text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              View all exceptions →
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
