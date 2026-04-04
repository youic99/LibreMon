import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * ブラウザ用 Supabase クライアント（シングルトン）。
 */
let supabaseClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }

  supabaseClient = createClient(url, anon);
  return supabaseClient;
}

// メール/パスワードでサインイン
export async function signInWithEmail(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signInWithPassword({ email, password });
}

// サインアウト
export async function signOut() {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signOut();
}

// ゲスト（匿名）サインイン
export async function signInAnonymously() {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signInAnonymously();
}