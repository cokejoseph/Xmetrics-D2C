import { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, Truck, CreditCard,
  AlertTriangle, Package, Users, BarChart3, Settings,
  History, LogOut, RotateCcw, X, Scale, ClipboardList,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'
import { ThemeToggle } from '../ui/theme-toggle'
import { buildSKUForecast } from '../../lib/forecastEngine'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { orders, exceptions, products, currentBrand, cleanup } = useAppStore()
  const { user, signOut } = useAuthStore()
  const { dark, toggle } = useThemeStore()
  const navigate = useNavigate()

  const ordersBadge = orders.filter(o => o.rto_review_status === 'PENDING').length
  const exceptionsBadge = exceptions.filter(e => e.status === 'UNRESOLVED').length

  const { summary: forecastSummary } = useMemo(
    () => buildSKUForecast(products, orders),
    [products, orders]
  )
  const analyticsBadge = forecastSummary.reorder_now_count + forecastSummary.out_of_stock_count
  const analyticsBadgeTitle = [
    forecastSummary.out_of_stock_count > 0 && `${forecastSummary.out_of_stock_count} out of stock`,
    forecastSummary.reorder_now_count > 0 && `${forecastSummary.reorder_now_count} need reorder`,
  ].filter(Boolean).join(', ')

  const handleSignOut = async () => {
    cleanup()
    await signOut()
    navigate('/login')
  }

  const handleNavClick = () => {
    if (onClose) onClose()
  }

  const userEmail = user?.email ?? 'demo@xmetrics.app'
  const userName = userEmail.split('@')[0]
  const userInitial = userName[0]?.toUpperCase() ?? 'U'

  return (
    <aside
      className={[
        'flex w-[220px] shrink-0 flex-col h-screen bg-white dark:bg-[#080D14]',
        'border-r border-gray-100 dark:border-white/[0.05]',
        // Mobile: fixed overlay, toggled by isOpen
        'fixed md:relative inset-y-0 left-0 z-40',
        'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        'md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
      aria-label="Main navigation"
      role="navigation"
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center overflow-hidden shadow-sm">
            <img src="/logo.svg" alt="Xmetrics" className="w-5 h-5 object-contain brightness-0 invert" />
          </div>
          <span className="text-gray-900 dark:text-white font-semibold text-[15px] tracking-tight">Xmetrics</span>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>
      </div>

      {/* Brand indicator */}
      {currentBrand && (
        <div className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
          <p className="text-gray-800 dark:text-white text-xs font-medium truncate" title={currentBrand.name}>{currentBrand.name}</p>
          <p className="text-gray-400 dark:text-gray-500 text-[10px] mt-0.5">{currentBrand.market_type}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto" aria-label="Application">

        {/* Daily workflow */}
        <div className="space-y-0.5">
          <SidebarItem to="/briefs/history"  icon={<History size={15} />}       label="Brief"       onClick={handleNavClick} />
          <SidebarItem to="/orders"          icon={<ShoppingBag size={15} />}   label="Orders"      badge={ordersBadge} badgeTitle={`${ordersBadge} orders pending review`} onClick={handleNavClick} />
          <SidebarItem to="/fulfillment"     icon={<Truck size={15} />}         label="Fulfillment" onClick={handleNavClick} />
          <SidebarItem to="/exceptions"      icon={<AlertTriangle size={15} />} label="Exceptions"  badge={exceptionsBadge} badgeDanger badgeTitle={`${exceptionsBadge} unresolved exceptions`} onClick={handleNavClick} />
          <SidebarItem to="/returns"         icon={<RotateCcw size={15} />}     label="Returns"     onClick={handleNavClick} />
          <SidebarItem to="/payments"        icon={<CreditCard size={15} />}    label="Payments"    onClick={handleNavClick} />
          <SidebarItem to="/reconciliation" icon={<Scale size={15} />}          label="Reconcile"   onClick={handleNavClick} />
          <SidebarItem to="/analytics"       icon={<BarChart3 size={15} />}     label="Analytics"   badge={analyticsBadge} badgeTitle={analyticsBadgeTitle || `${analyticsBadge} items need attention`} onClick={handleNavClick} />
        </div>

        {/* Reference */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.05] space-y-0.5">
          <SidebarItem to="/dashboard"   icon={<LayoutDashboard size={15} />} label="Dashboard" onClick={handleNavClick} />
          <SidebarItem to="/customers"   icon={<Users size={15} />}           label="Customers" onClick={handleNavClick} />
          <SidebarItem to="/products"    icon={<Package size={15} />}         label="Products"  onClick={handleNavClick} />
          <SidebarItem to="/audit-log"   icon={<ClipboardList size={15} />}   label="Audit Log" onClick={handleNavClick} />
        </div>

        {/* Settings */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.05] space-y-0.5">
          <SidebarItem to="/settings/brand" icon={<Settings size={15} />} label="Settings" onClick={handleNavClick} />
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
          aria-label="Sign out of your account"
        >
          <LogOut size={15} aria-hidden="true" />
          <span>Sign Out</span>
        </button>

        {/* User */}
        <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-default">
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-[11px] font-semibold shrink-0" aria-hidden="true">
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
  to, icon, label, badge, badgeDanger, badgeTitle, onClick,
}: {
  to: string
  icon: React.ReactNode
  label: string
  badge?: number
  badgeDanger?: boolean
  badgeTitle?: string
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
      aria-label={badge && badge > 0 ? `${label} — ${badgeTitle ?? `${badge} items`}` : label}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 ? (
        <span
          title={badgeTitle}
          aria-label={badgeTitle}
          className={`text-[10px] font-semibold tabular-nums min-w-[16px] text-center ${
            badgeDanger ? 'text-red-500' : 'text-brand-500 dark:text-brand-400'
          }`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </NavLink>
  )
}
