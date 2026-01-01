/**
 * Hero.tsx
 *
 * Hero section component for the Tracktopia landing page.
 */

import React from 'react'
import { useNavigate } from 'react-router'
import { Truck, Users } from 'lucide-react'

/**
 * HeroProps
 *
 * onStart - callback when user clicks start playing
 * onSignIn - callback when user clicks sign in
 */
interface HeroProps {
  onStart: () => void
  onSignIn: () => void
}

/**
 * Hero
 *
 * Prominent marketing hero with headline, short pitch and primary CTAs.
 */
export default function Hero({ onStart, onSignIn }: HeroProps) {
  const nav = useNavigate()
  return (
    <header className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 bg-black text-yellow-400 px-3 py-1 rounded-full text-sm font-semibold">
            <Truck size={16} /> Tracktopia
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
            Build your trucking empire — from a single truck to a global fleet
          </h1>
          <p className="text-black/75 max-w-xl">
            Tracktopia is a browser-based multiplayer truck manager simulator where you hire drivers, manage
            fleets and expand hubs across cities. Deep strategy, competition and live persistent worlds.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onStart}
              className="px-6 py-3 bg-black text-yellow-400 rounded font-semibold shadow hover:brightness-95 transition"
            >
              Start Playing
            </button>
            <button
              onClick={onSignIn}
              className="px-6 py-3 border-2 border-black bg-white text-black rounded font-semibold"
            >
              Sign in
            </button>
            <button
              onClick={() => nav('/create-company')}
              className="px-4 py-2 rounded bg-yellow-400 text-black font-medium hidden md:inline-flex items-center gap-2"
            >
              Quick Create
            </button>
          </div>

          <div className="mt-4 flex items-center gap-6 text-sm text-black/70">
            <div className="inline-flex items-center gap-2">
              <Users size={16} />
              Massive online economy
            </div>
            <div>Seasonal updates & live events</div>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-xl overflow-hidden shadow-xl ring-1 ring-black/5">
            <img
              src="https://pub-cdn.sider.ai/u/U0KAH9N4VLX/web-coder/6956ef545599fc8caeb3a137/resource/d4460459-9786-4577-ad06-47effbc55dea.jpg"
              alt="Tracktopia hero illustration"
              className="w-full h-72 md:h-96 object-cover"
            />
          </div>

          <div className="absolute left-6 bottom-6 bg-black/85 text-yellow-400 px-4 py-2 rounded-md shadow backdrop-blur">
            <div className="text-xs">Live World</div>
            <div className="text-sm font-semibold">Manage fleets across hundreds of cities</div>
          </div>
        </div>
      </div>
    </header>
  )
}
