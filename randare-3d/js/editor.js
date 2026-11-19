// Planora 3D: editor de plan 2D + vizualizare 3D + randare foto și 360°, totul în browser.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { CATALOG, BY_TYPE, buildItem, FLOORS, floorTexture, grassTexture, WALL_COLORS, mat } from './catalog.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const DEG = Math.PI / 180;
const STORE_KEY = 'planora-proiect-v1';

// ================= Modelul proiectului =================
let nextId = 1;
const uid = (p) => p + (nextId++).toString(36) + Math.random().toString(36).slice(2, 5);

function emptyProject() {
  return {
    name: 'Proiect nou', walls: [], openings: [], rooms: [], items: [],
    env: { hour: 15, north: 20, lights: 'auto', cutaway: false, ceiling: false, wallColor: '#f4f1ea', exposure: 1 },
  };
}
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
  const room = { id: uid('r'), name: name || `Cameră ${P.rooms.length + 1}`, pts: [[a, b], [c, b], [c, d], [a, d]], floor };
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

function addOpening(type, x, y, opts = {}) {
  const hit = nearestWall(x, y, 0.6);
  if (!hit) return null;
  const L = wallLen(hit.wall);
  const def = type === 'door' ? { w: 0.9, h: 2.1, sill: 0 } : { w: 1.4, h: 1.4, sill: 0.9 };
  const o = { id: uid('o'), wall: hit.wall.id, type, ...def, ...opts };
  if (L < o.w + 0.1) return null;
  o.pos = Math.max(o.w / 2 + 0.05, Math.min(L - o.w / 2 - 0.05, hit.t));
  P.openings.push(o);
  return o;
}

function addItem(type, x, y, rot = 0, extra = {}) {
  const c = BY_TYPE[type];
  const it = { id: uid('i'), type, x: r2(x), y: r2(y), rot, w: c.w, d: c.d, h: c.h, color: c.color, elev: c.elev || 0, ...extra };
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
  P = emptyProject(); P.name = 'Apartament 2 camere';
  addRoom(0, 0, 7, 6.5, 'Living și bucătărie', 'stejar');
  addRoom(7, 0, 11, 4, 'Dormitor', 'frasin');
  addRoom(7, 4, 11, 6.5, 'Baie', 'gresie');
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
  P = emptyProject(); P.name = 'Casă cu grădină';
  addRoom(0, 0, 7, 8, 'Living', 'nuc');
  addRoom(7, 0, 11.5, 3.8, 'Bucătărie', 'marmura');
  addRoom(7, 3.8, 11.5, 8, 'Dormitor', 'stejar');
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
  P.env.hour = 17.5; P.env.north = 35;
}

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
  updateUndo();
}
function restore(s) { P = JSON.parse(s); sel = null; refreshAll(); }
function undo() { if (hIndex > 0) { hIndex--; restore(history[hIndex]); updateUndo(); saveLocal(); } }
function redo() { if (hIndex < history.length - 1) { hIndex++; restore(history[hIndex]); updateUndo(); saveLocal(); } }
function saveLocal() { try { localStorage.setItem(STORE_KEY, snapshot()); } catch (e) { } }
function updateUndo() { $('#undo').disabled = hIndex <= 0; $('#redo').disabled = hIndex >= history.length - 1; }

function changed(rebuild = true) {
  if (rebuild) rebuild3D();
  draw2D(); renderProps(); commit();
}
function refreshAll() { $('#projName').value = P.name; rebuild3D(); draw2D(); renderProps(); applyEnv(); }

