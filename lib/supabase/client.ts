import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * ブラウザ用 Supabase クライアント（将来の認証・リアルタイム等に利用）。
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }

  return createClient(url, anon);
}
