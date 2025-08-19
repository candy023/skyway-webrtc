import { supabase, ensureSession } from '../lib/supabaseClient.js';

export async function getSkyWayToken(roomName) {
  await ensureSession(); // ここで anonymous token リクエスト
  const fn = import.meta.env.VITE_SKYWAY_FUNCTION_NAME || 'skyway-token';
  const { data, error } = await supabase.functions.invoke(fn, {
    body: { roomName }
  });
  if (error) throw error;
  return data; // { token, userName }
}