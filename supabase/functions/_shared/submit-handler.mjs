import { validateRequest } from './validate-request.mjs';

export const MAX_BODY_BYTES = 24 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function parseOrigins(value) {
  const origins = (value || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!origins.length) throw new Error('Missing origin allowlist');
  for (const origin of origins) {
    const url = new URL(origin);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.origin !== origin || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
      throw new Error('Origins must be exact HTTPS origins (HTTP only for loopback)');
    }
  }
  return new Set(origins);
}

export function canonicalIp(value) {
  if (!value || value.length > 64 || value.includes('%')) throw new Error('Missing or invalid client IP');
  if (/^\d+\.\d+\.\d+\.\d+$/u.test(value)) {
    if (value.split('.').every((part) => /^(0|[1-9]\d{0,2})$/u.test(part) && Number(part) <= 255)) return value;
  } else if (/^[0-9a-f:.]+$/iu.test(value) && value.includes(':')) {
    const hostname = new URL(`http://[${value}]/`).hostname.slice(1, -1).toLowerCase();
    // IPv4-mapped IPv6 should share the native IPv4 quota.
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(hostname);
    if (mapped) {
      const first = parseInt(mapped[1], 16), last = parseInt(mapped[2], 16);
      return `${first >> 8}.${first & 255}.${last >> 8}.${last & 255}`;
    }
    return hostname;
  }
  throw new Error('Missing or invalid client IP');
}

export function clientIp(headers, trustedProxyHops) {
  // Trust only the configured, verified suffix, never the caller-controlled first entry.
  const forwarded = headers.get('x-forwarded-for');
  if (!forwarded || forwarded.length > 2048) throw new Error('Missing client IP');
  const chain = forwarded.split(',').map((item) => item.trim());
  if (chain.length < trustedProxyHops) throw new Error('Incomplete proxy chain');
  return canonicalIp(chain[chain.length - trustedProxyHops]);
}

export async function hashIp(ip, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`submit-request:v1:${ip}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readJson(request) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > MAX_BODY_BYTES)) {
    throw Object.assign(new Error('Request too large'), { status: 413 });
  }
  if (!request.body) throw Object.assign(new Error('Missing JSON'), { status: 400 });
  const reader = request.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw Object.assign(new Error('Request too large'), { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
}

export function createSubmitHandler(config, fetchImpl = fetch) {
  let allowedOrigins;
  let configured = false;
  try {
    allowedOrigins = parseOrigins(config.allowedOrigins);
    const url = new URL(config.supabaseUrl);
    const local = ['localhost', '127.0.0.1', 'kong'].includes(url.hostname);
    configured = (url.protocol === 'https:' || (local && url.protocol === 'http:')) &&
      !!config.serviceRoleKey && (config.ipHashSecret || '').length >= 32 &&
      Number.isInteger(config.trustedProxyHops) && config.trustedProxyHops >= 1 && config.trustedProxyHops <= 10;
  } catch { /* Missing configuration fails closed below. */ }

  return async function submitRequest(request) {
    const origin = request.headers.get('origin');
    const allowed = !!origin && !!allowedOrigins?.has(origin);
    const cors = allowed ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
      'Access-Control-Max-Age': '600',
    } : {};
    const respond = (status, body, extra = {}) => new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff', ...extra },
    });
    if (!configured) return respond(503, { ok: false, error: 'Submission service is unavailable.' });
    if (!allowed) return respond(403, { ok: false, error: 'Origin is not allowed.' });
    if (request.method === 'OPTIONS') {
      const method = request.headers.get('access-control-request-method');
      const headers = (request.headers.get('access-control-request-headers') || '').toLowerCase().split(',').map((header) => header.trim()).filter(Boolean);
      if (method !== 'POST' || headers.some((header) => !['content-type', 'apikey', 'authorization', 'x-client-info'].includes(header))) {
        return respond(403, { ok: false, error: 'Preflight is not allowed.' });
      }
      return respond(204, null);
    }
    if (request.method !== 'POST') return respond(405, { ok: false, error: 'Use POST.' }, { Allow: 'POST, OPTIONS' });
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return respond(415, { ok: false, error: 'Use application/json.' });
    }
    let input;
    try { input = await readJson(request); }
    catch (error) { return respond(error.status === 413 ? 413 : 400, { ok: false, error: error.status === 413 ? 'Request is too large.' : 'Invalid JSON request.' }); }
    const result = validateRequest(input);
    if (!result.ok) return respond(422, { ok: false, error: 'Please check the form.', fields: result.errors });
    try {
      const ipHash = await hashIp(clientIp(request.headers, config.trustedProxyHops), config.ipHashSecret);
      const response = await fetchImpl(`${config.supabaseUrl.replace(/\/$/u, '')}/rest/v1/rpc/submit_inbound_request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        body: JSON.stringify({ p_payload: result.data, p_ip_hash: ipHash }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Database did not confirm save');
      const saved = await response.json();
      if (saved?.saved === false && Number.isInteger(saved.retry_after) && saved.retry_after >= 1 && saved.retry_after <= 86400) {
        return respond(429, { ok: false, error: 'Too many requests. Please try again later.' }, { 'Retry-After': String(saved.retry_after) });
      }
      if (saved?.saved !== true || !UUID.test(saved.request_id)) throw new Error('Database did not confirm save');
      return respond(201, { ok: true, requestId: saved.request_id });
    } catch {
      // Never log the payload, IP, email, database response, or credentials.
      return respond(503, { ok: false, error: 'We could not confirm your submission. Please try again later.' });
    }
  };
}
