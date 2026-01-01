/**
 * Reviews.tsx
 *
 * Player reviews/testimonials section.
 */

import React from 'react'

/**
 * Reviews
 *
 * Renders a set of testimonial cards.
 */
export default function Reviews() {
  const reviews = [
    { text: 'Immersive and addictive — perfect blend of strategy and competition.', author: 'Pro Manager' },
    { text: 'Great multiplayer economy and long-term progression.', author: 'FleetMaster' },
    { text: 'Amazing depth — running my company feels realistic.', author: 'RoadKing' },
  ]

  return (
    <section>
      <h2 className="text-2xl font-bold mb-4">Player Reviews</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reviews.map((r, i) => (
          <div key={i} className="p-6 bg-white rounded-lg shadow">
            <div className="text-black/70">“{r.text}”</div>
            <div className="mt-4 font-semibold">— {r.author}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
