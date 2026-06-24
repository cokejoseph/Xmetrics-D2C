/**
 * reconciliationPdf.ts
 *
 * Generates a PDF-ready print view of the reconciliation report.
 * Uses window.print() with print-specific CSS injected into a hidden div —
 * no third-party PDF library required.
 */

import type { ReconciliationRow } from '../types'

const inr = (n: number) =>
  '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_LABEL: Record<string, string> = {
  MATCHED: 'Matched',
  PENDING: 'Pending',
  SHORT_PAID: 'Short-Paid',
  UNREMITTED: 'Unremitted',
  CANCELLED: 'Cancelled',
}

export function printReconciliationReport(params: {
  brandName: string
  periodLabel: string
  reportType: 'COD' | 'PREPAID' | 'COMBINED'
  codRows: ReconciliationRow[]
  prepaidRows: ReconciliationRow[]
  summary: {
    totalOrders: number
    totalGMV: number
    totalCollected: number
    totalRemitted: number
    totalFees: number
    totalDiscrepancy: number
  }
}) {
  const { brandName, periodLabel, reportType, codRows, prepaidRows, summary } = params
  const now = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const rowHtml = (rows: ReconciliationRow[], label: string) => {
    if (rows.length === 0) return ''
    return `
      <div class="section">
        <h3>${label}</h3>
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Order Date</th>
              <th>GMV (₹)</th>
              <th>Collected (₹)</th>
              <th>Remitted / Settled (₹)</th>
              <th>Fees (₹)</th>
              <th>Discrepancy (₹)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.order_number}</td>
                <td>${r.customer_name ?? '—'}</td>
                <td>${r.order_date?.slice(0, 10) ?? '—'}</td>
                <td class="num">${inr(r.order_amount)}</td>
                <td class="num">${inr(r.collected_amount)}</td>
                <td class="num">${inr(r.remitted_amount)}</td>
                <td class="num">${r.gateway_fee > 0 ? inr(r.gateway_fee) : '—'}</td>
                <td class="num ${r.discrepancy > 0 ? 'red' : ''}">${r.discrepancy !== 0 ? inr(r.discrepancy) : '—'}</td>
                <td><span class="badge badge-${r.status.toLowerCase().replace('_', '-')}">${STATUS_LABEL[r.status] ?? r.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  const html = `
    <html>
    <head>
      <title>Reconciliation Report — ${periodLabel}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, sans-serif; font-size: 11px; color: #111; background: white; }
        .page { padding: 32px; max-width: 100%; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #111; margin-bottom: 24px; }
        .brand-name { font-size: 18px; font-weight: 600; }
        .report-title { font-size: 13px; color: #555; margin-top: 2px; }
        .meta { text-align: right; font-size: 10px; color: #777; line-height: 1.6; }
        .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 28px; }
        .summary-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
        .summary-card .label { font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
        .summary-card .value { font-size: 14px; font-weight: 600; margin-top: 4px; }
        .summary-card.red .value { color: #dc2626; }
        .section { margin-bottom: 28px; }
        .section h3 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #555; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; }
        th { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #888; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
        td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; font-size: 10px; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        td.red { color: #dc2626; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 500; }
        .badge-matched { background: #dcfce7; color: #166534; }
        .badge-pending { background: #fef9c3; color: #854d0e; }
        .badge-short-paid { background: #ffedd5; color: #9a3412; }
        .badge-unremitted { background: #fee2e2; color: #991b1b; }
        .badge-cancelled { background: #f3f4f6; color: #6b7280; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 9px; color: #aaa; }
        @media print {
          @page { size: A4 landscape; margin: 16mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div>
            <div class="brand-name">${brandName}</div>
            <div class="report-title">Payment Reconciliation Report — ${periodLabel}</div>
          </div>
          <div class="meta">
            Generated: ${now}<br/>
            Type: ${reportType}<br/>
            Confidential — Internal Use Only
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="label">Total Orders</div>
            <div class="value">${summary.totalOrders}</div>
          </div>
          <div class="summary-card">
            <div class="label">Gross GMV</div>
            <div class="value">${inr(summary.totalGMV)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Total Collected</div>
            <div class="value">${inr(summary.totalCollected)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Total Remitted</div>
            <div class="value">${inr(summary.totalRemitted)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Gateway Fees</div>
            <div class="value">${inr(summary.totalFees)}</div>
          </div>
          <div class="summary-card ${summary.totalDiscrepancy > 0 ? 'red' : ''}">
            <div class="label">Net Discrepancy</div>
            <div class="value">${summary.totalDiscrepancy > 0 ? inr(summary.totalDiscrepancy) : '—'}</div>
          </div>
        </div>

        ${rowHtml(codRows, 'COD Orders — Shiprocket Remittance')}
        ${rowHtml(prepaidRows, 'Prepaid Orders — Razorpay Settlement')}

        <div class="footer">
          <span>Xmetrics · xmetrics.in</span>
          <span>This report was auto-generated. Verify against bank statements before filing.</span>
        </div>
      </div>
    </body>
    </html>
  `

  const win = window.open('', '_blank', 'width=1200,height=800')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}
