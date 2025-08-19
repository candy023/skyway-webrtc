const LOCAL = import.meta.env.DEV;
const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID; // .env に書いておく
const REGION = 'asia-northeast1';

// ローカルエミュレータ用 URL
function getEndpoint() {
  if (LOCAL) {
    return `http://127.0.0.1:5001/${PROJECT_ID}/${REGION}/skywayToken`;
  }
  // デプロイ後に本番 URL を .env に用意
  return import.meta.env.VITE_SKYWAY_TOKEN_ENDPOINT;
}

export async function getSkyWayToken(roomName) {
  const res = await fetch(getEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`skywayToken HTTP ${res.status}: ${t}`);
  }
  const json = await res.json();
  if (!json.token) throw new Error('token missing');
  console.log('[skywayToken] len=', json.token.length);
  return json;
}