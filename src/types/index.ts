// ─── Auth ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
}

// ─── Brand ─────────────────────────────────────────────────────────────────

export interface Brand {
  id: string
  name: string
  owner_id: string
  market_type: 'D2C' | 'B2B' | 'Hybrid'
  status: 'ACTIVE' | 'INACTIVE'
  settings: {
    website_url?: string
    business_type?: string
    currency?: string
    monthly_order_volume?: number
    average_order_value?: number
  }
  created_at: string
}

export interface BrandMember {
  id: string
  brand_id: string
  user_id: string
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
  name: string
  email: string
  avatar?: string
  created_at: string
}

export type PlanType = 'STARTER' | 'GROWTH' | 'SCALE' | 'ENTERPRISE'

// ─── Integration ───────────────────────────────────────────────────────────

export type IntegrationPlatform =
  | 'SHOPIFY'
  | 'WHATSAPP'
  | 'SHIPROCKET'
  | 'RAZORPAY'
  | 'ECOMEXPRESS'
  | 'UNICOMMERCE'

export type IntegrationStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'PENDING'

export interface Integration {
  id: string
  brand_id: string
  platform: IntegrationPlatform
  status: IntegrationStatus
  credentials: Record<string, string>
  last_sync_at: string | null
  error_message?: string
  created_at: string
}

// ─── Warehouse ─────────────────────────────────────────────────────────────

export interface Warehouse {
  id: string
  brand_id: string
  name: string
  address: string
  city: string
  state: string
  pincode: string
  contact_name: string
  contact_phone: string
  is_primary: boolean
  created_at: string
}

// ─── Product ───────────────────────────────────────────────────────────────

export type ProductCategory =
  | 'Skincare'
  | 'Supplements'
  | 'Food & Beverage'
  | 'Fashion'
  | 'Electronics'
  | 'Home & Kitchen'
  | 'Other'

export interface Product {
  id: string
  brand_id: string
  name: string
  sku: string
  category: ProductCategory
  selling_price: number
  cost_price: number
  inventory_count: number
  reorder_threshold: number
  weight_grams: number
  is_active: boolean
  created_at: string
}

// ─── Customer ──────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  brand_id: string
  name: string
  phone: string
  email: string | null
  address: string | null
  city: string
  state: string
  pincode: string
  total_orders: number
  total_spent: number
  tags: string[]
  created_at: string
}

// ─── Order ─────────────────────────────────────────────────────────────────

export type OrderChannel =
  | 'SHOPIFY'
  | 'WHATSAPP'
  | 'MANUAL'
  | 'AMAZON'
  | 'FLIPKART'
  | 'WOOCOMMERCE'
  | 'MEESHO'

export type PaymentStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'FAILED'

export type PaymentMethod =
  | 'COD'
  | 'UPI'
  | 'CARD'
  | 'NETBANKING'
  | 'WALLET'
  | 'PREPAID'

export type FulfillmentStatus =
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PACKING'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RTO_INITIATED'
  | 'NDR'
  | 'CANCELLED'

export type RTOReviewStatus = 'PENDING' | 'APPROVED' | 'HELD' | 'FLAGGED' | 'NOT_REQUIRED'
export type RTORiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type OmsPushStatus = 'PENDING' | 'PUSHED' | 'FAILED' | 'NOT_APPLICABLE'
export type RoutingDecision = 'READY_FOR_PUSH' | 'EXCEPTION_HOLD' | 'AUTO_PUSHED' | 'MANUALLY_PUSHED'

export interface ShippingAddress {
  name?: string
  phone?: string
  address: string
  city: string
  state: string
  pincode: string
  landmark?: string
}

