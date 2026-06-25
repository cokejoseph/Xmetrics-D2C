import type { Order, Product, Return } from '../types'

// ─── Profit Intelligence Engine ──────────────────────────────────────────────
//
// The problem no D2C analytics tool addresses for the Indian market: *true*
// contribution margin after COD + RTO reality. Foreign tools (Triple Whale,
// Polar, Lifetimely) assume prepaid and stop at gross/ad-adjusted revenue.
// Ops platforms (Cobay, Unicommerce) report operations, not unit economics.
//
// A founder sees "₹93k revenue" and feels great. This engine tells the truth:
// after COGS, forward + reverse shipping, RTO write-offs, COD fees, gateway
// fees and discounts — which channels, payment methods and pincodes actually
// *make* money, and which silently lose it.
//
// Margin is *realized* at a terminal outcome (DELIVERED or RTO). In-flight
// orders are pipeline/at-risk, not realized profit — counting them as profit is
// exactly the lie this view exists to kill.

export interface ProfitConfig {
  forwardShip: number       // ₹ per shipment when order has no explicit shipping_cost
  reverseShip: number       // ₹ to bring an RTO / return back
  prepaidFeePct: number     // payment-gateway fee on prepaid orders
  codFeePct: number         // COD remittance/handling fee
  rtoHandling: number       // ₹ fixed handling/restocking cost per RTO
}

export const DEFAULT_PROFIT_CONFIG: ProfitConfig = {
  forwardShip: 65,
  reverseShip: 65,
  prepaidFeePct: 0.02,
  codFeePct: 0.018,
  rtoHandling: 20,
}

type Terminal = 'DELIVERED' | 'RTO' | 'CANCELLED' | 'IN_FLIGHT'

export interface OrderEconomics {
  order_id: string
  order_number: string
  channel: string
  payment_method: string
  pincode: string
  state: string
  outcome: Terminal
  realized: boolean
  revenue: number        // recognized only on DELIVERED
  cogs: number
  forwardShip: number
  reverseShip: number
  paymentFee: number
  discount: number
  contribution: number   // realized contribution margin (can be negative)
}

export interface MarginGroup {
  key: string
  orders: number
  delivered: number
  rto: number
  revenue: number
  contribution: number
  marginPct: number      // contribution / revenue (delivered revenue)
  negative: boolean
}

export interface ProfitSummary {
  // Realized P&L waterfall
  grossRevenue: number
  discounts: number
  cogs: number
  forwardShipping: number
  rtoLosses: number      // fwd + reverse + handling on RTO orders
  paymentFees: number
  contributionMargin: number
  contributionMarginPct: number
  // Counts
  realizedOrders: number
  delivered: number
  rto: number
  inFlight: number
  // Working capital locked (the cash-flow blind spot)
  codCashInTransit: number   // COD value shipped, not yet delivered/remitted
  rtoCapitalInTransit: number // value tied up in RTO orders coming back
  pipelineValue: number       // value of all in-flight orders
}

function productCostMap(products: Product[]): Map<string, number> {
  return new Map(products.map(p => [p.id, p.cost_price]))
}

function outcomeOf(o: Order): Terminal {
  if (o.fulfillment_status === 'DELIVERED') return 'DELIVERED'
  if (o.fulfillment_status === 'RTO_INITIATED') return 'RTO'
  if (o.fulfillment_status === 'CANCELLED') return 'CANCELLED'
  return 'IN_FLIGHT'
}

export function computeOrderEconomics(
  o: Order,
  costFor: Map<string, number>,
  cfg: ProfitConfig,
): OrderEconomics {
  const value = o.gross_amount - o.discount_amount
  const cogs = (o.items ?? []).reduce(
    (s, it) => s + (it.cost_price ?? (it.product_id ? costFor.get(it.product_id) ?? 0 : 0)) * it.quantity,
    0,
  )
  const fwd = o.shipping_cost ?? o.shipping_charge ?? cfg.forwardShip
  const isCOD = o.payment_method === 'COD'
  const fee = isCOD ? value * cfg.codFeePct : (o.razorpay_fee ?? value * cfg.prepaidFeePct)
  const outcome = outcomeOf(o)

  let revenue = 0
  let reverseShip = 0
  let contribution = 0
  let realized = true

  switch (outcome) {
    case 'DELIVERED':
      revenue = value
      contribution = value - cogs - fwd - fee
      break
    case 'RTO':
      // Goods come back (resellable) so COGS isn't lost, but you eat the round
      // trip + handling and collect nothing. Pure loss.
      reverseShip = cfg.reverseShip
      contribution = -(fwd + reverseShip + cfg.rtoHandling)
      break
    case 'CANCELLED':
      contribution = 0 // assume caught pre-dispatch
      break
    case 'IN_FLIGHT':
      realized = false
      // projected-if-delivered, shown as pipeline (not counted as profit)
      contribution = value - cogs - fwd - fee
      break
  }

  return {
    order_id: o.id,
    order_number: o.order_number,
    channel: o.channel,
    payment_method: o.payment_method,
    pincode: o.shipping_address?.pincode ?? '',
    state: o.shipping_address?.state ?? '',
    outcome,
    realized,
    revenue,
    cogs,
    forwardShip: fwd,
    reverseShip,
    paymentFee: fee,
    discount: o.discount_amount,
    contribution,
  }
}

