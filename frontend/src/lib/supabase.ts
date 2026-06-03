// Client Supabase (auth uniquement) — Showroom IA.
// Si NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ne sont pas définis, l'auth est DÉSACTIVÉE
// (mode dev local) — cohérent avec le backend (SUPABASE_JWT_SECRET vide).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const authEnabled = Boolean(url && anon);

export const supabase: SupabaseClient | null = authEnabled
  ? createClient(url as string, anon as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

// Jeton d'accès courant (à injecter dans l'en-tête Authorization des appels API).
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export type OAuthProvider = "google" | "apple";

export async function signInWith(provider: OAuthProvider): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
