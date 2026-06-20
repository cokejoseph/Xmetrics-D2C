import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, Truck, CreditCard,
  AlertTriangle, Package, Users, BarChart3, Settings,
  History, LogOut, RotateCcw,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'
import { ThemeToggle } from '../ui/theme-toggle'
import { buildSKUForecast } from '../../lib/forecastEngine'

export default function Sidebar() {
  const { orders, exceptions, products, currentBrand, cleanup } = useAppStore()
  const { user, signOut } = useAuthStore()
  const { dark, toggle } = useThemeStore()
  const navigate = useNavigate()

  const ordersBadge = orders.filter(o => o.rto_review_status === 'PENDING').length
  const exceptionsBadge = exceptions.filter(e => e.status === 'UNRESOLVED').length

  const { summary: forecastSummary } = buildSKUForecast(products, orders)
  const analyticsBadge = forecastSummary.reorder_now_count + forecastSummary.out_of_stock_count

  const handleSignOut = async () => {
    cleanup()
    await signOut()
    navigate('/login')
  }

  const userEmail = user?.email ?? 'demo@xmetrics.app'
  const userName = userEmail.split('@')[0]
  const userInitial = userName[0]?.toUpperCase() ?? 'U'

  return (
    <aside className="flex w-[220px] shrink-0 flex-col h-screen bg-white dark:bg-[#080D14] border-r border-gray-100 dark:border-white/[0.05]">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center overflow-hidden shadow-sm">
            <img src="/logo.svg" alt="Xmetrics" className="w-5 h-5 object-contain brightness-0 invert" />
          </div>
          <span className="text-gray-900 dark:text-white font-semibold text-[15px] tracking-tight">Xmetrics</span>
        </div>
      </div>

      {/* Brand indicator */}
      {currentBrand && (
        <div className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
          <p className="text-gray-800 dark:text-white text-xs font-medium truncate">{currentBrand.name}</p>
          <p className="text-gray-400 dark:text-gray-500 text-[10px] mt-0.5">{currentBrand.market_type}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
          Menu
        </p>

        <div className="space-y-0.5">
          <SidebarItem to="/dashboard"   icon={<LayoutDashboard size={15} />} label="Dashboard" />
          <SidebarItem to="/orders"      icon={<ShoppingBag size={15} />}     label="Orders"     badge={ordersBadge} />
          <SidebarItem to="/payments"    icon={<CreditCard size={15} />}      label="Payments" />
          <SidebarItem to="/exceptions"  icon={<AlertTriangle size={15} />}   label="Exceptions" badge={exceptionsBadge} badgeDanger />
          <SidebarItem to="/fulfillment" icon={<Truck size={15} />}           label="Fulfillment" />
          <SidebarItem to="/customers"   icon={<Users size={15} />}           label="Customers" />
          <SidebarItem to="/products"    icon={<Package size={15} />}         label="Products" />
          <SidebarItem to="/analytics"   icon={<BarChart3 size={15} />}       label="Analytics"  badge={analyticsBadge} />
          <SidebarItem to="/returns"     icon={<RotateCcw size={15} />}       label="Returns" />
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.05] space-y-0.5">
          <SidebarItem to="/settings/brand"  icon={<Settings size={15} />} label="Settings" />
          <SidebarItem to="/briefs/history"  icon={<History size={15} />}  label="Brief History" />
        </div>
      </nav>

      {/* Bottom: theme + user */}
      <div className="border-t border-gray-100 dark:border-white/[0.05] px-2 py-3 space-y-1">
        <div className="flex items-center justify-center px-3 py-2">
          <ThemeToggle isDark={dark} onToggle={toggle} />
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer"
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>

        {/* User */}
        <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-default">
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate capitalize">{userName}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 truncate">{userEmail}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function SidebarItem({
  to, icon, label, badge, badgeDanger,
}: {
  to: string
  icon: React.ReactNode
  label: string
  badge?: number
  badgeDanger?: boolean
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 ? (
        <span className={`text-[10px] font-semibold tabular-nums ${badgeDanger ? 'text-red-500' : 'text-gray-400'}`}>
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </NavLink>
  )
}
