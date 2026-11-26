/* Cadru Muzică: server pentru Studio AI cu abonament.
   Cloudflare Worker + baza de date D1. Ține conturile (intrare cu link pe e-mail),
   creditele, plățile (Lemon Squeezy) și cheia secretă a furnizorului AI (ElevenLabs Music).
   Cheile nu ajung niciodată în browser. Pașii de pornire sunt în README.md. */

export const PLANS = {
  free:    { credits: 3,   maxSec: 240, monthly: true },
  creator: { credits: 40,  maxSec: 240 },
  pro:     { credits: 120, maxSec: 600 },
};
export const PACK_CREDITS = 25;
const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
const rid = (n = 32) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const okEmail = e => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function cors(req, env) {
  const o = req.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = { 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-expose-headers': 'x-credits', vary: 'origin' };
  if (allowed.includes(o)) h['access-control-allow-origin'] = o;
  return h;
}
const json = (data, status, h) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...h } });

async function userFromAuth(req, env) {
  const a = req.headers.get('authorization') || '';
  if (!a.startsWith('Bearer ')) return null;
  const t = await env.DB.prepare("SELECT user_id FROM tokens WHERE hash=? AND kind='session' AND exp>?").bind(await sha(a.slice(7)), now()).first();
  if (!t) return null;
  return refill(env, await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(t.user_id).first());
}
// planul gratuit primește din nou creditele în fiecare lună (fără să se adune)
async function refill(env, u) {
  if (!u) return null;
  if (u.plan === 'free' && now() >= u.refill_at) {
    const c = Math.max(u.credits, PLANS.free.credits);
    await env.DB.prepare('UPDATE users SET credits=?, refill_at=? WHERE id=?').bind(c, now() + 30 * DAY, u.id).run();
    u.credits = c; u.refill_at = now() + 30 * DAY;
  }
  return u;
}
function appAllowed(env, app) {
  try { const u = new URL(app); return (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(u.origin); } catch { return false; }
}
function safeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function hmacHex(secret, body) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, body))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(req, env) {
    const H = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
    const url = new URL(req.url); const p = url.pathname;
    try {
      /* ---------- intrare cu link pe e-mail ---------- */
      if (p === '/auth/start' && req.method === 'POST') {
        const { email, app } = await req.json();
        const em = String(email || '').trim().toLowerCase();
        if (!okEmail(em)) return json({ error: 'Adresă de e-mail invalidă.' }, 400, H);
        if (!appAllowed(env, app)) return json({ error: 'Aplicație necunoscută.' }, 400, H);
        let u = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(em).first();
        if (!u) {
          u = { id: rid(12), email: em };
          await env.DB.prepare("INSERT INTO users(id,email,plan,credits,refill_at,created_at) VALUES(?,?,'free',?,?,?)").bind(u.id, em, PLANS.free.credits, now() + 30 * DAY, now()).run();
        }
        const t = rid();
        await env.DB.prepare("INSERT INTO tokens(hash,user_id,kind,exp) VALUES(?,?,'login',?)").bind(await sha(t), u.id, now() + 20 * 60).run();
        const link = `${env.API_URL}/auth/verify?t=${t}&app=${encodeURIComponent(app)}`;
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: env.MAIL_FROM, to: em, subject: 'Intră în Cadru Muzică',
            html: `<p>Apasă pe link ca să intri în Cadru Muzică (valabil 20 de minute):</p><p><a href="${link}">Intră în cont</a></p><p>Dacă nu ai cerut tu acest e-mail, ignoră-l.</p>` }),
        });
        if (!r.ok) return json({ error: 'Nu am putut trimite e-mailul. Încearcă din nou.' }, 502, H);
        return json({ ok: true }, 200, H);
      }
      if (p === '/auth/verify' && req.method === 'GET') {
        const t = url.searchParams.get('t') || '', app = url.searchParams.get('app') || '';
        if (!appAllowed(env, app)) return new Response('Link invalid.', { status: 400 });
        const h = await sha(t);
        const row = await env.DB.prepare("SELECT user_id FROM tokens WHERE hash=? AND kind='login' AND exp>?").bind(h, now()).first();
        if (!row) return new Response('Linkul a expirat. Cere altul din aplicație.', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
        await env.DB.prepare('DELETE FROM tokens WHERE hash=?').bind(h).run();
        const s = rid();
        await env.DB.prepare("INSERT INTO tokens(hash,user_id,kind,exp) VALUES(?,?,'session',?)").bind(await sha(s), row.user_id, now() + 60 * DAY).run();
        const to = new URL(app); to.searchParams.set('cm_token', s);
        return Response.redirect(to.toString(), 302);
      }

      /* ---------- plata: webhook Lemon Squeezy (semnat HMAC) ---------- */
      if (p === '/webhook/lemonsqueezy' && req.method === 'POST') {
        const raw = await req.arrayBuffer();
        const sig = (req.headers.get('x-signature') || '').toLowerCase();
        if (!env.LS_SIGNING_SECRET || !safeEq(await hmacHex(env.LS_SIGNING_SECRET, raw), sig)) return json({ error: 'semnătură invalidă' }, 401, {});
        const ev = JSON.parse(new TextDecoder().decode(raw));
        const name = ev.meta?.event_name, cd = ev.meta?.custom_data || {}, d = ev.data || {}, at = d.attributes || {};
        const key = `${name}:${d.id}`;
        const seen = await env.DB.prepare('SELECT id FROM events WHERE id=?').bind(key).first();
        if (seen) return json({ ok: true, dup: true }, 200, {});
        const uid = cd.user_id;
        const u = uid ? await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(uid).first() : null;
        if (u) {
          if (name === 'order_created' && cd.plan === 'pack' && at.status === 'paid') {
            await env.DB.prepare('UPDATE users SET credits=credits+? WHERE id=?').bind(PACK_CREDITS, u.id).run();
          } else if (name === 'subscription_created' && PLANS[cd.plan]) {
            await env.DB.prepare('UPDATE users SET plan=?, sub_id=? WHERE id=?').bind(cd.plan, String(d.id), u.id).run();
          } else if (name === 'subscription_payment_success' && PLANS[cd.plan] && cd.plan !== 'free') {
            // la fiecare plată lunară: planul e activ și primește creditele lunii
            await env.DB.prepare('UPDATE users SET plan=?, credits=credits+? WHERE id=?').bind(cd.plan, PLANS[cd.plan].credits, u.id).run();
          } else if (name === 'subscription_expired') {
            await env.DB.prepare("UPDATE users SET plan='free', refill_at=? WHERE id=?").bind(now() + 30 * DAY, u.id).run();
          }
        }
        await env.DB.prepare('INSERT INTO events(id,created_at) VALUES(?,?)').bind(key, now()).run();
        return json({ ok: true }, 200, {});
      }

      /* ---------- rute pentru utilizatorul conectat ---------- */
      const u = await userFromAuth(req, env);
      if (!u) return json({ error: 'Intră din nou în cont.' }, 401, H);

      if (p === '/me' && req.method === 'GET') return json({ email: u.email, plan: u.plan, credits: u.credits }, 200, H);

      if (p === '/checkout' && req.method === 'POST') {
        const { plan } = await req.json();
        const base = { creator: env.LS_CHECKOUT_CREATOR, pro: env.LS_CHECKOUT_PRO, pack: env.LS_CHECKOUT_PACK }[plan];
        if (!base) return json({ error: 'Plan necunoscut.' }, 400, H);
        const c = new URL(base);
        c.searchParams.set('checkout[email]', u.email);
        c.searchParams.set('checkout[custom][user_id]', u.id);
        c.searchParams.set('checkout[custom][plan]', plan);
        return json({ url: c.toString() }, 200, H);
      }

      if (p === '/generate' && req.method === 'POST') {
        const b = await req.json();
        const prompt = String(b.prompt || '').trim().slice(0, 2000), lyrics = String(b.lyrics || '').trim().slice(0, 3000);
        const sec = Math.round(Number(b.seconds) || 0);
        const lim = PLANS[u.plan] || PLANS.free;
        if (!prompt) return json({ error: 'Scrie o descriere.' }, 400, H);
        if (sec < 10 || sec > lim.maxSec) return json({ error: `Planul tău permite piese de până la ${lim.maxSec / 60} minute.` }, 400, H);
        const cost = Math.ceil(sec / 60);
        const take = await env.DB.prepare('UPDATE users SET credits=credits-? WHERE id=? AND credits>=?').bind(cost, u.id, cost).run();
        if (!take.meta || take.meta.changes !== 1) return json({ error: `Ai nevoie de ${cost} credite. Ai ${u.credits}.` }, 402, H);
        const gid = rid(10);
        const full = lyrics ? `${prompt}\n\nLyrics:\n${lyrics}` : `${prompt}\n\nInstrumental only, no vocals.`;
        let r;
        try {
          r = await fetch('https://api.elevenlabs.io/v1/music', {
            method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
            body: JSON.stringify({ prompt: full, music_length_ms: sec * 1000, model_id: env.EL_MODEL || 'music_v1' }),
          });
        } catch (e) { r = null; }
        if (!r || !r.ok) {
          await env.DB.prepare('UPDATE users SET credits=credits+? WHERE id=?').bind(cost, u.id).run();
          await env.DB.prepare('INSERT INTO generations(id,user_id,seconds,credits,prompt,ok,created_at) VALUES(?,?,?,?,?,0,?)').bind(gid, u.id, sec, 0, prompt, now()).run();
          let msg = 'Furnizorul AI nu a răspuns.';
          if (r) { try { const e = await r.json(); msg = e?.detail?.message || e?.detail || msg; } catch {} }
          return json({ error: String(msg) }, 502, H);
        }
        await env.DB.prepare('INSERT INTO generations(id,user_id,seconds,credits,prompt,ok,created_at) VALUES(?,?,?,?,?,1,?)').bind(gid, u.id, sec, cost, prompt, now()).run();
        return new Response(r.body, { status: 200, headers: { 'content-type': r.headers.get('content-type') || 'audio/mpeg', 'x-credits': String(u.credits - cost), ...H } });
      }
      return json({ error: 'Nu există.' }, 404, H);
    } catch (e) {
      return json({ error: 'Eroare de server.' }, 500, H);
    }
  },
};
