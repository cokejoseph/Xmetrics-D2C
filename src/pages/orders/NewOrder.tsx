import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button, Input, Select } from '../../components/ui'
import { calculateRTOScore } from '../../lib/services'
import { lookupPincode } from '../../lib/pincodeService'
import type { PincodeResult } from '../../lib/pincodeService'
import type { PaymentMethod, OrderChannel } from '../../types'

interface LineItem {
  product_id: string
  quantity: number
  unit_price: number
  sku: string
}

export default function NewOrder() {
  const navigate = useNavigate()
  const { products, customers } = useAppStore()

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [channel, setChannel] = useState<OrderChannel>('MANUAL')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD')
  const [lines, setLines] = useState<LineItem[]>([{ product_id: '', quantity: 1, unit_price: 0, sku: '' }])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pincodeData, setPincodeData] = useState<PincodeResult | null>(null)
  const [pincodeLoading, setPincodeLoading] = useState(false)

  useEffect(() => {
    if (pincode.length !== 6) { setPincodeData(null); return }
    setPincodeLoading(true)
    lookupPincode(pincode)
      .then(data => { setPincodeData(data); setPincodeLoading(false) })
      .catch(() => { setPincodeData(null); setPincodeLoading(false) })
  }, [pincode])

  const addLine = () => setLines(l => [...l, { product_id: '', quantity: 1, unit_price: 0, sku: '' }])
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i))
  const updateLine = (i: number, changes: Partial<LineItem>) =>
    setLines(l => l.map((line, idx) => idx === i ? { ...line, ...changes } : line))

  const selectProduct = (i: number, productId: string) => {
    const p = products.find(x => x.id === productId)
    if (p) updateLine(i, { product_id: productId, unit_price: p.selling_price, sku: p.sku })
  }

  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  const shipping = 60
  const total = subtotal + shipping

  const brandAov = 450
  const isFirstOrder = !customers.some(c => c.phone === customerPhone)
  const rtoPreview = pincode.length === 6 && !pincodeLoading
    ? calculateRTOScore({
        payment_method: paymentMethod,
        pincode,
        customer_id: null,
        order_value: total,
        brand_aov: brandAov,
        is_first_order: isFirstOrder,
        has_prior_rto: false,
        address_complete: !!(address && pincode),
        pincodeData,
      })
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    // In demo mode just navigate back
    setTimeout(() => {
      setSubmitting(false)
      navigate('/orders')
    }, 800)
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/orders" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">New Order</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Customer Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+91 98765 43210" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@email.com" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address, flat/house no." required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <Input value={state} onChange={e => setState(e.target.value)} placeholder="State" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
              <Input value={pincode} onChange={e => setPincode(e.target.value)} placeholder="6-digit pincode" maxLength={6} required />
            </div>
          </div>
        </Card>

        {/* Order Items */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Order Items</h2>
          <div className="space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Product</label>
                  <Select value={line.product_id} onChange={e => selectProduct(i, e.target.value)} required>
                    <option value="">Select product…</option>
                    {products.filter(p => p.is_active).map(p => (
                      <option key={p.id} value={p.id}>{p.name} — ₹{p.selling_price}</option>
                    ))}
                  </Select>
                </div>
                <div className="w-20">
                  <label className="block text-xs text-gray-500 mb-1">Qty</label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={e => updateLine(i, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs text-gray-500 mb-1">Unit Price</label>
                  <Input
                    type="number"
                    value={line.unit_price}
                    onChange={e => updateLine(i, { unit_price: Number(e.target.value) })}
                  />
                </div>
                {lines.length > 1 && (
                  <button type="button" onClick={() => removeLine(i)} className="pb-2 text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
            >
              <Plus size={14} /> Add item
            </button>
          </div>
        </Card>

        {/* Order Settings */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Order Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <Select value={channel} onChange={e => setChannel(e.target.value as OrderChannel)}>
                <option value="MANUAL">Manual</option>
                <option value="SHOPIFY">Shopify</option>
                <option value="WHATSAPP">WhatsApp</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>
                <option value="COD">COD</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="NETBANKING">Netbanking</option>
                <option value="WALLET">Wallet</option>
                <option value="PREPAID">Prepaid</option>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes…" />
            </div>
          </div>
        </Card>

        {/* Order Summary */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>₹{shipping}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-100 pt-2">
              <span>Total</span>
              <span>₹{total.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {pincode.length === 6 && (
            <div className="mt-4">
              {pincodeLoading ? (
                <div className="p-3 rounded-xl bg-gray-50 text-sm text-gray-400 animate-pulse">
                  Looking up pincode…
                </div>
              ) : rtoPreview ? (
                <div className={`p-3 rounded-xl text-sm ${
                  rtoPreview.level === 'HIGH'   ? 'bg-red-50 text-red-700' :
                  rtoPreview.level === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                                                  'bg-green-50 text-green-700'
                }`}>
                  <p className="font-medium">RTO Pre-score: {rtoPreview.score}/100 — {rtoPreview.level} RISK</p>
                  {pincodeData && (
                    <p className="text-xs mt-0.5 opacity-80">
                      {pincodeData.district}, {pincodeData.state}
                      {!pincodeData.deliverable && ' · Non-deliverable pincode'}
                      {pincodeData.highRiskState && ' · High-risk region'}
                    </p>
                  )}
                  <p className="text-xs mt-0.5 opacity-70">{rtoPreview.factors[0]}</p>
                </div>
              ) : null}
            </div>
          )}
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? 'Creating…' : 'Create Order'}
          </Button>
          <Link to="/orders">
            <Button variant="secondary" type="button">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
