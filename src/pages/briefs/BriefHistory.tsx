import { useState, useMemo } from 'react'
import { Search, ChevronRight, MessageCircle, Copy, Check, X } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { generateDailyBrief, getOrderDates, dayLabel, buildWhatsAppText } from '../../lib/briefEngine'
import { Card, Input } from '../../components/ui'
import type { BriefData } from '../../types'

export default function BriefHistory() {
  const { orders, customers, products, exceptions } = useAppStore()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [showExport, setShowExport] = useState(false)
  const [copied, setCopied] = useState(false)

  const dates = useMemo(() => getOrderDates(orders), [orders])

  const filtered = useMemo(() => {
    if (!search) return dates
    return dates.filter(d => dayLabel(d).toLowerCase().includes(search.toLowerCase()) || d.includes(search))
  }, [dates, search])

  const briefs = useMemo(() => {
    return filtered.slice(0, 20).map(date =>
      generateDailyBrief(date, orders, customers, products, exceptions)
    )
  }, [filtered, orders, customers, products, exceptions])

  const selectedBrief = useMemo(
    () => selected ? briefs.find(b => b.date === selected) ?? null : null,
    [selected, briefs]
  )

  return (
    <div className="flex gap-4 min-h-0">
      {/* List */}
      <div className="w-80 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Brief History</h1>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search dates…"
            className="pl-8"
          />
        </div>

        <div className="space-y-2">
          {briefs.map(brief => (
            <BriefCard
              key={brief.date}
              brief={brief}
              active={selected === brief.date}
              onClick={() => setSelected(brief.date)}
            />
          ))}
          {briefs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No briefs found</p>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 min-w-0">
        {!selectedBrief && (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="text-center">
              <ChevronRight size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a brief to view details</p>
            </div>
          </div>
        )}

        {selectedBrief && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Brief for {dayLabel(selectedBrief.date)}
              </h2>
              <button
                onClick={() => { setShowExport(true); setCopied(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <MessageCircle size={13} />
                Export to WhatsApp
              </button>
            </div>

            {/* Headline */}
            <Card className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MiniStat label="Orders" value={String(selectedBrief.headline.total_orders)} />
                <MiniStat label="Revenue" value={`₹${Math.round(selectedBrief.headline.total_revenue / 1000)}k`} />
                <MiniStat label="Profit" value={`₹${Math.round(selectedBrief.headline.true_profit / 1000)}k`} />
                <MiniStat label="Margin" value={`${Math.round(selectedBrief.headline.true_margin)}%`} />
              </div>
            </Card>

            {/* Channels */}
            {selectedBrief.channel_performance.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Channels</h3>
                <div className="space-y-1.5">
                  {selectedBrief.channel_performance.map(ch => (
                    <div key={ch.channel} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{ch.channel}</span>
                      <span className="font-medium text-gray-900">{ch.orders} orders · ₹{Math.round(ch.revenue).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Top Products */}
            {selectedBrief.product_performance.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Products</h3>
                <div className="space-y-1.5">
                  {selectedBrief.product_performance.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{p.name}</span>
                      <span className="font-medium text-gray-900">{p.units} units · ₹{Math.round(p.revenue).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Actions */}
            {selectedBrief.actions.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Actions</h3>
                <div className="space-y-1.5">
                  {selectedBrief.actions.map((a, i) => {
                    const dot = a.priority === 'HIGH' ? 'bg-red-500' : a.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-green-500'
                    return (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot}`} />
                        <span>{a.text}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
      {/* WhatsApp export modal */}
      {showExport && selectedBrief && (
        <WhatsAppExportModal
          text={buildWhatsAppText(selectedBrief)}
          copied={copied}
          onCopy={(text) => { navigator.clipboard.writeText(text); setCopied(true) }}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}

function WhatsAppExportModal({
  text, copied, onCopy, onClose,
}: { text: string; copied: boolean; onCopy: (t: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-900">WhatsApp Export</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <textarea
          readOnly
          value={text}
          rows={10}
          className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl p-3 resize-none focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{text.length} characters</span>
          <button
            onClick={() => onCopy(text)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-900 hover:bg-gray-700 text-white'
            }`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy text'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BriefCard({ brief, active, onClick }: { brief: BriefData; active: boolean; onClick: () => void }) {
  const rtoSpiked = brief.delivery_health.spiked

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-colors ${
        active
          ? 'border-brand-600 bg-brand-50'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-sm font-semibold ${active ? 'text-brand-700' : 'text-gray-900'}`}>
          {dayLabel(brief.date)}
        </span>
        {rtoSpiked && (
          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded">RTO ALERT</span>
        )}
      </div>
      <div className="flex gap-3 text-xs text-gray-500">
        <span>{brief.headline.total_orders} orders</span>
        <span>₹{Math.round(brief.headline.total_revenue / 1000)}k</span>
        <span>{Math.round(brief.headline.true_margin)}% margin</span>
      </div>
    </button>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-base font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
