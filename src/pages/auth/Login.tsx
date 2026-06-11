import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useAppStore } from '../../stores/appStore'
import { Button, Input } from '../../components/ui'
import { DEMO_MODE } from '../../lib/supabase'
import AuthShell from './AuthShell'

export default function Login() {
  const [email, setEmail] = useState(DEMO_MODE ? 'demo@zestifyfoods.in' : '')
  const [password, setPassword] = useState(DEMO_MODE ? 'demo123' : '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, loginAsDemo } = useAuthStore()
  const { bootstrap } = useAppStore()
  const navigate = useNavigate()

  const handleDemo = () => {
    loginAsDemo()
    bootstrap('user-demo-001')
    navigate('/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h1>
      <p className="text-gray-500 text-sm mb-6">Sign in to your account</p>

      {DEMO_MODE && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 text-xs">
          Demo mode — credentials pre-filled. Click Sign In to explore.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={handleDemo}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors"
        >
          Try Demo — no account needed →
        </button>
      </div>

      <p className="mt-4 text-center text-sm text-gray-500">
        No account?{' '}
        <Link to="/signup" className="text-brand-600 font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  )
}
