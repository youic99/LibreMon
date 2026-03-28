import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Route Handlers / Server Actions 用。SERVICE_ROLE があればそれを優先（RLS をバイパス）。
 * 無い場合は anon（クライアントと同じキー）— その場合は ribremons への INSERT を RLS で許可する必要があります。
 */
export function createSupabaseServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }

  const key = serviceRole ?? anon;
  if (!key) {
    throw new Error("Set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
