import { Card } from '../ui'

type ColorVariant = 'default' | 'red' | 'green' | 'amber'

const valueColors: Record<ColorVariant, string> = {
  default: 'text-gray-900 dark:text-white',
  red:     'text-red-600 dark:text-red-400',
  green:   'text-green-600 dark:text-green-400',
  amber:   'text-amber-600 dark:text-amber-400',
}

const subColors: Record<ColorVariant, string> = {
  default: 'text-gray-400',
  red:     'text-red-500 dark:text-red-400',
  green:   'text-green-600 dark:text-green-400',
  amber:   'text-amber-600 dark:text-amber-400',
}

export function KPICard({
  label,
  value,
  sub,
  valueColor = 'default',
  subColor = 'default',
  className,
  pulse = false,
}: {
  label: string
  value: string | number
  sub?: string
  valueColor?: ColorVariant
  subColor?: ColorVariant
  className?: string
  pulse?: boolean
}) {
  return (
    <Card className={`p-4 ${className ?? ''}`}>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
      <p className={`text-[28px] font-semibold tracking-tight tabular-nums leading-none mb-1 ${valueColors[valueColor]} ${pulse ? 'animate-pulse' : ''}`}>
        {value}
      </p>
      {sub && <p className={`text-xs mt-0.5 ${subColors[subColor]}`}>{sub}</p>}
    </Card>
  )
}
