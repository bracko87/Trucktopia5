
/**
 * src/lib/supabaseDebug.ts
 *
 * Small set of helpers to verify auth state and add debug logging around Supabase client calls.
 *
 * Usage examples:
 *  - Console-check current user id & token presence:
 *      await logAuthStatus('on-app-start')
 *
 *  - Wrap a Supabase JS client query to get detailed logs:
 *      const res = await debugWrap('user_trucks.select', () =>
 *        supabase.from('user_trucks').select('*')
 *      );
 *
 * Notes:
 *  - This file expects an existing src/lib/supabase.ts that exports a named `supabase` client.
 *  - Do not ship extended logging to production; use only for debugging.
 */

import { supabase } from './supabase';

/**
 * getAuthUserId
 *
 * Returns the currently authenticated user's id (supabase auth user id) or null.
 *
 * @returns Promise<string | null> - authenticated user id or null
 */
export async function getAuthUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/**
 * getAuthToken
 *
 * Returns the current session access token (JWT) or null if missing.
 *
 * @returns Promise<string | null> - access token or null
 */
export async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

/**
 * logAuthStatus
 *
 * Logs the presence of an authenticated user and token to the console.
 * Useful to place before making any REST/JS client requests.
 *
 * @param context - optional label to include in logs
 * @returns Promise<{ userId: string | null; tokenPresent: boolean }>
 */
export async function logAuthStatus(context?: string) {
  const userId = await getAuthUserId();
  const token = await getAuthToken();
  const tokenPresent = Boolean(token);
  console.log('[SUPABASE AUTH]', context ?? '', { userId: userId ?? undefined, token: tokenPresent ? 'present' : 'missing' });
  return { userId, tokenPresent };
}

/**
 * debugWrap
 *
 * Wraps a Supabase client call (or any async function that returns { data, error })
 * and logs the auth status and the result (data / error).
 *
 * Example:
 *   const res = await debugWrap('user_trucks.select', () =>
 *     supabase.from('user_trucks').select('*')
 *   );
 *
 * @param label - short label for the operation shown in logs
 * @param queryFn - function performing the supabase call
 * @returns Promise<any> - the original result returned by queryFn
 */
export async function debugWrap<T = any>(label: string, queryFn: () => Promise<{ data: T | null; error: any }>) {
  const auth = await logAuthStatus(label);
  try {
    const res = await queryFn();
    console.log('[SUPABASE RESULT]', label, { auth, data: res.data ?? null, error: res.error ?? null });
    return res;
  } catch (err) {
    console.error('[SUPABASE ERROR]', label, { auth, err });
    throw err;
  }
}

/**
 * restFetchWithAuth
 *
 * Helper to call Supabase REST endpoint (rest/v1/...) using fetch and attach Authorization header.
 * Logs token presence before the request and logs the response summary.
 *
 * @param url - full or relative REST path (if relative, must be full URL or handled by caller)
 * @param init - optional RequestInit passed to fetch
 * @returns Promise<Response>
 */
export async function restFetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const token = await getAuthToken();
  console.log('[SUPABASE FETCH]', { url, token: token ? 'present' : 'missing' });

  const headers: HeadersInit = {
    ...(init?.headers as HeadersInit || {}),
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...init, headers });
  // log lightweight response info
  console.log('[SUPABASE FETCH RESULT]', { url, status: res.status, ok: res.ok });
  return res;
}
