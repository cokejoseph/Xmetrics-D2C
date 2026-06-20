import { useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileNav from './MobileNav'
import DemoModeBanner from './DemoModeBanner'
import { DEMO_MODE } from '../../lib/supabase'
import { useAppStore } from '../../stores/appStore'

export default function AppLayout() {
  const location = useLocation()
  const { subscription } = useAppStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-page-bg dark:bg-[#0C1118] overflow-hidden">
      {/* Skip navigation for keyboard/screen-reader users */}
      <a href="#main-content" className="skip-nav">Skip to main content</a>

      {/* Sidebar — desktop always visible, mobile as overlay */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {DEMO_MODE && <DemoModeBanner />}
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        {/* Order-limit capacity banner */}
        {subscription?.at_order_limit && (
          <div className="flex-none flex items-center justify-between gap-4 px-5 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
              <span className="text-[12px] text-amber-700 dark:text-amber-400 truncate">
                You've reached your {subscription.plan_type} order limit ({subscription.orders_used?.toLocaleString()} / {subscription.orders_limit?.toLocaleString()}). Upgrade to continue accepting orders.
              </span>
            </div>
            <Link
              to="/settings/billing"
              className="shrink-0 text-[11px] font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded px-2.5 py-1 hover:bg-amber-100 dark:hover:bg-amber-800/30 transition-colors"
            >
              Upgrade Plan
            </Link>
          </div>
        )}

        <main id="main-content" className="flex-1 overflow-y-auto pb-16 md:pb-0" role="main">
          <div
            key={location.pathname}
            className="max-w-[1400px] mx-auto px-4 sm:px-5 py-5 sm:py-6 animate-page-enter"
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
