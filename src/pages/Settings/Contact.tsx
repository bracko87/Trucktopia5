/**
 * Contact.tsx
 *
 * Full page contact form (Settings -> Contact us).
 * Demo-only: logs to console.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import Layout from '../../components/Layout'

/**
 * ContactPage
 *
 * Simple contact form; placeholder for real backend integration.
 */
export default function ContactPage(): JSX.Element {
  const nav = useNavigate()
  const [subject, setSubject] = useState<string>('')
  const [message, setMessage] = useState<string>('')

  function send() {
    console.log('Contact form (placeholder):', { subject, message })
    alert('Message sent (demo).')
    setSubject('')
    setMessage('')
    nav(-1)
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Contact us</h2>
          <button onClick={() => nav(-1)} className="px-3 py-1 rounded border text-black">Back</button>
        </div>

        <div className="bg-white p-6 rounded shadow space-y-4">
          <div>
            <label className="text-xs text-slate-600">Subject</label>
            <input className="w-full px-3 py-2 border rounded text-black" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-600">Message</label>
            <textarea className="w-full px-3 py-2 border rounded text-black" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => nav(-1)} className="px-3 py-1 rounded border text-black">Cancel</button>
            <button onClick={send} className="px-3 py-1 rounded bg-sky-600 text-white">Send</button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
