import { describe, it, expect } from 'vitest'
import { calculateRTOScore } from './services'

const base = {
  pincode: '110001',
  customer_id: 'cust-1',
  order_value: 500,
  brand_aov: 450,
  is_first_order: false,
  has_prior_rto: false,
  address_complete: true,
  pincodeData: null,
}

describe('calculateRTOScore', () => {
  it('COD results in higher score than PREPAID', () => {
    const cod = calculateRTOScore({ ...base, payment_method: 'COD' })
    const prepaid = calculateRTOScore({ ...base, payment_method: 'PREPAID' })
    expect(cod.score).toBeGreaterThan(prepaid.score)
  })

  it('COD score is at least 15 points above PREPAID', () => {
    const cod = calculateRTOScore({ ...base, payment_method: 'COD' })
    const prepaid = calculateRTOScore({ ...base, payment_method: 'PREPAID' })
    expect(cod.score - prepaid.score).toBeGreaterThanOrEqual(15)
  })

  it('PREPAID results in LOW risk for Tier-1 repeat customer', () => {
    const result = calculateRTOScore({ ...base, payment_method: 'PREPAID' })
    expect(result.level).toBe('LOW')
  })

  it('COD + first order elevates to at least MEDIUM', () => {
    const result = calculateRTOScore({ ...base, payment_method: 'COD', is_first_order: true })
    expect(['MEDIUM', 'HIGH']).toContain(result.level)
  })

  it('prior RTO history adds to score', () => {
    const without = calculateRTOScore({ ...base, payment_method: 'COD', has_prior_rto: false })
    const with_ = calculateRTOScore({ ...base, payment_method: 'COD', has_prior_rto: true })
    expect(with_.score).toBeGreaterThan(without.score)
  })

  it('incomplete address raises COD score above complete address', () => {
    // Use COD so base score is high enough for clamping not to affect both equally
    const complete = calculateRTOScore({ ...base, payment_method: 'COD', address_complete: true })
    const incomplete = calculateRTOScore({ ...base, payment_method: 'COD', address_complete: false })
    expect(incomplete.score).toBeGreaterThan(complete.score)
  })

  it('score is clamped to 0–100', () => {
    const low = calculateRTOScore({ ...base, payment_method: 'PREPAID' })
    const high = calculateRTOScore({
      ...base, payment_method: 'COD', is_first_order: true,
      has_prior_rto: true, address_complete: false, pincode: '795001',
    })
    expect(low.score).toBeGreaterThanOrEqual(0)
    expect(high.score).toBeLessThanOrEqual(100)
  })

  it('factors array is non-empty', () => {
    const result = calculateRTOScore({ ...base, payment_method: 'UPI' })
    expect(result.factors.length).toBeGreaterThan(0)
  })

  it('enriched pincodeData non-deliverable pushes to HIGH', () => {
    const result = calculateRTOScore({
      ...base,
      payment_method: 'COD',
      is_first_order: true,
      pincodeData: {
        pincode: '795001', district: 'Remote', state: 'Arunachal Pradesh',
        region: 'North East', tier: 3 as const,
        isRural: true, deliverable: false, highRiskState: true,
      },
    })
    expect(result.level).toBe('HIGH')
  })
})
