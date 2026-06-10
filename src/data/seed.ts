import type {
  Brand, BrandMember, Warehouse, Product, Customer, Order,
  OrderItem, Shipment, OrderTimeline, Payment, Exception, Integration,
} from '../types'

// ─── Date helper — all dates are relative to today ─────────────────────────
function dAt(daysAgo: number, hours = 10, mins = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hours, mins, 0, 0)
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// ─── Brand ─────────────────────────────────────────────────────────────────

export const DEMO_USER_ID = 'user-demo-001'
export const DEMO_BRAND_ID = 'brand-zestify-001'

export const DEMO_BRAND: Brand = {
  id: DEMO_BRAND_ID,
  name: 'Zestify Foods',
  owner_id: DEMO_USER_ID,
  market_type: 'D2C',
  status: 'ACTIVE',
  settings: {
    website_url: 'https://zestifyfoods.in',
    business_type: 'Health & Wellness',
    currency: 'INR',
    monthly_order_volume: 500,
    average_order_value: 850,
  },
  created_at: '2024-01-15T10:00:00Z',
}

export const DEMO_TEAM: BrandMember[] = [
  { id: 'member-001', brand_id: DEMO_BRAND_ID, user_id: DEMO_USER_ID, role: 'OWNER', name: 'Rohan Mehta', email: 'rohan@zestifyfoods.in', created_at: '2024-01-15T10:00:00Z' },
  { id: 'member-002', brand_id: DEMO_BRAND_ID, user_id: 'user-002', role: 'ADMIN', name: 'Sneha Kapoor', email: 'sneha@zestifyfoods.in', created_at: '2024-02-01T10:00:00Z' },
  { id: 'member-003', brand_id: DEMO_BRAND_ID, user_id: 'user-003', role: 'EDITOR', name: 'Vikram Das', email: 'vikram@zestifyfoods.in', created_at: '2024-03-10T10:00:00Z' },
]

// ─── Warehouses ────────────────────────────────────────────────────────────

export const DEMO_WAREHOUSES: Warehouse[] = [
  { id: 'wh-001', brand_id: DEMO_BRAND_ID, name: 'Delhi Main Warehouse', address: 'Plot 45, Sector 18, Industrial Area', city: 'New Delhi', state: 'Delhi', pincode: '110018', contact_name: 'Suresh Gupta', contact_phone: '+91 9876543210', is_primary: true, created_at: '2024-01-15T10:00:00Z' },
  { id: 'wh-002', brand_id: DEMO_BRAND_ID, name: 'Mumbai Fulfillment Center', address: '12, MIDC Andheri East', city: 'Mumbai', state: 'Maharashtra', pincode: '400093', contact_name: 'Ramesh Patil', contact_phone: '+91 9988776655', is_primary: false, created_at: '2024-06-01T10:00:00Z' },
]

// ─── Integrations ──────────────────────────────────────────────────────────

export const DEMO_INTEGRATIONS: Integration[] = [
  { id: 'int-shopify', brand_id: DEMO_BRAND_ID, platform: 'SHOPIFY', status: 'CONNECTED', credentials: { store_url: 'zestifyfoods.myshopify.com' }, last_sync_at: dAt(0, 8, 0), created_at: '2024-01-20T10:00:00Z' },
  { id: 'int-razorpay', brand_id: DEMO_BRAND_ID, platform: 'RAZORPAY', status: 'CONNECTED', credentials: { key_id: 'rzp_live_****' }, last_sync_at: dAt(0, 8, 0), created_at: '2024-01-20T10:00:00Z' },
  { id: 'int-shiprocket', brand_id: DEMO_BRAND_ID, platform: 'SHIPROCKET', status: 'CONNECTED', credentials: { email: 'ops@zestifyfoods.in' }, last_sync_at: dAt(0, 7, 30), created_at: '2024-01-22T10:00:00Z' },
  { id: 'int-whatsapp', brand_id: DEMO_BRAND_ID, platform: 'WHATSAPP', status: 'CONNECTED', credentials: { phone_number: '+91 9876500000' }, last_sync_at: dAt(1, 18, 0), created_at: '2024-02-05T10:00:00Z' },
  { id: 'int-shippo', brand_id: DEMO_BRAND_ID, platform: 'SHIPPO', status: 'DISCONNECTED', credentials: {}, last_sync_at: null, created_at: '2024-05-10T10:00:00Z' },
  { id: 'int-easypost', brand_id: DEMO_BRAND_ID, platform: 'EASYPOST', status: 'DISCONNECTED', credentials: {}, last_sync_at: null, created_at: '2024-05-10T10:00:00Z' },
]

// ─── Products (20 SKUs) ────────────────────────────────────────────────────

