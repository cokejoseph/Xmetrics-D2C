/**
 * invite-team-member — Supabase Edge Function
 *
 * Sends a real Supabase Auth invitation email to the specified address.
 * On accept, the invited user is linked to brand_members with their real UUID.
 *
 * Requires: OWNER or ADMIN role in the brand.
 * Deploy: supabase functions deploy invite-team-member
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const VALID_ROLES = ['ADMIN', 'EDITOR', 'VIEWER'] as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const siteUrl    = Deno.env.get('SITE_URL') ?? 'https://xmetrics.in'

    // Authenticate the calling user via their JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { brand_id, name, email, role } = await req.json()

    if (!brand_id || !name || !email || !role) {
      return json({ error: 'brand_id, name, email, and role are required' }, 400)
    }
    if (!(VALID_ROLES as readonly string[]).includes(role)) {
      return json({ error: `Invalid role — must be one of: ${VALID_ROLES.join(', ')}` }, 400)
    }

    const normalizedEmail = email.toLowerCase().trim()
    const svc = createClient(supabaseUrl, serviceKey)

    // Verify caller is OWNER or ADMIN of this brand
    const { data: membership } = await svc
      .from('brand_members')
      .select('role')
      .eq('brand_id', brand_id)
      .eq('user_id', user.id)
      .in('role', ['OWNER', 'ADMIN'])
      .single()

    if (!membership) return json({ error: 'Forbidden — must be OWNER or ADMIN to invite members' }, 403)

    // Prevent duplicate membership for the same email
    const { data: existing } = await svc
      .from('brand_members')
      .select('id')
      .eq('brand_id', brand_id)
      .eq('email', normalizedEmail)
      .single()

    if (existing) {
      return json({ error: 'This email address is already a member of this workspace' }, 409)
    }

    // Send the invitation via Supabase Auth Admin API.
    // This creates the user (if new) and emails them a magic sign-in link.
    const { data: inviteData, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo: `${siteUrl}/login`,
        data: { invited_brand_id: brand_id, invited_role: role },
      }
    )

    if (inviteErr || !inviteData?.user) {
      console.error('invite-team-member: inviteUserByEmail error:', inviteErr)
      return json({ error: inviteErr?.message ?? 'Failed to send invitation' }, 500)
    }

    const invitedUserId = inviteData.user.id

    // Link the invited user to the brand with their real UUID.
    // upsert in case the user already has a ghost membership row from a previous partial invite.
    const { error: memberErr } = await svc
      .from('brand_members')
      .upsert(
        {
          brand_id,
          user_id:     invitedUserId,
          role,
          name,
          email:       normalizedEmail,
        },
        { onConflict: 'brand_id,user_id' }
      )

    if (memberErr) {
      console.error('invite-team-member: brand_members upsert error:', memberErr)
      // Invitation email was still sent — treat as partial success
      return json({
        success: true,
        user_id: invitedUserId,
        warning: 'Invite sent but membership record may need manual linking',
      })
    }

    console.log(`invite-team-member: invited ${normalizedEmail} to brand ${brand_id} as ${role}`)
    return json({ success: true, user_id: invitedUserId })
  } catch (err) {
    console.error('invite-team-member error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