// ================= Vizualizarea 2D =================
const c2d = $('#c2d'), g2 = c2d.getContext('2d');
const view = { s: 50, ox: 60, oy: 60 };
let tool = 'select', sel = null; // sel = {kind:'item'|'wall'|'room'|'opening', id}
let hover = null, drag = null, wallChain = null, roomDraft = null, measure = null, mouseW = null;
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
    g2.fillText(polyArea(rm.pts).toFixed(1).replace('.', ',') + ' m²', cx, cy + 8);
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
  if (measure) { g2.setLineDash([6, 4]); dimLine(measure.x1, measure.y1, measure.x2, measure.y2, 0, '#c2410c'); g2.setLineDash([]); }
  if ((tool === 'door' || tool === 'window') && mouseW) {
    const hit = nearestWall(mouseW[0], mouseW[1], 0.6);
    if (hit) { const w = hit.wall, L = wallLen(w), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L; const half = (tool === 'door' ? 0.9 : 1.4) / 2;
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
  const label = L.toFixed(2).replace('.', ',') + ' m';
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
    const off = w.t / 2 * 0.6;
    g2.strokeStyle = selC; g2.lineWidth = 1.4;
    for (const k of [-off, 0, off]) {
      const [e, f] = toS(p0[0] + nx * k, p0[1] + ny * k), [g, h] = toS(p1[0] + nx * k, p1[1] + ny * k);
      g2.beginPath(); g2.moveTo(e, f); g2.lineTo(g, h); g2.stroke();
    }
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
  if (tool === 'room') { const [sx, sy] = [snapV(x, e), snapV(y, e)]; roomDraft = { x1: sx, y1: sy, x2: sx, y2: sy }; return; }
  if (tool === 'measure') { const p = snapToEndpoint(x, y, e); measure = { x1: p[0], y1: p[1], x2: p[0], y2: p[1], active: true }; return; }
  if (tool === 'door' || tool === 'window') {
    const o = addOpening(tool, x, y);
    if (o) { sel = { kind: 'opening', id: o.id }; changed(); } else toast('Pune ușa sau fereastra pe un perete destul de lung.');
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
    const { x1, y1, x2, y2 } = roomDraft; roomDraft = null;
    const rm = addRoom(x1, y1, x2, y2);
    if (rm) { sel = { kind: 'room', id: rm.id }; changed(); } else draw2D();
  }
  if (measure && measure.active) { measure.active = false; const L = dist(measure.x1, measure.y1, measure.x2, measure.y2); if (L > 0.01) toast(`Distanța: ${L.toFixed(2).replace('.', ',')} m`); }
  if (drag) {
    if (drag.kind === 'pan' && drag.click) { sel = hitTest(...toW(drag.sx, drag.sy)); renderProps(); highlight3D(); draw2D(); }
    if (drag.moved) changed();
  }
  drag = null;
});
c2d.addEventListener('dblclick', () => { if (wallChain) endWall(); });
c2d.addEventListener('contextmenu', (e) => e.preventDefault());
c2d.addEventListener('wheel', (e) => {
  e.preventDefault();
  const f = Math.exp(-e.deltaY * 0.0015), ns = Math.max(6, Math.min(250, view.s * f));
  const [x, y] = toW(e.offsetX, e.offsetY);
  view.s = ns; view.ox = e.offsetX - x * ns; view.oy = e.offsetY - y * ns; draw2D();
}, { passive: false });

function endWall() { wallChain = null; mouseW = null; draw2D(); }

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

