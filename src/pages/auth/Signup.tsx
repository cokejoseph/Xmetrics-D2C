import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useAppStore } from '../../stores/appStore'
import { Button, Input } from '../../components/ui'
import AuthShell from './AuthShell'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp, loginAsDemo } = useAuthStore()
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
    const { error: err } = await signUp(email, password)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      navigate('/onboarding')
    }
  }

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Create account</h1>
      <p className="text-gray-500 text-sm mb-6">Start your 14-day free trial</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Work email</label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
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
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  )
}