function groupBy(
  econ: OrderEconomics[],
  keyFn: (e: OrderEconomics) => string,
): MarginGroup[] {
  const m = new Map<string, MarginGroup>()
  for (const e of econ) {
    if (!e.realized) continue
    const key = keyFn(e) || '—'
    const g = m.get(key) ?? { key, orders: 0, delivered: 0, rto: 0, revenue: 0, contribution: 0, marginPct: 0, negative: false }
    g.orders += 1
    if (e.outcome === 'DELIVERED') g.delivered += 1
    if (e.outcome === 'RTO') g.rto += 1
    g.revenue += e.revenue
    g.contribution += e.contribution
    m.set(key, g)
  }
  return [...m.values()].map(g => ({
    ...g,
    marginPct: g.revenue > 0 ? (g.contribution / g.revenue) * 100 : (g.contribution < 0 ? -100 : 0),
    negative: g.contribution < 0,
  })).sort((a, b) => a.contribution - b.contribution) // worst first — leaks surface at the top
}

export interface ProfitAnalysis {
  summary: ProfitSummary
  byChannel: MarginGroup[]
  byPayment: MarginGroup[]
  byPincode: MarginGroup[]
  insights: ProfitInsight[]
  econ: OrderEconomics[]
}

export interface ProfitInsight {
  severity: 'critical' | 'warning' | 'good'
  title: string
  detail: string
  value?: string
}

