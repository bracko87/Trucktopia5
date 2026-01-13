/**
 * Netlify Function: invite.ts
 *
 * Server-first invite handler for Netlify.
 *
 * - Persists an invite row to Supabase via REST (service role key).
 * - Sends email via Formspree (preferred) using either the Formspree public form
 *   endpoint or the API v0 when FORMSPREE_API_TOKEN is provided.
 *
 * Environment variables expected:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - FORMSPREE_FORM_ID
 * - FORMSPREE_API_TOKEN (optional; if present uses API v0 with Bearer auth)
 * - APP_URL (optional; used to build invite link)
 *
 * Notes:
 * - Keep all secrets server-side (do not expose in client).
 * - This function is intended for Netlify: it exports `handler`.
 */

/**
 * Module imports
 */
import { randomBytes } from 'crypto'
import type { Handler } from '@netlify/functions'

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
  const re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
  return re.test(e)
}

/**
 * handler
 *
 * Netlify-compatible function handler.
 *
 * @param event - incoming request event
 * @returns response object
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const FORMSPREE_FORM_ID = process.env.FORMSPREE_FORM_ID
  const FORMSPREE_API_TOKEN = process.env.FORMSPREE_API_TOKEN
  const APP_URL = process.env.APP_URL || 'https://your-app.example.com'

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing SUPABASE env vars' }) }
  }

  if (!FORMSPREE_FORM_ID) {
    console.warn('Warning: FORMSPREE_FORM_ID not set. Emails will not be sent.')
  }

  let payload: any = {}
  try {
    payload = event.body ? JSON.parse(event.body) : {}
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { email, message, inviterId } = payload

  if (!validateEmail(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) }
  }

  const token = createToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const inviteLink = `${APP_URL}/signup?invite=${encodeURIComponent(token)}`

  try {
    // Persist invite row to Supabase via REST
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
      const text = await supabaseResp.text().catch(() => '')
      console.error('Supabase insert failed', supabaseResp.status, text)
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save invite' }) }
    }

    const inserted = await supabaseResp.json().catch(() => null)
    const inviteId = inserted?.[0]?.id

    // If Formspree is configured, send the email
    if (FORMSPREE_FORM_ID) {
      try {
        if (FORMSPREE_API_TOKEN) {
          // Use Formspree API v0 (requires token) -> POST to /forms/{form_id}/submissions
          const formApiUrl = `https://api.formspree.io/v0/forms/${encodeURIComponent(FORMSPREE_FORM_ID)}/submissions`
          const submissionPayload = {
            fields: [
              { name: 'email', type: 'email', value: email },
              { name: 'message', type: 'text', value: message ?? '' },
              { name: 'invite_link', type: 'text', value: inviteLink },
            ],
          }

          const fsResp = await fetch(formApiUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${FORMSPREE_API_TOKEN}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(submissionPayload),
          })

          if (!fsResp.ok) {
            const txt = await fsResp.text().catch(() => '')
            console.error('Formspree API send failed', fsResp.status, txt)
            // continue (we still persisted the invite)
            return {
              statusCode: 200,
              body: JSON.stringify({ ok: true, warning: 'invite_saved_but_email_failed', details: txt || null }),
            }
          }
        } else {
          // Fallback: POST to the public Formspree form endpoint
          const formUrl = `https://formspree.io/f/${encodeURIComponent(FORMSPREE_FORM_ID)}`
          const formData = new URLSearchParams()
          formData.append('email', email)
          formData.append('message', message ?? '')
          formData.append('invite_link', inviteLink)

          const fsResp = await fetch(formUrl, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
          })

          if (!fsResp.ok) {
            const txt = await fsResp.text().catch(() => '')
            console.error('Formspree public send failed', fsResp.status, txt)
            return {
              statusCode: 200,
              body: JSON.stringify({ ok: true, warning: 'invite_saved_but_email_failed', details: txt || null }),
            }
          }
        }

        // Mark invite as sent when we have an inviteId
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
      } catch (err) {
        console.error('Formspree send error', err)
        return { statusCode: 200, body: JSON.stringify({ ok: true, warning: 'invite_saved_but_email_failed' }) }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    console.error('Invite handler error', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}

export default handler