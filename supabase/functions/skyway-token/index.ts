// Supabase Edge Function: SkyWay トークン発行
// デプロイ後 URL: https://<project-ref>.functions.supabase.co/skyway-token
//
// リクエスト: POST JSON { roomName: string, userName: string }
// レスポンス: { token: string }

import { SignJWT } from 'jose';

// 環境変数取得
const SKYWAY_API_KEY = Deno.env.get('SKYWAY_API_KEY');
const SKYWAY_SECRET = Deno.env.get('SKYWAY_SECRET');

if (!SKYWAY_API_KEY || !SKYWAY_SECRET) {
  console.error('Missing SKYWAY_API_KEY or SKYWAY_SECRET');
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // CORS（必要に応じて特定オリジンに絞る）
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const { roomName, userName } = await req.json().catch(() => ({}));

    const safeRoom = typeof roomName === 'string' && roomName.trim() !== '' ? roomName.trim() : '*';
    const safeUser = typeof userName === 'string' && userName.trim() !== '' ? userName.trim() : '*';

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 30; // 30分有効（学習用、必要に応じ短く）

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
                  name: safeUser,
                  actions: ['write'],
                  publication: { actions: ['write'] },
                  subscription: { actions: ['write'] },
                },
              ],
              sfuBots: [{ actions: ['write'] }],
            },
          ],
        },
      },
    };

    const secretKey = new TextEncoder().encode(SKYWAY_SECRET);

    const token = await new SignJWT(payload as any)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(secretKey);

    return jsonResponse({ token });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: 'failed to generate token' }, 500);
  }
});