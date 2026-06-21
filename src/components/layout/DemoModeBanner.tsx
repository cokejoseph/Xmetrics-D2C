import { useState } from 'react'
import { X, FlaskConical } from 'lucide-react'

const DISMISS_KEY = 'xm_demo_banner_dismissed'

export default function DemoModeBanner() {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(DISMISS_KEY) === '1'
  )

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100 text-amber-800 text-xs">
      <FlaskConical size={14} className="shrink-0" />
      <span className="flex-1">
        <strong>Demo mode</strong> — you're viewing sample data (Zestify Foods). To connect real data, add
        <code className="mx-1 px-1 py-0.5 bg-amber-100 rounded">VITE_SUPABASE_URL</code>
        to <code className="px-1 py-0.5 bg-amber-100 rounded">.env.local</code>.
      </span>
      <button onClick={handleDismiss} aria-label="Dismiss demo banner" className="shrink-0 p-0.5 rounded hover:bg-amber-100">
        <X size={12} />
      </button>
    </div>
  )
}
