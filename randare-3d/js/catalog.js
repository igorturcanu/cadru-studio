// Catalogul de obiecte 3D: toate modelele sunt construite din forme simple (cutii, cilindri, sfere),
// fără fișiere externe. Fiecare model are originea în centrul bazei și dimensiunile date în metri.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts }));
  }
  return matCache.get(key);
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function rbox(w, h, d, r, material, x = 0, y = 0, z = 0) {
  // cutie cu muchii rotunjite (pentru perne, saltele)
  const shape = new THREE.Shape();
  const hw = w / 2 - r, hh = h / 2 - r;
  shape.moveTo(-hw, -h / 2);
  shape.lineTo(hw, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh);
  shape.lineTo(w / 2, hh); shape.quadraticCurveTo(w / 2, h / 2, hw, h / 2);
  shape.lineTo(-hw, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh);
  shape.lineTo(-w / 2, -hh); shape.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.6, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rTop, rBot, h, material, x = 0, y = 0, z = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function sphere(r, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function legs(g, w, d, h, t, material, inset = 0.03) {
  const xs = [-w / 2 + t / 2 + inset, w / 2 - t / 2 - inset];
  const zs = [-d / 2 + t / 2 + inset, d / 2 - t / 2 - inset];
  for (const x of xs) for (const z of zs) g.add(box(t, h, t, material, x, 0, z));
}

const WOOD = '#8a5a35', WOOD_LIGHT = '#c49a6c', DARK = '#2b2b2e', WHITE = '#f3f1ec', METAL = '#9aa0a6';

// Fiecare intrare: tip, nume, categorie, dimensiuni implicite (l = lățime pe X, a = adâncime pe Z, h = înălțime), culoare principală.
export const CATALOG = [
  { type: 'canapea', name: 'Canapea', cat: 'Living', icon: '🛋️', w: 2.2, d: 0.95, h: 0.85, color: '#7d8b99' },
  { type: 'fotoliu', name: 'Fotoliu', cat: 'Living', icon: '💺', w: 0.9, d: 0.9, h: 0.85, color: '#b4704a' },
  { type: 'masuta', name: 'Măsuță de cafea', cat: 'Living', icon: '◻️', w: 1.1, d: 0.6, h: 0.42, color: WOOD_LIGHT },
  { type: 'comoda_tv', name: 'Comodă TV', cat: 'Living', icon: '📺', w: 1.8, d: 0.45, h: 1.25, color: WOOD },
  { type: 'raft', name: 'Bibliotecă', cat: 'Living', icon: '📚', w: 1.0, d: 0.35, h: 2.0, color: WOOD_LIGHT },
  { type: 'covor', name: 'Covor', cat: 'Living', icon: '🟫', w: 2.4, d: 1.7, h: 0.02, color: '#c9b79c' },
  { type: 'lampa', name: 'Lampă de podea', cat: 'Lumini', icon: '💡', w: 0.4, d: 0.4, h: 1.65, color: '#f2e6c9' },
  { type: 'lustra', name: 'Lustră', cat: 'Lumini', icon: '🔆', w: 0.6, d: 0.6, h: 0.5, color: '#f2e6c9', elev: 2.1 },
  { type: 'pat', name: 'Pat dublu', cat: 'Dormitor', icon: '🛏️', w: 1.7, d: 2.1, h: 1.0, color: '#e9e4da' },
  { type: 'noptiera', name: 'Noptieră', cat: 'Dormitor', icon: '▫️', w: 0.5, d: 0.4, h: 0.5, color: WOOD },
  { type: 'dulap', name: 'Dulap', cat: 'Dormitor', icon: '🚪', w: 1.6, d: 0.6, h: 2.2, color: '#ece7df' },
  { type: 'birou', name: 'Birou', cat: 'Dormitor', icon: '🖥️', w: 1.4, d: 0.7, h: 0.75, color: WOOD_LIGHT },
  { type: 'masa', name: 'Masă de dining', cat: 'Bucătărie', icon: '🍽️', w: 1.8, d: 0.9, h: 0.76, color: WOOD },
  { type: 'scaun', name: 'Scaun', cat: 'Bucătărie', icon: '🪑', w: 0.45, d: 0.5, h: 0.9, color: DARK },
  { type: 'bucatarie', name: 'Corp bucătărie', cat: 'Bucătărie', icon: '🧑‍🍳', w: 2.4, d: 0.62, h: 0.9, color: '#e8e4dc' },
  { type: 'frigider', name: 'Frigider', cat: 'Bucătărie', icon: '🧊', w: 0.7, d: 0.68, h: 1.9, color: '#d8dcdf' },
  { type: 'cada', name: 'Cadă', cat: 'Baie', icon: '🛁', w: 1.7, d: 0.75, h: 0.58, color: WHITE },
  { type: 'dus', name: 'Cabină de duș', cat: 'Baie', icon: '🚿', w: 0.9, d: 0.9, h: 2.0, color: WHITE },
  { type: 'wc', name: 'Toaletă', cat: 'Baie', icon: '🚽', w: 0.4, d: 0.65, h: 0.8, color: WHITE },
  { type: 'lavoar', name: 'Lavoar cu mobilier', cat: 'Baie', icon: '🚰', w: 0.8, d: 0.48, h: 0.85, color: WOOD_LIGHT },
  { type: 'planta', name: 'Plantă', cat: 'Decor', icon: '🪴', w: 0.5, d: 0.5, h: 1.3, color: '#4f7d46' },
  { type: 'tablou', name: 'Tablou', cat: 'Decor', icon: '🖼️', w: 1.0, d: 0.04, h: 0.7, color: '#3c6e91', elev: 1.3 },
  { type: 'copac', name: 'Copac', cat: 'Exterior', icon: '🌳', w: 3, d: 3, h: 5.5, color: '#3f6b35' },
  { type: 'tufis', name: 'Tufiș', cat: 'Exterior', icon: '🌿', w: 1.0, d: 1.0, h: 0.8, color: '#4d7c3a' },
  { type: 'masina', name: 'Mașină', cat: 'Exterior', icon: '🚗', w: 1.8, d: 4.3, h: 1.45, color: '#a33b32' },
  { type: 'piscina', name: 'Piscină', cat: 'Exterior', icon: '🏊', w: 3.5, d: 7, h: 0.05, color: '#4fb3d9' },
];
export const BY_TYPE = Object.fromEntries(CATALOG.map(c => [c.type, c]));

// Construiește modelul pentru un obiect din plan. it = {type, w, d, h, color}
export function buildItem(it, lightsOn) {
  const g = new THREE.Group();
  const { w, d, h } = it;
  const c = mat(it.color);
  const wood = mat(WOOD), dark = mat(DARK), metal = mat(METAL, { metalness: 0.6, roughness: 0.35 }), white = mat(WHITE, { roughness: 0.3 });
  switch (it.type) {
    case 'canapea': {
      const seatH = h * 0.5, arm = Math.min(0.2, w * 0.1);
      g.add(box(w, 0.12, d, dark, 0, 0, 0));
      g.add(rbox(w, seatH - 0.12, d, 0.04, c, 0, 0.1, 0));
      g.add(rbox(w - 2 * arm, h - seatH, 0.22, 0.05, c, 0, seatH - 0.02, -d / 2 + 0.11));
      g.add(rbox(arm, h * 0.72 - 0.1, d, 0.04, c, -w / 2 + arm / 2, 0.1, 0));
      g.add(rbox(arm, h * 0.72 - 0.1, d, 0.04, c, w / 2 - arm / 2, 0.1, 0));
      const n = w > 1.6 ? 3 : 2, cw = (w - 2 * arm) / n;
      for (let i = 0; i < n; i++) g.add(rbox(cw - 0.03, 0.14, d - 0.28, 0.05, c, -w / 2 + arm + cw * (i + 0.5), seatH - 0.03, 0.08));
      g.add(rbox(0.42, 0.38, 0.14, 0.05, mat('#e8d9b5'), -w / 2 + arm + 0.3, seatH + 0.08, -d / 2 + 0.3));
      break;
    }
    case 'fotoliu': {
      const seatH = h * 0.5;
      g.add(rbox(w, seatH, d, 0.04, c, 0, 0.08, 0));
      legs(g, w, d, 0.1, 0.04, wood);
      g.add(rbox(w, h - seatH - 0.05, 0.18, 0.05, c, 0, seatH, -d / 2 + 0.09));
      g.add(rbox(0.14, 0.22, d, 0.04, c, -w / 2 + 0.07, seatH + 0.05, 0));
      g.add(rbox(0.14, 0.22, d, 0.04, c, w / 2 - 0.07, seatH + 0.05, 0));
      break;
    }
    case 'masuta': {
      g.add(box(w, 0.05, d, c, 0, h - 0.05, 0));
      g.add(box(w - 0.1, 0.03, d - 0.1, c, 0, 0.12, 0));
      legs(g, w, d, h - 0.05, 0.04, dark);
      break;
    }
    case 'comoda_tv': {
      g.add(box(w, 0.5, d, c, 0, 0.06, 0));
      legs(g, w, d, 0.06, 0.04, dark);
      for (let i = 0; i < 3; i++) g.add(box(w / 3 - 0.02, 0.4, 0.01, mat('#6e4527'), -w / 3 + i * w / 3, 0.11, d / 2));
      const tvW = Math.min(w * 0.75, 1.45), tvH = tvW * 0.58;
      g.add(box(tvW, tvH, 0.05, dark, 0, Math.max(0.6, h - tvH), -0.05));
      g.add(box(tvW - 0.04, tvH - 0.04, 0.005, mat('#10151c', { roughness: 0.15, metalness: 0.2 }), 0, Math.max(0.6, h - tvH) + 0.02, -0.022));
      break;
    }
    case 'raft': {
      const t = 0.025;
      g.add(box(t, h, d, c, -w / 2 + t / 2, 0, 0)); g.add(box(t, h, d, c, w / 2 - t / 2, 0, 0));
      g.add(box(w, h, 0.01, c, 0, 0, -d / 2 + 0.005));
      const shelves = 5;
      const bookCols = ['#7a2e2e', '#2e4f7a', '#d4a85a', '#3b6b4b', '#6b4a7a', '#c95f3f', '#2d2d2d'];
      let seed = 7;
      const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      for (let s = 0; s <= shelves; s++) {
        const y = s * (h - t) / shelves;
        g.add(box(w, t, d, c, 0, y, 0));
        if (s < shelves) {
          let x = -w / 2 + t + 0.02;
          while (x < w / 2 - 0.12) {
            const bw = 0.025 + rnd() * 0.035, bh = 0.18 + rnd() * 0.12;
            if (rnd() > 0.15) g.add(box(bw, bh, d * 0.75, mat(bookCols[Math.floor(rnd() * bookCols.length)]), x + bw / 2, y + t, 0.01));
            x += bw + 0.004;
          }
        }
      }
      break;
    }
    case 'covor': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.015, d), mat(it.color, { roughness: 1 }));
      m.position.y = 0.0075; m.receiveShadow = true;
      g.add(m);
      const border = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.016, d - 0.2), mat(shade(it.color, -0.12), { roughness: 1 }));
      border.position.y = 0.008; border.receiveShadow = true; g.add(border);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.017, d - 0.3), mat(it.color, { roughness: 1 }));
      inner.position.y = 0.0085; inner.receiveShadow = true; g.add(inner);
      break;
    }
    case 'lampa': {
      g.add(cyl(0.16, 0.18, 0.03, dark));
      g.add(cyl(0.012, 0.012, h - 0.35, metal, 0, 0.03, 0, 8));
      const shadeMat = new THREE.MeshStandardMaterial({ color: it.color, emissive: lightsOn ? '#ffd9a0' : '#000000', emissiveIntensity: lightsOn ? 1.2 : 0, roughness: 0.9, side: THREE.DoubleSide });
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.32, 24, 1, true), shadeMat);
      s.position.y = h - 0.16; g.add(s);
      if (lightsOn) {
        const L = new THREE.PointLight('#ffcf8a', 6, 7, 2);
        L.position.y = h - 0.2; L.castShadow = false; g.add(L);
      }
      break;
    }
    case 'lustra': {
      g.add(cyl(0.006, 0.006, h, metal, 0, 0, 0, 6));
      const shadeMat = new THREE.MeshStandardMaterial({ color: it.color, emissive: lightsOn ? '#ffe2b0' : '#000000', emissiveIntensity: lightsOn ? 1.5 : 0, roughness: 0.6, side: THREE.DoubleSide });
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.08, w / 2, 0.25, 32, 1, true), shadeMat);
      s.position.y = 0.12; g.add(s);
      if (lightsOn) { const L = new THREE.PointLight('#ffd8a0', 10, 9, 2); L.position.y = 0.05; g.add(L); }
      break;
    }
    case 'pat': {
      g.add(box(w, 0.3, d, wood, 0, 0.05, 0));
      legs(g, w, d, 0.05, 0.05, dark);
      g.add(rbox(w - 0.06, 0.22, d - 0.08, 0.05, mat('#f7f5f0'), 0, 0.33, 0.02));
      g.add(rbox(w - 0.02, 0.06, d * 0.62, 0.03, c, 0, 0.53, d * 0.18));
      g.add(box(w + 0.06, h, 0.08, wood, 0, 0, -d / 2 + 0.04));
      const pw = (w - 0.2) / 2;
      g.add(rbox(pw, 0.14, 0.4, 0.06, mat('#ffffff'), -pw / 2 - 0.04, 0.55, -d / 2 + 0.35));
      g.add(rbox(pw, 0.14, 0.4, 0.06, mat('#ffffff'), pw / 2 + 0.04, 0.55, -d / 2 + 0.35));
      break;
    }
    case 'noptiera': {
      g.add(box(w, h - 0.1, d, c, 0, 0.1, 0));
      legs(g, w, d, 0.1, 0.03, dark);
      g.add(box(w - 0.06, 0.12, 0.01, mat(shade(it.color, -0.1)), 0, h - 0.2, d / 2));
      g.add(cyl(0.06, 0.08, 0.04, dark, 0.08, h, -0.03));
      g.add(cyl(0.01, 0.01, 0.2, metal, 0.08, h + 0.04, -0.03, 6));
      g.add(cyl(0.07, 0.1, 0.12, mat('#f3e7cf', { emissive: lightsOn ? '#ffd9a0' : '#000', emissiveIntensity: lightsOn ? 1 : 0 }), 0.08, h + 0.22, -0.03));
      break;
    }
    case 'dulap': {
      g.add(box(w, h, d, c));
      const doors = Math.max(2, Math.round(w / 0.5));
      for (let i = 0; i < doors; i++) {
        const dw = w / doors;
        g.add(box(dw - 0.008, h - 0.02, 0.01, c, -w / 2 + dw * (i + 0.5), 0.01, d / 2 + 0.005));
        g.add(box(0.015, 0.3, 0.02, metal, -w / 2 + dw * (i + 0.5) + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), h / 2 - 0.15, d / 2 + 0.015));
      }
      break;
    }
    case 'birou': {
      g.add(box(w, 0.04, d, c, 0, h - 0.04, 0));
      legs(g, w, d, h - 0.04, 0.04, dark);
      g.add(box(0.55, 0.32, 0.02, dark, 0, h + 0.1, -d / 2 + 0.15));
      g.add(box(0.06, 0.12, 0.06, dark, 0, h, -d / 2 + 0.15));
      g.add(box(0.4, 0.015, 0.14, mat('#cfcfcf'), 0, h, 0.05));
      break;
    }
    case 'masa': {
      g.add(box(w, 0.045, d, c, 0, h - 0.045, 0));
      legs(g, w, d, h - 0.045, 0.06, c, 0.06);
      g.add(cyl(0.08, 0.06, 0.12, mat('#e9e3d6'), 0, h, 0));
      g.add(sphere(0.07, mat('#d9a441'), 0, h + 0.14, 0));
      break;
    }
    case 'scaun': {
      const seat = 0.46;
      g.add(rbox(w, 0.05, d, 0.015, c, 0, seat - 0.05, 0));
      legs(g, w, d, seat - 0.05, 0.03, mat(WOOD_LIGHT), 0.02);
      g.add(box(w, h - seat, 0.03, c, 0, seat, -d / 2 + 0.015));
      break;
    }
    case 'bucatarie': {
      g.add(box(w, 0.1, d - 0.05, dark, 0, 0, -0.025));
      g.add(box(w, h - 0.14, d - 0.02, c, 0, 0.1, -0.01));
      g.add(box(w + 0.02, 0.04, d + 0.02, mat('#3a3a3a', { roughness: 0.3 }), 0, h - 0.04, 0));
      const n = Math.max(2, Math.round(w / 0.6));
      for (let i = 0; i < n; i++) {
        const dw = w / n;
        g.add(box(dw - 0.006, h - 0.16, 0.01, c, -w / 2 + dw * (i + 0.5), 0.11, d / 2));
        g.add(box(dw * 0.5, 0.012, 0.02, metal, -w / 2 + dw * (i + 0.5), h - 0.14, d / 2 + 0.01));
      }
      // chiuvetă și plită
      g.add(box(0.5, 0.01, 0.4, metal, -w / 4, h, 0));
      g.add(cyl(0.012, 0.012, 0.25, metal, -w / 4, h, -0.18, 8));
      g.add(box(0.6, 0.008, 0.5, mat('#111', { roughness: 0.2 }), w / 4, h, 0));
      // corpuri suspendate
      g.add(box(w, 0.7, 0.35, c, 0, 1.45, -d / 2 + 0.175));
      break;
    }
    case 'frigider': {
      g.add(box(w, h, d, c, 0, 0, 0));
      g.add(box(w - 0.01, 0.005, 0.01, mat('#aaa'), 0, h * 0.62, d / 2 + 0.002));
      g.add(box(0.02, 0.35, 0.03, metal, w / 2 - 0.06, h * 0.68, d / 2 + 0.02));
      g.add(box(0.02, 0.35, 0.03, metal, w / 2 - 0.06, h * 0.22, d / 2 + 0.02));
      break;
    }
    case 'cada': {
      g.add(rbox(w, h, d, 0.06, c, 0, 0, 0));
      g.add(rbox(w - 0.12, 0.02, d - 0.12, 0.01, mat('#bfe3ef', { roughness: 0.1, metalness: 0.1 }), 0, h - 0.06, 0));
      g.add(cyl(0.015, 0.015, 0.15, metal, -w / 2 + 0.1, h, 0, 8));
      break;
    }
    case 'dus': {
      g.add(box(w, 0.06, d, c));
      const glass = new THREE.MeshPhysicalMaterial({ color: '#dff2f7', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0 });
      const g1 = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.06, 0.01), glass); g1.position.set(0, 0.06 + (h - 0.06) / 2, d / 2); g.add(g1);
      const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, h - 0.06, d), glass); g2.position.set(w / 2, 0.06 + (h - 0.06) / 2, 0); g.add(g2);
      g.add(cyl(0.1, 0.1, 0.02, metal, 0, h - 0.15, -d / 2 + 0.2));
      break;
    }
    case 'wc': {
      g.add(cyl(0.15, 0.13, 0.4, c, 0, 0, 0.08));
      g.add(cyl(0.19, 0.19, 0.04, c, 0, 0.4, 0.08));
      g.add(rbox(w, 0.4, 0.18, 0.03, c, 0, 0.4, -d / 2 + 0.09));
      break;
    }
    case 'lavoar': {
      g.add(box(w, 0.45, d, c, 0, 0.3, 0));
      g.add(rbox(w, 0.1, d, 0.02, white, 0, h - 0.1, 0));
      g.add(cyl(0.012, 0.012, 0.18, metal, 0, h, -d / 2 + 0.06, 8));
      g.add(box(w * 0.9, 0.7, 0.02, mat('#cfe3ea', { roughness: 0.05, metalness: 0.9 }), 0, h + 0.3, -d / 2 + 0.01));
      break;
    }
    case 'planta': {
      g.add(cyl(0.17, 0.13, 0.35, mat('#d8d2c4'), 0, 0, 0));
      g.add(cyl(0.015, 0.015, h * 0.4, mat('#5b4630'), 0, 0.35, 0, 6));
      const leaf = mat(it.color);
      let seed = 3;
      const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < 9; i++) {
        const a = rnd() * Math.PI * 2, r = 0.05 + rnd() * 0.15, y = 0.6 + rnd() * (h - 0.75);
        g.add(sphere(0.12 + rnd() * 0.08, leaf, Math.cos(a) * r, y, Math.sin(a) * r));
      }
      break;
    }
    case 'tablou': {
      g.add(box(w, h, d, mat('#1f1f1f')));
      // compoziție abstractă (originală)
      g.add(box(w - 0.08, h - 0.08, 0.005, mat('#efe9dd'), 0, 0.04, d / 2));
      g.add(box((w - 0.08) * 0.45, (h - 0.08) * 0.6, 0.006, c, -w * 0.15, 0.12, d / 2 + 0.001));
      g.add(box((w - 0.08) * 0.3, (h - 0.08) * 0.35, 0.007, mat('#d9a441'), w * 0.2, h * 0.45, d / 2 + 0.002));
      break;
    }
    case 'copac': {
      g.add(cyl(0.12, 0.18, h * 0.45, mat('#5b4630'), 0, 0, 0, 10));
      const leaf = mat(it.color, { roughness: 0.9 });
      let seed = 11;
      const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < 7; i++) {
        const a = rnd() * Math.PI * 2, r = rnd() * w * 0.22;
        g.add(sphere(w * (0.22 + rnd() * 0.12), leaf, Math.cos(a) * r, h * (0.55 + rnd() * 0.3), Math.sin(a) * r));
      }
      break;
    }
    case 'tufis': {
      const leaf = mat(it.color, { roughness: 0.9 });
      g.add(sphere(w * 0.4, leaf, 0, h * 0.45, 0));
      g.add(sphere(w * 0.3, leaf, w * 0.22, h * 0.35, 0.05));
      g.add(sphere(w * 0.3, leaf, -w * 0.2, h * 0.33, -0.05));
      break;
    }
    case 'masina': {
      const paint = mat(it.color, { roughness: 0.25, metalness: 0.5 });
      const glass = mat('#1d2630', { roughness: 0.1, metalness: 0.5 });
      g.add(rbox(w, h * 0.45, d, 0.08, paint, 0, 0.18, 0));
      g.add(rbox(w * 0.86, h * 0.36, d * 0.5, 0.1, glass, 0, 0.18 + h * 0.42, -d * 0.03));
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 20), dark);
        wh.rotation.z = Math.PI / 2; wh.position.set(x * (w / 2 - 0.08), 0.33, z * d * 0.32); wh.castShadow = true; g.add(wh);
      }
      break;
    }
    case 'piscina': {
      g.add(box(w + 0.4, 0.06, d + 0.4, mat('#d9d4c7'), 0, 0, 0));
      const water = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), mat(it.color, { roughness: 0.05, metalness: 0.2 }));
      water.position.y = 0.065; water.receiveShadow = true; g.add(water);
      break;
    }
    default:
      g.add(box(w, h, d, c));
  }
  return g;
}

