import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileNav from './MobileNav'
import DemoModeBanner from './DemoModeBanner'
import { DEMO_MODE } from '../../lib/supabase'

export default function AppLayout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-page-bg dark:bg-[#0f0f12] overflow-hidden">
      {/* Sidebar — desktop */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {DEMO_MODE && <DemoModeBanner />}
        <TopBar />

        <main className="flex-1 overflow-y-auto">
          {/* key re-mounts on every route change → triggers animate-page-enter */}
          <div
            key={location.pathname}
            className="max-w-[1400px] mx-auto px-5 py-6 animate-page-enter"
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
