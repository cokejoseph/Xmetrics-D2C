import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { Button, Input } from '../../components/ui'
import AuthShell from './AuthShell'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const { signIn } = useAuthStore()
  const navigate = useNavigate()

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Enter your email address above.'); return }
    setError('')
    setResetLoading(true)
    try {
      if (DEMO_MODE || !supabase) {
        setResetSent(true)
        return
      }
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) throw err
      setResetSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email.')
    } finally {
      setResetLoading(false)
    }
  }

  if (forgotMode) {
    return (
      <AuthShell>
        {resetSent ? (
          <div className="text-center">
            <div className="w-14 h-14 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={24} className="text-brand-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h1>
            <p className="text-gray-500 text-sm mb-4">
              If <span className="font-medium text-gray-700">{email}</span> is registered, you'll receive a password reset link shortly.
            </p>
            <button
              onClick={() => { setForgotMode(false); setResetSent(false) }}
              className="text-sm text-brand-600 hover:underline"
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Reset password</h1>
            <p className="text-gray-500 text-sm mb-6">Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </form>
            <button
              onClick={() => { setForgotMode(false); setError('') }}
              className="mt-4 block w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to sign in
            </button>
          </>
        )}
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h1>
      <p className="text-gray-500 text-sm mb-6">Sign in to your Xmetrics account</p>

      <form onSubmit={handleSubmit} className="form-field-group space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoFocus
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <button
              type="button"
              onClick={() => { setForgotMode(true); setError('') }}
              className="text-xs text-brand-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>
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
        {DEMO_MODE && (
          <p className="text-xs text-center text-gray-400 mt-1">
            Demo mode · sign in with any credentials
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        No account?{' '}
        <Link to="/signup" className="text-brand-600 font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  )
}