function setTool(t) {
  tool = t; wallChain = null; roomDraft = null; measure = null;
  $$('#tools .tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  const hints = {
    select: 'Clic pe un obiect ca să-l selectezi. Trage de el ca să-l muți. Trage pe fundal ca să muți planul.',
    room: 'Trage un dreptunghi: se creează camera cu pereții ei. Camerele lipite împart același perete.',
    wall: 'Clic pentru fiecare colț. Dublu-clic sau Esc ca să termini. Shift dezactivează alinierea.',
    door: 'Clic pe un perete ca să pui o ușă. Apoi o poți trage de-a lungul peretelui.',
    window: 'Clic pe un perete ca să pui o fereastră. Lățimea și înălțimea le schimbi în dreapta.',
    measure: 'Trage între două puncte ca să afli distanța.',
  };
  $('#toolHint').textContent = hints[t];
  c2d.style.cursor = t === 'select' ? 'default' : 'crosshair';
  draw2D();
}
$$('#tools .tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

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

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
ground.material.map.repeat.set(100, 100);
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true; scene.add(ground);

let world = new THREE.Group(); scene.add(world);
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
function applyEnv() {
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
  baseLight.hemi = 0.3 + 0.6 * day; baseLight.fill = 0.08 + 0.12 * day; baseLight.day = day;
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
  hemi.intensity = baseLight.hemi * (inside ? 1.5 : 1);
  fill.intensity = baseLight.fill + (inside ? 0.45 * d + 0.08 : 0);
  renderer.toneMappingExposure = baseLight.exposure * (inside ? 1.15 : 1);
  world.children.forEach((o) => { if (o.userData.ceiling) o.visible = P.env.ceiling || inside; });
}

function disposeGroup(g) { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }

function rebuild3D() {
  scene.remove(world); disposeGroup(world);
  world = new THREE.Group(); scene.add(world); itemObjs.clear();
  lastLights = lightsOn();
  const wallH = (w) => P.env.cutaway ? Math.min(1.0, w.h) : w.h;
  // podele
  for (const rm of P.rooms) {
    const shape = new THREE.Shape(rm.pts.map(([x, y]) => new THREE.Vector2(x, -y)));
    const geo = new THREE.ShapeGeometry(shape);
    const f = FLOORS[rm.floor] || FLOORS.stejar, tex = floorTexture(rm.floor);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / f.size, uv.getY(i) / f.size);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: rm.floor === 'marmura' ? 0.25 : 0.6 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.003; m.receiveShadow = true; m.userData.ref = { kind: 'room', id: rm.id };
    world.add(m);
    if (!P.env.cutaway) {
      // tavanul apare doar când camera e în interior (sau când e bifat „Tavan mereu”)
      const cg = new THREE.ShapeGeometry(shape); const cm = new THREE.Mesh(cg, mat('#fbfaf7', { side: THREE.DoubleSide }));
      cm.rotation.x = -Math.PI / 2; cm.position.y = Math.min(...P.walls.map((w) => w.h), 2.7); cm.receiveShadow = true; cm.castShadow = true;
      cm.userData.ceiling = true; world.add(cm);
    }
  }
  // pereți cu goluri
  for (const w of P.walls) {
    const L = wallLen(w); if (L < 0.01) continue;
    const H = wallH(w), t = w.t, ang = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
    const grp = new THREE.Group();
    grp.position.set((w.x1 + w.x2) / 2, 0, (w.y1 + w.y2) / 2); grp.rotation.y = -ang;
    const wm = mat(w.color || P.env.wallColor, { roughness: 0.92 });
    const piece = (u0, u1, y0, y1) => {
      if (u1 - u0 < 0.001 || y1 - y0 < 0.001) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(u1 - u0, y1 - y0, t), wm);
      m.position.set((u0 + u1) / 2, (y0 + y1) / 2, 0); m.castShadow = true; m.receiveShadow = true; m.userData.ref = { kind: 'wall', id: w.id };
      grp.add(m);
    };
    const ops = P.openings.filter((o) => o.wall === w.id).sort((a, b) => a.pos - b.pos);
    let u = -L / 2 - t / 2;
    for (const o of ops) {
      const a = o.pos - o.w / 2 - L / 2, b = o.pos + o.w / 2 - L / 2;
      piece(u, a, 0, H);
      piece(a, b, 0, Math.min(H, o.sill));
      if (o.sill + o.h < H) piece(a, b, o.sill + o.h, H);
      if (o.sill < H) buildOpening3D(grp, o, a, b, t, Math.min(H, o.sill + o.h));
      u = b;
    }
    piece(u, L / 2 + t / 2, 0, H);
    world.add(grp);
  }
  // obiecte
  const on = lightsOn();
  for (const it of P.items) {
    const o = buildItem(it, on);
    o.position.set(it.x, it.elev || 0, it.y); o.rotation.y = -it.rot * DEG;
    o.traverse((m) => { m.userData.ref = { kind: 'item', id: it.id }; });
    world.add(o); itemObjs.set(it.id, o);
  }
  // centrul scenei pentru umbre
  const b = bounds();
  sceneCenter.set((b.x1 + b.x2) / 2, 0, (b.y1 + b.y2) / 2);
  sceneRadius = Math.max(6, Math.hypot(b.x2 - b.x1, b.y2 - b.y1) / 2 + 1);
  applyEnv();
  highlight3D();
}

