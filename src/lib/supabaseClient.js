import { createClient } from '@supabase/supabase-js';

// .env.local に設定されていること:
// VITE_SUPABASE_URL
// VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 早期バリデーション (任意)
if (!supabaseUrl) console.warn('VITE_SUPABASE_URL が未定義です');
if (!supabaseAnonKey) console.warn('VITE_SUPABASE_ANON_KEY が未定義です');

// クライアント生成
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 匿名セッションを必ず確立して返す。
 * 既にセッションがあればそれを返す。
 * 失敗時は例外 throw。
 */
export async function ensureSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (session) return session;

  const { data, error: anonError } = await supabase.auth.signInAnonymously();
  if (anonError) throw anonError;
  return data.session;
}

/**
 * アクセストークン（JWT文字列）を取得。
 * 内部で ensureSession を呼ぶ。
 */
export async function getAccessToken() {
  const session = await ensureSession();
  return session.access_token;
}

/**
 * デバッグ用: 現在のセッションをコンソールに出力
 */
export async function logCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log('[supabase] current session:', session, 'error:', error);
}

/**
 * 認証状態変更の簡易ログ (必要なら main.js で import して呼ぶ)
 */
export function setupAuthDebugListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[supabase] auth state changed:', event, 'session?', !!session);
  });
}