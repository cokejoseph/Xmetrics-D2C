import { create } from 'zustand'
import { DEMO_MODE } from '../lib/supabase'
import { showToast } from '../lib/toast'
import {
  DEMO_BRAND, DEMO_TEAM, DEMO_WAREHOUSES, DEMO_PRODUCTS,
  DEMO_CUSTOMERS, DEMO_ORDERS, DEMO_PAYMENTS, DEMO_EXCEPTIONS, DEMO_INTEGRATIONS, DEMO_RETURNS,
} from '../data/seed'
import { mockGenerateLabels } from '../lib/services'
import { createShipment } from '../lib/shiprocket'
import type { ShipmentPayload } from '../lib/shiprocket'
import type {
  Brand, BrandMember, Warehouse, Product, Customer, Order,
  Payment, Exception, Integration, PlanType, Return, SubscriptionData, ExceptionStatus,
} from '../types'
import { supabase } from '../lib/supabase'
import {
  getBrandForUser,
  updateBrandDB,
  getTeamMembers,
  inviteTeamMemberDB,
  updateTeamMemberDB,
  removeTeamMemberDB,
  getWarehouses,
  addWarehouseDB,
  updateWarehouseDB,
  setDefaultWarehouseDB,
  getProducts,
  addProductDB,
  updateProductDB,
  getCustomers,
  getOrders,
  updateOrderDB,
  insertOrder,
  insertOrderItems,
  updateShipmentDB,
  addOrderTimelineEvent,
  getPayments,
  getExceptions,
  updateExceptionDB,
  getIntegrations,
  upsertIntegration,
  updateIntegrationDB,
  subscribeToOrders,
  subscribeToExceptions,
  pushOrderToOms,
  insertAuditLog,
  resolveExceptionWithAudit,
} from '../lib/db'

// ─── Module-level channel storage (outside Zustand to avoid serialisation issues) ─

type RealtimeChannel = ReturnType<typeof subscribeToOrders>
let _realtimeChannels: RealtimeChannel[] = []

// ─── State Interface ────────────────────────────────────────────────────────

interface AppState {
  currentBrand: Brand | null
  currentWarehouse: Warehouse | null
  brands: Brand[]
  orders: Order[]
  payments: Payment[]
  exceptions: Exception[]
  customers: Customer[]
  products: Product[]
  warehouses: Warehouse[]
  teamMembers: BrandMember[]
  integrations: Integration[]
  returns: Return[]
  currentPlan: PlanType
  subscription: SubscriptionData | null
  isLoading: boolean
  bootstrapError: string | null

  bootstrap: (userId: string, email?: string) => Promise<void>
  cleanup: () => void

  updateOrder: (id: string, changes: Partial<Order>) => void
  approveOrder: (id: string) => void
  holdOrder: (id: string) => void
  flagOrder: (id: string) => void
  bulkApprove: (ids: string[]) => void
  bulkHold: (ids: string[]) => void
  startPacking: (ids: string[]) => void
  schedulePickup: (ids: string[], date: string) => void
  generateLabels: (ids: string[]) => { results: ReturnType<typeof mockGenerateLabels>['results']; merged_pdf_url: string }
  addOrder: (order: Omit<Order, 'id' | 'brand_id' | 'created_at' | 'order_number'>) => Promise<Order>
  resolveException: (id: string) => void
  dismissException: (id: string) => void
  restoreException: (id: string, previousStatus: string) => void
  addProduct: (product: Omit<Product, 'id' | 'brand_id' | 'created_at'>) => void
  updateProduct: (id: string, changes: Partial<Product>) => void
  addWarehouse: (warehouse: Omit<Warehouse, 'id' | 'brand_id' | 'created_at'>) => void
  updateWarehouse: (id: string, changes: Partial<Warehouse>) => void
  setDefaultWarehouse: (id: string) => void
  updateBrand: (changes: Partial<Brand['settings']> & { name?: string }) => void
  updateIntegration: (id: string, changes: Partial<Integration>) => void
  connectIntegration: (platform: Integration['platform'], credentials: Record<string, string>) => Promise<{ error: string | null }>
  updateTeamMember: (id: string, changes: Partial<BrandMember>) => void
  removeTeamMember: (id: string) => void
  inviteTeamMember: (data: { name: string; email: string; role: BrandMember['role'] }) => Promise<{ error: string | null }>
  setReturns: (returns: Return[]) => void
  addReturn: (ret: Return) => void
  updateReturn: (id: string, changes: Partial<Return>) => void
  setSubscription: (sub: SubscriptionData | null) => void
  pushToOms: (orderId: string, pushType?: 'AUTO' | 'MANUAL') => Promise<{ ok: boolean; error: string | null }>
  bulkPushToOms: (orderIds: string[]) => Promise<{ succeeded: number; failed: number }>
  approveExceptionAndPush: (exceptionId: string, orderId: string, reason: string, notes?: string) => Promise<{ ok: boolean; error: string | null }>
}

