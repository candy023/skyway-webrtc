import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

// SkyWay token 生成用 (ESM 変換)
import { createToken } from "https://esm.sh/@skyway-sdk/token@0.6.0?dts";
import { v4 as uuid } from "https://esm.sh/uuid@9.0.0";

const ALLOWED_ORIGINS = ["http://localhost:5173"];

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400"
  };
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // 空ボディなら許容
  }

  const roomName = typeof body?.roomName === "string" && body.roomName.length > 0
    ? body.roomName
    : "default";

  const apiKey = Deno.env.get("SKYWAY_API_KEY");
  const secret = Deno.env.get("SKYWAY_SECRET");

  if (!apiKey || !secret) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  // exp: 1時間 (必要に応じて調整)
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60;

  // ここではシンプルに roomName への入室/Publish/Subscribe を許可する広めのスコープ例
  const tokenObj = await createToken({
    apiKey,
    secret,
    exp,
    scope: {
      app: {
        // id は createToken 内部で apiKey から解決される実装の想定
        turn: true,
        actions: ["read"],
        channels: [{
          name: roomName,
          actions: ["write"],
          members: [{
            // 任意 (ワイルドカード)
            name: "*",
            actions: ["write"],
            publication: { actions: ["write"] },
            subscription: { actions: ["write"] }
          }]
        }]
      }
    }
  });

  const tokenString = JSON.stringify(tokenObj); // SkyWayContext.Create は JSON 文字列 (SDK 仕様に合わせる)

  return new Response(JSON.stringify({
    token: tokenString,
    roomName,
    exp,
    issuedAt: now,
    requestId: uuid()
  }), {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" }
  });
});