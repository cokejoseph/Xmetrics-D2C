import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const ACCENT = '#6B8AB8'

// 4-bucket semantic palette — reduces visual noise in the donut
const STATUS_COLORS: Record<string, string> = {
  DELIVERED:        '#22C55E',
  OUT_FOR_DELIVERY: '#34D399',
  IN_TRANSIT:       '#6B8AB8',
  SHIPPED:          '#93B5D4',
  PICKUP_SCHEDULED: '#A5B4FC',
  READY_FOR_PICKUP: '#C4B5FD',
  READY_TO_SHIP:    '#FCD34D',
  PACKING:          '#FDE68A',
  PROCESSING:       '#94A3B8',
  CONFIRMED:        '#CBD5E1',
  PENDING:          '#E2E8F0',
  RTO_INITIATED:    '#F87171',
  RTO_DELIVERED:    '#EF4444',
  CANCELLED:        '#D1D5DB',
  LOST:             '#9CA3AF',
}

function getStatusColor(name: string, index: number): string {
  return STATUS_COLORS[name] ?? [
    ACCENT, '#93B5D4', '#34D399', '#FCD34D', '#F87171', '#A5B4FC', '#94A3B8',
  ][index % 7]
}

interface RevenuePoint { label: string; revenue: number; orders: number }

export function RevenueAreaChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.1} />
            <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', fontSize: 12, padding: '6px 10px', background: '#fff' }}
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
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', fontSize: 12, padding: '6px 10px', background: '#fff' }} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis dataKey="channel" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', fontSize: 12, padding: '6px 10px', background: '#fff' }} />
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
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', fontSize: 12, padding: '6px 10px', background: '#fff' }}
            formatter={(v: unknown, name: unknown) => [Number(v), String(name).replace(/_/g, ' ')]}
          />
        </PieChart>
      </ResponsiveContainer>
      <DonutLegend data={sorted} />
    </div>
  )
}