// ─── Demo subscription factory ─────────────────────────────────────────────

function makeDemoSubscription(plan: PlanType): SubscriptionData {
  const LIMITS: Record<PlanType, { orders: number | null; team: number | null; integrations: number | null; paise: number }> = {
    STARTER:    { orders: 500,   team: 1,    integrations: 2,    paise: 99900  },
    GROWTH:     { orders: 3000,  team: 5,    integrations: 6,    paise: 299900 },
    SCALE:      { orders: 15000, team: 20,   integrations: 10,   paise: 799900 },
    ENTERPRISE: { orders: null,  team: null, integrations: null, paise: 0      },
  }
  const lim          = LIMITS[plan]
  const orders_used  = 287
  const team_used    = 2
  const integrations_used = 3
  const today        = new Date()
  const startDate    = new Date(today.getTime() - 12 * 86400000).toISOString().slice(0, 10)
  const renewalDate  = new Date(today.getTime() + 18 * 86400000).toISOString().slice(0, 10)

  return {
    plan_type:          plan,
    status:             'ACTIVE',
    feature_flags:      { daily_briefs: true, whatsapp_export: true, rto_intelligence: true },
    billing_start_date: startDate,
    next_renewal_date:  renewalDate,
    plan_amount_paise:  lim.paise,
    orders_used,
    orders_limit:       lim.orders,
    orders_pct:         lim.orders ? Math.round(orders_used / lim.orders * 100) : 0,
    at_order_limit:     lim.orders !== null && orders_used >= lim.orders,
    team_used,
    team_limit:         lim.team,
    at_team_limit:      lim.team !== null && team_used >= lim.team,
    integrations_used,
    integrations_limit: lim.integrations,
    at_integration_limit: lim.integrations !== null && integrations_used >= lim.integrations,
    at_capacity:        false,
  }
}

// ─── Live subscription mapper ──────────────────────────────────────────────

