import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useThemeStore } from '../../stores/themeStore'

const ACCENT_LIGHT = '#1658E3'
const ACCENT_DARK  = '#4DA6FF'

const STATUS_COLORS: Record<string, string> = {
  DELIVERED:        '#10b981',
  OUT_FOR_DELIVERY: '#34d399',
  IN_TRANSIT:       '#60a5fa',
  SHIPPED:          '#818cf8',
  PICKUP_SCHEDULED: '#a78bfa',
  READY_FOR_PICKUP: '#c084fc',
  READY_TO_SHIP:    '#f59e0b',
  PACKING:          '#fbbf24',
  PROCESSING:       '#94a3b8',
  CONFIRMED:        '#64748b',
  PENDING:          '#cbd5e1',
  RTO_INITIATED:    '#f87171',
  RTO_DELIVERED:    '#ef4444',
  CANCELLED:        '#9ca3af',
  LOST:             '#6b7280',
}

function getStatusColor(name: string, index: number): string {
  return STATUS_COLORS[name] ?? [
    '#1658E3', '#10b981', '#f59e0b', '#f87171', '#818cf8', '#34d399', '#60a5fa',
  ][index % 7]
}

function useChartTheme() {
  const { dark } = useThemeStore()
  return {
    accent:       dark ? ACCENT_DARK : ACCENT_LIGHT,
    grid:         dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
    tickFill:     dark ? '#4A5E78' : '#94a3b8',
    tickFillAlt:  dark ? '#3A4E68' : '#64748b',
    tooltipBg:    dark ? '#0f1829' : '#ffffff',
    tooltipBorder:dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    tooltipShadow:dark
      ? '0 0 0 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.8)'
      : '0 4px 24px rgba(0,0,0,0.08)',
    tooltipColor: dark ? '#e2e8f0' : '#0f172a',
    donutStroke:  dark ? '#0C1118' : '#ffffff',
    dark,
  }
}

function tooltipStyle(t: ReturnType<typeof useChartTheme>) {
  return {
    background:   t.tooltipBg,
    border:       `1px solid ${t.tooltipBorder}`,
    boxShadow:    t.tooltipShadow,
    borderRadius: '8px',
    fontSize:     '12px',
    padding:      '8px 12px',
    color:        t.tooltipColor,
    fontFamily:   'DM Sans, sans-serif',
  }
}

interface RevenuePoint { label: string; revenue: number; orders: number }

export function RevenueAreaChart({ data }: { data: RevenuePoint[] }) {
  const t = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={t.accent} stopOpacity={t.dark ? 0.22 : 0.12} />
            <stop offset="100%" stopColor={t.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke={t.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: t.tickFill, fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: t.tickFill, fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false}
          tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} width={44} tickCount={5} />
        <Tooltip
          contentStyle={tooltipStyle(t)}
          formatter={(v: unknown) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
          labelStyle={{ color: t.tickFill, fontSize: 11, marginBottom: 2 }}
          cursor={{ stroke: t.accent, strokeWidth: 1, strokeOpacity: 0.3 }}
        />
        <Area
          type="monotone" dataKey="revenue"
          stroke={t.accent} strokeWidth={2}
          fill="url(#revenueGrad)"
          dot={false}
          activeDot={{ r: 4, fill: t.accent, stroke: t.tooltipBg, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function OrdersBarChart({ data }: { data: Array<{ label: string; orders: number }> }) {
  const t = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barSize={12}>
        <CartesianGrid strokeDasharray="0" stroke={t.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: t.tickFill, fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: t.tickFill, fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={tooltipStyle(t)}
          cursor={{ fill: t.dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
          labelStyle={{ color: t.tickFill, fontSize: 11 }}
        />
        <Bar dataKey="orders" fill={t.accent} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface ChannelPoint { channel: string; orders: number; revenue?: number }

export function ChannelBarChart({ data }: { data: ChannelPoint[] }) {
  const t = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 12, bottom: 5, left: 64 }} barSize={8}>
        <CartesianGrid strokeDasharray="0" stroke={t.grid} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: t.tickFill, fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} />
        <YAxis dataKey="channel" type="category" tick={{ fontSize: 11, fill: t.tickFillAlt, fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={tooltipStyle(t)}
          cursor={{ fill: t.dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
          labelStyle={{ color: t.tickFill, fontSize: 11 }}
        />
        <Bar dataKey="orders" fill={t.accent} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface DonutData { name: string; value: number }

function DonutLegend({ data }: { data: DonutData[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-4 px-2">
      {data.map((entry, i) => (
        <div key={entry.name} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: getStatusColor(entry.name, i) }}
            aria-hidden="true"
          />
          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            {entry.name.replace(/_/g, ' ')}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">({entry.value})</span>
        </div>
      ))}
    </div>
  )
}

export function StatusDonut({ data }: { data: DonutData[] }) {
  const t = useChartTheme()
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
            data={sorted} cx="50%" cy="50%"
            innerRadius={52} outerRadius={78}
            paddingAngle={sorted.length > 1 ? 2 : 0}
            dataKey="value" startAngle={90} endAngle={-270}
          >
            {sorted.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={getStatusColor(entry.name, index)}
                stroke={t.donutStroke}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle(t)}
            formatter={(v: unknown, name: unknown) => [Number(v), String(name).replace(/_/g, ' ')]}
            labelStyle={{ display: 'none' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <DonutLegend data={sorted} />
    </div>
  )
}
