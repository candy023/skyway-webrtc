import { SkyWayAuthToken } from '@skyway-sdk/token';
import { uuidV4, nowInSec } from '@skyway-sdk/room';

function sanitizeRoomName(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(t)) return null;
  return t;
}

function sanitizeUserName(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!/^[A-Za-z0-9_.@-]{1,32}$/.test(t)) return null;
  return t;
}

export default async function handler(req, res) {
  const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const appId = process.env.SKYWAY_API_KEY;
  const secretKey = process.env.SKYWAY_SECRET;
  if (!appId || !secretKey) {
    return res.status(500).json({ error: 'missing_credentials' });
  }

  let body = {};
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  } catch {}

  let roomName = sanitizeRoomName(body.roomName) || ('room-' + uuidV4().slice(0, 8));
  const userName = sanitizeUserName(body.userName);
  const memberNameForScope = userName || '*';

  const now = nowInSec();
  const ttlSec = 3600;        // 必要に応じて短く (例: 900) 調整
  const exp = now + ttlSec;

  const scope = {
    app: {
      id: appId,
      turn: true,
      actions: ['read','write'],
      channels: [{
        name: roomName,
        actions: ['write'],
        members: [{
          name: memberNameForScope,
          actions: ['write'],
          publications: ['write'],
          subscriptions: ['write']
        }]
      }]
    }
  };

  try {
    const token = new SkyWayAuthToken({
      jti: uuidV4(),
      iat: now,
      exp,
      scope
    }).encode(secretKey);

    return res.json({
      version: 'room-scope-v1',
      token,
      roomName,
      userName: userName || null,
      exp,
      issuedAt: now,
      ttlSec
    });
  } catch (e) {
    console.error('[token_generation_failed]', e);
    return res.status(500).json({ error: 'token_generation_failed', detail: e.message });
  }
}