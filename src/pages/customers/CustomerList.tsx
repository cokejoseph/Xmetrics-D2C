import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Input } from '../../components/ui'

export default function CustomerList() {
  const { customers } = useAppStore()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return customers
    const q = search.toLowerCase()
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  }, [customers, search])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Customers</h1>

      <Card className="p-4">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, email…"
            className="pl-8"
          />
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Orders</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">LTV</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Tags</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Location</th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {filtered.map(customer => (
                <tr key={customer.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/customers/${customer.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-gray-700">{customer.phone}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-500">{customer.email ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{customer.total_orders}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                    ₹{customer.total_spent.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {customer.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-500">
                    {customer.city}, {customer.state}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">No customers found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
          {filtered.length} customers
        </div>
      </Card>
    </div>
  )
}
