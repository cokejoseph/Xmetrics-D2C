/**
 * db.ts — All Supabase database operations for Sentinal (live mode only).
 * Every function is a no-op guard if called in demo mode — the appStore
 * checks DEMO_MODE before calling any of these.
 */

import { supabase, callAuthEdgeFunction } from './supabase'
import type {
  Brand, BrandMember, Warehouse, Product, Customer,
  Order, OrderItem, Payment, Exception, Integration,
  Shipment, OrderTimeline, ApprovalAuditLog, NdrEvent, OmsPushLog,
} from '../types'

// ─── Type helpers ──────────────────────────────────────────────────────────

type SupabaseError = { error: string | null }

// Shape returned by our JWT-protected edge functions: a `{ data, error }`
// envelope. Typed loosely on `data` because each function returns a different
// payload; the optional fields below cover everything the callers below read.
type EdgeFnResult = {
  error?: { message: string } | null
  data?: {
    ok?: boolean
    error?: string | null
    log?: OmsPushLog[]
    retried?: number
    succeeded?: number
    still_failed?: number
  } | null
}

// ─── Brand ─────────────────────────────────────────────────────────────────

/**
 * Create a new brand + owner membership in one transaction.
 * Called from Onboarding in live mode.
 */
export async function createBrand(
  userId: string,
  ownerName: string,
  ownerEmail: string,
  brandName: string,
  marketType: string
): Promise<{ brand: Brand | null; error: string | null }> {
  // Generate ID client-side so we can insert brand_member before SELECTing.
  // The SELECT policy on brands checks brand_members, so we must insert the
  // member first — otherwise .select() after INSERT returns nothing (RLS blocks it).
  const brandId = crypto.randomUUID()

  // 1. Insert brand (no .select() — avoids the RLS bootstrap problem)
  const { error: brandErr } = await supabase!
    .from('brands')
    .insert({
      id: brandId,
      name: brandName,
      owner_id: userId,
      market_type: marketType,
      status: 'ACTIVE',
      settings: {},
    })

  if (brandErr) return { brand: null, error: brandErr.message }

  // 2. Add owner as brand_member (now SELECT policy will pass)
  const { error: memberErr } = await supabase!
    .from('brand_members')
    .insert({
      brand_id: brandId,
      user_id: userId,
      role: 'OWNER',
      name: ownerName,
      email: ownerEmail,
    })

  if (memberErr) return { brand: null, error: memberErr.message }

  // Return a Brand object directly — we already know every field we inserted,
  // so no need to SELECT (which would be subject to RLS and timing issues).
  const brand: Brand = {
    id: brandId,
    name: brandName,
    owner_id: userId,
    market_type: marketType as Brand['market_type'],
    status: 'ACTIVE',
    settings: {},
    created_at: new Date().toISOString(),
  }
  return { brand, error: null }
}

export async function getBrandForUser(userId: string): Promise<Brand | null> {
  const { data, error } = await supabase!
    .from('brand_members')
    .select('brand_id, brands(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !data) return null

  const brandData = data as unknown as { brands: Brand }
  return brandData.brands
}

export async function updateBrandDB(brandId: string, changes: Partial<Brand>): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('brands')
    .update(changes)
    .eq('id', brandId)
  return { error: error?.message ?? null }
}

// ─── Team Members ──────────────────────────────────────────────────────────

export async function getTeamMembers(brandId: string): Promise<BrandMember[]> {
  const { data, error } = await supabase!
    .from('brand_members')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at')

  if (error || !data) return []
  return data as BrandMember[]
}

