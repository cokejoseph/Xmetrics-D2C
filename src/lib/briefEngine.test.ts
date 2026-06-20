import { describe, it, expect } from 'vitest'
import { generateDailyBrief, buildWhatsAppText, dayLabel } from './briefEngine'
import type { Order } from '../types'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: `o-${Math.random()}`, brand_id: 'b1', order_number: '#1001',
    customer_id: 'cust-1', channel: 'SHOPIFY', payment_method: 'UPI',
    payment_status: 'PAID', fulfillment_status: 'DELIVERED',
    rto_review_status: 'NOT_REQUIRED',
    gross_amount: 500, discount_amount: 0, shipping_charge: 60,
    shipping_cost: 60, rto_risk_score: 15,
    shipping_address: { name: 'A', phone: '9999999999', address: '1 St', city: 'Mumbai', state: 'MH', pincode: '400001' },
    items: [],
    created_at: new Date().toISOString(),
    ...overrides,
  } as Order
}

const TODAY = new Date().toISOString().slice(0, 10)

describe('generateDailyBrief', () => {
  it('returns structured BriefData for today with no orders', () => {
    const brief = generateDailyBrief(TODAY, [], [], [], [])
    expect(brief).toHaveProperty('headline')
    expect(brief).toHaveProperty('delivery_health')
    expect(brief).toHaveProperty('channel_performance')
    expect(brief).toHaveProperty('actions')
    expect(brief.headline.total_orders).toBe(0)
  })

  it('counts orders for the target date only', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const oldOrder = makeOrder({ created_at: yesterday.toISOString() })
    const todayOrder = makeOrder({ created_at: new Date().toISOString() })
    const brief = generateDailyBrief(TODAY, [oldOrder, todayOrder], [], [], [])
    expect(brief.headline.total_orders).toBe(1)
  })

  it('sums revenue from today orders only', () => {
    const o1 = makeOrder({ gross_amount: 1000, discount_amount: 100 })
    const o2 = makeOrder({ gross_amount: 500, discount_amount: 0 })
    const brief = generateDailyBrief(TODAY, [o1, o2], [], [], [])
    expect(brief.headline.total_revenue).toBe(1400)
  })

  it('actions array has correct priority ordering', () => {
    const rtoOrder = makeOrder({ fulfillment_status: 'RTO_INITIATED' })
    const brief = generateDailyBrief(TODAY, [rtoOrder, makeOrder(), makeOrder()], [], [], [])
    const priorities = brief.actions.map(a => a.priority)
    const sortedPriorities = [...priorities].sort((a, b) => {
      const w = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      return w[a as keyof typeof w] - w[b as keyof typeof w]
    })
    expect(priorities).toEqual(sortedPriorities)
  })
})

describe('buildWhatsAppText', () => {
  it('returns a non-empty string', () => {
    const brief = generateDailyBrief(TODAY, [makeOrder()], [], [], [])
    const text = buildWhatsAppText(brief)
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(20)
  })

  it('includes revenue in the output', () => {
    const brief = generateDailyBrief(TODAY, [makeOrder({ gross_amount: 999 })], [], [], [])
    const text = buildWhatsAppText(brief)
    expect(text).toContain('999')
  })
})

describe('dayLabel', () => {
  it('returns "Today" for today\'s date', () => {
    expect(dayLabel(TODAY)).toBe('Today')
  })

  it('returns "Yesterday" for yesterday', () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    expect(dayLabel(d.toISOString().slice(0, 10))).toBe('Yesterday')
  })

  it('returns a formatted date string for older dates', () => {
    expect(dayLabel('2024-01-15')).toMatch(/\d{2} \w+ \d{4}/)
  })
})
