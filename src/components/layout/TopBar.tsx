import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import GlobalSearch from '../shared/GlobalSearch'
import { NotificationPopover } from '../ui/notification-popover'
import { useAuthStore } from '../../stores/authStore'

const NO_SEARCH_PREFIXES = ['/settings', '/briefs/history']

interface TopBarProps {
  onMenuClick: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { pathname } = useLocation()
  const { user } = useAuthStore()
  const showSearch = !NO_SEARCH_PREFIXES.some(p => pathname.startsWith(p))
  const initials = user?.email?.slice(0, 1).toUpperCase() ?? 'U'

  return (
    <header
      className="h-12 shrink-0 bg-white dark:bg-[#080D14] border-b border-gray-100 dark:border-white/[0.05] flex items-center px-4 gap-3 z-10"
      role="banner"
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        aria-label="Open navigation menu"
        aria-haspopup="true"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {showSearch && (
        <div className="flex-1 max-w-md">
          <GlobalSearch />
        </div>
      )}

      <div className="flex items-center gap-1 ml-auto">
        <NotificationPopover />
        <div
          className="ml-1 w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-medium cursor-default"
          aria-label={`User: ${user?.email ?? 'Demo user'}`}
          role="img"
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
