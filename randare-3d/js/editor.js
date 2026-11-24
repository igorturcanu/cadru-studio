// Planora 3D: editor de plan 2D + vizualizare 3D + randare foto și 360°, totul în browser.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { CATALOG, BY_TYPE, buildItem, FLOORS, floorTexture, grassTexture, WALL_COLORS, mat, WALL_FINISHES, finishTexture, roofTexture, STRUCTURES, PARTITIONS, KITCHEN_PALETTES, PATH_MATS, ZONE_TYPES, gardenTexture } from './catalog.js';
import { REGIONS, PRICES, ROOF_COVERS, costLines } from './costs.js';
import { RoomEnvironment } from '../vendor/jsm/environments/RoomEnvironment.js';

const { t, LANG } = window.I18N;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const DEG = Math.PI / 180;
function fmt(v, d = 1) { return v.toFixed(d).replace('.', LANG === 'en' ? '.' : ','); }
const STORE_KEY = 'planora-proiect-v1';

// ================= Modelul proiectului =================
let nextId = 1;
const uid = (p) => p + (nextId++).toString(36) + Math.random().toString(36).slice(2, 5);

// Un proiect are mai multe niveluri (parter, etaje). Fiecare nivel își ține pereții, golurile, camerele,
// obiectele, adnotările și grădina. P.walls, P.rooms etc. arată mereu spre nivelul curent (P.cur),
// așa că restul editorului lucrează pe nivelul ales fără să știe de celelalte.
const LEVEL_KEYS = ['walls', 'openings', 'rooms', 'items', 'labels', 'dims', 'paths', 'zones'];
const SLAB = 0.25; // grosimea planșeului dintre niveluri
function newLevel(name) { return { id: uid('L'), name, walls: [], openings: [], rooms: [], items: [], labels: [], dims: [], paths: [], zones: [] }; }
function linkLevels(p) {
  for (const k of LEVEL_KEYS) Object.defineProperty(p, k, { get() { return this.levels[this.cur][k]; }, set(v) { this.levels[this.cur][k] = v; }, enumerable: false, configurable: true });
  return p;
}
function defaultEnv() {
  return {
    hour: 15, north: 20, lights: 'auto', cutaway: false, ceiling: false, wallColor: '#f4f1ea', finish: 'vopsea', exposure: 1,
    structure: 'caramida', partition: 'bca10', roof: 'fara', roofColor: '#a4553a', hq: false,
    gutters: true, gutterColor: '#6b6e72', allLevels: false,
  };
}
function emptyProject() { return linkLevels({ name: t('Proiect nou'), levels: [newLevel(t('Parter'))], cur: 0, env: defaultEnv() }); }
// completează câmpurile noi la proiectele salvate cu o versiune mai veche (proiectele vechi devin „Parter”)
function normalize(d) {
  const { walls, openings, rooms, items, labels, dims, paths, zones, levels, cur, env, ...rest } = d;
  let lv = Array.isArray(levels) && levels.length ? levels : [{ name: t('Parter'), walls, openings, rooms, items, labels, dims, paths, zones }];
  lv = lv.map((L, i) => { const n = newLevel(L.name || levelName(i)); for (const k of LEVEL_KEYS) n[k] = Array.isArray(L[k]) ? L[k] : []; if (L.id) n.id = L.id; return n; });
  return linkLevels({ name: t('Proiect nou'), ...rest, levels: lv, cur: Math.max(0, Math.min(lv.length - 1, cur | 0)), env: { ...defaultEnv(), ...(env || {}) } });
}
function levelName(i) { return i === 0 ? t('Parter') : `${t('Etajul')} ${i}`; }
const levelTop = (L) => (L.walls.length ? Math.max(...L.walls.map((w) => w.h)) : 2.7);
function levelElev(i) { let e = 0; for (let k = 0; k < i; k++) e += levelTop(P.levels[k]) + SLAB; return e; }
// rulează fn pe fiecare nivel, cu P.walls etc. legate de acel nivel, apoi revine la nivelul curent
function eachLevel(fn) { const k = P.cur; try { P.levels.forEach((L, i) => { P.cur = i; fn(L, i); }); } finally { P.cur = k; } }
function allRooms() { return P.levels.flatMap((L) => L.rooms); }
let P = emptyProject();

const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const wallLen = (w) => dist(w.x1, w.y1, w.x2, w.y2);
const getWall = (id) => P.walls.find((w) => w.id === id);

// Adaugă un perete, dar sare peste porțiunile care se suprapun cu pereți existenți (camere lipite).
function addWall(x1, y1, x2, y2, extra = {}) {
  const L = dist(x1, y1, x2, y2);
  if (L < 0.05) return [];
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  let iv = [[0, L]];
  for (const w of P.walls) {
    const c1 = Math.abs((w.x1 - x1) * uy - (w.y1 - y1) * ux), c2 = Math.abs((w.x2 - x1) * uy - (w.y2 - y1) * ux);
    if (c1 > 0.02 || c2 > 0.02) continue;
    const t1 = (w.x1 - x1) * ux + (w.y1 - y1) * uy, t2 = (w.x2 - x1) * ux + (w.y2 - y1) * uy;
    const a = Math.min(t1, t2), b = Math.max(t1, t2);
    const out = [];
    for (const [s, e] of iv) {
      if (b <= s || a >= e) { out.push([s, e]); continue; }
      if (a > s) out.push([s, a]);
      if (b < e) out.push([b, e]);
    }
    iv = out;
  }
  const made = [];
  for (const [s, e] of iv) {
    if (e - s < 0.05) continue;
    const w = { id: uid('w'), x1: r2(x1 + ux * s), y1: r2(y1 + uy * s), x2: r2(x1 + ux * e), y2: r2(y1 + uy * e), t: 0.15, h: 2.7, color: null, ...extra };
    P.walls.push(w); made.push(w);
  }
  return made;
}
const r2 = (v) => Math.round(v * 1000) / 1000;

function addRoom(x1, y1, x2, y2, name, floor = 'stejar') {
  const a = Math.min(x1, x2), b = Math.min(y1, y2), c = Math.max(x1, x2), d = Math.max(y1, y2);
  if (c - a < 0.5 || d - b < 0.5) return null;
  addWall(a, b, c, b); addWall(c, b, c, d); addWall(c, d, a, d); addWall(a, d, a, b);
  const room = { id: uid('r'), name: name || `${t('Cameră')} ${P.rooms.length + 1}`, pts: [[a, b], [c, b], [c, d], [a, d]], floor };
  P.rooms.push(room);
  return room;
}

function nearestWall(x, y, maxD = 0.5) {
  let best = null, bd = maxD;
  for (const w of P.walls) {
    const L = wallLen(w); if (L < 0.01) continue;
    const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
    const t = Math.max(0, Math.min(L, (x - w.x1) * ux + (y - w.y1) * uy));
    const px = w.x1 + ux * t, py = w.y1 + uy * t, d = dist(x, y, px, py);
    if (d < bd) { bd = d; best = { wall: w, t, d }; }
  }
  return best;
}

// modelele de goluri: fiecare unealtă pune un tip și un stil
const OPENING_TOOLS = {
  door: { type: 'door', style: 'simpla', w: 0.9, h: 2.1, sill: 0 },
  door2: { type: 'door', style: 'dubla', w: 1.4, h: 2.1, sill: 0 },
  slide: { type: 'door', style: 'glisanta', w: 1.8, h: 2.2, sill: 0 },
  window: { type: 'window', style: 'normala', w: 1.4, h: 1.4, sill: 0.9 },
  balcony: { type: 'window', style: 'balcon', w: 0.9, h: 2.2, sill: 0 },
};
const STYLE_NAMES = { simpla: 'Ușă simplă', dubla: 'Ușă dublă', glisanta: 'Ușă glisantă', normala: 'Fereastră', balcon: 'Ușă de balcon' };
function addOpening(type, x, y, opts = {}) {
  const hit = nearestWall(x, y, 0.6);
  if (!hit) return null;
  const L = wallLen(hit.wall);
  const tdef = OPENING_TOOLS[type] || OPENING_TOOLS.door;
  type = tdef.type;
  const def = { w: tdef.w, h: tdef.h, sill: tdef.sill, style: tdef.style };
  const o = { id: uid('o'), wall: hit.wall.id, type, ...def, ...opts };
  if (L < o.w + 0.1) return null;
  o.pos = Math.max(o.w / 2 + 0.05, Math.min(L - o.w / 2 - 0.05, hit.t));
  P.openings.push(o);
  return o;
}

function addItem(type, x, y, rot = 0, extra = {}) {
  const c = BY_TYPE[type];
  const it = { id: uid('i'), type, x: r2(x), y: r2(y), rot, w: c.w, d: c.d, h: c.h, color: c.color, elev: c.elev || 0, ...extra };
  // scara urcă exact până la nivelul de deasupra (înălțimea etajului plus planșeul)
  if ((c.stair || type === 'scara') && !extra.h) it.h = r2(levelTop(P.levels[P.cur]) + (type === 'scara_pod' ? 0 : SLAB));
  P.items.push(it);
  return it;
}

function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a / 2);
}
function polyCenter(pts) {
  let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}
function inPoly(x, y, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

// ================= Șabloane =================
function templateApartament() {
  P = emptyProject(); P.name = t('Apartament 2 camere');
  addRoom(0, 0, 7, 6.5, t('Living și bucătărie'), 'stejar');
  addRoom(7, 0, 11, 4, t('Dormitor'), 'frasin');
  addRoom(7, 4, 11, 6.5, t('Baie'), 'gresie');
  addOpening('door', 7, 3.3); addOpening('door', 7, 5.6, { w: 0.8 });
  addOpening('door', 1.2, 6.5, { w: 1.0 });
  addOpening('window', 3.4, 0, { w: 1.6, h: 1.5, sill: 0.8 });
  addOpening('window', 0, 3.4, { w: 1.4 });
  addOpening('window', 11, 2.0, { w: 1.4 });
  addOpening('window', 11, 5.3, { w: 0.6, h: 0.6, sill: 1.5 });
  // living
  addItem('comoda_tv', 1.4, 0.3, 0);
  addItem('covor', 1.6, 2.3, 0, { w: 2.4, d: 1.8 });
  addItem('masuta', 1.6, 2.2, 0);
  addItem('canapea', 1.6, 3.6, 180);
  addItem('fotoliu', 0.65, 1.8, 270, { color: '#c27a4e' });
  addItem('lampa', 0.4, 4.2);
  addItem('planta', 0.45, 0.45);
  addItem('raft', 3.2, 6.25, 180);
  addItem('tablou', 4.8, 6.42, 180, { w: 0.9, h: 0.6 });
  // bucătărie
  addItem('bucatarie', 5.7, 0.32, 0);
  addItem('frigider', 6.6, 1.2, 270);
  addItem('masa', 5.0, 3.4, 90, { w: 1.6 });
  for (const [x, y, r] of [[4.4, 3.0, 90], [4.4, 3.8, 90], [5.6, 3.0, 270], [5.6, 3.8, 270]]) addItem('scaun', x, y, r);
  addItem('lustra', 5.0, 3.4, 0);
  // dormitor
  addItem('pat', 9.0, 1.12, 0);
  addItem('noptiera', 7.85, 0.3); addItem('noptiera', 10.15, 0.3);
  addItem('tablou', 9.0, 0.08, 0, { w: 1.2, h: 0.5, elev: 1.25, color: '#b9673f' });
  addItem('dulap', 9.9, 3.6, 180);
  addItem('covor', 9.0, 2.75, 0, { w: 1.7, d: 0.9, color: '#9fb0b8' });
  addItem('planta', 10.6, 2.95, 0, { h: 1.0 });
  // baie
  addItem('cada', 10.08, 6.05, 0);
  addItem('wc', 10.6, 4.75, 90);
  addItem('lavoar', 8.5, 4.32, 0);
  P.env.hour = 15;
}

function templateCasa() {
  P = emptyProject(); P.name = t('Casă cu grădină');
  addRoom(0, 0, 7, 8, t('Living'), 'nuc');
  addRoom(7, 0, 11.5, 3.8, t('Bucătărie'), 'marmura');
  addRoom(7, 3.8, 11.5, 8, t('Dormitor'), 'stejar');
  addOpening('door', 3.5, 8, { w: 1.1 });
  addOpening('door', 7, 2.4); addOpening('door', 7, 5.2);
  addOpening('window', 1.6, 8, { w: 1.6, h: 1.8, sill: 0.4 });
  addOpening('window', 5.4, 8, { w: 1.6, h: 1.8, sill: 0.4 });
  addOpening('window', 0, 2.5, { w: 2.0, h: 1.6 });
  addOpening('window', 0, 5.8, { w: 1.4 });
  addOpening('window', 3.5, 0, { w: 2.4, h: 1.6 });
  addOpening('window', 9.25, 0, { w: 1.6 });
  addOpening('window', 11.5, 6, { w: 1.6 });
  addOpening('window', 9.3, 8, { w: 1.4 });
  addItem('canapea', 3.2, 3.6, 0, { w: 2.6, color: '#d8cfc0' });
  addItem('covor', 3.2, 4.8, 0, { w: 2.8, d: 2.0, color: '#7f8f86' });
  addItem('masuta', 3.2, 4.8, 0);
  addItem('fotoliu', 1.4, 4.9, 90, { color: '#4f6d8c' }); addItem('fotoliu', 5.0, 4.9, 270, { color: '#4f6d8c' });
  addItem('comoda_tv', 3.2, 7.7, 180);
  addItem('raft', 0.25, 4.3, 90); addItem('lampa', 1.0, 3.0); addItem('planta', 6.5, 0.5);
  addItem('lustra', 3.2, 4.8, 0);
  addItem('bucatarie', 9.25, 0.32, 0, { w: 3.6 });
  addItem('masa', 9.25, 2.4, 0, { w: 1.4, d: 0.8 });
  for (const [x, y, r] of [[8.85, 1.95, 0], [9.65, 1.95, 0], [8.85, 2.85, 180], [9.65, 2.85, 180]]) addItem('scaun', x, y, r);
  addItem('pat', 9.25, 6.9, 180);
  addItem('noptiera', 8.1, 7.6, 180); addItem('noptiera', 10.4, 7.6, 180);
  addItem('dulap', 10.6, 4.95, 270, { w: 1.8 });
  // grădină
  addItem('piscina', 3.5, 13.5, 90, { w: 3.5, d: 7 });
  addItem('copac', -3.5, -1.5); addItem('copac', 15.5, 11, 0, { w: 3.6, h: 6.5 }); addItem('copac', -4, 12, 0, { w: 2.6, h: 4.5 });
  for (let i = 0; i < 4; i++) addItem('tufis', 0.6 + i * 0.9, 8.9, 0, { w: 0.8, h: 0.6 });
  for (let i = 0; i < 3; i++) addItem('tufis', 8 + i * 1.2, 8.9, 0);
  addItem('masina', 14.5, 3.5, 0);
  P.env.hour = 17.5; P.env.north = 35; P.env.roof = 'doua_ape';
}

function templateCasaEtaj() {
  P = emptyProject(); P.name = t('Casă cu etaj și grădină');
  // parter
  addRoom(0, 0, 7, 8, t('Living'), 'nuc');
  addRoom(7, 0, 11.5, 3.8, t('Bucătărie'), 'marmura');
  addRoom(7, 3.8, 11.5, 8, t('Hol'), 'gresie');
  addOpening('door', 9.3, 8, { w: 1.1 });
  addOpening('door', 7, 1.9); addOpening('slide', 7, 6.4, { w: 1.6 });
  addOpening('slide', 3.5, 8, { w: 2.4 });
  addOpening('window', 0, 2.5, { w: 2.0, h: 1.6 }); addOpening('window', 0, 5.8, { w: 1.4 });
  addOpening('window', 3.5, 0, { w: 2.4, h: 1.6 }); addOpening('window', 9.25, 0, { w: 1.6 });
  addOpening('window', 11.5, 2.0, { w: 1.4 });
  addItem('canapea', 3.2, 3.4, 0, { w: 2.6, color: '#d8cfc0' });
  addItem('covor', 3.2, 4.6, 0, { w: 2.8, d: 2.0, color: '#7f8f86' }); addItem('masuta', 3.2, 4.6, 0);
  addItem('fotoliu', 1.4, 4.7, 90, { color: '#4f6d8c' }); addItem('comoda_tv', 3.2, 0.3, 0);
  addItem('lampa', 0.6, 3.0); addItem('planta', 6.5, 0.5); addItem('lustra', 3.2, 4.6, 0);
  addItem('bucatarie', 9.25, 0.32, 0, { w: 3.6 }); addItem('masa', 9.25, 2.4, 0, { w: 1.4, d: 0.8 });
  for (const [x, y, r] of [[8.85, 1.95, 0], [9.65, 1.95, 0], [8.85, 2.85, 180], [9.65, 2.85, 180]]) addItem('scaun', x, y, r);
  addItem('scara_l', 10.35, 5.0, 0, { w: 2.0, d: 2.2 });
  // grădina
  P.zones.push({ id: uid('z'), type: 'terasa', pts: [[0.5, 8.15], [6.5, 8.15], [6.5, 10.6], [0.5, 10.6]] });
  P.zones.push({ id: uid('z'), type: 'flori', pts: [[-1.6, 0.5], [-0.6, 0.5], [-0.6, 7.5], [-1.6, 7.5]] });
  P.zones.push({ id: uid('z'), type: 'apa', pts: [[1.5, 13.2], [5.5, 13.2], [5.5, 15.6], [1.5, 15.6]] });
  P.zones.push({ id: uid('z'), type: 'pietris', pts: [[12.6, 0], [16.6, 0], [16.6, 8.4], [12.6, 8.4]] });
  P.paths.push({ id: uid('a'), pts: [[9.3, 8.3], [9.3, 12], [5.8, 14.4]], w: 1.2, mat: 'pavele' });
  P.paths.push({ id: uid('a'), pts: [[9.9, 8.6], [14.6, 8.6]], w: 1.0, mat: 'dale' });
  addItem('masina', 14.6, 3.8, 0);
  addItem('copac', -4, -1.5); addItem('brad', 17.5, 13.5); addItem('pom', -3.6, 11.5); addItem('pom', 12.5, 15.5);
  addItem('gard_viu', 9, 17.2, 0, { w: 8 }); addItem('gard', 1, 17.2, 0, { w: 8 });
  addItem('pergola', 3.5, 9.4, 0, { w: 4.5, d: 2.2 }); addItem('banca', 8, 14.6, 180);
  addItem('felinar', 10.3, 11.6); addItem('felinar', -0.6, 9.2);
  for (const y of [9.4, 10.6]) addItem('bolard', 8.4, y);
  addItem('ghiveci', 8.4, 8.5); addItem('ghiveci', 10.25, 8.5); addItem('spot', 0.5, 12.6); addItem('spot', 6.4, 12.6);
  // etajul 1
  addLevel0Copy();
  P.rooms = []; P.walls = []; P.openings = [];
  addRoom(0, 0, 7, 4.2, t('Dormitor'), 'stejar'); addRoom(0, 4.2, 7, 8, t('Dormitor 2'), 'frasin');
  addRoom(7, 0, 11.5, 3.8, t('Baie'), 'gresie'); addRoom(7, 3.8, 11.5, 8, t('Hol'), 'stejar');
  addOpening('door', 7, 2.0, { w: 0.8 }); addOpening('door', 7, 5.6); addOpening('door', 7.6, 3.8);
  addOpening('window', 3.5, 0, { w: 1.8 }); addOpening('window', 0, 2.1, { w: 1.4 }); addOpening('window', 0, 6.1, { w: 1.4 });
  addOpening('balcony', 2.0, 8); addOpening('window', 5.0, 8, { w: 1.6 }); addOpening('window', 9.25, 0, { w: 0.8, h: 0.8, sill: 1.4 }); addOpening('window', 9.3, 8, { w: 1.4 });
  addItem('pat', 3.5, 1.2, 0); addItem('noptiera', 2.3, 0.3); addItem('noptiera', 4.7, 0.3); addItem('dulap', 6.6, 2.4, 270, { w: 1.8 });
  addItem('pat', 2.0, 6.7, 180, { w: 1.4 }); addItem('birou', 5.5, 4.55, 0);
  addItem('cada', 8.0, 0.4, 0); addItem('wc', 11.1, 1.2, 270); addItem('lavoar', 10.2, 3.5, 180);
  P.cur = 0; P.env.hour = 17.5; P.env.north = 35; P.env.roof = 'doua_ape'; P.env.allLevels = true;
}
// adaugă un nivel gol deasupra (folosit de șablon înainte de a desena etajul)
function addLevel0Copy() { P.levels.push(newLevel(levelName(P.levels.length))); P.cur = P.levels.length - 1; }

// ================= Istoric (anulare / refacere) și salvare =================
let history = [], hIndex = -1;
function snapshot() { return JSON.stringify(P); }
function commit() {
  const s = snapshot();
  if (history[hIndex] === s) return;
  history = history.slice(0, hIndex + 1); history.push(s);
  if (history.length > 120) history.shift();
  hIndex = history.length - 1;
  try { localStorage.setItem(STORE_KEY, s); } catch (e) { /* stocare indisponibilă */ }
  scheduleStore();
  updateUndo();
}
function restore(s) { P = normalize(JSON.parse(s)); sel = null; refreshAll(); }
function undo() { if (hIndex > 0) { hIndex--; restore(history[hIndex]); updateUndo(); saveLocal(); } }
function redo() { if (hIndex < history.length - 1) { hIndex++; restore(history[hIndex]); updateUndo(); saveLocal(); } }
function saveLocal() { try { localStorage.setItem(STORE_KEY, snapshot()); } catch (e) { } }
function updateUndo() { $('#undo').disabled = hIndex <= 0; $('#redo').disabled = hIndex >= history.length - 1; }

function changed(rebuild = true) {
  if (rebuild) rebuild3D();
  draw2D(); renderProps(); commit();
}
// ================= Niveluri =================
function syncLevelUI() {
  const html = P.levels.map((L, i) => `<button class="chip ${i === P.cur ? 'on' : ''}" data-lvl="${i}" title="${esc(L.name)}">${esc(L.name)}</button>`).join('') + `<button class="chip" data-lvladd title="${t('Adaugă nivel deasupra')}">＋ ${t('Nivel')}</button>`;
  $$('.lvlbar').forEach((bar) => { bar.innerHTML = html; });
  $('#lvlAllBtn').hidden = P.levels.length < 2; $('#lvlAllBtn').classList.toggle('on', !!P.env.allLevels);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.lvlbar [data-lvl], .lvlbar [data-lvladd]'); if (!b) return;
  if (b.hasAttribute('data-lvladd')) addLevel(); else setLevel(+b.dataset.lvl);
});
function setLevel(i) {
  if (i === P.cur || !P.levels[i]) return;
  const dy = levelElev(i) - levelElev(P.cur);
  P.cur = i; sel = null; wallChain = null; pathDraft = null;
  // camera urcă sau coboară odată cu nivelul (în modul persoană rămâi la înălțimea ochilor)
  camera.position.y += dy; controls.target.y += dy; controls.update();
  syncLevelUI(); rebuild3D(); draw2D(); renderProps(); commit();
  toast(`${t('Lucrezi pe')}: ${P.levels[i].name}`);
}
function addLevel() {
  const topI = P.levels.length - 1, src = P.levels[topI], L = newLevel(levelName(topI + 1));
  const keep = P.cur; P.cur = topI; const ext = new Map(src.walls.map((w) => [w.id, isExterior(w)])); P.cur = keep;
  const ids = {};
  for (const w of src.walls) { const nw = { ...w, id: uid('w') }; ids[w.id] = nw.id; L.walls.push(nw); }
  for (const o of src.openings) {
    if (!ids[o.wall]) continue;
    if (o.type === 'window') L.openings.push({ ...o, id: uid('o'), wall: ids[o.wall] });
    else if (ext.get(o.wall)) L.openings.push({ ...o, id: uid('o'), wall: ids[o.wall], type: 'window', style: 'normala', w: Math.min(1.4, o.w + 0.3), h: 1.4, sill: 0.9 });
    else L.openings.push({ ...o, id: uid('o'), wall: ids[o.wall] });
  }
  for (const r of src.rooms) L.rooms.push({ ...r, id: uid('r'), pts: r.pts.map((p) => [...p]) });
  P.levels.push(L);
  const dy = levelElev(topI + 1) - levelElev(P.cur);
  P.cur = topI + 1; sel = null;
  camera.position.y += dy; controls.target.y += dy; controls.update();
  syncLevelUI(); changed();
  toast(t('Nivel adăugat. Pune o scară pe nivelul de jos ca să urci.'));
}
function deleteLevel() {
  if (P.levels.length < 2) return;
  if (!confirm(t('Ștergi nivelul') + ` „${P.levels[P.cur].name}”?`)) return;
  const dy = -levelElev(P.cur);
  P.levels.splice(P.cur, 1); P.cur = Math.max(0, P.cur - 1); sel = null;
  camera.position.y += dy + levelElev(P.cur); controls.target.y += dy + levelElev(P.cur); controls.update();
  syncLevelUI(); changed();
}
$('#lvlAllBtn').addEventListener('click', () => { P.env.allLevels = !P.env.allLevels; syncLevelUI(); rebuild3D(); commit(); });

