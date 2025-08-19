import { createClient } from '@supabase/supabase-js';

// .env.local に設定
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 早期バリデーション (デバッグ用。不要なら削除可)
if (!supabaseUrl) console.warn('VITE_SUPABASE_URL が未定義です');
if (!supabaseAnonKey) console.warn('VITE_SUPABASE_ANON_KEY が未定義です');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function ensureSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) {
    const { error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError) throw anonError;
  }
}