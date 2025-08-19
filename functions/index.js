// CommonJS
const { onRequest } = require('firebase-functions/v2/https');
const { SkyWayAuthToken, uuidV4, nowInSec } = require('@skyway-sdk/token');

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

function cors(origin) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
}

function mask(s) {
  if (!s) return s;
  if (s.length <= 8) return s;
  return s.slice(0,4) + '...' + s.slice(-4);
}

exports.skywayToken = onRequest({ region: 'asia-northeast1' }, async (req, res) => {
  const headers = cors(req.headers.origin);

  if (req.method === 'OPTIONS') {
    res.set(headers).status(200).send('ok');
    return;
  }
  if (req.method !== 'POST') {
    res.set(headers).status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // A案: 既存の環境変数名を App ID / SecretKey として利用
  const appId = process.env.SKYWAY_API_KEY;
  const secretKey = process.env.SKYWAY_SECRET;

  console.log('[envCheck]', {
    SKYWAY_API_KEY: mask(process.env.SKYWAY_API_KEY),
    SKYWAY_SECRET: mask(process.env.SKYWAY_SECRET),
    interpreted_appId: mask(appId),
    interpreted_secretKey: mask(secretKey)
  });

  if (!appId || !secretKey) {
    console.error('[error] missing credentials');
    res.set(headers).status(500).json({ error: 'missing_credentials' });
    return;
  }

  const now = nowInSec();
  const exp = now + 60 * 60; // 1h

  // 最小スコープ: まずここが通るかだけ確認
  const scope = {
    app: {
      id: appId,
      actions: ['read', 'write'] // publish も想定して早めに write 追加
    }
  };

  console.log('[debug] build token', {
    appIdLen: appId.length,
    secretKeyLen: secretKey.length,
    now,
    exp,
    scope
  });

  try {
    const token = new SkyWayAuthToken({
      jti: uuidV4(),
      iat: now,
      exp,
      scope
    }).encode(secretKey);

    console.log('[debug] token created', { tokenLen: token.length });

    res.set(headers).status(200).json({
      version: 'minimal-scope-v1',
      token,
      exp,
      issuedAt: now
    });
  } catch (e) {
    console.error('[token_fail]', e);
    res.set(headers).status(500).json({
      error: 'token_generation_failed',
      detail: e.message
    });
  }
});