function buildOpening3D(grp, o, a, b, t, top) {
  const frame = mat('#f7f7f5', { roughness: 0.5 }), wood = mat('#9a6b43', { roughness: 0.6 });
  const fw = 0.05, mid = (a + b) / 2, w = b - a;
  if (o.type === 'window') {
    const h = top - o.sill;
    const add = (bw, bh, bd, x, y, m) => { const k = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m); k.position.set(x, y, 0); k.castShadow = true; grp.add(k); };
    add(w, fw, t * 0.6, mid, o.sill + fw / 2, frame); add(w, fw, t * 0.6, mid, top - fw / 2, frame);
    add(fw, h, t * 0.6, a + fw / 2, o.sill + h / 2, frame); add(fw, h, t * 0.6, b - fw / 2, o.sill + h / 2, frame);
    if (w > 1.1) add(fw * 0.8, h, t * 0.5, mid, o.sill + h / 2, frame);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w - fw, h - fw, 0.01), new THREE.MeshPhysicalMaterial({ color: '#cfe6f3', transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0, depthWrite: false }));
    glass.position.set(mid, o.sill + h / 2, 0); grp.add(glass);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.03, t + 0.08), frame); sill.position.set(mid, o.sill - 0.015, 0); sill.castShadow = true; sill.receiveShadow = true; grp.add(sill);
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

function highlight3D() {
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
  return cam.position.y < 2.6 && P.rooms.some((r) => inPoly(cam.position.x, cam.position.z, r.pts));
}
function updateCeiling(force) { applyInterior(force); }

function resize3D() {
  const r = host3.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
}

let rendering = false;
function loop() {
  requestAnimationFrame(loop);
  if (rendering) return;
  controls.update();
  updateCeiling();
  if (selBox) selBox.update();
  if (host3.offsetWidth > 2) renderer.render(scene, camera);
}

function setCam(kind) {
  $$('#camBtns .chip').forEach((b) => b.classList.toggle('on', b.dataset.cam === kind));
  const b = bounds(), cx = (b.x1 + b.x2) / 2, cz = (b.y1 + b.y2) / 2;
  const R = Math.max(b.x2 - b.x1, b.y2 - b.y1) * Math.max(0.8, 1.1 / Math.max(0.3, camera.aspect));
  controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 0.2;
  if (kind === 'top') { camera.position.set(cx, R * 1.6 + 4, cz + 0.01); controls.target.set(cx, 0, cz); camera.fov = 50; }
  else if (kind === 'persp') { camera.position.set(cx + R * 0.55, R * 0.85 + 3, cz + R * 0.95); controls.target.set(cx, 0, cz); camera.fov = 45; }
  else if (kind === 'exterior') { camera.position.set(cx - R * 0.65, 1.7, cz + R * 1.25); controls.target.set(cx, 1.4, cz); camera.fov = 50; }
  else if (kind === 'interior') {
    const rm = [...P.rooms].sort((a, c) => polyArea(c.pts) - polyArea(a.pts))[0];
    if (!rm) return setCam('persp');
    const xs = rm.pts.map((p) => p[0]), ys = rm.pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    // din dreptul peretelui de jos, privind spre peretele opus
    camera.position.set((x0 + x1) / 2 + (x1 - x0) * 0.12, 1.55, y1 - 0.75); controls.target.set((x0 + x1) / 2 - (x1 - x0) * 0.05, 1.1, y0 + 0.5); camera.fov = 68;
    if (P.env.cutaway) { P.env.cutaway = false; $('#cutBtn').classList.remove('on'); rebuild3D(); }
  }
  camera.updateProjectionMatrix(); controls.update();
}
$$('#camBtns .chip').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));
$('#cutBtn').addEventListener('click', () => { P.env.cutaway = !P.env.cutaway; $('#cutBtn').classList.toggle('on', P.env.cutaway); changed(); });

