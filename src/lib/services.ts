import type { RTOScoreResult, RTORiskLevel, PaymentMethod } from '../types'

// ─── RTO Scoring Engine (client-side mirror of edge function) ──────────────

interface RTOScoreInput {
  payment_method: PaymentMethod
  pincode: string
  customer_id: string | null
  order_value: number
  brand_aov: number
  is_first_order: boolean
  has_prior_rto: boolean
  address_complete: boolean
}

// Tier classification based on pincode prefix patterns (simplified)
function getPincodeTier(pincode: string): 1 | 2 | 3 {
  const tier1Prefixes = ['110', '400', '500', '560', '600', '700', '380', '411', '302']
  const tier2Prefixes = ['226', '208', '160', '641', '682', '440', '474', '462', '342', '305']

  const prefix = pincode.slice(0, 3)
  if (tier1Prefixes.includes(prefix)) return 1
  if (tier2Prefixes.includes(prefix)) return 2
  return 3
}

export function calculateRTOScore(input: RTOScoreInput): RTOScoreResult {
  let score = 0
  const factors: string[] = []

  // Payment method
  switch (input.payment_method) {
    case 'COD':
      score += 40
      factors.push('Cash on delivery (+40)')
      break
    case 'PREPAID':
      score -= 20
      factors.push('Prepaid order (−20)')
      break
    case 'UPI':
      score -= 20
      factors.push('UPI payment (−20)')
      break
    case 'WALLET':
      score -= 10
      factors.push('Wallet payment (−10)')
      break
    case 'CARD':
    case 'NETBANKING':
      score -= 5
      factors.push('Card/Netbanking (−5)')
      break
  }

  // Pincode tier
  const tier = getPincodeTier(input.pincode)
  if (tier === 3) {
    score += 20
    factors.push('Tier-3 location (+20)')
  } else if (tier === 2) {
    score += 10
    factors.push('Tier-2 location (+10)')
  } else {
    score -= 5
    factors.push('Tier-1 location (−5)')
  }

  // Customer history
  if (input.is_first_order) {
    score += 20
    factors.push('First-time customer (+20)')
  } else {
    score -= 15
    factors.push('Repeat customer (−15)')
  }

  if (input.has_prior_rto) {
    score += 15
    factors.push('Prior RTO on record (+15)')
  }

  // Order value vs AOV
  if (input.brand_aov > 0) {
    const ratio = input.order_value / input.brand_aov
    if (ratio > 2) {
      score += 10
      factors.push('Order value > 2× AOV (+10)')
    } else if (ratio < 0.5) {
      score -= 5
      factors.push('Order value < 0.5× AOV (−5)')
    }
  }

  // Address quality
  if (!input.address_complete) {
    score += 10
    factors.push('Incomplete address (+10)')
  }

  // Clamp 0–100
  score = Math.max(0, Math.min(100, score))

  let level: RTORiskLevel
  if (score >= 60) level = 'HIGH'
  else if (score >= 30) level = 'MEDIUM'
  else level = 'LOW'

  return { score, level, factors }
}

export function getRTOLevelColor(level: RTORiskLevel): string {
  switch (level) {
    case 'HIGH': return 'text-red-600'
    case 'MEDIUM': return 'text-amber-600'
    case 'LOW': return 'text-green-600'
  }
}

export function getRTOBarColor(score: number): string {
  if (score >= 60) return 'bg-red-500'
  if (score >= 30) return 'bg-amber-500'
  return 'bg-green-500'
}

// ─── Shiprocket mock services ──────────────────────────────────────────────

export interface LabelResult {
  order_id: string
  awb_number: string
  courier: string
  label_url: string
}

export function mockGenerateLabels(orderIds: string[]): {
  results: LabelResult[]
  merged_pdf_url: string
} {
  const couriers = ['Shiprocket', 'Delhivery', 'Ekart', 'BlueDart', 'XpressBees']
  const results: LabelResult[] = orderIds.map((id, i) => ({
    order_id: id,
    awb_number: `SR${Date.now()}${i}`.slice(0, 14),
    courier: couriers[i % couriers.length],
    label_url: '#',
  }))
  return {
    results,
    merged_pdf_url: '#',
  }
}
