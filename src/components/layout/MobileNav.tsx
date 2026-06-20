import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ShoppingBag, Truck, AlertTriangle, BarChart3 } from 'lucide-react'

const NAV = [
  { to: '/dashboard',  icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { to: '/orders',     icon: <ShoppingBag size={20} />,     label: 'Orders' },
  { to: '/fulfillment',icon: <Truck size={20} />,           label: 'Fulfill' },
  { to: '/exceptions', icon: <AlertTriangle size={20} />,   label: 'Alerts' },
  { to: '/analytics',  icon: <BarChart3 size={20} />,       label: 'Analytics' },
]

export default function MobileNav() {
  return (
    <nav
      className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#080D14] border-t border-gray-100 dark:border-white/[0.05] z-20"
      aria-label="Mobile navigation"
      role="navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors min-h-[44px] justify-center ${
              isActive
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300'
            }`
          }
          aria-label={item.label}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
