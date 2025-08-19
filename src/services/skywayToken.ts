import { supabase, ensureSession } from '../lib/supabaseClient';

const functionName = import.meta.env.VITE_SKYWAY_FUNCTION_NAME || 'skyway-token';

export async function getSkyWayToken(roomName: string) {
  await ensureSession();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { roomName }
  });
  if (error) throw error;
  if (!data?.token) throw new Error('No token in response');
  return data as { token: string; userName: string };
}