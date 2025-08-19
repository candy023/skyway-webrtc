import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const ALLOWED_ORIGINS = ["http://localhost:5173"];
function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers });
  return new Response(JSON.stringify({ status: "ok", dummy: true }), {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" }
  });
});