function refreshAll() { syncLevelUI(); $('#hqBtn').classList.toggle('on', !!P.env.hq); $('#cutBtn').classList.toggle('on', !!P.env.cutaway); $('#projName').value = P.name; rebuild3D(); draw2D(); renderProps(); applyEnv(); }

// ================= Vizualizarea 2D =================
const c2d = $('#c2d'), g2 = c2d.getContext('2d');
const view = { s: 50, ox: 60, oy: 60 };
let tool = 'select', sel = null; // sel = {kind:'item'|'wall'|'room'|'opening', id}
let hover = null, drag = null, wallChain = null, roomDraft = null, measure = null, mouseW = null, pathDraft = null;
const ZONE_TINT = { gazon: '#a9d18e', flori: '#eab0c6', pietris: '#e2dccf', terasa: '#d9b98f', pavaj: '#cdc7bd', apa: '#93cbe6' };
const PATH_TINT = { pavele: '#bdb6ac', pavele_rosii: '#c98f77', dale: '#d3cfc7', piatra: '#aaa59c', pietris: '#ded8cb', lemn: '#b98c5e' };
let dpr = 1;

const toS = (x, y) => [x * view.s + view.ox, y * view.s + view.oy];
const toW = (px, py) => [(px - view.ox) / view.s, (py - view.oy) / view.s];
const snapV = (v, e) => (e && e.shiftKey ? r2(v) : Math.round(v / 0.05) * 0.05);

function resize2D() {
  const r = c2d.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  c2d.width = Math.max(1, r.width * dpr); c2d.height = Math.max(1, r.height * dpr);
  draw2D();
}

function bounds() {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  const add = (x, y) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); };
  for (const w of P.walls) { add(w.x1, w.y1); add(w.x2, w.y2); }
  for (const it of P.items) { const r = Math.max(it.w, it.d) / 2; add(it.x - r, it.y - r); add(it.x + r, it.y + r); }
  for (const z of P.zones) z.pts.forEach((p) => add(...p));
  for (const pa of P.paths) pa.pts.forEach((p) => add(...p));
  if (!isFinite(a)) return { x1: -1, y1: -1, x2: 8, y2: 6 };
  return { x1: a, y1: b, x2: c, y2: d };
}
function zoomFit() {
  const r = c2d.getBoundingClientRect(), b = bounds();
  const pad = 40, w = Math.max(1, b.x2 - b.x1), h = Math.max(1, b.y2 - b.y1);
  view.s = Math.max(8, Math.min(140, Math.min((r.width - pad * 2) / w, (r.height - pad * 2 - 30) / h)));
  view.ox = (r.width - w * view.s) / 2 - b.x1 * view.s;
  view.oy = (r.height - h * view.s) / 2 - b.y1 * view.s - 10;
  draw2D();
}

const FLOOR_TINT = { stejar: '#efe2cf', nuc: '#e2d3c5', frasin: '#f5eee0', gresie: '#eef0f2', marmura: '#f3f3f1', ardezie: '#dfe1e4', beton: '#e6e5e2' };

function draw2D() {
  const r = c2d.getBoundingClientRect(), W = r.width, H = r.height;
  g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  g2.fillStyle = '#fbfcfd'; g2.fillRect(0, 0, W, H);
  // grilă
  const step = view.s >= 30 ? 0.5 : 1;
  const [wx0, wy0] = toW(0, 0), [wx1, wy1] = toW(W, H);
  g2.lineWidth = 1;
  for (let x = Math.floor(wx0 / step) * step; x <= wx1; x += step) {
    const [sx] = toS(x, 0); g2.strokeStyle = Math.abs(x % 1) < 1e-6 ? '#e3e8ee' : '#f0f3f6';
    g2.beginPath(); g2.moveTo(Math.round(sx) + 0.5, 0); g2.lineTo(Math.round(sx) + 0.5, H); g2.stroke();
  }
  for (let y = Math.floor(wy0 / step) * step; y <= wy1; y += step) {
    const [, sy] = toS(0, y); g2.strokeStyle = Math.abs(y % 1) < 1e-6 ? '#e3e8ee' : '#f0f3f6';
    g2.beginPath(); g2.moveTo(0, Math.round(sy) + 0.5); g2.lineTo(W, Math.round(sy) + 0.5); g2.stroke();
  }
  // nivelul de dedesubt, estompat, ca reper pentru etaj
  const below = P.levels[P.cur - 1];
  if (below) {
    g2.lineCap = 'square'; g2.strokeStyle = 'rgba(45,49,56,.16)';
    for (const w of below.walls) { const [a, b] = toS(w.x1, w.y1), [c, d] = toS(w.x2, w.y2); g2.lineWidth = Math.max(2, w.t * view.s); g2.beginPath(); g2.moveTo(a, b); g2.lineTo(c, d); g2.stroke(); }
    g2.lineCap = 'butt'; g2.setLineDash([5, 4]); g2.strokeStyle = 'rgba(194,65,12,.55)'; g2.lineWidth = 1.5;
    for (const h of stairHoles(P.cur - 1)) { g2.beginPath(); h.forEach(([x, y], i) => { const [sx, sy] = toS(x, y); i ? g2.lineTo(sx, sy) : g2.moveTo(sx, sy); }); g2.closePath(); g2.stroke(); }
    g2.setLineDash([]);
  }
  // grădina: zone și alei
  for (const z of P.zones) {
    g2.beginPath(); z.pts.forEach(([x, y], i) => { const [sx, sy] = toS(x, y); i ? g2.lineTo(sx, sy) : g2.moveTo(sx, sy); }); g2.closePath();
    g2.fillStyle = ZONE_TINT[z.type] || '#a9d18e'; g2.fill();
    g2.strokeStyle = isSel('zone', z.id) ? '#2a7de1' : 'rgba(60,90,50,.35)'; g2.lineWidth = isSel('zone', z.id) ? 3 : 1; g2.stroke();
    if (view.s >= 18) { const [cx, cy] = toS(...polyCenter(z.pts)); g2.font = '11px system-ui, sans-serif'; g2.fillStyle = 'rgba(29,39,51,.6)'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(t((ZONE_TYPES[z.type] || ZONE_TYPES.gazon).name), cx, cy); }
  }
  const strokePath = (pts, w, col) => { g2.lineJoin = 'round'; g2.lineCap = 'round'; g2.strokeStyle = col; g2.lineWidth = Math.max(2, w * view.s); g2.beginPath(); pts.forEach(([x, y], i) => { const [sx, sy] = toS(x, y); i ? g2.lineTo(sx, sy) : g2.moveTo(sx, sy); }); g2.stroke(); g2.lineJoin = 'miter'; g2.lineCap = 'butt'; };
  for (const pa of P.paths) {
    if (isSel('path', pa.id)) strokePath(pa.pts, pa.w + 6 / view.s, '#2a7de1');
    strokePath(pa.pts, pa.w, PATH_TINT[pa.mat] || '#bdb6ac');
  }
  if (pathDraft) strokePath(mouseW ? [...pathDraft, mouseW] : pathDraft, 1.2, 'rgba(42,125,225,.45)');
  // camere
  for (const rm of P.rooms) {
    g2.beginPath(); rm.pts.forEach(([x, y], i) => { const [sx, sy] = toS(x, y); i ? g2.lineTo(sx, sy) : g2.moveTo(sx, sy); }); g2.closePath();
    g2.fillStyle = FLOOR_TINT[rm.floor] || '#efe7da'; g2.fill();
    if (isSel('room', rm.id)) { g2.strokeStyle = '#2a7de1'; g2.lineWidth = 3; g2.setLineDash([8, 5]); g2.stroke(); g2.setLineDash([]); }
  }
  // obiecte joase (covoare, piscine) sub pereți
  const low = P.items.filter((i) => i.h <= 0.06), rest = P.items.filter((i) => i.h > 0.06);
  low.forEach(drawItem2D);
  // pereți
  g2.lineCap = 'square';
  for (const w of P.walls) {
    const [a, b] = toS(w.x1, w.y1), [c, d] = toS(w.x2, w.y2);
    g2.strokeStyle = isSel('wall', w.id) ? '#2a7de1' : (hover && hover.kind === 'wall' && hover.id === w.id ? '#4a5563' : '#2d3138');
    g2.lineWidth = Math.max(3, w.t * view.s);
    g2.beginPath(); g2.moveTo(a, b); g2.lineTo(c, d); g2.stroke();
  }
  g2.lineCap = 'butt';
  // goluri (uși, ferestre)
  for (const o of P.openings) drawOpening2D(o);
  rest.sort((a, b) => (a.elev || 0) - (b.elev || 0)).forEach(drawItem2D);
  // etichete camere
  g2.textAlign = 'center'; g2.textBaseline = 'middle';
  for (const rm of P.rooms) {
    const [cx, cy] = toS(...polyCenter(rm.pts));
    if (view.s < 18) continue;
    g2.font = '600 12px system-ui, sans-serif'; g2.fillStyle = 'rgba(29,39,51,.75)';
    g2.fillText(rm.name, cx, cy - 8);
    g2.font = '11px system-ui, sans-serif'; g2.fillStyle = 'rgba(29,39,51,.55)';
    g2.fillText(fmt(polyArea(rm.pts)) + ' m²', cx, cy + 8);
  }
  // cote pentru peretele selectat
  if (sel && sel.kind === 'wall') { const w = getWall(sel.id); if (w) { dimLine(w.x1, w.y1, w.x2, w.y2, w.t / 2 + 0.35); drawHandle(w.x1, w.y1); drawHandle(w.x2, w.y2); } }
  // previzualizări pentru unelte
  if (wallChain && mouseW) {
    const p = wallChain[wallChain.length - 1];
    const [a, b] = toS(p[0], p[1]), [c, d] = toS(mouseW[0], mouseW[1]);
    g2.strokeStyle = 'rgba(42,125,225,.6)'; g2.lineWidth = Math.max(3, 0.15 * view.s); g2.lineCap = 'square';
    g2.beginPath(); g2.moveTo(a, b); g2.lineTo(c, d); g2.stroke(); g2.lineCap = 'butt';
    dimLine(p[0], p[1], mouseW[0], mouseW[1], 0.4);
  }
  if (roomDraft) {
    const { x1, y1, x2, y2 } = roomDraft;
    const [a, b] = toS(Math.min(x1, x2), Math.min(y1, y2));
    g2.fillStyle = 'rgba(42,125,225,.12)'; g2.strokeStyle = '#2a7de1'; g2.lineWidth = 2;
    g2.fillRect(a, b, Math.abs(x2 - x1) * view.s, Math.abs(y2 - y1) * view.s);
    g2.strokeRect(a, b, Math.abs(x2 - x1) * view.s, Math.abs(y2 - y1) * view.s);
    dimLine(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.min(y1, y2), 0.35);
    dimLine(Math.max(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), 0.35);
  }
  for (const d of P.dims) { dimLine(d.x1, d.y1, d.x2, d.y2, 0, isSel('dim', d.id) ? '#2a7de1' : '#334155'); for (const [x, y] of [[d.x1, d.y1], [d.x2, d.y2]]) { const [sx, sy] = toS(x, y); g2.fillStyle = isSel('dim', d.id) ? '#2a7de1' : '#334155'; g2.fillRect(sx - 2.5, sy - 2.5, 5, 5); } }
  for (const l of P.labels) {
    const [sx, sy] = toS(l.x, l.y);
    g2.font = `600 ${l.size || 14}px system-ui, sans-serif`; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    const tw = g2.measureText(l.text).width + 12, th = (l.size || 14) + 8;
    g2.fillStyle = 'rgba(255,255,255,.9)'; g2.strokeStyle = isSel('label', l.id) ? '#2a7de1' : 'rgba(30,40,50,.25)'; g2.lineWidth = isSel('label', l.id) ? 2 : 1;
    roundRect(sx - tw / 2, sy - th / 2, tw, th, 5); g2.fill(); g2.stroke();
    g2.fillStyle = '#1d2733'; g2.fillText(l.text, sx, sy + 1);
  }
  if (measure) { g2.setLineDash([6, 4]); dimLine(measure.x1, measure.y1, measure.x2, measure.y2, 0, measure.keep ? '#334155' : '#c2410c'); g2.setLineDash([]); }
  if (OPENING_TOOLS[tool] && mouseW) {
    const hit = nearestWall(mouseW[0], mouseW[1], 0.6);
    if (hit) { const w = hit.wall, L = wallLen(w), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L; const half = OPENING_TOOLS[tool].w / 2;
      const [a, b] = toS(w.x1 + ux * (hit.t - half), w.y1 + uy * (hit.t - half)), [c, d] = toS(w.x1 + ux * (hit.t + half), w.y1 + uy * (hit.t + half));
      g2.strokeStyle = 'rgba(232,137,43,.85)'; g2.lineWidth = Math.max(4, w.t * view.s + 2); g2.beginPath(); g2.moveTo(a, b); g2.lineTo(c, d); g2.stroke(); }
  }
  drawScale(W, H);
}

function isSel(kind, id) { return sel && sel.kind === kind && sel.id === id; }
function drawHandle(x, y) { const [sx, sy] = toS(x, y); g2.fillStyle = '#fff'; g2.strokeStyle = '#2a7de1'; g2.lineWidth = 2; g2.beginPath(); g2.arc(sx, sy, 6, 0, Math.PI * 2); g2.fill(); g2.stroke(); }

function dimLine(x1, y1, x2, y2, off, color = '#2a7de1') {
  const L = dist(x1, y1, x2, y2); if (L < 0.01) return;
  const nx = -(y2 - y1) / L * off, ny = (x2 - x1) / L * off;
  const [a, b] = toS(x1 + nx, y1 + ny), [c, d] = toS(x2 + nx, y2 + ny);
  g2.strokeStyle = color; g2.lineWidth = 1.2; g2.beginPath(); g2.moveTo(a, b); g2.lineTo(c, d); g2.stroke();
  const label = fmt(L, 2) + ' m';
  g2.font = '600 11px system-ui, sans-serif';
  const tw = g2.measureText(label).width + 8;
  g2.fillStyle = '#fff'; g2.fillRect((a + c) / 2 - tw / 2, (b + d) / 2 - 8, tw, 16);
  g2.fillStyle = color; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(label, (a + c) / 2, (b + d) / 2);
}

function drawOpening2D(o) {
  const w = getWall(o.wall); if (!w) return;
  const L = wallLen(w), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, nx = -uy, ny = ux;
  const s0 = o.pos - o.w / 2, s1 = o.pos + o.w / 2;
  const p0 = [w.x1 + ux * s0, w.y1 + uy * s0], p1 = [w.x1 + ux * s1, w.y1 + uy * s1];
  const [a, b] = toS(...p0), [c, d] = toS(...p1);
  g2.strokeStyle = '#fbfcfd'; g2.lineWidth = Math.max(3, w.t * view.s) + 1.5;
  g2.beginPath(); g2.moveTo(a, b); g2.lineTo(c, d); g2.stroke();
  const selC = isSel('opening', o.id) ? '#2a7de1' : '#3a4350';
  if (o.type === 'window') {
    const off = w.t / 2 * (o.style === 'balcon' ? 0.3 : 0.6);
    g2.strokeStyle = selC; g2.lineWidth = 1.4;
    for (const k of [-off, 0, off]) {
      const [e, f] = toS(p0[0] + nx * k, p0[1] + ny * k), [g, h] = toS(p1[0] + nx * k, p1[1] + ny * k);
      g2.beginPath(); g2.moveTo(e, f); g2.lineTo(g, h); g2.stroke();
    }
  } else if (o.style === 'glisanta') {
    g2.strokeStyle = selC; g2.lineWidth = 2;
    const off = w.t * 0.18, k = 0.55;
    const q = (s, n) => toS(w.x1 + ux * s + nx * n, w.y1 + uy * s + ny * n);
    let [e1, f1] = q(s0, -off), [e2, f2] = q(s0 + o.w * k, -off); g2.beginPath(); g2.moveTo(e1, f1); g2.lineTo(e2, f2); g2.stroke();
    [e1, f1] = q(s1 - o.w * k, off); [e2, f2] = q(s1, off); g2.beginPath(); g2.moveTo(e1, f1); g2.lineTo(e2, f2); g2.stroke();
  } else if (o.style === 'dubla') {
    const hw = o.w / 2, pm = [w.x1 + ux * o.pos, w.y1 + uy * o.pos];
    g2.strokeStyle = selC;
    for (const [pp, dirx, diry] of [[p0, ux, uy], [p1, -ux, -uy]]) {
      const [a1, b1] = toS(...pp), [e, f] = toS(pp[0] + nx * hw, pp[1] + ny * hw);
      g2.lineWidth = 2; g2.beginPath(); g2.moveTo(a1, b1); g2.lineTo(e, f); g2.stroke();
      g2.lineWidth = 1; g2.setLineDash([4, 3]);
      const ang0 = Math.atan2(ny, nx), ang1 = Math.atan2(diry, dirx);
      g2.beginPath(); g2.arc(a1, b1, hw * view.s, ang0, ang1, angleDiff(ang0, ang1) < 0); g2.stroke(); g2.setLineDash([]);
    }
    void pm;
  } else {
    // ușă: foaia și arcul de deschidere
    const leaf = [p0[0] + nx * o.w, p0[1] + ny * o.w];
    const [e, f] = toS(...leaf);
    g2.strokeStyle = selC; g2.lineWidth = 2; g2.beginPath(); g2.moveTo(a, b); g2.lineTo(e, f); g2.stroke();
    g2.lineWidth = 1; g2.setLineDash([4, 3]);
    const ang0 = Math.atan2(ny, nx), ang1 = Math.atan2(uy, ux);
    g2.beginPath(); g2.arc(a, b, o.w * view.s, ang0, ang1, angleDiff(ang0, ang1) < 0); g2.stroke(); g2.setLineDash([]);
  }
}
const angleDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

