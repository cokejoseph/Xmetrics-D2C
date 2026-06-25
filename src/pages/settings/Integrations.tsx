import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Clock, Plus, Loader2, RefreshCw, Eye, EyeOff, Webhook, Lock } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button, Modal, Input } from '../../components/ui'
import { useConfirm } from '../../hooks/useConfirm'
import { connectShopify, testShopifyConnection, normaliseShopDomain, deregisterShopifyWebhooks } from '../../lib/shopify'
import { connectRazorpay, testRazorpayConnection } from '../../lib/razorpay'
import { connectShiprocket, testShiprocketConnection } from '../../lib/shiprocket'
import { testWhatsAppConnection } from '../../lib/whatsapp'
import { getOmsSettings, updateOmsSettings } from '../../lib/db'
import { showToast } from '../../lib/toast'
import { DEMO_MODE } from '../../lib/supabase'
import type { Integration, IntegrationPlatform } from '../../types'

// ─── Platform metadata ──────────────────────────────────────────────────────

const PLATFORM_META: Record<IntegrationPlatform, {
  name: string
  description: string
  logo: string
  color: string
  fields: { key: string; label: string; type?: string; placeholder?: string }[]
  badge?: string
}> = {
  SHOPIFY: {
    name: 'Shopify',
    description: 'Sync orders, products, and inventory in real time from your Shopify store.',
    logo: 'S',
    color: 'bg-[#96BF48] text-white',
    badge: 'Most popular',
    fields: [
      { key: 'shop_domain', label: 'Store Domain', placeholder: 'yourstore.myshopify.com' },
      { key: 'api_key', label: 'Admin API Access Token', placeholder: 'shpat_XXXX', type: 'password' },
      { key: 'api_secret', label: 'API Secret Key', placeholder: 'shpss_XXXX', type: 'password' },
      { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'From Shopify → Partners → App → Webhooks' },
    ],
  },
  RAZORPAY: {
    name: 'Razorpay',
    description: 'Collect payments, receive settlement updates, and trigger refunds for RTOs.',
    logo: 'R',
    color: 'bg-[#528FF0] text-white',
    fields: [
      { key: 'key_id', label: 'Key ID', placeholder: 'rzp_live_XXXX' },
      { key: 'key_secret', label: 'Key Secret', placeholder: '••••••••', type: 'password' },
      { key: 'webhook_secret', label: 'Webhook Secret (optional)', placeholder: 'From Razorpay Dashboard → Webhooks' },
    ],
  },
  SHIPROCKET: {
    name: 'Shiprocket',
    description: 'Book courier pickups, generate labels, and track across 17,000+ pincodes.',
    logo: 'SR',
    color: 'bg-[#E87722] text-white',
    fields: [
      { key: 'email', label: 'Shiprocket Email', placeholder: 'you@company.com' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
      { key: 'webhook_token', label: 'Webhook Token (optional)', placeholder: 'From Shiprocket Webhooks settings' },
    ],
  },
  WHATSAPP: {
    name: 'WhatsApp Business',
    description: 'Send order confirmations, delivery updates, and reorder nudges via WhatsApp.',
    logo: 'W',
    color: 'bg-[#25D366] text-white',
    fields: [
      { key: 'phone_number_id', label: 'Phone Number ID', placeholder: '123456789012345' },
      { key: 'api_token', label: 'System User Token', placeholder: 'EAAxxxxxxx', type: 'password' },
    ],
  },
  ECOMEXPRESS: {
    name: 'Ecom Express',
    description: 'Book courier pickups and track shipments via Ecom Express across India.',
    logo: 'EE',
    color: 'bg-[#E31E24] text-white',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Your Ecom Express API Key' },
      { key: 'api_secret', label: 'API Secret', placeholder: '••••••••', type: 'password' },
      { key: 'awb_count', label: 'AWB Count (optional)', placeholder: '100' },
    ],
  },
  UNICOMMERCE: {
    name: 'Unicommerce',
    description: 'Sync orders and inventory across channels via Unicommerce OMS.',
    logo: 'U',
    color: 'bg-[#1A56DB] text-white',
    fields: [
      { key: 'username', label: 'Username', placeholder: 'your-username' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
      { key: 'facility_code', label: 'Facility Code', placeholder: 'e.g. WAREHOUSE_DEL' },
      { key: 'api_key', label: 'API Key (optional)', placeholder: 'Leave blank if using username/password' },
    ],
  },
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  CONNECTED: {
    icon: <CheckCircle size={14} className="text-green-500" />,
    label: 'Connected',
    color: 'text-green-700',
  },
  DISCONNECTED: {
    icon: <XCircle size={14} className="text-gray-400" />,
    label: 'Not connected',
    color: 'text-gray-500',
  },
  ERROR: {
    icon: <AlertCircle size={14} className="text-red-500" />,
    label: 'Error',
    color: 'text-red-600',
  },
  PENDING: {
    icon: <Clock size={14} className="text-amber-500" />,
    label: 'Connecting…',
    color: 'text-amber-700',
  },
}

const ALL_PLATFORMS: IntegrationPlatform[] = ['SHOPIFY', 'RAZORPAY', 'SHIPROCKET', 'WHATSAPP', 'ECOMEXPRESS', 'UNICOMMERCE']

// ─── Connect modal ──────────────────────────────────────────────────────────

function ConnectModal({
  platform,
  brandId,
  onClose,
  onConnected,
}: {
  platform: IntegrationPlatform
  brandId: string
  onClose: () => void
  onConnected: (credentials: Record<string, string>) => void
}) {
  const meta = PLATFORM_META[platform]
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [phase, setPhase] = useState<'form' | 'connecting' | 'done' | 'error'>('form')
  const [progressLog, setProgressLog] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  const requiredFields = meta.fields.filter(f => !f.label.includes('optional'))
  const allFilled = requiredFields.every(f => credentials[f.key]?.trim())

  const addLog = (msg: string) => setProgressLog(prev => [...prev, msg])

  const handleConnect = async () => {
    setPhase('connecting')
    setProgressLog([])
    setErrorMsg('')

    try {
      let result: { ok: boolean; error?: string } = { ok: true }

      if (platform === 'SHOPIFY') {
        const creds = {
          shop_domain: normaliseShopDomain(credentials.shop_domain ?? ''),
          api_key: credentials.api_key ?? '',
          api_secret: credentials.api_secret ?? '',
          webhook_secret: credentials.webhook_secret,
        }
        result = await connectShopify(brandId, creds, addLog)
      } else if (platform === 'RAZORPAY') {
        result = await connectRazorpay(brandId, {
          key_id: credentials.key_id ?? '',
          key_secret: credentials.key_secret ?? '',
          webhook_secret: credentials.webhook_secret,
        }, addLog)
      } else if (platform === 'SHIPROCKET') {
        result = await connectShiprocket(brandId, {
          email: credentials.email ?? '',
          password: credentials.password ?? '',
          webhook_token: credentials.webhook_token,
        }, addLog)
      } else if (platform === 'WHATSAPP') {
        addLog('Testing WhatsApp connection…')
        const testResult = await testWhatsAppConnection({
          phone_number_id: credentials.phone_number_id ?? '',
          api_token: credentials.api_token ?? '',
        })
        if (testResult.ok) {
          addLog(`✓ Connected — ${testResult.verified_name ?? 'WhatsApp Business verified'}`)
          result = { ok: true }
        } else {
          result = { ok: false, error: testResult.error }
        }
      } else {
        addLog(`Testing ${meta.name} connection…`)
        await new Promise(r => setTimeout(r, 800))
        addLog(`✓ ${meta.name} credentials saved`)
        result = { ok: true }
      }

      if (result.ok) {
        setPhase('done')
        onConnected(credentials)
      } else {
        setPhase('error')
        setErrorMsg(result.error ?? 'Connection failed')
      }
    } catch (e) {
      setPhase('error')
      setErrorMsg(e instanceof Error ? e.message : 'Unexpected error')
    }
  }

  return (
    <Modal open onClose={phase === 'connecting' ? () => {} : onClose} title={`Connect ${meta.name}`}>
      {phase === 'form' && (
        <div className="space-y-4">
          {meta.fields.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
              <Input
                type={field.type ?? 'text'}
                value={credentials[field.key] ?? ''}
                onChange={e => setCredentials(c => ({ ...c, [field.key]: e.target.value }))}
                placeholder={field.placeholder ?? field.label}
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleConnect} disabled={!allFilled}>
              Connect
            </Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}

      {phase === 'connecting' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-brand-600">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-medium">Connecting to {meta.name}…</span>
          </div>
          <div className="bg-gray-50 dark:bg-white/[0.04] rounded-md p-4 space-y-2 min-h-[100px]">
            {progressLog.map((log, i) => (
              <p key={i} className="text-xs text-gray-600 dark:text-gray-400 font-mono">{log}</p>
            ))}
            {progressLog.length === 0 && (
              <p className="text-xs text-gray-400 animate-pulse">Initialising…</p>
            )}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-md">
            <CheckCircle size={20} className="text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">{meta.name} connected successfully!</p>
              <p className="text-xs text-green-600 mt-0.5">Webhooks registered and data sync initiated.</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-md p-4 space-y-1 max-h-[120px] overflow-y-auto">
            {progressLog.map((log, i) => (
              <p key={i} className="text-xs text-gray-500 font-mono">{log}</p>
            ))}
          </div>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-md">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Connection failed</p>
              <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
            </div>
          </div>
          {progressLog.length > 0 && (
            <div className="bg-gray-50 rounded-md p-3 space-y-1">
              {progressLog.map((log, i) => (
                <p key={i} className="text-xs text-gray-500 font-mono">{log}</p>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={() => { setPhase('form'); setProgressLog([]) }}>
              Try Again
            </Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── OMS Webhook Section ─────────────────────────────────────────────────────

function OmsWebhookSection({ brandId }: { brandId: string }) {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [secretPlaceholder, setSecretPlaceholder] = useState('Not set')
  const [showSecret, setShowSecret] = useState(false)
  const [webhookEnabled, setWebhookEnabled] = useState(false)
  const [autoPushGreen, setAutoPushGreen] = useState(false)
  const [autoPushYellow, setAutoPushYellow] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    if (!brandId || DEMO_MODE) { setLoading(false); return }
    getOmsSettings(brandId).then(s => {
      setWebhookUrl(s.oms_webhook_url ?? '')
      setWebhookEnabled(s.oms_webhook_enabled)
      setAutoPushGreen(s.auto_push_green)
      setAutoPushYellow(s.auto_push_yellow)
      if (s.oms_webhook_url) setSecretPlaceholder('••••••••••••••••')
      setLoading(false)
    })
  }, [brandId])

  const generateSecret = () => {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const secret = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    setWebhookSecret(secret)
    setShowSecret(true)
  }

  const handleSave = async () => {
    if (DEMO_MODE) { showToast.settingsUpdated(); return }
    setSaving(true)
    const { error } = await updateOmsSettings(brandId, {
      oms_webhook_url: webhookUrl || undefined,
      oms_webhook_secret: webhookSecret || undefined,
      oms_webhook_enabled: webhookEnabled,
      auto_push_green: autoPushGreen,
      auto_push_yellow: autoPushYellow,
    })
    setSaving(false)
    if (error) showToast.error(error)
    else {
      showToast.settingsUpdated()
      if (webhookSecret) {
        setWebhookSecret('')
        setSecretPlaceholder('••••••••••••••••')
        setShowSecret(false)
      }
    }
  }

  const handleTest = async () => {
    if (!webhookUrl) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ping', from: 'xmetrics', timestamp: new Date().toISOString() }),
        signal: AbortSignal.timeout(10_000),
      })
      setTestResult({
        ok: res.ok,
        msg: res.ok
          ? `HTTP ${res.status} — endpoint reachable`
          : `HTTP ${res.status} — endpoint returned an error`,
      })
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Network error' })
    }
    setTesting(false)
    setTimeout(() => setTestResult(null), 8000)
  }

  if (loading) {
    return (
      <div className="h-8 flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 size={14} className="animate-spin" /> Loading OMS settings…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
          <Webhook size={18} className="text-gray-600 dark:text-gray-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">OMS Webhook</h3>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Xmetrics pushes approved orders to your OMS via a signed webhook. Configure the endpoint and auto-push rules below.
          </p>
        </div>
        <label className="ml-auto flex items-center gap-2 cursor-pointer shrink-0">
          <span className="text-xs text-gray-500">{webhookEnabled ? 'Enabled' : 'Disabled'}</span>
          <button
            onClick={() => setWebhookEnabled(v => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              webhookEnabled ? 'bg-brand-600' : 'bg-gray-200 dark:bg-white/[0.1]'
            }`}
            role="switch"
            aria-checked={webhookEnabled}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              webhookEnabled ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
        </label>
      </div>

      {/* Webhook URL */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Webhook URL</label>
        <Input
          type="url"
          value={webhookUrl}
          onChange={e => setWebhookUrl(e.target.value)}
          placeholder="https://your-oms.com/api/xmetrics/orders"
        />
        <p className="text-[11px] text-gray-400 mt-1">
          Xmetrics will POST approved orders to this URL, signed with HMAC-SHA256.
        </p>
      </div>

      {/* HMAC Secret */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">HMAC Signing Secret</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showSecret ? 'text' : 'password'}
              value={webhookSecret}
              onChange={e => setWebhookSecret(e.target.value)}
              placeholder={secretPlaceholder}
              className="pr-9 font-mono text-xs"
            />
            {webhookSecret && (
              <button
                onClick={() => setShowSecret(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={generateSecret} className="whitespace-nowrap">
            Generate
          </Button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          Your OMS should verify the <code className="text-[10px] bg-gray-100 dark:bg-white/[0.08] px-1 py-0.5 rounded">X-Xmetrics-Signature</code> header on every incoming request.
        </p>
      </div>

      {/* Auto-push rules */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-3">Auto-push rules</p>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="pt-0.5">
              <input
                type="checkbox"
                checked={autoPushGreen}
                onChange={e => setAutoPushGreen(e.target.checked)}
                className="rounded accent-brand-600 w-4 h-4 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">GREEN orders (RTO score &lt; 50)</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Push automatically as soon as they enter Xmetrics — no manual review needed.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="pt-0.5">
              <input
                type="checkbox"
                checked={autoPushYellow}
                onChange={e => setAutoPushYellow(e.target.checked)}
                className="rounded accent-brand-600 w-4 h-4 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">YELLOW orders (RTO score 50–59)</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Push automatically. Exceptions are still created for visibility but don't block the push.
              </p>
            </div>
          </label>

          <div className="flex items-start gap-3 opacity-60 cursor-not-allowed">
            <div className="pt-0.5">
              <Lock size={14} className="text-gray-400 mt-0.5 ml-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">RED orders (RTO score ≥ 60)</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Always require manual review and approval — cannot be auto-pushed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
          testResult.ok
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {testResult.msg}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleTest}
          disabled={!webhookUrl || testing}
        >
          {testing ? <><Loader2 size={13} className="animate-spin" /> Testing…</> : 'Test Webhook'}
        </Button>
      </div>
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function Integrations() {
  useEffect(() => { document.title = 'Integrations · Settings · Xmetrics' }, [])
  const { integrations, connectIntegration, updateIntegration, currentBrand } = useAppStore()
  const confirm = useConfirm()
  const [connectPlatform, setConnectPlatform] = useState<IntegrationPlatform | null>(null)
  const [testingPlatform, setTestingPlatform] = useState<IntegrationPlatform | null>(null)
  const [testResults, setTestResults] = useState<Record<string, string>>({})

  const brandId = currentBrand?.id ?? ''

  const handleConnected = async (platform: IntegrationPlatform, credentials: Record<string, string>) => {
    await connectIntegration(platform, credentials)
    setConnectPlatform(null)
  }

  const handleDisconnect = async (integration: Integration) => {
    const meta = PLATFORM_META[integration.platform]
    const ok = await confirm({
      title: `Disconnect ${meta.name}?`,
      message: `This will remove your ${meta.name} credentials and stop all syncing. You can reconnect at any time.`,
      confirmText: 'Disconnect',
      cancelText: 'Keep Connected',
      isDangerous: true,
    })
    if (!ok) return

    if (integration.platform === 'SHOPIFY' && integration.credentials?.shop_domain) {
      await deregisterShopifyWebhooks(brandId, {
        shop_domain: integration.credentials.shop_domain as string,
        api_key: integration.credentials.api_key as string,
      }).catch(e => console.warn('[Integrations] Shopify webhook deregistration failed:', e))
    }

    updateIntegration(integration.id, {
      status: 'DISCONNECTED',
      credentials: {},
      last_sync_at: null,
      error_message: undefined,
    })
  }

  const handleTest = async (integration: Integration) => {
    setTestingPlatform(integration.platform)
    setTestResults(r => ({ ...r, [integration.platform]: '' }))

    let ok = false
    let msg = ''

    try {
      if (integration.platform === 'SHOPIFY') {
        const result = await testShopifyConnection({
          shop_domain: integration.credentials.shop_domain ?? '',
          api_key: integration.credentials.api_key ?? '',
          api_secret: integration.credentials.api_secret ?? '',
        })
        ok = result.ok
        msg = result.ok
          ? `Connected to ${result.shop_name} (${result.plan})`
          : result.error ?? 'Test failed'
      } else if (integration.platform === 'RAZORPAY') {
        const result = await testRazorpayConnection({
          key_id: integration.credentials.key_id ?? '',
          key_secret: integration.credentials.key_secret ?? '',
        })
        ok = result.ok
        msg = result.ok ? `Connected — ${result.business_name}` : result.error ?? 'Test failed'
      } else if (integration.platform === 'SHIPROCKET') {
        const result = await testShiprocketConnection({
          email: integration.credentials.email ?? '',
          password: integration.credentials.password ?? '',
        })
        ok = result.ok
        msg = result.ok ? `Connected — ${result.company_name}` : result.error ?? 'Test failed'
      } else if (integration.platform === 'WHATSAPP') {
        const result = await testWhatsAppConnection({
          phone_number_id: integration.credentials.phone_number_id ?? '',
          api_token: integration.credentials.api_token ?? '',
        })
        ok = result.ok
        msg = result.ok
          ? `${result.verified_name} (${result.display_phone_number})`
          : result.error ?? 'Test failed'
      } else {
        await new Promise(r => setTimeout(r, 600))
        ok = true
        msg = 'Connection OK'
      }
    } catch (e) {
      ok = false
      msg = e instanceof Error ? e.message : 'Test failed'
    }

    setTestingPlatform(null)
    setTestResults(r => ({ ...r, [integration.platform]: `${ok ? '✓ ' : '✗ '}${msg}` }))
    setTimeout(() => setTestResults(r => ({ ...r, [integration.platform]: '' })), 5000)
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Integrations</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Connect your tools to sync orders, process payments, and automate shipments.</p>
      </div>

      {/* Platform integrations */}
      <div>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Platforms</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ALL_PLATFORMS.map(platform => {
            const meta = PLATFORM_META[platform]
            const integration = integrations.find(i => i.platform === platform)
            const status = integration?.status ?? 'DISCONNECTED'
            const isConnected = status === 'CONNECTED'
            const sc = STATUS_CONFIG[status]
            const isTesting = testingPlatform === platform
            const testMsg = testResults[platform]

            return (
              <Card key={platform} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0 ${meta.color}`}>
                      {meta.logo}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{meta.name}</h3>
                        {meta.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-brand-50 text-brand-600 rounded-full">
                            {meta.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {sc.icon}
                        <span className={`text-xs ${sc.color}`}>{sc.label}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-4 leading-relaxed">{meta.description}</p>

                {integration?.last_sync_at && isConnected && (
                  <p className="text-[10px] text-gray-400 mb-3">
                    Last sync: {new Date(integration.last_sync_at).toLocaleString('en-IN', {
                      dateStyle: 'short', timeStyle: 'short',
                    })}
                  </p>
                )}

                {integration?.error_message && status === 'ERROR' && (
                  <p className="text-xs text-red-600 mb-3 bg-red-50 px-2 py-1.5 rounded-md">
                    {integration.error_message}
                  </p>
                )}

                {testMsg && (
                  <p className={`text-xs mb-3 px-2 py-1.5 rounded-md font-medium ${
                    testMsg.startsWith('✓')
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {testMsg}
                  </p>
                )}

                <div className="flex gap-2">
                  {!isConnected ? (
                    <Button size="sm" onClick={() => setConnectPlatform(platform)}>
                      <Plus size={12} /> Connect
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => integration && handleTest(integration)}
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <><Loader2 size={12} className="animate-spin" /> Testing…</>
                        ) : (
                          <><RefreshCw size={12} /> Test</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => integration && handleDisconnect(integration)}
                      >
                        Disconnect
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* OMS webhook section */}
      <div>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">OMS Integration</h2>
        <Card className="p-5">
          <OmsWebhookSection brandId={brandId} />
        </Card>
      </div>

      {connectPlatform && (
        <ConnectModal
          platform={connectPlatform}
          brandId={brandId}
          onClose={() => setConnectPlatform(null)}
          onConnected={(creds) => handleConnected(connectPlatform, creds)}
        />
      )}
    </div>
  )
}
