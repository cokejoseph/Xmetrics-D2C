import { NavLink, Outlet } from 'react-router-dom'
import { Building2, Plug, Package, Users, CreditCard } from 'lucide-react'

const NAV = [
  { to: '/settings/brand',        label: 'Brand',        Icon: Building2 },
  { to: '/settings/integrations', label: 'Integrations', Icon: Plug },
  { to: '/settings/warehouses',   label: 'Warehouses',   Icon: Package },
  { to: '/settings/team',         label: 'Team',         Icon: Users },
  { to: '/settings/billing',      label: 'Billing',      Icon: CreditCard },
]

export default function SettingsLayout() {
  return (
    <div className="flex gap-6 min-h-0">
      <nav className="w-44 shrink-0 space-y-0.5">
        <p className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</p>
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
