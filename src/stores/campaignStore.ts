import { create } from 'zustand'
import { DEMO_MODE } from '../lib/supabase'
import { getCampaigns, addCampaignDB, removeCampaignDB } from '../lib/db'
import { useAppStore } from './appStore'
import type { Campaign } from '../lib/campaignEngine'

// Manual campaign-spend entries (marketing spend is manual by design — no
// ad-platform pull). DEMO_MODE persists to localStorage; live mode persists to
// the brand-scoped `campaigns` table so entries survive reloads, devices, and
// teammates.

const KEY = 'xmetrics-campaigns'

const DEMO_CAMPAIGNS: Campaign[] = [
  { id: 'cmp-1', name: 'Diwali Sale',        coupon_code: 'DIWALI25',   spend: 600,  channel: 'Meta Ads',   started_at: '2026-06-10' },
  { id: 'cmp-2', name: 'First Order Offer',  coupon_code: 'FIRST10',    spend: 900,  channel: 'Google Ads', started_at: '2026-06-01' },
  { id: 'cmp-3', name: 'WhatsApp Broadcast', coupon_code: 'WHATSAPP15', spend: 1500, channel: 'WhatsApp',   started_at: '2026-06-15' },
]

function loadLocal(): Campaign[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Campaign[]
  } catch { /* fall through to demo seed */ }
  return DEMO_CAMPAIGNS
}

function persistLocal(campaigns: Campaign[]) {
  try { localStorage.setItem(KEY, JSON.stringify(campaigns)) } catch { /* best-effort */ }
}

interface CampaignState {
  campaigns: Campaign[]
  hydrated: boolean
  hydrate: () => Promise<void>
  addCampaign: (c: Omit<Campaign, 'id'>) => void
  removeCampaign: (id: string) => void
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaigns: DEMO_MODE ? loadLocal() : [],
  hydrated: DEMO_MODE,

  // Live mode: load the brand's campaigns from Supabase once the brand is known.
  hydrate: async () => {
    if (DEMO_MODE || get().hydrated) return
    const brandId = useAppStore.getState().currentBrand?.id
    if (!brandId) return
    try {
      const rows = await getCampaigns(brandId)
      set({ campaigns: rows as Campaign[], hydrated: true })
    } catch { /* leave empty; will retry on next mount */ }
  },

  addCampaign: (c) => {
    const tempId = `cmp-${Date.now()}`
    set({ campaigns: [...get().campaigns, { ...c, id: tempId }] })

    if (DEMO_MODE) {
      persistLocal(get().campaigns)
      return
    }
    const brandId = useAppStore.getState().currentBrand?.id
    if (!brandId) return
    addCampaignDB(brandId, c)
      .then(realId => {
        if (realId) {
          // Swap the optimistic temp id for the real UUID from the DB.
          set({ campaigns: get().campaigns.map(x => x.id === tempId ? { ...x, id: realId } : x) })
        }
      })
      .catch(() => { /* surfaced on next reload */ })
  },

  removeCampaign: (id) => {
    set({ campaigns: get().campaigns.filter(c => c.id !== id) })
    if (DEMO_MODE) persistLocal(get().campaigns)
    else removeCampaignDB(id).catch(() => { /* best-effort */ })
  },
}))
