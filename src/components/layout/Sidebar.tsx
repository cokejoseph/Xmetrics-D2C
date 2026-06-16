import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, Truck, CreditCard,
  AlertTriangle, Package, Users, BarChart3, Settings,
  History, LogOut, ChevronDown, ChevronRight, Sun, Moon,
} from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'
import { buildSKUForecast } from '../../lib/forecastEngine'

export default function Sidebar() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { orders, exceptions, products, cleanup } = useAppStore()
  const { signOut } = useAuthStore()
  const { dark, toggle } = useThemeStore()
  const navigate = useNavigate()

  const ordersBadge = orders.filter(o => o.rto_review_status === 'PENDING').length
  const exceptionsBadge = exceptions.filter(e => e.status === 'UNRESOLVED').length

  const { summary: forecastSummary } = buildSKUForecast(products, orders)
  const analyticsBadge = forecastSummary.reorder_now_count + forecastSummary.out_of_stock_count

  const handleSignOut = async () => {
    cleanup()          // unsubscribe from realtime channels before sign-out
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="hidden lg:flex w-[220px] shrink-0 flex-col h-screen bg-sidebar-bg border-r border-white/[0.06]">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-[0_2px_8px_rgba(37,99,235,0.4)]">
            <span className="text-white font-bold text-sm">x</span>
          </div>
          <span className="text-white font-semibold text-base tracking-tight">Xmetrics</span>
        </div>
      </div>

      {/* Brand pill */}
      <BrandPill />

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/40">
          Workspace
        </p>

        <SidebarItem to="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
        <SidebarItem to="/orders" icon={<ShoppingBag size={16} />} label="Orders" badge={ordersBadge} />
        <SidebarItem to="/payments" icon={<CreditCard size={16} />} label="Payments" />
        <SidebarItem to="/exceptions" icon={<AlertTriangle size={16} />} label="Exceptions" badge={exceptionsBadge} />
        <SidebarItem to="/fulfillment" icon={<Truck size={16} />} label="Fulfillment" />
        <SidebarItem to="/customers" icon={<Users size={16} />} label="Customers" />
        <SidebarItem to="/products" icon={<Package size={16} />} label="Products" />
        <SidebarItem to="/analytics" icon={<BarChart3 size={16} />} label="Analytics" badge={analyticsBadge} />

        <div className="pt-4">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/40">
            Account
          </p>

          {/* Settings expandable */}
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className="sidebar-nav-item w-full"
          >
            <Settings size={16} />
            <span className="flex-1 text-left">Settings</span>
            {settingsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          {settingsOpen && (
            <div className="ml-7 mt-0.5 space-y-0.5">
              <SubItem to="/settings/brand" label="Brand" />
              <SubItem to="/settings/integrations" label="Integrations" />
              <SubItem to="/settings/warehouses" label="Warehouses" />
              <SubItem to="/settings/team" label="Team" />
              <SubItem to="/settings/billing" label="Billing" />
            </div>
          )}

          <SidebarItem to="/briefs/history" icon={<History size={16} />} label="Brief History" />
        </div>
      </nav>

      {/* Theme toggle + Sign out */}
      <div className="px-2 pb-4 border-t border-white/5 pt-3 space-y-0.5">
        <button
          onClick={toggle}
          className="sidebar-nav-item w-full"
        >
          {dark ? <Moon size={16} /> : <Sun size={16} />}
          <span>{dark ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
        <button
          onClick={handleSignOut}
          className="sidebar-nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}

function BrandPill() {
  const { currentBrand } = useAppStore()
  if (!currentBrand) return null
  return (
    <div className="mx-3 my-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
      <p className="text-white text-sm font-medium truncate">{currentBrand.name}</p>
      <p className="text-sidebar-text text-xs">{currentBrand.market_type}</p>
    </div>
  )
}

function SidebarItem({
  to, icon, label, badge,
}: {
  to: string
  icon: React.ReactNode
  label: string
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `sidebar-nav-item ${isActive ? 'active' : ''}`
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge && badge > 0 ? (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-semibold flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </NavLink>
  )
}

function SubItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          isActive
            ? 'text-white bg-sidebar-active'
            : 'text-sidebar-text hover:text-sidebar-text-active hover:bg-sidebar-hover'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
