// Cadru Studio driver: serves index.html locally, drives it with headless Chromium,
// mocks the external APIs (Openverse, Google sign-in, YouTube upload) and saves screenshots.
// Usage (from repo root): node .claude/skills/run-cadru-studio/driver.cjs [smoke|create|export|publish|videos|videoai|all]
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
    for (const v of ['creeaza', 'montaj', 'scenarii', 'miniaturi', 'proiecte', 'publica', 'videoai', 'ai', 'ghid']) { await go(v); await shot('tab-' + v); }
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
    await p.setInputFiles('#vidFile', path.join(ROOT, 'media/relaxant-mostra-2min.mp4'));
    await p.waitForFunction(() => document.querySelectorAll('#vidGrid .pcard').length >= 2, null, { timeout: 30000 });
    await p.waitForSelector('#vidStudio .pcard'); await p.waitForTimeout(500); await shot('videos');
    console.log('videos:', await p.$$eval('#vidGrid .pcard b, #vidStudio .pcard b', e => e.map(x => x.textContent)));
    await p.click('[data-splay="0"]'); await p.waitForTimeout(1500); await shot('videos-player'); await p.click('#vpClose');
  }
  if (flow === 'videoai' || flow === 'all') {
    // Video AI 4K: mocks the fal.ai queue (submit -> status -> result) and the result CDN; uses a 3 s test clip.
    const clip = path.join(OUT, 'xai-clip.mp4');
    if (!fs.existsSync(clip)) require('child_process').execSync(`ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=f=440 -t 3 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${clip}"`);
    const sent = [];
    await p.route('https://fal.ai/api/openapi/**', r => { const ep = new URL(r.request().url()).searchParams.get('endpoint_id');
      if (!ep.includes('kling')) return r.fulfill({ status: 404, headers: CORS, body: '' });
      return r.fulfill({ headers: CORS, json: { paths: { ['/' + ep]: { post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/KIn' } } } } } } },
        components: { schemas: { KIn: { properties: { prompt: {}, duration: { enum: ['3', '5', '8', '10', '15'], default: '5' }, aspect_ratio: { enum: ['16:9', '9:16', '1:1'] }, generate_audio: {}, start_image_url: {} } } } } } }); });
    await p.route('https://queue.fal.run/**', r => { const q = r.request(), u = q.url();
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      if (q.headers()['authorization'] !== 'Key test-key-1234567890abcdef:secret') return r.fulfill({ status: 401, headers: CORS, json: { detail: 'bad key' } });
      if (q.method() === 'POST') { const ep = u.replace('https://queue.fal.run/', ''); sent.push({ ep, body: q.postDataJSON() }); const id = 'req' + sent.length;
        return r.fulfill({ headers: CORS, json: { request_id: id, status_url: `https://queue.fal.run/${ep}/requests/${id}/status`, response_url: `https://queue.fal.run/${ep}/requests/${id}` } }); }
      if (u.includes('/status')) return r.fulfill({ headers: CORS, json: { status: 'COMPLETED' } });
      return r.fulfill({ headers: CORS, json: { video: { url: 'https://vid.mock/clip.mp4' } } }); });
    await p.route('https://vid.mock/**', r => r.fulfill({ headers: CORS, contentType: 'video/mp4', body: fs.readFileSync(clip) }));
    await p.route('https://api.groq.com/**', r => { if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      const scenes = [1, 2, 3].map(i => ({ title: 'Scena test ' + i, camera: 'dronă lentă', duration: 6, prompt: 'A young wizard in a green cloak walks through an ancient forest, slow drone fly-over, shot ' + i }));
      return r.fulfill({ headers: CORS, json: { choices: [{ message: { content: JSON.stringify(scenes) }, finish_reason: 'stop' }] } }); });
    await go('videoai'); await p.evaluate(() => localStorage.setItem('cadru-groq-key', 'gsk_' + 'x'.repeat(30))); await p.reload(); await p.waitForSelector('#v-videoai:not([hidden])');
    await shot('videoai');
    await p.selectOption('#dN', '3'); await p.click('#dGo'); await p.waitForSelector('[data-dgen="2"]', { timeout: 10000 });
    console.log('director:', await p.textContent('#dNote')); await p.locator('#dScenes').scrollIntoViewIfNeeded(); await shot('videoai-director');
    await p.fill('#xKey', 'test-key-1234567890abcdef:secret'); await p.click('#xKeySave');
    await p.selectOption('#xModel', 'kling'); await p.waitForTimeout(500);
    console.log('kling durations (from mocked schema):', await p.$$eval('#xDur option', o => o.map(x => x.value)));
    const still = path.join(OUT, 'xai-still.jpg');
    if (!fs.existsSync(still)) require('child_process').execSync(`ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=640x360 -frames:v 1 "${still}"`);
    await p.setInputFiles('#xImg', still); await p.waitForFunction(() => /640×360/.test(document.querySelector('#xImgName').textContent));
    console.log('endpoint with image:', await p.inputValue('#xEndpoint'));
    await p.click('#xGo');
    await p.waitForSelector('[data-xtl="0"]', { timeout: 20000 });
    console.log('sent:', JSON.stringify(sent.map(s => ({ ep: s.ep, keys: Object.keys(s.body), duration: s.body.duration, img: (s.body.start_image_url || '').slice(0, 22) }))));
    await p.click('[data-dgen="0"]'); await p.waitForFunction(() => /Scena 1/.test(document.querySelector('#xJobs').textContent), null, { timeout: 20000 });
    console.log('director scene sent:', JSON.stringify({ ep: sent[1].ep, duration: sent[1].body.duration, prompt: sent[1].body.prompt.slice(0, 40) }));
    await p.waitForSelector('[data-xai="0"]', { timeout: 20000 });
    await p.click('[data-xai="0"]'); await p.waitForFunction(() => document.querySelectorAll('[data-xtl]').length >= 2, null, { timeout: 20000 });
    console.log('upscale body:', JSON.stringify(sent[2]));
    await p.click('[data-xup="1"]'); await p.waitForFunction(() => /Gata: 3840×2160/.test(document.querySelector("#xJobs").textContent), null, { timeout: 30000 });
    await shot('videoai-jobs'); console.log('jobs:', await p.$$eval('#xJobs .step .note', e => e.map(x => x.textContent).filter(t => /Gata|Eroare|4K/.test(t))));
    await p.click('[data-xtl="0"]');
    await p.selectOption('#quality', '2160'); await go('montaj'); console.log('quality:', await p.inputValue('#quality'), await p.inputValue('#format'));
    await p.click('#btnExport'); await p.waitForFunction(() => document.querySelector('#mTitle').textContent !== 'Video gata');
    await p.waitForFunction(() => document.querySelector('#mTitle').textContent === 'Video gata', null, { timeout: 120000 });
    await p.waitForTimeout(1500); const vdim = await p.evaluate(() => new Promise(res => { const v = document.querySelector('#mVideo'); const f = () => res(v.videoWidth + 'x' + v.videoHeight); v.readyState >= 1 ? f() : v.addEventListener('loadedmetadata', f); }));
    console.log('4K export:', vdim, await p.textContent('#mText')); await shot('videoai-export'); await p.click('#mCancel');
  }
  console.log('downloads:', downloads); console.log('page errors:', errs.length ? errs : 'none');
  await b.close(); srv.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
