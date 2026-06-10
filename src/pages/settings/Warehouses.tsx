import { useState } from 'react'
import { MapPin, Plus, Star } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button, Modal, Input } from '../../components/ui'

const EMPTY_FORM = {
  name: '', address: '', city: '', state: '', pincode: '',
  contact_name: '', contact_phone: '',
}

export default function Warehouses() {
  const { warehouses, addWarehouse, setDefaultWarehouse } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const handleAdd = () => {
    addWarehouse({ ...form, is_primary: warehouses.length === 0 })
    setShowAdd(false)
    setForm(EMPTY_FORM)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Warehouses</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Warehouse
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {warehouses.map(wh => (
          <Card key={wh.id} className={`p-5 ${wh.is_primary ? 'ring-1 ring-brand-600' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                  <MapPin size={14} className="text-brand-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{wh.name}</h3>
                  {wh.is_primary && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star size={10} className="text-amber-500 fill-amber-500" />
                      <span className="text-[10px] text-amber-600 font-semibold">Primary</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-gray-600 mb-4">
              <p>{wh.address}</p>
              <p>{wh.city}, {wh.state} — {wh.pincode}</p>
              <p className="text-gray-500">Contact: {wh.contact_name} · {wh.contact_phone}</p>
            </div>

            {!wh.is_primary && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setDefaultWarehouse(wh.id)}
              >
                Set as Primary
              </Button>
            )}
          </Card>
        ))}

        {warehouses.length === 0 && (
          <div className="sm:col-span-2 py-12 text-center text-gray-400">
            <MapPin size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No warehouses yet — add your first one</p>
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Warehouse" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse Name</label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Delhi Main Warehouse"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <Input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Street address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <Input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Delhi"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <Input
                value={form.state}
                onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                placeholder="Delhi"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <Input
                value={form.pincode}
                onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))}
                placeholder="110001"
                maxLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <Input
                value={form.contact_name}
                onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                placeholder="Manager name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <Input
                value={form.contact_phone}
                onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleAdd}
              disabled={!form.name || !form.city || !form.pincode}
            >
              Add Warehouse
            </Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
