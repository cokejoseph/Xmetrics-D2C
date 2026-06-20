import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Download, Users } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { Card, Input, Pagination } from '../../components/ui'
import { exportCSV } from '../../lib/exportCSV'

function tagStyle(tag: string): string {
  if (tag === 'vip') return 'bg-amber-50 text-amber-700'
  if (tag === 'repeat') return 'bg-blue-50 text-blue-600'
  if (tag === 'new') return 'bg-emerald-50 text-emerald-700'
  if (tag === 'cod-risk') return 'bg-orange-50 text-orange-600'
  if (tag === 'rto-history') return 'bg-red-50 text-red-600'
  return 'bg-gray-100 text-gray-600'
}

export default function CustomerList() {
  const { customers } = useAppStore()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const filtered = useMemo(() => {
    if (!search) return customers
    const q = search.toLowerCase()
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  }, [customers, search])

  const pagedCustomers = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

  useEffect(() => { setPage(1) }, [search])

  const handleExport = () => {
    exportCSV(
      `customers-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'Phone', 'Email', 'City', 'State', 'Pincode', 'Total Orders', 'Lifetime Value', 'Tags'],
      filtered.map(c => [
        c.name,
        c.phone,
        c.email ?? '',
        c.city ?? '',
        c.state ?? '',
        c.pincode ?? '',
        c.total_orders,
        c.total_spent,
        c.tags.join('; '),
      ])
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Customers</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{customers.length} total · {filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <Download size={13} /> Export
        </button>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, email…"
            className="pl-8"
            aria-label="Search customers by name, phone, or email"
          />
        </div>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Phone</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Orders</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">LTV</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Tags</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Location</th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {pagedCustomers.map(customer => (
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
                        <span key={tag} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tagStyle(tag)}`}>
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
                  <td colSpan={7} className="py-16 text-center">
                    <Users size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No customers found</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {search ? 'Try a different name, phone, or email' : 'Customers will appear here once orders are placed'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
          {filtered.length} customers
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Card>
    </div>
  )
}
