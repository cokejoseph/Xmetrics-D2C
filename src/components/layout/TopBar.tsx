import { useLocation } from 'react-router-dom'
import GlobalSearch from '../shared/GlobalSearch'
import { NotificationPopover } from '../ui/notification-popover'
import { useAuthStore } from '../../stores/authStore'

const NO_SEARCH_PREFIXES = ['/settings', '/briefs/history']

export default function TopBar() {
  const { pathname } = useLocation()
  const { user } = useAuthStore()
  const showSearch = !NO_SEARCH_PREFIXES.some(p => pathname.startsWith(p))
  const initials = user?.email?.slice(0, 1).toUpperCase() ?? 'U'

  return (
    <header className="h-12 shrink-0 bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-white/[0.08] flex items-center px-5 gap-4 z-10">
      {showSearch && (
        <div className="flex-1 max-w-md">
          <GlobalSearch />
        </div>
      )}

      <div className="flex items-center gap-1 ml-auto">
        <NotificationPopover />
        <div className="ml-1 w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-medium cursor-default">
          {initials}
        </div>
      </div>
    </header>
  )
}