// ================= Panoul de proprietăți =================
const props = $('#props');
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function num(label, key, val, step = 0.05, min = 0, max = 50, unit = 'm') {
  return `<div class="field"><label>${label}</label><input type="number" data-k="${key}" value="${+(+val).toFixed(3)}" step="${step}" min="${min}" max="${max}" title="${unit}"></div>`;
}

function renderProps() {
  const s = sel && findSel();
  if (!s) return renderEnvPanel();
  let h = '';
  if (sel.kind === 'item') {
    const it = s, c = BY_TYPE[it.type];
    h += `<div class="sec"><h3>${c.icon} ${esc(c.name)}</h3>
      ${num('Lățime', 'w', it.w, 0.05, 0.05)}${num('Adâncime', 'd', it.d, 0.05, 0.02)}${num('Înălțime', 'h', it.h, 0.05, 0.01)}
      ${num('De la podea', 'elev', it.elev || 0, 0.05, 0, 5)}
      <div class="field"><label>Rotire</label><input type="range" data-k="rot" min="0" max="359" step="1" value="${it.rot}"></div>
      <div class="field"><label>Culoare</label><input type="color" data-k="color" value="${it.color}"></div>
      <div class="row"><button class="btn" data-act="rot90">⟳ 90°</button><button class="btn" data-act="dup">Dublează</button><button class="btn danger" data-act="del">Șterge</button></div></div>`;
  } else if (sel.kind === 'wall') {
    const w = s;
    h += `<div class="sec"><h3>Perete</h3>
      ${num('Lungime', 'len', wallLen(w), 0.05, 0.1)}${num('Grosime', 't', w.t, 0.01, 0.05, 1)}${num('Înălțime', 'h', w.h, 0.05, 0.5, 8)}
      <div class="field"><label>Culoare</label><div class="swatches">${WALL_COLORS.map(([c, n]) => `<button class="sw ${((w.color || P.env.wallColor) === c) ? 'on' : ''}" style="background:${c}" title="${n}" data-wc="${c}"></button>`).join('')}</div></div>
      <div class="row"><button class="btn" data-act="door">＋ Ușă</button><button class="btn" data-act="window">＋ Fereastră</button><button class="btn danger" data-act="del">Șterge</button></div>
      <p class="hint">Trage de cercurile de la capete ca să muți colțurile.</p></div>`;
  } else if (sel.kind === 'opening') {
    const o = s;
    h += `<div class="sec"><h3>${o.type === 'door' ? 'Ușă' : 'Fereastră'}</h3>
      ${num('Lățime', 'w', o.w, 0.05, 0.3, 6)}${num('Înălțime', 'h', o.h, 0.05, 0.3, 4)}${num('Parapet', 'sill', o.sill, 0.05, 0, 3)}${num('Poziție', 'pos', o.pos, 0.05, 0, 50)}
      <div class="row"><button class="btn danger" data-act="del">Șterge</button></div></div>`;
  } else if (sel.kind === 'room') {
    const rm = s;
    h += `<div class="sec"><h3>Cameră</h3>
      <div class="field"><label>Nume</label><input type="text" data-k="name" value="${esc(rm.name)}"></div>
      <div class="stat"><span>Suprafață</span><b>${polyArea(rm.pts).toFixed(2).replace('.', ',')} m²</b></div>
      <h3 style="margin-top:12px">Pardoseală</h3>
      <div class="floors">${Object.entries(FLOORS).map(([id, f]) => `<button data-floor="${id}" class="${rm.floor === id ? 'on' : ''}"><canvas data-prev="${id}"></canvas>${f.name}</button>`).join('')}</div>
      <div class="row"><button class="btn danger" data-act="del">Șterge camera</button></div></div>`;
  }
  props.innerHTML = h + envHTML(true);
  bindProps(s);
  drawFloorPreviews();
}

