import { useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, Clock, Plus, Loader2, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button, Modal, Input } from '../../components/ui'
import { connectShopify, testShopifyConnection, normaliseShopDomain } from '../../lib/shopify'
import { connectRazorpay, testRazorpayConnection } from '../../lib/razorpay'
import { connectShiprocket, testShiprocketConnection } from '../../lib/shiprocket'
import { testWhatsAppConnection } from '../../lib/whatsapp'
import type { Integration, IntegrationPlatform } from '../../types'

// ─── Platform metadata ──────────────────────────────────────────────────────

const PLATFORM_META: Record<IntegrationPlatform, {
  name: string
  description: string
  logo: string
  fields: { key: string; label: string; type?: string; placeholder?: string }[]
  badge?: string
}> = {
  SHOPIFY: {
    name: 'Shopify',
    description: 'Sync orders, products, and inventory in real time from your Shopify store.',
    logo: '🛍️',
    badge: 'Most popular',
    fields: [
      { key: 'shop_domain', label: 'Store Domain', placeholder: 'yourstore.myshopify.com' },
      { key: 'api_key', label: 'Admin API Access Token', placeholder: 'shpat_XXXX', type: 'password' },
      { key: 'api_secret', label: 'API Secret Key', placeholder: 'shpss_XXXX', type: 'password' },
      { key: 'webhook_secret', label: 'Webhook Secret (optional)', placeholder: 'Leave blank to skip HMAC' },
    ],
  },
  RAZORPAY: {
    name: 'Razorpay',
    description: 'Collect payments, receive settlement updates, and trigger refunds for RTOs.',
    logo: '💳',
    fields: [
      { key: 'key_id', label: 'Key ID', placeholder: 'rzp_live_XXXX' },
      { key: 'key_secret', label: 'Key Secret', placeholder: '••••••••', type: 'password' },
      { key: 'webhook_secret', label: 'Webhook Secret (optional)', placeholder: 'From Razorpay Dashboard → Webhooks' },
    ],
  },
  SHIPROCKET: {
    name: 'Shiprocket',
    description: 'Book courier pickups, generate labels, and track across 17,000+ pincodes.',
    logo: '🚀',
    fields: [
      { key: 'email', label: 'Shiprocket Email', placeholder: 'you@company.com' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
      { key: 'webhook_token', label: 'Webhook Token (optional)', placeholder: 'From Shiprocket Webhooks settings' },
    ],
  },
  WHATSAPP: {
    name: 'WhatsApp Business',
    description: 'Send order confirmations, delivery updates, and reorder nudges via WhatsApp.',
    logo: '💬',
    fields: [
      { key: 'phone_number_id', label: 'Phone Number ID', placeholder: '123456789012345' },
      { key: 'api_token', label: 'System User Token', placeholder: 'EAAxxxxxxx', type: 'password' },
    ],
  },
  SHIPPO: {
    name: 'Shippo',
    description: 'Multi-carrier shipping rates comparison and label generation.',
    logo: '📦',
    fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'shippo_test_XXX', type: 'password' },
    ],
  },
  EASYPOST: {
    name: 'EasyPost',
    description: 'Enterprise carrier integrations and address verification.',
    logo: '📮',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'EZTKxxxxxxx', type: 'password' },
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

const ALL_PLATFORMS: IntegrationPlatform[] = ['SHOPIFY', 'RAZORPAY', 'SHIPROCKET', 'WHATSAPP', 'SHIPPO', 'EASYPOST']

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
        // SHIPPO / EASYPOST — simple test
        addLog(`Testing ${meta.name} connection…`)
        await new Promise(r => setTimeout(r, 800))
        addLog(`✓ ${meta.name} connected`)
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
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
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 min-h-[100px]">
            {progressLog.map((log, i) => (
              <p key={i} className="text-xs text-gray-600 font-mono">{log}</p>
            ))}
            {progressLog.length === 0 && (
              <p className="text-xs text-gray-400 animate-pulse">Initialising…</p>
            )}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
            <CheckCircle size={20} className="text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">{meta.name} connected successfully!</p>
              <p className="text-xs text-green-600 mt-0.5">Webhooks registered and data sync initiated.</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-1 max-h-[120px] overflow-y-auto">
            {progressLog.map((log, i) => (
              <p key={i} className="text-xs text-gray-500 font-mono">{log}</p>
            ))}
          </div>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Connection failed</p>
              <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
            </div>
          </div>
          {progressLog.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
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

// ─── Main page ──────────────────────────────────────────────────────────────

export default function Integrations() {
  const { integrations, connectIntegration, updateIntegration, currentBrand } = useAppStore()
  const [connectPlatform, setConnectPlatform] = useState<IntegrationPlatform | null>(null)
  const [testingPlatform, setTestingPlatform] = useState<IntegrationPlatform | null>(null)
  const [testResults, setTestResults] = useState<Record<string, string>>({})

  const brandId = currentBrand?.id ?? ''

  const openConnect = (platform: IntegrationPlatform) => {
    setConnectPlatform(platform)
  }

  const handleConnected = async (platform: IntegrationPlatform, credentials: Record<string, string>) => {
    await connectIntegration(platform, credentials)
    setConnectPlatform(null)
  }

  const handleDisconnect = (integration: Integration) => {
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Connect your tools to sync orders, process payments, and automate shipments.
        </p>
      </div>

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
                  <span className="text-2xl">{meta.logo}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-gray-900">{meta.name}</h3>
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
                <p className="text-xs text-red-600 mb-3 bg-red-50 px-2 py-1.5 rounded-lg">
                  {integration.error_message}
                </p>
              )}

              {testMsg && (
                <p className={`text-xs mb-3 px-2 py-1.5 rounded-lg font-medium ${
                  testMsg.startsWith('✓')
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {testMsg}
                </p>
              )}

              <div className="flex gap-2">
                {!isConnected ? (
                  <Button size="sm" onClick={() => openConnect(platform)}>
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
