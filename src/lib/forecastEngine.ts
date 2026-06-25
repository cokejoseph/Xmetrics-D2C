import { addDays, subDays, format, parseISO } from 'date-fns'
import type { Product, Order, SKUForecast, ForecastSummary, ForecastStatus } from '../types'

export function buildSKUForecast(products: Product[], orders: Order[]): {
  forecasts: SKUForecast[]
  summary: ForecastSummary
} {
  const today = new Date()
  const thirtyDaysAgo = subDays(today, 30)

  // Compute once outside the map to avoid O(n*m) filter
  const recentOrders = orders.filter(
    o =>
      parseISO(o.created_at) >= thirtyDaysAgo &&
      o.payment_status === 'PAID' &&
      o.fulfillment_status !== 'CANCELLED'
  )

  // Build units-sold Map in one pass — avoids O(products × orders × items)
  const unitsSoldByProduct = new Map<string, number>()
  for (const order of recentOrders) {
    for (const item of order.items ?? []) {
      if (item.product_id) {
        unitsSoldByProduct.set(
          item.product_id,
          (unitsSoldByProduct.get(item.product_id) ?? 0) + item.quantity
        )
      }
    }
  }

  const forecasts: SKUForecast[] = products
    .filter(p => p.is_active)
    .map(product => {
      const totalUnitsSold30d = unitsSoldByProduct.get(product.id) ?? 0

      const avgDailyDemand = totalUnitsSold30d / 30

      let daysOfStock: number
      let predictedStockoutDate: string | null = null
      let reorderQuantity: number
      let status: ForecastStatus

      if (product.inventory_count === 0) {
        status = 'OUT_OF_STOCK'
        daysOfStock = 0
        reorderQuantity = Math.round(avgDailyDemand * 45)
      } else if (avgDailyDemand === 0) {
        status = totalUnitsSold30d === 0 ? 'DEAD_STOCK' : 'INSUFFICIENT_DATA'
        daysOfStock = Infinity
        reorderQuantity = 0
      } else {
        daysOfStock = Math.round(product.inventory_count / avgDailyDemand)
        predictedStockoutDate = format(addDays(today, daysOfStock), 'yyyy-MM-dd')
        reorderQuantity = Math.max(0, Math.round(avgDailyDemand * 45 - product.inventory_count))

        const thresholdDays = avgDailyDemand > 0
          ? Math.round(product.reorder_threshold / avgDailyDemand)
          : 14

        status = daysOfStock < thresholdDays ? 'REORDER_NOW'
          : daysOfStock < thresholdDays * 2 ? 'REORDER_SOON'
          : 'IN_STOCK'
      }

      return {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        inventory_count: product.inventory_count,
        avg_daily_demand: Math.round(avgDailyDemand * 10) / 10,
        total_units_sold_30d: totalUnitsSold30d,
        days_of_stock: daysOfStock === Infinity ? 999 : daysOfStock,
        predicted_stockout_date: predictedStockoutDate,
        reorder_quantity: reorderQuantity,
        status,
      }
    })

  const summary: ForecastSummary = {
    out_of_stock_count: forecasts.filter(f => f.status === 'OUT_OF_STOCK').length,
    reorder_now_count:  forecasts.filter(f => f.status === 'REORDER_NOW').length,
    reorder_soon_count: forecasts.filter(f => f.status === 'REORDER_SOON').length,
    in_stock_count:     forecasts.filter(f => f.status === 'IN_STOCK').length,
    dead_stock_count:   forecasts.filter(f => f.status === 'DEAD_STOCK').length,
    total_skus:         forecasts.length,
  }

  return { forecasts, summary }
}
