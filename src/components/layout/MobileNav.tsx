import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ShoppingBag, Truck, AlertTriangle, BarChart3 } from 'lucide-react'

const NAV = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { to: '/orders', icon: <ShoppingBag size={20} />, label: 'Orders' },
  { to: '/fulfillment', icon: <Truck size={20} />, label: 'Fulfillment' },
  { to: '/exceptions', icon: <AlertTriangle size={20} />, label: 'Exceptions' },
  { to: '/analytics', icon: <BarChart3 size={20} />, label: 'Analytics' },
]

export default function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-20 safe-bottom">
      {NAV.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-brand-900' : 'text-gray-400'
            }`
          }
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