export async function inviteTeamMemberDB(
  brandId: string,
  name: string,
  email: string,
  role: BrandMember['role']
): Promise<{ error: string | null; userId?: string }> {
  try {
    // Delegates to the invite-team-member edge function which uses Supabase
    // Auth Admin API to send a real invitation email and links the invitee's
    // real UUID into brand_members. Using crypto.randomUUID() here would create
    // a ghost membership that can never match any authenticated user.
    const result = await callAuthEdgeFunction('invite-team-member', {
      brand_id: brandId,
      name,
      email,
      role,
    }) as { success?: boolean; user_id?: string; error?: string }
    if (result.error) return { error: result.error }
    return { error: null, userId: result.user_id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invite failed' }
  }
}

export async function updateTeamMemberDB(
  memberId: string,
  changes: Partial<BrandMember>
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('brand_members')
    .update(changes)
    .eq('id', memberId)
  return { error: error?.message ?? null }
}

export async function removeTeamMemberDB(memberId: string): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('brand_members')
    .delete()
    .eq('id', memberId)
  return { error: error?.message ?? null }
}

// ─── Warehouses ─────────────────────────────────────────────────────────────

export async function getWarehouses(brandId: string): Promise<Warehouse[]> {
  const { data } = await supabase!
    .from('warehouses')
    .select('*')
    .eq('brand_id', brandId)
    .order('is_primary', { ascending: false })
  return (data ?? []) as Warehouse[]
}

export async function addWarehouseDB(
  warehouse: Omit<Warehouse, 'id' | 'created_at'>
): Promise<{ data: Warehouse | null; error: string | null }> {
  const { data, error } = await supabase!
    .from('warehouses')
    .insert(warehouse)
    .select()
    .single()
  return { data: data as Warehouse | null, error: error?.message ?? null }
}

