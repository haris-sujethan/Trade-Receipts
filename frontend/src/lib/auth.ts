import { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

/**
 * Accounts, through Supabase Auth. The URL and anon key are public by design (Supabase's row-level security and
 * the backend's own checks guard the data). Without them (local development) nobody needs to sign in.
 */
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = URL && ANON ? createClient(URL, ANON) : null;
export const authRequired = !!supabase;

/** The current session: undefined while it loads, null when signed out. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

/** The access token to send with API requests, if signed in. */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Whether this account has finished the IDE's tour (kept on the account, so it shows once per person). */
export function tourDoneFor(session: Session | null | undefined): boolean {
  return session?.user.user_metadata?.tour_done === true;
}

export async function markTourDoneOnAccount() {
  if (!supabase) return;
  await supabase.auth.updateUser({ data: { tour_done: true } });
}

export async function signOut() {
  await supabase?.auth.signOut();
}
