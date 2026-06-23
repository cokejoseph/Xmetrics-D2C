import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { supabase, DEMO_MODE } from '../../lib/supabase'
import { Button, Input } from '../../components/ui'
import AuthShell from './AuthShell'

export default function ResetPassword() {
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [done, setDone]                     = useState(false)
  const [sessionReady, setSessionReady]     = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase injects the recovery token into the URL hash after the user
    // clicks the reset link. The SDK fires PASSWORD_RECOVERY when it detects it.
    if (DEMO_MODE || !supabase) {
      setSessionReady(true)
      return
    }

    // Fire the handler for any PASSWORD_RECOVERY event the SDK emits
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true)
    })

    // Also handle the case where the user lands with a session already in place
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setError('')
    setLoading(true)

    try {
      if (DEMO_MODE || !supabase) {
        await new Promise(r => setTimeout(r, 800))
        setDone(true)
        return
      }
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={24} className="text-green-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Password updated</h1>
          <p className="text-gray-500 text-sm mb-6">
            Your password has been changed. Sign in with your new password.
          </p>
          <Button className="w-full" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Set new password</h1>
      <p className="text-gray-500 text-sm mb-6">Choose a strong password for your account.</p>

      {!sessionReady ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-gray-500">Verifying reset link…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              autoFocus
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm Password
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat your new password"
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !password || !confirmPassword}
          >
            {loading ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
