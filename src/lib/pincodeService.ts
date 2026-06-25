// Postalpincode.in free API — http://www.postalpincode.in/Api-Details
// Endpoint: GET http://api.postalpincode.in/pincode/{pincode}
// No auth required. Cache results 7 days (pincode data changes rarely).

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_KEY = (pin: string) => `pc_${pin}`

export interface PostOfficeData {
  Name: string
  BranchType: 'Head Post Office' | 'Sub Post Office' | 'Branch Post Office'
  DeliveryStatus: 'Delivery' | 'Non-Delivery'
  Circle: string
  District: string
  Division: string
  Region: string
  Block: string
  State: string
  Country: string
  Pincode: string
}

export interface PincodeResult {
  pincode: string
  state: string
  district: string
  region: string
  deliverable: boolean        // false if any office is Non-Delivery
  isRural: boolean            // true if all offices are Sub/Branch PO
  tier: 1 | 2 | 3
  highRiskState: boolean
}

// States with historically high RTO rates
const HIGH_RTO_STATES = new Set([
  'Jammu and Kashmir', 'Ladakh',
  'Assam', 'Meghalaya', 'Manipur', 'Mizoram',
  'Nagaland', 'Arunachal Pradesh', 'Tripura', 'Sikkim',
  'Andaman and Nicobar Islands', 'Lakshadweep',
])

// Tier-1 metro districts (not exhaustive, covers major cities)
const TIER1_DISTRICTS = new Set([
  'Central Delhi', 'New Delhi', 'South Delhi', 'North Delhi', 'East Delhi', 'West Delhi',
  'Mumbai City', 'Mumbai Suburban', 'Thane',
  'Bangalore', 'Bengaluru Urban', 'Bengaluru Rural',
  'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad', 'Kolkata',
  'Jaipur', 'Lucknow', 'Chandigarh', 'Surat', 'Indore',
  'Coimbatore', 'Kochi', 'Nagpur', 'Visakhapatnam',
])

// Tier-2 state capitals and major cities
const TIER2_DISTRICTS = new Set([
  'Bhopal', 'Patna', 'Raipur', 'Ranchi', 'Bhubaneswar', 'Guwahati',
  'Dehradun', 'Shimla', 'Jammu', 'Srinagar', 'Panaji', 'Imphal',
  'Shillong', 'Agartala', 'Aizawl', 'Itanagar', 'Kohima', 'Gangtok',
  'Amritsar', 'Ludhiana', 'Agra', 'Kanpur', 'Varanasi', 'Meerut',
  'Rajkot', 'Vadodara', 'Nashik', 'Aurangabad', 'Solapur',
  'Madurai', 'Tiruchirappalli', 'Salem', 'Thiruvananthapuram', 'Kozhikode',
  'Vijayawada', 'Warangal', 'Guntur', 'Nellore',
])

function classifyTier(district: string, state: string): 1 | 2 | 3 {
  if (TIER1_DISTRICTS.has(district)) return 1
  if (TIER2_DISTRICTS.has(district)) return 2
  // Also classify by state capitals of larger states
  const majorStateCapitals: Record<string, string> = {
    'Maharashtra': 'Mumbai City', 'Karnataka': 'Bengaluru Urban',
    'Tamil Nadu': 'Chennai', 'Telangana': 'Hyderabad',
  }
  const capitalDistrict = majorStateCapitals[state]
  if (capitalDistrict && district === capitalDistrict) return 1
  return 3
}

function readCache(pincode: string): PincodeResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY(pincode))
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: PincodeResult; ts: number }
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY(pincode))
      return null
    }
    return data
  } catch {
    return null
  }
}

function writeCache(pincode: string, data: PincodeResult) {
  try {
    localStorage.setItem(CACHE_KEY(pincode), JSON.stringify({ data, ts: Date.now() }))
  } catch { /* cache write is best-effort — quota/private-mode failures are non-fatal */ }
}

export async function lookupPincode(pincode: string): Promise<PincodeResult | null> {
  if (!/^\d{6}$/.test(pincode)) return null

  const cached = readCache(pincode)
  if (cached) return cached

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
    if (!res.ok) return null

    const json = await res.json() as Array<{ Status: string; PostOffice: PostOfficeData[] | null }>
    const record = json[0]
    if (record.Status !== 'Success' || !record.PostOffice?.length) return null

    const offices = record.PostOffice
    const first = offices[0]

    const deliverable = offices.some(o => o.DeliveryStatus === 'Delivery')
    const isRural = offices.every(o =>
      o.BranchType === 'Sub Post Office' || o.BranchType === 'Branch Post Office'
    )
    const district = first.District
    const state = first.State
    const tier = classifyTier(district, state)

    const result: PincodeResult = {
      pincode,
      state,
      district,
      region: first.Region,
      deliverable,
      isRural,
      tier,
      highRiskState: HIGH_RTO_STATES.has(state),
    }

    writeCache(pincode, result)
    return result
  } catch {
    return null
  }
}
