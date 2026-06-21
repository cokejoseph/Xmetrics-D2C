import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { Button, Input } from '../../components/ui'
import AuthShell from './AuthShell'

export default function Signup() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const { signUp } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const plan = searchParams.get('plan')
    if (plan) sessionStorage.setItem('xmetrics-pending-plan', plan)
    const founding = searchParams.get('founding')
    if (founding) sessionStorage.setItem('xmetrics-founding', 'true')
    else sessionStorage.removeItem('xmetrics-founding')
    const { error: err } = await signUp(email, password)
    setLoading(false)
    if (err === 'CHECK_EMAIL') {
      setEmailSent(true)
      return
    }
    if (err) {
      setError(err)
    } else {
      navigate('/onboarding')
    }
  }

  if (emailSent) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="w-14 h-14 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={24} className="text-brand-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 text-sm mb-4">
            We sent a confirmation link to <span className="font-medium text-gray-700">{email}</span>.
            Click it to activate your account, then{' '}
            <Link to="/login" className="text-brand-600 hover:underline">sign in</Link>.
          </p>
          <p className="text-xs text-gray-400">
            Didn't receive it? Check your spam folder or{' '}
            <button
              onClick={() => setEmailSent(false)}
              className="text-brand-600 hover:underline"
            >
              try again
            </button>.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Create account</h1>
      <p className="text-gray-500 text-sm mb-6">Start managing your D2C operations with Xmetrics</p>

      <form onSubmit={handleSubmit} className="form-field-group space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Work email</label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" minLength={8} required />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  )
}
