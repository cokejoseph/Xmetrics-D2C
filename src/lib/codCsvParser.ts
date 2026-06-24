/**
 * codCsvParser.ts
 *
 * Flexible parser for Shiprocket COD Remittance CSV files.
 * Detects column positions by fuzzy header matching — handles
 * format variations across Shiprocket versions.
 */

import type { CodRemittanceStatus } from '../types'

export interface ParsedCodRow {
  order_number: string
  awb_number: string | null
  delivery_date: string | null      // ISO date string or null
  collected_amount: number
  remitted_amount: number
  remittance_date: string | null    // ISO date string or null
  deductions: number
  status: CodRemittanceStatus
  shiprocket_ref: string | null
}

export interface CodCsvParseResult {
  rows: ParsedCodRow[]
  skipped: number
  errors: string[]
  detected_columns: Record<string, string>  // field → detected header
}

// Header keyword patterns (case-insensitive)
const PATTERNS: Record<keyof ParsedCodRow, RegExp[]> = {
  order_number:     [/order.?(id|no|number|num)/i, /^order$/i],
  awb_number:       [/awb/i, /tracking/i, /waybill/i],
  delivery_date:    [/deliver/i],
  collected_amount: [/cod.?amount/i, /collect/i, /cash.?collect/i],
  remitted_amount:  [/remit.?amount/i, /remittance.?amount/i, /net.?remit/i],
  remittance_date:  [/remittance.?date/i, /remit.?date/i, /transfer.?date/i],
  deductions:       [/deduct/i, /charge/i],
  status:           [/status/i, /remittance.?status/i],
  shiprocket_ref:   [/utr/i, /ref(erence)?/i, /transaction.?id/i, /neft/i],
}

function parseAmount(v: string): number {
  if (!v) return 0
  const cleaned = v.replace(/[₹,\s"]/g, '').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function parseDate(v: string): string | null {
  if (!v || v.trim() === '' || v.trim() === '-') return null
  const s = v.trim()

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    const year = y.length === 2 ? `20${y}` : y
    const date = new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }

  // MM/DD/YYYY (US format fallback)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    const [, m, d, y] = mdy
    const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }

  // YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const date = new Date(s)
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }

  return null
}

function normalizeStatus(v: string): CodRemittanceStatus {
  const s = v.trim().toLowerCase()
  if (s.includes('remitted') && !s.includes('yet') && !s.includes('not')) return 'REMITTED'
  if (s.includes('short')) return 'SHORT_PAID'
  if (s.includes('deduct')) return 'DEDUCTED'
  if (s.includes('cancel')) return 'CANCELLED'
  return 'PENDING'
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = []
  let cur = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (c === ',' && !inQuote) {
      cols.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  cols.push(cur.trim())
  return cols
}

export function parseCodCsv(csvText: string): CodCsvParseResult {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const errors: string[] = []
  const rows: ParsedCodRow[] = []
  let skipped = 0

  // Find header row (first non-empty line)
  let headerIdx = -1
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].trim()) { headerIdx = i; break }
  }
  if (headerIdx === -1) {
    return { rows: [], skipped: 0, errors: ['Empty file'], detected_columns: {} }
  }

  const headers = parseCsvLine(lines[headerIdx])
  const detected_columns: Record<string, string> = {}

  // Map each known field to the best matching column index
  const colIndex: Partial<Record<keyof ParsedCodRow, number>> = {}
  for (const [field, patterns] of Object.entries(PATTERNS) as [keyof ParsedCodRow, RegExp[]][]) {
    for (let hi = 0; hi < headers.length; hi++) {
      const h = headers[hi].replace(/['"]/g, '').trim()
      if (patterns.some(p => p.test(h))) {
        colIndex[field] = hi
        detected_columns[field] = h
        break
      }
    }
  }

  if (colIndex.order_number === undefined) {
    errors.push('Could not detect order number column. Please check CSV format.')
    return { rows: [], skipped: 0, errors, detected_columns }
  }

  // Parse data rows
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = parseCsvLine(line)
    const get = (field: keyof ParsedCodRow): string => {
      const idx = colIndex[field]
      return idx !== undefined ? (cols[idx] ?? '').replace(/^"|"$/g, '').trim() : ''
    }

    const orderNumber = get('order_number')
    if (!orderNumber || orderNumber === '-') { skipped++; continue }

    rows.push({
      order_number:     orderNumber,
      awb_number:       get('awb_number') || null,
      delivery_date:    parseDate(get('delivery_date')),
      collected_amount: parseAmount(get('collected_amount')),
      remitted_amount:  parseAmount(get('remitted_amount')),
      remittance_date:  parseDate(get('remittance_date')),
      deductions:       parseAmount(get('deductions')),
      status:           normalizeStatus(get('status') || 'PENDING'),
      shiprocket_ref:   get('shiprocket_ref') || null,
    })
  }

  return { rows, skipped, errors, detected_columns }
}
