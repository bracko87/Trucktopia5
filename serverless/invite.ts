/**
 * invite.ts
 *
 * Serverless function example (Node/Vercel/Netlify style) to persist an invite
 * row and send a transactional email using SendGrid.
 *
 * Deploy this file to a serverless environment. It is *not* executed inside
 * the client app — the client calls POST /api/invite which should route to
 * this function.
 *
 * Required environment variables:
 * - SUPABASE_URL: your Supabase project URL (e.g. https://xyz.supabase.co)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service_role key used to insert rows
 * - SENDGRID_API_KEY: SendGrid API key for sending email
 * - APP_URL (optional): public app URL used to build invite link
 *
 * Security notes:
 * - Use the service role key only for this server function (never from client).
 * - Optionally check inviter identity (Authorization header / session) before sending.
 *
 * This function uses native fetch and Node 18+ runtime semantics.
 */

import { randomBytes } from 'crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * createToken
 *
 * Create a URL-safe token for invites.
 *
 * @param n - byte length
 * @returns token string
 */
function createToken(n = 18): string {
  return randomBytes(n).toString('base64url')
}

/**
 * validateEmail
 *
 * Simple email format validation (server-side check).
 *
 * @param e - email string
 * @returns boolean
 */
function validateEmail(e: unknown): e is string {
  if (typeof e !== 'string') return false
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(e)
}

/**
 * handler
 *
 * Vercel-compatible handler. For other platforms adapt the signature:
 * - Netlify Functions: exports.handler = async (event) => { ... }
 * - Supabase Edge Function (Deno): export default async (req: Request) => Response
 *
 * @param req - request
 * @param res - response
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
  const APP_URL = process.env.APP_URL || 'https://your-app.example.com'

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Missing SUPABASE env vars' })
    return
  }
  if (!SENDGRID_API_KEY) {
    // Email won't be sent but invite row can still be persisted if desired.
    console.warn('Warning: SENDGRID_API_KEY not set. Emails will not be sent.')
  }

  const payload = req.body ?? {}
  const { email, message, inviterId } = payload

  if (!validateEmail(email)) {
    res.status(400).json({ error: 'Invalid email' })
    return
  }

  // Create invite token and expiry (7 days)
  const token = createToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Persist invite row via Supabase REST API (service role key)
  try {
    const insertBody = [
      {
        email,
        message,
        inviter_user_id: inviterId || null,
        token,
        expires_at: expiresAt,
        sent: false,
      },
    ]

    const supabaseResp = await fetch(`${SUPABASE_URL}/rest/v1/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(insertBody),
    })

    if (!supabaseResp.ok) {
      const text = await supabaseResp.text()
      console.error('Supabase insert failed', supabaseResp.status, text)
      res.status(500).json({ error: 'Failed to save invite' })
      return
    }

    const inserted = await supabaseResp.json()

    // If SendGrid is configured, send the email
    if (SENDGRID_API_KEY) {
      const inviteLink = `${APP_URL}/signup?invite=${encodeURIComponent(token)}`
      const emailPayload = {
        personalizations: [
          {
            to: [{ email }],
            subject: `You're invited to Tracktopia`,
          },
        ],
        from: { email: 'no-reply@your-app.example.com', name: 'Tracktopia' },
        content: [
          {
            type: 'text/plain',
            value: `${message}\n\nAccept the invite: ${inviteLink}\n\nIf you did not expect this, ignore this email.`,
          },
        ],
      }

      const sgResp = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      })

      if (!sgResp.ok) {
        // Log but continue: we still keep the invite row
        const txt = await sgResp.text().catch(() => '')
        console.error('SendGrid send failed', sgResp.status, txt)
        // Return success response but indicate email sending problem
        res.status(200).json({
          ok: true,
          warning: 'invite_saved_but_email_failed',
          details: txt || null,
        })
        return
      }

      // Mark invite as sent
      const inviteId = inserted?.[0]?.id
      if (inviteId) {
        await fetch(`${SUPABASE_URL}/rest/v1/invites?id=eq.${encodeURIComponent(inviteId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ sent: true }),
        }).catch((e) => console.warn('Failed to mark invite sent', e))
      }
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Invite handler error', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}