function envHTML(collapsed) {
  const e = P.env, hh = Math.floor(e.hour), mm = Math.round((e.hour - hh) * 60);
  return `<div class="sec"><h3>Lumină și ambient</h3>
    <div class="field"><label>Ora zilei <b id="hourLbl">${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</b></label><input type="range" data-env="hour" min="5" max="22" step="0.25" value="${e.hour}"></div>
    <div class="field"><label>Orientare nord</label><input type="range" data-env="north" min="0" max="359" step="1" value="${e.north}"></div>
    <div class="field"><label>Expunere</label><input type="range" data-env="exposure" min="0.4" max="2" step="0.05" value="${e.exposure}"></div>
    <div class="field"><label>Lămpi</label><select data-env="lights"><option value="auto" ${e.lights === 'auto' ? 'selected' : ''}>Automat (seara)</option><option value="on" ${e.lights === 'on' ? 'selected' : ''}>Aprinse</option><option value="off" ${e.lights === 'off' ? 'selected' : ''}>Stinse</option></select></div>
    <div class="field"><label>Tavan mereu</label><input type="checkbox" data-env="ceiling" ${e.ceiling ? 'checked' : ''} style="justify-self:start"></div>
    ${collapsed ? '' : `<h3 style="margin-top:12px">Culoarea pereților</h3><div class="swatches">${WALL_COLORS.map(([c, n]) => `<button class="sw ${e.wallColor === c ? 'on' : ''}" style="background:${c}" title="${n}" data-envwc="${c}"></button>`).join('')}</div>`}
  </div>`;
}

function renderEnvPanel() {
  const area = P.rooms.reduce((s, r) => s + polyArea(r.pts), 0);
  const wl = P.walls.reduce((s, w) => s + wallLen(w), 0);
  props.innerHTML = `<div class="sec"><h3>Proiect</h3>
    <div class="stat"><span>Suprafață camere</span><b>${area.toFixed(1).replace('.', ',')} m²</b></div>
    <div class="stat"><span>Camere</span><b>${P.rooms.length}</b></div>
    <div class="stat"><span>Lungime pereți</span><b>${wl.toFixed(1).replace('.', ',')} m</b></div>
    <div class="stat"><span>Uși / ferestre</span><b>${P.openings.filter((o) => o.type === 'door').length} / ${P.openings.filter((o) => o.type === 'window').length}</b></div>
    <div class="stat"><span>Obiecte</span><b>${P.items.length}</b></div>
    <p class="hint">Selectează o cameră ca să-i schimbi pardoseala, sau un perete ca să-i schimbi culoarea.</p></div>` + envHTML(false);
  bindProps(null);
}

function findSel() {
  if (!sel) return null;
  const list = { item: P.items, wall: P.walls, room: P.rooms, opening: P.openings }[sel.kind];
  return list && list.find((x) => x.id === sel.id);
}