export function buildProfitAnalysis(
  orders: Order[],
  products: Product[],
  _returns: Return[],
  cfg: ProfitConfig = DEFAULT_PROFIT_CONFIG,
): ProfitAnalysis {
  const costFor = productCostMap(products)
  const econ = orders.map(o => computeOrderEconomics(o, costFor, cfg))

  const realized = econ.filter(e => e.realized)
  const delivered = realized.filter(e => e.outcome === 'DELIVERED')
  const rto = realized.filter(e => e.outcome === 'RTO')
  const inFlight = econ.filter(e => !e.realized)

  const grossRevenue   = delivered.reduce((s, e) => s + e.revenue, 0)
  const discounts      = delivered.reduce((s, e) => s + e.discount, 0)
  const cogs           = delivered.reduce((s, e) => s + e.cogs, 0)
  const forwardShipping = delivered.reduce((s, e) => s + e.forwardShip, 0)
  const paymentFees    = delivered.reduce((s, e) => s + e.paymentFee, 0)
  const rtoLosses      = rto.reduce((s, e) => s + Math.abs(e.contribution), 0)
  const contributionMargin = grossRevenue - cogs - forwardShipping - paymentFees - rtoLosses

  // Working capital locked in the pipeline
  const codCashInTransit = inFlight
    .filter(e => e.payment_method === 'COD')
    .reduce((s, e) => s + (e.revenue || e.contribution + e.cogs + e.forwardShip + e.paymentFee), 0)
  const codInTransitValue = inFlight
    .filter(e => e.payment_method === 'COD')
    .reduce((s, e) => {
      const o = orders.find(x => x.id === e.order_id)
      return s + (o ? o.gross_amount - o.discount_amount : 0)
    }, 0)
  const rtoCapitalInTransit = orders
    .filter(o => o.fulfillment_status === 'RTO_INITIATED')
    .reduce((s, o) => s + (o.gross_amount - o.discount_amount), 0)
  const pipelineValue = inFlight.reduce((s, e) => {
    const o = orders.find(x => x.id === e.order_id)
    return s + (o ? o.gross_amount - o.discount_amount : 0)
  }, 0)

  const summary: ProfitSummary = {
    grossRevenue,
    discounts,
    cogs,
    forwardShipping,
    rtoLosses,
    paymentFees,
    contributionMargin,
    contributionMarginPct: grossRevenue > 0 ? (contributionMargin / grossRevenue) * 100 : 0,
    realizedOrders: realized.length,
    delivered: delivered.length,
    rto: rto.length,
    inFlight: inFlight.length,
    codCashInTransit: codInTransitValue || codCashInTransit,
    rtoCapitalInTransit,
    pipelineValue,
  }

  const byChannel = groupBy(econ, e => e.channel)
  const byPayment = groupBy(econ, e => e.payment_method)
  const byPincode = groupBy(econ, e => e.pincode).filter(g => g.orders >= 1)

  // ── The actionable, unaddressed insights ──────────────────────────────────
  const insights: ProfitInsight[] = []

  // 1. COD break-even order value
  const codRealized = realized.filter(e => e.payment_method === 'COD')
  const codRtoCount = codRealized.filter(e => e.outcome === 'RTO').length
  const codRtoRate = codRealized.length > 0 ? codRtoCount / codRealized.length : 0
  const cogsRatio = grossRevenue > 0 ? cogs / grossRevenue : 0.5
  if (codRealized.length >= 3 && cogsRatio < 1) {
    // expected COD contribution at value V:
    //   (1-r)(V(1 - cogsRatio - codFee) - fwd) - r(fwd + rev + handling) = 0
    const r = codRtoRate
    const denom = (1 - r) * (1 - cogsRatio - cfg.codFeePct)
    const numer = (1 - r) * cfg.forwardShip + r * (cfg.forwardShip + cfg.reverseShip + cfg.rtoHandling)
    const breakeven = denom > 0 ? Math.round(numer / denom) : null
    if (breakeven && breakeven > 0) {
      insights.push({
        severity: codRtoRate > 0.15 ? 'critical' : 'warning',
        title: 'COD break-even order value',
        value: `₹${breakeven.toLocaleString('en-IN')}`,
        detail: `At your COD RTO rate of ${Math.round(codRtoRate * 100)}%, COD orders below ₹${breakeven.toLocaleString('en-IN')} lose money on average. Require prepaid or a confirmation call below this value.`,
      })
    }
  }

  // 2. Margin-negative channels
  const negChannels = byChannel.filter(g => g.negative && g.orders >= 2)
  for (const g of negChannels) {
    insights.push({
      severity: 'critical',
      title: `${g.key} is margin-negative`,
      value: `−₹${Math.abs(Math.round(g.contribution)).toLocaleString('en-IN')}`,
      detail: `${g.key} generated ₹${Math.round(g.revenue).toLocaleString('en-IN')} delivered revenue but a NET LOSS after RTO and costs (${g.rto} RTO of ${g.orders} realized orders). This channel is costing you money.`,
    })
  }

  // 3. Margin-negative payment methods (usually COD)
  const negPayments = byPayment.filter(g => g.negative && g.orders >= 2)
  for (const g of negPayments) {
    insights.push({
      severity: 'critical',
      title: `${g.key} orders lose money overall`,
      value: `−₹${Math.abs(Math.round(g.contribution)).toLocaleString('en-IN')}`,
      detail: `${g.key} contribution is negative after RTO write-offs. Tighten RTO scoring or shift these to prepaid.`,
    })
  }

  // 4. RTO is eating your margin
  if (rtoLosses > 0 && contributionMargin > 0) {
    const erosion = Math.round((rtoLosses / (contributionMargin + rtoLosses)) * 100)
    insights.push({
      severity: erosion > 30 ? 'critical' : 'warning',
      title: 'RTO is eroding contribution margin',
      value: `${erosion}%`,
      detail: `₹${Math.round(rtoLosses).toLocaleString('en-IN')} of realized margin was destroyed by RTO this period — ${erosion}% of what your profit would otherwise be.`,
    })
  }

  // 5. Cash locked (working capital)
  if (summary.codCashInTransit > 0) {
    insights.push({
      severity: 'warning',
      title: 'Cash locked in undelivered COD',
      value: `₹${Math.round(summary.codCashInTransit).toLocaleString('en-IN')}`,
      detail: `This COD value is shipped but not yet delivered or remitted — working capital you can't deploy until it lands. RTOs here become pure loss.`,
    })
  }

  // 6. Healthy signal
  if (negChannels.length === 0 && negPayments.length === 0 && summary.contributionMarginPct > 0) {
    insights.unshift({
      severity: 'good',
      title: 'All channels are contribution-positive',
      value: `${Math.round(summary.contributionMarginPct)}%`,
      detail: `Every channel and payment method is making money after RTO and costs. Your true contribution margin is ${Math.round(summary.contributionMarginPct)}%.`,
    })
  }

  return { summary, byChannel, byPayment, byPincode, insights, econ }
}
