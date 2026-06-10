/**
 * whatsapp-send — Supabase Edge Function
 *
 * Proxies WhatsApp Cloud API calls server-side to keep the API token
 * out of the browser. All actions require a valid Supabase JWT.
 *
 * Actions:
 *   test_connection  — GET phone number details
 *   send_text        — Send a free-form text message
 *   send_template    — Send a pre-approved template message
 *
 * WhatsApp Cloud API base: https://graph.facebook.com/v19.0
 *
 * Deploy:
 *   supabase functions deploy whatsapp-send
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const WA_BASE = 'https://graph.facebook.com/v19.0'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405)
  }

  // Verify JWT
  const authHeader = req.headers.get('authorization') ?? ''
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authErr || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = await req.json()
  const { action, phone_number_id, api_token } = body

  if (!phone_number_id || !api_token) {
    return json({ error: 'phone_number_id and api_token are required' }, 400)
  }

  const waHeaders = {
    'Authorization': `Bearer ${api_token}`,
    'Content-Type': 'application/json',
  }

  // ── test_connection ───────────────────────────────────────────────────────
  if (action === 'test_connection') {
    const res = await fetch(`${WA_BASE}/${phone_number_id}?fields=display_phone_number,verified_name`, {
      headers: waHeaders,
    })
    if (!res.ok) {
      const data = await res.json()
      return json({ ok: false, error: data?.error?.message ?? `WhatsApp API returned ${res.status}` })
    }
    const data = await res.json() as { display_phone_number: string; verified_name: string }
    return json({ ok: true, display_phone_number: data.display_phone_number, verified_name: data.verified_name })
  }

  // ── send_text ─────────────────────────────────────────────────────────────
  if (action === 'send_text') {
    const { to, text } = body
    if (!to || !text) return json({ error: 'to and text are required' }, 400)

    const res = await fetch(`${WA_BASE}/${phone_number_id}/messages`, {
      method: 'POST',
      headers: waHeaders,
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: sanitizePhone(to),
        type: 'text',
        text: { body: text },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return json({ ok: false, error: data?.error?.message ?? `WhatsApp returned ${res.status}` })
    }
    return json({ ok: true, message_id: data.messages?.[0]?.id })
  }

  // ── send_template ─────────────────────────────────────────────────────────
  if (action === 'send_template') {
    const { to, template, language, components } = body
    if (!to || !template) return json({ error: 'to and template are required' }, 400)

    const res = await fetch(`${WA_BASE}/${phone_number_id}/messages`, {
      method: 'POST',
      headers: waHeaders,
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: sanitizePhone(to),
        type: 'template',
        template: {
          name: template,
          language: { code: language ?? 'en' },
          components: components ?? [],
        },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return json({ ok: false, error: data?.error?.message ?? `WhatsApp returned ${res.status}` })
    }
    return json({ ok: true, message_id: data.messages?.[0]?.id })
  }

  return json({ error: `Unknown action: ${action}` }, 400)
})

function sanitizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) return digits
  if (digits.length === 10) return `91${digits}`
  return digits
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
