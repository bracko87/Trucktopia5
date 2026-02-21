/**
 * src/lib/supabaseClient.ts
 *
 * Single source-of-truth Supabase client used by the app.
 * Uses a safe storage adapter that falls back to in-memory storage
 * when window.localStorage is unavailable (sandboxed environments).
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Public Supabase endpoint and anon key (intentionally public for preview).
 */
const SUPABASE_URL = "https://iiunrkztuhhbdgxzqqgq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM";

console.log("✅ supabaseClient.ts LOADED", new Date().toISOString());

/**
 * In some embedded / sandboxed environments (like Sider preview), access to
 * window.localStorage may throw. Provide a tiny adapter that uses localStorage
 * when available and falls back to an in-memory Map otherwise.
 */
const mem = new Map<string, string>();

const safeStorage = {
  /**
   * Get an item by key. Returns string or null.
   */
  getItem: (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return mem.get(key) ?? null;
    }
  },

  /**
   * Set an item by key.
   */
  setItem: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      mem.set(key, value);
    }
  },

  /**
   * Remove an item by key.
   */
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      mem.delete(key);
    }
  },

  /**
   * Optional length/key helpers to satisfy some Storage implementations.
   */
  key: (index: number) => {
    try {
      return window.localStorage.key(index);
    } catch {
      const keys = Array.from(mem.keys());
      return keys[index] ?? null;
    }
  },
  get length() {
    try {
      return window.localStorage.length;
    } catch {
      return mem.size;
    }
  },
};

/**
 * Create the supabase client using the safe storage adapter. When localStorage
 * is blocked, session will persist in-memory for the page lifecycle.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeStorage as any,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// export these for helpers to reuse without env reads
export const SUPABASE_URL_CONST = SUPABASE_URL;
export const SUPABASE_ANON_KEY_CONST = SUPABASE_ANON_KEY;