export const DEMO_PRODUCTS: Product[] = [
  { id: 'prod-001', brand_id: DEMO_BRAND_ID, name: 'Whey Protein - Chocolate', sku: 'ZWP-CHO', category: 'Supplements', selling_price: 999, cost_price: 580, inventory_count: 124, reorder_threshold: 20, weight_grams: 1000, is_active: true, created_at: '2024-01-15T10:00:00Z' },
  { id: 'prod-002', brand_id: DEMO_BRAND_ID, name: 'Whey Protein - Vanilla', sku: 'ZWP-VAN', category: 'Supplements', selling_price: 999, cost_price: 580, inventory_count: 87, reorder_threshold: 20, weight_grams: 1000, is_active: true, created_at: '2024-01-15T10:00:00Z' },
  { id: 'prod-003', brand_id: DEMO_BRAND_ID, name: 'BCAA - Mango Blast', sku: 'ZBCAA-MNG', category: 'Supplements', selling_price: 749, cost_price: 420, inventory_count: 8, reorder_threshold: 15, weight_grams: 300, is_active: true, created_at: '2024-01-20T10:00:00Z' },
  { id: 'prod-004', brand_id: DEMO_BRAND_ID, name: 'Daily Multivitamin', sku: 'ZMVI-001', category: 'Supplements', selling_price: 449, cost_price: 210, inventory_count: 203, reorder_threshold: 30, weight_grams: 150, is_active: true, created_at: '2024-01-20T10:00:00Z' },
  { id: 'prod-005', brand_id: DEMO_BRAND_ID, name: 'Himalayan Pink Salt', sku: 'HPS-001', category: 'Food & Beverage', selling_price: 199, cost_price: 60, inventory_count: 342, reorder_threshold: 50, weight_grams: 500, is_active: true, created_at: '2024-01-15T10:00:00Z' },
  { id: 'prod-006', brand_id: DEMO_BRAND_ID, name: 'Organic Turmeric Powder', sku: 'OTP-001', category: 'Food & Beverage', selling_price: 249, cost_price: 80, inventory_count: 289, reorder_threshold: 40, weight_grams: 250, is_active: true, created_at: '2024-01-15T10:00:00Z' },
  { id: 'prod-007', brand_id: DEMO_BRAND_ID, name: 'Premium Chia Seeds', sku: 'CSP-001', category: 'Food & Beverage', selling_price: 349, cost_price: 120, inventory_count: 156, reorder_threshold: 25, weight_grams: 400, is_active: true, created_at: '2024-01-18T10:00:00Z' },
  { id: 'prod-008', brand_id: DEMO_BRAND_ID, name: 'Mixed Nuts Trail Mix', sku: 'MNT-001', category: 'Food & Beverage', selling_price: 549, cost_price: 280, inventory_count: 98, reorder_threshold: 20, weight_grams: 500, is_active: true, created_at: '2024-01-18T10:00:00Z' },
  { id: 'prod-009', brand_id: DEMO_BRAND_ID, name: 'Quinoa White', sku: 'QNW-001', category: 'Food & Beverage', selling_price: 399, cost_price: 180, inventory_count: 175, reorder_threshold: 30, weight_grams: 500, is_active: true, created_at: '2024-01-22T10:00:00Z' },
  { id: 'prod-010', brand_id: DEMO_BRAND_ID, name: 'Apple Cider Vinegar', sku: 'ACV-001', category: 'Food & Beverage', selling_price: 449, cost_price: 190, inventory_count: 112, reorder_threshold: 20, weight_grams: 500, is_active: true, created_at: '2024-01-22T10:00:00Z' },
  { id: 'prod-011', brand_id: DEMO_BRAND_ID, name: 'Wheatgrass Powder', sku: 'WGP-001', category: 'Supplements', selling_price: 299, cost_price: 130, inventory_count: 5, reorder_threshold: 20, weight_grams: 200, is_active: true, created_at: '2024-02-01T10:00:00Z' },
  { id: 'prod-012', brand_id: DEMO_BRAND_ID, name: 'Cold-Pressed Coconut Oil', sku: 'COCP-001', category: 'Food & Beverage', selling_price: 499, cost_price: 230, inventory_count: 67, reorder_threshold: 15, weight_grams: 500, is_active: true, created_at: '2024-02-01T10:00:00Z' },
  { id: 'prod-013', brand_id: DEMO_BRAND_ID, name: 'Ashwagandha Capsules', sku: 'AWC-001', category: 'Supplements', selling_price: 649, cost_price: 300, inventory_count: 143, reorder_threshold: 25, weight_grams: 100, is_active: true, created_at: '2024-02-05T10:00:00Z' },
  { id: 'prod-014', brand_id: DEMO_BRAND_ID, name: 'Moringa Leaf Powder', sku: 'MRP-001', category: 'Supplements', selling_price: 279, cost_price: 110, inventory_count: 234, reorder_threshold: 30, weight_grams: 200, is_active: true, created_at: '2024-02-05T10:00:00Z' },
  { id: 'prod-015', brand_id: DEMO_BRAND_ID, name: 'Premium Black Pepper', sku: 'BPP-001', category: 'Food & Beverage', selling_price: 179, cost_price: 55, inventory_count: 398, reorder_threshold: 60, weight_grams: 200, is_active: true, created_at: '2024-02-10T10:00:00Z' },
  { id: 'prod-016', brand_id: DEMO_BRAND_ID, name: 'Protein Granola Bar (Box of 12)', sku: 'PGB-BOX', category: 'Food & Beverage', selling_price: 899, cost_price: 480, inventory_count: 54, reorder_threshold: 20, weight_grams: 600, is_active: true, created_at: '2024-02-15T10:00:00Z' },
  { id: 'prod-017', brand_id: DEMO_BRAND_ID, name: 'Ceremonial Matcha Green Tea', sku: 'GTM-001', category: 'Food & Beverage', selling_price: 399, cost_price: 160, inventory_count: 88, reorder_threshold: 20, weight_grams: 100, is_active: true, created_at: '2024-02-20T10:00:00Z' },
  { id: 'prod-018', brand_id: DEMO_BRAND_ID, name: 'Marine Collagen Peptides', sku: 'CLP-001', category: 'Supplements', selling_price: 1299, cost_price: 720, inventory_count: 3, reorder_threshold: 20, weight_grams: 300, is_active: true, created_at: '2024-03-01T10:00:00Z' },
  { id: 'prod-019', brand_id: DEMO_BRAND_ID, name: 'Organic Hemp Seeds', sku: 'OHS-001', category: 'Food & Beverage', selling_price: 599, cost_price: 310, inventory_count: 71, reorder_threshold: 15, weight_grams: 300, is_active: true, created_at: '2024-03-05T10:00:00Z' },
  { id: 'prod-020', brand_id: DEMO_BRAND_ID, name: 'Ground Flaxseed Powder', sku: 'FSP-001', category: 'Food & Beverage', selling_price: 229, cost_price: 85, inventory_count: 0, reorder_threshold: 25, weight_grams: 400, is_active: true, created_at: '2024-03-10T10:00:00Z' },
]

// ─── Customers (10) ────────────────────────────────────────────────────────

export const DEMO_CUSTOMERS: Customer[] = [
  { id: 'cust-001', brand_id: DEMO_BRAND_ID, name: 'Priya Sharma', phone: '+91 9811234567', email: 'priya.sharma@gmail.com', address: 'B-204, Vasant Kunj', city: 'New Delhi', state: 'Delhi', pincode: '110070', total_orders: 14, total_spent: 12840, tags: ['vip', 'repeat'], created_at: '2024-05-10T10:00:00Z' },
  { id: 'cust-002', brand_id: DEMO_BRAND_ID, name: 'Rajesh Kumar', phone: '+91 9829876543', email: 'rajesh.kumar@outlook.com', address: '14, Gandhi Nagar', city: 'Jaipur', state: 'Rajasthan', pincode: '302015', total_orders: 8, total_spent: 5250, tags: ['repeat'], created_at: '2024-07-22T10:00:00Z' },
  { id: 'cust-003', brand_id: DEMO_BRAND_ID, name: 'Anita Patel', phone: '+91 9920011223', email: 'anita.patel@gmail.com', address: '501, Oberoi Garden', city: 'Mumbai', state: 'Maharashtra', pincode: '400063', total_orders: 5, total_spent: 4648, tags: ['repeat'], created_at: '2025-05-01T10:00:00Z' },
  { id: 'cust-004', brand_id: DEMO_BRAND_ID, name: 'Mohammed Shaikh', phone: '+91 9998877665', email: null, address: '78, Ring Road, Varachha', city: 'Surat', state: 'Gujarat', pincode: '395006', total_orders: 5, total_spent: 2890, tags: ['cod-risk'], created_at: '2024-09-15T10:00:00Z' },
  { id: 'cust-005', brand_id: DEMO_BRAND_ID, name: 'Deepika Nair', phone: '+91 9876001122', email: 'deepika.n@yahoo.in', address: null, city: 'Patna', state: 'Bihar', pincode: '800001', total_orders: 4, total_spent: 1440, tags: ['rto-history'], created_at: '2024-11-01T10:00:00Z' },
  { id: 'cust-006', brand_id: DEMO_BRAND_ID, name: 'Arjun Singh', phone: '+91 9988001234', email: 'arjun.s@gmail.com', address: '22, Koramangala 4th Block', city: 'Bangalore', state: 'Karnataka', pincode: '560034', total_orders: 11, total_spent: 8430, tags: ['vip', 'repeat'], created_at: '2024-04-01T10:00:00Z' },
  { id: 'cust-007', brand_id: DEMO_BRAND_ID, name: 'Riya Joshi', phone: '+91 9700112233', email: 'riya.joshi@gmail.com', address: 'A-12, Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', total_orders: 3, total_spent: 4346, tags: ['new', 'repeat'], created_at: dAt(45, 10, 0) },
  { id: 'cust-008', brand_id: DEMO_BRAND_ID, name: 'Sanjay Rao', phone: '+91 9600223344', email: 'sanjay.rao@gmail.com', address: 'Flat 7, Kalyani Nagar', city: 'Pune', state: 'Maharashtra', pincode: '411006', total_orders: 4, total_spent: 5746, tags: ['vip'], created_at: dAt(60, 10, 0) },
  { id: 'cust-009', brand_id: DEMO_BRAND_ID, name: 'Kavitha Menon', phone: '+91 9500334455', email: 'kavitha.m@outlook.com', address: 'Plot 9, Madhapur', city: 'Hyderabad', state: 'Telangana', pincode: '500081', total_orders: 3, total_spent: 3375, tags: ['repeat'], created_at: dAt(50, 10, 0) },
  { id: 'cust-010', brand_id: DEMO_BRAND_ID, name: 'Arnav Gupta', phone: '+91 9400445566', email: 'arnav.g@gmail.com', address: '33, Salt Lake Sector V', city: 'Kolkata', state: 'West Bengal', pincode: '700091', total_orders: 2, total_spent: 1496, tags: ['new'], created_at: dAt(30, 10, 0) },
]

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeItem(orderId: string, productId: string, qty: number): OrderItem {
  const p = DEMO_PRODUCTS.find(x => x.id === productId)!
  return {
    id: `item-${orderId}-${productId}`,
    order_id: orderId,
    product_id: productId,
    quantity: qty,
    unit_price: p.selling_price,
    sku: p.sku,
    product: p,
  }
}

