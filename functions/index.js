/**
 * Production SkyWay Token Function
 * - Supports dynamic roomName & userName
 * - Uses Firebase Secrets (SKYWAY_API_KEY, SKYWAY_SECRET)
 * - CORS restriction by environment variable ALLOWED_ORIGINS (comma separated)
 * - Minimal logging (DEBUG=1 to expand)
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { SkyWayAuthToken, uuidV4, nowInSec } = require('@skyway-sdk/token');

const SKYWAY_API_KEY = defineSecret('SKYWAY_API_KEY');   // App ID 互換として使用
const SKYWAY_SECRET = defineSecret('SKYWAY_SECRET');

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

// 環境変数 ALLOWED_ORIGINS="https://xxx.web.app,https://example.com"
function loadAllowedOrigins() {
  const env = process.env.ALLOWED_ORIGINS;
  if (!env) return DEFAULT_ALLOWED_ORIGINS;
  return env
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function buildCors(origin) {
  const allowedOrigins = loadAllowedOrigins();
  const allow = origin && allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
}

function sanitizeRoomName(nameRaw) {
  if (typeof nameRaw !== 'string') return null;
  const trimmed = nameRaw.trim();
  if (!trimmed) return null;
  // 1〜64 文字の英数字 / _ / - のみ
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeUserName(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  // 1〜32 文字の英数字 / _ / - / @ / . など許容（必要に応じ調整）
  if (!/^[A-Za-z0-9_.@-]{1,32}$/.test(t)) return null;
  return t;
}

function jsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

// 汎用エラーレスポンスヘルパ
function sendError(res, headers, status, code, detail) {
  res.set(headers).status(status).json({
    error: code,
    detail
  });
}

exports.skywayToken = onRequest({
  region: 'asia-northeast1',
  secrets: [SKYWAY_API_KEY, SKYWAY_SECRET]
}, async (req, res) => {
  const headers = buildCors(req.headers.origin);

  if (req.method === 'OPTIONS') {
    res.set(headers).status(200).send('ok');
    return;
  }
  if (req.method !== 'POST') {
    sendError(res, headers, 405, 'method_not_allowed', 'Use POST');
    return;
  }

  const debug = process.env.DEBUG === '1';

  // Secrets 読み込み（ローカル emulator で defineSecret が値を返さない場合の fallback）
  const appId = SKYWAY_API_KEY.value() || process.env.SKYWAY_API_KEY;
  const secretKey = SKYWAY_SECRET.value() || process.env.SKYWAY_SECRET;

  if (!appId || !secretKey) {
    sendError(res, headers, 500, 'missing_credentials', 'SkyWay credentials not set');
    return;
  }

  const body = jsonBody(req);

  // roomName
  let roomName = sanitizeRoomName(body.roomName);
  if (!roomName) {
    // 指定されていない / 無効 → ランダム 8文字
    roomName = 'room-' + uuidV4().slice(0, 8);
  }

  // userName (任意) - wildcard にするか個別にするか選択
  let userName = sanitizeUserName(body.userName);
  // userName 固定トークン化したいなら '*' を userName に差し替える
  const memberNameForScope = userName || '*';

  // TTL
  const now = nowInSec();
  const requestedTtl = parseInt(body.ttlSec, 10);
  let ttlSec = 3600; // デフォルト 1h
  if (!isNaN(requestedTtl)) {
    ttlSec = Math.min(Math.max(60, requestedTtl), 7200); // 1分〜2時間
  }
  const exp = now + ttlSec;

  // Scope 構築
  const scope = {
    app: {
      id: appId,
      turn: true,
      actions: ['read', 'write'],
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

  if (debug) {
    console.log('[token:issue:debug]', {
      roomName,
      userName,
      scope: JSON.stringify(scope)
    });
  } else {
    console.log('[token:issue]', {
      roomName,
      ttlSec,
      memberWildcard: memberNameForScope === '*'
    });
  }

  try {
    const token = new SkyWayAuthToken({
      jti: uuidV4(),
      iat: now,
      exp,
      scope
    }).encode(secretKey);

    res.set(headers).status(200).json({
      version: 'room-scope-v1',
      token,
      roomName,
      userName: userName || null,
      exp,
      issuedAt: now,
      ttlSec
    });
  } catch (e) {
    console.error('[token_fail]', e);
    sendError(res, headers, 500, 'token_generation_failed', e.message || 'failed');
  }
});