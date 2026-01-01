/**
 * Screenshots.tsx
 *
 * Gallery of product screenshots for the landing page.
 */

import React from 'react'

/**
 * Screenshots
 *
 * Displays three columns of screenshots using smart placeholder images.
 */
export default function Screenshots() {
  const items = [
    { alt: 'Fleet overview', src: 'https://pub-cdn.sider.ai/u/U0KAH9N4VLX/web-coder/6956ef545599fc8caeb3a137/resource/c69bc124-889c-411a-9f1b-af70301fe7da.jpg' },
    { alt: 'Route planner', src: 'https://pub-cdn.sider.ai/u/U0KAH9N4VLX/web-coder/6956ef545599fc8caeb3a137/resource/5f67fc8e-d7b0-4a32-b45b-32290ccfd964.jpg' },
    { alt: 'Company management', src: 'https://pub-cdn.sider.ai/u/U0KAH9N4VLX/web-coder/6956ef545599fc8caeb3a137/resource/2484efc3-8ddf-4bb1-b129-5a6293764b44.jpg' },
  ]
  return (
    <section>
      <h2 className="text-2xl font-bold mb-4">Screenshots</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.src} className="rounded-lg overflow-hidden shadow">
            <img src={it.src} alt={it.alt} className="w-full h-56 object-cover" />
          </div>
        ))}
      </div>
    </section>
  )
}
