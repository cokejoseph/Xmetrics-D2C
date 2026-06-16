export function SkeletonCard() {
  return (
    <div className="skeleton rounded-2xl h-48 w-full" />
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4 rounded w-full"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function SkeletonTableRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-6 rounded w-20" />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonKPICard() {
  return (
    <div className="card p-5">
      <div className="skeleton h-3 rounded w-24 mb-2" />
      <div className="skeleton h-8 rounded w-40 mb-3" />
      <div className="skeleton h-2 rounded w-16" />
    </div>
  )
}