function mkShip(
  orderId: string, courier: string, awb: string,
  status: Shipment['status'], pickupAgo: number, deliveredAgo?: number
): Shipment {
  return {
    id: `ship-${orderId}`,
    brand_id: DEMO_BRAND_ID,
    order_id: orderId,
    courier,
    awb_number: awb,
    tracking_number: awb,
    status,
    pickup_scheduled_at: dAt(pickupAgo, 9, 0),
    delivered_at: deliveredAgo !== undefined ? dAt(deliveredAgo, 14, 30) : null,
    created_at: dAt(pickupAgo, 9, 0),
  }
}

function mkTl(orderId: string, events: Array<[string, string, number, number, number]>): OrderTimeline[] {
  return events.map(([event, actor, daysAgo, h, m]) => ({
    id: `tl-${orderId}-${event}`,
    order_id: orderId,
    event,
    actor,
    metadata: null,
    created_at: dAt(daysAgo, h, m),
  }))
}

function addr(custId: string) {
  const c = DEMO_CUSTOMERS.find(x => x.id === custId)!
  return { address: c.address ?? '', city: c.city, state: c.state, pincode: c.pincode }
}

// ─── Orders ────────────────────────────────────────────────────────────────

export const DEMO_ORDERS: Order[] = [

  // ═══════════════════════════════════════════════════════════════
  // TODAY (dAt 0) — 18 orders, ~₹20k gross
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'ord-051', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-051', channel: 'SHOPIFY',
    gross_amount: 1098, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 10, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 7, 15), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-051', 'prod-013', 1), makeItem('ord-051', 'prod-004', 1)],
    shipments: [], timeline: mkTl('ord-051', [['ORDER_PLACED', 'Shopify order confirmed', 0, 7, 15], ['PAYMENT_RECEIVED', 'UPI ₹1098 received', 0, 7, 16]]),
  },
  {
    id: 'ord-052', brand_id: DEMO_BRAND_ID, customer_id: 'cust-008',
    order_number: 'ZF-2026-052', channel: 'AMAZON',
    gross_amount: 1998, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'PROCESSING', rto_risk_score: 8, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-008'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 7, 32), customer: DEMO_CUSTOMERS[7],
    items: [makeItem('ord-052', 'prod-001', 2)],
    shipments: [], timeline: mkTl('ord-052', [['ORDER_PLACED', 'Amazon order synced', 0, 7, 32], ['PAYMENT_RECEIVED', 'Card payment ₹1998 received', 0, 7, 33], ['PROCESSING', 'Moved to processing', 0, 9, 0]]),
  },
  {
    id: 'ord-053', brand_id: DEMO_BRAND_ID, customer_id: 'cust-007',
    order_number: 'ZF-2026-053', channel: 'SHOPIFY',
    gross_amount: 2048, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'PACKING', rto_risk_score: 12, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-007'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 8, 5), customer: DEMO_CUSTOMERS[6],
    items: [makeItem('ord-053', 'prod-018', 1), makeItem('ord-053', 'prod-003', 1)],
    shipments: [], timeline: mkTl('ord-053', [['ORDER_PLACED', 'Shopify order', 0, 8, 5], ['PAYMENT_RECEIVED', 'UPI ₹2048 received', 0, 8, 6], ['PACKING', 'Moved to packing station', 0, 9, 30]]),
  },
  {
    id: 'ord-054', brand_id: DEMO_BRAND_ID, customer_id: 'cust-002',
    order_number: 'ZF-2026-054', channel: 'WHATSAPP',
    gross_amount: 899, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 20, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-002'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 8, 22), customer: DEMO_CUSTOMERS[1],
    items: [makeItem('ord-054', 'prod-016', 1)],
    shipments: [], timeline: mkTl('ord-054', [['ORDER_PLACED', 'WhatsApp order', 0, 8, 22], ['PAYMENT_RECEIVED', 'UPI ₹899 received', 0, 8, 25]]),
  },
  {
    id: 'ord-055', brand_id: DEMO_BRAND_ID, customer_id: 'cust-009',
    order_number: 'ZF-2026-055', channel: 'SHOPIFY',
    gross_amount: 1448, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'PROCESSING', rto_risk_score: 15, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-009'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 8, 45), customer: DEMO_CUSTOMERS[8],
    items: [makeItem('ord-055', 'prod-002', 1), makeItem('ord-055', 'prod-004', 1)],
    shipments: [], timeline: mkTl('ord-055', [['ORDER_PLACED', 'Shopify order', 0, 8, 45], ['PAYMENT_RECEIVED', 'Card payment ₹1448', 0, 8, 46]]),
  },
  {
    id: 'ord-056', brand_id: DEMO_BRAND_ID, customer_id: 'cust-003',
    order_number: 'ZF-2026-056', channel: 'FLIPKART',
    gross_amount: 1098, discount_amount: 50,
    payment_status: 'PAID', payment_method: 'PREPAID',
    fulfillment_status: 'PACKING', rto_risk_score: 5, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-003'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 9, 0), customer: DEMO_CUSTOMERS[2],
    items: [makeItem('ord-056', 'prod-013', 1), makeItem('ord-056', 'prod-004', 1)],
    shipments: [], timeline: mkTl('ord-056', [['ORDER_PLACED', 'Flipkart order synced', 0, 9, 0]]),
  },
  {
    id: 'ord-057', brand_id: DEMO_BRAND_ID, customer_id: 'cust-004',
    order_number: 'ZF-2026-057', channel: 'WHATSAPP',
    gross_amount: 999, discount_amount: 0,
    payment_status: 'AWAITING_PAYMENT', payment_method: 'COD',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 55, rto_review_status: 'PENDING',
    shipping_address: addr('cust-004'), warehouse_id: 'wh-001', notes: 'Verify address before dispatch',
    created_at: dAt(0, 9, 10), customer: DEMO_CUSTOMERS[3],
    items: [makeItem('ord-057', 'prod-001', 1)],
    shipments: [], timeline: mkTl('ord-057', [['ORDER_PLACED', 'WhatsApp COD order — review before dispatch', 0, 9, 10]]),
  },
  {
    id: 'ord-058', brand_id: DEMO_BRAND_ID, customer_id: 'cust-005',
    order_number: 'ZF-2026-058', channel: 'MANUAL',
    gross_amount: 449, discount_amount: 0,
    payment_status: 'AWAITING_PAYMENT', payment_method: 'COD',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 82, rto_review_status: 'PENDING',
    shipping_address: addr('cust-005'), warehouse_id: 'wh-001', notes: 'Address incomplete — confirm with customer',
    created_at: dAt(0, 9, 30), customer: DEMO_CUSTOMERS[4],
    items: [makeItem('ord-058', 'prod-004', 1)],
    shipments: [], timeline: mkTl('ord-058', [['ORDER_PLACED', 'Manual COD — high RTO risk', 0, 9, 30]]),
  },
  {
    id: 'ord-059', brand_id: DEMO_BRAND_ID, customer_id: 'cust-010',
    order_number: 'ZF-2026-059', channel: 'SHOPIFY',
    gross_amount: 898, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 18, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-010'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 9, 45), customer: DEMO_CUSTOMERS[9],
    items: [makeItem('ord-059', 'prod-008', 1), makeItem('ord-059', 'prod-007', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-060', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-060', channel: 'WHATSAPP',
    gross_amount: 1048, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'READY_TO_SHIP', rto_risk_score: 10, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 10, 0), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-060', 'prod-019', 1), makeItem('ord-060', 'prod-010', 1)],
    shipments: [mkShip('ord-060', 'Delhivery', 'DL20260001001', 'LABEL_CREATED', 0)],
    timeline: mkTl('ord-060', [['ORDER_PLACED', 'WhatsApp order', 0, 10, 0], ['PAYMENT_RECEIVED', 'UPI ₹1048 received', 0, 10, 1], ['READY_TO_SHIP', 'Label generated — awaiting pickup', 0, 11, 0]]),
  },
  {
    id: 'ord-061', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-061', channel: 'SHOPIFY',
    gross_amount: 1298, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'PROCESSING', rto_risk_score: 12, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 10, 15), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-061', 'prod-002', 1), makeItem('ord-061', 'prod-011', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-062', brand_id: DEMO_BRAND_ID, customer_id: 'cust-009',
    order_number: 'ZF-2026-062', channel: 'AMAZON',
    gross_amount: 1207, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 15, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-009'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 10, 30), customer: DEMO_CUSTOMERS[8],
    items: [makeItem('ord-062', 'prod-013', 1), makeItem('ord-062', 'prod-014', 2)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-063', brand_id: DEMO_BRAND_ID, customer_id: 'cust-002',
    order_number: 'ZF-2026-063', channel: 'SHOPIFY',
    gross_amount: 578, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 22, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-002'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 11, 0), customer: DEMO_CUSTOMERS[1],
    items: [makeItem('ord-063', 'prod-009', 1), makeItem('ord-063', 'prod-015', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-064', brand_id: DEMO_BRAND_ID, customer_id: 'cust-008',
    order_number: 'ZF-2026-064', channel: 'FLIPKART',
    gross_amount: 748, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'PREPAID',
    fulfillment_status: 'PACKING', rto_risk_score: 8, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-008'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 11, 15), customer: DEMO_CUSTOMERS[7],
    items: [makeItem('ord-064', 'prod-012', 1), makeItem('ord-064', 'prod-006', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-065', brand_id: DEMO_BRAND_ID, customer_id: 'cust-010',
    order_number: 'ZF-2026-065', channel: 'WHATSAPP',
    gross_amount: 598, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 20, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-010'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 11, 30), customer: DEMO_CUSTOMERS[9],
    items: [makeItem('ord-065', 'prod-017', 1), makeItem('ord-065', 'prod-005', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-066', brand_id: DEMO_BRAND_ID, customer_id: 'cust-004',
    order_number: 'ZF-2026-066', channel: 'SHOPIFY',
    gross_amount: 1448, discount_amount: 0,
    payment_status: 'AWAITING_PAYMENT', payment_method: 'COD',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 62, rto_review_status: 'PENDING',
    shipping_address: addr('cust-004'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 12, 0), customer: DEMO_CUSTOMERS[3],
    items: [makeItem('ord-066', 'prod-001', 1), makeItem('ord-066', 'prod-004', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-067', brand_id: DEMO_BRAND_ID, customer_id: 'cust-007',
    order_number: 'ZF-2026-067', channel: 'AMAZON',
    gross_amount: 1299, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'PROCESSING', rto_risk_score: 12, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-007'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 12, 15), customer: DEMO_CUSTOMERS[6],
    items: [makeItem('ord-067', 'prod-018', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-068', brand_id: DEMO_BRAND_ID, customer_id: 'cust-003',
    order_number: 'ZF-2026-068', channel: 'WHATSAPP',
    gross_amount: 1078, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 18, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-003'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(0, 12, 30), customer: DEMO_CUSTOMERS[2],
    items: [makeItem('ord-068', 'prod-016', 1), makeItem('ord-068', 'prod-015', 1)],
    shipments: [], timeline: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // YESTERDAY (dAt 1) — 13 orders
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'ord-021', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-021', channel: 'SHOPIFY',
    gross_amount: 1478, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'PROCESSING', rto_risk_score: 10, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 8, 10), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-021', 'prod-018', 1), makeItem('ord-021', 'prod-015', 1)],
    shipments: [], timeline: mkTl('ord-021', [['ORDER_PLACED', 'Shopify order', 1, 8, 10], ['PAYMENT_RECEIVED', 'UPI payment received', 1, 8, 11], ['PROCESSING', 'Order in processing', 1, 9, 0]]),
  },
  {
    id: 'ord-022', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-022', channel: 'WHATSAPP',
    gross_amount: 897, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'PROCESSING', rto_risk_score: 15, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 9, 30), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-022', 'prod-014', 2), makeItem('ord-022', 'prod-015', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-023', brand_id: DEMO_BRAND_ID, customer_id: 'cust-002',
    order_number: 'ZF-2026-023', channel: 'SHOPIFY',
    gross_amount: 999, discount_amount: 0,
    payment_status: 'AWAITING_PAYMENT', payment_method: 'COD',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 48, rto_review_status: 'PENDING',
    shipping_address: addr('cust-002'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 10, 0), customer: DEMO_CUSTOMERS[1],
    items: [makeItem('ord-023', 'prod-002', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-024', brand_id: DEMO_BRAND_ID, customer_id: 'cust-005',
    order_number: 'ZF-2026-024', channel: 'MANUAL',
    gross_amount: 449, discount_amount: 0,
    payment_status: 'AWAITING_PAYMENT', payment_method: 'COD',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 88, rto_review_status: 'PENDING',
    shipping_address: addr('cust-005'), warehouse_id: 'wh-001', notes: 'Verify address before dispatch',
    created_at: dAt(1, 10, 30), customer: DEMO_CUSTOMERS[4],
    items: [makeItem('ord-024', 'prod-004', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-025', brand_id: DEMO_BRAND_ID, customer_id: 'cust-004',
    order_number: 'ZF-2026-025', channel: 'WHATSAPP',
    gross_amount: 1298, discount_amount: 0,
    payment_status: 'AWAITING_PAYMENT', payment_method: 'COD',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 62, rto_review_status: 'PENDING',
    shipping_address: addr('cust-004'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 11, 0), customer: DEMO_CUSTOMERS[3],
    items: [makeItem('ord-025', 'prod-001', 1), makeItem('ord-025', 'prod-004', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-038', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-038', channel: 'SHOPIFY',
    gross_amount: 998, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'PACKING', rto_risk_score: 10, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 7, 30), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-038', 'prod-001', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-039', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-039', channel: 'AMAZON',
    gross_amount: 1498, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'READY_TO_SHIP', rto_risk_score: 7, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 8, 45), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-039', 'prod-019', 1), makeItem('ord-039', 'prod-013', 1)],
    shipments: [mkShip('ord-039', 'Delhivery', 'DL20260001002', 'LABEL_CREATED', 1)],
    timeline: [],
  },
  {
    id: 'ord-040', brand_id: DEMO_BRAND_ID, customer_id: 'cust-002',
    order_number: 'ZF-2026-040', channel: 'SHOPIFY',
    gross_amount: 999, discount_amount: 0,
    payment_status: 'AWAITING_PAYMENT', payment_method: 'COD',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 52, rto_review_status: 'PENDING',
    shipping_address: addr('cust-002'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 9, 15), customer: DEMO_CUSTOMERS[1],
    items: [makeItem('ord-040', 'prod-002', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-041', brand_id: DEMO_BRAND_ID, customer_id: 'cust-005',
    order_number: 'ZF-2026-041', channel: 'MANUAL',
    gross_amount: 749, discount_amount: 0,
    payment_status: 'AWAITING_PAYMENT', payment_method: 'COD',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 85, rto_review_status: 'PENDING',
    shipping_address: addr('cust-005'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 9, 45), customer: DEMO_CUSTOMERS[4],
    items: [makeItem('ord-041', 'prod-003', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-042', brand_id: DEMO_BRAND_ID, customer_id: 'cust-004',
    order_number: 'ZF-2026-042', channel: 'WHATSAPP',
    gross_amount: 1448, discount_amount: 0,
    payment_status: 'AWAITING_PAYMENT', payment_method: 'COD',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 68, rto_review_status: 'PENDING',
    shipping_address: addr('cust-004'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 10, 0), customer: DEMO_CUSTOMERS[3],
    items: [makeItem('ord-042', 'prod-001', 1), makeItem('ord-042', 'prod-016', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-043', brand_id: DEMO_BRAND_ID, customer_id: 'cust-003',
    order_number: 'ZF-2026-043', channel: 'FLIPKART',
    gross_amount: 1248, discount_amount: 50,
    payment_status: 'PAID', payment_method: 'PREPAID',
    fulfillment_status: 'PACKING', rto_risk_score: 5, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-003'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 10, 15), customer: DEMO_CUSTOMERS[2],
    items: [makeItem('ord-043', 'prod-007', 2), makeItem('ord-043', 'prod-009', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-044', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-044', channel: 'SHOPIFY',
    gross_amount: 1798, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'PROCESSING', rto_risk_score: 8, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 11, 30), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-044', 'prod-002', 1), makeItem('ord-044', 'prod-013', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-050', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-050', channel: 'WHATSAPP',
    gross_amount: 1148, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'READY_TO_SHIP', rto_risk_score: 10, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(1, 14, 30), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-050', 'prod-016', 1), makeItem('ord-050', 'prod-005', 1)],
    shipments: [mkShip('ord-050', 'Delhivery', 'DL20260001003', 'LABEL_CREATED', 1)],
    timeline: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // 2 DAYS AGO (dAt 2) — PACKING / READY_TO_SHIP
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'ord-018', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-018', channel: 'SHOPIFY',
    gross_amount: 1648, discount_amount: 100,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'READY_TO_SHIP', rto_risk_score: 12, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(2, 10, 0), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-018', 'prod-001', 1), makeItem('ord-018', 'prod-013', 1)],
    shipments: [mkShip('ord-018', 'Delhivery', 'DL20260001004', 'PICKUP_SCHEDULED', 1)],
    timeline: mkTl('ord-018', [['ORDER_PLACED', 'Shopify order', 2, 10, 0], ['PAYMENT_RECEIVED', 'UPI payment ₹1548 received', 2, 10, 1], ['READY_TO_SHIP', 'Label generated, awaiting pickup', 2, 16, 0]]),
  },
  {
    id: 'ord-019', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-019', channel: 'SHOPIFY',
    gross_amount: 1298, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'PACKING', rto_risk_score: 9, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(2, 11, 30), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-019', 'prod-016', 1), makeItem('ord-019', 'prod-017', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-020', brand_id: DEMO_BRAND_ID, customer_id: 'cust-003',
    order_number: 'ZF-2026-020', channel: 'FLIPKART',
    gross_amount: 947, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'PREPAID',
    fulfillment_status: 'PACKING', rto_risk_score: 5, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-003'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(2, 14, 0), customer: DEMO_CUSTOMERS[2],
    items: [makeItem('ord-020', 'prod-007', 2), makeItem('ord-020', 'prod-006', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-045', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-045', channel: 'WHATSAPP',
    gross_amount: 699, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'PACKING', rto_risk_score: 12, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(2, 12, 0), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-045', 'prod-009', 1), makeItem('ord-045', 'prod-015', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-046', brand_id: DEMO_BRAND_ID, customer_id: 'cust-002',
    order_number: 'ZF-2026-046', channel: 'AMAZON',
    gross_amount: 848, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'NETBANKING',
    fulfillment_status: 'PACKING', rto_risk_score: 20, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-002'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(2, 12, 30), customer: DEMO_CUSTOMERS[1],
    items: [makeItem('ord-046', 'prod-010', 1), makeItem('ord-046', 'prod-017', 1)],
    shipments: [], timeline: [],
  },
  {
    id: 'ord-048', brand_id: DEMO_BRAND_ID, customer_id: 'cust-003',
    order_number: 'ZF-2026-048', channel: 'MANUAL',
    gross_amount: 549, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'PROCESSING', rto_risk_score: 18, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-003'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(2, 13, 30), customer: DEMO_CUSTOMERS[2],
    items: [makeItem('ord-048', 'prod-012', 1)],
    shipments: [], timeline: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // 3 DAYS AGO (dAt 3) — SHIPPED / IN_TRANSIT start
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'ord-017', brand_id: DEMO_BRAND_ID, customer_id: 'cust-004',
    order_number: 'ZF-2026-017', channel: 'WHATSAPP',
    gross_amount: 578, discount_amount: 0,
    payment_status: 'AWAITING_PAYMENT', payment_method: 'COD',
    fulfillment_status: 'SHIPPED', rto_risk_score: 58, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-004'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(3, 10, 0), customer: DEMO_CUSTOMERS[3],
    items: [makeItem('ord-017', 'prod-009', 1), makeItem('ord-017', 'prod-015', 1)],
    shipments: [mkShip('ord-017', 'Delhivery', 'DL20260001005', 'PICKED_UP', 2)],
    timeline: mkTl('ord-017', [['ORDER_PLACED', 'WhatsApp COD order', 3, 10, 0], ['SHIPPED', 'Shipped via Delhivery', 2, 10, 0]]),
  },
  {
    id: 'ord-031', brand_id: DEMO_BRAND_ID, customer_id: 'cust-004',
    order_number: 'ZF-2026-031', channel: 'SHOPIFY',
    gross_amount: 999, discount_amount: 0,
    payment_status: 'FAILED', payment_method: 'CARD',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 35, rto_review_status: 'HELD',
    shipping_address: addr('cust-004'), warehouse_id: 'wh-001', notes: 'Card declined',
    created_at: dAt(3, 16, 0), customer: DEMO_CUSTOMERS[3],
    items: [makeItem('ord-031', 'prod-001', 1)],
    shipments: [], timeline: mkTl('ord-031', [['ORDER_PLACED', 'Order placed', 3, 16, 0], ['PAYMENT_FAILED', 'Card payment declined', 3, 16, 1]]),
  },
  {
    id: 'ord-047', brand_id: DEMO_BRAND_ID, customer_id: 'cust-004',
    order_number: 'ZF-2026-047', channel: 'SHOPIFY',
    gross_amount: 1099, discount_amount: 0,
    payment_status: 'FAILED', payment_method: 'UPI',
    fulfillment_status: 'CONFIRMED', rto_risk_score: 38, rto_review_status: 'HELD',
    shipping_address: addr('cust-004'), warehouse_id: 'wh-001', notes: 'UPI timeout',
    created_at: dAt(3, 13, 0), customer: DEMO_CUSTOMERS[3],
    items: [makeItem('ord-047', 'prod-014', 2), makeItem('ord-047', 'prod-010', 1)],
    shipments: [], timeline: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // 4 DAYS AGO (dAt 4) — IN_TRANSIT
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'ord-015', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-015', channel: 'AMAZON',
    gross_amount: 1248, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'IN_TRANSIT', rto_risk_score: 7, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(4, 9, 0), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-015', 'prod-013', 1), makeItem('ord-015', 'prod-019', 1)],
    shipments: [mkShip('ord-015', 'Ekart', 'EK20260001001', 'IN_TRANSIT', 3)],
    timeline: mkTl('ord-015', [['ORDER_PLACED', 'Amazon order', 4, 9, 0], ['SHIPPED', 'Shipped via Ekart', 3, 10, 0], ['IN_TRANSIT', 'In transit — Nagpur hub', 2, 14, 0]]),
  },
  {
    id: 'ord-016', brand_id: DEMO_BRAND_ID, customer_id: 'cust-002',
    order_number: 'ZF-2026-016', channel: 'SHOPIFY',
    gross_amount: 948, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'IN_TRANSIT', rto_risk_score: 22, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-002'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(4, 14, 0), customer: DEMO_CUSTOMERS[1],
    items: [makeItem('ord-016', 'prod-012', 1), makeItem('ord-016', 'prod-015', 1)],
    shipments: [mkShip('ord-016', 'Shiprocket', 'SR20260001001', 'IN_TRANSIT', 3)],
    timeline: [],
  },
  {
    id: 'ord-036', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-036', channel: 'WHATSAPP',
    gross_amount: 1299, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'IN_TRANSIT', rto_risk_score: 12, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(4, 10, 0), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-036', 'prod-018', 1)],
    shipments: [mkShip('ord-036', 'BlueDart', 'BD20260001001', 'IN_TRANSIT', 3)],
    timeline: [],
  },
  {
    id: 'ord-037', brand_id: DEMO_BRAND_ID, customer_id: 'cust-003',
    order_number: 'ZF-2026-037', channel: 'SHOPIFY',
    gross_amount: 799, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'OUT_FOR_DELIVERY', rto_risk_score: 15, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-003'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(4, 14, 30), customer: DEMO_CUSTOMERS[2],
    items: [makeItem('ord-037', 'prod-008', 1), makeItem('ord-037', 'prod-006', 1)],
    shipments: [mkShip('ord-037', 'Delhivery', 'DL20260001006', 'OUT_FOR_DELIVERY', 3)],
    timeline: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // 5 DAYS AGO (dAt 5) — OUT_FOR_DELIVERY / just DELIVERED
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'ord-014', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-014', channel: 'SHOPIFY',
    gross_amount: 1548, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'OUT_FOR_DELIVERY', rto_risk_score: 10, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(5, 10, 0), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-014', 'prod-002', 1), makeItem('ord-014', 'prod-011', 1)],
    shipments: [mkShip('ord-014', 'Delhivery', 'DL20260001007', 'OUT_FOR_DELIVERY', 4)],
    timeline: mkTl('ord-014', [['ORDER_PLACED', 'Order placed', 5, 10, 0], ['SHIPPED', 'Shipped', 4, 10, 0], ['OUT_FOR_DELIVERY', 'Out for delivery', 0, 9, 0]]),
  },
  {
    id: 'ord-034', brand_id: DEMO_BRAND_ID, customer_id: 'cust-002',
    order_number: 'ZF-2026-034', channel: 'FLIPKART',
    gross_amount: 1148, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'NETBANKING',
    fulfillment_status: 'DELIVERED', rto_risk_score: 18, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-002'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(5, 11, 0), customer: DEMO_CUSTOMERS[1],
    items: [makeItem('ord-034', 'prod-016', 1), makeItem('ord-034', 'prod-006', 1)],
    shipments: [mkShip('ord-034', 'Ekart', 'EK20260001002', 'DELIVERED', 4, 0)],
    timeline: [],
  },
  {
    id: 'ord-035', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-035', channel: 'SHOPIFY',
    gross_amount: 449, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'DELIVERED', rto_risk_score: 10, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(5, 15, 0), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-035', 'prod-004', 1)],
    shipments: [mkShip('ord-035', 'Delhivery', 'DL20260001008', 'DELIVERED', 4, 0)],
    timeline: [],
  },
  {
    id: 'ord-049', brand_id: DEMO_BRAND_ID, customer_id: 'cust-005',
    order_number: 'ZF-2026-049', channel: 'SHOPIFY',
    gross_amount: 649, discount_amount: 0,
    payment_status: 'AWAITING_PAYMENT', payment_method: 'COD',
    fulfillment_status: 'SHIPPED', rto_risk_score: 90, rto_review_status: 'FLAGGED',
    shipping_address: addr('cust-005'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(5, 14, 0), customer: DEMO_CUSTOMERS[4],
    items: [makeItem('ord-049', 'prod-013', 1)],
    shipments: [mkShip('ord-049', 'Delhivery', 'DL20260001009', 'IN_TRANSIT', 4)],
    timeline: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // 6-8 DAYS AGO — DELIVERED
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'ord-032', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-032', channel: 'SHOPIFY',
    gross_amount: 649, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'DELIVERED', rto_risk_score: 10, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(6, 9, 0), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-032', 'prod-013', 1)],
    shipments: [mkShip('ord-032', 'Delhivery', 'DL20260001010', 'DELIVERED', 5, 2)],
    timeline: [],
  },
  {
    id: 'ord-033', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-033', channel: 'AMAZON',
    gross_amount: 998, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'DELIVERED', rto_risk_score: 8, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(6, 14, 0), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-033', 'prod-004', 1), makeItem('ord-033', 'prod-017', 1)],
    shipments: [mkShip('ord-033', 'Ekart', 'EK20260001003', 'DELIVERED', 5, 2)],
    timeline: [],
  },
  {
    id: 'ord-030', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-030', channel: 'SHOPIFY',
    gross_amount: 1498, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'DELIVERED', rto_risk_score: 5, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(7, 10, 0), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-030', 'prod-013', 1), makeItem('ord-030', 'prod-019', 1)],
    shipments: [mkShip('ord-030', 'BlueDart', 'BD20260001002', 'DELIVERED', 6, 4)],
    timeline: [],
  },
  {
    id: 'ord-029', brand_id: DEMO_BRAND_ID, customer_id: 'cust-002',
    order_number: 'ZF-2026-029', channel: 'WHATSAPP',
    gross_amount: 728, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'DELIVERED', rto_risk_score: 20, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-002'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(8, 9, 0), customer: DEMO_CUSTOMERS[1],
    items: [makeItem('ord-029', 'prod-008', 1), makeItem('ord-029', 'prod-015', 1)],
    shipments: [mkShip('ord-029', 'XpressBees', 'XB20260001001', 'DELIVERED', 7, 4)],
    timeline: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // 9-13 DAYS AGO — DELIVERED + RTO
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'ord-028', brand_id: DEMO_BRAND_ID, customer_id: 'cust-003',
    order_number: 'ZF-2026-028', channel: 'SHOPIFY',
    gross_amount: 499, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'WALLET',
    fulfillment_status: 'DELIVERED', rto_risk_score: 18, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-003'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(9, 11, 0), customer: DEMO_CUSTOMERS[2],
    items: [makeItem('ord-028', 'prod-012', 1)],
    shipments: [mkShip('ord-028', 'Delhivery', 'DL20260001011', 'DELIVERED', 8, 5)],
    timeline: [],
  },
  {
    id: 'ord-013', brand_id: DEMO_BRAND_ID, customer_id: 'cust-005',
    order_number: 'ZF-2026-013', channel: 'WHATSAPP',
    gross_amount: 449, discount_amount: 0,
    payment_status: 'PENDING', payment_method: 'COD',
    fulfillment_status: 'RTO_INITIATED', rto_risk_score: 82, rto_review_status: 'FLAGGED',
    shipping_address: addr('cust-005'), warehouse_id: 'wh-001', notes: 'Address incomplete',
    created_at: dAt(10, 9, 0), customer: DEMO_CUSTOMERS[4],
    items: [makeItem('ord-013', 'prod-004', 1)],
    shipments: [mkShip('ord-013', 'Delhivery', 'DL20260001012', 'RTO_INITIATED', 9, undefined)],
    timeline: mkTl('ord-013', [['ORDER_PLACED', 'WhatsApp order', 10, 9, 0], ['SHIPPED', 'Shipped', 9, 10, 0], ['RTO_INITIATED', 'Address not found — RTO initiated', 7, 9, 0]]),
  },
  {
    id: 'ord-026', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-026', channel: 'FLIPKART',
    gross_amount: 878, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'DELIVERED', rto_risk_score: 8, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(11, 9, 0), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-026', 'prod-010', 1), makeItem('ord-026', 'prod-006', 1)],
    shipments: [mkShip('ord-026', 'Ekart', 'EK20260001004', 'DELIVERED', 10, 7)],
    timeline: [],
  },
  {
    id: 'ord-012', brand_id: DEMO_BRAND_ID, customer_id: 'cust-004',
    order_number: 'ZF-2026-012', channel: 'MANUAL',
    gross_amount: 749, discount_amount: 0,
    payment_status: 'PENDING', payment_method: 'COD',
    fulfillment_status: 'RTO_INITIATED', rto_risk_score: 65, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-004'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(12, 14, 0), customer: DEMO_CUSTOMERS[3],
    items: [makeItem('ord-012', 'prod-003', 1)],
    shipments: [mkShip('ord-012', 'Shiprocket', 'SR20260001002', 'RTO_INITIATED', 11, undefined)],
    timeline: mkTl('ord-012', [['ORDER_PLACED', 'Manual order', 12, 14, 0], ['SHIPPED', 'Shipped', 11, 10, 0], ['RTO_INITIATED', 'Customer refused delivery', 9, 11, 0]]),
  },
  {
    id: 'ord-027', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-027', channel: 'AMAZON',
    gross_amount: 1798, discount_amount: 200,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'DELIVERED', rto_risk_score: 12, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(11, 10, 0), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-027', 'prod-001', 1), makeItem('ord-027', 'prod-003', 1)],
    shipments: [mkShip('ord-027', 'BlueDart', 'BD20260001003', 'DELIVERED', 10, 7)],
    timeline: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // 14-20 DAYS AGO — DELIVERED + RTO
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'ord-011', brand_id: DEMO_BRAND_ID, customer_id: 'cust-005',
    order_number: 'ZF-2026-011', channel: 'SHOPIFY',
    gross_amount: 998, discount_amount: 0,
    payment_status: 'PENDING', payment_method: 'COD',
    fulfillment_status: 'RTO_INITIATED', rto_risk_score: 78, rto_review_status: 'APPROVED',
    shipping_address: { address: 'Incomplete address', city: 'Patna', state: 'Bihar', pincode: '800001' },
    warehouse_id: 'wh-001', notes: 'Customer not reachable',
    created_at: dAt(14, 10, 0), customer: DEMO_CUSTOMERS[4],
    items: [makeItem('ord-011', 'prod-001', 1)],
    shipments: [mkShip('ord-011', 'Delhivery', 'DL20260001013', 'RTO_INITIATED', 13, undefined)],
    timeline: mkTl('ord-011', [['ORDER_PLACED', 'Order placed', 14, 10, 0], ['SHIPPED', 'Shipped via Delhivery', 13, 10, 0], ['DELIVERY_FAILED', 'Customer not home', 11, 14, 0], ['RTO_INITIATED', 'Return to origin initiated', 10, 9, 0]]),
  },
  {
    id: 'ord-010', brand_id: DEMO_BRAND_ID, customer_id: 'cust-002',
    order_number: 'ZF-2026-010', channel: 'SHOPIFY',
    gross_amount: 728, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'DELIVERED', rto_risk_score: 20, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-002'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(15, 9, 0), customer: DEMO_CUSTOMERS[1],
    items: [makeItem('ord-010', 'prod-010', 1), makeItem('ord-010', 'prod-015', 1)],
    shipments: [mkShip('ord-010', 'XpressBees', 'XB20260001002', 'DELIVERED', 14, 11)],
    timeline: [],
  },
  {
    id: 'ord-009', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-009', channel: 'AMAZON',
    gross_amount: 1298, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'DELIVERED', rto_risk_score: 8, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(17, 10, 30), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-009', 'prod-003', 1), makeItem('ord-009', 'prod-017', 1)],
    shipments: [mkShip('ord-009', 'BlueDart', 'BD20260001004', 'DELIVERED', 16, 13)],
    timeline: [],
  },
  {
    id: 'ord-008', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-008', channel: 'WHATSAPP',
    gross_amount: 549, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'DELIVERED', rto_risk_score: 12, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(19, 12, 0), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-008', 'prod-008', 1)],
    shipments: [mkShip('ord-008', 'Delhivery', 'DL20260001014', 'DELIVERED', 18, 15)],
    timeline: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // 21-31 DAYS AGO — DELIVERED (historical)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'ord-007', brand_id: DEMO_BRAND_ID, customer_id: 'cust-002',
    order_number: 'ZF-2026-007', channel: 'FLIPKART',
    gross_amount: 1098, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'DELIVERED', rto_risk_score: 18, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-002'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(21, 10, 0), customer: DEMO_CUSTOMERS[1],
    items: [makeItem('ord-007', 'prod-008', 1), makeItem('ord-007', 'prod-009', 1)],
    shipments: [mkShip('ord-007', 'Ekart', 'EK20260001005', 'DELIVERED', 20, 17)],
    timeline: [],
  },
  {
    id: 'ord-006', brand_id: DEMO_BRAND_ID, customer_id: 'cust-003',
    order_number: 'ZF-2026-006', channel: 'SHOPIFY',
    gross_amount: 1648, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'DELIVERED', rto_risk_score: 15, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-003'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(23, 15, 45), customer: DEMO_CUSTOMERS[2],
    items: [makeItem('ord-006', 'prod-018', 1), makeItem('ord-006', 'prod-004', 1)],
    shipments: [mkShip('ord-006', 'Delhivery', 'DL20260001015', 'DELIVERED', 22, 19)],
    timeline: [],
  },
  {
    id: 'ord-005', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-005', channel: 'AMAZON',
    gross_amount: 1898, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'NETBANKING',
    fulfillment_status: 'DELIVERED', rto_risk_score: 5, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(25, 10, 0), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-005', 'prod-001', 1), makeItem('ord-005', 'prod-002', 1)],
    shipments: [mkShip('ord-005', 'Ekart', 'EK20260001006', 'DELIVERED', 24, 21)],
    timeline: [],
  },
  {
    id: 'ord-004', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-004', channel: 'SHOPIFY',
    gross_amount: 849, discount_amount: 50,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'DELIVERED', rto_risk_score: 10, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(26, 8, 20), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-004', 'prod-016', 1)],
    shipments: [mkShip('ord-004', 'Delhivery', 'DL20260001016', 'DELIVERED', 25, 22)],
    timeline: [],
  },
  {
    id: 'ord-003', brand_id: DEMO_BRAND_ID, customer_id: 'cust-002',
    order_number: 'ZF-2026-003', channel: 'WHATSAPP',
    gross_amount: 798, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'DELIVERED', rto_risk_score: 22, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-002'), warehouse_id: 'wh-001', notes: 'Gift wrap requested',
    created_at: dAt(29, 11, 0), customer: DEMO_CUSTOMERS[1],
    items: [makeItem('ord-003', 'prod-005', 2), makeItem('ord-003', 'prod-006', 2)],
    shipments: [mkShip('ord-003', 'Shiprocket', 'SR20260001003', 'DELIVERED', 28, 25)],
    timeline: [],
  },
  {
    id: 'ord-002', brand_id: DEMO_BRAND_ID, customer_id: 'cust-006',
    order_number: 'ZF-2026-002', channel: 'SHOPIFY',
    gross_amount: 1348, discount_amount: 100,
    payment_status: 'PAID', payment_method: 'CARD',
    fulfillment_status: 'DELIVERED', rto_risk_score: 8, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-006'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(30, 14, 30), customer: DEMO_CUSTOMERS[5],
    items: [makeItem('ord-002', 'prod-013', 1), makeItem('ord-002', 'prod-007', 2)],
    shipments: [mkShip('ord-002', 'BlueDart', 'BD20260001005', 'DELIVERED', 29, 26)],
    timeline: [],
  },
  {
    id: 'ord-001', brand_id: DEMO_BRAND_ID, customer_id: 'cust-001',
    order_number: 'ZF-2026-001', channel: 'SHOPIFY',
    gross_amount: 1998, discount_amount: 0,
    payment_status: 'PAID', payment_method: 'UPI',
    fulfillment_status: 'DELIVERED', rto_risk_score: 10, rto_review_status: 'APPROVED',
    shipping_address: addr('cust-001'), warehouse_id: 'wh-001', notes: null,
    created_at: dAt(31, 9, 15), customer: DEMO_CUSTOMERS[0],
    items: [makeItem('ord-001', 'prod-001', 1), makeItem('ord-001', 'prod-004', 1)],
    shipments: [mkShip('ord-001', 'Delhivery', 'DL20260001017', 'DELIVERED', 30, 27)],
    timeline: mkTl('ord-001', [['ORDER_PLACED', 'Order placed via Shopify', 31, 9, 15], ['PAYMENT_RECEIVED', 'UPI payment of ₹1998 received', 31, 9, 16], ['SHIPPED', 'Shipped via Delhivery AWB: DL20260001017', 30, 11, 0], ['DELIVERED', 'Delivered to customer', 27, 14, 20]]),
  },
]

// ─── Payments (auto-generated from orders) ────────────────────────────────

export const DEMO_PAYMENTS: Payment[] = DEMO_ORDERS.map(order => ({
  id: `pay-${order.id}`,
  brand_id: DEMO_BRAND_ID,
  order_id: order.id,
  amount: order.gross_amount - order.discount_amount,
  method: order.payment_method,
  status: order.payment_status === 'PAID'
    ? 'PAID'
    : order.payment_status === 'FAILED'
    ? 'FAILED'
    : 'PENDING',
  gateway_ref: order.payment_status === 'PAID' ? `ref_${order.id.slice(-8)}` : null,
  gateway_fee: order.payment_status === 'PAID' ? Math.round((order.gross_amount - order.discount_amount) * 0.02) : null,
  settlement_amount: order.payment_status === 'PAID' ? Math.round((order.gross_amount - order.discount_amount) * 0.98) : null,
  settled_at: order.payment_status === 'PAID' && order.fulfillment_status === 'DELIVERED' ? order.created_at : null,
  created_at: order.created_at,
  order,
}))

// ─── Exceptions ────────────────────────────────────────────────────────────

export const DEMO_EXCEPTIONS: Exception[] = [
  {
    id: 'exc-001', brand_id: DEMO_BRAND_ID, order_id: 'ord-058',
    type: 'HIGH_RTO_RISK', severity: 'CRITICAL', status: 'UNRESOLVED',
    title: 'Extremely high RTO risk — ZF-2026-058',
    description: 'RTO score 82/100. COD order to Patna (T3), customer has prior RTO history and incomplete address.',
    created_at: dAt(0, 9, 31),
  },
  {
    id: 'exc-002', brand_id: DEMO_BRAND_ID, order_id: 'ord-057',
    type: 'HIGH_RTO_RISK', severity: 'HIGH', status: 'UNRESOLVED',
    title: 'High RTO risk — ZF-2026-057',
    description: 'RTO score 55/100. COD order from Mohammed Shaikh — previous delivery refusals on record.',
    created_at: dAt(0, 9, 11),
  },
  {
    id: 'exc-003', brand_id: DEMO_BRAND_ID, order_id: 'ord-047',
    type: 'FAILED_PAYMENT', severity: 'HIGH', status: 'UNRESOLVED',
    title: 'Payment failed — ZF-2026-047',
    description: 'UPI payment of ₹1099 timed out. Order currently held. Contact customer for alternate payment.',
    created_at: dAt(3, 13, 1),
  },
  {
    id: 'exc-004', brand_id: DEMO_BRAND_ID, order_id: 'ord-031',
    type: 'FAILED_PAYMENT', severity: 'HIGH', status: 'IN_PROGRESS',
    title: 'Card declined — ZF-2026-031',
    description: 'Card payment of ₹999 declined. Retrying with customer for alternate payment method.',
    created_at: dAt(3, 16, 2),
  },
  {
    id: 'exc-005', brand_id: DEMO_BRAND_ID, order_id: null,
    type: 'LOW_INVENTORY', severity: 'CRITICAL', status: 'UNRESOLVED',
    title: 'Marine Collagen Peptides — critically low stock',
    description: 'Only 3 units remaining (threshold: 20). At current velocity, stockout in ~2 days.',
    created_at: dAt(0, 6, 0),
  },
  {
    id: 'exc-006', brand_id: DEMO_BRAND_ID, order_id: null,
    type: 'LOW_INVENTORY', severity: 'CRITICAL', status: 'UNRESOLVED',
    title: 'Ground Flaxseed Powder — OUT OF STOCK',
    description: 'Zero units in inventory. All pending orders for this SKU will fail to fulfill.',
    created_at: dAt(2, 10, 0),
  },
  {
    id: 'exc-007', brand_id: DEMO_BRAND_ID, order_id: null,
    type: 'LOW_INVENTORY', severity: 'MEDIUM', status: 'UNRESOLVED',
    title: 'BCAA Mango Blast — below reorder threshold',
    description: '8 units remaining (threshold: 15). Reorder 100 units to maintain 45-day buffer.',
    created_at: dAt(0, 6, 0),
  },
  {
    id: 'exc-008', brand_id: DEMO_BRAND_ID, order_id: null,
    type: 'LOW_INVENTORY', severity: 'MEDIUM', status: 'UNRESOLVED',
    title: 'Wheatgrass Powder — 5 units left',
    description: '5 units remaining (threshold: 20). High-velocity SKU — reorder immediately.',
    created_at: dAt(0, 6, 0),
  },
  {
    id: 'exc-009', brand_id: DEMO_BRAND_ID, order_id: 'ord-011',
    type: 'RTO_INITIATED', severity: 'MEDIUM', status: 'UNRESOLVED',
    title: 'RTO initiated — ZF-2026-011',
    description: 'Delhivery marked return to origin. Customer unreachable. COD ₹998 at risk.',
    created_at: dAt(10, 9, 1),
  },
  {
    id: 'exc-010', brand_id: DEMO_BRAND_ID, order_id: 'ord-012',
    type: 'RTO_INITIATED', severity: 'MEDIUM', status: 'IN_PROGRESS',
    title: 'RTO initiated — ZF-2026-012',
    description: 'Customer refused delivery in Surat. Item being returned. COD ₹749 lost.',
    created_at: dAt(9, 11, 1),
  },
  {
    id: 'exc-011', brand_id: DEMO_BRAND_ID, order_id: 'ord-013',
    type: 'ADDRESS_ISSUE', severity: 'HIGH', status: 'UNRESOLVED',
    title: 'Address issue — ZF-2026-013',
    description: 'Incomplete delivery address for order to Patna. Courier unable to locate. RTO in progress.',
    created_at: dAt(8, 9, 0),
  },
  {
    id: 'exc-012', brand_id: DEMO_BRAND_ID, order_id: 'ord-049',
    type: 'HIGH_RTO_RISK', severity: 'CRITICAL', status: 'UNRESOLVED',
    title: 'Very high RTO risk flagged — ZF-2026-049',
    description: 'RTO score 90/100. COD to Patna T3, customer has 2 prior RTOs. Review before dispatch.',
    created_at: dAt(5, 14, 1),
  },
  {
    id: 'exc-013', brand_id: DEMO_BRAND_ID, order_id: null,
    type: 'FAILED_WEBHOOK', severity: 'LOW', status: 'RESOLVED',
    title: 'Razorpay webhook delivery failed',
    description: '3 webhook events failed to process. Events re-queued and processed successfully.',
    created_at: dAt(3, 14, 22),
  },
  {
    id: 'exc-014', brand_id: DEMO_BRAND_ID, order_id: 'ord-009',
    type: 'PENDING_SETTLEMENT', severity: 'LOW', status: 'RESOLVED',
    title: 'Payment settlement delayed — ZF-2026-009',
    description: 'Settlement of ₹1298 delayed beyond 7 days. Razorpay support contacted. Settlement received.',
    created_at: dAt(10, 0, 0),
  },
]

// ─── Revenue chart — 14 days, always relative to today ────────────────────

export const WEEKLY_REVENUE = Array.from({ length: 14 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (13 - i))
  const dateStr = date.toISOString().slice(0, 10)
  const dayOrders = DEMO_ORDERS.filter(o => o.created_at.slice(0, 10) === dateStr)
  return {
    date: dateStr,
    label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    revenue: Math.round(dayOrders.reduce((s, o) => s + o.gross_amount - o.discount_amount, 0)),
    orders: dayOrders.length,
  }
})

// ─── Channel breakdown ─────────────────────────────────────────────────────

export const CHANNEL_DATA = (() => {
  const map = new Map<string, { orders: number; revenue: number }>()
  for (const o of DEMO_ORDERS) {
    const e = map.get(o.channel) ?? { orders: 0, revenue: 0 }
    map.set(o.channel, { orders: e.orders + 1, revenue: e.revenue + o.gross_amount - o.discount_amount })
  }
  return Array.from(map.entries()).map(([channel, data]) => ({ channel, ...data }))
})()
