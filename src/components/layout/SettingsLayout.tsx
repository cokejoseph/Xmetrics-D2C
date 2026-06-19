import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
  { to: '/settings/brand',        label: 'Brand' },
  { to: '/settings/integrations', label: 'Integrations' },
  { to: '/settings/warehouses',   label: 'Warehouses' },
  { to: '/settings/team',         label: 'Team' },
  { to: '/settings/billing',      label: 'Billing' },
]

export default function SettingsLayout() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="text-xs text-gray-400 mt-0.5">Manage your brand, team, and integrations</p>
      </div>

      <div className="flex gap-8">
        <nav className="w-40 shrink-0">
          <div className="space-y-0.5">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  isActive
                    ? 'block px-3 py-2 text-sm font-medium text-brand-600 bg-brand-50 rounded-lg'
                    : 'block px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors'
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
