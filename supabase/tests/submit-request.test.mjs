import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, LIMITS, SERVICE_OPTIONS } from '../functions/_shared/validate-request.mjs';
import { createSubmitHandler, canonicalIp, clientIp, hashIp, parseOrigins, MAX_BODY_BYTES } from '../functions/_shared/submit-handler.mjs';

const contact = { kind: 'contact', name: 'Test Person', email: 'test@example.org', message: 'Please contact me.' };
const assessment = {
  kind: 'assessment', organization: 'Test Organization', name: 'Test Person', role: 'Director',
  email: 'test@example.org', phone: '+1 (845) 555-0100', organizationType: 'Nonprofit',
  town: 'Newburgh', staff: '1-5', itSupport: 'Not sure', services: ['Cybersecurity'],
  message: '', reachBy: 'Email', consent: true, region: 'Newburgh', website: '',
};
const requestId = '706d718c-3992-41eb-8852-097936092c55';
const config = {
  supabaseUrl: 'https://example.supabase.co', serviceRoleKey: 'test-server-only-key',
  allowedOrigins: 'https://clinic.example.org,http://localhost:4321', ipHashSecret: 'test-only-not-a-real-secret-1234567890',
  trustedProxyHops: 1,
};
function request(payload = contact, options = {}) {
  return new Request('https://example.supabase.co/functions/v1/submit-request', {
    method: 'POST', body: JSON.stringify(payload), ...options,
    headers: { origin: 'https://clinic.example.org', 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.1', ...options.headers },
  });
}
function harness(result = { saved: true, request_id: requestId }, status = 200, overrides = {}) {
  const calls = [];
  const handler = createSubmitHandler({ ...config, ...overrides }, async (...args) => {
    calls.push(args);
    return Response.json(result, { status });
  });
  return { handler, calls };
}

test('assessment normalizes strings, permits every catalog area, drops honeypot', () => {
  const result = validateRequest({ ...assessment, name: ' Test Person ', services: [...SERVICE_OPTIONS,].slice(0, 6) });
  assert.equal(result.ok, true);
  assert.equal(result.data.name, 'Test Person');
  assert.equal(result.data.region, 'Newburgh');
  assert.equal('website' in result.data, false);
});
test('contact requires only name, email, message and defaults consent to false', () => {
  const result = validateRequest(contact);
  assert.equal(result.ok, true);
  assert.equal(result.data.consent, false);
  assert.equal(result.data.reachBy, 'Email');
  for (const key of ['name', 'email', 'message']) {
    assert.equal(validateRequest({ ...contact, [key]: '' }).ok, false, key);
  }
});
test('assessment requires organization, town, real boolean consent and phone for calls', () => {
  for (const key of ['organization', 'name', 'email', 'town']) assert.equal(validateRequest({ ...assessment, [key]: ' ' }).ok, false, key);
  for (const consent of [undefined, false, 'true', 1, null]) assert.equal(validateRequest({ ...assessment, consent }).ok, false);
  assert.equal(validateRequest({ ...assessment, reachBy: 'Phone', phone: '' }).ok, false);
  assert.equal(validateRequest({ ...assessment, reachBy: 'Phone' }).ok, true);
});
test('rejects invalid JSON shapes, unknown fields and invalid enums', () => {
  for (const input of [null, [], 'text', 3]) assert.equal(validateRequest(input).ok, false);
  for (const key of ['id', 'source', 'inserted_at', 'inserted_by', '__proto__']) {
    assert.equal(validateRequest({ ...contact, [key]: 'spoof' }).ok, false, key);
  }
  for (const key of ['kind', 'organizationType', 'staff', 'itSupport', 'reachBy']) {
    assert.equal(validateRequest({ ...assessment, [key]: 'invalid' }).ok, false, key);
  }
  for (const services of ['Cybersecurity', [null], ['unknown'], Array(7).fill('Technology')]) {
    assert.equal(validateRequest({ ...assessment, services }).ok, false);
  }
});
test('enforces text types and all length bounds before trimming', () => {
  for (const [key, max] of Object.entries(LIMITS)) {
    assert.equal(validateRequest({ ...assessment, [key]: ' '.repeat(max + 1) }).ok, false, key);
    assert.equal(validateRequest({ ...assessment, [key]: 5 }).ok, false, key);
  }
  assert.equal(validateRequest({ ...assessment, message: 'x'.repeat(5000) }).ok, true);
  assert.equal(validateRequest({ ...assessment, message: '\u0000' }).ok, false);
  assert.equal(validateRequest({ ...assessment, message: 'first\nsecond' }).ok, true);
});
test('rejects email injection, malformed email and phone; rejects any populated honeypot', () => {
  for (const email of ['a', 'a@b', 'a@@b.com', 'a b@example.org', 'a@example.org\nBcc: bad@example.org']) {
    assert.equal(validateRequest({ ...contact, email }).ok, false, email);
  }
  assert.equal(validateRequest({ ...contact, email: 'first+clinic@example.org' }).ok, true);
  for (const website of ['spam', ' ', '\n', null]) assert.equal(validateRequest({ ...contact, website }).ok, false);
  for (const phone of ['abc', '123', '<script>']) assert.equal(validateRequest({ ...assessment, phone }).ok, false);
});
test('origin configuration requires exact origins', () => {
  assert.equal(parseOrigins(config.allowedOrigins).size, 2);
  for (const origin of ['', '*', 'null', 'http://example.org', 'https://example.org/', 'https://example.org/path', 'https://user:pass@example.org']) {
    assert.throws(() => parseOrigins(origin), undefined, origin);
  }
});
test('canonical IP and proxy suffix selection ignore forged leading entries', () => {
  assert.equal(canonicalIp('2001:0db8:0:0:0:0:0:1'), '2001:db8::1');
  assert.equal(canonicalIp('::ffff:192.0.2.1'), '192.0.2.1');
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': 'forged, 192.0.2.1' }), 1), '192.0.2.1');
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': 'forged, 192.0.2.1, 192.0.2.2' }), 2), '192.0.2.1');
  for (const ip of ['nope', '256.0.0.1', '001.0.0.1', 'fe80::1%eth0', '127.0.0.1:8080']) assert.throws(() => canonicalIp(ip));
  assert.throws(() => clientIp(new Headers(), 1));
});
test('IP digests are stable, keyed and do not contain IPs', async () => {
  const digest = await hashIp('192.0.2.1', config.ipHashSecret);
  assert.match(digest, /^[a-f0-9]{64}$/u);
  assert.equal(digest, await hashIp('192.0.2.1', config.ipHashSecret));
  assert.notEqual(digest, await hashIp('192.0.2.1', 'a different secret'));
});
test('successful insert uses service role only upstream and returns database UUID', async () => {
  const { handler, calls } = harness();
  const response = await handler(request(assessment));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, requestId });
  assert.equal(calls.length, 1);
  const [url, init] = calls[0];
  assert.equal(url, 'https://example.supabase.co/rest/v1/rpc/submit_inbound_request');
  assert.equal(init.headers.Authorization, `Bearer ${config.serviceRoleKey}`);
  const body = JSON.parse(init.body);
  assert.match(body.p_ip_hash, /^[a-f0-9]{64}$/u);
  assert.equal('website' in body.p_payload, false);
  assert.equal(init.body.includes('192.0.2.1'), false);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://clinic.example.org');
});
test('preflight supports publishable key without touching the database', async () => {
  const { handler, calls } = harness();
  const response = await handler(request(contact, {
    method: 'OPTIONS', body: undefined,
    headers: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, apikey' },
  }));
  assert.equal(response.status, 204);
  assert.equal(calls.length, 0);
});
test('rejects disallowed origins, method, content type and validation without a database call', async () => {
  const { handler, calls } = harness();
  for (const origin of ['https://evil.example.org', 'https://clinic.example.org.evil.org', 'null', '']) {
    const response = await handler(request(contact, { headers: { origin } }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.has('access-control-allow-origin'), false);
  }
  assert.equal((await handler(request(contact, { method: 'GET', body: undefined }))).status, 405);
  assert.equal((await handler(request(contact, { headers: { 'content-type': 'text/plain' } }))).status, 415);
  assert.equal((await handler(request({ ...contact, website: 'spam' }))).status, 422);
  assert.equal((await handler(request(contact, { body: '{' }))).status, 400);
  assert.equal(calls.length, 0);
});
test('enforces streamed byte limit with and without content-length', async () => {
  const { handler, calls } = harness();
  assert.equal((await handler(request(contact, { headers: { 'content-length': String(MAX_BODY_BYTES + 1) } }))).status, 413);
  assert.equal((await handler(request(contact, { body: 'x'.repeat(MAX_BODY_BYTES + 1) }))).status, 413);
  assert.equal(calls.length, 0);
});
test('rate limit returns retry-after and never success', async () => {
  const { handler } = harness({ saved: false, retry_after: 321 });
  const response = await handler(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '321');
  assert.equal((await response.json()).ok, false);
});
test('fails closed for absent settings and missing client IP', async () => {
  for (const overrides of [{ serviceRoleKey: '' }, { ipHashSecret: 'short' }, { trustedProxyHops: 0 }, { allowedOrigins: '' }]) {
    const { handler, calls } = harness(undefined, 200, overrides);
    assert.equal((await handler(request())).status, 503);
    assert.equal(calls.length, 0);
  }
  const { handler, calls } = harness();
  assert.equal((await handler(request(contact, { headers: { 'x-forwarded-for': '' } }))).status, 503);
  assert.equal(calls.length, 0);
});
test('upstream failure, malformed confirmation and exceptions never report success', async () => {
  for (const [body, status] of [[{ detail: 'secret database error' }, 500], [{}, 200], [{ saved: true }, 200], [{ saved: true, request_id: 'bad' }, 200], [{ saved: false, retry_after: -1 }, 200]]) {
    const { handler } = harness(body, status);
    const response = await handler(request());
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes('secret database error'), false);
  }
  const handler = createSubmitHandler(config, async () => { throw new Error('network error'); });
  assert.equal((await handler(request())).status, 503);
});