const iconCache = {};
function drawItem2D(it) {
  const c = BY_TYPE[it.type] || {};
  const [sx, sy] = toS(it.x, it.y);
  g2.save(); g2.translate(sx, sy); g2.rotate(it.rot * DEG);
  const w = it.w * view.s, d = it.d * view.s;
  const selected = isSel('item', it.id), hov = hover && hover.kind === 'item' && hover.id === it.id;
  g2.fillStyle = hexA(it.color, it.h <= 0.06 ? 0.55 : 0.9);
  g2.strokeStyle = selected ? '#2a7de1' : 'rgba(30,40,50,.55)';
  g2.lineWidth = selected ? 2.5 : hov ? 1.8 : 1;
  if (it.elev > 0.5) g2.setLineDash([4, 3]);
  roundRect(-w / 2, -d / 2, w, d, Math.min(6, w / 6, d / 6)); g2.fill(); g2.stroke(); g2.setLineDash([]);
  // marcaj pentru „fața” obiectului
  if (it.h > 0.06 && d > 14) { g2.strokeStyle = 'rgba(255,255,255,.7)'; g2.lineWidth = 2; g2.beginPath(); g2.moveTo(-w / 2 + 4, d / 2 - 3); g2.lineTo(w / 2 - 4, d / 2 - 3); g2.stroke(); }
  const fs = Math.min(w, d) * 0.55;
  if (fs >= 9) { g2.rotate(-it.rot * DEG); g2.font = `${Math.min(28, fs)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(c.icon || '', 0, 1); g2.rotate(it.rot * DEG); }
  if (selected) {
    g2.strokeStyle = '#2a7de1'; g2.lineWidth = 1.5; g2.beginPath(); g2.moveTo(0, -d / 2); g2.lineTo(0, -d / 2 - 22); g2.stroke();
    g2.fillStyle = '#fff'; g2.beginPath(); g2.arc(0, -d / 2 - 26, 7, 0, Math.PI * 2); g2.fill(); g2.stroke();
    g2.fillStyle = '#2a7de1'; g2.font = '10px system-ui'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('⟳', 0, -d / 2 - 26);
  }
  g2.restore();
}
function roundRect(x, y, w, h, r) { g2.beginPath(); g2.moveTo(x + r, y); g2.arcTo(x + w, y, x + w, y + h, r); g2.arcTo(x + w, y + h, x, y + h, r); g2.arcTo(x, y + h, x, y, r); g2.arcTo(x, y, x + w, y, r); g2.closePath(); }
function hexA(hex, a) { const c = new THREE.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; }

function drawScale(W, H) {
  g2.save();
  const m = view.s >= 40 ? 1 : view.s >= 15 ? 2 : 5, len = m * view.s, x = 14, y = H - 54;
  g2.strokeStyle = '#3a4350'; g2.lineWidth = 2; g2.beginPath(); g2.moveTo(x, y - 5); g2.lineTo(x, y); g2.lineTo(x + len, y); g2.lineTo(x + len, y - 5); g2.stroke();
  g2.fillStyle = '#3a4350'; g2.font = '11px system-ui'; g2.textAlign = 'left'; g2.textBaseline = 'bottom'; g2.fillText(`${m} m`, x + 4, y - 4);
  // busolă
  const cx = W - 34, cy = H - 70; g2.translate(cx, cy); g2.rotate(-P.env.north * DEG);
  g2.fillStyle = '#c2410c'; g2.beginPath(); g2.moveTo(0, -16); g2.lineTo(6, 4); g2.lineTo(0, 0); g2.lineTo(-6, 4); g2.closePath(); g2.fill();
  g2.fillStyle = '#3a4350'; g2.font = '700 10px system-ui'; g2.textAlign = 'center'; g2.textBaseline = 'bottom'; g2.fillText('N', 0, -17);
  g2.restore();
}

// ---------- interacțiuni 2D ----------
function hitTest(x, y) {
  for (const l of P.labels) {
    g2.font = `600 ${l.size || 14}px system-ui, sans-serif`;
    const tw = (g2.measureText(l.text).width + 12) / view.s, th = ((l.size || 14) + 8) / view.s;
    if (Math.abs(x - l.x) < tw / 2 && Math.abs(y - l.y) < th / 2) return { kind: 'label', id: l.id };
  }
  for (const d of P.dims) {
    const L = dist(d.x1, d.y1, d.x2, d.y2), ux = (d.x2 - d.x1) / L, uy = (d.y2 - d.y1) / L;
    const t = (x - d.x1) * ux + (y - d.y1) * uy, n = Math.abs((x - d.x1) * uy - (y - d.y1) * ux);
    if (t > 0 && t < L && n < 8 / view.s) return { kind: 'dim', id: d.id };
  }
  const order = [...P.items].sort((a, b) => (b.elev || 0) - (a.elev || 0) || b.h - a.h);
  for (const it of order) {
    const dx = x - it.x, dy = y - it.y, a = -it.rot * DEG;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= it.w / 2 && Math.abs(ly) <= it.d / 2 && it.h > 0.06) return { kind: 'item', id: it.id };
  }
  for (const o of P.openings) {
    const w = getWall(o.wall); if (!w) continue;
    const L = wallLen(w), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
    const t = (x - w.x1) * ux + (y - w.y1) * uy, n = Math.abs((x - w.x1) * uy - (y - w.y1) * ux);
    if (n < w.t / 2 + 0.12 && Math.abs(t - o.pos) < o.w / 2) return { kind: 'opening', id: o.id };
  }
  const nw = nearestWall(x, y, 0.12 + 6 / view.s);
  if (nw && nw.d < nw.wall.t / 2 + 6 / view.s) return { kind: 'wall', id: nw.wall.id };
  for (const it of order) {
    const dx = x - it.x, dy = y - it.y, a = -it.rot * DEG;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= it.w / 2 && Math.abs(ly) <= it.d / 2) return { kind: 'item', id: it.id };
  }
  for (let i = P.rooms.length - 1; i >= 0; i--) if (inPoly(x, y, P.rooms[i].pts)) return { kind: 'room', id: P.rooms[i].id };
  for (const pa of P.paths) for (let i = 0; i < pa.pts.length - 1; i++) {
    const [ax, ay] = pa.pts[i], [bx, by] = pa.pts[i + 1], L = dist(ax, ay, bx, by) || 1e-6;
    const tt = Math.max(0, Math.min(L, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L));
    if (dist(x, y, ax + (bx - ax) * tt / L, ay + (by - ay) * tt / L) < pa.w / 2 + 3 / view.s) return { kind: 'path', id: pa.id };
  }
  for (let i = P.zones.length - 1; i >= 0; i--) if (inPoly(x, y, P.zones[i].pts)) return { kind: 'zone', id: P.zones[i].id };
  return null;
}

function snapToEndpoint(x, y, e) {
  if (e && e.shiftKey) return [x, y];
  const tol = 12 / view.s;
  for (const w of P.walls) for (const [px, py] of [[w.x1, w.y1], [w.x2, w.y2]]) if (dist(x, y, px, py) < tol) return [px, py];
  return [snapV(x, e), snapV(y, e)];
}

function rotHandleHit(x, y) {
  if (!sel || sel.kind !== 'item') return false;
  const it = P.items.find((i) => i.id === sel.id); if (!it) return false;
  const a = it.rot * DEG, off = it.d / 2 + 26 / view.s;
  const hx = it.x + Math.sin(a) * off, hy = it.y - Math.cos(a) * off;
  return dist(x, y, hx, hy) < 10 / view.s;
}
function endpointHit(x, y) {
  if (!sel || sel.kind !== 'wall') return null;
  const w = getWall(sel.id); if (!w) return null;
  if (dist(x, y, w.x1, w.y1) < 9 / view.s) return [w.x1, w.y1];
  if (dist(x, y, w.x2, w.y2) < 9 / view.s) return [w.x2, w.y2];
  return null;
}

c2d.addEventListener('pointerdown', (e) => {
  c2d.setPointerCapture(e.pointerId);
  const [x, y] = toW(e.offsetX, e.offsetY);
  if (e.button === 1 || e.button === 2) { drag = { kind: 'pan', sx: e.offsetX, sy: e.offsetY, ox: view.ox, oy: view.oy }; return; }
  if (tool === 'wall') {
    const p = snapToEndpoint(x, y, e);
    if (!wallChain) wallChain = [p];
    else {
      const q = wallChain[wallChain.length - 1];
      addWall(q[0], q[1], p[0], p[1]); wallChain.push(p);
      if (wallChain.length > 2 && dist(p[0], p[1], wallChain[0][0], wallChain[0][1]) < 0.01) { endWall(); }
      changed();
    }
    return;
  }
  if (tool === 'room' || tool === 'zone') { const [sx, sy] = [snapV(x, e), snapV(y, e)]; roomDraft = { x1: sx, y1: sy, x2: sx, y2: sy, zone: tool === 'zone' }; return; }
  if (tool === 'path') {
    const p = [snapV(x, e), snapV(y, e)];
    if (!pathDraft) pathDraft = [p];
    else { const q = pathDraft[pathDraft.length - 1]; if (dist(p[0], p[1], q[0], q[1]) > 0.1) pathDraft.push(p); }
    draw2D(); return;
  }
  if (tool === 'measure') { const p = snapToEndpoint(x, y, e); measure = { x1: p[0], y1: p[1], x2: p[0], y2: p[1], active: true }; return; }
  if (tool === 'text') {
    const t = prompt(t('Textul etichetei:'), t('Etichetă'));
    if (t && t.trim()) { const l = { id: uid('t'), x: r2(x), y: r2(y), text: t.trim().slice(0, 80), size: 14 }; P.labels.push(l); sel = { kind: 'label', id: l.id }; changed(false); }
    return;
  }
  if (tool === 'dim') { const p = snapToEndpoint(x, y, e); measure = { x1: p[0], y1: p[1], x2: p[0], y2: p[1], active: true, keep: true }; return; }
  if (OPENING_TOOLS[tool]) {
    const o = addOpening(tool, x, y);
    if (o) { sel = { kind: 'opening', id: o.id }; changed(); } else toast(t('Pune ușa sau fereastra pe un perete destul de lung.'));
    return;
  }
  // selectare
  if (rotHandleHit(x, y)) { drag = { kind: 'rotate', id: sel.id }; return; }
  const ep = endpointHit(x, y);
  if (ep) { drag = { kind: 'endpoint', from: ep, cur: ep }; return; }
  const h = hitTest(x, y);
  sel = h; renderProps();
  if (h && h.kind === 'item') { const it = P.items.find((i) => i.id === h.id); drag = { kind: 'item', id: h.id, dx: x - it.x, dy: y - it.y, moved: false }; }
  else if (h && h.kind === 'opening') drag = { kind: 'opening', id: h.id };
  else if (h && h.kind === 'label') { const l = P.labels.find((i) => i.id === h.id); drag = { kind: 'label', id: h.id, dx: x - l.x, dy: y - l.y }; }
  else if (h && (h.kind === 'path' || h.kind === 'zone')) drag = { kind: 'shape', obj: findSel(), lx: snapV(x, e), ly: snapV(y, e) };
  else if (!h || h.kind === 'room') drag = { kind: 'pan', sx: e.offsetX, sy: e.offsetY, ox: view.ox, oy: view.oy, click: true };
  draw2D(); highlight3D();
});

c2d.addEventListener('pointermove', (e) => {
  const [x, y] = toW(e.offsetX, e.offsetY);
  mouseW = tool === 'wall' ? snapToEndpoint(x, y, e) : [x, y];
  if (tool === 'wall' && wallChain && !e.shiftKey) {
    // aliniere orizontală / verticală
    const q = wallChain[wallChain.length - 1];
    if (Math.abs(mouseW[0] - q[0]) < 0.25) mouseW[0] = q[0];
    if (Math.abs(mouseW[1] - q[1]) < 0.25) mouseW[1] = q[1];
  }
  if (roomDraft) { roomDraft.x2 = snapV(x, e); roomDraft.y2 = snapV(y, e); }
  if (measure && measure.active) { const p = snapToEndpoint(x, y, e); measure.x2 = p[0]; measure.y2 = p[1]; }
  if (drag) {
    if (drag.kind === 'pan') { view.ox = drag.ox + e.offsetX - drag.sx; view.oy = drag.oy + e.offsetY - drag.sy; if (Math.abs(e.offsetX - drag.sx) + Math.abs(e.offsetY - drag.sy) > 3) drag.click = false; }
    else if (drag.kind === 'item') {
      const it = P.items.find((i) => i.id === drag.id);
      it.x = r2(snapV(x - drag.dx, e)); it.y = r2(snapV(y - drag.dy, e)); drag.moved = true;
      moveItem3D(it);
    } else if (drag.kind === 'rotate') {
      const it = P.items.find((i) => i.id === drag.id);
      let a = Math.atan2(x - it.x, -(y - it.y)) / DEG;
      if (!e.shiftKey) a = Math.round(a / 15) * 15;
      it.rot = (a + 360) % 360; drag.moved = true; moveItem3D(it);
    } else if (drag.kind === 'opening') {
      const o = P.openings.find((i) => i.id === drag.id), w = getWall(o.wall), L = wallLen(w);
      const t = (x - w.x1) * (w.x2 - w.x1) / L + (y - w.y1) * (w.y2 - w.y1) / L;
      o.pos = r2(Math.max(o.w / 2 + 0.05, Math.min(L - o.w / 2 - 0.05, snapV(t, e)))); drag.moved = true;
    } else if (drag.kind === 'label') {
      const l = P.labels.find((i) => i.id === drag.id); l.x = r2(x - drag.dx); l.y = r2(y - drag.dy); drag.moved = true;
    } else if (drag.kind === 'shape') {
      const nx = snapV(x, e), ny = snapV(y, e), dx = nx - drag.lx, dy = ny - drag.ly;
      if (dx || dy) { for (const p of drag.obj.pts) { p[0] = r2(p[0] + dx); p[1] = r2(p[1] + dy); } drag.lx = nx; drag.ly = ny; drag.moved = true; }
    } else if (drag.kind === 'endpoint') {
      const p = [snapV(x, e), snapV(y, e)];
      moveVertex(drag.cur, p); drag.cur = p; drag.moved = true;
    }
  } else if (tool === 'select') {
    const h = rotHandleHit(x, y) || endpointHit(x, y) ? null : hitTest(x, y);
    const k = h ? h.kind + h.id : '', hk = hover ? hover.kind + hover.id : '';
    hover = h; c2d.style.cursor = rotHandleHit(x, y) || endpointHit(x, y) ? 'grab' : h && h.kind !== 'room' ? 'move' : 'default';
    if (k === hk) return;
  } else c2d.style.cursor = 'crosshair';
  draw2D();
});

c2d.addEventListener('pointerup', () => {
  if (roomDraft) {
    const { x1, y1, x2, y2, zone } = roomDraft; roomDraft = null;
    if (zone) {
      const a = Math.min(x1, x2), b = Math.min(y1, y2), c = Math.max(x1, x2), d = Math.max(y1, y2);
      if (c - a >= 0.3 && d - b >= 0.3) { const z = { id: uid('z'), type: zoneType, pts: [[a, b], [c, b], [c, d], [a, d]] }; P.zones.push(z); sel = { kind: 'zone', id: z.id }; changed(); } else draw2D();
    } else {
      const rm = addRoom(x1, y1, x2, y2);
      if (rm) { sel = { kind: 'room', id: rm.id }; changed(); } else draw2D();
    }
  }
  if (measure && measure.active) {
    measure.active = false; const L = dist(measure.x1, measure.y1, measure.x2, measure.y2);
    if (measure.keep) { if (L > 0.05) { const d = { id: uid('d'), x1: measure.x1, y1: measure.y1, x2: measure.x2, y2: measure.y2 }; P.dims.push(d); sel = { kind: 'dim', id: d.id }; } measure = null; changed(false); }
    else if (L > 0.01) toast(`${t('Distanța')}: ${fmt(L, 2)} m`);
  }
  if (drag) {
    if (drag.kind === 'pan' && drag.click) { sel = hitTest(...toW(drag.sx, drag.sy)); renderProps(); highlight3D(); draw2D(); }
    if (drag.moved) changed();
  }
  drag = null;
});
c2d.addEventListener('dblclick', () => { if (wallChain) endWall(); if (pathDraft) endPath(); });
c2d.addEventListener('contextmenu', (e) => e.preventDefault());
c2d.addEventListener('wheel', (e) => {
  e.preventDefault();
  const f = Math.exp(-e.deltaY * 0.0015), ns = Math.max(6, Math.min(250, view.s * f));
  const [x, y] = toW(e.offsetX, e.offsetY);
  view.s = ns; view.ox = e.offsetX - x * ns; view.oy = e.offsetY - y * ns; draw2D();
}, { passive: false });

function endWall() { wallChain = null; mouseW = null; draw2D(); }
let zoneType = 'gazon', pathMat = 'pavele';
function endPath() {
  const pts = pathDraft; pathDraft = null; mouseW = null;
  if (pts && pts.length >= 2) { const pa = { id: uid('a'), pts, w: 1.2, mat: pathMat }; P.paths.push(pa); sel = { kind: 'path', id: pa.id }; changed(); } else draw2D();
}

function moveVertex(from, to) {
  const eq = (x, y) => Math.abs(x - from[0]) < 0.005 && Math.abs(y - from[1]) < 0.005;
  for (const w of P.walls) {
    if (eq(w.x1, w.y1)) { w.x1 = to[0]; w.y1 = to[1]; }
    if (eq(w.x2, w.y2)) { w.x2 = to[0]; w.y2 = to[1]; }
  }
  for (const rm of P.rooms) for (const p of rm.pts) if (eq(p[0], p[1])) { p[0] = to[0]; p[1] = to[1]; }
  for (const o of P.openings) { const w = getWall(o.wall); if (w) { const L = wallLen(w); o.pos = Math.max(o.w / 2, Math.min(L - o.w / 2, o.pos)); } }
  rebuild3D();
}

function setTool(tl) {
  if (pathDraft && tl !== 'path') endPath();
  tool = tl; wallChain = null; roomDraft = null; measure = null;
  $$('.tool[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tl));
  const hints = {
    select: 'Clic pe un obiect ca să-l selectezi. Trage de el ca să-l muți. Trage pe fundal ca să muți planul.',
    room: 'Trage un dreptunghi: se creează camera cu pereții ei. Camerele lipite împart același perete.',
    wall: 'Clic pentru fiecare colț. Dublu-clic sau Esc ca să termini. Shift dezactivează alinierea.',
    door: 'Clic pe un perete ca să pui o ușă. Apoi o poți trage de-a lungul peretelui.',
    window: 'Clic pe un perete ca să pui o fereastră. Lățimea și înălțimea le schimbi în dreapta.',
    measure: 'Trage între două puncte ca să afli distanța.',
    door2: 'Clic pe un perete ca să pui o ușă dublă (1,40 m).',
    slide: 'Clic pe un perete ca să pui o ușă glisantă din sticlă (1,80 m).',
    balcony: 'Clic pe un perete exterior ca să pui o ușă de balcon (ușă-fereastră).',
    dim: 'Trage între două puncte ca să pui o cotă care rămâne pe plan.',
    text: 'Clic pe plan ca să scrii o etichetă. Apoi o poți muta cu mouse-ul.',
    path: 'Clic pentru fiecare punct al aleii. Dublu-clic sau Esc ca să termini. Materialul și lățimea le schimbi în dreapta.',
    zone: 'Trage un dreptunghi în grădină: gazon, strat de flori, pietriș, terasă, pavaj sau iaz.',
  };
  $('#toolHint').textContent = t(hints[tl]);
  c2d.style.cursor = tl === 'select' ? 'default' : 'crosshair';
  draw2D();
}
$$('.tool[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

// ================= Scena 3D =================
const host3 = $('#v3d');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
host3.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 400);
camera.position.set(14, 12, 16);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.target.set(5, 0, 3);

const hemi = new THREE.HemisphereLight('#cfe3f7', '#8b7b66', 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3e0', 3); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun); scene.add(sun.target);
const fill = new THREE.AmbientLight('#ffffff', 0.15); scene.add(fill);
// lumină ambientală dintr-o „cameră de studio” virtuală: reflexii și umbre moi pe toate suprafețele
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
ground.material.map.repeat.set(100, 100);
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true; scene.add(ground);

let root = new THREE.Group(); scene.add(root);
let world = root; // grupul în care se construiește nivelul curent (în afara construcției arată spre root)
const itemObjs = new Map();
let selBox = null;

function skyTexture(top, mid, bottom) {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.48, mid); gr.addColorStop(0.5, mid); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sunState() {
  const h = P.env.hour, t = (h - 6) / 12;
  const el = Math.sin(Math.PI * Math.max(-0.15, Math.min(1.15, t))) * 58 * DEG;
  const az = (-90 + 180 * t + P.env.north) * DEG;
  return { el, az, day: THREE.MathUtils.smoothstep(el, -0.05, 0.25) };
}
function lightsOn() {
  if (P.env.lights === 'on') return true;
  if (P.env.lights === 'off') return false;
  const h = P.env.hour; return h < 7.5 || h > 18.3;
}

let sceneCenter = new THREE.Vector3(5, 0, 3), sceneRadius = 10;
function applyEnv() { invalidate();
  const { el, az, day } = sunState();
  const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  sun.position.copy(sceneCenter).addScaledVector(dir, sceneRadius * 2.5);
  sun.target.position.copy(sceneCenter);
  const warm = THREE.MathUtils.smoothstep(el, 0, 0.45);
  sun.color.set('#ff9a52').lerp(new THREE.Color('#fff5e8'), warm);
  sun.intensity = 3.2 * THREE.MathUtils.smoothstep(el, -0.02, 0.2);
  if (el <= 0.02) { // lumina lunii
    sun.position.copy(sceneCenter).add(new THREE.Vector3(-0.5, 0.8, 0.4).normalize().multiplyScalar(sceneRadius * 2.5));
    sun.color.set('#8fa6d8'); sun.intensity = 0.35;
  }
  baseLight.hemi = 0.22 + 0.4 * day; baseLight.fill = 0.06 + 0.06 * day; baseLight.day = day;
  hemi.color.set('#3a4d75').lerp(new THREE.Color('#cfe3f7'), day);
  const sc = sun.shadow.camera, r = sceneRadius * 1.3;
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.5; sc.far = sceneRadius * 6; sc.updateProjectionMatrix();
  const top = new THREE.Color('#0b1426').lerp(new THREE.Color('#5d8fc9'), day);
  const mid = new THREE.Color('#1c2740').lerp(new THREE.Color(warm < 0.6 && day > 0.05 ? '#f3b58a' : '#cfe1f1'), day);
  const bot = new THREE.Color('#141a22').lerp(new THREE.Color('#9fb08f'), day);
  if (scene.background) scene.background.dispose();
  scene.background = skyTexture('#' + top.getHexString(), '#' + mid.getHexString(), '#' + bot.getHexString());
  baseLight.exposure = P.env.exposure * (0.85 + 0.35 * (1 - day));
  applyInterior(true);
  ground.material.color.set('#ffffff').multiplyScalar(0.35 + 0.65 * day);
  if (lastLights !== lightsOn()) rebuild3D();
}
let lastLights = null;
const baseLight = { hemi: 0.8, fill: 0.15, exposure: 1, day: 1 };
let wasInside = null;
// În interior lumina indirectă (reflectată de pereți) lipsește dintr-o randare simplă, așa că o compensăm.
function applyInterior(force) {
  const inside = cameraInside();
  if (!force && inside === wasInside) return;
  wasInside = inside;
  const d = baseLight.day;
  hemi.intensity = baseLight.hemi * (inside ? 1.3 : 1);
  // în interior lumina reflectată de podea luminează tavanul
  hemi.groundColor.set(inside ? '#cbbfae' : '#8b7b66');
  fill.intensity = baseLight.fill + (inside ? 0.2 * d + 0.04 : 0);
  renderer.toneMappingExposure = baseLight.exposure * (inside ? 1.1 : 1);
  // tavanul primește lumina reflectată de podea și pereți (simulată cu o ușoară emisie, mai slabă noaptea)
  root.traverse((o) => { if (o.userData.ceiling) { o.visible = P.env.ceiling || inside; o.material.emissiveIntensity = 0.06 + 0.3 * d; } if (o.userData.roof) o.visible = !inside; });
  // intensitatea luminii de mediu: mai mare ziua și în interior, aproape stinsă noaptea
  const envK = 0.04 + d * (inside ? 0.55 : 0.4);
  const seen = new Set();
  scene.traverse((m) => { const mm = m.material; if (mm && mm.isMeshStandardMaterial && !seen.has(mm)) { seen.add(mm); mm.envMapIntensity = envK; } });
}

function disposeGroup(g) { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }

function rebuild3D() { invalidate();
  scene.remove(root); disposeGroup(root);
  root = new THREE.Group(); scene.add(root); itemObjs.clear();
  lastLights = lightsOn();
  const keep = P.cur, last = P.levels.length - 1;
  // nivelurile de sub cel curent se văd mereu; cele de deasupra doar cu „Toate nivelurile”
  const show = P.env.allLevels && !P.env.cutaway ? last : keep;
  try {
    for (let i = 0; i <= show; i++) {
      P.cur = i;
      world = new THREE.Group(); world.position.y = levelElev(i); world.userData.level = i; root.add(world);
      buildLevel3D(i, i === last, i === keep);
      if (i !== keep) world.traverse((o) => { delete o.userData.ref; });
    }
  } finally { P.cur = keep; world = root; }
  // centrul scenei pentru umbre
  const b = bounds();
  sceneCenter.set((b.x1 + b.x2) / 2, 0, (b.y1 + b.y2) / 2);
  sceneRadius = Math.max(6, Math.hypot(b.x2 - b.x1, b.y2 - b.y1) / 2 + 1 + levelElev(show) * 0.5);
  applyEnv();
  highlight3D();
}
// golurile din planșeu deasupra scărilor unui nivel
function stairHoles(li) {
  const L = P.levels[li]; if (!L) return [];
  return L.items.filter((it) => (BY_TYPE[it.type] || {}).stair && it.type !== 'scara_pod' || it.type === 'scara').map((it) => {
    const a = it.rot * DEG, c = Math.cos(a), sn = Math.sin(a), hw = it.w / 2 + 0.05, hd = it.d / 2 + 0.05;
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [it.x + u * c - v * sn, it.y + u * sn + v * c]);
  });
}
function roomShape(rm, holes) {
  const shape = new THREE.Shape(rm.pts.map(([x, y]) => new THREE.Vector2(x, -y)));
  for (const h of holes) if (inPoly(...polyCenter(h), rm.pts)) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, -y)).reverse()));
  return shape;
}
function buildLevel3D(li, isTop, isCur) {
  const wallH = (w) => P.env.cutaway ? Math.min(1.0, w.h) : w.h;
  const floorHoles = li > 0 ? stairHoles(li - 1) : [], ceilHoles = li < P.levels.length - 1 ? stairHoles(li) : [];
  const ceilY = P.walls.length ? Math.min(...P.walls.map((w) => w.h)) : 2.7;
  // podele
  for (const rm of P.rooms) {
    const shape = roomShape(rm, floorHoles);
    const geo = new THREE.ShapeGeometry(shape);
    const f = FLOORS[rm.floor] || FLOORS.stejar, tex = floorTexture(rm.floor);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / f.size, uv.getY(i) / f.size);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: rm.floor === 'marmura' ? 0.25 : 0.6 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.003; m.receiveShadow = true; m.userData.ref = { kind: 'room', id: rm.id };
    world.add(m);
    if (!P.env.cutaway) {
      // tavanul apare doar când camera e în interior (sau când e bifat „Tavan mereu”)
      const cg = new THREE.ShapeGeometry(ceilHoles.length ? roomShape(rm, ceilHoles) : shape); const cm = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: 0.9, side: THREE.DoubleSide, emissive: '#fbfaf7', emissiveIntensity: 0.06 + 0.3 * baseLight.day }));
      cm.rotation.x = -Math.PI / 2; cm.position.y = ceilY; cm.receiveShadow = true; cm.castShadow = true;
      cm.userData.ceiling = true; world.add(cm);
    }
  }
  // pereți cu goluri
  for (const w of P.walls) {
    const L = wallLen(w); if (L < 0.01) continue;
    const H = wallH(w), t = w.t, ang = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
    const grp = new THREE.Group();
    grp.position.set((w.x1 + w.x2) / 2, 0, (w.y1 + w.y2) / 2); grp.rotation.y = -ang;
    const fin = WALL_FINISHES[w.finish || P.env.finish] ? (w.finish || P.env.finish) : 'vopsea';
    const wm = wallMaterial(fin, w.color || P.env.wallColor), fsz = WALL_FINISHES[fin].size;
    const piece = (u0, u1, y0, y1) => {
      if (u1 - u0 < 0.001 || y1 - y0 < 0.001) return;
      const geo = new THREE.BoxGeometry(u1 - u0, y1 - y0, t);
      boxUV(geo, (u0 + u1) / 2 + L / 2 + w.x1 + w.y1, (y0 + y1) / 2, fsz);
      const m = new THREE.Mesh(geo, wm);
      m.position.set((u0 + u1) / 2, (y0 + y1) / 2, 0); m.castShadow = true; m.receiveShadow = true; m.userData.ref = { kind: 'wall', id: w.id };
      grp.add(m);
    };
    const ops = P.openings.filter((o) => o.wall === w.id).sort((a, b) => a.pos - b.pos);
    // la etaje peretele continuă în jos pe grosimea planșeului, ca fațada să fie continuă
    if (li > 0 && !P.env.cutaway) piece(-L / 2 - t / 2, L / 2 + t / 2, -SLAB, 0);
    const outSide = exteriorSide(w);
    let u = -L / 2 - t / 2;
    for (const o of ops) {
      const a = o.pos - o.w / 2 - L / 2, b = o.pos + o.w / 2 - L / 2;
      piece(u, a, 0, H);
      piece(a, b, 0, Math.min(H, o.sill));
      if (o.sill + o.h < H) piece(a, b, o.sill + o.h, H);
      if (o.sill < H) buildOpening3D(grp, o, a, b, t, Math.min(H, o.sill + o.h), outSide);
      u = b;
    }
    piece(u, L / 2 + t / 2, 0, H);
    world.add(grp);
  }
  if (isTop) buildRoof();
  buildGarden3D();
  // obiecte
  const on = lightsOn();
  for (const it of P.items) {
    const o = buildItem(it, on);
    o.position.set(it.x, it.elev || 0, it.y); o.rotation.y = -it.rot * DEG;
    o.traverse((m) => { m.userData.ref = { kind: 'item', id: it.id }; });
    world.add(o); if (isCur) itemObjs.set(it.id, o);
  }
}
// +1 dacă exteriorul e pe fața +z a peretelui (în sistemul lui local), -1 pe fața -z, 0 dacă e perete interior
function exteriorSide(w) {
  const L = wallLen(w); if (L < 0.01) return 0;
  const nx = -(w.y2 - w.y1) / L, ny = (w.x2 - w.x1) / L, mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2, o = w.t / 2 + 0.3;
  const p = inAnyRoom(mx + nx * o, my + ny * o), m = inAnyRoom(mx - nx * o, my - ny * o);
  return p && !m ? -1 : !p && m ? 1 : !p && !m ? 1 : 0;
}

// ---------- grădina: alei și zone (gazon, flori, pietriș, terasă, pavaj, apă) ----------
const gMats = new Map();
function gardenMat(kind, id) {
  const k = kind + id;
  if (!gMats.has(k)) {
    const water = kind === 'zone' && ZONE_TYPES[id] && ZONE_TYPES[id].water;
    gMats.set(k, water ? new THREE.MeshPhysicalMaterial({ color: '#2f7fa6', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.88, clearcoat: 1 })
      : new THREE.MeshStandardMaterial({ map: gardenTexture(kind, id), roughness: id === 'terasa' || id === 'lemn' ? 0.7 : 0.95 }));
  }
  return gMats.get(k);
}
// o suprafață plată din puncte de plan, cu textura la scară reală (size = metri pe textură)
function flatPoly(pts, y, m, size, ref) {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))));
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / size, uv.getY(i) / size);
  const mesh = new THREE.Mesh(geo, m); mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; mesh.receiveShadow = true;
  if (ref) mesh.userData.ref = ref;
  world.add(mesh); return mesh;
}
function buildGarden3D() {
  for (const z of P.zones) {
    const def = ZONE_TYPES[z.type] || ZONE_TYPES.gazon, ref = { kind: 'zone', id: z.id };
    if (def.water) {
      flatPoly(z.pts, 0.014, gardenMat('zone', z.type), def.size, ref);
      // bordura din piatră a iazului
      const stone = mat('#bdb6a8', { roughness: 0.9 });
      z.pts.forEach((p, i) => { const q = z.pts[(i + 1) % z.pts.length], L = dist(p[0], p[1], q[0], q[1]);
        const m = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 0.1, 0.3), stone); m.position.set((p[0] + q[0]) / 2, 0.05, (p[1] + q[1]) / 2); m.rotation.y = -Math.atan2(q[1] - p[1], q[0] - p[0]); m.castShadow = m.receiveShadow = true; m.userData.ref = ref; world.add(m); });
      continue;
    }
    flatPoly(z.pts, z.type === 'terasa' ? 0.1 : 0.008, gardenMat('zone', z.type), def.size, ref);
    if (z.type === 'terasa') { // marginea deck-ului
      const edge = mat('#7d5532', { roughness: 0.8 });
      z.pts.forEach((p, i) => { const q = z.pts[(i + 1) % z.pts.length], L = dist(p[0], p[1], q[0], q[1]);
        const m = new THREE.Mesh(new THREE.BoxGeometry(L, 0.1, 0.04), edge); m.position.set((p[0] + q[0]) / 2, 0.05, (p[1] + q[1]) / 2); m.rotation.y = -Math.atan2(q[1] - p[1], q[0] - p[0]); m.castShadow = true; m.userData.ref = ref; world.add(m); });
    }
    if (def.flowers) {
      // flori: tulpini cu frunze și flori colorate, distribuite întâmplător în strat
      const xs = z.pts.map((p) => p[0]), ys = z.pts.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const n = Math.min(1600, Math.round(polyArea(z.pts) * 28));
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const leaf = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 7, 5), mat('#3f6e34', { roughness: 0.9 }), n);
      const bloom = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 7, 5), new THREE.MeshStandardMaterial({ roughness: 0.6 }), n);
      const cols = (z.colors || ['#e0457b', '#f4c430', '#f7f2ea', '#9b59d0', '#ff7a3d']).map((c) => new THREE.Color(c));
      const mtx = new THREE.Matrix4(); let k = 0;
      for (let i = 0; i < n * 3 && k < n; i++) {
        const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
        if (!inPoly(x, y, z.pts)) continue;
        const sc = 0.7 + rnd() * 0.6;
        mtx.makeScale(sc, sc * 0.8, sc).setPosition(x, 0.1 * sc, y); leaf.setMatrixAt(k, mtx);
        mtx.makeScale(sc, sc, sc).setPosition(x + (rnd() - 0.5) * 0.05, 0.2 * sc + 0.05, y + (rnd() - 0.5) * 0.05); bloom.setMatrixAt(k, mtx);
        bloom.setColorAt(k, cols[Math.floor(rnd() * cols.length)]); k++;
      }
      leaf.count = bloom.count = k; leaf.castShadow = true;
      leaf.userData.ref = bloom.userData.ref = ref; world.add(leaf, bloom);
    }
  }
  for (const pa of P.paths) {
    if (pa.pts.length < 2) continue;
    const m = gardenMat('path', pa.mat), size = (PATH_MATS[pa.mat] || PATH_MATS.pavele).size, hw = pa.w / 2, ref = { kind: 'path', id: pa.id };
    for (let i = 0; i < pa.pts.length - 1; i++) {
      const [ax, ay] = pa.pts[i], [bx, by] = pa.pts[i + 1], L = dist(ax, ay, bx, by); if (L < 0.01) continue;
      const nx = -(by - ay) / L * hw, ny = (bx - ax) / L * hw;
      flatPoly([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]], 0.016, m, size, ref);
    }
    // îmbinări rotunjite la colțuri
    for (let i = 1; i < pa.pts.length - 1; i++) { const [cx, cy] = pa.pts[i]; flatPoly([...Array(20)].map((_, j) => [cx + Math.cos(j / 20 * Math.PI * 2) * hw, cy + Math.sin(j / 20 * Math.PI * 2) * hw]), 0.015, m, size, ref); }
  }
}

const wallMats = new Map();
function wallMaterial(fin, color) {
  const f = WALL_FINISHES[fin], key = fin + (f.tint ? color : '');
  if (!wallMats.has(key)) wallMats.set(key, new THREE.MeshStandardMaterial({ map: finishTexture(fin), color: f.tint ? color : '#ffffff', roughness: f.rough }));
  return wallMats.get(key);
}
// coordonate de textură la scară reală (metri), continue între bucățile aceluiași perete
function boxUV(geo, ox, oy, size) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + ox, y = p.getY(i) + oy, z = p.getZ(i);
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x / size, z / size);
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, z / size, y / size);
    else uv.setXY(i, x / size, y / size);
  }
}

// ---------- acoperiș ----------
function buildRoof() {
  if (P.env.roof === 'fara' || P.env.cutaway || !P.walls.length) return;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, H = 0;
  for (const w of P.walls) { x0 = Math.min(x0, w.x1, w.x2); x1 = Math.max(x1, w.x1, w.x2); z0 = Math.min(z0, w.y1, w.y2); z1 = Math.max(z1, w.y1, w.y2); H = Math.max(H, w.h); }
  const tmax = Math.max(...P.walls.map((w) => w.t)) / 2;
  x0 -= tmax; x1 += tmax; z0 -= tmax; z1 += tmax;
  const grp = new THREE.Group(); grp.userData.roof = true;
  const rm = new THREE.MeshStandardMaterial({ map: roofTexture(), color: P.env.roofColor, roughness: 0.8, side: THREE.DoubleSide });
  const wm = wallMaterial(WALL_FINISHES[P.env.finish] ? P.env.finish : 'vopsea', P.env.wallColor);
  if (P.env.roof === 'plat') {
    const o = 0.15, geo = new THREE.BoxGeometry(x1 - x0 + 2 * o, 0.3, z1 - z0 + 2 * o);
    const m = new THREE.Mesh(geo, mat('#8b8d90', { roughness: 0.9 })); m.position.set((x0 + x1) / 2, H + 0.15, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; grp.add(m);
    const atic = (w, d, x, z) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, d), wm); k.position.set(x, H + 0.3 + 0.225, z); k.castShadow = true; grp.add(k); };
    atic(x1 - x0 + 2 * o, 0.15, (x0 + x1) / 2, z0 - o + 0.075); atic(x1 - x0 + 2 * o, 0.15, (x0 + x1) / 2, z1 + o - 0.075);
    atic(0.15, z1 - z0 + 2 * o, x0 - o + 0.075, (z0 + z1) / 2); atic(0.15, z1 - z0 + 2 * o, x1 + o - 0.075, (z0 + z1) / 2);
    world.add(grp); return;
  }
  // lucrăm cu axa lungă pe „a” și cea scurtă pe „b”, apoi convertim în x/z
  const alongX = x1 - x0 >= z1 - z0;
  const A0 = alongX ? x0 : z0, A1 = alongX ? x1 : z1, B0 = alongX ? z0 : x0, B1 = alongX ? z1 : x1;
  const k = Math.tan(32 * DEG), o = 0.45;
  const eA0 = A0 - o, eA1 = A1 + o, eB0 = B0 - o, eB1 = B1 + o, hs = (eB1 - eB0) / 2, Bm = (B0 + B1) / 2;
  const He = H - o * k, Hr = He + hs * k;
  const P3 = (a, y, b) => (alongX ? [a, y, b] : [b, y, a]);
  const pos = [], uvs = [], gpos = [];
  const slopeLen = hs / Math.cos(32 * DEG), S = 1.6;
  const tri = (arr, p1, p2, p3, uvArr) => { arr.push(...p1, ...p2, ...p3); if (uvArr) uvs.push(...uvArr); };
  // fiecare punct: [a, y, b]; UV: u = a, v = distanța pe pantă
  const sv = (y) => ((Hr - y) / k) / Math.cos(32 * DEG) / S;
  const hip = P.env.roof === 'patru_ape';
  const rA0 = hip ? eA0 + hs : eA0, rA1 = hip ? eA1 - hs : eA1;
  for (const side of [0, 1]) {
    const eb = side ? eB1 : eB0;
    const q = [[eA0, He, eb], [eA1, He, eb], [rA1, Hr, Bm], [rA0, Hr, Bm]];
    const qq = q.map(([a, y, b]) => P3(a, y, b)), qu = q.map(([a, y]) => [a / S, sv(y)]);
    tri(pos, qq[0], qq[1], qq[2], [...qu[0], ...qu[1], ...qu[2]]);
    tri(pos, qq[0], qq[2], qq[3], [...qu[0], ...qu[2], ...qu[3]]);
  }
  if (hip) {
    for (const [ea, ra] of [[eA0, rA0], [eA1, rA1]]) {
      const t3 = [[ea, He, eB0], [ea, He, eB1], [ra, Hr, Bm]];
      tri(pos, ...t3.map(([a, y, b]) => P3(a, y, b)), t3.flatMap(([, y, b]) => [b / S, sv(y)]));
    }
  } else {
    // frontoane (triunghiurile de zid de la capete)
    for (const a of [A0, A1]) tri(gpos, P3(a, H, B0), P3(a, H, B1), P3(a, Hr - o * k * 0 - (o) * 0, Bm));
  }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); rg.computeVertexNormals();
  const roof = new THREE.Mesh(rg, rm); roof.castShadow = true; roof.receiveShadow = true; grp.add(roof);
  if (gpos.length) {
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
    const guv = []; for (let i = 0; i < gpos.length; i += 3) guv.push((alongX ? gpos[i + 2] : gpos[i]) / 2, gpos[i + 1] / 2);
    gg.setAttribute('uv', new THREE.Float32BufferAttribute(guv, 2)); gg.computeVertexNormals();
    const gm = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: wm.map, color: wm.color, roughness: wm.roughness, side: THREE.DoubleSide })); gm.castShadow = true; gm.receiveShadow = true; grp.add(gm);
  }
  // streașina: o margine subțire
  const fascia = mat('#f2efe9');
  for (const eb of [eB0, eB1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(alongX ? eA1 - eA0 : 0.04, 0.16, alongX ? 0.04 : eA1 - eA0), fascia); const c = P3((eA0 + eA1) / 2, He - 0.06, eb); f.position.set(...c); grp.add(f); }
  void slopeLen;
  if (P.env.gutters) {
    // jgheaburi semirotunde sub streașină și burlane la colțuri, până la pământ
    const gm = new THREE.MeshStandardMaterial({ color: P.env.gutterColor, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide });
    const pipe = (p1, p2, r) => {
      const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2), len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), gm);
      m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); m.castShadow = true; grp.add(m);
    };
    const gutter = (a0, a1, b, outward, along) => {
      // „along” = true: jgheabul merge pe axa a; altfel pe axa b
      const len = Math.abs(a1 - a0), half = new THREE.CylinderGeometry(0.075, 0.075, len, 14, 1, true, 0, Math.PI);
      const m = new THREE.Mesh(half, gm); m.castShadow = true;
      const g = new THREE.Group(); g.add(m); m.rotation.z = -Math.PI / 2;
      const mid = (a0 + a1) / 2, pos = along ? P3(mid, He - 0.07, b + outward * 0.08) : P3(b + outward * 0.08, He - 0.07, mid);
      g.position.set(...pos);
      const dirX = along ? alongX : !alongX; if (!dirX) g.rotation.y = Math.PI / 2;
      grp.add(g);
    };
    for (const [eb, sg] of [[eB0, -1], [eB1, 1]]) {
      gutter(eA0, eA1, eb, sg, true);
      const wallB = (sg < 0 ? B0 : B1) + sg * 0.09;
      for (const a of [A0 + 0.25, A1 - 0.25]) {
        pipe(P3(a, He - 0.1, eb + sg * 0.08), P3(a, He - 0.45, wallB), 0.045);
        pipe(P3(a, He - 0.45, wallB), P3(a, 0.2, wallB), 0.045);
        pipe(P3(a, 0.2, wallB), P3(a, 0.05, wallB + sg * 0.18), 0.045);
      }
    }
    if (hip) for (const [ea, sg] of [[eA0, -1], [eA1, 1]]) gutter(eB0, eB1, ea, sg, false);
  }
  world.add(grp);
}

const FRAME_COLORS = { alb: ['PVC alb', '#f7f7f5'], antracit: ['Antracit', '#3a3d42'], lemn: ['Lemn', '#8a5a35'], negru: ['Negru', '#1f2124'] };
const GLAF_TYPES = { antracit: ['Aluminiu antracit', '#3a3d42'], alb: ['Aluminiu alb', '#eeeeec'], maro: ['Aluminiu maro', '#5b4030'], piatra: ['Piatră (travertin)', '#d2c9b8'], tabla: ['Tablă zincată', '#a9adb1'], fara: ['Fără glaf', ''] };
function buildOpening3D(grp, o, a, b, t, top, outSide = 0) {
  const frame = mat((FRAME_COLORS[o.frame] || FRAME_COLORS.alb)[1], { roughness: 0.5 }), wood = mat('#9a6b43', { roughness: 0.6 });
  const fw = 0.05, mid = (a + b) / 2, w = b - a;
  if (o.type === 'window') {
    const h = top - o.sill;
    const add = (bw, bh, bd, x, y, m) => { const k = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m); k.position.set(x, y, 0); k.castShadow = true; grp.add(k); };
    add(w, fw, t * 0.6, mid, o.sill + fw / 2, frame); add(w, fw, t * 0.6, mid, top - fw / 2, frame);
    add(fw, h, t * 0.6, a + fw / 2, o.sill + h / 2, frame); add(fw, h, t * 0.6, b - fw / 2, o.sill + h / 2, frame);
    if (w > 1.1) add(fw * 0.8, h, t * 0.5, mid, o.sill + h / 2, frame);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w - fw, h - fw, 0.01), new THREE.MeshPhysicalMaterial({ color: '#cfe6f3', transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0, depthWrite: false }));
    glass.position.set(mid, o.sill + h / 2, 0); grp.add(glass);
    if (!outSide || o.sill < 0.05) {
      if (o.sill >= 0.05) { const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.03, t + 0.08), frame); sill.position.set(mid, o.sill - 0.015, 0); sill.castShadow = true; sill.receiveShadow = true; grp.add(sill); }
    } else {
      const s = outSide, gt = GLAF_TYPES[o.glaf || 'antracit'] || GLAF_TYPES.antracit, out = o.glafOut != null ? o.glafOut : 0.05;
      // pervazul interior
      const pv = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.025, t / 2 + 0.03), mat('#f3f1ec', { roughness: 0.4 }));
      pv.position.set(mid, o.sill - 0.0125, -s * (t / 4 + 0.015)); pv.castShadow = pv.receiveShadow = true; grp.add(pv);
      if (gt[1]) {
        // glaful exterior, ușor înclinat spre afară, cu lăcrimar (muchia de picurare) ca apa să nu curgă pe fațadă
        const gm = mat(gt[1], { roughness: o.glaf === 'piatra' ? 0.8 : 0.35, metalness: o.glaf === 'piatra' ? 0 : 0.4 });
        const gd = t / 2 + out, gl = new THREE.Group(); gl.position.set(mid, o.sill - 0.012, 0); gl.rotation.x = s * 0.06; grp.add(gl);
        const plate = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, o.glaf === 'piatra' ? 0.03 : 0.012, gd), gm); plate.position.z = s * gd / 2; plate.castShadow = plate.receiveShadow = true; gl.add(plate);
        const drip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.04, 0.012), gm); drip.position.set(0, -0.02, s * gd); drip.castShadow = true; gl.add(drip);
        for (const ex of [-1, 1]) { const cap = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.035, gd), gm); cap.position.set(ex * (w / 2 + 0.03), 0.015, s * gd / 2); gl.add(cap); }
      }
    }
  } else if (o.style === 'glisanta') {
    const alu = mat('#3a3d42', { roughness: 0.4, metalness: 0.5 });
    const add = (bw, bh, bd, x, y, z, m) => { const k = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m); k.position.set(x, y, z); k.castShadow = true; grp.add(k); };
    add(fw, top, t * 0.7, a + fw / 2, top / 2, 0, alu); add(fw, top, t * 0.7, b - fw / 2, top / 2, 0, alu); add(w, fw, t * 0.7, mid, top - fw / 2, 0, alu); add(w, 0.03, t * 0.7, mid, 0.015, 0, alu);
    const pw = (w - 2 * fw) * 0.55, glass = new THREE.MeshPhysicalMaterial({ color: '#cfe6f3', transparent: true, opacity: 0.2, roughness: 0.02, depthWrite: false });
    for (const [x, z] of [[a + fw + pw / 2, -t * 0.15], [b - fw - pw / 2 - (w - 2 * fw) * 0.25, t * 0.15]]) {
      add(pw, 0.04, 0.04, x, top - fw - 0.02, z, alu); add(pw, 0.06, 0.04, x, 0.06, z, alu);
      add(0.04, top - fw, 0.04, x - pw / 2 + 0.02, (top - fw) / 2, z, alu); add(0.04, top - fw, 0.04, x + pw / 2 - 0.02, (top - fw) / 2, z, alu);
      const g = new THREE.Mesh(new THREE.BoxGeometry(pw - 0.06, top - fw - 0.1, 0.01), glass); g.position.set(x, (top - fw) / 2 + 0.03, z); grp.add(g);
    }
  } else if (o.style === 'dubla') {
    const add = (bw, bh, x, y) => { const k = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, t + 0.02), frame); k.position.set(x, y, 0); k.castShadow = true; grp.add(k); };
    add(fw, top, a + fw / 2, top / 2); add(fw, top, b - fw / 2, top / 2); add(w, fw, mid, top - fw / 2);
    const leafW = (w - 2 * fw) / 2;
    for (const [px, sgn] of [[a + fw, 1], [b - fw, -1]]) {
      const pivot = new THREE.Group(); pivot.position.set(px, 0, t / 2); pivot.rotation.y = -sgn * 55 * DEG;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, top - fw - 0.01, 0.04), wood);
      leaf.position.set(sgn * leafW / 2, (top - fw) / 2, 0.02); leaf.castShadow = true; leaf.receiveShadow = true; pivot.add(leaf);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), mat('#c9b26b', { metalness: 0.8, roughness: 0.3 })); knob.position.set(sgn * (leafW - 0.08), 1.0, 0.06); pivot.add(knob);
      grp.add(pivot);
    }
  } else {
    const add = (bw, bh, x, y) => { const k = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, t + 0.02), frame); k.position.set(x, y, 0); k.castShadow = true; grp.add(k); };
    add(fw, top, a + fw / 2, top / 2); add(fw, top, b - fw / 2, top / 2); add(w, fw, mid, top - fw / 2);
    // foaia ușii, întredeschisă
    const leafW = w - 2 * fw, pivot = new THREE.Group();
    pivot.position.set(a + fw, 0, t / 2); pivot.rotation.y = -65 * DEG;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, top - fw - 0.01, 0.04), wood);
    leaf.position.set(leafW / 2, (top - fw) / 2, 0.02); leaf.castShadow = true; leaf.receiveShadow = true; pivot.add(leaf);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), mat('#c9b26b', { metalness: 0.8, roughness: 0.3 }));
    knob.position.set(leafW - 0.08, 1.0, 0.06); pivot.add(knob);
    grp.add(pivot);
  }
}

function moveItem3D(it) {
  const o = itemObjs.get(it.id);
  if (o) { o.position.set(it.x, it.elev || 0, it.y); o.rotation.y = -it.rot * DEG; }
  draw2D(); highlight3D();
}

function highlight3D() { invalidate();
  if (selBox) { scene.remove(selBox); selBox.geometry.dispose(); selBox = null; }
  if (sel && sel.kind === 'item' && itemObjs.get(sel.id)) {
    selBox = new THREE.BoxHelper(itemObjs.get(sel.id), 0x2a7de1); scene.add(selBox);
  }
}

// selectare în 3D
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(world.children, true).find((h) => h.object.userData.ref);
  sel = hit ? hit.object.userData.ref : null;
  renderProps(); draw2D(); highlight3D();
});

function cameraInside(cam = camera) {
  const show = P.env.allLevels && !P.env.cutaway ? P.levels.length - 1 : P.cur, { x, y, z } = cam.position;
  let e = 0;
  for (let i = 0; i <= show; i++) {
    const L = P.levels[i], top = levelTop(L);
    if (y > e && y < e + top - 0.1 && L.rooms.some((r) => inPoly(x, z, r.pts))) return true;
    e += top + SLAB;
  }
  return false;
}
function updateCeiling(force) { applyInterior(force); }

function resize3D() { invalidate();
  const r = host3.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
}

// Modulele pentru umbrele de contact se descarcă doar când e nevoie de ele
// (la „Calitate înaltă” sau la randare), ca editorul să pornească mai repede.
let PP = null, ppLoading = null;
function loadPP() {
  if (!ppLoading) ppLoading = Promise.all([
    import('../vendor/jsm/postprocessing/EffectComposer.js'), import('../vendor/jsm/postprocessing/RenderPass.js'),
    import('../vendor/jsm/postprocessing/GTAOPass.js'), import('../vendor/jsm/postprocessing/OutputPass.js'),
  ]).then(([a, b, c, d]) => { PP = { ...a, ...b, ...c, ...d }; invalidate(); return PP; });
  return ppLoading;
}
// randare cu umbre de contact (ambient occlusion)
function makeComposer(cam, w, h) {
  const { EffectComposer, RenderPass, GTAOPass, OutputPass } = PP;
  const comp = new EffectComposer(renderer);
  comp.setPixelRatio(renderer.getPixelRatio()); comp.setSize(w, h);
  comp.addPass(new RenderPass(scene, cam));
  const ao = new GTAOPass(scene, cam, w, h);
  ao.blendIntensity = 1.0;
  ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.5, thickness: 1.5, scale: 1.4, samples: 16, distanceFallOff: 1 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  comp.addPass(ao); comp.addPass(new OutputPass());
  comp.aoPass = ao;
  return comp;
}
let liveComp = null;
function liveComposer() {
  const r = host3.getBoundingClientRect();
  if (!liveComp || liveComp.w !== r.width || liveComp.h !== r.height) {
    if (liveComp) { liveComp.aoPass.dispose(); liveComp.dispose(); }
    liveComp = makeComposer(camera, r.width, r.height); liveComp.w = r.width; liveComp.h = r.height;
  }
  return liveComp;
}

let rendering = false;
// Vederea 3D se desenează doar când se schimbă ceva (camera, proiectul, selecția, lumina),
// nu de 60 de ori pe secundă. În modul „Calitate înaltă” umbrele de contact se calculează
// când camera stă pe loc, iar în timpul mișcării se folosește desenarea rapidă.
let dirty = true, lastChange = 0, aoDone = false, lastDraw = 0;
function invalidate() { dirty = true; lastChange = performance.now(); aoDone = false; }
window.__frames = 0;
function loop() {
  requestAnimationFrame(loop);
  if (rendering) return;
  const now = performance.now();
  walkStep(now);
  if (controls.update()) invalidate();
  if (P.env.hq && !PP) loadPP();
  const wantAO = P.env.hq && PP && !aoDone && now - lastChange > 160;
  if (!dirty && !wantAO && now - lastDraw < 2000) return;
  if (host3.offsetWidth <= 2) return;
  updateCeiling();
  if (selBox) selBox.update();
  if (wantAO) { liveComposer().render(); aoDone = true; } else renderer.render(scene, camera);
  dirty = false; lastDraw = now; window.__frames++;
}
controls.addEventListener('change', invalidate);
for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'input', 'change', 'click']) window.addEventListener(ev, () => { dirty = true; }, { passive: true, capture: true });

// ---------- modul „persoană” ----------
// Camera stă la înălțimea ochilor și se rotește pe loc (360°), ca un om care privește în jur.
// Rotița, W/S sau săgețile te duc înainte și înapoi, A/D în lateral, dublu-clic pe podea te duce acolo.
// Pereții te opresc, ușile te lasă să treci. Modificările din proiect nu mută camera.
let walk = false, walkAnim = null, walkT = 0;
const walkKeys = new Set();
const EYE = 1.6;
function lookAhead(dist = 0.05) {
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  controls.target.copy(camera.position).addScaledVector(d, dist);
}
function setWalk(on) {
  walk = on; walkKeys.clear();
  controls.enableZoom = !on; controls.enablePan = !on;
  controls.rotateSpeed = on ? 0.45 : 1;
  controls.minDistance = on ? 0.01 : 0.2;
  controls.minPolarAngle = on ? 0.2 : 0; controls.maxPolarAngle = on ? Math.PI - 0.2 : Math.PI * 0.495;
  if (on) lookAhead();
  $('#walkHint').hidden = !on;
  invalidate();
}
function levelAt(y) { let e = 0; for (let i = 0; i < P.levels.length; i++) { const top = levelTop(P.levels[i]); if (y < e + top + SLAB) return i; e += top + SLAB; } return P.levels.length - 1; }
function blocked(x, z) {
  const L = P.levels[levelAt(camera.position.y)];
  for (const w of L.walls) {
    const len = wallLen(w); if (len < 0.01) continue;
    const ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len, tt = (x - w.x1) * ux + (z - w.y1) * uy;
    if (tt < -0.25 || tt > len + 0.25) continue;
    const tc = Math.max(0, Math.min(len, tt));
    if (dist(x, z, w.x1 + ux * tc, w.y1 + uy * tc) > w.t / 2 + 0.22) continue;
    if (!L.openings.some((o) => o.wall === w.id && (o.type === 'door' || o.sill < 0.3) && Math.abs(tt - o.pos) < o.w / 2 - 0.08)) return true;
  }
  return false;
}
function walkBy(dx, dz) {
  const p = camera.position;
  if (!blocked(p.x, p.z) && blocked(p.x + dx, p.z + dz)) {
    if (!blocked(p.x + dx, p.z)) dz = 0; else if (!blocked(p.x, p.z + dz)) dx = 0; else return;
  }
  p.x += dx; p.z += dz; controls.target.x += dx; controls.target.z += dz; invalidate();
}
function walkStep(now) {
  const dt = Math.min(0.05, (now - walkT) / 1000); walkT = now;
  if (walkAnim) {
    const k = Math.min(1, (now - walkAnim.t0) / 450), e = k * k * (3 - 2 * k);
    const np = walkAnim.from.clone().lerp(walkAnim.to, e), d = np.clone().sub(camera.position);
    camera.position.add(d); controls.target.add(d); invalidate();
    if (k >= 1) walkAnim = null;
  }
  if (!walk || !walkKeys.size) return;
  const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; if (f.lengthSq() < 1e-6) return; f.normalize();
  let mx = 0, mz = 0;
  if (walkKeys.has('w')) { mx += f.x; mz += f.z; } if (walkKeys.has('s')) { mx -= f.x; mz -= f.z; }
  if (walkKeys.has('d')) { mx -= f.z; mz += f.x; } if (walkKeys.has('a')) { mx += f.z; mz -= f.x; }
  const L = Math.hypot(mx, mz); if (!L) return;
  const sp = (walkKeys.has('shift') ? 3.2 : 1.4) * dt / L;
  walkBy(mx * sp, mz * sp);
}
renderer.domElement.addEventListener('wheel', (e) => {
  if (!walk) return; e.preventDefault();
  const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
  const st = Math.max(-0.45, Math.min(0.45, -e.deltaY * 0.003));
  walkBy(f.x * st, f.z * st);
}, { passive: false });
renderer.domElement.addEventListener('dblclick', (e) => {
  if (!walk) return;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([root, ground], true).find((h) => h.face && h.object.visible && h.face.normal.clone().transformDirection(h.object.matrixWorld).y > 0.7 && h.point.y < camera.position.y);
  if (!hit) return;
  const d = new THREE.Vector3(hit.point.x - camera.position.x, 0, hit.point.z - camera.position.z);
  const L = d.length(); if (L < 0.3) return;
  d.multiplyScalar((L - 0.25) / L);
  walkAnim = { from: camera.position.clone(), to: new THREE.Vector3(camera.position.x + d.x, hit.point.y + EYE, camera.position.z + d.z), t0: performance.now() };
});
const WALK_KEYS = { w: 'w', arrowup: 'w', s: 's', arrowdown: 's', a: 'a', arrowleft: 'a', d: 'd', arrowright: 'd', shift: 'shift' };
window.addEventListener('keydown', (e) => {
  if (!walk || e.ctrlKey || e.metaKey || e.target.matches('input, select, textarea')) return;
  const k = WALK_KEYS[e.key.toLowerCase()]; if (!k) return;
  e.preventDefault(); walkKeys.add(k); invalidate();
});
window.addEventListener('keyup', (e) => { const k = WALK_KEYS[e.key.toLowerCase()]; if (k) walkKeys.delete(k); });
window.addEventListener('blur', () => walkKeys.clear());
$$('#walkHint [data-walk]').forEach((b) => {
  const k = b.dataset.walk, off = () => walkKeys.delete(k);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); walkKeys.add(k); invalidate(); });
  b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
});

function houseBounds() {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const L of P.levels) for (const w of L.walls) { a = Math.min(a, w.x1, w.x2); b = Math.min(b, w.y1, w.y2); c = Math.max(c, w.x1, w.x2); d = Math.max(d, w.y1, w.y2); }
  return isFinite(a) ? { x1: a, y1: b, x2: c, y2: d } : bounds();
}
function setCam(kind) {
  $$('#camBtns .chip').forEach((b) => b.classList.toggle('on', b.dataset.cam === kind));
  const b = bounds(), cx = (b.x1 + b.x2) / 2, cz = (b.y1 + b.y2) / 2, el = levelElev(P.cur);
  const R = Math.max(b.x2 - b.x1, b.y2 - b.y1) * Math.max(0.8, 1.1 / Math.max(0.3, camera.aspect));
  setWalk(false);
  if (kind === 'top') { camera.position.set(cx, el + R * 1.6 + 4, cz + 0.01); controls.target.set(cx, el, cz); camera.fov = 50; }
  else if (kind === 'persp') { camera.position.set(cx + R * 0.55, el + R * 0.85 + 3, cz + R * 0.95); controls.target.set(cx, el, cz); camera.fov = 45; }
  else if (kind === 'exterior' || kind === 'gradina') {
    // afară, la înălțimea ochilor, cu toată casa (toate nivelurile) vizibilă
    if (!P.env.allLevels && P.levels.length > 1) { P.env.allLevels = true; syncLevelUI(); rebuild3D(); }
    const h = houseBounds(), hx = (h.x1 + h.x2) / 2, hz = (h.y1 + h.y2) / 2;
    if (kind === 'exterior') { camera.position.set(hx - R * 0.65, EYE, hz + R * 1.25); camera.fov = 55; }
    else {
      // în grădină: în capătul cu cea mai multă grădină, privind spre casă
      const f = (() => { let a = Infinity, bb = Infinity, c = -Infinity, d = -Infinity; const add = (x, y) => { a = Math.min(a, x); bb = Math.min(bb, y); c = Math.max(c, x); d = Math.max(d, y); };
        for (const L of P.levels) { for (const it of L.items) add(it.x, it.y); for (const z of L.zones) z.pts.forEach((p) => add(...p)); for (const pa of L.paths) pa.pts.forEach((p) => add(...p)); }
        return isFinite(a) ? { x1: Math.min(a, h.x1), y1: Math.min(bb, h.y1), x2: Math.max(c, h.x2), y2: Math.max(d, h.y2) } : h; })();
      // dintr-un colț al grădinii se vede mai mult decât din mijlocul laturii
      const cxs = hx - f.x1 > f.x2 - hx ? f.x1 + 0.6 : f.x2 - 0.6, czs = hz - f.y1 > f.y2 - hz ? f.y1 + 0.6 : f.y2 - 0.6;
      const opts = [[f.y2 - h.y2, cxs, f.y2 - 0.6], [h.y1 - f.y1, cxs, f.y1 + 0.6], [f.x2 - h.x2, f.x2 - 0.6, czs], [h.x1 - f.x1, f.x1 + 0.6, czs]].sort((p, q) => q[0] - p[0]);
      const [ext, px, pz] = opts[0];
      if (ext < 3) camera.position.set(hx + 2, EYE, h.y2 + 9); else camera.position.set(px, EYE, pz);
      camera.fov = Math.min(90, Math.max(62, 2 * Math.atan(Math.tan(42 * DEG) / camera.aspect) / DEG));
    }
    controls.target.set(hx, kind === 'gradina' ? 0.9 : 1.6, hz); camera.lookAt(controls.target);
    camera.updateProjectionMatrix(); setWalk(true); controls.update(); return;
  }
  else if (kind === 'interior') {
    const rm = [...P.rooms].sort((a, c) => polyArea(c.pts) - polyArea(a.pts))[0];
    if (!rm) return setCam('persp');
    const xs = rm.pts.map((p) => p[0]), ys = rm.pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    // din dreptul peretelui de jos, privind spre peretele opus, apoi te poți roti pe loc
    camera.position.set((x0 + x1) / 2 + (x1 - x0) * 0.12, el + EYE, y1 - 0.75); controls.target.set((x0 + x1) / 2 - (x1 - x0) * 0.05, el + 1.2, y0 + 0.5); camera.fov = 68;
    camera.lookAt(controls.target);
    if (P.env.cutaway) { P.env.cutaway = false; $('#cutBtn').classList.remove('on'); rebuild3D(); }
    camera.updateProjectionMatrix(); setWalk(true); controls.update(); return;
  }
  camera.updateProjectionMatrix(); controls.update();
}
$$('#camBtns .chip').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));
$('#hqBtn').addEventListener('click', () => { P.env.hq = !P.env.hq; $('#hqBtn').classList.toggle('on', P.env.hq); commit(); });
$('#cutBtn').addEventListener('click', () => { P.env.cutaway = !P.env.cutaway; $('#cutBtn').classList.toggle('on', P.env.cutaway); changed(); });

// ================= Panoul de proprietăți =================
const props = $('#props');
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function num(label, key, val, step = 0.05, min = 0, max = 50, unit = 'm') {
  return `<div class="field"><label>${label}</label><input type="number" data-k="${key}" value="${+(+val).toFixed(3)}" step="${step}" min="${min}" max="${max}" title="${unit}"></div>`;
}

function colorRow(label, key, val, presets) {
  return `<div class="field"><label>${label}</label><div class="colrow"><input type="color" data-k="${key}" value="${val}">${presets ? `<div class="swatches">${presets}</div>` : ''}</div></div>`;
}
function finishButtons(cur, attr) {
  return `<div class="finishes">${Object.entries(WALL_FINISHES).map(([id, f]) => `<button ${attr}="${id}" class="${cur === id ? 'on' : ''}"><canvas data-fprev="${id}"></canvas>${t(f.name)}</button>`).join('')}</div>`;
}
function renderProps() {
  const s = sel && findSel();
  if (!s) return renderEnvPanel();
  let h = '';
  if (sel.kind === 'item') {
    const it = s, c = BY_TYPE[it.type];
    h += `<div class="sec"><h3>${c.icon} ${esc(t(c.name))}</h3>
      ${num(t('Lățime'), 'w', it.w, 0.05, 0.05)}${num(t('Adâncime'), 'd', it.d, 0.05, 0.02)}${num(t('Înălțime'), 'h', it.h, 0.05, 0.01)}
      ${num(t('De la podea'), 'elev', it.elev || 0, 0.05, 0, 5)}
      <div class="field"><label>${t('Rotire')}</label><input type="range" data-k="rot" min="0" max="359" step="1" value="${it.rot}"></div>
      ${colorRow(t(c.c1n || 'Culoare'), 'color', it.color)}
      ${c.c2 ? colorRow(t(c.c2n || 'Culoare 2'), 'color2', it.color2 || c.c2) : ''}
      ${c.kitchen ? `<h3 style="margin-top:12px">${t('Palete pentru bucătărie')}</h3><div class="palettes">${KITCHEN_PALETTES.map(([f, b2, n], i) => `<button data-pal="${i}" title="${t(n)}"><span style="background:${f}"></span><span style="background:${b2}"></span></button>`).join('')}</div>
        <label class="chk"><input type="checkbox" id="palAll" checked> ${t('Aplică la toată bucătăria')}</label>` : ''}
      <div class="row"><button class="btn" data-act="rot90">⟳ 90°</button><button class="btn" data-act="dup">${t('Dublează')}</button><button class="btn danger" data-act="del">${t('Șterge')}</button></div></div>`;
  } else if (sel.kind === 'wall') {
    const w = s, ext = isExterior(w);
    h += `<div class="sec"><h3>${t('Perete')} · ${ext ? t('exterior') : t('interior')}</h3>
      ${num(t('Lungime'), 'len', wallLen(w), 0.05, 0.1)}${num(t('Grosime'), 't', w.t, 0.01, 0.05, 1)}${num(t('Înălțime'), 'h', w.h, 0.05, 0.5, 8)}
      <div class="row" style="margin-top:0">${[0.1, 0.15, 0.25, 0.3, 0.4].map((v) => `<button class="btn sm" data-thick="${v}">${Math.round(v * 100)} cm</button>`).join('')}</div>
      <h3 style="margin-top:14px">${t('Finisaj')}</h3>${finishButtons(w.finish || P.env.finish, 'data-wfin')}
      ${colorRow(t('Culoare'), 'color', w.color || P.env.wallColor, WALL_COLORS.map(([c, n]) => `<button class="sw ${((w.color || P.env.wallColor) === c) ? 'on' : ''}" style="background:${c}" title="${t(n)}" data-wc="${c}"></button>`).join(''))}
      <p class="hint">${t('Culoarea colorează vopseaua și faianța. Cărămida, piatra, lemnul și betonul au culoarea lor.')}</p>
      <div class="row"><button class="btn" data-act="door">＋ ${t('Ușă')}</button><button class="btn" data-act="window">＋ ${t('Fereastră')}</button><button class="btn" data-act="wallreset">${t('Ca restul casei')}</button><button class="btn danger" data-act="del">${t('Șterge')}</button></div>
      <p class="hint">${t('Trage de cercurile de la capete ca să muți colțurile.')}</p></div>`;
  } else if (sel.kind === 'opening') {
    const o = s, styles = o.type === 'door' ? ['simpla', 'dubla', 'glisanta'] : ['normala', 'balcon'];
    h += `<div class="sec"><h3>${t(STYLE_NAMES[o.style || (o.type === 'door' ? 'simpla' : 'normala')])}</h3>
      <div class="field"><label>${t('Model')}</label><select data-k="style">${styles.map((st) => `<option value="${st}" ${(o.style || styles[0]) === st ? 'selected' : ''}>${t(STYLE_NAMES[st])}</option>`).join('')}</select></div>
      ${num(t('Lățime'), 'w', o.w, 0.05, 0.3, 6)}${num(t('Înălțime'), 'h', o.h, 0.05, 0.3, 4)}${num(t('Parapet'), 'sill', o.sill, 0.05, 0, 3)}${num(t('Poziție'), 'pos', o.pos, 0.05, 0, 50)}
      ${o.type === 'window' ? `<div class="field"><label>${t('Tâmplărie')}</label><select data-k="frame">${Object.entries(FRAME_COLORS).map(([id, [n]]) => `<option value="${id}" ${(o.frame || 'alb') === id ? 'selected' : ''}>${t(n)}</option>`).join('')}</select></div>
      <h3 style="margin-top:12px">${t('Scurgerea apei')}</h3>
      <div class="field"><label>${t('Glaf exterior')}</label><select data-k="glaf">${Object.entries(GLAF_TYPES).map(([id, [n]]) => `<option value="${id}" ${(o.glaf || 'antracit') === id ? 'selected' : ''}>${t(n)}</option>`).join('')}</select></div>
      ${num(t('Ieșire glaf'), 'glafOut', o.glafOut != null ? o.glafOut : 0.05, 0.01, 0.02, 0.15)}
      <p class="hint">${t('Glaful iese în afara fațadei și are lăcrimar, ca apa de ploaie să picure departe de perete. În interior se pune pervazul.')}</p>` : ''}
      <div class="row"><button class="btn danger" data-act="del">${t('Șterge')}</button></div></div>`;
  } else if (sel.kind === 'room') {
    const rm = s;
    h += `<div class="sec"><h3>${t('Cameră')}</h3>
      <div class="field"><label>${t('Nume')}</label><input type="text" data-k="name" value="${esc(rm.name)}"></div>
      <div class="stat"><span>${t('Suprafață')}</span><b>${fmt(polyArea(rm.pts), 2)} m²</b></div>
      <h3 style="margin-top:12px">${t('Pardoseală')}</h3>
      <div class="floors">${Object.entries(FLOORS).map(([id, f]) => `<button data-floor="${id}" class="${rm.floor === id ? 'on' : ''}"><canvas data-prev="${id}"></canvas>${t(f.name)}</button>`).join('')}</div>
      <h3 style="margin-top:12px">${t('Pereții camerei')}</h3>
      <p class="hint" style="margin-top:0">${t('Aplică un finisaj pe toți pereții acestei camere (de exemplu faianță în baie).')}</p>
      ${finishButtons('', 'data-rfin')}
      ${colorRow(t('Culoare pereți'), 'roomcolor', P.env.wallColor)}
      <div class="row"><button class="btn danger" data-act="del">${t('Șterge camera')}</button></div></div>`;
  } else if (sel.kind === 'label') {
    const l = s;
    h += `<div class="sec"><h3>${t('Etichetă')}</h3>
      <div class="field"><label>${t('Text')}</label><input type="text" data-k="text" value="${esc(l.text)}"></div>
      ${num(t('Mărime'), 'size', l.size || 14, 1, 9, 40, 'px')}
      <div class="row"><button class="btn danger" data-act="del">${t('Șterge')}</button></div></div>`;
  } else if (sel.kind === 'path') {
    const pa = s, len = pa.pts.reduce((a, p, i) => i ? a + dist(...pa.pts[i - 1], ...p) : 0, 0);
    h += `<div class="sec"><h3>🟫 ${t('Alee')}</h3>
      <div class="field"><label>${t('Material')}</label><select data-k="mat">${Object.entries(PATH_MATS).map(([id, m]) => `<option value="${id}" ${pa.mat === id ? 'selected' : ''}>${t(m.name)}</option>`).join('')}</select></div>
      ${num(t('Lățime'), 'w', pa.w, 0.05, 0.4, 6)}
      <div class="stat"><span>${t('Lungime')}</span><b>${fmt(len, 2)} m</b></div><div class="stat"><span>${t('Suprafață')}</span><b>${fmt(len * pa.w, 2)} m²</b></div>
      <div class="row"><button class="btn danger" data-act="del">${t('Șterge')}</button></div></div>`;
  } else if (sel.kind === 'zone') {
    const z = s;
    h += `<div class="sec"><h3>🌱 ${t('Zonă de grădină')}</h3>
      <div class="field"><label>${t('Tip')}</label><select data-k="type">${Object.entries(ZONE_TYPES).map(([id, m]) => `<option value="${id}" ${z.type === id ? 'selected' : ''}>${t(m.name)}</option>`).join('')}</select></div>
      <div class="stat"><span>${t('Suprafață')}</span><b>${fmt(polyArea(z.pts), 2)} m²</b></div>
      <div class="row"><button class="btn danger" data-act="del">${t('Șterge')}</button></div></div>`;
  } else if (sel.kind === 'dim') {
    const d = s;
    h += `<div class="sec"><h3>${t('Cotă')}</h3><div class="stat"><span>${t('Lungime')}</span><b>${fmt(dist(d.x1, d.y1, d.x2, d.y2), 2)} m</b></div>
      <div class="row"><button class="btn danger" data-act="del">${t('Șterge')}</button></div></div>`;
  }
  props.innerHTML = h + envHTML(true);
  bindProps(s);
  drawFloorPreviews();
}

const GUTTER_COLORS = [['#6b6e72', 'Gri'], ['#eeeeec', 'Alb'], ['#5b4030', 'Maro'], ['#3a3d42', 'Antracit'], ['#b87333', 'Cupru']];
function levelsHTML() {
  const L = P.levels[P.cur];
  return `<div class="sec"><h3>🏢 ${t('Niveluri')}</h3>
    <div class="lvls">${P.levels.map((x, i) => `<button class="chip ${i === P.cur ? 'on' : ''}" data-lvl="${i}">${esc(x.name)}</button>`).join('')}</div>
    <div class="field"><label>${t('Nume nivel')}</label><input type="text" id="lvlName" value="${esc(L.name)}"></div>
    <div class="stat"><span>${t('Cota pardoselii')}</span><b>+${fmt(levelElev(P.cur), 2)} m</b></div>
    <div class="stat"><span>${t('Înălțime nivel')}</span><b>${fmt(levelTop(L), 2)} m</b></div>
    <div class="row"><button class="btn primary" data-act="lvlAdd">＋ ${t('Adaugă nivel deasupra')}</button>${P.levels.length > 1 ? `<button class="btn danger" data-act="lvlDel">${t('Șterge nivelul')}</button>` : ''}</div>
    <p class="hint">${t('Nivelul nou copiază pereții, ferestrele și camerele de dedesubt; ușile de la intrare devin ferestre. Scările urcă singure până la nivelul de deasupra.')}</p></div>`;
}
function envHTML(collapsed) {
  const e = P.env, hh = Math.floor(e.hour), mm = Math.round((e.hour - hh) * 60);
  const roofOpts = [['fara', 'Fără acoperiș'], ['doua_ape', 'În două ape'], ['patru_ape', 'În patru ape'], ['plat', 'Terasă (plat)']];
  const roofCols = [['#a4553a', 'Teracotă'], ['#3d4045', 'Antracit'], ['#6b4a3a', 'Maro'], ['#4d6650', 'Verde'], ['#8a8f96', 'Gri']];
  return `<div class="sec"><h3>${t('Lumină și ambient')}</h3>
    <div class="field"><label>${t('Ora zilei')} <b id="hourLbl">${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</b></label><input type="range" data-env="hour" min="5" max="22" step="0.25" value="${e.hour}"></div>
    <div class="field"><label>${t('Orientare nord')}</label><input type="range" data-env="north" min="0" max="359" step="1" value="${e.north}"></div>
    <div class="field"><label>${t('Expunere')}</label><input type="range" data-env="exposure" min="0.4" max="2" step="0.05" value="${e.exposure}"></div>
    <div class="field"><label>${t('Lămpi')}</label><select data-env="lights"><option value="auto" ${e.lights === 'auto' ? 'selected' : ''}>${t('Automat (seara)')}</option><option value="on" ${e.lights === 'on' ? 'selected' : ''}>${t('Aprinse')}</option><option value="off" ${e.lights === 'off' ? 'selected' : ''}>${t('Stinse')}</option></select></div>
    <div class="field"><label>${t('Tavan mereu')}</label><input type="checkbox" data-env="ceiling" ${e.ceiling ? 'checked' : ''} style="justify-self:start"></div>
  </div>
  <div class="sec"><h3>${t('Acoperiș')}</h3>
    <div class="field"><label>${t('Tip')}</label><select data-env="roof">${roofOpts.map(([v, n]) => `<option value="${v}" ${e.roof === v ? 'selected' : ''}>${t(n)}</option>`).join('')}</select></div>
    <div class="field"><label>${t('Țiglă')}</label><div class="swatches">${roofCols.map(([c, n]) => `<button class="sw ${e.roofColor === c ? 'on' : ''}" style="background:${c}" title="${t(n)}" data-roofc="${c}"></button>`).join('')}</div></div>
    <div class="field"><label>${t('Jgheaburi și burlane')}</label><input type="checkbox" data-env="gutters" ${e.gutters ? 'checked' : ''} style="justify-self:start"></div>
    ${e.gutters ? `<div class="field"><label>${t('Culoare')}</label><div class="swatches">${GUTTER_COLORS.map(([c, n]) => `<button class="sw ${e.gutterColor === c ? 'on' : ''}" style="background:${c}" title="${t(n)}" data-gutc="${c}"></button>`).join('')}</div></div>` : ''}
    <p class="hint">${t('Acoperișul este pus pe ultimul nivel. Jgheaburile duc apa la burlanele din colțuri.')}</p>
  </div>
  ${collapsed ? '' : `<div class="sec"><h3>${t('Pereții casei')}</h3>
    ${finishButtons(e.finish, 'data-envfin')}
    ${colorRow(t('Culoare'), 'envcolor', e.wallColor, WALL_COLORS.map(([c, n]) => `<button class="sw ${e.wallColor === c ? 'on' : ''}" style="background:${c}" title="${t(n)}" data-envwc="${c}"></button>`).join(''))}
  </div>` + materialsHTML()}`;
}

// ---------- structura și calculul materialelor ----------
function inAnyRoom(x, y) { return P.rooms.some((r) => inPoly(x, y, r.pts)); }
function isExterior(w) {
  const L = wallLen(w); if (L < 0.01) return true;
  const nx = -(w.y2 - w.y1) / L, ny = (w.x2 - w.x1) / L, mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2, o = w.t / 2 + 0.2;
  return !(inAnyRoom(mx + nx * o, my + ny * o) && inAnyRoom(mx - nx * o, my - ny * o));
}
function quantities() {
  const res = { ext: { len: 0, area: 0, vol: 0 }, int: { len: 0, area: 0, vol: 0 }, paint: 0, floors: {}, paths: {}, zones: {}, windows: { n: 0, area: 0, sills: 0 }, doors: 0, slab: 0, extGround: 0 };
  eachLevel((Lv, li) => {
  for (const o of P.openings) { if (o.type === 'window' && o.style !== 'balcon') { res.windows.n++; res.windows.area += o.w * o.h; const w = getWall(o.wall); if (w && isExterior(w)) res.windows.sills += o.w + 0.06; } else if (o.type === 'window') { res.windows.n++; res.windows.area += o.w * o.h; } else res.doors++; }
  for (const pa of P.paths) { let L = 0; for (let i = 1; i < pa.pts.length; i++) L += dist(...pa.pts[i - 1], ...pa.pts[i]); res.paths[pa.mat] = (res.paths[pa.mat] || 0) + L * pa.w; }
  for (const z of P.zones) res.zones[z.type] = (res.zones[z.type] || 0) + polyArea(z.pts);
  if (li > 0) res.slab += P.rooms.reduce((a, r) => a + polyArea(r.pts), 0);
  for (const w of P.walls) {
    const L = wallLen(w), ops = P.openings.filter((o) => o.wall === w.id).reduce((s2, o) => s2 + o.w * Math.min(o.h, w.h - o.sill), 0);
    const area = Math.max(0, L * w.h - ops), k = isExterior(w) ? res.ext : res.int;
    k.len += L; k.area += area; k.vol += area * w.t;
    if (li === 0 && k === res.ext) res.extGround += L;
    const fin = w.finish || P.env.finish;
    if (fin === 'vopsea') res.paint += area * (isExterior(w) ? 1 : 2);
  }
  for (const r of P.rooms) res.floors[r.floor] = (res.floors[r.floor] || 0) + polyArea(r.pts);
  });
  // jgheaburi pe streașini și burlane la colțuri (acoperiș înclinat, pe ultimul nivel)
  res.gutter = 0; res.downpipes = 0;
  if (P.env.gutters && (P.env.roof === 'doua_ape' || P.env.roof === 'patru_ape')) {
    const k = P.cur; P.cur = P.levels.length - 1; const b = bounds(); P.cur = k;
    const A = Math.max(b.x2 - b.x1, b.y2 - b.y1) + 0.9, B = Math.min(b.x2 - b.x1, b.y2 - b.y1) + 0.9;
    res.gutter = 2 * A + (P.env.roof === 'patru_ape' ? 2 * B : 0); res.downpipes = 4; res.pipeLen = levelElev(P.levels.length - 1) + levelTop(P.levels[P.levels.length - 1]);
  }
  res.roofArea = roofAreaOf();
  return res;
}
function qty(def, part) {
  if (def.perM2) return `${fmt(part.area * def.perM2, 0)} ${t(def.unit)}`;
  return def.perM3 >= 5 ? `~${Math.ceil(part.vol * def.perM3).toLocaleString(LANG)} ${t(def.unit)}` : `${fmt(part.vol * def.perM3, 2)} ${t(def.unit)}`;
}
function materialsHTML() {
  const e = P.env;
  return `<div class="sec"><h3>${t('Din ce se construiește casa')}</h3>
    <div class="field"><label>${t('Pereți exteriori')}</label><select data-env="structure">${Object.entries(STRUCTURES).map(([id, d]) => `<option value="${id}" ${e.structure === id ? 'selected' : ''}>${t(d.name)} · ${Math.round(d.t * 100)} cm</option>`).join('')}</select></div>
    <div class="field"><label>${t('Pereți interiori')}</label><select data-env="partition">${Object.entries(PARTITIONS).map(([id, d]) => `<option value="${id}" ${e.partition === id ? 'selected' : ''}>${t(d.name)}</option>`).join('')}</select></div>
    <div class="row" style="margin-top:2px"><button class="btn primary" data-act="applyT">${t('Aplică grosimile pe plan')}</button></div>
    ${qtyTable('qty')}
    <p class="hint">${t('Cantitățile sunt estimative, fără pierderi și fără fundație. Golurile ușilor și ferestrelor sunt scăzute.')}</p>
  </div>`;
}
function roofAreaOf() {
  const e = P.env, top = P.levels.length - 1;
  if (e.roof === 'fara' || !P.levels[top].walls.length) return 0;
  const k = P.cur; P.cur = top; const b = bounds(); P.cur = k; const A = (b.x2 - b.x1 + 0.9) * (b.y2 - b.y1 + 0.9);
  return e.roof === 'plat' ? A : A / Math.cos(32 * DEG);
}
function qtyTable(cls) {
  const e = P.env, q = quantities(), S = STRUCTURES[e.structure] || STRUCTURES.caramida, Pt = PARTITIONS[e.partition] || PARTITIONS.bca10;
  const roofArea = roofAreaOf();
  return `<table class="${cls}">
      <tr><th colspan="2">${t('Pereți exteriori')} · ${t(S.name)}</th></tr>
      <tr><td>${t('Lungime / suprafață')}</td><td>${fmt(q.ext.len)} m · ${fmt(q.ext.area)} m²</td></tr>
      <tr><td>${t('Volum zidărie')}</td><td>${fmt(q.ext.vol, 2)} m³</td></tr>
      <tr><td>${t('Necesar')} <small>(${t(S.note)})</small></td><td><b>${qty(S, q.ext)}</b></td></tr>
      <tr><th colspan="2">${t('Pereți interiori')} · ${t(Pt.name)}</th></tr>
      <tr><td>${t('Lungime / suprafață')}</td><td>${fmt(q.int.len)} m · ${fmt(q.int.area)} m²</td></tr>
      <tr><td>${t('Necesar')}</td><td><b>${qty(Pt, q.int)}</b></td></tr>
      <tr><th colspan="2">${t('Finisaje')}</th></tr>
      ${Object.entries(q.floors).map(([f, a]) => `<tr><td>${t(FLOORS[f] ? FLOORS[f].name : f)}</td><td>${fmt(a)} m² <small>(+10%: ${fmt(a * 1.1)})</small></td></tr>`).join('')}
      <tr><td>${t('Vopsea lavabilă')} <small>(${t('2 straturi')})</small></td><td>~${Math.ceil(q.paint * 2 * 0.12)} L</td></tr>
      ${roofArea ? `<tr><td>${t('Acoperiș')}</td><td>${fmt(roofArea)} m²</td></tr>` : ''}
      ${q.slab ? `<tr><td>${t('Planșeu între niveluri')}</td><td>${fmt(q.slab)} m² · ${fmt(q.slab * 0.18, 1)} m³ ${t('beton')}</td></tr>` : ''}
      <tr><th colspan="2">${t('Tâmplărie și scurgerea apei')}</th></tr>
      <tr><td>${t('Ferestre')}</td><td>${q.windows.n} ${t('buc')} · ${fmt(q.windows.area)} m² ${t('geam')}</td></tr>
      <tr><td>${t('Uși')}</td><td>${q.doors} ${t('buc')}</td></tr>
      ${q.windows.sills ? `<tr><td>${t('Glafuri exterioare')}</td><td>${fmt(q.windows.sills)} m</td></tr>` : ''}
      ${q.gutter ? `<tr><td>${t('Jgheaburi')}</td><td>${fmt(q.gutter)} m</td></tr><tr><td>${t('Burlane')}</td><td>${q.downpipes} × ${fmt(q.pipeLen)} m</td></tr>` : ''}
      ${Object.keys(q.paths).length + Object.keys(q.zones).length ? `<tr><th colspan="2">${t('Grădină')}</th></tr>` : ''}
      ${Object.entries(q.paths).map(([m, a]) => `<tr><td>${t('Alee')}: ${t((PATH_MATS[m] || PATH_MATS.pavele).name)}</td><td>${fmt(a)} m²</td></tr>`).join('')}
      ${Object.entries(q.zones).map(([z, a]) => `<tr><td>${t((ZONE_TYPES[z] || ZONE_TYPES.gazon).name)}</td><td>${fmt(a)} m²</td></tr>`).join('')}
    </table>`;
}

function renderEnvPanel() {
  const all = (k) => P.levels.flatMap((L) => L[k]);
  const area = allRooms().reduce((s2, r) => s2 + polyArea(r.pts), 0);
  const wl = all('walls').reduce((s2, w) => s2 + wallLen(w), 0), ops = all('openings');
  props.innerHTML = `<div class="sec"><h3>${t('Proiect')}</h3>
    <div class="stat"><span>${t('Suprafață camere')}</span><b>${fmt(area)} m²</b></div>
    <div class="stat"><span>${t('Niveluri')}</span><b>${P.levels.length}</b></div>
    <div class="stat"><span>${t('Camere')}</span><b>${allRooms().length}</b></div>
    <div class="stat"><span>${t('Lungime pereți')}</span><b>${fmt(wl)} m</b></div>
    <div class="stat"><span>${t('Uși / ferestre')}</span><b>${ops.filter((o) => o.type === 'door').length} / ${ops.filter((o) => o.type === 'window').length}</b></div>
    <div class="stat"><span>${t('Obiecte')}</span><b>${all('items').length}</b></div>
    <p class="hint">${t('Selectează o cameră ca să-i schimbi pardoseala, sau un perete ca să-i schimbi culoarea.')}</p></div>` + levelsHTML() + envHTML(false);
  bindProps(null);
  drawFloorPreviews();
}

function findSel() {
  if (!sel) return null;
  const list = { item: P.items, wall: P.walls, room: P.rooms, opening: P.openings, label: P.labels, dim: P.dims, path: P.paths, zone: P.zones }[sel.kind];
  return list && list.find((x) => x.id === sel.id);
}

function roomWalls(rm) {
  // pereții care stau pe conturul camerei
  const onEdge = (x, y) => rm.pts.some((p, i) => { const q = rm.pts[(i + 1) % rm.pts.length]; const L = dist(p[0], p[1], q[0], q[1]); const tt = ((x - p[0]) * (q[0] - p[0]) + (y - p[1]) * (q[1] - p[1])) / (L * L); const px = p[0] + (q[0] - p[0]) * tt, py = p[1] + (q[1] - p[1]) * tt; return tt >= -0.01 && tt <= 1.01 && dist(x, y, px, py) < 0.02; });
  return P.walls.filter((w) => onEdge((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2));
}

function bindProps(obj) {
  props.querySelectorAll('[data-k]').forEach((inp) => {
    const k = inp.dataset.k;
    const apply = (final) => {
      let v = inp.type === 'number' || inp.type === 'range' ? parseFloat(inp.value) : inp.value;
      if (inp.type === 'number' && !isFinite(v)) return;
      if (k === 'envcolor') { P.env.wallColor = v; }
      else if (k === 'roomcolor') { for (const w of roomWalls(obj)) w.color = v; }
      else if (sel.kind === 'wall' && k === 'len') {
        const L = wallLen(obj); if (v < 0.1) return;
        const ux = (obj.x2 - obj.x1) / L, uy = (obj.y2 - obj.y1) / L;
        moveVertex([obj.x2, obj.y2], [r2(obj.x1 + ux * v), r2(obj.y1 + uy * v)]);
      } else obj[k] = v;
      if (sel && sel.kind === 'path' && k === 'mat') pathMat = v;
      if (sel && sel.kind === 'zone' && k === 'type') zoneType = v;
      if (sel && sel.kind === 'opening') {
        if (k === 'style') { const d = Object.values(OPENING_TOOLS).find((x) => x.style === v); Object.assign(obj, { w: d.w, h: d.h, sill: d.sill }); }
        const w = getWall(obj.wall), L = wallLen(w); obj.pos = Math.max(obj.w / 2 + 0.02, Math.min(L - obj.w / 2 - 0.02, obj.pos));
      }
      if (final) { changed(); } else { rebuild3D(); draw2D(); }
    };
    inp.addEventListener('input', () => apply(false));
    inp.addEventListener('change', () => apply(true));
  });
  props.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.act, obj)));
  props.querySelectorAll('[data-wc]').forEach((b) => b.addEventListener('click', () => { obj.color = b.dataset.wc === P.env.wallColor ? null : b.dataset.wc; changed(); }));
  props.querySelectorAll('[data-thick]').forEach((b) => b.addEventListener('click', () => { obj.t = +b.dataset.thick; changed(); }));
  props.querySelectorAll('[data-wfin]').forEach((b) => b.addEventListener('click', () => { obj.finish = b.dataset.wfin; changed(); }));
  props.querySelectorAll('[data-rfin]').forEach((b) => b.addEventListener('click', () => { for (const w of roomWalls(obj)) w.finish = b.dataset.rfin; changed(); toast(t('Finisaj aplicat pe pereții camerei.')); }));
  props.querySelectorAll('[data-envfin]').forEach((b) => b.addEventListener('click', () => { P.env.finish = b.dataset.envfin; for (const w of P.walls) delete w.finish; changed(); }));
  props.querySelectorAll('[data-floor]').forEach((b) => b.addEventListener('click', () => { obj.floor = b.dataset.floor; changed(); }));
  props.querySelectorAll('[data-envwc]').forEach((b) => b.addEventListener('click', () => { P.env.wallColor = b.dataset.envwc; for (const w of P.walls) w.color = null; changed(); }));
  props.querySelectorAll('[data-roofc]').forEach((b) => b.addEventListener('click', () => { P.env.roofColor = b.dataset.roofc; changed(); }));
  props.querySelectorAll('[data-gutc]').forEach((b) => b.addEventListener('click', () => { P.env.gutterColor = b.dataset.gutc; changed(); }));
  props.querySelectorAll('[data-lvl]').forEach((b) => b.addEventListener('click', () => setLevel(+b.dataset.lvl)));
  const ln = props.querySelector('#lvlName'); if (ln) ln.addEventListener('change', () => { P.levels[P.cur].name = ln.value.trim() || levelName(P.cur); syncLevelUI(); renderProps(); commit(); });
  props.querySelectorAll('[data-pal]').forEach((b) => b.addEventListener('click', () => {
    const [f, top] = KITCHEN_PALETTES[+b.dataset.pal];
    const all = $('#palAll') && $('#palAll').checked;
    const targets = all ? P.items.filter((i) => BY_TYPE[i.type] && BY_TYPE[i.type].kitchen) : [obj];
    for (const i of targets) { i.color = f; if (BY_TYPE[i.type].c2) i.color2 = top; }
    changed();
  }));
  props.querySelectorAll('[data-env]').forEach((inp) => {
    const k = inp.dataset.env;
    const apply = (final) => {
      P.env[k] = inp.type === 'checkbox' ? inp.checked : inp.tagName === 'SELECT' ? inp.value : parseFloat(inp.value);
      if (k === 'hour') { const hh = Math.floor(P.env.hour), mm = Math.round((P.env.hour - hh) * 60); const l = $('#hourLbl'); if (l) l.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }
      if (k === 'ceiling' || k === 'roof' || k === 'gutters') rebuild3D();
      if (k === 'gutters') renderProps();
      if (k === 'structure' || k === 'partition') renderProps();
      applyEnv(); draw2D();
      if (final) commit();
    };
    inp.addEventListener('input', () => apply(false));
    inp.addEventListener('change', () => apply(true));
  });
}

function act(a, obj) {
  if (a === 'del') deleteSel();
  else if (a === 'dup') duplicateSel();
  else if (a === 'rot90') { obj.rot = (obj.rot + 90) % 360; changed(); }
  else if (a === 'wallreset') { obj.color = null; delete obj.finish; changed(); }
  else if (a === 'lvlAdd') addLevel();
  else if (a === 'lvlDel') deleteLevel();
  else if (a === 'applyT') {
    const S = STRUCTURES[P.env.structure], Pt = PARTITIONS[P.env.partition];
    const ext = P.walls.map(isExterior);
    P.walls.forEach((w, i) => { w.t = ext[i] ? S.t : Pt.t; });
    changed(); toast(t('Grosimile au fost aplicate.'));
  }
  else if (a === 'door' || a === 'window') {
    const mx = (obj.x1 + obj.x2) / 2, my = (obj.y1 + obj.y2) / 2;
    const o = addOpening(a, mx, my); if (o) { o.wall = obj.id; sel = { kind: 'opening', id: o.id }; changed(); } else toast(t('Peretele e prea scurt.'));
  }
}
function deleteSel() {
  if (!sel) return;
  const k = sel.kind, id = sel.id;
  if (k === 'item') P.items = P.items.filter((x) => x.id !== id);
  if (k === 'opening') P.openings = P.openings.filter((x) => x.id !== id);
  if (k === 'wall') { P.walls = P.walls.filter((x) => x.id !== id); P.openings = P.openings.filter((o) => o.wall !== id); }
  if (k === 'room') P.rooms = P.rooms.filter((x) => x.id !== id);
  if (k === 'label') P.labels = P.labels.filter((x) => x.id !== id);
  if (k === 'dim') P.dims = P.dims.filter((x) => x.id !== id);
  if (k === 'path') P.paths = P.paths.filter((x) => x.id !== id);
  if (k === 'zone') P.zones = P.zones.filter((x) => x.id !== id);
  sel = null; changed();
}
function duplicateSel() {
  if (!sel || sel.kind !== 'item') return;
  const it = P.items.find((x) => x.id === sel.id);
  const copy = { ...it, id: uid('i'), x: it.x + 0.4, y: it.y + 0.4 };
  P.items.push(copy); sel = { kind: 'item', id: copy.id }; changed();
}

function drawFloorPreviews() {
  props.querySelectorAll('canvas[data-prev]').forEach((cv) => {
    const tex = floorTexture(cv.dataset.prev), img = tex.image;
    cv.width = 120; cv.height = 40; cv.getContext('2d').drawImage(img, 0, 0, img.width, img.width / 3, 0, 0, 120, 40);
  });
  props.querySelectorAll('canvas[data-fprev]').forEach((cv) => {
    const f = WALL_FINISHES[cv.dataset.fprev], img = finishTexture(cv.dataset.fprev).image;
    cv.width = 120; cv.height = 40; const g = cv.getContext('2d');
    g.drawImage(img, 0, 0, img.width, img.width / 3, 0, 0, 120, 40);
    if (f.tint) { g.globalCompositeOperation = 'multiply'; g.fillStyle = P.env.wallColor; g.fillRect(0, 0, 120, 40); g.globalCompositeOperation = 'source-over'; }
  });
}

// ================= Catalogul din stânga =================
const cats = [...new Set(CATALOG.map((c) => c.cat))];
let curCat = cats[0];
function renderCatalog() {
  $('#catTabs').innerHTML = cats.map((c) => `<button class="${c === curCat ? 'on' : ''}" data-cat="${c}">${t(c)}</button>`).join('');
  $('#items').innerHTML = CATALOG.filter((c) => c.cat === curCat).map((c) => `<button class="item" data-type="${c.type}"><span class="em">${c.icon}</span>${t(c.name)}</button>`).join('');
  $$('#catTabs button').forEach((b) => b.addEventListener('click', () => { curCat = b.dataset.cat; renderCatalog(); }));
  $$('#items .item').forEach((b) => b.addEventListener('click', () => {
    const r = c2d.getBoundingClientRect();
    let [x, y] = r.width > 2 ? toW(r.width / 2, r.height / 2) : [sceneCenter.x, sceneCenter.z];
    const it = addItem(b.dataset.type, snapV(x), snapV(y));
    sel = { kind: 'item', id: it.id }; setTool('select'); changed();
    if (innerWidth <= 1000) $('#left').classList.remove('show');
  }));
}

// ================= Randare foto (acumulare progresivă) =================
async function renderPhoto(width, height, samples, onProgress, ao = true) {
  rendering = true; updateCeiling(true);
  const prevPR = renderer.getPixelRatio(), prevSize = renderer.getSize(new THREE.Vector2());
  const cam = camera.clone(); cam.aspect = width / height; cam.updateProjectionMatrix();
  const prevMap = sun.shadow.mapSize.x;
  sun.shadow.mapSize.set(4096, 4096); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  const oldRadius = sun.shadow.radius;
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  const out = document.createElement('canvas'); out.width = width; out.height = height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  const acc = new Float32Array(width * height * 4);
  const basePos = sun.position.clone();
  const { el } = sunState(); const jitterR = sceneRadius * 0.06 * (el > 0 ? 1 : 0);
  if (ao) await loadPP();
  const comp = ao ? makeComposer(cam, width, height) : null;
  if (comp) comp.setPixelRatio(1);
  try {
    for (let i = 0; i < samples; i++) {
      // pseudo-aleator Halton pentru eșantionare uniformă
      const hx = halton(i + 1, 2) - 0.5, hy = halton(i + 1, 3) - 0.5;
      cam.setViewOffset(width, height, hx, hy, width, height);
      const a = halton(i + 1, 5) * Math.PI * 2, rr = Math.sqrt(halton(i + 1, 7)) * jitterR;
      sun.position.copy(basePos).add(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr));
      if (comp) comp.render(); else renderer.render(scene, cam);
      ctx.drawImage(renderer.domElement, 0, 0);
      const d = ctx.getImageData(0, 0, width, height).data;
      for (let k = 0; k < d.length; k++) acc[k] += d[k];
      onProgress && onProgress((i + 1) / samples);
      await new Promise((r) => setTimeout(r, 0));
    }
    const img = ctx.createImageData(width, height);
    for (let k = 0; k < acc.length; k++) img.data[k] = acc[k] / samples;
    ctx.putImageData(img, 0, 0);
  } finally {
    if (comp) { comp.aoPass.dispose(); comp.dispose(); }
    sun.position.copy(basePos); sun.shadow.radius = oldRadius;
    sun.shadow.mapSize.set(prevMap, prevMap); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    renderer.setPixelRatio(prevPR); renderer.setSize(prevSize.x, prevSize.y, false);
    rendering = false;
  }
  return out;
}
function halton(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }

// ================= Panoramă 360° =================
async function renderPanorama(W = 4096) {
  rendering = true; updateCeiling(true);
  const H = W / 2;
  const cubeRT = new THREE.WebGLCubeRenderTarget(Math.min(2048, W / 2), { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.05, 400, cubeRT);
  cubeCam.position.copy(camera.position);
  if (selBox) selBox.visible = false;
  cubeCam.update(renderer, scene);
  if (selBox) selBox.visible = true;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const yaw = Math.atan2(dir.x, -dir.z);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { cube: { value: cubeRT.texture }, yaw: { value: yaw } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform samplerCube cube; uniform float yaw;
      void main(){ float lon = (vUv.x - 0.5) * 6.28318530718 + yaw; float lat = (vUv.y - 0.5) * 3.14159265359;
      vec3 d = vec3(cos(lat) * sin(lon), sin(lat), -cos(lat) * cos(lon));
      gl_FragColor = textureCube(cube, d);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  }));
  const qs = new THREE.Scene(); qs.add(quad);
  const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prevPR = renderer.getPixelRatio(), prevSize = renderer.getSize(new THREE.Vector2());
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.render(qs, qc);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  out.getContext('2d').drawImage(renderer.domElement, 0, 0);
  renderer.setPixelRatio(prevPR); renderer.setSize(prevSize.x, prevSize.y, false);
  cubeRT.dispose(); quad.geometry.dispose(); quad.material.dispose();
  rendering = false;
  return out;
}

let panoViewer = null;
function showPano(canvas) {
  const box = $('#panoBox'); box.hidden = false;
  if (!panoViewer) {
    const r = new THREE.WebGLRenderer({ antialias: true }); r.outputColorSpace = THREE.SRGBColorSpace;
    box.appendChild(r.domElement);
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), new THREE.MeshBasicMaterial({ side: THREE.BackSide }));
    sphere.scale.x = -1; sphere.rotation.y = Math.PI / 2 * 0; sc.add(sphere);
    panoViewer = { r, sc, cam, sphere, lon: 0, lat: 0 };
    let dragP = null;
    r.domElement.addEventListener('pointerdown', (e) => { dragP = [e.clientX, e.clientY, panoViewer.lon, panoViewer.lat]; r.domElement.setPointerCapture(e.pointerId); box.style.cursor = 'grabbing'; });
    r.domElement.addEventListener('pointermove', (e) => { if (!dragP) return; panoViewer.lon = dragP[2] - (e.clientX - dragP[0]) * 0.2; panoViewer.lat = Math.max(-85, Math.min(85, dragP[3] + (e.clientY - dragP[1]) * 0.2)); });
    r.domElement.addEventListener('pointerup', () => { dragP = null; box.style.cursor = ''; });
    r.domElement.addEventListener('wheel', (e) => { e.preventDefault(); cam.fov = Math.max(30, Math.min(100, cam.fov + e.deltaY * 0.05)); cam.updateProjectionMatrix(); }, { passive: false });
    const tick = () => {
      requestAnimationFrame(tick);
      if (!$('#m360').classList.contains('open')) return;
      const w = box.clientWidth, h = box.clientHeight; if (r.domElement.width !== w || r.domElement.height !== h) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      const phi = (90 - panoViewer.lat) * DEG, th = panoViewer.lon * DEG;
      cam.lookAt(Math.sin(phi) * Math.sin(th), Math.cos(phi), -Math.sin(phi) * Math.cos(th));
      r.render(sc, cam);
    };
    tick();
  }
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  if (panoViewer.sphere.material.map) panoViewer.sphere.material.map.dispose();
  panoViewer.sphere.material.map = tex; panoViewer.sphere.material.needsUpdate = true;
  panoViewer.lon = 0; panoViewer.lat = 0;
}

// ================= Galeria locală (IndexedDB) =================
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('planora', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('randari', { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function galleryAdd(canvas, kind) {
  try {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const th = document.createElement('canvas'); th.width = 480; th.height = Math.round(480 * canvas.height / canvas.width);
    th.getContext('2d').drawImage(canvas, 0, 0, th.width, th.height);
    const d = await db();
    await new Promise((res, rej) => { const tx = d.transaction('randari', 'readwrite'); tx.objectStore('randari').put({ id: Date.now() + '', date: new Date().toISOString(), name: P.name, kind, blob, thumb: th.toDataURL('image/jpeg', 0.8), w: canvas.width, h: canvas.height }); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch (e) { console.warn('Galeria nu e disponibilă', e); }
}
async function galleryList() {
  try { const d = await db(); return await new Promise((res) => { const q = d.transaction('randari').objectStore('randari').getAll(); q.onsuccess = () => res(q.result.reverse()); q.onerror = () => res([]); }); }
  catch (e) { return []; }
}
async function galleryDel(id) { const d = await db(); await new Promise((res) => { const tx = d.transaction('randari', 'readwrite'); tx.objectStore('randari').delete(id); tx.oncomplete = res; }); }
async function renderGallery() {
  const list = await galleryList();
  $('#galEmpty').hidden = list.length > 0;
  $('#galList').innerHTML = list.map((g) => `<figure><img src="${g.thumb}" data-open="${g.id}" alt="${esc(g.name)}"><figcaption><span>${g.kind === '360' ? '🌐 ' : ''}${esc(g.name)}<br><small>${new Date(g.date).toLocaleString(LANG)} · ${g.w}×${g.h}</small></span><span><button class="btn" data-dl="${g.id}" title="${t('Descarcă')}">⬇</button> <button class="btn danger" data-rm="${g.id}" title="${t('Șterge')}">✕</button></span></figcaption></figure>`).join('');
  const byId = Object.fromEntries(list.map((g) => [g.id, g]));
  const dl = (g) => { const a = document.createElement('a'); a.href = URL.createObjectURL(g.blob); a.download = fileName(g.kind === '360' ? 'panorama-360' : 'randare', 'png'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  $$('#galList [data-dl]').forEach((b) => b.addEventListener('click', () => dl(byId[b.dataset.dl])));
  $$('#galList [data-open]').forEach((b) => b.addEventListener('click', () => window.open(URL.createObjectURL(byId[b.dataset.open].blob), '_blank')));
  $$('#galList [data-rm]').forEach((b) => b.addEventListener('click', async () => { await galleryDel(b.dataset.rm); renderGallery(); }));
}
function fileName(prefix, ext) {
  const slug = (P.name || 'proiect').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug}-${prefix}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`;
}

// ================= Ferestre modale și butoane =================
function openModal(id) { $(id).classList.add('open'); }
$$('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m || e.target.hasAttribute('data-close')) m.classList.remove('open'); });
});
$('#btnRender').addEventListener('click', () => { $('#rResult').hidden = true; $('#rBar').style.width = '0'; $('#rStatus').textContent = ''; openModal('#mRender'); });
$('#rGo').addEventListener('click', async () => {
  const W = +$('#rRes').value, H = Math.round(W / +$('#rRatio').value), S = +$('#rQual').value;
  $('#rGo').disabled = true; const t0 = performance.now();
  $('#rStatus').textContent = `${t('Se randează')} ${W}×${H}…`;
  try {
    const cv = await renderPhoto(W, H, S, (p) => { $('#rBar').style.width = (p * 100).toFixed(0) + '%'; }, $('#rAO').checked);
    const url = cv.toDataURL('image/png');
    $('#rImg').src = url; $('#rDl').href = url; $('#rDl').download = fileName('randare', 'png');
    $('#rResult').hidden = false; $('#rStatus').textContent = `${t('Gata în')} ${fmt((performance.now() - t0) / 1000)} s.`;
    galleryAdd(cv, 'foto');
  } catch (e) { console.error(e); $('#rStatus').textContent = t('Randarea nu a reușit') + ': ' + e.message; }
  $('#rGo').disabled = false;
});
$('#btn360').addEventListener('click', () => { openModal('#m360'); $('#pStatus').textContent = ''; });
$('#pGo').addEventListener('click', async () => {
  $('#pGo').disabled = true; $('#pStatus').textContent = t('Se generează…');
  await new Promise((r) => setTimeout(r, 30));
  try {
    const cv = await renderPanorama(4096);
    showPano(cv);
    const url = cv.toDataURL('image/jpeg', 0.92); $('#pDl').href = url; $('#pDl').download = fileName('panorama-360', 'jpg');
    $('#pRow').hidden = false; $('#pStatus').textContent = t('Gata. Trage în imagine ca să privești în jur.');
    galleryAdd(cv, '360');
  } catch (e) { console.error(e); $('#pStatus').textContent = t('Nu a reușit') + ': ' + e.message; }
  $('#pGo').disabled = false;
});
$('#btnGallery').addEventListener('click', () => { openModal('#mGal'); renderGallery(); });

$('#undo').addEventListener('click', undo); $('#redo').addEventListener('click', redo);
$('#projName').addEventListener('change', (e) => { P.name = e.target.value || t('Proiect'); commit(); });
$('#template').addEventListener('change', (e) => {
  const v = e.target.value; e.target.value = '';
  if (!v) return;
  storeProject(true); loadTemplate(v);
});
function loadTemplate(v) {
  if (v === 'apartament') templateApartament(); else if (v === 'casa') templateCasa(); else if (v === 'casa_etaj') templateCasaEtaj(); else { P = emptyProject(); }
  delete P.id; history = []; hIndex = -1; freshLoad = true;
  sel = null; refreshAll(); zoomFit(); setCam(v === 'casa' || v === 'casa_etaj' ? 'exterior' : 'persp'); commit();
}
$('#btnExport').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(P, null, 1)], { type: 'application/json' }));
  a.download = fileName('proiect', 'json'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$('#btnImport').addEventListener('click', () => $('#fileIn').click());
$('#fileIn').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.levels) && (!Array.isArray(d.walls) || !Array.isArray(d.items))) throw new Error(t('fișierul nu e un proiect Planora'));
    storeProject(true);
    P = normalize(d); delete P.id; history = []; hIndex = -1;
    sel = null; refreshAll(); zoomFit(); commit(); storeProject(true); renderProjects(); toast(t('Proiect deschis.'));
  } catch (err) { toast(t('Nu pot deschide fișierul') + ': ' + err.message); }
  e.target.value = '';
});
function planCanvas() {
  const prev = { ...view }, prevSel = sel; sel = null;
  const b = bounds(), s = 80, pad = 1.2;
  const W = Math.round((b.x2 - b.x1 + pad * 2) * s), H = Math.round((b.y2 - b.y1 + pad * 2) * s);
  const oldW = c2d.width, oldH = c2d.height, oldDpr = dpr;
  // desenează pe o pânză separată la scară fixă
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  view.s = s; view.ox = (pad - b.x1) * s; view.oy = (pad - b.y1) * s;
  const r = c2d.getBoundingClientRect;
  c2d.getBoundingClientRect = () => ({ width: W, height: H, left: 0, top: 0 });
  c2d.width = W; c2d.height = H; dpr = 1;
  draw2D();
  cv.getContext('2d').drawImage(c2d, 0, 0);
  c2d.getBoundingClientRect = r; Object.assign(view, prev); sel = prevSel; dpr = oldDpr; c2d.width = oldW; c2d.height = oldH; draw2D();
  return cv;
}
$('#btnPlan').addEventListener('click', () => {
  const a = document.createElement('a'); a.href = planCanvas().toDataURL('image/png'); a.download = fileName('plan-2d', 'png'); a.click();
});
$('#zoomFit').addEventListener('click', zoomFit);
$$('#viewBtns .chip').forEach((b) => b.addEventListener('click', () => {
  $$('#viewBtns .chip').forEach((x) => x.classList.toggle('on', x === b));
  const st = $('#stage'); st.classList.remove('split', 'only2d', 'only3d'); st.classList.add(b.dataset.view);
  setTimeout(() => { resize2D(); resize3D(); }, 0);
}));
$('#mLeft').addEventListener('click', () => { $('#left').classList.toggle('show'); $('#right').classList.remove('show'); });
$('#mRight').addEventListener('click', () => { $('#right').classList.toggle('show'); $('#left').classList.remove('show'); });

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { if (sel) { e.preventDefault(); deleteSel(); } }
  else if (e.key === 'Escape') { if (pathDraft) endPath(); else if (wallChain) endWall(); else { sel = null; setTool('select'); renderProps(); highlight3D(); } }
  else if (e.key.toLowerCase() === 'r' && sel && sel.kind === 'item') { const it = findSel(); it.rot = (it.rot + 90) % 360; changed(); }
});

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

