/**
 * AddressBook.tsx
 *
 * Left column: address book / thread list UI.
 * Displays searchable list of threads/contacts and allows selecting or seeding demo threads.
 */

import React from 'react'
import { Search } from 'lucide-react'

/**
 * ContactEntry
 *
 * Represents a contact entry shown in the address book.
 */
export interface ContactEntry {
  id: string
  name: string
  lastMessage?: string
  updatedAt?: string
}

/**
 * AddressBookProps
 *
 * Props for the AddressBook component.
 */
export interface AddressBookProps {
  contacts: ContactEntry[]
  selectedId: string | null
  onSelect: (id: string) => void
  onSeed: () => void
  onNewConversation: () => void
  search: string
  setSearch: (s: string) => void
}

/**
 * AddressBook
 *
 * Shows contact list and search input. Minimal, presentational, and stateless.
 *
 * @param props - AddressBookProps
 */
export default function AddressBook({
  contacts,
  selectedId,
  onSelect,
  onSeed,
  onNewConversation,
  search,
  setSearch,
}: AddressBookProps) {
  return (
    <div className="col-span-3 border rounded p-3 bg-white/80 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Address Book</div>
      </div>

      <div className="mb-3">
        <div className="relative">
          <input
            aria-label="Search contacts"
            placeholder="Search contacts / threads"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border rounded text-black text-sm pl-9"
          />
          <div className="absolute left-2 top-2 text-slate-400">
            <Search size={16} />
          </div>
        </div>
      </div>

      <div className="space-y-2 overflow-auto">
        {contacts.length === 0 ? (
          <div className="text-sm text-slate-500">No conversations yet.</div>
        ) : (
          contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full text-left p-2 rounded hover:bg-slate-50 flex flex-col ${
                selectedId === c.id ? 'bg-slate-100' : ''
              }`}
            >
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-xs text-slate-500 truncate">{c.lastMessage || 'No messages yet'}</div>
              <div className="text-[10px] text-slate-400 mt-1">{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : ''}</div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
