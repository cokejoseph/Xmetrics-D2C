import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button, Input, Select } from '../../components/ui'
import type { Brand } from '../../types'

export default function BrandSettings() {
  const { currentBrand, updateBrand } = useAppStore()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    name: currentBrand?.name ?? '',
    market_type: currentBrand?.market_type ?? 'D2C' as Brand['market_type'],
    website_url: currentBrand?.settings?.website_url ?? '',
    business_type: currentBrand?.settings?.business_type ?? '',
    currency: currentBrand?.settings?.currency ?? 'INR',
    monthly_order_volume: currentBrand?.settings?.monthly_order_volume ?? 0,
    average_order_value: currentBrand?.settings?.average_order_value ?? 0,
  })

  if (!currentBrand) return null

  const handleSave = () => {
    updateBrand({
      name: form.name,
      website_url: form.website_url,
      business_type: form.business_type,
      currency: form.currency,
      monthly_order_volume: form.monthly_order_volume,
      average_order_value: form.average_order_value,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-gray-900">Brand Settings</h1>

      <Card className="p-6 space-y-5">
        <h2 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Brand Identity</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Brand Name</label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Your brand name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Market Type</label>
            <Select
              value={form.market_type}
              onChange={e => setForm(f => ({ ...f, market_type: e.target.value as Brand['market_type'] }))}
            >
              <option value="D2C">D2C (Direct to Consumer)</option>
              <option value="B2B">B2B</option>
              <option value="Hybrid">Hybrid</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Website URL</label>
            <Input
              value={form.website_url}
              onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
              placeholder="https://yourstore.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Business Type</label>
            <Input
              value={form.business_type}
              onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))}
              placeholder="e.g. Food & Beverage"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <h2 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Business Metrics</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Currency</label>
            <Select
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="AED">AED (د.إ)</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Order Volume</label>
            <Input
              type="number"
              value={form.monthly_order_volume}
              onChange={e => setForm(f => ({ ...f, monthly_order_volume: Number(e.target.value) }))}
              placeholder="500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Average Order Value (₹)</label>
            <Input
              type="number"
              value={form.average_order_value}
              onChange={e => setForm(f => ({ ...f, average_order_value: Number(e.target.value) }))}
              placeholder="800"
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!form.name}>
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
        {saved && <p className="text-sm text-green-600 font-medium">Changes saved successfully</p>}
      </div>
    </div>
  )
}
