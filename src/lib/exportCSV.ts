type CellValue = string | number | null | undefined

function escapeCell(v: CellValue): string {
  const s = String(v ?? '')
  // Prevent CSV formula injection: prefix dangerous leading chars with a tab
  const safe = /^[=+\-@\t\r]/.test(s) ? `\t${s}` : s
  return safe.includes(',') || safe.includes('"') || safe.includes('\n')
    ? `"${safe.replace(/"/g, '""')}"`
    : safe
}

export function exportCSV(filename: string, headers: string[], rows: CellValue[][]) {
  const lines = [headers as CellValue[], ...rows].map(row => row.map(escapeCell).join(','))
  const csv = '﻿' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