function bindProps(obj) {
  props.querySelectorAll('[data-k]').forEach((inp) => {
    const k = inp.dataset.k;
    const apply = (final) => {
      let v = inp.type === 'number' || inp.type === 'range' ? parseFloat(inp.value) : inp.value;
      if (inp.type === 'number' && !isFinite(v)) return;
      if (sel.kind === 'wall' && k === 'len') {
        const L = wallLen(obj); if (v < 0.1) return;
        const ux = (obj.x2 - obj.x1) / L, uy = (obj.y2 - obj.y1) / L;
        moveVertex([obj.x2, obj.y2], [r2(obj.x1 + ux * v), r2(obj.y1 + uy * v)]);
      } else obj[k] = v;
      if (sel.kind === 'opening') { const w = getWall(obj.wall), L = wallLen(w); obj.pos = Math.max(obj.w / 2 + 0.02, Math.min(L - obj.w / 2 - 0.02, obj.pos)); }
      if (final) changed(); else { rebuild3D(); draw2D(); }
    };
    inp.addEventListener('input', () => apply(false));
    inp.addEventListener('change', () => apply(true));
  });
  props.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.act, obj)));
  props.querySelectorAll('[data-wc]').forEach((b) => b.addEventListener('click', () => { obj.color = b.dataset.wc === P.env.wallColor ? null : b.dataset.wc; changed(); }));
  props.querySelectorAll('[data-floor]').forEach((b) => b.addEventListener('click', () => { obj.floor = b.dataset.floor; changed(); }));
  props.querySelectorAll('[data-envwc]').forEach((b) => b.addEventListener('click', () => { P.env.wallColor = b.dataset.envwc; changed(); }));
  props.querySelectorAll('[data-env]').forEach((inp) => {
    const k = inp.dataset.env;
    const apply = (final) => {
      P.env[k] = inp.type === 'checkbox' ? inp.checked : inp.tagName === 'SELECT' ? inp.value : parseFloat(inp.value);
      if (k === 'hour') { const hh = Math.floor(P.env.hour), mm = Math.round((P.env.hour - hh) * 60); const l = $('#hourLbl'); if (l) l.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }
      if (k === 'ceiling') rebuild3D();
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
  else if (a === 'door' || a === 'window') {
    const mx = (obj.x1 + obj.x2) / 2, my = (obj.y1 + obj.y2) / 2;
    const o = addOpening(a, mx, my); if (o) { o.wall = obj.id; sel = { kind: 'opening', id: o.id }; changed(); } else toast('Peretele e prea scurt.');
  }
}
function deleteSel() {
  if (!sel) return;
  const k = sel.kind, id = sel.id;
  if (k === 'item') P.items = P.items.filter((x) => x.id !== id);
  if (k === 'opening') P.openings = P.openings.filter((x) => x.id !== id);
  if (k === 'wall') { P.walls = P.walls.filter((x) => x.id !== id); P.openings = P.openings.filter((o) => o.wall !== id); }
  if (k === 'room') P.rooms = P.rooms.filter((x) => x.id !== id);
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
}

// ================= Catalogul din stânga =================
const cats = [...new Set(CATALOG.map((c) => c.cat))];
let curCat = cats[0];
function renderCatalog() {
  $('#catTabs').innerHTML = cats.map((c) => `<button class="${c === curCat ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('');
  $('#items').innerHTML = CATALOG.filter((c) => c.cat === curCat).map((c) => `<button class="item" data-type="${c.type}"><span class="em">${c.icon}</span>${c.name}</button>`).join('');
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
async function renderPhoto(width, height, samples, onProgress) {
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
  try {
    for (let i = 0; i < samples; i++) {
      // pseudo-aleator Halton pentru eșantionare uniformă
      const hx = halton(i + 1, 2) - 0.5, hy = halton(i + 1, 3) - 0.5;
      cam.setViewOffset(width, height, hx, hy, width, height);
      const a = halton(i + 1, 5) * Math.PI * 2, rr = Math.sqrt(halton(i + 1, 7)) * jitterR;
      sun.position.copy(basePos).add(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr));
      renderer.render(scene, cam);
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
  $('#galList').innerHTML = list.map((g) => `<figure><img src="${g.thumb}" data-open="${g.id}" alt="${esc(g.name)}"><figcaption><span>${g.kind === '360' ? '🌐 ' : ''}${esc(g.name)}<br><small>${new Date(g.date).toLocaleString('ro-RO')} · ${g.w}×${g.h}</small></span><span><button class="btn" data-dl="${g.id}" title="Descarcă">⬇</button> <button class="btn danger" data-rm="${g.id}" title="Șterge">✕</button></span></figcaption></figure>`).join('');
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
  $('#rStatus').textContent = `Se randează ${W}×${H}…`;
  try {
    const cv = await renderPhoto(W, H, S, (p) => { $('#rBar').style.width = (p * 100).toFixed(0) + '%'; });
    const url = cv.toDataURL('image/png');
    $('#rImg').src = url; $('#rDl').href = url; $('#rDl').download = fileName('randare', 'png');
    $('#rResult').hidden = false; $('#rStatus').textContent = `Gata în ${((performance.now() - t0) / 1000).toFixed(1).replace('.', ',')} s.`;
    galleryAdd(cv, 'foto');
  } catch (e) { console.error(e); $('#rStatus').textContent = 'Randarea nu a reușit: ' + e.message; }
  $('#rGo').disabled = false;
});
$('#btn360').addEventListener('click', () => { openModal('#m360'); $('#pStatus').textContent = ''; });
$('#pGo').addEventListener('click', async () => {
  $('#pGo').disabled = true; $('#pStatus').textContent = 'Se generează…';
  await new Promise((r) => setTimeout(r, 30));
  try {
    const cv = await renderPanorama(4096);
    showPano(cv);
    const url = cv.toDataURL('image/jpeg', 0.92); $('#pDl').href = url; $('#pDl').download = fileName('panorama-360', 'jpg');
    $('#pRow').hidden = false; $('#pStatus').textContent = 'Gata. Trage în imagine ca să privești în jur.';
    galleryAdd(cv, '360');
  } catch (e) { console.error(e); $('#pStatus').textContent = 'Nu a reușit: ' + e.message; }
  $('#pGo').disabled = false;
});
$('#btnGallery').addEventListener('click', () => { openModal('#mGal'); renderGallery(); });

$('#undo').addEventListener('click', undo); $('#redo').addEventListener('click', redo);
$('#projName').addEventListener('change', (e) => { P.name = e.target.value || 'Proiect'; commit(); });
$('#template').addEventListener('change', (e) => {
  const v = e.target.value; e.target.value = '';
  if (!v) return;
  if (P.walls.length && !confirm('Înlocuiești proiectul curent cu șablonul? Poți reveni cu „Anulează”.')) return;
  loadTemplate(v);
});
function loadTemplate(v) {
  if (v === 'apartament') templateApartament(); else if (v === 'casa') templateCasa(); else { P = emptyProject(); }
  sel = null; refreshAll(); zoomFit(); setCam(v === 'casa' ? 'exterior' : 'persp'); commit();
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
    if (!Array.isArray(d.walls) || !Array.isArray(d.items)) throw new Error('fișierul nu e un proiect Planora');
    P = { ...emptyProject(), ...d, env: { ...emptyProject().env, ...(d.env || {}) } };
    sel = null; refreshAll(); zoomFit(); commit(); toast('Proiect deschis.');
  } catch (err) { toast('Nu pot deschide fișierul: ' + err.message); }
  e.target.value = '';
});
$('#btnPlan').addEventListener('click', () => {
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
  const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = fileName('plan-2d', 'png'); a.click();
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
  else if (e.key === 'Escape') { if (wallChain) endWall(); else { sel = null; setTool('select'); renderProps(); highlight3D(); } }
  else if (e.key.toLowerCase() === 'r' && sel && sel.kind === 'item') { const it = findSel(); it.rot = (it.rot + 90) % 360; changed(); }
});

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

new ResizeObserver(() => { resize2D(); resize3D(); }).observe($('#stage'));

// ================= Pornire =================
renderCatalog();
let saved = null;
try { saved = localStorage.getItem(STORE_KEY); } catch (e) { }
const qp = new URLSearchParams(location.search).get('sablon');
if (qp) loadTemplate(qp);
else if (saved) { try { P = JSON.parse(saved); refreshAll(); setTimeout(() => { zoomFit(); setCam('persp'); }, 0); commit(); } catch (e) { loadTemplate('apartament'); } }
else loadTemplate('apartament');
setTimeout(() => { resize2D(); resize3D(); zoomFit(); }, 0);
loop();

// Interfață pentru automatizare și teste (capturi pentru galerie)
window.planora = {
  get project() { return P; }, loadTemplate, setCam, renderPhoto, renderPanorama,
  setEnv(o) { Object.assign(P.env, o); rebuild3D(); applyEnv(); renderProps(); },
  camera, controls, select(kind, id) { sel = { kind, id }; renderProps(); draw2D(); highlight3D(); },
};