new ResizeObserver(() => { resize2D(); resize3D(); }).observe($('#stage'));

// ================= Proiectele mele =================
// Fiecare proiect se păstrează separat în browser; lista ține numele, data și o miniatură.
const LIST_KEY = 'planora-proiecte-v1', PKEY = (id) => 'planora-p-' + id;
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { } };
function projList() { try { return JSON.parse(lsGet(LIST_KEY) || '[]'); } catch (e) { return []; } }
let storeT = 0, freshLoad = false;
function scheduleStore() {
  // un șablon deschis și neatins nu se adaugă în listă
  if (freshLoad) { freshLoad = false; return; }
  clearTimeout(storeT); storeT = setTimeout(() => storeProject(false), 600);
}
function thumb3D() {
  const src = renderer.domElement; if (!src.width || !src.height || host3.offsetWidth < 3) return null;
  renderer.render(scene, camera);
  const c = document.createElement('canvas'); c.width = 320; c.height = 180;
  const k = Math.max(320 / src.width, 180 / src.height), w = src.width * k, h = src.height * k;
  c.getContext('2d').drawImage(src, (320 - w) / 2, (180 - h) / 2, w, h);
  return c.toDataURL('image/jpeg', 0.72);
}
function storeProject(withThumb) {
  clearTimeout(storeT);
  if (!P.levels.some((L) => L.walls.length || L.items.length) && !P.id) return;
  if (!P.id) P.id = uid('p');
  lsSet(PKEY(P.id), snapshot()); lsSet(STORE_KEY, snapshot());
  const list = projList(), old = list.find((x) => x.id === P.id);
  const entry = { id: P.id, name: P.name, updated: Date.now(), area: allRooms().reduce((a, r) => a + polyArea(r.pts), 0), thumb: (withThumb && thumb3D()) || (old && old.thumb) || null };
  const next = [entry, ...list.filter((x) => x.id !== P.id)];
  if (!lsSet(LIST_KEY, JSON.stringify(next))) { entry.thumb = null; lsSet(LIST_KEY, JSON.stringify(next.map((x) => ({ ...x, thumb: null })))); }
}
function openProject(id) {
  const raw = lsGet(PKEY(id)); if (!raw) return;
  storeProject(true);
  P = normalize(JSON.parse(raw)); P.id = id; history = []; hIndex = -1;
  sel = null; refreshAll(); zoomFit(); setCam('persp'); commit(); lsSet(STORE_KEY, snapshot());
  $('#mProj').classList.remove('open'); toast(t('Proiect deschis.'));
}
function renderProjects() {
  const list = projList(), when = (ms) => new Date(ms).toLocaleString(LANG, { dateStyle: 'medium', timeStyle: 'short' });
  $('#pjList').innerHTML = list.map((p) => `<figure data-id="${p.id}">
    ${p.thumb ? `<img src="${p.thumb}" alt="" data-open="${p.id}">` : `<div class="ph" data-open="${p.id}">🏠</div>`}
    ${p.id === P.id ? `<span class="cur">${t('Deschis acum')}</span>` : ''}
    <figcaption><b>${esc(p.name || t('Proiect'))}</b><small>${fmt(p.area || 0)} m² · ${when(p.updated)}</small></figcaption>
    <div class="acts">${p.id !== P.id ? `<button class="btn sm" data-open="${p.id}">${t('Deschide')}</button>` : ''}<button class="btn sm" data-dup="${p.id}">${t('Dublează')}</button><button class="btn sm danger" data-del="${p.id}">${t('Șterge')}</button></div>
  </figure>`).join('');
}
$('#pjList').classList.add('pj');
$('#btnProj').addEventListener('click', () => { storeProject(true); renderProjects(); openModal('#mProj'); });
$('#pjList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-open],[data-dup],[data-del]'); if (!b) return;
  if (b.dataset.open) { if (b.dataset.open !== P.id) openProject(b.dataset.open); return; }
  if (b.dataset.dup) {
    const raw = lsGet(PKEY(b.dataset.dup)); if (!raw) return;
    const d = JSON.parse(raw), id = uid('p'), src = projList().find((x) => x.id === b.dataset.dup) || {};
    d.id = id; d.name = (d.name || t('Proiect')) + ' · ' + t('Copie');
    lsSet(PKEY(id), JSON.stringify(d));
    lsSet(LIST_KEY, JSON.stringify([{ ...src, id, name: d.name, updated: Date.now() }, ...projList()]));
    renderProjects(); return;
  }
  if (b.dataset.del) {
    const it = projList().find((x) => x.id === b.dataset.del);
    if (!confirm(t('Ștergi proiectul') + ` „${it ? it.name : ''}”?`)) return;
    lsDel(PKEY(b.dataset.del)); lsSet(LIST_KEY, JSON.stringify(projList().filter((x) => x.id !== b.dataset.del)));
    if (b.dataset.del === P.id) delete P.id;
    renderProjects();
  }
});
$('#pjNew').addEventListener('click', () => { storeProject(true); loadTemplate('gol'); $('#mProj').classList.remove('open'); });
$('#pjCopy').addEventListener('click', () => {
  storeProject(true);
  P.id = uid('p'); P.name = P.name + ' · ' + t('Copie'); $('#projName').value = P.name;
  storeProject(true); renderProjects(); toast(t('Proiect salvat.'));
});

