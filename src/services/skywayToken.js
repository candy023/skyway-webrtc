export async function getSkyWayToken(roomName, userName) {
  const res = await fetch(import.meta.env.VITE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ roomName, userName })
  });
  if (!res.ok) {
    let text;
    try { text = await res.text(); } catch { text = res.statusText; }
    throw new Error('Token fetch failed: ' + text);
  }
  return res.json(); // { token, roomName, userName, exp ... }
}