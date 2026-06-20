import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Button, Modal, Input, Select } from '../../components/ui'
import type { ProductCategory } from '../../types'

const CATEGORIES: ProductCategory[] = [
  'Skincare', 'Supplements', 'Food & Beverage', 'Fashion',
  'Electronics', 'Home & Kitchen', 'Other',
]

const CATEGORY_STYLE: Record<ProductCategory, { bg: string; text: string }> = {
  'Supplements':     { bg: 'bg-violet-100 dark:bg-violet-400/15', text: 'text-violet-600 dark:text-violet-400' },
  'Food & Beverage': { bg: 'bg-orange-100 dark:bg-orange-400/15', text: 'text-orange-600 dark:text-orange-400' },
  'Skincare':        { bg: 'bg-pink-100 dark:bg-pink-400/15',     text: 'text-pink-600 dark:text-pink-400' },
  'Electronics':     { bg: 'bg-blue-100 dark:bg-blue-400/15',     text: 'text-blue-600 dark:text-blue-400' },
  'Fashion':         { bg: 'bg-indigo-100 dark:bg-indigo-400/15', text: 'text-indigo-600 dark:text-indigo-400' },
  'Home & Kitchen':  { bg: 'bg-emerald-100 dark:bg-emerald-400/15', text: 'text-emerald-600 dark:text-emerald-400' },
  'Other':           { bg: 'bg-gray-100 dark:bg-white/[0.07]',    text: 'text-gray-500 dark:text-gray-400' },
}

export default function Products() {
  const { products, addProduct, updateProduct } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    name: '', sku: '', category: 'Supplements' as ProductCategory,
    selling_price: 0, cost_price: 0, inventory_count: 0,
    reorder_threshold: 10, weight_grams: 500,
  })

  const activeProducts = products.filter(p => p.is_active)
  const inactiveProducts = products.filter(p => !p.is_active)

  const handleAdd = () => {
    addProduct({ ...form, is_active: true })
    setShowAdd(false)
    setForm({ name: '', sku: '', category: 'Supplements', selling_price: 0, cost_price: 0, inventory_count: 0, reorder_threshold: 10, weight_grams: 500 })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Products</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{activeProducts.length} active · {inactiveProducts.length} archived</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Product
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
        {activeProducts.map(product => {
          const margin = product.selling_price > 0
            ? ((product.selling_price - product.cost_price) / product.selling_price * 100)
            : 0
          const isLow = product.inventory_count < product.reorder_threshold

          const catStyle = CATEGORY_STYLE[product.category] ?? CATEGORY_STYLE['Other']
          return (
            <Card key={product.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[15px] font-bold shrink-0 ${catStyle.bg} ${catStyle.text}`}>
                  {product.name[0]}
                </div>
                {isLow && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${product.inventory_count === 0 ? 'bg-red-100 dark:bg-red-400/15 text-red-700 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-400/15 text-amber-700 dark:text-amber-400'}`}>
                    {product.inventory_count === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                  </span>
                )}
              </div>

              <h3 className="text-[13px] font-semibold text-gray-900 mb-0.5 leading-tight">{product.name}</h3>
              <p className="text-[11px] text-gray-400 mb-3">{product.sku} · {product.category}</p>

              <div className="grid grid-cols-3 gap-2 text-center border-t border-gray-100 dark:border-white/[0.05] pt-3">
                <div>
                  <p className="text-[13px] font-semibold text-gray-900 tabular-nums">₹{product.selling_price}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Price</p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{Math.round(margin)}%</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Margin</p>
                </div>
                <div>
                  <p className={`text-[13px] font-semibold tabular-nums ${isLow ? 'text-red-600 dark:text-red-400' : 'text-gray-900'}`}>
                    {product.inventory_count}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">In Stock</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.05] flex items-center justify-between">
                <span className="text-[11px] text-gray-400">Reorder at {product.reorder_threshold}</span>
                <button
                  onClick={() => updateProduct(product.id, { is_active: false })}
                  className="text-[11px] text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  Deactivate
                </button>
              </div>
            </Card>
          )
        })}
      </div>

      {inactiveProducts.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Inactive ({inactiveProducts.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-50">
            {inactiveProducts.map(product => (
              <Card key={product.id} className="p-4">
                <h3 className="text-sm font-medium text-gray-700">{product.name}</h3>
                <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                <button
                  onClick={() => updateProduct(product.id, { is_active: true })}
                  className="mt-2 text-xs text-brand-600 hover:underline"
                >
                  Reactivate
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Product" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product Name</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">SKU</label>
              <Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ProductCategory }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Weight (grams)</label>
              <Input type="number" value={form.weight_grams} onChange={e => setForm(f => ({ ...f, weight_grams: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Selling Price (₹)</label>
              <Input type="number" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cost Price (₹)</label>
              <Input type="number" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Inventory Count</label>
              <Input type="number" value={form.inventory_count} onChange={e => setForm(f => ({ ...f, inventory_count: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reorder Threshold</label>
              <Input type="number" value={form.reorder_threshold} onChange={e => setForm(f => ({ ...f, reorder_threshold: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleAdd} disabled={!form.name || !form.sku}>Add Product</Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
