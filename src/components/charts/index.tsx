import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const ACCENT = '#6366F1'
const ACCENT_LIGHT = '#818CF8'

// Semantic colors per fulfilment status — intentionally distinct
const STATUS_COLORS: Record<string, string> = {
  PENDING:          '#94A3B8',
  CONFIRMED:        '#6366F1',
  PROCESSING:       '#8B5CF6',
  PACKING:          '#A78BFA',
  READY_TO_SHIP:    '#F59E0B',
  READY_FOR_PICKUP: '#F97316',
  PICKUP_SCHEDULED: '#FB923C',
  IN_TRANSIT:       '#0EA5E9',
  SHIPPED:          '#06B6D4',
  OUT_FOR_DELIVERY: '#10B981',
  DELIVERED:        '#22C55E',
  RTO_INITIATED:    '#EF4444',
  RTO_DELIVERED:    '#DC2626',
  CANCELLED:        '#6B7280',
  LOST:             '#991B1B',
}

function getStatusColor(name: string, index: number): string {
  return STATUS_COLORS[name] ?? [
    ACCENT, '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#0EA5E9', '#F97316',
  ][index % 7]
}

interface RevenuePoint { label: string; revenue: number; orders: number }

export function RevenueAreaChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.18} />
            <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF2FF" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ border: 'none', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: 12, padding: '8px 12px' }}
          formatter={(v: unknown) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
        />
        <Area type="monotone" dataKey="revenue" stroke={ACCENT} strokeWidth={2.5}
          fill="url(#revenueGrad)" dot={false} activeDot={{ r: 4, fill: ACCENT }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function OrdersBarChart({ data }: { data: Array<{ label: string; orders: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF2FF" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ border: 'none', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: 12, padding: '8px 12px' }} />
        <Bar dataKey="orders" fill={ACCENT} radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface ChannelPoint { channel: string; orders: number; revenue?: number }

export function ChannelBarChart({ data }: { data: ChannelPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 12, bottom: 5, left: 64 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF2FF" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis dataKey="channel" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ border: 'none', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: 12, padding: '8px 12px' }} />
        <Bar dataKey="orders" fill={ACCENT} radius={[0, 5, 5, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface DonutData { name: string; value: number }

// Custom legend rendered as a tidy 2-column pill grid
function DonutLegend({ data }: { data: DonutData[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-3">
      {data.map((entry, i) => (
        <div key={entry.name} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: getStatusColor(entry.name, i) }}
          />
          <span className="text-[11px] text-gray-500 font-medium">
            {entry.name.replace(/_/g, ' ')}
          </span>
          <span className="text-[11px] text-gray-400">({entry.value})</span>
        </div>
      ))}
    </div>
  )
}

export function StatusDonut({ data }: { data: DonutData[] }) {
  // Sort: delivered first, then in-progress, then problems
  const ORDER: Record<string, number> = {
    DELIVERED: 0, OUT_FOR_DELIVERY: 1, IN_TRANSIT: 2, SHIPPED: 3,
    PICKUP_SCHEDULED: 4, READY_FOR_PICKUP: 5, READY_TO_SHIP: 6,
    PACKING: 7, PROCESSING: 8, CONFIRMED: 9, PENDING: 10,
    RTO_INITIATED: 11, RTO_DELIVERED: 12, CANCELLED: 13, LOST: 14,
  }
  const sorted = [...data].sort((a, b) => (ORDER[a.name] ?? 99) - (ORDER[b.name] ?? 99))

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={sorted}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={sorted.length > 1 ? 2 : 0}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
          >
            {sorted.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={getStatusColor(entry.name, index)}
                stroke="white"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ border: 'none', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: 12, padding: '8px 12px' }}
            formatter={(v: unknown, name: unknown) => [Number(v), String(name).replace(/_/g, ' ')]}
          />
        </PieChart>
      </ResponsiveContainer>
      <DonutLegend data={sorted} />
    </div>
  )
}

export function MiniLineChart({ data, dataKey, color = ACCENT_LIGHT }: {
  data: Array<Record<string, unknown>>
  dataKey: string
  color?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={60}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`mini-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
          fill={`url(#mini-${dataKey})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
