import { Bell } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import GlobalSearch from '../shared/GlobalSearch'

const NO_SEARCH_PREFIXES = ['/settings', '/briefs/history']

export default function TopBar() {
  const { exceptions } = useAppStore()
  const unresolved = exceptions.filter(e => e.status === 'UNRESOLVED').length
  const { pathname } = useLocation()
  const showSearch = !NO_SEARCH_PREFIXES.some(p => pathname.startsWith(p))
  return (
    <header className="h-14 shrink-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 flex items-center px-5 gap-4 z-10">
      {/* Search */}
      {showSearch && (
        <div className="flex-1 max-w-md">
          <GlobalSearch />
        </div>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {/* Bell */}
        <Link
          to="/exceptions"
          className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Bell size={18} />
          {unresolved > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
          )}
        </Link>

        {/* Avatar */}
        <div className="ml-1 w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white text-xs font-semibold shadow-[0_2px_8px_rgba(79,70,229,0.35)]">
          R
        </div>
      </div>
    </header>
  )
}
