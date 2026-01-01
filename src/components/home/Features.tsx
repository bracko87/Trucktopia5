/**
 * Features.tsx
 *
 * Feature highlights section for the landing page.
 */

import React from 'react'
import { BarChart, Users, Clock, Globe } from 'lucide-react'

/**
 * FeatureItem
 *
 * Small feature card.
 */
function FeatureItem({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg p-5 shadow">
      <div className="w-12 h-12 rounded-md bg-black text-yellow-400 flex items-center justify-center mb-3">
        {icon}
      </div>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-sm text-black/70">{desc}</div>
    </div>
  )
}

/**
 * Features
 *
 * Renders a 3-column features grid.
 */
export default function Features() {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-4">Why Tracktopia</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureItem
          title="Deep Fleet Management"
          desc="Customise trucks, assign drivers and tune routes to maximise profit."
          icon={<BarChart size={18} />}
        />
        <FeatureItem
          title="Massive Persistent World"
          desc="Compete and trade with other players across a living economy."
          icon={<Globe size={18} />}
        />
        <FeatureItem
          title="Live Multiplayer Events"
          desc="Seasonal challenges, leaderboards and cooperative economies."
          icon={<Clock size={18} />}
        />
      </div>
    </section>
  )
}
