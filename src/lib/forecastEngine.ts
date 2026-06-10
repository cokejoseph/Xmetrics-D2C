import { addDays, subDays, format, parseISO } from 'date-fns'
import type { Product, Order, SKUForecast, ForecastSummary, ForecastStatus } from '../types'

export function buildSKUForecast(products: Product[], orders: Order[]): {
  forecasts: SKUForecast[]
  summary: ForecastSummary
} {
  const today = new Date()
  const thirtyDaysAgo = subDays(today, 30)

  const forecasts: SKUForecast[] = products
    .filter(p => p.is_active)
    .map(product => {
      // Collect sold units in last 30 days
      const recentOrders = orders.filter(
        o =>
          parseISO(o.created_at) >= thirtyDaysAgo &&
          o.payment_status === 'PAID' &&
          o.fulfillment_status !== 'CANCELLED'
      )

      let totalUnitsSold30d = 0
      for (const order of recentOrders) {
        for (const item of order.items ?? []) {
          if (item.product_id === product.id) {
            totalUnitsSold30d += item.quantity
          }
        }
      }

      const avgDailyDemand = totalUnitsSold30d / 30

      let daysOfStock = 0
      let predictedStockoutDate: string | null = null
      let reorderQuantity = 0
      let status: ForecastStatus

      if (product.inventory_count === 0) {
        status = 'OUT_OF_STOCK'
        daysOfStock = 0
        reorderQuantity = Math.round(avgDailyDemand * 45)
      } else if (avgDailyDemand === 0) {
        if (totalUnitsSold30d === 0) {
          status = 'DEAD_STOCK'
          daysOfStock = Infinity
        } else {
          status = 'INSUFFICIENT_DATA'
          daysOfStock = Infinity
        }
        reorderQuantity = 0
      } else {
        daysOfStock = Math.round(product.inventory_count / avgDailyDemand)
        predictedStockoutDate = format(
          addDays(today, daysOfStock),
          'yyyy-MM-dd'
        )
        reorderQuantity = Math.max(
          0,
          Math.round(avgDailyDemand * 45 - product.inventory_count)
        )

        const reorderThresholdDays = product.reorder_threshold

        if (daysOfStock < reorderThresholdDays) {
          status = 'REORDER_NOW'
        } else if (daysOfStock < reorderThresholdDays * 2) {
          status = 'REORDER_SOON'
        } else {
          status = 'IN_STOCK'
        }
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
    reorder_now_count: forecasts.filter(f => f.status === 'REORDER_NOW').length,
    reorder_soon_count: forecasts.filter(f => f.status === 'REORDER_SOON').length,
    in_stock_count: forecasts.filter(f => f.status === 'IN_STOCK').length,
    dead_stock_count: forecasts.filter(f => f.status === 'DEAD_STOCK').length,
    total_skus: forecasts.length,
  }

  return { forecasts, summary }
}
