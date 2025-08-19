import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anon);

// 匿名セッションを必ず確保
export async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  // Anonymous Provider をダッシュボードで ON にしておく
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}