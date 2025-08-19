// Edge Function: SkyWay トークン発行 (verify_jwt = true 前提)
// リクエスト: POST { roomName: string }
// レスポンス: { token: string, userName: string }

import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

const SKYWAY_API_KEY = Deno.env.get('SKYWAY_API_KEY');
const SKYWAY_SECRET  = Deno.env.get('SKYWAY_SECRET');
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON  = Deno.env.get('SUPABASE_ANON_KEY');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type,authorization',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type,authorization',
      }
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  if (!SKYWAY_API_KEY || !SKYWAY_SECRET) {
    return json({ error: 'Missing SkyWay secrets' }, 500);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return json({ error: 'Missing Supabase env' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'No Authorization header' }, 401);
  }

  // 認証中ユーザ取得
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return json({ error: 'Invalid user' }, 401);
  }

  // Body
  const { roomName } = await req.json().catch(() => ({ roomName: '' }));
  const safeRoom = (typeof roomName === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(roomName))
    ? roomName
    : '*';

  // userName の決定（表示名 → email → id 先頭8文字）
  const userName =
    (user.user_metadata?.display_name?.trim()) ||
    user.email ||
    user.id.slice(0, 8);

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 20; // 20分 (短め推奨)

  const payload = {
    jti: `${now}-${crypto.randomUUID()}`,
    iat: now,
    exp,
    scope: {
      app: {
        id: SKYWAY_API_KEY,
        turn: true,
        actions: ['read'],
        channels: [
          {
            id: '*',
            name: safeRoom,
            actions: ['write'],
            members: [
              {
                id: '*',
                name: userName,
                actions: ['write'],
                publication: { actions: ['write'] },
                subscription: { actions: ['write'] }
              }
            ],
            sfuBots: [{ actions: ['write'] }]
          }
        ]
      }
    }
  };

  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(SKYWAY_SECRET));

  return json({ token, userName });
});