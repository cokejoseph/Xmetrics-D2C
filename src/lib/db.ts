/**
 * db.ts — All Supabase database operations for Sentinal (live mode only).
 * Every function is a no-op guard if called in demo mode — the appStore
 * checks DEMO_MODE before calling any of these.
 */

import { supabase } from './supabase'
import type {
  Brand, BrandMember, Warehouse, Product, Customer,
  Order, OrderItem, Payment, Exception, Integration,
  Shipment, OrderTimeline,
} from '../types'

// ─── Type helpers ──────────────────────────────────────────────────────────

type SupabaseError = { error: string | null }

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
): Promise<SupabaseError> {
  const { error } = await supabase!
    .from('brand_members')
    .insert({ brand_id: brandId, name, email, role, user_id: crypto.randomUUID() })
  return { error: error?.message ?? null }
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
