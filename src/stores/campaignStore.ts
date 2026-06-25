import { create } from 'zustand'
import type { Campaign } from '../lib/campaignEngine'

// Manual campaign-spend entries. Persisted to localStorage so a founder's
// entries survive reloads without a backend (marketing spend is manual by
// design — there's no ad-platform pull). Live mode would persist these to a
// `campaigns` table; the shape is identical.

const KEY = 'xmetrics-campaigns'

// Spends calibrated against the demo's attributed contribution so the sample
// tells the real story: one genuine winner, one "vanity trap" (great revenue
// ROAS that loses money after RTO), and one clear loss.
const DEMO_CAMPAIGNS: Campaign[] = [
  { id: 'cmp-1', name: 'Diwali Sale',        coupon_code: 'DIWALI25',   spend: 600,  channel: 'Meta Ads',   started_at: '2026-06-10' },
  { id: 'cmp-2', name: 'First Order Offer',  coupon_code: 'FIRST10',    spend: 900,  channel: 'Google Ads', started_at: '2026-06-01' },
  { id: 'cmp-3', name: 'WhatsApp Broadcast', coupon_code: 'WHATSAPP15', spend: 1500, channel: 'WhatsApp',   started_at: '2026-06-15' },
]

function load(): Campaign[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Campaign[]
  } catch { /* fall through to demo seed */ }
  return DEMO_CAMPAIGNS
}

function persist(campaigns: Campaign[]) {
  try { localStorage.setItem(KEY, JSON.stringify(campaigns)) } catch { /* best-effort */ }
}

interface CampaignState {
  campaigns: Campaign[]
  addCampaign: (c: Omit<Campaign, 'id'>) => void
  removeCampaign: (id: string) => void
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaigns: load(),
  addCampaign: (c) => {
    const next = [...get().campaigns, { ...c, id: `cmp-${Date.now()}` }]
    persist(next)
    set({ campaigns: next })
  },
  removeCampaign: (id) => {
    const next = get().campaigns.filter(c => c.id !== id)
    persist(next)
    set({ campaigns: next })
  },
}))
