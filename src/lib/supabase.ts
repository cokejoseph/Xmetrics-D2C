import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const DEMO_MODE = !SUPABASE_URL || SUPABASE_URL === ''

export const supabase = DEMO_MODE
  ? null
  : createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