// ================= Calculator de costuri =================
// Cantitățile vin automat din proiect (toate nivelurile); prețurile sunt orientative și se pot schimba.
const PRICE_KEY = 'planora-preturi-v1';
const costState = (() => { try { return { region: 'md', roof: '', mine: {}, labour: false, ...JSON.parse(localStorage.getItem(PRICE_KEY) || '{}') }; } catch (e) { return { region: 'md', roof: '', mine: {}, labour: false }; } })();
function saveCost() { try { localStorage.setItem(PRICE_KEY, JSON.stringify(costState)); } catch (e) { } }
const money = (v, R) => `${v.toLocaleString(LANG, { minimumFractionDigits: R.dec, maximumFractionDigits: R.dec })} ${R.cur}`;
function costData() {
  const R = REGIONS[costState.region] || REGIONS.md, ri = costState.region === 'nl' ? 2 : 3;
  const roofCover = ROOF_COVERS.includes(costState.roof) ? costState.roof : (costState.region === 'nl' ? 'tigla_ceramica' : 'tigla_metalica');
  const mine = (costState.mine[costState.region] = costState.mine[costState.region] || {});
  const lines = costLines(quantities(), P.env, { roofCover }).map((l) => {
    const [name, unit, ...rng] = PRICES[l.key], [lo, hi] = rng[ri - 2];
    const price = mine[l.key] != null ? mine[l.key] : +((lo + hi) / 2).toFixed(R.dec);
    return { ...l, name, unit, lo, hi, price, total: l.qty * price };
  });
  const sum = (f) => lines.reduce((a, l) => a + f(l), 0);
  const tot = { mid: sum((l) => l.total), lo: sum((l) => l.qty * l.lo), hi: sum((l) => l.qty * l.hi) };
  const lab = costState.labour ? R.labour : 0;
  return { R, lines, tot, lab, roofCover };
}
function costTableHTML(editable) {
  const { R, lines, tot, lab } = costData();
  let g = '', h = `<table class="cost"><tr><th>${t('Material')}</th><th>${t('Cantitate')}</th><th>${t('Preț unitar')}</th><th>${t('Total')}</th></tr>`;
  for (const l of lines) {
    if (l.group !== g) { g = l.group; h += `<tr><th colspan="4">${t(g)}</th></tr>`; }
    const q = l.unit === 'buc' || l.unit === 'saci' || l.unit === 'L' ? Math.ceil(l.qty).toLocaleString(LANG) : fmt(l.qty, 1);
    h += `<tr><td>${t(l.name)}</td><td>${q} ${t(l.unit)}</td><td>${editable ? `<input type="number" min="0" step="any" data-price="${l.key}" value="${l.price}">` : money(l.price, R)} <small>${t('interval')} ${money(l.lo, R)}–${money(l.hi, R)}</small></td><td><b>${money(l.total, R)}</b></td></tr>`;
  }
  h += `<tr class="sum"><th colspan="3">${t('Total materiale')}</th><th>${money(tot.mid, R)}</th></tr>`;
  h += `<tr><td colspan="3">${t('Interval estimat (cel mai ieftin – cel mai scump)')}</td><td>${money(tot.lo, R)} – ${money(tot.hi, R)}</td></tr>`;
  if (lab) h += `<tr><td colspan="3">${t('Manoperă (estimare)')}</td><td>${money(tot.mid * lab, R)}</td></tr><tr class="sum"><th colspan="3">${t('Total cu manoperă')}</th><th>${money(tot.mid * (1 + lab), R)}</th></tr>`;
  if (R.eur) h += `<tr><td colspan="3">${t('Echivalent în euro')} (1 € ≈ ${R.eur} lei)</td><td>≈ ${Math.round(tot.mid * (1 + lab) / R.eur).toLocaleString(LANG)} €</td></tr>`;
  return h + '</table>';
}
function renderCost() {
  const { R, roofCover } = costData();
  $('#cRegion').value = costState.region; $('#cRoof').value = roofCover; $('#cLabour').checked = !!costState.labour;
  $('#costBody').innerHTML = costTableHTML(true) +
    `<p class="hint">${t(R.note)} ${t('Prețurile sunt orientative (noiembrie 2026) și se schimbă des. Verifică prețul la magazin înainte să cumperi; poți scrie prețul tău în tabel și se păstrează.')}</p>
     <p class="hint">${t('Cantitățile includ 10% rezervă la pardoseli și acoperiș. Fundația este o estimare (bandă 40 × 90 cm sub pereții exteriori).')}</p>
     <h3>${t('Unde găsești materialele')}</h3><div class="shops">${R.shops.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join('')}</div>`;
  $$('#costBody [data-price]').forEach((inp) => inp.addEventListener('change', () => {
    const v = parseFloat(inp.value); const m = costState.mine[costState.region];
    if (isFinite(v) && v >= 0) m[inp.dataset.price] = v; else delete m[inp.dataset.price];
    saveCost(); renderCost();
  }));
}
$('#cRoof').innerHTML = ROOF_COVERS.map((k) => `<option value="${k}">${t(PRICES[k][0])}</option>`).join('');
$('#cRegion').innerHTML = Object.entries(REGIONS).map(([k, r]) => `<option value="${k}">${t(r.name)} (${r.cur})</option>`).join('');
$('#cRegion').addEventListener('change', (e) => { costState.region = e.target.value; costState.roof = ''; saveCost(); renderCost(); });
$('#cRoof').addEventListener('change', (e) => { costState.roof = e.target.value; saveCost(); renderCost(); });
$('#cLabour').addEventListener('change', (e) => { costState.labour = e.target.checked; saveCost(); renderCost(); });
$('#cReset').addEventListener('click', () => { costState.mine[costState.region] = {}; saveCost(); renderCost(); });
$('#cPrint').addEventListener('click', () => { document.body.classList.add('print-cost'); window.print(); setTimeout(() => document.body.classList.remove('print-cost'), 500); });
$('#btnCost').addEventListener('click', () => { renderCost(); openModal('#mCost'); });

