import { computeOrderEconomics, DEFAULT_PROFIT_CONFIG } from './profitEngine'
import type { ProfitConfig } from './profitEngine'
import type { Order, Product } from '../types'

// ─── Campaign Profit Attribution ─────────────────────────────────────────────
//
// Triple Whale / Polar / Lifetimely auto-pull ad spend and report ROAS on
// *revenue*. The unaddressed problem: a campaign can show 3× ROAS on revenue
// and still LOSE money once its orders go COD to high-RTO pincodes. This module
// attributes manually-entered spend to orders by coupon code, runs those orders
// through the contribution-margin engine, and reports ROI on *true profit*, not
// revenue.

export interface Campaign {
  id: string
  name: string
  coupon_code: string
  spend: number
  channel?: string | null
  started_at?: string | null
  notes?: string | null
}

export interface CampaignResult {
  campaign: Campaign
  orders: number
  delivered: number
  rto: number
  inFlight: number
  revenue: number          // delivered revenue
  contribution: number     // realized true contribution margin
  spend: number
  netProfit: number        // contribution − spend (the number that matters)
  revenueRoas: number      // revenue / spend — the vanity metric others stop at
  marginRoas: number       // contribution / spend — the real one
  cac: number              // spend / delivered order
  rtoRate: number
  codPct: number
  verdict: 'PROFITABLE' | 'BREAKEVEN' | 'LOSS' | 'NO_DATA'
}

export function buildCampaignAnalysis(
  campaigns: Campaign[],
  orders: Order[],
  products: Product[],
  cfg: ProfitConfig = DEFAULT_PROFIT_CONFIG,
): CampaignResult[] {
  const costFor = new Map(products.map(p => [p.id, p.cost_price]))

  return campaigns
    .map(c => {
      const code = c.coupon_code.trim().toUpperCase()
      const attributed = orders.filter(o => (o.coupon_code ?? '').trim().toUpperCase() === code && code !== '')
      const econ = attributed.map(o => computeOrderEconomics(o, costFor, cfg))
      const realized = econ.filter(e => e.realized)
      const delivered = realized.filter(e => e.outcome === 'DELIVERED')
      const rto = realized.filter(e => e.outcome === 'RTO')
      const inFlight = econ.filter(e => !e.realized)

      const revenue = delivered.reduce((s, e) => s + e.revenue, 0)
      const contribution = realized.reduce((s, e) => s + e.contribution, 0)
      const cod = attributed.filter(o => o.payment_method === 'COD').length
      const netProfit = contribution - c.spend

      return {
        campaign: c,
        orders: attributed.length,
        delivered: delivered.length,
        rto: rto.length,
        inFlight: inFlight.length,
        revenue,
        contribution,
        spend: c.spend,
        netProfit,
        revenueRoas: c.spend > 0 ? revenue / c.spend : 0,
        marginRoas: c.spend > 0 ? contribution / c.spend : 0,
        cac: delivered.length > 0 ? c.spend / delivered.length : 0,
        rtoRate: realized.length > 0 ? (rto.length / realized.length) * 100 : 0,
        codPct: attributed.length > 0 ? (cod / attributed.length) * 100 : 0,
        verdict: attributed.length === 0 ? 'NO_DATA'
          : netProfit > 50 ? 'PROFITABLE'
          : netProfit < -50 ? 'LOSS'
          : 'BREAKEVEN',
      } as CampaignResult
    })
    .sort((a, b) => a.netProfit - b.netProfit) // worst first — losses surface at the top
}

export interface CampaignTotals {
  spend: number
  revenue: number
  contribution: number
  netProfit: number
  blendedMarginRoas: number
  losers: number
}

export function campaignTotals(results: CampaignResult[]): CampaignTotals {
  const withData = results.filter(r => r.verdict !== 'NO_DATA')
  const spend = withData.reduce((s, r) => s + r.spend, 0)
  const revenue = withData.reduce((s, r) => s + r.revenue, 0)
  const contribution = withData.reduce((s, r) => s + r.contribution, 0)
  return {
    spend,
    revenue,
    contribution,
    netProfit: contribution - spend,
    blendedMarginRoas: spend > 0 ? contribution / spend : 0,
    losers: withData.filter(r => r.verdict === 'LOSS').length,
  }
}
