// Natura din jurul casei: cer cu nori și soare, pădurea de la orizont, iarbă cu fire, copaci și plante mai naturale.
import * as THREE from 'three';

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const matCache = new Map();
function m(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts }));
  return matCache.get(k);
}
const shade = (hex, a) => '#' + new THREE.Color(hex).offsetHSL(0, 0, a).getHexString();

// ---------- cerul ----------
// textură echirectangulară: gradient, nori moi și strălucirea soarelui; dir = direcția soarelui (vector unitar)
let cloudLayer = null;
function clouds(W, H) {
  if (cloudLayer) return cloudLayer;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const r = rng(4242);
  for (let i = 0; i < 70; i++) {
    const cx = r() * W, v = 0.06 + Math.pow(r(), 1.6) * 0.36, cy = H * v, s = (30 + r() * 120) * (1 - v * 1.2) * (W / 2048);
    const n = 5 + Math.floor(r() * 8);
    for (let k = 0; k < n; k++) {
      const x = cx + (r() - 0.5) * s * 3.2, y = cy + (r() - 0.5) * s * 0.5, rr = s * (0.5 + r() * 0.7);
      for (const dx of [-W, 0, W]) {
        const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, rr);
        gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(x + dx, y, rr, rr * 0.45, 0, 0, Math.PI * 2); g.fill();
      }
    }
  }
  return (cloudLayer = cv);
}
export function skyTexture({ top, mid, bottom, sunDir, sunColor, day, cloudiness = 1 }) {
  const W = 2048, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, top); gr.addColorStop(0.42, mid); gr.addColorStop(0.5, mid); gr.addColorStop(0.505, bottom); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // strălucirea soarelui
  if (sunDir && sunDir.y > -0.15) {
    const u = Math.atan2(sunDir.z, sunDir.x) / (2 * Math.PI) + 0.5, v = Math.asin(Math.max(-1, Math.min(1, sunDir.y))) / Math.PI + 0.5;
    const sx = (1 - u) * W, sy = (1 - v) * H, c = new THREE.Color(sunColor);
    for (const dx of [-W, 0, W]) {
      const glow = g.createRadialGradient(sx + dx, sy, 0, sx + dx, sy, H * 0.45);
      glow.addColorStop(0, `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${0.55 * (0.4 + 0.6 * day)})`);
      glow.addColorStop(0.15, `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},0.18)`); glow.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      if (sunDir.y > 0) { g.fillStyle = 'rgba(255,252,240,0.95)'; g.beginPath(); g.arc(sx + dx, sy, 9, 0, Math.PI * 2); g.fill(); }
    }
  }
  // norii: albi ziua, aurii la apus, gri-albăstrui noaptea
  if (cloudiness > 0) {
    g.globalAlpha = Math.min(1, cloudiness) * (0.25 + 0.75 * day);
    g.drawImage(clouds(W, H), 0, 0);
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- pădurea de la orizont ----------
export function treeLine(center, radius = 95, count = 340) {
  const grp = new THREE.Group(); grp.userData.treeLine = true;
  const r = rng(77);
  const leafGeo = new THREE.IcosahedronGeometry(1, 1), coneGeo = new THREE.ConeGeometry(1, 1, 8), trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1, 6);
  leafGeo.translate(0, 0, 0); coneGeo.translate(0, 0.5, 0); trunkGeo.translate(0, 0.5, 0);
  const lm = new THREE.MeshStandardMaterial({ roughness: 1, color: '#ffffff' }), tm = m('#4a3b2b');
  const leaves = new THREE.InstancedMesh(leafGeo, lm, count * 3), cones = new THREE.InstancedMesh(coneGeo, lm, count), trunks = new THREE.InstancedMesh(trunkGeo, tm, count);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  let nl = 0, nc = 0;
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, d = radius * (0.75 + r() * 0.55), x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d, h = 7 + r() * 11;
    M.compose(p.set(x, 0, z), q.identity(), s.set(1, h * 0.45, 1)); trunks.setMatrixAt(i, M);
    if (r() < 0.35) {
      M.compose(p.set(x, h * 0.18, z), q.identity(), s.set(h * 0.22, h * 0.9, h * 0.22)); cones.setMatrixAt(nc, M);
      cones.setColorAt(nc++, col.setHSL(0.36 + r() * 0.05, 0.3 + r() * 0.15, 0.08 + r() * 0.05));
    } else {
      for (let k = 0; k < 3; k++) {
        const rr = h * (0.22 + r() * 0.1);
        M.compose(p.set(x + (r() - 0.5) * rr, h * (0.55 + r() * 0.3), z + (r() - 0.5) * rr), q.setFromEuler(new THREE.Euler(r(), r() * 3, r())), s.set(rr, rr * (0.8 + r() * 0.3), rr));
        leaves.setMatrixAt(nl, M); leaves.setColorAt(nl++, col.setHSL(0.25 + r() * 0.08, 0.3 + r() * 0.15, 0.1 + r() * 0.07));
      }
    }
  }
  leaves.count = nl; cones.count = nc;
  for (const o of [leaves, cones, trunks]) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; grp.add(o); }
  return grp;
}

