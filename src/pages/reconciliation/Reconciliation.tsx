import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Scale, Upload, RefreshCw, Printer, CheckCircle2,
  AlertCircle, ChevronLeft, ChevronRight, Loader2,
  FileText, CreditCard, Download, X,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { DEMO_MODE, callAuthEdgeFunction } from '../../lib/supabase'
import { parseCodCsv } from '../../lib/codCsvParser'
import { printReconciliationReport } from '../../lib/reconciliationPdf'
import { exportCSV } from '../../lib/exportCSV'
import type {
  ReconciliationRow, ReconRowStatus, RazorpayPaymentSynced,
} from '../../types'
import type { ParsedCodRow } from '../../lib/codCsvParser'

// ── Helpers ───────────────────────────────────────────────────────────────────

const inr = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function getPeriodLabel(month: string) {
  const [y, m] = month.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function monthToRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  // Use local getters — toISOString() gives UTC which drifts by timezone offset
  const fmt = (d: Date) => [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
  return {
    start: fmt(new Date(y, m - 1, 1)),
    end:   fmt(new Date(y, m, 0)),    // day 0 of next month = last day of this month
  }
}

function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReconRowStatus, { label: string; dot: string; text: string; bg: string }> = {
  MATCHED:    { label: 'Matched',    dot: 'bg-green-400', text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
  PENDING:    { label: 'Pending',    dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  SHORT_PAID: { label: 'Short-Paid', dot: 'bg-orange-400', text: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  UNREMITTED: { label: 'Unremitted', dot: 'bg-red-400', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  CANCELLED:  { label: 'Cancelled',  dot: 'bg-gray-300', text: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/30' },
}

function StatusBadge({ status }: { status: ReconRowStatus }) {
  const c = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ── Demo seed data ─────────────────────────────────────────────────────────────

function buildDemoRows(month: string): { cod: ReconciliationRow[]; prepaid: ReconciliationRow[] } {
  // Generate dates within the given month so they always pass the date filter
  const { start } = monthToRange(month)
  const [y, m] = start.split('-').map(Number)
  const d = (day: number) => `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const cod: ReconciliationRow[] = [
    { order_number: '#1001', order_id: null, awb_number: 'AWB123456', customer_name: 'Priya Sharma',  order_date: d(3),  delivery_date: d(6),  payment_method: 'COD', order_amount: 1499, collected_amount: 1499, remitted_amount: 1499, discrepancy: 0,    gateway_fee: 0, status: 'MATCHED',    razorpay_payment_id: null, shiprocket_ref: 'UTR123' },
    { order_number: '#1004', order_id: null, awb_number: 'AWB123457', customer_name: 'Rahul Verma',   order_date: d(5),  delivery_date: d(8),  payment_method: 'COD', order_amount: 2199, collected_amount: 2199, remitted_amount: 2000, discrepancy: 199,  gateway_fee: 0, status: 'SHORT_PAID', razorpay_payment_id: null, shiprocket_ref: 'UTR124' },
    { order_number: '#1007', order_id: null, awb_number: 'AWB123458', customer_name: 'Anjali Gupta',  order_date: d(7),  delivery_date: d(11), payment_method: 'COD', order_amount: 899,  collected_amount: 899,  remitted_amount: 0,    discrepancy: 899,  gateway_fee: 0, status: 'PENDING',    razorpay_payment_id: null, shiprocket_ref: null },
    { order_number: '#1012', order_id: null, awb_number: 'AWB123461', customer_name: 'Karthik Iyer',  order_date: d(10), delivery_date: d(14), payment_method: 'COD', order_amount: 3499, collected_amount: 3499, remitted_amount: 0,    discrepancy: 3499, gateway_fee: 0, status: 'UNREMITTED', razorpay_payment_id: null, shiprocket_ref: null },
    { order_number: '#1015', order_id: null, awb_number: null,         customer_name: 'Meera Pillai',  order_date: d(12), delivery_date: null,  payment_method: 'COD', order_amount: 1249, collected_amount: 0,    remitted_amount: 0,    discrepancy: 0,    gateway_fee: 0, status: 'CANCELLED',  razorpay_payment_id: null, shiprocket_ref: null },
  ]
  const prepaid: ReconciliationRow[] = [
    { order_number: '#1002', order_id: null, awb_number: null, customer_name: 'Vikram Nair',  order_date: d(4),  delivery_date: d(7),  payment_method: 'PREPAID', order_amount: 4999, collected_amount: 4999, remitted_amount: 4852.03, discrepancy: 0,    gateway_fee: 146.97, status: 'MATCHED',    razorpay_payment_id: 'pay_NXyZ1234', shiprocket_ref: null },
    { order_number: '#1005', order_id: null, awb_number: null, customer_name: 'Sunita Reddy', order_date: d(6),  delivery_date: d(9),  payment_method: 'PREPAID', order_amount: 2799, collected_amount: 2799, remitted_amount: 2717.07, discrepancy: 0,    gateway_fee: 81.93,  status: 'MATCHED',    razorpay_payment_id: 'pay_NXyZ5678', shiprocket_ref: null },
    { order_number: '#1009', order_id: null, awb_number: null, customer_name: 'Arjun Mehta',  order_date: d(9),  delivery_date: d(12), payment_method: 'PREPAID', order_amount: 1999, collected_amount: 1999, remitted_amount: 0,       discrepancy: 1999, gateway_fee: 58.47,  status: 'UNREMITTED', razorpay_payment_id: 'pay_NXyZ9012', shiprocket_ref: null },
  ]
  return { cod, prepaid }
}

// ── Main page component ───────────────────────────────────────────────────────

export default function Reconciliation() {
  useEffect(() => { document.title = 'Reconciliation · Xmetrics' }, [])

  const { orders, integrations, currentBrand } = useAppStore()
  const brandId = currentBrand?.id ?? ''
  const brandName = currentBrand?.name ?? 'My Brand'

  const rzpIntegration = integrations.find(i => i.platform === 'RAZORPAY' && i.status === 'CONNECTED')

  // ── State ──────────────────────────────────────────────────────────────────
  const [month, setMonth] = useState(currentMonthStr)
  const [activeTab, setActiveTab] = useState<'cod' | 'prepaid'>('cod')
  const [statusFilter, setStatusFilter] = useState<ReconRowStatus | 'ALL'>('ALL')

  const [rzpSyncing, setRzpSyncing]   = useState(false)
  const [rzpPayments, setRzpPayments] = useState<RazorpayPaymentSynced[] | null>(null)
  const [rzpError, setRzpError]       = useState('')

  const [csvFile, setCsvFile]     = useState<File | null>(null)
  const [csvParsed, setCsvParsed] = useState<ParsedCodRow[] | null>(null)
  const [csvError, setCsvError]   = useState('')
  const [uploadId, setUploadId]   = useState<string | null>(null)

  const [running, setRunning]         = useState(false)
  const [codRows, setCodRows]         = useState<ReconciliationRow[] | null>(null)
  const [prepaidRows, setPrepaidRows] = useState<ReconciliationRow[] | null>(null)

  // Date range filter — defaults to the full selected month
  const [dateFrom, setDateFrom] = useState(() => monthToRange(currentMonthStr()).start)
  const [dateTo,   setDateTo]   = useState(() => monthToRange(currentMonthStr()).end)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasCodData     = csvParsed !== null
  const hasPrepaidData = rzpPayments !== null || DEMO_MODE
  const canRun         = hasCodData || hasPrepaidData

  // ── Razorpay sync ──────────────────────────────────────────────────────────
  const syncRazorpay = useCallback(async () => {
    if (DEMO_MODE) {
      setRzpPayments([])
      return
    }
    if (!rzpIntegration) { setRzpError('No connected Razorpay integration. Add it in Settings → Integrations.'); return }
    setRzpSyncing(true)
    setRzpError('')
    try {
      const { start, end } = monthToRange(month)
      const res = await callAuthEdgeFunction('razorpay-proxy', {
        action: 'sync_range',
        key_id: rzpIntegration.credentials.key_id,
        key_secret: rzpIntegration.credentials.key_secret,
        from_date: start,
        to_date: end,
      }) as { ok: boolean; payments: RazorpayPaymentSynced[]; error?: string }
      if (!res.ok) throw new Error(res.error ?? 'Razorpay sync failed')
      setRzpPayments(res.payments)
    } catch (e) {
      setRzpError(e instanceof Error ? e.message : 'Razorpay sync failed')
    } finally {
      setRzpSyncing(false)
    }
  }, [month, rzpIntegration])

  // ── CSV file handling ──────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setCsvError('')
    setCsvFile(file)
    setCsvParsed(null)
    setUploadId(null)
    const text = await file.text()
    const result = parseCodCsv(text)
    if (result.errors.length > 0 && result.rows.length === 0) {
      setCsvError(result.errors[0])
      return
    }
    setCsvParsed(result.rows)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile(file)
    else setCsvError('Please upload a .csv file')
  }, [handleFile])

  // ── Run reconciliation ─────────────────────────────────────────────────────
  const runReconciliation = useCallback(async () => {
    if (DEMO_MODE) {
      const demo = buildDemoRows(month)
      setCodRows(demo.cod)
      setPrepaidRows(demo.prepaid)
      return
    }

    setRunning(true)
    const { start, end } = monthToRange(month)

    // Get COD orders from local store for the period
    const periodOrders = orders.filter(o => {
      const d = o.created_at.slice(0, 10)
      return d >= start && d <= end
    })

    // Upload COD CSV rows if not already uploaded
    let currentUploadId = uploadId
    if (csvParsed && !currentUploadId) {
      try {
        const res = await callAuthEdgeFunction('reconciliation-engine', {
          action: 'upload_cod_csv',
          brand_id: brandId,
          filename: csvFile?.name ?? 'remittance.csv',
          period_start: start,
          period_end: end,
          rows: csvParsed,
        }) as { ok: boolean; upload_id: string; error?: string }
        if (!res.ok) throw new Error(res.error)
        currentUploadId = res.upload_id
        setUploadId(currentUploadId)
      } catch (e) {
        setCsvError(e instanceof Error ? e.message : 'CSV upload failed')
        setRunning(false)
        return
      }
    }

    // Build COD reconciliation rows
    const codOrdersInPeriod = periodOrders.filter(o => o.payment_method === 'COD')
    const csvRowMap = new Map<string, ParsedCodRow>()
    for (const r of csvParsed ?? []) csvRowMap.set(r.order_number, r)

    const newCodRows: ReconciliationRow[] = codOrdersInPeriod.map(order => {
      const csvRow = csvRowMap.get(order.order_number)
      const orderAmount = order.gross_amount - order.discount_amount
      if (!csvRow) {
        return {
          order_number: order.order_number,
          order_id: order.id,
          awb_number: order.shipments?.[0]?.awb_number ?? null,
          customer_name: order.customer?.name ?? null,
          order_date: order.created_at.slice(0, 10),
          delivery_date: order.shipments?.[0]?.delivered_at?.slice(0, 10) ?? null,
          payment_method: 'COD',
          order_amount: orderAmount,
          collected_amount: 0,
          remitted_amount: 0,
          discrepancy: orderAmount,
          gateway_fee: 0,
          status: 'UNREMITTED',
          razorpay_payment_id: null,
          shiprocket_ref: null,
        }
      }
      let status: ReconRowStatus = 'MATCHED'
      if (csvRow.status === 'CANCELLED') status = 'CANCELLED'
      else if (csvRow.status === 'PENDING' || csvRow.status === 'DEDUCTED') status = 'PENDING'
      else if (csvRow.status === 'SHORT_PAID') status = 'SHORT_PAID'
      const discrepancy = csvRow.collected_amount - csvRow.remitted_amount - csvRow.deductions
      return {
        order_number: order.order_number,
        order_id: order.id,
        awb_number: csvRow.awb_number ?? order.shipments?.[0]?.awb_number ?? null,
        customer_name: order.customer?.name ?? null,
        order_date: order.created_at.slice(0, 10),
        delivery_date: csvRow.delivery_date,
        payment_method: 'COD',
        order_amount: orderAmount,
        collected_amount: csvRow.collected_amount,
        remitted_amount: csvRow.remitted_amount,
        discrepancy: status === 'MATCHED' ? 0 : Math.max(0, discrepancy),
        gateway_fee: 0,
        status,
        razorpay_payment_id: null,
        shiprocket_ref: csvRow.shiprocket_ref,
      }
    })

    // Build prepaid reconciliation rows
    const prepaidOrdersInPeriod = periodOrders.filter(o => o.payment_method !== 'COD')
    const rzpMap = new Map<string, RazorpayPaymentSynced>()
    for (const p of rzpPayments ?? []) {
      const orderNum = p.notes?.order_number ?? p.notes?.merchant_order_id
      if (orderNum) rzpMap.set(orderNum, p)
    }

    const newPrepaidRows: ReconciliationRow[] = prepaidOrdersInPeriod.map(order => {
      const rzpPayment = rzpMap.get(order.order_number) ??
        (order.razorpay_payment_id
          ? (rzpPayments ?? []).find(p => p.id === order.razorpay_payment_id) ?? null
          : null)
      const orderAmount = order.gross_amount - order.discount_amount
      if (!rzpPayment) {
        return {
          order_number: order.order_number,
          order_id: order.id,
          awb_number: null,
          customer_name: order.customer?.name ?? null,
          order_date: order.created_at.slice(0, 10),
          delivery_date: null,
          payment_method: 'PREPAID',
          order_amount: orderAmount,
          collected_amount: 0,
          remitted_amount: 0,
          discrepancy: orderAmount,
          gateway_fee: 0,
          status: 'UNREMITTED',
          razorpay_payment_id: order.razorpay_payment_id ?? null,
          shiprocket_ref: null,
        }
      }
      return {
        order_number: order.order_number,
        order_id: order.id,
        awb_number: null,
        customer_name: order.customer?.name ?? null,
        order_date: order.created_at.slice(0, 10),
        delivery_date: null,
        payment_method: 'PREPAID',
        order_amount: orderAmount,
        collected_amount: rzpPayment.amount,
        remitted_amount: rzpPayment.settlement_amount,
        discrepancy: 0,
        gateway_fee: rzpPayment.fee + rzpPayment.tax,
        status: 'MATCHED',
        razorpay_payment_id: rzpPayment.id,
        shiprocket_ref: null,
      }
    })

    setCodRows(newCodRows)
    setPrepaidRows(newPrepaidRows)

    // Persist report summary
    const cod_discrepancy = newCodRows.reduce((s, r) => s + r.discrepancy, 0)
    try {
      await callAuthEdgeFunction('reconciliation-engine', {
        action: 'save_report',
        brand_id: brandId,
        period_start: start,
        period_end: end,
        report_type: csvParsed && rzpPayments ? 'COMBINED' : csvParsed ? 'COD' : 'PREPAID',
        cod_orders: newCodRows.length,
        cod_order_value: newCodRows.reduce((s, r) => s + r.order_amount, 0),
        cod_collected: newCodRows.reduce((s, r) => s + r.collected_amount, 0),
        cod_remitted: newCodRows.reduce((s, r) => s + r.remitted_amount, 0),
        cod_pending_count: newCodRows.filter(r => r.status === 'PENDING').length,
        cod_short_paid_count: newCodRows.filter(r => r.status === 'SHORT_PAID').length,
        cod_unremitted_count: newCodRows.filter(r => r.status === 'UNREMITTED').length,
        cod_discrepancy,
        prepaid_orders: newPrepaidRows.length,
        prepaid_collected: newPrepaidRows.reduce((s, r) => s + r.collected_amount, 0),
        prepaid_fees: newPrepaidRows.reduce((s, r) => s + r.gateway_fee, 0),
        prepaid_settled: newPrepaidRows.reduce((s, r) => s + r.remitted_amount, 0),
        cod_upload_id: currentUploadId,
      })
    } catch { /* Non-blocking — report still shows even if save fails */ }

    setRunning(false)
  }, [month, orders, csvParsed, rzpPayments, csvFile, uploadId, brandId])

  // ── Derived state ──────────────────────────────────────────────────────────
  const allRows = [...(codRows ?? []), ...(prepaidRows ?? [])]
  const displayRows = (activeTab === 'cod' ? codRows : prepaidRows) ?? []

  // Apply date range filter to the current tab's rows
  const dateFilteredRows = displayRows.filter(r => {
    const d = r.order_date ?? ''
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo)
  })

  const filteredRows = statusFilter === 'ALL'
    ? dateFilteredRows
    : dateFilteredRows.filter(r => r.status === statusFilter)

  const summary = {
    totalOrders:     allRows.length,
    totalGMV:        allRows.reduce((s, r) => s + r.order_amount, 0),
    totalCollected:  allRows.reduce((s, r) => s + r.collected_amount, 0),
    totalRemitted:   allRows.reduce((s, r) => s + r.remitted_amount, 0),
    totalFees:       allRows.reduce((s, r) => s + r.gateway_fee, 0),
    totalDiscrepancy: allRows.reduce((s, r) => s + r.discrepancy, 0),
  }

  const hasReport = codRows !== null || prepaidRows !== null

  // Status counts reflect the date-filtered rows
  const statusCounts: Record<ReconRowStatus, number> = {
    MATCHED: 0, PENDING: 0, SHORT_PAID: 0, UNREMITTED: 0, CANCELLED: 0,
  }
  for (const r of dateFilteredRows) statusCounts[r.status]++

  const isDateFiltered =
    dateFrom !== monthToRange(month).start || dateTo !== monthToRange(month).end

  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const rows = filteredRows
    const tab = activeTab === 'cod' ? 'COD' : 'Prepaid'
    const filename = `reconciliation-${tab}-${dateFrom}-to-${dateTo}.csv`
    exportCSV(
      filename,
      ['Order #', 'Customer', 'Order Date', 'Payment Method', 'GMV (₹)', 'Collected (₹)',
       'Remitted / Settled (₹)', 'Gateway Fees (₹)', 'Discrepancy (₹)', 'Status',
       'AWB / Payment ID', 'Shiprocket Ref'],
      rows.map(r => [
        r.order_number,
        r.customer_name ?? '',
        r.order_date ?? '',
        r.payment_method,
        r.order_amount,
        r.collected_amount,
        r.remitted_amount,
        r.gateway_fee || '',
        r.discrepancy || '',
        r.status,
        r.awb_number ?? r.razorpay_payment_id ?? '',
        r.shiprocket_ref ?? '',
      ])
    )
  }

  // ── Month navigation ───────────────────────────────────────────────────────
  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setMonth(newMonth)
    const { start, end } = monthToRange(newMonth)
    setDateFrom(start)
    setDateTo(end)
    // Reset data on period change
    setRzpPayments(null); setCsvParsed(null); setCsvFile(null)
    setCodRows(null); setPrepaidRows(null); setUploadId(null)
    setRzpError(''); setCsvError('')
  }

  // ── PDF export ─────────────────────────────────────────────────────────────
  const handlePrint = () => {
    printReconciliationReport({
      brandName,
      periodLabel: getPeriodLabel(month),
      reportType: csvParsed && rzpPayments ? 'COMBINED' : csvParsed ? 'COD' : 'PREPAID',
      codRows: codRows ?? [],
      prepaidRows: prepaidRows ?? [],
      summary,
    })
  }

  return (
    <div className="space-y-5 pb-10">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-brand-600" />
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Reconciliation</h1>
            {DEMO_MODE && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                Demo
              </span>
            )}
          </div>
          <p className="text-[13px] text-gray-400 mt-0.5">Monthly COD &amp; prepaid payment reconciliation</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month picker */}
          <div className="flex items-center gap-0 border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => changeMonth(-1)}
              className="px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-500 dark:text-gray-400"
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 text-[13px] font-medium text-gray-700 dark:text-gray-200 min-w-[120px] text-center">
              {getPeriodLabel(month)}
            </span>
            <button
              onClick={() => changeMonth(1)}
              disabled={month >= currentMonthStr()}
              className="px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-500 dark:text-gray-400 disabled:opacity-30"
              aria-label="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {hasReport && (
            <>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-700 dark:text-gray-200"
                title={`Export ${filteredRows.length} rows as CSV`}
              >
                <Download size={14} />
                Export CSV
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-700 dark:text-gray-200"
              >
                <Printer size={14} />
                Export PDF
              </button>
            </>
          )}

          <button
            onClick={canRun ? runReconciliation : undefined}
            disabled={!canRun || running}
            className={[
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors',
              canRun && !running
                ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
                : 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
            {running ? 'Reconciling…' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* ── Data sources ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Razorpay sync */}
        <div className="rounded-xl border border-gray-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <CreditCard size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-gray-900 dark:text-white">Prepaid — Razorpay</p>
              <p className="text-[11px] text-gray-400">Fetch settled payments for {getPeriodLabel(month)}</p>
            </div>
            {rzpPayments !== null && (
              <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 size={13} />
                {rzpPayments.length} payments
              </span>
            )}
          </div>

          {rzpError && (
            <p className="text-[12px] text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle size={12} /> {rzpError}
            </p>
          )}

          {!rzpIntegration && !DEMO_MODE && (
            <p className="text-[12px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={12} /> Connect Razorpay in Settings → Integrations first
            </p>
          )}

          <button
            onClick={syncRazorpay}
            disabled={rzpSyncing || (!rzpIntegration && !DEMO_MODE)}
            className={[
              'flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-lg transition-colors w-full justify-center',
              rzpPayments !== null
                ? 'border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/30',
              (rzpSyncing || (!rzpIntegration && !DEMO_MODE)) && 'opacity-50 cursor-not-allowed',
            ].join(' ')}
          >
            {rzpSyncing
              ? <><Loader2 size={14} className="animate-spin" /> Syncing…</>
              : <><RefreshCw size={14} /> {rzpPayments !== null ? 'Re-sync Razorpay' : 'Sync Razorpay Payments'}</>
            }
          </button>
        </div>

        {/* Shiprocket COD CSV */}
        <div className="rounded-xl border border-gray-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <FileText size={14} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-gray-900 dark:text-white">COD — Shiprocket</p>
              <p className="text-[11px] text-gray-400">Upload COD Remittance CSV from Shiprocket Billing</p>
            </div>
            {csvParsed !== null && (
              <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 size={13} />
                {csvParsed.length} rows
              </span>
            )}
          </div>

          {csvFile && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {csvFile.name} — {csvParsed?.length ?? 0} valid rows parsed
            </p>
          )}

          {csvError && (
            <p className="text-[12px] text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle size={12} /> {csvError}
            </p>
          )}

          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={[
              'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
              csvParsed
                ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10'
                : 'border-gray-200 dark:border-white/10 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-gray-50 dark:hover:bg-white/5',
            ].join(' ')}
          >
            <Upload size={16} className={csvParsed ? 'mx-auto text-green-500' : 'mx-auto text-gray-400'} />
            <p className="text-[12px] mt-1.5 text-gray-500 dark:text-gray-400">
              {csvParsed
                ? 'Click to replace CSV'
                : 'Drop CSV here or click to upload'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Billing → COD Remittance → Export CSV
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
            />
          </div>
        </div>
      </div>

      {/* ── Summary cards (shown after report) ── */}
      {hasReport && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Orders',   value: summary.totalOrders.toString(), sub: null },
            { label: 'Gross GMV',      value: inr(summary.totalGMV),         sub: null },
            { label: 'Total Collected',value: inr(summary.totalCollected),    sub: 'COD + Prepaid' },
            { label: 'Total Remitted', value: inr(summary.totalRemitted),     sub: 'After fees' },
            { label: 'Gateway Fees',   value: inr(summary.totalFees),         sub: 'Razorpay charges' },
            {
              label: 'Discrepancy',
              value: summary.totalDiscrepancy > 0 ? inr(summary.totalDiscrepancy) : '—',
              sub: summary.totalDiscrepancy > 0 ? 'Action required' : 'All clear',
              danger: summary.totalDiscrepancy > 0,
            },
          ].map(card => (
            <div
              key={card.label}
              className={[
                'rounded-xl border p-4 space-y-1',
                (card as { danger?: boolean }).danger
                  ? 'border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-900/10'
                  : 'border-gray-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.02]',
              ].join(' ')}
            >
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{card.label}</p>
              <p className={[
                'text-[15px] font-semibold tabular-nums',
                (card as { danger?: boolean }).danger
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-white',
              ].join(' ')}>{card.value}</p>
              {card.sub && <p className="text-[10px] text-gray-400">{card.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Detail table ── */}
      {hasReport && (
        <div className="rounded-xl border border-gray-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-100 dark:border-white/[0.07] flex items-center gap-0">
            {(['cod', 'prepaid'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setStatusFilter('ALL') }}
                className={[
                  'px-5 py-3 text-[13px] font-medium transition-colors border-b-2',
                  activeTab === tab
                    ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                ].join(' ')}
              >
                {tab === 'cod' ? `COD Remittance (${codRows?.length ?? 0})` : `Prepaid Settlement (${prepaidRows?.length ?? 0})`}
              </button>
            ))}
          </div>

          {/* Date range filter */}
          <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap border-b border-gray-100 dark:border-white/[0.07] bg-gray-50/50 dark:bg-white/[0.01]">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 shrink-0">Order date</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                min={monthToRange(month).start}
                max={dateTo || monthToRange(month).end}
                onChange={e => { setDateFrom(e.target.value); setStatusFilter('ALL') }}
                className="text-[12px] px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              <span className="text-[11px] text-gray-400">to</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || monthToRange(month).start}
                max={monthToRange(month).end}
                onChange={e => { setDateTo(e.target.value); setStatusFilter('ALL') }}
                className="text-[12px] px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            {isDateFiltered && (
              <button
                onClick={() => { const r = monthToRange(month); setDateFrom(r.start); setDateTo(r.end); setStatusFilter('ALL') }}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Reset date filter"
              >
                <X size={12} /> Reset
              </button>
            )}
            <span className="ml-auto text-[11px] text-gray-400">
              {dateFilteredRows.length} order{dateFilteredRows.length !== 1 ? 's' : ''} in range
            </span>
          </div>

          {/* Status filter chips */}
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap border-b border-gray-50 dark:border-white/[0.04]">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={[
                'text-[11px] font-medium px-3 py-1 rounded-full transition-colors',
                statusFilter === 'ALL'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/15',
              ].join(' ')}
            >
              All ({dateFilteredRows.length})
            </button>
            {(Object.entries(statusCounts) as [ReconRowStatus, number][])
              .filter(([, count]) => count > 0)
              .map(([status, count]) => {
                const c = STATUS_CONFIG[status]
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={[
                      'flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full transition-colors',
                      statusFilter === status
                        ? `${c.bg} ${c.text}`
                        : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/15',
                    ].join(' ')}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {c.label} ({count})
                  </button>
                )
              })}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/[0.07]">
                  {['Order #', 'Customer', 'Date', 'GMV', 'Collected', 'Remitted / Settled', 'Fees', 'Discrepancy', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-[13px] text-gray-400">
                      No orders match this filter
                    </td>
                  </tr>
                ) : filteredRows.map(row => (
                  <tr key={row.order_number} className="border-b border-gray-50 dark:border-white/[0.04] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium text-gray-900 dark:text-white">
                      {row.order_number}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-600 dark:text-gray-300">
                      {row.customer_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.order_date?.slice(0, 10) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700 dark:text-gray-200 tabular-nums whitespace-nowrap">
                      {inr(row.order_amount)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700 dark:text-gray-200 tabular-nums whitespace-nowrap">
                      {row.collected_amount > 0 ? inr(row.collected_amount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700 dark:text-gray-200 tabular-nums whitespace-nowrap">
                      {row.remitted_amount > 0 ? inr(row.remitted_amount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                      {row.gateway_fee > 0 ? inr(row.gateway_fee) : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {row.discrepancy > 0 ? (
                        <span className="text-[13px] font-medium text-red-600 dark:text-red-400">
                          {inr(row.discrepancy)}
                        </span>
                      ) : (
                        <span className="text-[12px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          {filteredRows.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-50 dark:border-white/[0.04] flex items-center justify-between">
              <p className="text-[12px] text-gray-400">
                {filteredRows.length} order{filteredRows.length !== 1 ? 's' : ''} shown
              </p>
              {filteredRows.some(r => r.discrepancy > 0) && (
                <p className="text-[12px] font-medium text-red-600 dark:text-red-400">
                  Total discrepancy: {inr(filteredRows.reduce((s, r) => s + r.discrepancy, 0))}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state (no report yet) ── */}
      {!hasReport && !running && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 p-12 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center">
            <Scale size={22} className="text-gray-400" />
          </div>
          <p className="text-[14px] font-medium text-gray-700 dark:text-gray-200">No report generated yet</p>
          <p className="text-[13px] text-gray-400 max-w-sm mx-auto">
            Sync Razorpay for prepaid reconciliation, upload your Shiprocket COD Remittance CSV, then click Generate Report.
          </p>
          {DEMO_MODE && (
            <button
              onClick={runReconciliation}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-brand-600 hover:bg-brand-500 text-white transition-colors"
            >
              <Scale size={14} /> Generate Demo Report
            </button>
          )}
        </div>
      )}
    </div>
  )
}