export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

// ---------- Texturi procedurale pentru podele ----------
function canvasTex(size, draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

function planks(base, var_, seed) {
  return canvasTex(1024, (g, s) => {
    const r = rng(seed);
    const rows = 8, ph = s / rows;
    for (let i = 0; i < rows; i++) {
      let x = -r() * s * 0.5;
      while (x < s) {
        const len = s * (0.35 + r() * 0.4);
        const c = new THREE.Color(base); const hsl = {}; c.getHSL(hsl);
        c.setHSL(hsl.h, hsl.s, hsl.l + (r() - 0.5) * var_);
        g.fillStyle = '#' + c.getHexString(); g.fillRect(x, i * ph, len, ph);
        g.globalAlpha = 0.08;
        for (let k = 0; k < 14; k++) { g.fillStyle = r() > 0.5 ? '#000' : '#fff'; g.fillRect(x, i * ph + r() * ph, len, 1 + r() * 2); }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, i * ph, 2, ph);
        x += len;
      }
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, i * ph, s, 2);
    }
  });
}
function tiles(base, grout, n, seed, marble = false) {
  return canvasTex(1024, (g, s) => {
    const r = rng(seed), ts = s / n;
    g.fillStyle = grout; g.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const c = new THREE.Color(base); const hsl = {}; c.getHSL(hsl);
      c.setHSL(hsl.h, hsl.s, hsl.l + (r() - 0.5) * 0.04);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(i * ts + 2, j * ts + 2, ts - 4, ts - 4);
      if (marble) {
        g.strokeStyle = 'rgba(120,120,130,0.25)'; g.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
          g.beginPath(); let x = i * ts + r() * ts, y = j * ts; g.moveTo(x, y);
          for (let t = 0; t < 6; t++) { x += (r() - 0.5) * ts * 0.4; y += ts / 6; g.lineTo(x, y); }
          g.stroke();
        }
      }
    }
  });
}
function concrete(seed) {
  return canvasTex(512, (g, s) => {
    const r = rng(seed);
    g.fillStyle = '#9c9a96'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 4000; k++) { g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.07})`; g.fillRect(r() * s, r() * s, 2 + r() * 6, 2 + r() * 6); }
  });
}
function grass(seed) {
  return canvasTex(512, (g, s) => {
    const r = rng(seed);
    g.fillStyle = '#6f8f4e'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 9000; k++) { g.fillStyle = `hsla(${85 + r() * 25},${35 + r() * 20}%,${30 + r() * 20}%,0.6)`; g.fillRect(r() * s, r() * s, 1.5, 3 + r() * 4); }
  });
}

// Materialele de podea: id → {nume, textură, dimensiunea texturii în metri}
export const FLOORS = {
  stejar: { name: 'Parchet stejar', size: 2.4, make: () => planks('#c39a6b', 0.12, 11) },
  nuc: { name: 'Parchet nuc', size: 2.4, make: () => planks('#6e4a32', 0.1, 23) },
  frasin: { name: 'Parchet frasin deschis', size: 2.4, make: () => planks('#e2cfae', 0.08, 37) },
  gresie: { name: 'Gresie albă 60×60', size: 3.6, make: () => tiles('#ecebe7', '#c9c6bf', 6, 5) },
  marmura: { name: 'Marmură', size: 3.0, make: () => tiles('#f1efec', '#d8d4cc', 4, 9, true) },
  ardezie: { name: 'Gresie gri închis', size: 3.6, make: () => tiles('#55585c', '#3a3c3f', 6, 13) },
  beton: { name: 'Beton șlefuit', size: 4, make: () => concrete(4) },
};
const texCache = {};
export function floorTexture(id) {
  if (!texCache[id]) texCache[id] = (FLOORS[id] || FLOORS.stejar).make();
  return texCache[id];
}
let grassTex;
export function grassTexture() { return grassTex || (grassTex = grass(7)); }

export const WALL_COLORS = [
  ['#f4f1ea', 'Alb cald'], ['#ffffff', 'Alb pur'], ['#e6ddd0', 'Bej'], ['#d7dfd6', 'Salvie'],
  ['#d5dde6', 'Albastru pal'], ['#c9c3bb', 'Gri piatră'], ['#a88f7a', 'Lut'], ['#3f4a55', 'Bleumarin'],
];