// ---------- iarbă cu fire ----------
// area = {x1, z1, x2, z2}; skip(x, z) = true unde nu crește iarbă (casă, alei, piscină)
export function grassField(area, skip, density = 14, seed = 9) {
  const r = rng(seed);
  // un smoc: 5 fire subțiri, ușor aplecate
  const pos = [], nrm = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3, ox = Math.cos(a) * 0.025, oz = Math.sin(a) * 0.025, w = 0.005, h = 0.045 + (k % 3) * 0.02, lean = 0.02;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w, tx = ox + Math.cos(a) * lean, tz = oz + Math.sin(a) * lean;
    pos.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, tx, h, tz);
    for (let i = 0; i < 3; i++) nrm.push(0, 1, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide });
  const A = (area.x2 - area.x1) * (area.z2 - area.z1), max = Math.min(220000, Math.round(A * density));
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), e = new THREE.Euler();
  let n = 0;
  for (let i = 0; i < max; i++) {
    const x = area.x1 + r() * (area.x2 - area.x1), z = area.z1 + r() * (area.z2 - area.z1);
    if (skip(x, z)) continue;
    const sc = 0.7 + r() * 0.9;
    M.compose(p.set(x, 0, z), q.setFromEuler(e.set(0, r() * 6.28, 0)), s.set(sc, sc * (0.8 + r() * 0.6), sc));
    mesh.setMatrixAt(n, M); mesh.setColorAt(n, col.setHSL(0.22 + r() * 0.05, 0.4 + r() * 0.15, 0.17 + r() * 0.1)); n++;
  }
  mesh.count = n; mesh.receiveShadow = true; mesh.castShadow = false; mesh.userData.grass = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// ---------- copaci și plante ----------
