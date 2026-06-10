import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileNav from './MobileNav'
import DemoModeBanner from './DemoModeBanner'
import { DEMO_MODE } from '../../lib/supabase'

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-page-bg overflow-hidden">
      {/* Sidebar — desktop */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {DEMO_MODE && <DemoModeBanner />}
        <TopBar />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-5 py-6 pb-20 lg:pb-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
