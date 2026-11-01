// Cadru Studio driver: serves index.html locally, drives it with headless Chromium,
// mocks the external APIs (Openverse, Google sign-in, YouTube upload) and saves screenshots.
// Usage (from repo root): node .claude/skills/run-cadru-studio/driver.cjs [smoke|create|export|publish|all]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.join(ROOT, '.claude/skills/run-cadru-studio/shots');
const flow = process.argv[2] || 'all';
fs.mkdirSync(OUT, { recursive: true });

const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split(/[?#]/)[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});

(async () => {
  await new Promise(res => srv.listen(0, '127.0.0.1', res));
  const URL0 = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  const downloads = []; p.on('download', d => downloads.push(d.suggestedFilename()));
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'Location, Range' };
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const bigPng = Buffer.concat([png, Buffer.alloc(4000)]); // app rejects blobs < 2 KB
  await p.route('https://api.openverse.org/**', r => {
    const u = r.request().url();
    if (u.includes('/images/?')) { const q = new URL(u).searchParams.get('q');
      return r.fulfill({ headers: CORS, json: { results: Array.from({ length: 6 }, (_, i) => ({ id: q + i, url: `https://img.mock/${i}.png`, title: `${q} ${i}`, creator: 'Autor ' + i, license: 'by', license_version: '4.0', foreign_landing_url: 'https://example.org/' + i })) } }); }
    if (u.includes('/audio/?')) return r.fulfill({ headers: CORS, json: { results: [{ id: 'a1', url: 'https://aud.mock/m.mp3', title: 'Melodie test', creator: 'Compozitor', license: 'cc0', duration: 120000 }] } });
    r.fulfill({ status: 404 });
  });
  await p.route('https://img.mock/**', r => r.fulfill({ headers: CORS, contentType: 'image/png', body: bigPng }));
  await p.route('https://aud.mock/**', r => r.fulfill({ headers: CORS, contentType: 'audio/mpeg', body: Buffer.alloc(5000, 1) }));
  await p.addInitScript(() => { window.google = { accounts: { oauth2: { initTokenClient: o => ({ requestAccessToken: () => setTimeout(() => o.callback({ access_token: 'mock', expires_in: 3600 }), 30) }) } } }; });
  await p.route('https://www.googleapis.com/**', r => { const q = r.request();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (q.url().includes('thumbnails')) return r.fulfill({ headers: CORS, json: {} });
    if (q.method() === 'POST') return r.fulfill({ headers: { ...CORS, Location: 'https://www.googleapis.com/upload/mock-session' }, body: '' });
    return r.fulfill({ headers: CORS, json: { id: 'MOCKID' } }); });

  const shot = async n => { const f = path.join(OUT, n + '.png'); await p.screenshot({ path: f }); console.log('screenshot', f); };
  const go = async h => { await p.goto(URL0 + '#' + h); await p.waitForSelector('#v-' + h + ':not([hidden])'); await p.waitForTimeout(400); };

  if (flow === 'smoke' || flow === 'all') {
    for (const v of ['creeaza', 'montaj', 'scenarii', 'miniaturi', 'proiecte', 'publica', 'ai', 'ghid']) { await go(v); await shot('tab-' + v); }
  }
  if (flow === 'create' || flow === 'export' || flow === 'all') {
    await go('creeaza');
    await p.fill('#script', 'Delta Dunării este un loc magic. Păsările zboară peste ape. Pescarii pleacă dimineața. Seara totul devine liniștit.');
    await p.click('#btnSplitLocal');
    await p.click('#optMusic'); await p.click('#genres [data-q]'); await p.waitForSelector('[data-addm="0"]', { timeout: 15000 }); await p.click('[data-addm="0"]');
    await p.waitForTimeout(500);
    await p.click('#btnToEditor'); await p.waitForFunction(() => location.hash === '#montaj', null, { timeout: 30000 });
    await p.waitForTimeout(600); await shot('create-montaj');
    console.log('credits:\n' + await p.inputValue('#creditsOut'));
  }
  if (flow === 'export' || flow === 'all') {
    await p.click('#btnExport'); await p.waitForFunction(() => document.querySelector('#mTitle').textContent === 'Video gata', null, { timeout: 120000 });
    await shot('export-done'); console.log('export:', await p.textContent('#mText'));
    await p.click('#mCancel');
  }
  if (flow === 'publish' || flow === 'all') {
    await go('publica');
    await p.fill('#ytClient', 'mock.apps.googleusercontent.com'); await p.dispatchEvent('#ytClient', 'change');
    await p.setInputFiles('#ytFile', { name: 'v.webm', mimeType: 'video/webm', buffer: Buffer.alloc(2000000, 7) });
    await p.click('#ytGo'); await p.waitForFunction(() => /Gata|refuzat|Nu am/.test(document.querySelector('#ytNote').textContent), null, { timeout: 20000 });
    await shot('publish'); console.log('publish:', await p.textContent('#ytNote'));
  }
  if (flow === 'videos' || flow === 'all') {
    if (flow === 'videos') { await go('creeaza'); await p.fill('#script', 'Un test scurt pentru biblioteca de video.'); await p.click('#optImg'); await p.click('#btnToEditor'); await p.waitForFunction(() => location.hash === '#montaj');
      await p.click('#btnExport'); await p.waitForFunction(() => document.querySelector('#mTitle').textContent === 'Video gata', null, { timeout: 120000 }); await p.click('#mCancel'); }
    await go('videoclipuri');
    await p.setInputFiles('#vidFile', path.join(ROOT, 'media/relaxant-test-3min.mp4'));
    await p.waitForFunction(() => document.querySelectorAll('#vidGrid .pcard').length >= 2, null, { timeout: 30000 });
    await p.waitForSelector('#vidStudio .pcard'); await p.waitForTimeout(500); await shot('videos');
    console.log('videos:', await p.$$eval('#vidGrid .pcard b, #vidStudio .pcard b', e => e.map(x => x.textContent)));
    await p.click('[data-splay="0"]'); await p.waitForTimeout(1500); await shot('videos-player'); await p.click('#vpClose');
  }
  console.log('downloads:', downloads); console.log('page errors:', errs.length ? errs : 'none');
  await b.close(); srv.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