function buildSubscriptionData(
  sub: Record<string, unknown>,
  teamCount: number,
  intCount: number
): SubscriptionData {
  const ordersUsed   = (sub.orders_this_month as number) ?? 0
  const ordersLimit  = (sub.max_orders_per_month as number | null) ?? null
  const teamLimit    = (sub.max_team_members as number | null) ?? null
  const intLimit     = (sub.max_integrations as number | null) ?? null
  const ordersPct    = ordersLimit ? Math.round(ordersUsed / ordersLimit * 100) : 0
  const atOrderLimit = ordersLimit !== null && ordersUsed >= ordersLimit
  const atTeamLimit  = teamLimit !== null && teamCount >= teamLimit
  const atIntLimit   = intLimit !== null && intCount >= intLimit
  return {
    plan_type:           (sub.plan_type as PlanType) ?? 'STARTER',
    status:              (sub.status as SubscriptionData['status']) ?? 'ACTIVE',
    feature_flags:       (sub.feature_flags as Record<string, boolean>) ?? {},
    billing_start_date:  (sub.billing_start_date as string) ?? '',
    next_renewal_date:   (sub.next_renewal_date as string | null) ?? null,
    plan_amount_paise:   (sub.plan_amount_paise as number) ?? 0,
    orders_used:         ordersUsed,
    orders_limit:        ordersLimit,
    orders_pct:          ordersPct,
    at_order_limit:      atOrderLimit,
    team_used:           teamCount,
    team_limit:          teamLimit,
    at_team_limit:       atTeamLimit,
    integrations_used:   intCount,
    integrations_limit:  intLimit,
    at_integration_limit: atIntLimit,
    at_capacity:         atOrderLimit || atTeamLimit || atIntLimit,
  }
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  currentBrand: null,
  currentWarehouse: null,
  brands: [],
  orders: [],
  payments: [],
  exceptions: [],
  customers: [],
  products: [],
  warehouses: [],
  teamMembers: [],
  integrations: [],
  returns: [],
  currentPlan: 'GROWTH',
  subscription: null,
  isLoading: true,
  bootstrapError: null,

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  bootstrap: async (userId: string, email?: string) => {
    // Demo mode: no Supabase configured OR user is a demo account (@xmetrics.app)
    if (DEMO_MODE || email?.endsWith('@xmetrics.app')) {
      set({
        currentBrand: DEMO_BRAND,
        currentWarehouse: DEMO_WAREHOUSES[0],
        brands: [DEMO_BRAND],
        orders: DEMO_ORDERS,
        payments: DEMO_PAYMENTS,
        exceptions: DEMO_EXCEPTIONS,
        customers: DEMO_CUSTOMERS,
        products: DEMO_PRODUCTS,
        warehouses: DEMO_WAREHOUSES,
        teamMembers: DEMO_TEAM,
        integrations: DEMO_INTEGRATIONS,
        returns: DEMO_RETURNS,
        currentPlan: 'GROWTH',
        subscription: makeDemoSubscription('GROWTH'),
        isLoading: false,
        bootstrapError: null,
      })
      return
    }

    // ── Live mode ──────────────────────────────────────────────────────────
    set({ isLoading: true, bootstrapError: null })

    try {
      // Step 1: resolve the user's brand
      const brand = await getBrandForUser(userId)
      if (!brand) {
        set({ isLoading: false, bootstrapError: 'No brand found for this user.' })
        return
      }
      const brandId = brand.id

      // Step 2: parallel fetch of everything else
      const [
        warehouses,
        products,
        customers,
        orders,
        payments,
        exceptions,
        integrations,
        teamMembers,
        subData,
      ] = await Promise.all([
        getWarehouses(brandId),
        getProducts(brandId),
        getCustomers(brandId),
        getOrders(brandId),
        getPayments(brandId),
        getExceptions(brandId),
        getIntegrations(brandId),
        getTeamMembers(brandId),
        supabase!
          .from('subscriptions')
          .select('*')
          .eq('brand_id', brandId)
          .in('status', ['ACTIVE', 'PAYMENT_FAILED'])
          .maybeSingle()
          .then(r => r.data),
      ])

      const primaryWarehouse = warehouses.find(w => w.is_primary) ?? warehouses[0] ?? null
      const connectedIntCount = integrations.filter(i => i.status === 'CONNECTED').length
      const subscription = subData
        ? buildSubscriptionData(subData as Record<string, unknown>, teamMembers.length, connectedIntCount)
        : null
      const currentPlan = subData?.plan_type as PlanType ?? 'STARTER'

      set({
        currentBrand: brand,
        currentWarehouse: primaryWarehouse,
        brands: [brand],
        orders,
        payments,
        exceptions,
        customers,
        products,
        warehouses,
        teamMembers,
        integrations,
        currentPlan,
        subscription,
        isLoading: false,
        bootstrapError: null,
      })

      // Step 3: realtime subscriptions
      _realtimeChannels.forEach((ch) => {
        if (ch && typeof ch.unsubscribe === 'function') {
          ch.unsubscribe()
        }
      })
      _realtimeChannels = []

      const ordersChannel = subscribeToOrders(
        brandId,
        // onInsert
        (newOrder) => {
          set(state => ({ orders: [newOrder, ...state.orders] }))
        },
        // onUpdate
        (updated) => {
          set(state => ({
            orders: state.orders.map(o =>
              o.id === updated.id ? { ...o, ...updated } : o
            ),
          }))
        }
      )

      const exceptionsChannel = subscribeToExceptions(
        brandId,
        (newExc) => {
          set(state => ({ exceptions: [newExc, ...state.exceptions] }))
        }
      )

      _realtimeChannels = [ordersChannel, exceptionsChannel]
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bootstrap failed'
      set({ isLoading: false, bootstrapError: msg })
    }
  },

  // Unsubscribe from all realtime channels (call on unmount or sign-out)
  cleanup: () => {
    if (supabase) {
      _realtimeChannels.forEach(ch => supabase!.removeChannel(ch))
    }
    _realtimeChannels = []
  },

  // ─── Orders ────────────────────────────────────────────────────────────────

  updateOrder: (id, changes) => {
    // Optimistic local update
    set(state => ({ orders: state.orders.map(o => o.id === id ? { ...o, ...changes } : o) }))
    // Persist to DB in background (non-blocking)
    if (!DEMO_MODE) {
      updateOrderDB(id, changes).catch(console.error)
    }
  },

  approveOrder: (id) => {
    const prev = get().orders.find(o => o.id === id)?.rto_review_status
    set(state => ({ orders: state.orders.map(o => o.id === id ? { ...o, rto_review_status: 'APPROVED' } : o) }))
    if (!DEMO_MODE) {
      updateOrderDB(id, { rto_review_status: 'APPROVED' })
        .then(({ error }) => {
          if (error) {
            set(state => ({ orders: state.orders.map(o => o.id === id ? { ...o, rto_review_status: prev ?? o.rto_review_status } : o) }))
            showToast.mutationError('approve order')
          }
        })
        .catch(() => {
          set(state => ({ orders: state.orders.map(o => o.id === id ? { ...o, rto_review_status: prev ?? o.rto_review_status } : o) }))
          showToast.mutationError('approve order')
        })
      addOrderTimelineEvent(id, 'Order approved by review', 'system').catch(console.error)
    }
  },

  holdOrder: (id) => {
    const prev = get().orders.find(o => o.id === id)?.rto_review_status
    set(state => ({ orders: state.orders.map(o => o.id === id ? { ...o, rto_review_status: 'HELD' } : o) }))
    if (!DEMO_MODE) {
      updateOrderDB(id, { rto_review_status: 'HELD' })
        .then(({ error }) => {
          if (error) {
            set(state => ({ orders: state.orders.map(o => o.id === id ? { ...o, rto_review_status: prev ?? o.rto_review_status } : o) }))
            showToast.mutationError('hold order')
          }
        })
        .catch(() => {
          set(state => ({ orders: state.orders.map(o => o.id === id ? { ...o, rto_review_status: prev ?? o.rto_review_status } : o) }))
          showToast.mutationError('hold order')
        })
      addOrderTimelineEvent(id, 'Order placed on hold', 'system').catch(console.error)
    }
  },

  flagOrder: (id) => {
    const prev = get().orders.find(o => o.id === id)?.rto_review_status
    set(state => ({ orders: state.orders.map(o => o.id === id ? { ...o, rto_review_status: 'FLAGGED' } : o) }))
    if (!DEMO_MODE) {
      updateOrderDB(id, { rto_review_status: 'FLAGGED' })
        .then(({ error }) => {
          if (error) {
            set(state => ({ orders: state.orders.map(o => o.id === id ? { ...o, rto_review_status: prev ?? o.rto_review_status } : o) }))
            showToast.mutationError('flag order')
          }
        })
        .catch(() => {
          set(state => ({ orders: state.orders.map(o => o.id === id ? { ...o, rto_review_status: prev ?? o.rto_review_status } : o) }))
          showToast.mutationError('flag order')
        })
      addOrderTimelineEvent(id, 'Order flagged for review', 'system').catch(console.error)
    }
  },

  bulkApprove: (ids) => {
    set(state => ({
      orders: state.orders.map(o =>
        ids.includes(o.id) ? { ...o, rto_review_status: 'APPROVED' } : o
      ),
    }))
    if (!DEMO_MODE) {
      ids.forEach(id => updateOrderDB(id, { rto_review_status: 'APPROVED' }).catch(console.error))
    }
  },

  bulkHold: (ids) => {
    set(state => ({
      orders: state.orders.map(o =>
        ids.includes(o.id) ? { ...o, rto_review_status: 'HELD' } : o
      ),
    }))
    if (!DEMO_MODE) {
      ids.forEach(id => updateOrderDB(id, { rto_review_status: 'HELD' }).catch(console.error))
    }
  },

  startPacking: (ids) => {
    set(state => ({
      orders: state.orders.map(o =>
        ids.includes(o.id) ? { ...o, fulfillment_status: 'PACKING' } : o
      ),
    }))
    if (!DEMO_MODE) {
      ids.forEach(id => updateOrderDB(id, { fulfillment_status: 'PACKING' }).catch(console.error))
    }
  },

  schedulePickup: (ids, date) => {
    // Update the first shipment of each selected order locally, then persist
    // the shipment row in live mode (the shipments live in their own table,
    // so they must NOT be pushed onto the orders table).
    set(state => ({
      orders: state.orders.map(o =>
        ids.includes(o.id)
          ? {
              ...o,
              shipments: (o.shipments ?? []).map((s, i) =>
                i === 0 ? { ...s, status: 'PICKUP_SCHEDULED' as const, pickup_scheduled_at: date } : s
              ),
            }
          : o
      ),
    }))
    if (!DEMO_MODE) {
      const { orders } = get()
      ids.forEach(id => {
        const shipment = orders.find(o => o.id === id)?.shipments?.[0]
        if (shipment && !shipment.id.startsWith('ship-generated-')) {
          updateShipmentDB(shipment.id, {
            status: 'PICKUP_SCHEDULED',
            pickup_scheduled_at: date,
          }).catch(console.error)
        }
      })
    }
  },

  generateLabels: (ids) => {
    // Optimistic update using mock while real API calls run in background
    const result = mockGenerateLabels(ids)
    const { orders, integrations } = get()

    const srIntegration = integrations.find(i => i.platform === 'SHIPROCKET' && i.status === 'CONNECTED')

    const updatedOrders = orders.map(o => {
      const labelResult = result.results.find(r => r.order_id === o.id)
      if (!labelResult) return o

      // Fire real Shiprocket call when credentials are available
      if (!DEMO_MODE && srIntegration) {
        const payload: ShipmentPayload = {
          order_number: o.order_number,
          billing_customer_name: o.shipping_address.name ?? '',
          billing_phone: o.shipping_address.phone ?? '',
          billing_address: o.shipping_address.address,
          billing_city: o.shipping_address.city,
          billing_pincode: o.shipping_address.pincode,
          billing_state: o.shipping_address.state,
          payment_method: o.payment_method === 'COD' ? 'COD' : 'Prepaid',
          order_total: o.gross_amount - o.discount_amount,
          weight_kg: 0.5,
          items: (o.items ?? []).map(item => ({
            name: item.product_name ?? item.sku,
            sku: item.sku,
            units: item.quantity,
            selling_price: item.unit_price,
          })),
        }
        createShipment(
          { email: srIntegration.credentials.email, password: srIntegration.credentials.password },
          payload
        ).then(res => {
          if (res.ok && res.awb_code) {
            // Update order with real AWB + shipment ID
            set(state => ({
              orders: state.orders.map(order =>
                order.id !== o.id ? order : {
                  ...order,
                  shiprocket_shipment_id: res.shipment_id,
                  shipments: order.shipments?.map(s =>
                    s.order_id === o.id
                      ? { ...s, awb_number: res.awb_code!, courier: res.courier_name ?? s.courier }
                      : s
                  ),
                }
              ),
            }))
            updateOrderDB(o.id, {
              fulfillment_status: 'READY_TO_SHIP',
              shiprocket_shipment_id: res.shipment_id,
            }).catch(console.error)
            addOrderTimelineEvent(o.id, `Shipment created via Shiprocket. AWB: ${res.awb_code} (${res.courier_name})`, 'system').catch(console.error)
          }
        }).catch(console.error)
      } else if (!DEMO_MODE) {
        // No Shiprocket connected — just persist the status
        updateOrderDB(o.id, { fulfillment_status: 'READY_TO_SHIP' }).catch(console.error)
        addOrderTimelineEvent(o.id, `Shipping label created. AWB: ${labelResult.awb_number}`, 'system').catch(console.error)
      }

      return {
        ...o,
        fulfillment_status: 'READY_TO_SHIP' as const,
        shipments: [
          ...(o.shipments ?? []),
          {
            id: `ship-generated-${o.id}`,
            brand_id: o.brand_id,
            order_id: o.id,
            courier: labelResult.courier,
            awb_number: labelResult.awb_number,
            tracking_number: labelResult.awb_number,
            status: 'LABEL_CREATED' as const,
            pickup_scheduled_at: null,
            delivered_at: null,
            created_at: new Date().toISOString(),
          },
        ],
      }
    })
    set({ orders: updatedOrders })
    return result
  },

  // ─── Manual Order Creation ─────────────────────────────────────────────────

  addOrder: async (orderData) => {
    const brandId = get().currentBrand?.id ?? 'demo'
    const num = String(Math.floor(Math.random() * 9000) + 1000)
    const tempId = `ord-${Date.now()}`

    // Build order with null customer_id; may be patched below
    const newOrder: Order = {
      ...orderData,
      customer_id: null,
      id: tempId,
      brand_id: brandId,
      order_number: `#XM-${num}`,
      created_at: new Date().toISOString(),
    }
    newOrder.items = (newOrder.items ?? []).map(item => ({ ...item, order_id: tempId }))

    // Optimistic add immediately so navigation feels instant
    set(state => ({ orders: [newOrder, ...state.orders] }))

    // Demo mode: keep the optimistic record only.
    if (DEMO_MODE || !supabase) return newOrder

    const orderAmount = orderData.gross_amount

    // ── Step 1: upsert customer by phone and resolve customer_id ──────────────
    let customerId: string | null = null
    const phone = orderData.shipping_address.phone
    if (phone) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id, total_orders, total_spent')
        .eq('brand_id', brandId)
        .eq('phone', phone)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('customers')
          .update({
            total_orders: existing.total_orders + 1,
            total_spent: existing.total_spent + orderAmount,
          })
          .eq('id', existing.id)
        customerId = existing.id
        set(state => ({
          customers: state.customers.map(c =>
            c.id === existing.id
              ? { ...c, total_orders: c.total_orders + 1, total_spent: c.total_spent + orderAmount }
              : c
          ),
        }))
      } else {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            brand_id: brandId,
            name: orderData.shipping_address.name ?? 'Unknown',
            phone,
            email: null,
            address: orderData.shipping_address.address,
            city: orderData.shipping_address.city,
            state: orderData.shipping_address.state,
            pincode: orderData.shipping_address.pincode,
            total_orders: 1,
            total_spent: orderAmount,
            tags: [],
          })
          .select('*')
          .single()
        if (newCustomer) {
          customerId = newCustomer.id as string
          set(state => ({ customers: [...state.customers, newCustomer as unknown as Customer] }))
        }
      }
    }

    // ── Step 2: persist the order row (so it survives a reload) ───────────────
    const { data: inserted, error: orderErr } = await insertOrder({
      brand_id: brandId,
      customer_id: customerId,
      order_number: newOrder.order_number,
      channel: orderData.channel,
      gross_amount: orderData.gross_amount,
      discount_amount: orderData.discount_amount,
      shipping_charge: orderData.shipping_charge,
      shipping_cost: orderData.shipping_cost,
      payment_status: orderData.payment_status,
      payment_method: orderData.payment_method,
      fulfillment_status: orderData.fulfillment_status,
      rto_risk_score: orderData.rto_risk_score,
      rto_review_status: orderData.rto_review_status,
      shipping_address: orderData.shipping_address,
      warehouse_id: orderData.warehouse_id,
      notes: orderData.notes,
    })

    if (orderErr || !inserted) {
      // Roll back the optimistic add so the UI doesn't show a phantom order.
      set(state => ({ orders: state.orders.filter(o => o.id !== tempId) }))
      throw new Error(orderErr ?? 'Failed to create order')
    }

    const realId = inserted.id

    // ── Step 3: persist line items, payment ledger row, and timeline ─────────
    const items = (newOrder.items ?? [])
    if (items.length > 0) {
      await insertOrderItems(
        items.map(i => ({
          order_id: realId,
          product_id: i.product_id,
          product_name: i.product_name ?? null,
          sku: i.sku,
          quantity: i.quantity,
          unit_price: i.unit_price,
          cost_price: i.cost_price ?? 0,
        }))
      ).catch(() => { /* items are non-critical to navigation; surfaced via reload */ })
    }

    await supabase.from('payments').insert({
      brand_id: brandId,
      order_id: realId,
      order_number: newOrder.order_number,
      amount: orderAmount,
      method: orderData.payment_method,
      status: orderData.payment_status === 'PAID' ? 'PAID' : 'PENDING',
      gateway_ref: null,
      gateway_fee: null,
      settlement_amount: null,
      settled_at: null,
    })

    await addOrderTimelineEvent(realId, 'Order created manually', 'system')
      .catch(() => { /* timeline is non-critical */ })

    // Swap the optimistic temp record for the persisted one (real id + customer).
    const persisted: Order = {
      ...newOrder,
      id: realId,
      customer_id: customerId,
      items: items.map(i => ({ ...i, order_id: realId })),
    }
    set(state => ({
      orders: state.orders.map(o => o.id === tempId ? persisted : o),
    }))

    return persisted
  },

  // ─── Exceptions ────────────────────────────────────────────────────────────

  resolveException: (id) => {
    const prev = get().exceptions.find(e => e.id === id)?.status
    set(state => ({ exceptions: state.exceptions.map(e => e.id === id ? { ...e, status: 'RESOLVED' } : e) }))
    if (!DEMO_MODE) {
      updateExceptionDB(id, { status: 'RESOLVED' })
        .then(({ error }) => {
          if (error) {
            set(state => ({ exceptions: state.exceptions.map(e => e.id === id ? { ...e, status: prev as ExceptionStatus ?? 'UNRESOLVED' } : e) }))
            showToast.mutationError('resolve exception')
          }
        })
        .catch(() => {
          set(state => ({ exceptions: state.exceptions.map(e => e.id === id ? { ...e, status: prev as ExceptionStatus ?? 'UNRESOLVED' } : e) }))
          showToast.mutationError('resolve exception')
        })
    }
  },

  dismissException: (id) => {
    const prev = get().exceptions.find(e => e.id === id)?.status
    set(state => ({ exceptions: state.exceptions.map(e => e.id === id ? { ...e, status: 'DISMISSED' } : e) }))
    if (!DEMO_MODE) {
      updateExceptionDB(id, { status: 'DISMISSED' })
        .then(({ error }) => {
          if (error) {
            set(state => ({ exceptions: state.exceptions.map(e => e.id === id ? { ...e, status: prev as ExceptionStatus ?? 'UNRESOLVED' } : e) }))
            showToast.mutationError('dismiss exception')
          }
        })
        .catch(() => {
          set(state => ({ exceptions: state.exceptions.map(e => e.id === id ? { ...e, status: prev as ExceptionStatus ?? 'UNRESOLVED' } : e) }))
          showToast.mutationError('dismiss exception')
        })
    }
  },

  restoreException: (id, previousStatus) => {
    set(state => ({ exceptions: state.exceptions.map(e => e.id === id ? { ...e, status: previousStatus as ExceptionStatus } : e) }))
    if (!DEMO_MODE) {
      updateExceptionDB(id, { status: previousStatus as ExceptionStatus }).catch(console.error)
    }
  },

  // ─── OMS Push ─────────────────────────────────────────────────────────────

  pushToOms: async (orderId, pushType = 'MANUAL') => {
    const brandId = get().currentBrand?.id
    if (!brandId) return { ok: false, error: 'No active brand' }

    // Optimistic update
    set(state => ({
      orders: state.orders.map(o =>
        o.id === orderId ? { ...o, oms_push_status: 'PENDING' as const } : o
      ),
    }))

    if (DEMO_MODE) {
      // Simulate successful push in demo
      await new Promise(r => setTimeout(r, 600))
      set(state => ({
        orders: state.orders.map(o =>
          o.id === orderId
            ? { ...o, oms_push_status: 'PUSHED' as const, oms_pushed_at: new Date().toISOString(), routing_decision: pushType === 'AUTO' ? 'AUTO_PUSHED' as const : 'MANUALLY_PUSHED' as const }
            : o
        ),
      }))
      return { ok: true, error: null }
    }

    const { ok, error } = await pushOrderToOms(brandId, orderId, pushType)
    set(state => ({
      orders: state.orders.map(o =>
        o.id === orderId
          ? {
              ...o,
              oms_push_status: ok ? 'PUSHED' as const : 'FAILED' as const,
              oms_pushed_at: ok ? new Date().toISOString() : null,
              routing_decision: ok ? (pushType === 'AUTO' ? 'AUTO_PUSHED' as const : 'MANUALLY_PUSHED' as const) : o.routing_decision,
              oms_push_error: ok ? null : error,
            }
          : o
      ),
    }))
    return { ok, error }
  },

  bulkPushToOms: async (orderIds) => {
    const brandId = get().currentBrand?.id
    if (!brandId) return { succeeded: 0, failed: orderIds.length }

    const results = await Promise.allSettled(
      orderIds.map(id => get().pushToOms(id, 'MANUAL'))
    )
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
    return { succeeded, failed: orderIds.length - succeeded }
  },

  approveExceptionAndPush: async (exceptionId, orderId, reason, notes) => {
    const brandId = get().currentBrand?.id
    if (!brandId) return { ok: false, error: 'No active brand' }

    const order = get().orders.find(o => o.id === orderId)
    if (!order) return { ok: false, error: 'Order not found' }

    // Approve in Zustand
    set(state => ({
      orders: state.orders.map(o =>
        o.id === orderId ? { ...o, rto_review_status: 'APPROVED' as const } : o
      ),
      exceptions: state.exceptions.map(e =>
        e.id === exceptionId ? { ...e, status: 'RESOLVED' as const } : e
      ),
    }))

    if (!DEMO_MODE) {
      // Write audit log
      const { id: auditId } = await insertAuditLog({
        brand_id: brandId,
        order_id: orderId,
        order_number: order.order_number,
        exception_id: exceptionId,
        action_type: 'MANUALLY_APPROVED',
        actor_id: null,
        actor_name: null,
        actor_role: null,
        action_timestamp: new Date().toISOString(),
        original_rto_score: order.rto_risk_score,
        new_rto_score: order.rto_risk_score,
        original_status: order.rto_review_status,
        new_status: 'APPROVED',
        reason,
        notes: notes ?? null,
        metadata: { exception_id: exceptionId },
      })

      // Resolve exception with audit link
      await resolveExceptionWithAudit(exceptionId, '', reason, notes, auditId ?? undefined)

      // Update order review status in DB
      await updateOrderDB(orderId, { rto_review_status: 'APPROVED' })
    }

    // Push to OMS
    return get().pushToOms(orderId, 'MANUAL')
  },

  // ─── Products ──────────────────────────────────────────────────────────────

  addProduct: (product) => {
    const brandId = get().currentBrand?.id ?? ''
    const tempId = `prod-${Date.now()}`
    const newProduct: Product = {
      ...product,
      id: tempId,
      brand_id: brandId,
      created_at: new Date().toISOString(),
    }
    set(state => ({ products: [...state.products, newProduct] }))

    if (!DEMO_MODE) {
      addProductDB({ ...product, brand_id: brandId })
        .then(({ data, error }) => {
          if (error) { if (import.meta.env.DEV) console.error('addProduct DB error:', error); return }
          if (!data) return
          // Replace temp ID with real DB id
          set(state => ({
            products: state.products.map(p => p.id === tempId ? data : p),
          }))
        })
        .catch(console.error)
    }
  },

  updateProduct: (id, changes) => {
    set(state => ({ products: state.products.map(p => p.id === id ? { ...p, ...changes } : p) }))
    if (!DEMO_MODE) {
      updateProductDB(id, changes).catch(console.error)
    }
  },

  // ─── Warehouses ────────────────────────────────────────────────────────────

  addWarehouse: (warehouse) => {
    const brandId = get().currentBrand?.id ?? ''
    const tempId = `wh-${Date.now()}`
    const newWarehouse: Warehouse = {
      ...warehouse,
      id: tempId,
      brand_id: brandId,
      created_at: new Date().toISOString(),
    }
    set(state => ({ warehouses: [...state.warehouses, newWarehouse] }))

    if (!DEMO_MODE) {
      addWarehouseDB({ ...warehouse, brand_id: brandId })
        .then(({ data, error }) => {
          if (error) { if (import.meta.env.DEV) console.error('addWarehouse DB error:', error); return }
          if (!data) return
          set(state => ({
            warehouses: state.warehouses.map(w => w.id === tempId ? data : w),
          }))
        })
        .catch(console.error)
    }
  },

  updateWarehouse: (id, changes) => {
    set(state => ({ warehouses: state.warehouses.map(w => w.id === id ? { ...w, ...changes } : w) }))
    if (!DEMO_MODE) {
      updateWarehouseDB(id, changes).catch(console.error)
    }
  },

  setDefaultWarehouse: (id) => {
    set(state => ({
      warehouses: state.warehouses.map(w => ({ ...w, is_primary: w.id === id })),
      currentWarehouse: state.warehouses.find(w => w.id === id) ?? state.currentWarehouse,
    }))
    if (!DEMO_MODE) {
      const brandId = get().currentBrand?.id ?? ''
      setDefaultWarehouseDB(brandId, id).catch(console.error)
    }
  },

  // ─── Brand ─────────────────────────────────────────────────────────────────

  updateBrand: (changes) => {
    set(state => {
      if (!state.currentBrand) return state
      const { name, ...settingsChanges } = changes
      const updatedBrand: Brand = {
        ...state.currentBrand,
        ...(name ? { name } : {}),
        settings: { ...state.currentBrand.settings, ...settingsChanges },
      }

      if (!DEMO_MODE) {
        // Build the DB payload: name at top level, rest goes into settings JSONB
        const dbChanges: Partial<Brand> = {}
        if (name) dbChanges.name = name
        if (Object.keys(settingsChanges).length > 0) {
          dbChanges.settings = updatedBrand.settings
        }
        updateBrandDB(state.currentBrand.id, dbChanges).catch(console.error)
      }

      return { currentBrand: updatedBrand }
    })
  },

  // ─── Integrations ──────────────────────────────────────────────────────────

  updateIntegration: (id, changes) => {
    set(state => ({ integrations: state.integrations.map(i => i.id === id ? { ...i, ...changes } : i) }))
    if (!DEMO_MODE) {
      updateIntegrationDB(id, changes).catch(console.error)
    }
  },

  connectIntegration: async (platform, credentials) => {
    const brandId = get().currentBrand?.id ?? ''
    if (!brandId) return { error: 'No brand found' }

    // Optimistic: mark as CONNECTED locally
    set(state => ({
      integrations: state.integrations.map(i =>
        i.platform === platform
          ? { ...i, status: 'CONNECTED', credentials, last_sync_at: new Date().toISOString() }
          : i
      ),
    }))

    if (!DEMO_MODE) {
      const { error } = await upsertIntegration({
        brand_id: brandId,
        platform,
        status: 'CONNECTED',
        credentials,
        last_sync_at: new Date().toISOString(),
      })
      if (error) {
        // Rollback local state
        set(state => ({
          integrations: state.integrations.map(i =>
            i.platform === platform ? { ...i, status: 'DISCONNECTED' } : i
          ),
        }))
        return { error }
      }
    }
    return { error: null }
  },

  // ─── Team ──────────────────────────────────────────────────────────────────

  updateTeamMember: (id, changes) => {
    set(state => ({ teamMembers: state.teamMembers.map(m => m.id === id ? { ...m, ...changes } : m) }))
    if (!DEMO_MODE) {
      updateTeamMemberDB(id, changes).catch(console.error)
    }
  },

  removeTeamMember: (id) => {
    set(state => ({ teamMembers: state.teamMembers.filter(m => m.id !== id) }))
    if (!DEMO_MODE) {
      removeTeamMemberDB(id).catch(console.error)
    }
  },

  inviteTeamMember: async (data) => {
    const brandId = get().currentBrand?.id ?? ''
    const tempId = `member-${Date.now()}`

    // Optimistic: add a placeholder member so the UI updates immediately
    set(state => ({
      teamMembers: [
        ...state.teamMembers,
        {
          id: tempId,
          brand_id: brandId,
          user_id: '',
          role: data.role,
          name: data.name,
          email: data.email,
          created_at: new Date().toISOString(),
        },
      ],
    }))

    if (DEMO_MODE) return { error: null }

    const { error, userId } = await inviteTeamMemberDB(brandId, data.name, data.email, data.role)
    if (error) {
      // Rollback: remove the optimistic placeholder
      set(state => ({ teamMembers: state.teamMembers.filter(m => m.id !== tempId) }))
      showToast.error(`Invite failed — ${error}`)
      return { error }
    }

    // Replace the empty user_id with the real UUID from Supabase Auth
    if (userId) {
      set(state => ({
        teamMembers: state.teamMembers.map(m =>
          m.id === tempId ? { ...m, user_id: userId } : m
        ),
      }))
    }

    return { error: null }
  },

  // ─── Returns ───────────────────────────────────────────────────────────────

  setReturns: (returns) => set({ returns }),

  addReturn: (ret) => set(state => ({ returns: [ret, ...state.returns] })),

  updateReturn: (id, changes) =>
    set(state => ({ returns: state.returns.map(r => r.id === id ? { ...r, ...changes } : r) })),

  // ─── Subscription ──────────────────────────────────────────────────────────

  setSubscription: (sub) => set({ subscription: sub }),
}))