// un nor de frunze: icosaedru deformat, ca să nu arate ca o bilă perfectă
const clumpCache = new Map();
function clumpGeo(seed) {
  if (clumpCache.has(seed)) return clumpCache.get(seed);
  const g = new THREE.SphereGeometry(1, 18, 12), p = g.attributes.position, r = rng(seed * 31 + 7), v = new THREE.Vector3();
  const bumps = Array.from({ length: 9 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), 0.1 + r() * 0.2]);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize();
    // deformare din direcție (nu aleatoare pe vârf), ca marginile să rămână lipite
    let k = 1 + 0.05 * Math.sin(n.x * 9 + seed) * Math.sin(n.y * 7) * Math.sin(n.z * 8 + seed * 2); for (const [b, a] of bumps) k += a * Math.max(0, n.dot(b)) ** 3;
    v.multiplyScalar(k); v.y *= 0.85; p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); clumpCache.set(seed, g); return g;
}
// textura de frunziș: mii de frunze mici, deschise și închise, ca să nu pară plastic
let leafTex = null;
function leafMap() {
  if (leafTex) return leafTex;
  const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d'), r = rng(321);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) { const l = 150 + r() * 105; g.fillStyle = `rgb(${l},${l},${l})`; g.save(); g.translate(r() * n, r() * n); g.rotate(r() * 6.28); g.beginPath(); g.ellipse(0, 0, 2 + r() * 3, 1 + r() * 1.5, 0, 0, 6.28); g.fill(); g.restore(); }
  leafTex = new THREE.CanvasTexture(cv); leafTex.wrapS = leafTex.wrapT = THREE.RepeatWrapping; leafTex.repeat.set(3, 2); leafTex.colorSpace = THREE.SRGBColorSpace;
  return leafTex;
}
function clump(seed, color, r, x, y, z) {
  const o = new THREE.Mesh(clumpGeo(seed % 6), m(color, { roughness: 0.95, map: leafMap(), bumpMap: leafMap(), bumpScale: 2 }));
  o.scale.setScalar(r); o.position.set(x, y, z); o.rotation.y = seed; o.castShadow = o.receiveShadow = true; return o;
}
function limb(r0, r1, a, b, material) {
  const len = a.distanceTo(b), o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 7), material);
  o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); o.castShadow = true; return o;
}
// foios: trunchi, ramuri și 12–18 nori de frunze în mai multe nuanțe
export function deciduous(g, w, h, color, seed = 1, bark = '#5b4630') {
  const r = rng(seed * 97 + 13), bm = m(bark, { roughness: 1 });
  const th = h * 0.42, top = new THREE.Vector3(0, th, 0);
  g.add(limb(Math.max(0.1, w * 0.06), Math.max(0.07, w * 0.04), new THREE.Vector3(0, 0, 0), top, bm));
  const R = w * 0.5, cy = h * 0.62, n = 12 + Math.floor(r() * 6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r(), end = new THREE.Vector3(Math.cos(a) * R * 0.55, th + h * (0.15 + r() * 0.2), Math.sin(a) * R * 0.55);
    g.add(limb(w * 0.03, w * 0.015, top.clone().setY(th - 0.2), end, bm));
  }
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.7, y = cy + (r() - 0.35) * h * 0.38;
    const rr = R * (0.32 + r() * 0.2) * (1 - Math.abs(y - cy) / h * 0.8);
    g.add(clump(Math.floor(r() * 1000), shade(color, (r() - 0.5) * 0.1), rr, Math.cos(a) * d, y, Math.sin(a) * d));
  }
}
// conifer: trunchi și 7–9 etaje de „crengi” care se îngustează
export function conifer(g, w, h, color, seed = 1) {
  const r = rng(seed * 53 + 3);
  g.add(limb(0.14, 0.05, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h * 0.95, 0), m('#4e3b2a', { roughness: 1 })));
  // etaje de ramuri cu margini zimțate care atârnă, nu conuri netede
  const n = 13, needles = m(color, { roughness: 0.95, side: THREE.DoubleSide, map: leafMap(), bumpMap: leafMap(), bumpScale: 3 });
  for (let i = 0; i < n; i++) {
    const k = 1 - i / n, ch = h * 0.17, y = h * 0.1 + i * (h * 0.84 / n), rad = w / 2 * (0.12 + k * 0.92);
    const geo = new THREE.ConeGeometry(rad, ch, 28, 3, true);
    const p = geo.attributes.position, v = new THREE.Vector3(), ph = r() * 6, sp = 7 + Math.floor(r() * 4);
    for (let j = 0; j < p.count; j++) {
      v.fromBufferAttribute(p, j); const t = (ch / 2 - v.y) / ch, a = Math.atan2(v.z, v.x);
      const f = 1 + t * (0.22 * Math.sin(a * sp + ph) + 0.1 * Math.sin(a * 17 + ph * 2));
      v.x *= f; v.z *= f; v.y -= t * t * ch * 0.25 * (1 + Math.sin(a * sp + ph)); p.setXYZ(j, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const mt = i % 3 === 0 ? needles : m(shade(color, -0.03 + i * 0.004), { roughness: 0.95, side: THREE.DoubleSide, map: leafMap(), bumpMap: leafMap(), bumpScale: 3 });
    const c = new THREE.Mesh(geo, mt);
    c.position.y = y + ch / 2; c.rotation.y = r() * 6; c.castShadow = c.receiveShadow = true; g.add(c);
  }
}
// mesteacăn: trunchi alb cu dungi, coroană aerisită
export function birch(g, w, h, color, seed = 1) {
  const r = rng(seed * 11 + 5);
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#eae7df'; x.fillRect(0, 0, 32, 128);
  for (let i = 0; i < 26; i++) { x.fillStyle = 'rgba(30,30,30,0.8)'; x.fillRect(r() * 32, r() * 128, 6 + r() * 14, 1 + r() * 3); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const bm = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  g.add(limb(0.09, 0.05, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, h * 0.85, 0), bm));
  // coroană ovală, aerisită: ramuri subțiri și multe smocuri mici de frunze pe ele
  const tw = m('#3d3a36', { roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const t = r(), y = h * (0.4 + t * 0.52), env = Math.sin(Math.PI * Math.min(1, (y / h - 0.35) / 0.62)), a = r() * Math.PI * 2, d = w * 0.42 * env * (0.4 + r() * 0.6);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (i % 3 === 0) g.add(limb(0.03, 0.012, new THREE.Vector3(0.05, y - h * 0.12, 0), new THREE.Vector3(x * 0.8, y, z * 0.8), tw));
    g.add(clump(Math.floor(r() * 999), shade(color, (r() - 0.5) * 0.12), w * (0.11 + r() * 0.07), x, y, z));
  }
}
// tuia: coloană verde închis
export function thuja(g, w, h, color, seed = 1) {
  const r = rng(seed + 9);
  for (let i = 0; i < 5; i++) {
    const k = 1 - i / 6, o = clump(Math.floor(r() * 99), shade(color, (r() - 0.5) * 0.06), 1, 0, h * (0.18 + i * 0.16), 0);
    o.scale.set(w / 2 * (0.55 + k * 0.45), h * 0.17, w / 2 * (0.55 + k * 0.45)); g.add(o);
  }
}
// iarbă decorativă: smoc de frunze lungi, arcuite
export function ornamentalGrass(g, w, h, color, plume, seed = 1) {
  const r = rng(seed + 21), lm = m(color, { roughness: 0.9, side: THREE.DoubleSide }), pm = m(plume, { roughness: 1 });
  for (let i = 0; i < 38; i++) {
    const a = r() * Math.PI * 2, lean = 0.2 + r() * 0.5, len = h * (0.6 + r() * 0.5);
    const geo = new THREE.PlaneGeometry(0.025, len, 1, 4); const p = geo.attributes.position;
    for (let j = 0; j < p.count; j++) { const y = p.getY(j) + len / 2, f = y / len; p.setXYZ(j, p.getX(j) * (1 - f * 0.8), y * (1 - lean * f * f * 0.3), lean * f * f * len * 0.5); }
    geo.computeVertexNormals();
    const b = new THREE.Mesh(geo, lm); b.rotation.y = a; b.position.set(Math.cos(a) * w * 0.08, 0, Math.sin(a) * w * 0.08); b.castShadow = true; g.add(b);
    if (i % 4 === 0) { const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.18, 2, 6), pm); s.position.set(Math.cos(a) * lean * len * 0.45, len * 0.92, Math.sin(a) * lean * len * 0.45); s.rotation.z = lean * 0.6; g.add(s); }
  }
}
// bolovan decorativ: piatră rotunjită, neregulată
export function boulder(g, w, h, d, color, seed = 1) {
  const geo = new THREE.IcosahedronGeometry(0.5, 2), p = geo.attributes.position, r = rng(seed * 7 + 1), v = new THREE.Vector3();
  const bumps = Array.from({ length: 6 }, () => [new THREE.Vector3(r() - 0.5, r() * 0.6 - 0.2, r() - 0.5).normalize(), (r() - 0.4) * 0.25]);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(); let k = 1; for (const [b, a] of bumps) k += a * Math.max(0, n.dot(b)) ** 2; v.multiplyScalar(k); if (v.y < -0.1) v.y = -0.1 - (v.y + 0.1) * 0.1; p.setXYZ(i, v.x * w, (v.y + 0.12) * h * 1.6, v.z * d); }
  geo.computeVertexNormals();
  const o = new THREE.Mesh(geo, m(color, { roughness: 0.95, flatShading: false })); o.castShadow = o.receiveShadow = true; g.add(o);
}
// lavandă: tufe mici cu spice mov
export function lavender(g, w, d, h, color, seed = 1) {
  const r = rng(seed + 3), gm = m('#7b8f6a', { roughness: 0.95 }), fm = m(color, { roughness: 0.9 });
  const n = Math.max(3, Math.round(w * d * 10));
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * w * 0.9, z = (r() - 0.5) * d * 0.9, s = 0.12 + r() * 0.06;
    g.add(clump(i, '#7b8f6a', s, x, s * 0.7, z));
    for (let k = 0; k < 6; k++) { const a = r() * 6.28, o = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.07, 2, 5), fm); o.position.set(x + Math.cos(a) * s * 0.6, s * 1.4 + r() * h * 0.3, z + Math.sin(a) * s * 0.6); g.add(o); }
  }
  void gm;
}
// tufiș: 3–5 nori de frunze lipiți, ușor turtiți
export function shrub(g, w, h, color, seed = 1) {
  const r = rng(seed + 41), n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = r() * w * 0.2, rr = w * (0.28 + r() * 0.12);
    const o = clump(Math.floor(r() * 99), shade(color, (r() - 0.5) * 0.08), rr, Math.cos(a) * d, h * 0.42, Math.sin(a) * d); o.scale.y = h * 0.55; g.add(o);
  }
}
