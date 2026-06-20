import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button, Input, Select } from '../../components/ui'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'
import { DEMO_BRAND } from '../../data/seed'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { createBrand, addWarehouseDB } from '../../lib/db'
import AuthShell from './AuthShell'

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [brandName, setBrandName] = useState('')
  const [marketType, setMarketType] = useState('D2C')
  const [warehouseName, setWarehouseName] = useState('')
  const [warehouseCity, setWarehouseCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { bootstrap } = useAppStore()
  const { user } = useAuthStore()

  const handleFinish = async () => {
    const pendingPlan = sessionStorage.getItem('xmetrics-pending-plan')
    const founding = sessionStorage.getItem('xmetrics-founding')
    const billingParams = [
      pendingPlan && `plan=${pendingPlan}`,
      founding && `founding=true`,
    ].filter(Boolean).join('&')
    const afterNav = pendingPlan
      ? `/settings/billing?${billingParams}`
      : '/dashboard'

    if (DEMO_MODE) {
      bootstrap('user-demo-001')
      sessionStorage.removeItem('xmetrics-pending-plan')
      sessionStorage.removeItem('xmetrics-founding')
      navigate(afterNav)
      return
    }

    setSaving(true)
    setError('')

    // Resolve current user — authStore may not have hydrated yet if the user
    // landed here right after signup. Fall back to querying Supabase directly.
    let currentUser = user
    if (!currentUser) {
      const { data } = await supabase!.auth.getUser()
      if (data?.user) {
        currentUser = { id: data.user.id, email: data.user.email! }
      }
    }

    if (!currentUser) {
      setSaving(false)
      setError('Session not found — please sign in again.')
      return
    }

    // Create the brand + owner membership in Supabase
    const { brand, error: brandErr } = await createBrand(
      currentUser.id,
      currentUser.email.split('@')[0] ?? 'Owner',
      currentUser.email,
      brandName || 'My Brand',
      marketType
    )

    if (brandErr || !brand) {
      setSaving(false)
      setError(brandErr ?? 'Failed to create brand. Please try again.')
      return
    }

    // Optionally create first warehouse
    if (warehouseName && warehouseCity) {
      await addWarehouseDB({
        brand_id: brand.id,
        name: warehouseName,
        address: '',
        city: warehouseCity,
        state: '',
        pincode: '',
        contact_name: '',
        contact_phone: '',
        is_primary: true,
      })
    }

    // Bootstrap the app state from Supabase
    await bootstrap(currentUser.id)

    // If the user paid on the landing page before signing up, activate their subscription now
    // that we have a brand_id. The payment details were saved to sessionStorage by FoundingAccess.tsx.
    const pendingPayment = sessionStorage.getItem('xmetrics-pending-payment')
    if (pendingPayment && supabase) {
      try {
        const paymentData = JSON.parse(pendingPayment) as {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }
        await supabase.functions.invoke('subscription-verify-payment', {
          body: { ...paymentData, brand_id: brand.id },
        })
      } catch {
        // Non-blocking: Razorpay webhook will activate the subscription as fallback.
      }
      sessionStorage.removeItem('xmetrics-pending-payment')
    }

    sessionStorage.removeItem('xmetrics-pending-plan')
    sessionStorage.removeItem('xmetrics-founding')
    navigate(afterNav)
  }

  return (
    <AuthShell width="max-w-md">
      {/* Progress */}
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-brand-600' : 'bg-gray-100'}`} />
            ))}
          </div>

          {step === 1 && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">Setup your brand</h1>
              <p className="text-gray-500 text-sm mb-6">Tell us about your business</p>
              <div className="form-field-group space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand name</label>
                  <Input
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                    placeholder="e.g. Zestify Foods"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market type</label>
                  <Select value={marketType} onChange={e => setMarketType(e.target.value)}>
                    <option value="D2C">D2C (Direct to Consumer)</option>
                    <option value="B2B">B2B</option>
                    <option value="Hybrid">Hybrid</option>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => setStep(2)} disabled={!brandName.trim()}>
                  Continue →
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">Add your warehouse</h1>
              <p className="text-gray-500 text-sm mb-6">Where do you ship from?</p>
              <div className="form-field-group space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse name</label>
                  <Input
                    value={warehouseName}
                    onChange={e => setWarehouseName(e.target.value)}
                    placeholder="e.g. Delhi Main Warehouse"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <Input
                    value={warehouseCity}
                    onChange={e => setWarehouseCity(e.target.value)}
                    placeholder="e.g. New Delhi"
                  />
                </div>
                <Button className="w-full" onClick={() => setStep(3)}>
                  Continue →
                </Button>
                <button
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-1"
                  onClick={() => setStep(3)}
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">You're all set!</h1>
              <p className="text-gray-500 text-sm mb-6">
                {DEMO_MODE
                  ? "We'll load sample data so you can explore Xmetrics right away."
                  : 'Your brand workspace will be created and ready to use.'}
              </p>
              <div className="bg-brand-50 rounded-xl p-4 mb-6 space-y-1">
                <p className="text-sm font-medium text-brand-900">{brandName || DEMO_BRAND.name}</p>
                <p className="text-xs text-brand-600">{marketType} · {DEMO_MODE ? 'Demo data loaded' : 'Live workspace'}</p>
                {warehouseName && (
                  <p className="text-xs text-brand-500">📦 {warehouseName}, {warehouseCity}</p>
                )}
              </div>
              {error && (
                <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
              <Button className="w-full" onClick={handleFinish} disabled={saving}>
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Setting up workspace…
                  </span>
                ) : (
                  'Open Dashboard →'
                )}
              </Button>
            </div>
          )}
    </AuthShell>
  )
}
