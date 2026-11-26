// Test local, fără conturi reale: node test.mjs
// Baza D1 e imitată cu SQLite din Node; e-mailul și ElevenLabs sunt imitate.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import worker from './worker.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const D1 = { prepare: sql => { const st = db.prepare(sql); let args = []; const o = {
  bind: (...a) => { args = a; return o; },
  first: async () => st.get(...args) ?? null,
  run: async () => { const r = st.run(...args); return { meta: { changes: Number(r.changes) } }; } }; return o; } };
const env = { DB: D1, API_URL: 'https://api.test', ALLOWED_ORIGINS: 'https://app.test', MAIL_FROM: 'x@test', RESEND_API_KEY: 'r', ELEVENLABS_API_KEY: 'e', LS_SIGNING_SECRET: 'sek',
  LS_CHECKOUT_CREATOR: 'https://shop.test/buy/c', LS_CHECKOUT_PRO: 'https://shop.test/buy/p', LS_CHECKOUT_PACK: 'https://shop.test/buy/k' };
let mail = null, elFail = false, elBody = null;
globalThis.fetch = async (u, o) => {
  if (String(u).includes('resend')) { mail = JSON.parse(o.body); return new Response('{}', { status: 200 }); }
  if (String(u).includes('elevenlabs')) { elBody = JSON.parse(o.body); return elFail ? new Response(JSON.stringify({ detail: { message: 'quota' } }), { status: 429 }) : new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } }); }
  throw new Error('neașteptat ' + u);
};
const call = (path, opt = {}) => worker.fetch(new Request('https://api.test' + path, { ...opt, headers: { origin: 'https://app.test', 'content-type': 'application/json', ...(opt.headers || {}) } }), env);

let r = await call('/auth/start', { method: 'POST', body: JSON.stringify({ email: 'Ana@Test.ro', app: 'https://evil.test/' }) });
assert.equal(r.status, 400, 'refuză aplicații străine');
r = await call('/auth/start', { method: 'POST', body: JSON.stringify({ email: 'Ana@Test.ro', app: 'https://app.test/muzica/' }) });
assert.equal(r.status, 200); assert.equal(r.headers.get('access-control-allow-origin'), 'https://app.test');
const link = mail.html.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');
r = await worker.fetch(new Request(link), env);
assert.equal(r.status, 302); const tok = new URL(r.headers.get('location')).searchParams.get('cm_token'); assert.ok(tok);
r = await worker.fetch(new Request(link), env); assert.equal(r.status, 400, 'linkul merge o singură dată');
const auth = { authorization: 'Bearer ' + tok };
let me = await (await call('/me', { headers: auth })).json();
assert.deepEqual(me, { email: 'ana@test.ro', plan: 'free', credits: 3 });
assert.equal((await call('/me', { headers: { authorization: 'Bearer gresit' } })).status, 401);

// generare: 2 minute = 2 credite
r = await call('/generate', { method: 'POST', headers: auth, body: JSON.stringify({ prompt: 'calm piano', seconds: 120 }) });
assert.equal(r.status, 200); assert.equal(r.headers.get('x-credits'), '1'); assert.equal(elBody.music_length_ms, 120000); assert.match(elBody.prompt, /Instrumental only/);
r = await call('/generate', { method: 'POST', headers: auth, body: JSON.stringify({ prompt: 'x', seconds: 120 }) });
assert.equal(r.status, 402, 'fără credite suficiente');
r = await call('/generate', { method: 'POST', headers: auth, body: JSON.stringify({ prompt: 'x', seconds: 600 }) });
assert.equal(r.status, 400, 'gratuit: max 4 min');
// eșec la furnizor: creditul se întoarce
elFail = true;
r = await call('/generate', { method: 'POST', headers: auth, body: JSON.stringify({ prompt: 'x', lyrics: 'la la', seconds: 60 }) });
assert.equal(r.status, 502); assert.equal((await (await call('/me', { headers: auth })).json()).credits, 1); elFail = false;

// checkout
const { url } = await (await call('/checkout', { method: 'POST', headers: auth, body: JSON.stringify({ plan: 'creator' }) })).json();
const cu = new URL(url); assert.equal(cu.searchParams.get('checkout[custom][plan]'), 'creator'); const uid = cu.searchParams.get('checkout[custom][user_id]');

// webhook semnat
const hook = async (obj, sig) => { const body = JSON.stringify(obj); return worker.fetch(new Request('https://api.test/webhook/lemonsqueezy', { method: 'POST', body, headers: { 'x-signature': sig ?? createHmac('sha256', 'sek').update(body).digest('hex') } }), env); };
assert.equal((await hook({ meta: { event_name: 'order_created', custom_data: { user_id: uid, plan: 'pack' } }, data: { id: 9, attributes: { status: 'paid' } } }, 'bad')).status, 401);
await hook({ meta: { event_name: 'subscription_created', custom_data: { user_id: uid, plan: 'creator' } }, data: { id: 77, attributes: {} } });
await hook({ meta: { event_name: 'subscription_payment_success', custom_data: { user_id: uid, plan: 'creator' } }, data: { id: 501, attributes: {} } });
await hook({ meta: { event_name: 'subscription_payment_success', custom_data: { user_id: uid, plan: 'creator' } }, data: { id: 501, attributes: {} } }); // dublură
me = await (await call('/me', { headers: auth })).json(); assert.equal(me.plan, 'creator'); assert.equal(me.credits, 41);
await hook({ meta: { event_name: 'order_created', custom_data: { user_id: uid, plan: 'pack' } }, data: { id: 9, attributes: { status: 'paid' } } });
assert.equal((await (await call('/me', { headers: auth })).json()).credits, 66);
await hook({ meta: { event_name: 'subscription_expired', custom_data: { user_id: uid, plan: 'creator' } }, data: { id: 77, attributes: {} } });
assert.equal((await (await call('/me', { headers: auth })).json()).plan, 'free');
console.log('Toate testele serverului au trecut.');
