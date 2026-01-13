/**
 * Help.tsx
 *
 * Settings → Help page.
 *
 * Provides:
 * - Short welcome / quick links (keeps Open Discord CTA)
 * - Game manual intro with expandable sections
 * - FAQ list implemented with reusable FAQItem components
 *
 * The layout is split into small components for reusability.
 */

import React from 'react'
import Layout from '../../components/Layout'
import HelpHeader from '../../components/help/HelpHeader'
import FAQItem from '../../components/help/FAQItem'
import { BookOpen, LifeBuoy, ExternalLink } from 'lucide-react'

/**
 * HelpPage
 *
 * The main help page used under settings. Preserves the "Open Discord" CTA.
 */
export default function HelpPage(): JSX.Element {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6">
        <HelpHeader
          title="Help"
          subtitle="Welcome — help resources and community links are collected here. For live support, join our Discord."
        />

        <div className="bg-white p-6 rounded shadow space-y-6">
          {/* Quick actions */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-indigo-50 text-indigo-600">
                <LifeBuoy size={20} />
              </div>
              <div>
                <div className="font-medium">Need live help?</div>
                <div className="text-sm text-slate-600">Join the community for support, live chat and announcements.</div>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                className="px-3 py-2 rounded bg-indigo-600 text-white inline-flex items-center gap-2"
                href="#"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} />
                Open Discord
              </a>

              <button
                className="px-3 py-2 rounded border text-black"
                onClick={() => {
                  // lightweight close action: go back
                  window.history.back()
                }}
              >
                Close
              </button>
            </div>
          </div>

          {/* Game manual (intro + expandable sections) */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded bg-emerald-50 text-emerald-600">
                <BookOpen size={20} />
              </div>
              <div>
                <div className="font-medium">Game manual (intro)</div>
                <div className="text-sm text-slate-600">Short guide to get players started. Expand sections for details.</div>
              </div>
            </div>

            <div className="space-y-3">
              <details className="bg-white border rounded p-4">
                <summary className="cursor-pointer font-medium">Getting started — first steps</summary>
                <div className="mt-2 text-sm text-slate-700">
                  Welcome to the game — start by creating a company, selecting a hub city, and accepting your first starter
                  lease. Use the Trucks and Market pages to manage vehicles and find jobs. This section can be expanded later
                  into a full manual with images and examples.
                </div>
              </details>

              <details className="bg-white border rounded p-4">
                <summary className="cursor-pointer font-medium">Earning money & jobs</summary>
                <div className="mt-2 text-sm text-slate-700">
                  Jobs appear in the Market and My Jobs screens. Match jobs with available trucks, consider cargo types and
                  distances. Rewards depend on distance, cargo and deadlines. Upgrade vehicles and hubs to increase capacity.
                </div>
              </details>

              <details className="bg-white border rounded p-4">
                <summary className="cursor-pointer font-medium">Managing your fleet</summary>
                <div className="mt-2 text-sm text-slate-700">
                  Maintain condition_score, perform upkeep, and manage leases. The Trucks page shows details, maintenance and
                  insurance options. Sell or lease vehicles as your strategy evolves.
                </div>
              </details>
            </div>
          </section>

          {/* FAQ list */}
          <section>
            <div className="mb-3">
              <div className="font-medium">Frequently asked questions</div>
              <div className="text-sm text-slate-600">Common questions and short answers — expand any item to read more.</div>
            </div>

            <div className="grid gap-3">
              <FAQItem
                question="How do I create a company?"
                answer={
                  <div>
                    Go to Register → Create company. Choose a name and hub city. Starter funds and a truck lease are applied to
                    new companies automatically. If you don't see the option, ensure you're signed in.
                  </div>
                }
              />

              <FAQItem
                question="What happens if my truck breaks down?"
                answer={
                  <div>
                    Trucks have a condition score. If it drops, maintenance is required; use the Maintenance modal on the Truck
                    details card to repair. Insurance may cover some costs depending on your plan.
                  </div>
                }
              />

              <FAQItem
                question="Can I play on multiple devices?"
                answer={
                  <div>
                    Yes — your account is tied to your profile. Preferences and progress are stored server-side when signed in.
                    Make sure to sign in before playing on another device to sync your data.
                  </div>
                }
              />

              <FAQItem
                question="Where to report bugs or suggest features?"
                answer={
                  <div>
                    Please join our Discord (Open Discord button above) or open an issue in the project tracker — community
                    channels are the fastest way to get a reply.
                  </div>
                }
              />
            </div>
          </section>
        </div>
      </div>
    </Layout>
  )
}