// ================= Fișa pentru client =================
// O pagină de prezentare a proiectului: randare 3D, plan, camere și cantități. Se tipărește sau se salvează ca PDF.
$('#btnSheet').addEventListener('click', async () => {
  openModal('#mSheet');
  const sh = $('#sheet'); sh.innerHTML = ''; $('#shStatus').textContent = t('Pregătesc fișa…'); $('#shPrint').disabled = true;
  await new Promise((r) => setTimeout(r, 30));
  try {
    const plans = []; eachLevel((L) => { if (L.walls.length || L.rooms.length) plans.push([L.name, planCanvas().toDataURL('image/png')]); });
    // dacă nu ești în interior, imaginea folosește o vedere de ansamblu bine încadrată, apoi camera revine unde era
    const keep = { pos: camera.position.clone(), tgt: controls.target.clone(), fov: camera.fov, aspect: camera.aspect, chip: $('#camBtns .chip.on') };
    if (!cameraInside()) { camera.aspect = 16 / 9; setCam('persp'); camera.position.lerp(controls.target, 0.1); controls.update(); }
    let img;
    try { img = (await renderPhoto(1600, 900, 12, null, true)).toDataURL('image/jpeg', 0.9); }
    finally {
      camera.position.copy(keep.pos); controls.target.copy(keep.tgt); camera.fov = keep.fov; camera.aspect = keep.aspect; camera.updateProjectionMatrix(); controls.update();
      $$('#camBtns .chip').forEach((x) => x.classList.toggle('on', x === keep.chip)); invalidate();
    }
    const area = allRooms().reduce((a, r) => a + polyArea(r.pts), 0), multi = P.levels.length > 1;
    const date = new Date().toLocaleDateString(LANG, { dateStyle: 'long' });
    sh.innerHTML = `<div class="sh-head"><div><div class="brand">Planora 3D</div><h1>${esc(P.name)}</h1></div><div>${date}</div></div>
      <div class="meta"><span>${t('Client')}</span><div contenteditable="true" data-ph="1"></div><span>${t('Observații')}</span><div contenteditable="true"></div></div>
      <img src="${img}" alt="">
      <div class="two">
        <div>${plans.map(([n, src]) => `<h3>${t('Plan 2D')}${multi ? ' · ' + esc(n) : ''}</h3><img src="${src}" alt="" style="background:#fff;border:1px solid var(--line)">`).join('')}</div>
        <div><h3>${t('Camere')}</h3><table><tr><th>${t('Cameră')}</th><th>${t('Pardoseală')}</th><th>${t('Suprafață')}</th></tr>
          ${P.levels.map((L) => (multi ? `<tr><th colspan="3">${esc(L.name)}</th></tr>` : '') + L.rooms.map((r) => `<tr><td>${esc(r.name)}</td><td>${t(FLOORS[r.floor] ? FLOORS[r.floor].name : r.floor)}</td><td>${fmt(polyArea(r.pts))} m²</td></tr>`).join('')).join('')}
          <tr><th>${t('Total')}</th><th></th><th>${fmt(area)} m²</th></tr></table>
          <h3>${t('Materiale estimate')}</h3>${qtyTable('')}</div>
      </div>
      <div><h3>${t('Cost estimativ al materialelor')} · ${t((REGIONS[costState.region] || REGIONS.md).name)}</h3>${costTableHTML(false)}
      </div>
      <p class="foot">${t('Cantitățile sunt estimative, fără pierderi și fără fundație. Golurile ușilor și ferestrelor sunt scăzute.')}</p>`;
    $('#shStatus').textContent = '';
  } catch (e) { console.error(e); $('#shStatus').textContent = t('Nu a reușit') + ': ' + e.message; }
  $('#shPrint').disabled = false;
});
$('#shPrint').addEventListener('click', () => window.print());