export interface Order {
  id: string
  brand_id: string
  customer_id: string | null
  order_number: string
  channel: OrderChannel
  gross_amount: number
  discount_amount: number
  shipping_charge?: number
  razorpay_payment_id?: string | null
  razorpay_fee?: number        // in rupees; populated by payment.captured webhook
  razorpay_tax?: number        // GST on fee, in rupees
  shipping_cost?: number       // actual Shiprocket freight charge
  shiprocket_shipment_id?: number | null
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  fulfillment_status: FulfillmentStatus
  rto_risk_score: number
  rto_risk_level?: RTORiskLevel | null
  rto_review_status: RTOReviewStatus
  shipping_address: ShippingAddress
  warehouse_id: string | null
  notes: string | null
  external_ref?: string | null
  // OMS routing (migration 13)
  routing_decision: RoutingDecision | null
  routing_decided_at: string | null
  oms_push_status: OmsPushStatus
  oms_pushed_at: string | null
  oms_order_id: string | null
  oms_push_error: string | null
  created_at: string
  // Populated relations
  customer?: Customer
  items?: OrderItem[]
  shipments?: Shipment[]
  timeline?: OrderTimeline[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name?: string | null
  sku: string
  quantity: number
  unit_price: number
  cost_price?: number
  product?: Product
}

// ─── Payment ───────────────────────────────────────────────────────────────

export type LedgerPaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'SETTLED'

export interface Payment {
  id: string
  brand_id: string
  order_id: string | null
  order_number?: string | null
  amount: number
  method: PaymentMethod
  status: LedgerPaymentStatus
  gateway_ref: string | null
  gateway_fee: number | null
  settlement_amount: number | null
  settled_at: string | null
  created_at: string
  order?: Order
}

// ─── Shipment ──────────────────────────────────────────────────────────────

export type ShipmentStatus =
  | 'LABEL_CREATED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RTO_INITIATED'
  | 'RTO_DELIVERED'
  | 'LOST'

export interface Shipment {
  id: string
  brand_id: string
  order_id: string
  courier: string
  awb_number: string
  tracking_number: string | null
  status: ShipmentStatus
  pickup_scheduled_at: string | null
  delivered_at: string | null
  created_at: string
}

export interface OrderTimeline {
  id: string
  order_id: string
  event: string
  actor: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Exception ─────────────────────────────────────────────────────────────

export type ExceptionType =
  | 'HIGH_RTO_RISK'
  | 'FAILED_PAYMENT'
  | 'STUCK_SHIPMENT'
  | 'RTO_INITIATED'
  | 'LOW_INVENTORY'
  | 'PENDING_SETTLEMENT'
  | 'FAILED_WEBHOOK'
  | 'ADDRESS_ISSUE'

export type ExceptionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type ExceptionStatus = 'UNRESOLVED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED'

export interface Exception {
  id: string
  brand_id: string
  order_id: string | null
  type: ExceptionType
  severity: ExceptionSeverity
  status: ExceptionStatus
  title: string
  description: string
  created_at: string
  // Resolution tracking (migration 13)
  resolved_by: string | null
  resolved_at: string | null
  resolution_reason: string | null
  resolution_notes: string | null
  audit_log_id: string | null
  order?: Order
}

// ─── Daily Brief ───────────────────────────────────────────────────────────

export interface BriefHeadline {
  total_orders: number
  total_revenue: number
  cogs: number
  shipping_cost: number
  true_profit: number
  true_margin: number
  paid_count: number
  cod_count: number
  rto_count: number
}

export interface BriefDeliveryHealth {
  rto_rate: number
  spiked: boolean
  avg_rto_score: number
  high_risk_orders: Array<{ order_number: string; score: number }>
}

export interface BriefAction {
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  text: string
}

export interface BriefData {
  date: string
  headline: BriefHeadline
  delivery_health: BriefDeliveryHealth
  channel_performance: Array<{
    channel: string
    orders: number
    revenue: number
  }>
  product_performance: Array<{
    name: string
    sku: string
    units: number
    revenue: number
    low_stock: boolean
  }>
  customer_health: {
    new_customers: number
    returning_customers: number
    repeat_rate: number
  }
  actions: BriefAction[]
}

export interface DailyBrief {
  id: string
  brand_id: string
  date: string                             // DB column name
  headline: BriefHeadline
  delivery_health: BriefDeliveryHealth
  channel_performance: Array<{ channel: string; orders: number; revenue: number }>
  product_performance: Array<{ name: string; sku: string; units: number; revenue: number; low_stock: boolean }>
  customer_health: { new_customers: number; returning_customers: number; repeat_rate: number }
  actions: BriefAction[]
  generated_by: string | null
  created_at: string
}

// ─── Forecast ──────────────────────────────────────────────────────────────

export type ForecastStatus =
  | 'OUT_OF_STOCK'
  | 'REORDER_NOW'
  | 'REORDER_SOON'
  | 'IN_STOCK'
  | 'DEAD_STOCK'
  | 'INSUFFICIENT_DATA'
  | 'UNPREDICTABLE'

export interface SKUForecast {
  product_id: string
  name: string
  sku: string
  category: string
  inventory_count: number
  avg_daily_demand: number
  total_units_sold_30d: number
  days_of_stock: number
  predicted_stockout_date: string | null
  reorder_quantity: number
  status: ForecastStatus
}

export interface ForecastSummary {
  out_of_stock_count: number
  reorder_now_count: number
  reorder_soon_count: number
  in_stock_count: number
  dead_stock_count: number
  total_skus: number
}

// ─── RTO Score ─────────────────────────────────────────────────────────────

export interface RTOScoreResult {
  score: number
  level: RTORiskLevel
  factors: string[]
}

// ─── Search ────────────────────────────────────────────────────────────────

export type SearchResultType = 'order' | 'customer' | 'product' | 'shipment'

export interface SearchResult {
  type: SearchResultType
  id: string
  primary: string
  secondary: string
  url: string
}

// ─── Returns ───────────────────────────────────────────────────────────────

export type ReturnReason =
  | 'damaged'
  | 'wrong_item'
  | 'changed_mind'
  | 'defective'
  | 'size_issue'

export type ReturnStatus =
  | 'PENDING_APPROVAL'
  | 'AUTO_DENIED'
  | 'APPROVED'
  | 'LABEL_GENERATED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'REFUND_INITIATED'
  | 'COMPLETED'
  | 'LOST'

export type ReturnCondition = 'GOOD' | 'DAMAGED' | 'DEFECTIVE' | 'LOST'

export interface Return {
  id: string
  brand_id: string
  order_id: string
  customer_id: string
  return_reason: ReturnReason
  customer_comment: string | null
  status: ReturnStatus
  denial_reason: string | null
  return_condition: ReturnCondition | null
  return_eligible_for_resale: boolean
  return_window_days: number
  return_initiation_date: string
  return_approved_date: string | null
  return_approved_by: string | null
  return_approval_notes: string | null
  shiprocket_awb_number: string | null
  shiprocket_order_id: string | null
  shiprocket_label_url: string | null
  shiprocket_error: string | null
  expected_return_delivery: string | null
  actual_return_received_date: string | null
  refund_amount: number | null
  refund_method: 'RAZORPAY' | 'COD_REVERSAL' | null
  razorpay_refund_id: string | null
  cod_refund_status: 'PENDING' | 'SENT' | 'CONFIRMED' | null
  inventory_updated_at: string | null
  created_at: string
  updated_at: string
  // populated relations
  order?: Order
  customer?: Customer
}

// ─── Reconciliation ────────────────────────────────────────────────────────

export type CodRemittanceStatus =
  | 'REMITTED'
  | 'PENDING'
  | 'SHORT_PAID'
  | 'DEDUCTED'
  | 'CANCELLED'

export interface CodRemittanceRow {
  id: string
  upload_id: string
  brand_id: string
  order_number: string
  awb_number: string | null
  delivery_date: string | null
  collected_amount: number
  remitted_amount: number
  remittance_date: string | null
  deductions: number
  status: CodRemittanceStatus
  shiprocket_ref: string | null
  created_at: string
}

export interface CodRemittanceUpload {
  id: string
  brand_id: string
  filename: string
  period_start: string
  period_end: string
  uploaded_by: string
  row_count: number
  status: 'DONE' | 'ERROR'
  error_message: string | null
  created_at: string
}

export interface ReconciliationReport {
  id: string
  brand_id: string
  period_start: string
  period_end: string
  report_type: 'COD' | 'PREPAID' | 'COMBINED'
  cod_orders: number
  cod_order_value: number
  cod_collected: number
  cod_remitted: number
  cod_pending_count: number
  cod_short_paid_count: number
  cod_unremitted_count: number
  cod_discrepancy: number
  prepaid_orders: number
  prepaid_collected: number
  prepaid_fees: number
  prepaid_settled: number
  cod_upload_id: string | null
  generated_by: string | null
  created_at: string
}

export type ReconRowStatus = 'MATCHED' | 'PENDING' | 'SHORT_PAID' | 'UNREMITTED' | 'CANCELLED'

export interface ReconciliationRow {
  order_number: string
  order_id: string | null
  awb_number: string | null
  customer_name: string | null
  order_date: string | null
  delivery_date: string | null
  payment_method: 'COD' | 'PREPAID'
  order_amount: number
  collected_amount: number
  remitted_amount: number
  discrepancy: number
  gateway_fee: number
  status: ReconRowStatus
  razorpay_payment_id: string | null
  shiprocket_ref: string | null
}

export interface RazorpayPaymentSynced {
  id: string
  order_id: string | null
  amount: number
  method: string
  status: string
  fee: number
  tax: number
  settlement_amount: number
  created_at: string
  notes: Record<string, string>
}

// ─── OMS Push Log ──────────────────────────────────────────────────────────

export interface OmsPushLog {
  id: string
  brand_id: string
  order_id: string
  order_number: string
  push_type: 'AUTO' | 'MANUAL' | 'RETRY'
  pushed_at: string
  payload: Record<string, unknown>
  http_status: number | null
  response_body: Record<string, unknown> | null
  success: boolean
  error_message: string | null
  attempt_number: number
}

// ─── Approval Audit Log ────────────────────────────────────────────────────

export type AuditActionType =
  | 'AUTO_APPROVED'
  | 'MANUALLY_APPROVED'
  | 'APPROVED_HIGH_RTO'
  | 'APPROVED_INVALID_ADDRESS'
  | 'APPROVED_LOW_INVENTORY'
  | 'APPROVED_PAYMENT_MISMATCH'
  | 'ADDRESS_CORRECTED_AND_APPROVED'
  | 'HELD'
  | 'RELEASED_FROM_HOLD'
  | 'ORDER_CANCELLED'
  | 'PUSHED_TO_OMS'
  | 'AUTO_PUSHED_TO_OMS'

export interface ApprovalAuditLog {
  id: string
  brand_id: string
  order_id: string
  order_number: string
  exception_id: string | null
  action_type: AuditActionType
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  action_timestamp: string
  original_rto_score: number | null
  new_rto_score: number | null
  original_status: string | null
  new_status: string | null
  reason: string | null
  notes: string | null
  metadata: Record<string, unknown>
}

// ─── NDR Events ────────────────────────────────────────────────────────────

export type NdrRecoveryAction = 'RESCHEDULE' | 'ADDRESS_UPDATE' | 'ACCEPT_RTO' | 'CUSTOMER_NOTIFIED' | 'PENDING'
export type NdrRecoveryActor = 'FOUNDER' | 'CUSTOMER' | 'AUTO'
export type NdrOutcome = 'DELIVERED' | 'RTO' | 'PENDING' | 'ESCALATED'
export type NdrCustomerResponse = 'RESCHEDULE' | 'UPDATE_ADDRESS' | 'ACCEPT_RTO' | 'NO_RESPONSE'

export interface NdrEvent {
  id: string
  brand_id: string
  order_id: string
  awb_number: string
  shiprocket_ndr_id: string | null
  attempt_number: number
  ndr_reason: string | null
  ndr_reason_code: string | null
  received_at: string
  recovery_action: NdrRecoveryAction
  recovery_action_at: string | null
  recovery_actor: NdrRecoveryActor | null
  rescheduled_date: string | null
  updated_address: Record<string, string> | null
  wa_customer_sent_at: string | null
  wa_founder_sent_at: string | null
  customer_response: NdrCustomerResponse | null
  customer_responded_at: string | null
  final_outcome: NdrOutcome
  final_outcome_at: string | null
}

// ─── OMS Integration Settings (stored in brands.settings) ─────────────────

export interface OmsSettings {
  oms_webhook_url?: string
  oms_webhook_secret?: string
  oms_webhook_enabled?: boolean
  auto_push_green?: boolean
  auto_push_yellow?: boolean
}

// ─── Subscription & Billing ─────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAYMENT_FAILED'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED'

export interface SubscriptionData {
  plan_type: PlanType
  status: SubscriptionStatus
  feature_flags: Record<string, boolean>
  billing_start_date: string
  next_renewal_date: string | null
  plan_amount_paise: number

  orders_used: number
  orders_limit: number | null
  orders_pct: number
  at_order_limit: boolean

  team_used: number
  team_limit: number | null
  at_team_limit: boolean

  integrations_used: number
  integrations_limit: number | null
  at_integration_limit: boolean

  at_capacity: boolean
}