export async function updateWarehouseDB(
  id: string,
  changes: Partial<Warehouse>
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('warehouses')
    .update(changes)
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function setDefaultWarehouseDB(
  brandId: string,
  warehouseId: string
): Promise<SupabaseError> {
  // Clear all primary flags then set the new one — two-step atomic
  const { error: e1 } = await supabase!
    .from('warehouses')
    .update({ is_primary: false })
    .eq('brand_id', brandId)
  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase!
    .from('warehouses')
    .update({ is_primary: true })
    .eq('id', warehouseId)
  return { error: e2?.message ?? null }
}

// ─── Products ──────────────────────────────────────────────────────────────

export async function getProducts(brandId: string): Promise<Product[]> {
  const { data } = await supabase!
    .from('products')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at')
  return (data ?? []) as Product[]
}

export async function addProductDB(
  product: Omit<Product, 'id' | 'created_at'>
): Promise<{ data: Product | null; error: string | null }> {
  const { data, error } = await supabase!
    .from('products')
    .insert(product)
    .select()
    .single()
  return { data: data as Product | null, error: error?.message ?? null }
}

export async function updateProductDB(
  id: string,
  changes: Partial<Product>
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('products')
    .update(changes)
    .eq('id', id)
  return { error: error?.message ?? null }
}

// ─── Customers ─────────────────────────────────────────────────────────────

export async function getCustomers(brandId: string): Promise<Customer[]> {
  const { data } = await supabase!
    .from('customers')
    .select('*')
    .eq('brand_id', brandId)
    .order('total_spent', { ascending: false })
  return (data ?? []) as Customer[]
}

export async function upsertCustomer(
  customer: Omit<Customer, 'id' | 'created_at'>
): Promise<{ data: Customer | null; error: string | null }> {
  const { data, error } = await supabase!
    .from('customers')
    .upsert(customer, { onConflict: 'brand_id,phone' })
    .select()
    .single()
  return { data: data as Customer | null, error: error?.message ?? null }
}

// ─── Orders ────────────────────────────────────────────────────────────────

export async function getOrders(brandId: string): Promise<Order[]> {
  // Step 1: fetch orders (RLS-scoped to brand)
  const ordersRes = await supabase!
    .from('orders')
    .select('*, customer:customers(*)')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(500)

  const orders = (ordersRes.data ?? []) as Order[]
  if (orders.length === 0) return []

  const orderIds = orders.map(o => o.id)

  // Step 2: fetch relations using real ID arrays (no sub-select query builder)
  const [itemsRes, shipmentsRes, timelineRes] = await Promise.all([
    supabase!
      .from('order_items')
      .select('*, product:products(*)')
      .in('order_id', orderIds),
    supabase!
      .from('shipments')
      .select('*')
      .in('order_id', orderIds),
    supabase!
      .from('order_timeline')
      .select('*')
      .in('order_id', orderIds)
      .order('created_at'),
  ])

  const items = (itemsRes.data ?? []) as OrderItem[]
  const shipments = (shipmentsRes.data ?? []) as Shipment[]
  const timeline = (timelineRes.data ?? []) as OrderTimeline[]

  // Stitch items, shipments, timeline onto each order
  return orders.map(order => ({
    ...order,
    items: items.filter(i => i.order_id === order.id),
    shipments: shipments.filter(s => s.order_id === order.id),
    timeline: timeline.filter(t => t.order_id === order.id),
  }))
}

export async function updateOrderDB(
  id: string,
  changes: Partial<Order>
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('orders')
    .update(changes)
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function addOrderTimelineEvent(
  orderId: string,
  event: string,
  actor: string,
  metadata?: Record<string, unknown>
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('order_timeline')
    .insert({ order_id: orderId, event, actor, metadata: metadata ?? {} })
  return { error: error?.message ?? null }
}

export async function insertOrder(
  order: Omit<Order, 'id' | 'created_at' | 'items' | 'shipments' | 'timeline' | 'customer'>
): Promise<{ data: Order | null; error: string | null }> {
  const { data, error } = await supabase!
    .from('orders')
    .insert(order)
    .select()
    .single()
  return { data: data as Order | null, error: error?.message ?? null }
}

export async function insertOrderItems(
  items: Omit<OrderItem, 'id'>[]
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('order_items')
    .insert(items)
  return { error: error?.message ?? null }
}

export async function updateShipmentDB(
  id: string,
  changes: Partial<Shipment>
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('shipments')
    .update(changes)
    .eq('id', id)
  return { error: error?.message ?? null }
}

// ─── Payments ──────────────────────────────────────────────────────────────

export async function getPayments(brandId: string): Promise<Payment[]> {
  const { data } = await supabase!
    .from('payments')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []) as Payment[]
}

// ─── Exceptions ────────────────────────────────────────────────────────────

export async function getExceptions(brandId: string): Promise<Exception[]> {
  const { data } = await supabase!
    .from('exceptions')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Exception[]
}

export async function updateExceptionDB(
  id: string,
  changes: Partial<Exception>
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('exceptions')
    .update(changes)
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function createException(
  exception: Omit<Exception, 'id' | 'created_at'>
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('exceptions')
    .insert(exception)
  return { error: error?.message ?? null }
}

// ─── Integrations ──────────────────────────────────────────────────────────

export async function getIntegrations(brandId: string): Promise<Integration[]> {
  const { data } = await supabase!
    .from('integrations')
    .select('*')
    .eq('brand_id', brandId)
  return (data ?? []) as Integration[]
}

export async function upsertIntegration(
  integration: Omit<Integration, 'id' | 'created_at'>
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('integrations')
    .upsert(integration, { onConflict: 'brand_id,platform' })
  return { error: error?.message ?? null }
}

export async function updateIntegrationDB(
  id: string,
  changes: Partial<Integration>
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('integrations')
    .update(changes)
    .eq('id', id)
  return { error: error?.message ?? null }
}

// ─── Realtime subscriptions ────────────────────────────────────────────────

/**
 * Subscribe to live order changes for a brand.
 * Returns the subscription channel so the caller can unsubscribe.
 */
export function subscribeToOrders(
  brandId: string,
  onInsert: (order: Order) => void,
  onUpdate: (order: Partial<Order> & { id: string }) => void
) {
  return supabase!
    .channel(`orders:${brandId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders', filter: `brand_id=eq.${brandId}` },
      payload => onInsert(payload.new as Order)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders', filter: `brand_id=eq.${brandId}` },
      payload => onUpdate(payload.new as Partial<Order> & { id: string })
    )
    .subscribe()
}

export function subscribeToExceptions(
  brandId: string,
  onInsert: (exc: Exception) => void
) {
  return supabase!
    .channel(`exceptions:${brandId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'exceptions', filter: `brand_id=eq.${brandId}` },
      payload => onInsert(payload.new as Exception)
    )
    .subscribe()
}

// ─── Approval Audit Log ────────────────────────────────────────────────────

export async function insertAuditLog(
  entry: Omit<ApprovalAuditLog, 'id'>
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase!
    .from('approval_audit_log')
    .insert(entry)
    .select('id')
    .single()
  return { id: data?.id ?? null, error: error?.message ?? null }
}

export async function getAuditLog(
  brandId: string,
  orderId?: string,
  limit = 50
): Promise<ApprovalAuditLog[]> {
  let q = supabase!
    .from('approval_audit_log')
    .select('*')
    .eq('brand_id', brandId)
    .order('action_timestamp', { ascending: false })
    .limit(limit)

  if (orderId) q = q.eq('order_id', orderId)

  const { data } = await q
  return (data ?? []) as ApprovalAuditLog[]
}

// ─── Exception resolution ──────────────────────────────────────────────────

export async function resolveExceptionWithAudit(
  exceptionId: string,
  userId: string,
  reason: string,
  notes?: string,
  auditLogId?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase!
    .from('exceptions')
    .update({
      status: 'RESOLVED',
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
      resolution_reason: reason,
      resolution_notes: notes ?? null,
      audit_log_id: auditLogId ?? null,
    })
    .eq('id', exceptionId)
  return { error: error?.message ?? null }
}

// ─── OMS Push ─────────────────────────────────────────────────────────────

export async function pushOrderToOms(
  brandId: string,
  orderId: string,
  pushType: 'AUTO' | 'MANUAL' = 'MANUAL'
): Promise<{ ok: boolean; error: string | null }> {
  const result = await callAuthEdgeFunction<EdgeFnResult>('oms-push', {
    action: 'push_order',
    brand_id: brandId,
    order_id: orderId,
    push_type: pushType,
  })
  if (result.error) return { ok: false, error: result.error.message }
  return { ok: result.data?.ok ?? false, error: result.data?.error ?? null }
}

export async function getOmsPushLog(
  brandId: string,
  orderId: string
): Promise<OmsPushLog[]> {
  const result = await callAuthEdgeFunction<EdgeFnResult>('oms-push', {
    action: 'get_push_log',
    brand_id: brandId,
    order_id: orderId,
  })
  return result.data?.log ?? []
}

export async function retryFailedOmsPushes(
  brandId: string
): Promise<{ retried: number; succeeded: number; still_failed: number; error: string | null }> {
  const result = await callAuthEdgeFunction<EdgeFnResult>('oms-push', {
    action: 'retry_failed',
    brand_id: brandId,
  })
  if (result.error) return { retried: 0, succeeded: 0, still_failed: 0, error: result.error.message }
  return {
    retried: result.data?.retried ?? 0,
    succeeded: result.data?.succeeded ?? 0,
    still_failed: result.data?.still_failed ?? 0,
    error: null,
  }
}

// ─── NDR Events ───────────────────────────────────────────────────────────

export async function getNdrEvents(
  brandId: string,
  orderId?: string
): Promise<NdrEvent[]> {
  let q = supabase!
    .from('ndr_events')
    .select('*')
    .eq('brand_id', brandId)
    .order('received_at', { ascending: false })

  if (orderId) q = q.eq('order_id', orderId)

  const { data } = await q
  return (data ?? []) as NdrEvent[]
}

export async function insertNdrEvent(
  event: Omit<NdrEvent, 'id'>
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase!
    .from('ndr_events')
    .insert(event)
    .select('id')
    .single()
  return { id: data?.id ?? null, error: error?.message ?? null }
}

export async function updateNdrEvent(
  id: string,
  changes: Partial<NdrEvent>
): Promise<{ error: string | null }> {
  const { error } = await supabase!
    .from('ndr_events')
    .update(changes)
    .eq('id', id)
  return { error: error?.message ?? null }
}

// ─── Campaigns (Campaign ROI / Discount Leakage) ───────────────────────────

type CampaignRow = {
  id: string; name: string; coupon_code: string; spend: number
  channel: string | null; started_at: string | null; notes: string | null
}

export async function getCampaigns(brandId: string): Promise<CampaignRow[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('campaigns')
    .select('id, name, coupon_code, spend, channel, started_at, notes')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
  return (data ?? []) as CampaignRow[]
}

export async function addCampaignDB(
  brandId: string,
  c: { name: string; coupon_code: string; spend: number; channel?: string | null; started_at?: string | null; notes?: string | null },
): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('campaigns')
    .insert({
      brand_id: brandId,
      name: c.name,
      coupon_code: c.coupon_code,
      spend: c.spend,
      channel: c.channel ?? null,
      started_at: c.started_at ?? null,
      notes: c.notes ?? null,
    })
    .select('id')
    .single()
  return (data?.id as string) ?? null
}

export async function removeCampaignDB(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('campaigns').delete().eq('id', id)
}

// ─── NDR Shiprocket actions ────────────────────────────────────────────────

export async function ndrReschedule(
  email: string, password: string, awb: string, comment?: string
): Promise<{ ok: boolean; error: string | null }> {
  const result = await callAuthEdgeFunction<EdgeFnResult>('shiprocket-proxy', {
    action: 'reschedule_delivery',
    email, password, awb,
    ndr_comment: comment,
  })
  if (result.error) return { ok: false, error: result.error.message }
  return { ok: result.data?.ok ?? false, error: result.data?.error ?? null }
}

export async function ndrUpdateAddress(
  email: string, password: string,
  awb: string,
  address: { address: string; city: string; state: string; pincode: string; name?: string; phone?: string }
): Promise<{ ok: boolean; error: string | null }> {
  const result = await callAuthEdgeFunction<EdgeFnResult>('shiprocket-proxy', {
    action: 'update_ndr_address',
    email, password, awb,
    ...address,
  })
  if (result.error) return { ok: false, error: result.error.message }
  return { ok: result.data?.ok ?? false, error: result.data?.error ?? null }
}

export async function ndrAcceptRto(
  email: string, password: string, awb: string, comment?: string
): Promise<{ ok: boolean; error: string | null }> {
  const result = await callAuthEdgeFunction<EdgeFnResult>('shiprocket-proxy', {
    action: 'accept_rto',
    email, password, awb,
    comment,
  })
  if (result.error) return { ok: false, error: result.error.message }
  return { ok: result.data?.ok ?? false, error: result.data?.error ?? null }
}

// ─── OMS Settings ─────────────────────────────────────────────────────────

export async function updateOmsSettings(
  brandId: string,
  settings: {
    oms_webhook_url?: string
    oms_webhook_secret?: string
    oms_webhook_enabled?: boolean
    auto_push_green?: boolean
    auto_push_yellow?: boolean
  }
): Promise<{ error: string | null }> {
  // Merge into existing brand.settings JSONB
  const { data: brand } = await supabase!
    .from('brands')
    .select('settings')
    .eq('id', brandId)
    .single()

  const merged = { ...(brand?.settings ?? {}), ...settings }

  const { error } = await supabase!
    .from('brands')
    .update({ settings: merged })
    .eq('id', brandId)

  return { error: error?.message ?? null }
}

export async function getOmsSettings(brandId: string): Promise<{
  oms_webhook_url: string | null
  oms_webhook_enabled: boolean
  auto_push_green: boolean
  auto_push_yellow: boolean
}> {
  const { data } = await supabase!
    .from('brands')
    .select('settings')
    .eq('id', brandId)
    .single()

  const s = (data?.settings ?? {}) as Record<string, unknown>
  return {
    oms_webhook_url: (s.oms_webhook_url as string) ?? null,
    oms_webhook_enabled: (s.oms_webhook_enabled as boolean) ?? false,
    auto_push_green: (s.auto_push_green as boolean) ?? false,
    auto_push_yellow: (s.auto_push_yellow as boolean) ?? false,
  }
}