// ================= Pornire =================
window.I18N.apply(document); window.I18N.mountSelector($('#langSel'));
renderCatalog(); setTool('select');
let saved = null;
try { saved = localStorage.getItem(STORE_KEY); } catch (e) { }
// proiectul salvat înainte de lista de proiecte intră automat în listă
if (saved && !projList().length) { try { const d = JSON.parse(saved); if (!d.id) { d.id = uid('p'); saved = JSON.stringify(d); } lsSet(PKEY(d.id), saved); lsSet(LIST_KEY, JSON.stringify([{ id: d.id, name: d.name, updated: Date.now(), area: 0, thumb: null }])); } catch (e) { } }
const qp = new URLSearchParams(location.search).get('sablon');
if (qp) loadTemplate(qp);
else if (saved) { try { P = normalize(JSON.parse(saved)); refreshAll(); setTimeout(() => { zoomFit(); setCam('persp'); }, 0); commit(); } catch (e) { loadTemplate('apartament'); } }
else loadTemplate('apartament');
setTimeout(() => { resize2D(); resize3D(); zoomFit(); }, 0);
loop();

// Interfață pentru automatizare și teste (capturi pentru galerie)
window.planora = {
  get project() { return P; }, costData, scene, loadTemplate, setCam, renderPhoto, renderPanorama, setLevel, addLevel, setWalk, get walk() { return walk; },
  setEnv(o) { Object.assign(P.env, o); rebuild3D(); applyEnv(); renderProps(); },
  camera, controls, select(kind, id) { sel = { kind, id }; renderProps(); draw2D(); highlight3D(); },
};
