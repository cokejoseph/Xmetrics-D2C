import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-page-bg dark:bg-[#0f0f12] flex items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="text-6xl font-bold text-gray-300 dark:text-gray-700 mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Page not found
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition"
        >
          <Home size={16} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
