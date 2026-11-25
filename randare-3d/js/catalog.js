// Catalogul de obiecte 3D: toate modelele sunt construite din forme simple (cutii, cilindri, sfere),
// fără fișiere externe. Fiecare model are originea în centrul bazei și dimensiunile date în metri.
import * as THREE from 'three';
import { deciduous, conifer, birch, thuja, ornamentalGrass, boulder, lavender, shrub, climber, palm } from './nature.js';

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
  { type: 'pat', name: 'Pat dublu', cat: 'Dormitor', icon: '🛏️', w: 1.7, d: 2.1, h: 1.0, color: '#e9e4da', c2: WOOD, c1n: 'Lenjerie', c2n: 'Cadru' },
  { type: 'noptiera', name: 'Noptieră', cat: 'Dormitor', icon: '▫️', w: 0.5, d: 0.4, h: 0.5, color: WOOD },
  { type: 'dulap', name: 'Dulap', cat: 'Dormitor', icon: '🚪', w: 1.6, d: 0.6, h: 2.2, color: '#ece7df' },
  { type: 'birou', name: 'Birou', cat: 'Dormitor', icon: '🖥️', w: 1.4, d: 0.7, h: 0.75, color: WOOD_LIGHT, c2: DARK, c1n: 'Blat', c2n: 'Picioare' },
  { type: 'masa', name: 'Masă de dining', cat: 'Bucătărie', icon: '🍽️', w: 1.8, d: 0.9, h: 0.76, color: WOOD, c2: WOOD, c1n: 'Blat', c2n: 'Picioare' },
  { type: 'scaun_birou', name: 'Scaun de birou', cat: 'Birou', icon: '💺', w: 0.62, d: 0.62, h: 1.15, color: '#2b2d31' },
  { type: 'mobila_birou', name: 'Bibliotecă de birou cu dulapuri', cat: 'Birou', icon: '🗄️', w: 2.4, d: 0.4, h: 2.3, color: '#e9e5dd', c2: '#8a5a35', c1n: 'Fronturi', c2n: 'Rafturi' },
  { type: 'birou_mare', name: 'Birou de lucru (cu sertare)', cat: 'Birou', icon: '🖥️', w: 1.8, d: 0.8, h: 0.75, color: '#8a5a35', c2: '#2b2d31', c1n: 'Blat', c2n: 'Picioare' },
  { type: 'scaun', name: 'Scaun', cat: 'Bucătărie', icon: '🪑', w: 0.45, d: 0.5, h: 0.9, color: DARK, c2: WOOD_LIGHT, c1n: 'Șezut', c2n: 'Picioare' },
  { type: 'bucatarie', name: 'Corp bucătărie', cat: 'Bucătărie', icon: '🧑‍🍳', w: 2.4, d: 0.62, h: 0.9, color: '#e8e4dc', c2: '#3a3a3a', c1n: 'Fronturi', c2n: 'Blat', kitchen: true },
  { type: 'insula', name: 'Insulă bucătărie', cat: 'Bucătărie', icon: '🏝️', w: 1.8, d: 0.95, h: 0.92, color: '#e8e4dc', c2: '#ece9e3', c1n: 'Fronturi', c2n: 'Blat', kitchen: true },
  { type: 'suspendat', name: 'Corp suspendat', cat: 'Bucătărie', icon: '🗄️', w: 1.2, d: 0.35, h: 0.72, color: '#e8e4dc', elev: 1.45, c1n: 'Fronturi', kitchen: true },
  { type: 'coloana', name: 'Coloană cuptor', cat: 'Bucătărie', icon: '♨️', w: 0.6, d: 0.62, h: 2.2, color: '#e8e4dc', c1n: 'Fronturi', kitchen: true },
  { type: 'hota', name: 'Hotă', cat: 'Bucătărie', icon: '🌫️', w: 0.9, d: 0.5, h: 0.9, color: '#b8bcc0', elev: 1.55 },
  { type: 'frigider', name: 'Frigider', cat: 'Bucătărie', icon: '🧊', w: 0.7, d: 0.68, h: 1.9, color: '#d8dcdf' },
  { type: 'cada', name: 'Cadă', cat: 'Baie', icon: '🛁', w: 1.7, d: 0.75, h: 0.58, color: WHITE },
  { type: 'dus', name: 'Cabină de duș', cat: 'Baie', icon: '🚿', w: 0.9, d: 0.9, h: 2.0, color: WHITE },
  { type: 'wc', name: 'Toaletă', cat: 'Baie', icon: '🚽', w: 0.4, d: 0.65, h: 0.8, color: WHITE },
  { type: 'lavoar', name: 'Lavoar cu mobilier', cat: 'Baie', icon: '🚰', w: 0.8, d: 0.48, h: 0.85, color: WOOD_LIGHT, c2: WHITE, c1n: 'Mobilier', c2n: 'Blat' },
  { type: 'planta', name: 'Plantă', cat: 'Decor', icon: '🪴', w: 0.5, d: 0.5, h: 1.3, color: '#4f7d46' },
  { type: 'perdea', name: 'Draperie (perdea)', cat: 'Decor', icon: '🪟', w: 2.4, d: 0.12, h: 2.6, color: '#e9e2d4' },
  { type: 'planta_mare', name: 'Plantă mare (ficus)', cat: 'Decor', icon: '🌱', w: 0.8, d: 0.8, h: 1.9, color: '#3f6b35', c2: '#d8d2c6', c1n: 'Frunze', c2n: 'Ghiveci' },
  { type: 'vaza', name: 'Vază cu flori', cat: 'Decor', icon: '💐', w: 0.25, d: 0.25, h: 0.55, color: '#f0ece4', c2: '#e86a8a', c1n: 'Vază', c2n: 'Flori', elev: 0.75 },
  { type: 'carti', name: 'Cărți și obiecte decorative', cat: 'Decor', icon: '📚', w: 0.45, d: 0.25, h: 0.3, color: '#3c6e91', elev: 0.45 },
  { type: 'oglinda', name: 'Oglindă rotundă', cat: 'Decor', icon: '🪞', w: 0.9, d: 0.04, h: 0.9, color: '#c9a86a', elev: 1.1 },
  { type: 'tablou', name: 'Tablou', cat: 'Decor', icon: '🖼️', w: 1.0, d: 0.04, h: 0.7, color: '#3c6e91', elev: 1.3 },
  { type: 'scara', name: 'Scară interioară', cat: 'Construcție', icon: '🪜', w: 1.0, d: 3.2, h: 2.8, color: WOOD_LIGHT, c2: '#3a3a3a', c1n: 'Trepte', c2n: 'Balustradă' },
  { type: 'semineu', name: 'Șemineu', cat: 'Construcție', icon: '🔥', w: 1.4, d: 0.5, h: 1.1, color: '#e8e4dc' },
  { type: 'calorifer', name: 'Calorifer', cat: 'Construcție', icon: '♒', w: 1.0, d: 0.1, h: 0.6, color: '#f4f4f2', elev: 0.15 },
  { type: 'scara_l', name: 'Scară în L', cat: 'Scări', icon: '↱', w: 2.0, d: 2.2, h: 2.95, color: WOOD_LIGHT, c2: '#3a3a3a', c1n: 'Trepte', c2n: 'Balustradă', stair: true },
  { type: 'scara_u', name: 'Scară în U', cat: 'Scări', icon: '⮌', w: 2.2, d: 2.6, h: 2.95, color: WOOD_LIGHT, c2: '#3a3a3a', c1n: 'Trepte', c2n: 'Balustradă', stair: true },
  { type: 'scara_spirala', name: 'Scară în spirală (rotundă)', cat: 'Scări', icon: '🌀', w: 1.8, d: 1.8, h: 2.95, color: WOOD_LIGHT, c2: '#3a3a3a', c1n: 'Trepte', c2n: 'Stâlp și balustradă', stair: true },
  { type: 'scara_plutitoare', name: 'Scară cu trepte în consolă', cat: 'Scări', icon: '▤', w: 0.9, d: 3.3, h: 2.95, color: WOOD, c2: '#d8d4cc', c1n: 'Trepte', c2n: 'Perete de sprijin', stair: true },
  { type: 'scara_pod', name: 'Scară de pod (ascunsă în tavan)', cat: 'Scări', icon: '⇡', w: 0.7, d: 1.2, h: 2.7, color: WOOD_LIGHT, c2: '#f2f0ec', c1n: 'Trepte', c2n: 'Trapă', stair: true },
  { type: 'copac', name: 'Copac', cat: 'Grădină', icon: '🌳', w: 3, d: 3, h: 5.5, color: '#3f6b35' },
  { type: 'brad', name: 'Brad (conifer)', cat: 'Grădină', icon: '🌲', w: 2.2, d: 2.2, h: 6, color: '#2f5734' },
  { type: 'pom', name: 'Pom fructifer', cat: 'Grădină', icon: '🍎', w: 2.6, d: 2.6, h: 3.4, color: '#4f7f3a', c2: '#c8352a', c1n: 'Frunze', c2n: 'Fructe' },
  { type: 'mesteacan', name: 'Mesteacăn', cat: 'Grădină', icon: '🌳', w: 2.4, d: 2.4, h: 7, color: '#6f9a45' },
  { type: 'tuia', name: 'Tuia (coloană)', cat: 'Grădină', icon: '🌲', w: 0.9, d: 0.9, h: 2.6, color: '#2f5a33' },
  { type: 'iarba_decorativa', name: 'Iarbă decorativă', cat: 'Grădină', icon: '🌾', w: 0.9, d: 0.9, h: 0.9, color: '#9aa86a', c2: '#e3d3a8', c1n: 'Frunze', c2n: 'Spice' },
  { type: 'lavanda', name: 'Lavandă (strat)', cat: 'Grădină', icon: '💜', w: 1.6, d: 0.6, h: 0.5, color: '#8a6fc4', garden: true },
  { type: 'bolovan', name: 'Bolovan decorativ', cat: 'Grădină', icon: '🪨', w: 1.4, d: 1.0, h: 0.7, color: '#77736c' },
  { type: 'tufis', name: 'Tufiș', cat: 'Grădină', icon: '🌿', w: 1.0, d: 1.0, h: 0.8, color: '#4d7c3a' },
  { type: 'flori', name: 'Strat de flori', cat: 'Grădină', icon: '🌷', w: 1.6, d: 0.8, h: 0.35, color: '#e0457b', c2: '#f4c430', c1n: 'Flori', c2n: 'Flori 2' },
  { type: 'ghiveci', name: 'Ghiveci cu flori', cat: 'Grădină', icon: '🪴', w: 0.5, d: 0.5, h: 0.75, color: '#b5643c', c2: '#d9457a', c1n: 'Ghiveci', c2n: 'Flori' },
  { type: 'gard_viu', name: 'Gard viu', cat: 'Grădină', icon: '🟩', w: 4, d: 0.6, h: 1.3, color: '#3e6a33' },
  { type: 'gard', name: 'Gard din lemn', cat: 'Grădină', icon: '🚧', w: 4, d: 0.08, h: 1.4, color: '#9b6a42' },
  { type: 'banca', name: 'Bancă de grădină', cat: 'Grădină', icon: '🪑', w: 1.5, d: 0.6, h: 0.85, color: WOOD, c2: DARK, c1n: 'Lemn', c2n: 'Picioare' },
  { type: 'pergola', name: 'Pergolă', cat: 'Grădină', icon: '⛩️', w: 3.5, d: 3.0, h: 2.6, color: WOOD, c2: '#5f8a45', c1n: 'Lemn', c2n: 'Iederă' },
  { type: 'felinar', name: 'Stâlp de iluminat', cat: 'Grădină', icon: '🏮', w: 0.3, d: 0.3, h: 2.4, color: '#2f3135', garden: true },
  { type: 'bolard', name: 'Bolard luminos (alee)', cat: 'Grădină', icon: '🕯️', w: 0.16, d: 0.16, h: 0.7, color: '#2f3135', garden: true },
  { type: 'spot', name: 'Spot de grădină', cat: 'Grădină', icon: '🔦', w: 0.14, d: 0.14, h: 0.12, color: '#2f3135', garden: true },
  { type: 'scara_imperiala', name: 'Scară dublă de vilă (imperială)', cat: 'Scări', icon: '🏛️', w: 5.0, d: 4.6, h: 3.25, color: '#efece6', c2: '#2b2b2e', c1n: 'Trepte', c2n: 'Balustradă', stair: true },
  { type: 'scara_rulanta', name: 'Scară rulantă', cat: 'Scări', icon: '↗️', w: 1.3, d: 6.2, h: 3.25, color: '#b8bcc0', c2: '#cfe6f3', c1n: 'Carcasă', c2n: 'Sticlă', stair: true },
  { type: 'lift', name: 'Lift (ascensor)', cat: 'Scări', icon: '🛗', w: 1.7, d: 1.7, h: 3.25, color: '#9aa0a6', c2: '#cfe6f3', c1n: 'Cadru', c2n: 'Sticlă', stair: true },
  { type: 'balustrada', name: 'Balustradă din sticlă', cat: 'Construcție', icon: '▭', w: 3.0, d: 0.08, h: 1.0, color: '#9aa0a6', c2: '#cfe6f3', c1n: 'Mână curentă', c2n: 'Sticlă' },
  { type: 'balcon', name: 'Balcon în consolă', cat: 'Construcție', icon: '🏢', w: 3.0, d: 1.4, h: 1.15, color: '#d8d4cc', c2: '#cfe6f3', c1n: 'Placă', c2n: 'Sticlă' },
  { type: 'coloana_decor', name: 'Coloană', cat: 'Construcție', icon: '🏛️', w: 0.45, d: 0.45, h: 2.7, color: '#f1eee8' },
  { type: 'poarta', name: 'Poartă pietonală', cat: 'Porți și garduri', icon: '🚪', w: 1.1, d: 0.12, h: 1.7, color: '#2f3135', c2: '#b9a48a', c1n: 'Metal', c2n: 'Stâlpi' },
  { type: 'poarta_auto', name: 'Poartă auto culisantă', cat: 'Porți și garduri', icon: '🚘', w: 4.2, d: 0.12, h: 1.7, color: '#2f3135', c2: '#b9a48a', c1n: 'Metal', c2n: 'Stâlpi' },
  { type: 'gard_metalic', name: 'Gard metalic', cat: 'Porți și garduri', icon: '⛓️', w: 3.0, d: 0.1, h: 1.6, color: '#2f3135', c2: '#b9a48a', c1n: 'Metal', c2n: 'Soclu și stâlpi' },
  { type: 'gard_zidarie', name: 'Gard din zidărie', cat: 'Porți și garduri', icon: '🧱', w: 3.0, d: 0.3, h: 1.9, color: '#e9e3d8', c2: '#3a3d42', c1n: 'Zidărie', c2n: 'Șipci' },
  { type: 'stalp_lampa', name: 'Stâlp de gard cu lampă', cat: 'Porți și garduri', icon: '🏮', w: 0.45, d: 0.45, h: 2.0, color: '#b9a48a', garden: true },
  { type: 'aplica', name: 'Aplică de perete', cat: 'Lumini', icon: '🔅', w: 0.14, d: 0.14, h: 0.3, color: '#2f3135', elev: 2.0 },
  { type: 'spot_tavan', name: 'Spot încastrat în tavan', cat: 'Lumini', icon: '⚪', w: 0.1, d: 0.1, h: 0.02, color: '#f4f4f2', elev: 2.68 },
  { type: 'candelabru', name: 'Candelabru mare', cat: 'Lumini', icon: '💎', w: 1.2, d: 1.2, h: 1.3, color: '#d9c38a', elev: 1.4 },
  { type: 'fantana', name: 'Fântână arteziană', cat: 'Grădină', icon: '⛲', w: 2.2, d: 2.2, h: 1.4, color: '#d8d2c4', c2: '#4fa3c9', c1n: 'Piatră', c2n: 'Apă' },
  { type: 'copertina', name: 'Copertină peste ușă', cat: 'Fațadă', icon: '🛖', w: 2.2, d: 1.2, h: 0.12, color: '#2f3135', c2: '#cfe6f3', c1n: 'Metal', c2n: 'Sticlă', elev: 2.45 },
  { type: 'lamele', name: 'Lamele verticale din lemn', cat: 'Fațadă', icon: '🪵', w: 2.0, d: 0.08, h: 2.6, color: '#a06a3c' },
  { type: 'jardiniera', name: 'Jardinieră cu plante', cat: 'Fațadă', icon: '🪴', w: 1.4, d: 0.45, h: 0.55, color: '#3a3d42', c2: '#5e8c45', c1n: 'Cutie', c2n: 'Plante' },
  { type: 'trepte', name: 'Trepte de intrare', cat: 'Fațadă', icon: '🪜', w: 2.4, d: 1.2, h: 0.45, color: '#d6d0c4' },
  { type: 'numar_casa', name: 'Număr de casă luminos', cat: 'Fațadă', icon: '🔢', w: 0.4, d: 0.03, h: 0.22, color: '#1f2124', elev: 1.7 },
  { type: 'alee_dale', name: 'Alee din dale prin iarbă', cat: 'Grădină', icon: '▦', w: 1.0, d: 6.0, h: 0.04, color: '#d8d2c6' },
  { type: 'foc_gradina', name: 'Vatră de foc', cat: 'Grădină', icon: '🔥', w: 1.0, d: 1.0, h: 0.4, color: '#4a4744' },
  { type: 'lounge', name: 'Canapea de exterior în L', cat: 'Grădină', icon: '🛋️', w: 3.0, d: 2.2, h: 0.75, color: '#e4ddd0', c2: '#6b7b5a', c1n: 'Perne', c2n: 'Perne decorative' },
  { type: 'spot_sol', name: 'Spot încastrat în sol', cat: 'Grădină', icon: '💡', w: 0.12, d: 0.12, h: 0.05, color: '#2b2b2b' },
  { type: 'perete_cascada', name: 'Perete cu cascadă', cat: 'Grădină', icon: '💧', w: 2.0, d: 0.7, h: 2.4, color: '#6f6a62', c2: '#eeebe4', c1n: 'Piatră', c2n: 'Tencuială' },
  { type: 'pergola_led', name: 'Pergolă modernă cu LED', cat: 'Grădină', icon: '🏗️', w: 4.0, d: 3.5, h: 2.7, color: '#2b2d30' },
  { type: 'gard_lamele', name: 'Gard din lamele cu aplice și iederă', cat: 'Porți și garduri', icon: '🪵', w: 3.0, d: 0.12, h: 2.3, color: '#9a5f36', c2: '#41703a', c1n: 'Lemn', c2n: 'Iederă' },
  { type: 'perete_led', name: 'Zid de grădină cu LED', cat: 'Porți și garduri', icon: '🧱', w: 4.0, d: 0.25, h: 2.3, color: '#ebe7df' },
  { type: 'perete_nise', name: 'Zid cu nișe rotunde luminate', cat: 'Porți și garduri', icon: '⭕', w: 4.0, d: 0.35, h: 2.4, color: '#4a4846', c2: '#4f7d3a', c1n: 'Piatră', c2n: 'Plante' },
  { type: 'iaz', name: 'Iaz cu nuferi', cat: 'Grădină', icon: '🪷', w: 3.0, d: 2.0, h: 0.05, color: '#1f3a3a' },
  { type: 'balansoar', name: 'Balansoar ou', cat: 'Grădină', icon: '🥚', w: 1.1, d: 1.1, h: 1.95, color: '#5a4430', c2: '#ece6da', c1n: 'Împletitură', c2n: 'Pernă' },
  { type: 'lampion', name: 'Felinar din ratan', cat: 'Grădină', icon: '🏮', w: 0.35, d: 0.35, h: 0.55, color: '#b98a55' },
  { type: 'lampion_agatat', name: 'Felinar suspendat', cat: 'Grădină', icon: '🏮', w: 0.32, d: 0.32, h: 0.42, color: '#b98a55', elev: 2.1 },
  { type: 'pietre_rotunde', name: 'Pietre rotunde de călcat', cat: 'Grădină', icon: '⚪', w: 0.8, d: 5.0, h: 0.04, color: '#d9d3c6' },
  { type: 'bordura_pietris', name: 'Bordură din pietriș alb', cat: 'Grădină', icon: '◽', w: 0.7, d: 4.0, h: 0.06, color: '#ecebe6' },
  { type: 'banda_led', name: 'Bandă LED pe marginea aleii', cat: 'Lumini', icon: '➖', w: 0.04, d: 3.0, h: 0.03, color: '#2b2b2b' },
  { type: 'sezlong', name: 'Șezlong', cat: 'Grădină', icon: '🏖️', w: 0.75, d: 2.0, h: 0.75, color: '#5a4430', c2: '#efebe3', c1n: 'Ramă', c2n: 'Saltea' },
  { type: 'palmier', name: 'Palmier', cat: 'Grădină', icon: '🌴', w: 3.0, d: 3.0, h: 4.5, color: '#5b8a3a' },
  { type: 'ghiveci_mare', name: 'Ghiveci mare cu arbust', cat: 'Fațadă', icon: '🪴', w: 0.6, d: 0.6, h: 1.6, color: '#d9d3c7', c2: '#3f6a35', c1n: 'Ghiveci', c2n: 'Frunze' },
  { type: 'masina', name: 'Mașină', cat: 'Exterior', icon: '🚗', w: 1.8, d: 4.3, h: 1.45, color: '#a33b32' },
  { type: 'piscina', name: 'Piscină', cat: 'Exterior', icon: '🏊', w: 3.5, d: 7, h: 0.05, color: '#4fb3d9' },
];
export const BY_TYPE = Object.fromEntries(CATALOG.map(c => [c.type, c]));

// Construiește modelul pentru un obiect din plan. it = {type, w, d, h, color}
export function buildItem(it, lightsOn) {
  const g = new THREE.Group();
  // sămânță din id: fiecare copac are altă formă, dar aceeași la fiecare redesenare
  let seed = 7; for (const ch of String(it.id || it.type)) seed = (seed * 31 + ch.charCodeAt(0)) % 100003;
  const { w, d, h } = it;
  const c = mat(it.color);
  const def = BY_TYPE[it.type] || {};
  const c2 = mat(it.color2 || def.c2 || '#3a3a3a', { roughness: 0.35 });
  const wood = mat(WOOD), dark = mat(DARK), metal = mat(METAL, { metalness: 0.6, roughness: 0.35 }), white = mat(WHITE, { roughness: 0.3 });
  // bandă LED caldă (sub dulapuri, la plintă, sub trepte): aprinsă puțin ziua, tare seara
  const ledMat = () => new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf8a', emissiveIntensity: lightsOn ? 2.4 : 0.9 });
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
      g.add(box(w, 0.3, d, c2, 0, 0.05, 0));
      legs(g, w, d, 0.05, 0.05, dark);
      g.add(rbox(w - 0.06, 0.22, d - 0.08, 0.05, mat('#f7f5f0'), 0, 0.33, 0.02));
      g.add(rbox(w - 0.02, 0.06, d * 0.62, 0.03, c, 0, 0.53, d * 0.18));
      g.add(box(w + 0.06, h, 0.08, c2, 0, 0, -d / 2 + 0.04));
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
    case 'scaun_birou': {
      // scaun ergonomic: bază în stea cu roți, piston, șezut și spătar cu plasă
      for (let i = 0; i < 5; i++) { const q = i / 5 * Math.PI * 2, arm = box(0.03, 0.03, 0.3, metal, Math.sin(q) * 0.15, 0.05, Math.cos(q) * 0.15); arm.rotation.y = q; g.add(arm); g.add(sphere(0.03, dark, Math.sin(q) * 0.29, 0.03, Math.cos(q) * 0.29)); }
      g.add(cyl(0.025, 0.025, 0.38, metal, 0, 0.06, 0, 10)); g.add(rbox(0.5, 0.08, 0.48, 0.03, c, 0, 0.46, 0));
      g.add(rbox(0.46, 0.55, 0.05, 0.02, mat(it.color, { roughness: 0.9 }), 0, 0.6, -0.24)); g.add(box(0.06, 0.18, 0.04, metal, 0, 0.44, -0.24));
      for (const x of [-0.26, 0.26]) { g.add(box(0.04, 0.2, 0.04, dark, x, 0.5, -0.02)); g.add(box(0.06, 0.03, 0.26, dark, x, 0.7, 0)); }
      break;
    }
    case 'mobila_birou': {
      // corp de bibliotecă: dulapuri jos, rafturi deschise sus, cărți și obiecte
      const fr = mat(it.color, { roughness: 0.5 }), sh = mat(it.color2 || def.c2, { roughness: 0.6 });
      g.add(box(w, 0.8, d, fr, 0, 0, 0)); for (let i = 1; i < Math.round(w / 0.6); i++) g.add(box(0.006, 0.76, 0.005, dark, -w / 2 + i * w / Math.round(w / 0.6), 0.02, d / 2));
      g.add(box(w, h - 0.8, 0.03, sh, 0, 0.8, -d / 2 + 0.015)); for (const x of [-w / 2 + 0.015, w / 2 - 0.015]) g.add(box(0.03, h - 0.8, d * 0.8, sh, x, 0.8, -d * 0.1));
      const r = rng(seed), cols = ['#7a2e2e', '#2e4a6b', '#c9a24f', '#3f5a3a', '#e0dbd0', '#5a3a6b'];
      for (const y of [0.8, 1.3, 1.8, h - 0.03]) g.add(box(w, 0.03, d * 0.8, sh, 0, y, -d * 0.1));
      for (const y of [0.83, 1.33, 1.83]) { let x = -w / 2 + 0.06; while (x < w / 2 - 0.15) { if (r() < 0.18) { x += 0.2; continue; } const bw = 0.025 + r() * 0.03, bh = 0.25 + r() * 0.15; g.add(box(bw, bh, d * 0.55, mat(cols[Math.floor(r() * cols.length)], { roughness: 0.7 }), x, y, -d * 0.12)); x += bw + 0.004; } }
      break;
    }
    case 'birou_mare': {
      g.add(box(w, 0.05, d, c, 0, h - 0.05, 0)); g.add(box(0.45, h - 0.05, d - 0.04, mat('#ece8e0', { roughness: 0.5 }), w / 2 - 0.25, 0, 0));
      for (let i = 0; i < 3; i++) g.add(box(0.3, 0.006, 0.01, dark, w / 2 - 0.25, 0.15 + i * 0.22, d / 2 - 0.015));
      g.add(box(0.05, h - 0.05, d - 0.1, mat(it.color2 || def.c2), -w / 2 + 0.05, 0, 0));
      g.add(box(0.6, 0.36, 0.02, dark, -0.1, h + 0.12, -d / 2 + 0.15)); g.add(box(0.05, 0.12, 0.05, dark, -0.1, h, -d / 2 + 0.15)); g.add(box(0.42, 0.015, 0.14, mat('#cfcfcf'), -0.1, h, 0.08));
      g.add(cyl(0.01, 0.01, 0.4, metal, -w / 2 + 0.2, h, -d / 2 + 0.15, 8)); g.add(cyl(0.08, 0.05, 0.1, mat('#e9e5dd'), -w / 2 + 0.2, h + 0.38, -d / 2 + 0.15, 14));
      break;
    }
    case 'birou': {
      g.add(box(w, 0.04, d, c, 0, h - 0.04, 0));
      legs(g, w, d, h - 0.04, 0.04, c2);
      g.add(box(0.55, 0.32, 0.02, dark, 0, h + 0.1, -d / 2 + 0.15));
      g.add(box(0.06, 0.12, 0.06, dark, 0, h, -d / 2 + 0.15));
      g.add(box(0.4, 0.015, 0.14, mat('#cfcfcf'), 0, h, 0.05));
      break;
    }
    case 'masa': {
      g.add(box(w, 0.045, d, c, 0, h - 0.045, 0));
      legs(g, w, d, h - 0.045, 0.06, c2, 0.06);
      g.add(cyl(0.08, 0.06, 0.12, mat('#e9e3d6'), 0, h, 0));
      g.add(sphere(0.07, mat('#d9a441'), 0, h + 0.14, 0));
      break;
    }
    case 'scaun': {
      const seat = 0.46;
      g.add(rbox(w, 0.05, d, 0.015, c, 0, seat - 0.05, 0));
      legs(g, w, d, seat - 0.05, 0.03, c2, 0.02);
      g.add(box(w, h - seat, 0.03, c, 0, seat, -d / 2 + 0.015));
      break;
    }
    case 'bucatarie': {
      g.add(box(w, 0.1, d - 0.05, dark, 0, 0, -0.025));
      g.add(box(w, h - 0.14, d - 0.02, c, 0, 0.1, -0.01));
      g.add(box(w + 0.02, 0.04, d + 0.02, c2, 0, h - 0.04, 0));
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
      // corpuri suspendate, cu LED dedesubt și la plintă
      g.add(box(w, 0.7, 0.35, c, 0, 1.45, -d / 2 + 0.175));
      g.add(box(w - 0.06, 0.012, 0.025, ledMat(), 0, 1.437, -d / 2 + 0.31));
      g.add(box(w - 0.04, 0.012, 0.02, ledMat(), 0, 0.03, d / 2 - 0.07));
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
      g.add(rbox(w, 0.1, d, 0.02, c2, 0, h - 0.1, 0));
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
    case 'perdea': {
      // draperie în falduri: o suprafață ondulată de la șină până aproape de podea
      const geo = new THREE.PlaneGeometry(w, h - 0.05, Math.max(12, Math.round(w * 14)), 1), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.035);
      geo.computeVertexNormals();
      const cm = new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.88 });
      const cur = new THREE.Mesh(geo, cm); cur.position.set(0, (h - 0.05) / 2, 0); cur.castShadow = true; g.add(cur);
      g.add(box(w + 0.1, 0.025, 0.025, mat('#2b2b2e', { metalness: 0.6 }), 0, h - 0.03, -0.02));
      break;
    }
    case 'planta_mare': {
      g.add(cyl(w * 0.28, w * 0.22, 0.42, mat(it.color2 || '#d8d2c6', { roughness: 0.6 }), 0, 0, 0, 20));
      g.add(cyl(0.02, 0.03, h * 0.75, mat('#6b5236'), 0, 0.4, 0, 6));
      const leaf = new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.6, side: THREE.DoubleSide });
      let s2 = seed; const r = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 34; i++) {
        const y = 0.75 + r() * (h - 0.9), a = r() * 6.28, d2 = 0.05 + r() * w * 0.35;
        const lf = new THREE.Mesh(new THREE.CircleGeometry(0.11, 8), leaf); lf.scale.set(0.75, 1.25, 1);
        lf.position.set(Math.cos(a) * d2, y, Math.sin(a) * d2); lf.rotation.set(-0.6 + r() * 0.5, a, r() - 0.5); lf.castShadow = true; g.add(lf);
      }
      break;
    }
    case 'vaza': {
      g.add(cyl(w * 0.3, w * 0.4, h * 0.5, mat(it.color, { roughness: 0.2 }), 0, 0, 0, 20));
      const fm = mat(it.color2 || '#e86a8a', { roughness: 0.7 }), stem = mat('#4f7d46');
      for (let i = 0; i < 7; i++) { const a = i * 0.9, x = Math.cos(a) * 0.06, z = Math.sin(a) * 0.06; g.add(cyl(0.004, 0.004, h * 0.45, stem, x * 0.5, h * 0.45, z * 0.5, 4)); g.add(sphere(0.035, fm, x, h * 0.9 + (i % 3) * 0.03, z)); }
      break;
    }
    case 'carti': {
      const cols = ['#3c6e91', '#a33b32', '#e0c48a', '#2f4f3a', '#d8d2c6', '#5b4030'];
      let x = -w / 2;
      for (let i = 0; i < 7 && x < w / 2 - 0.03; i++) { const bw = 0.025 + (i % 3) * 0.01, bh = h * (0.7 + (i % 4) * 0.08); g.add(box(bw, bh, d * 0.85, mat(cols[i % cols.length], { roughness: 0.8 }), x + bw / 2, 0, 0)); x += bw + 0.003; }
      g.add(sphere(0.05, mat('#c9a86a', { metalness: 0.8, roughness: 0.3 }), w / 2 - 0.08, 0.05, 0));
      break;
    }
    case 'oglinda': {
      const fr = new THREE.Mesh(new THREE.TorusGeometry(w / 2 - 0.02, 0.02, 10, 48), mat(it.color, { metalness: 0.85, roughness: 0.25 })); fr.position.y = h / 2; g.add(fr);
      const mirror = new THREE.Mesh(new THREE.CircleGeometry(w / 2 - 0.03, 48), new THREE.MeshStandardMaterial({ color: '#dfe6ea', metalness: 1, roughness: 0.03 })); mirror.position.set(0, h / 2, 0.005); g.add(mirror);
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
    case 'copac': deciduous(g, w, h, it.color, seed); break;
    case 'mesteacan': birch(g, w, h, it.color, seed); break;
    case 'tuia': thuja(g, w, h, it.color, seed); break;
    case 'iarba_decorativa': ornamentalGrass(g, w, h, it.color, it.color2 || '#e3d3a8', seed); break;
    case 'bolovan': boulder(g, w, h, d, it.color, seed); break;
    case 'lavanda': lavender(g, w, d, h, it.color, seed); break;
    case 'tufis': shrub(g, w, h, it.color, seed); break;
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
      // margine din piatră, pereți interiori cu mozaic și apă care reflectă cerul
      const edge = mat('#e4e0d6', { roughness: 0.7 }), b = 0.3;
      g.add(box(w + 2 * b, 0.06, b, edge, 0, 0, -d / 2 - b / 2)); g.add(box(w + 2 * b, 0.06, b, edge, 0, 0, d / 2 + b / 2));
      g.add(box(b, 0.06, d, edge, -w / 2 - b / 2, 0, 0)); g.add(box(b, 0.06, d, edge, w / 2 + b / 2, 0, 0));
      g.add(box(w, 0.02, d, mat('#7ccbe0', { roughness: 0.4 }), 0, -0.02, 0));
      const water = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), new THREE.MeshPhysicalMaterial({ color: it.color, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.82, normalMap: waterNormals(), normalScale: new THREE.Vector2(0.35, 0.35) }));
      water.material.normalMap.repeat.set(w / 2, d / 2);
      water.position.y = 0.03; water.receiveShadow = true; g.add(water);
      break;
    }
    case 'insula': {
      const ov = 0.25; // consola pentru scaune pe spate
      g.add(box(w - 0.04, 0.1, d - ov - 0.04, dark, 0, 0, -ov / 2));
      g.add(box(w, h - 0.14, d - ov, c, 0, 0.1, -ov / 2));
      g.add(box(w + 0.04, 0.04, d + 0.02, c2, 0, h - 0.04, 0));
      const n = Math.max(2, Math.round(w / 0.6));
      for (let i = 0; i < n; i++) {
        const dw = w / n;
        g.add(box(dw - 0.006, h - 0.16, 0.01, c, -w / 2 + dw * (i + 0.5), 0.11, -d / 2 - 0.005 + 0.0));
        g.add(box(dw * 0.5, 0.012, 0.02, metal, -w / 2 + dw * (i + 0.5), h - 0.14, -d / 2 - 0.012));
      }
      // spatele insulei: lamele verticale de lemn și LED la plintă de jur împrejur
      const slat = mat('#a8754a', { roughness: 0.6 }), ns = Math.floor(w / 0.07);
      for (let i = 0; i < ns; i++) g.add(box(0.035, h - 0.2, 0.025, slat, -w / 2 + (i + 0.5) * w / ns, 0.12, d / 2 - ov + 0.0125));
      g.add(box(w - 0.06, 0.012, 0.02, ledMat(), 0, 0.03, d / 2 - ov + 0.04)); g.add(box(w - 0.06, 0.012, 0.02, ledMat(), 0, 0.03, -d / 2 - 0.02));
      for (let i = 0; i < Math.max(2, Math.floor(w / 0.6)); i++) {
        const x = -w / 2 + (i + 0.5) * w / Math.max(2, Math.floor(w / 0.6));
        g.add(cyl(0.17, 0.17, 0.04, dark, x, 0.66, d / 2 + 0.12));
        g.add(cyl(0.02, 0.02, 0.66, metal, x, 0, d / 2 + 0.12, 8));
        g.add(cyl(0.16, 0.16, 0.015, metal, x, 0, d / 2 + 0.12));
      }
      break;
    }
    case 'suspendat': {
      g.add(box(w, h, d, c));
      const n = Math.max(1, Math.round(w / 0.6));
      for (let i = 0; i < n; i++) {
        const dw = w / n;
        g.add(box(dw - 0.006, h - 0.01, 0.01, c, -w / 2 + dw * (i + 0.5), 0.005, d / 2 + 0.005));
        g.add(box(dw * 0.5, 0.012, 0.02, metal, -w / 2 + dw * (i + 0.5), 0.04, d / 2 + 0.015));
      }
      break;
    }
    case 'coloana': {
      g.add(box(w, h, d, c));
      g.add(box(w - 0.04, 0.6, 0.012, c, 0, 0.1, d / 2 + 0.006));
      g.add(box(w - 0.06, 0.48, 0.02, mat('#151515', { roughness: 0.15, metalness: 0.3 }), 0, 0.85, d / 2 + 0.01));
      g.add(box(w - 0.06, 0.08, 0.02, metal, 0, 1.36, d / 2 + 0.01));
      g.add(box(w - 0.04, h - 1.5, 0.012, c, 0, 1.47, d / 2 + 0.006));
      break;
    }
    case 'hota': {
      g.add(box(w, 0.06, d, mat(it.color, { metalness: 0.7, roughness: 0.3 }), 0, 0, 0));
      g.add(cyl(0.12, w * 0.35, 0.25, mat(it.color, { metalness: 0.7, roughness: 0.3 }), 0, 0.06, -d / 2 + 0.2, 4));
      g.add(box(0.26, h - 0.31, 0.26, mat(it.color, { metalness: 0.7, roughness: 0.3 }), 0, 0.31, -d / 2 + 0.14));
      break;
    }
    case 'scara': {
      const n = Math.max(3, Math.round(h / 0.18)), rise = h / n, run = d / n;
      for (let i = 0; i < n; i++) {
        g.add(box(w, 0.045, run + 0.03, c, 0, (i + 1) * rise - 0.045, d / 2 - (i + 0.5) * run));
        g.add(box(w - 0.02, rise - 0.045, 0.02, mat('#f2f0ec'), 0, i * rise, d / 2 - i * run - 0.01));
      }
      // vang și balustradă
      const len = Math.hypot(d, h), ang = Math.atan2(h, d);
      const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, len), c2);
      stringer.position.set(w / 2 + 0.025, h / 2 - 0.05, 0); stringer.rotation.x = ang; stringer.castShadow = true; g.add(stringer);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, len), c2);
      rail.position.set(w / 2 + 0.025, h / 2 + 0.9, 0); rail.rotation.x = ang; rail.castShadow = true; g.add(rail);
      for (let i = 0; i <= n; i += 2) g.add(box(0.025, 0.9, 0.025, c2, w / 2 + 0.025, i * rise, d / 2 - i * run));
      break;
    }
    case 'brad': conifer(g, w, h, it.color, seed); break;
    case 'pom': {
      g.add(cyl(0.08, 0.12, h * 0.42, mat('#6a4e33'), 0, 0, 0, 10));
      const leaf = mat(it.color, { roughness: 0.9 }), fruit = mat(it.color2 || def.c2, { roughness: 0.5 });
      const r = rng(7);
      for (let i = 0; i < 6; i++) { const a = r() * Math.PI * 2, rr = r() * w * 0.18; g.add(sphere(w * (0.2 + r() * 0.08), leaf, Math.cos(a) * rr, h * (0.62 + r() * 0.18), Math.sin(a) * rr)); }
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2, el = (r() - 0.3) * 1.2, R = w * 0.36;
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), fruit);
        f.position.set(Math.cos(a) * Math.cos(el) * R, h * 0.68 + Math.sin(el) * R * 0.7, Math.sin(a) * Math.cos(el) * R); g.add(f);
      }
      break;
    }
    case 'flori': {
      g.add(box(w, 0.12, d, mat('#5a3e2b', { roughness: 1 }), 0, 0, 0));
      g.add(box(w + 0.06, 0.16, 0.04, mat('#8a8f96'), 0, 0, d / 2 + 0.02)); g.add(box(w + 0.06, 0.16, 0.04, mat('#8a8f96'), 0, 0, -d / 2 - 0.02));
      g.add(box(0.04, 0.16, d, mat('#8a8f96'), w / 2 + 0.02, 0, 0)); g.add(box(0.04, 0.16, d, mat('#8a8f96'), -w / 2 - 0.02, 0, 0));
      const cols = [it.color, it.color2 || def.c2, '#ffffff', '#8a5cc7'], stem = mat('#4f7d3a'), r = rng(3);
      const n = Math.round(w * d * 60);
      for (let i = 0; i < n; i++) {
        const x = (r() - 0.5) * (w - 0.08), z = (r() - 0.5) * (d - 0.08), hh = 0.1 + r() * (h - 0.15);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, hh, 4), stem); st.position.set(x, 0.12 + hh / 2, z); g.add(st);
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.03 + r() * 0.015, 7, 5), mat(cols[Math.floor(r() * cols.length)], { roughness: 0.6 })); fl.position.set(x, 0.12 + hh, z); fl.castShadow = true; g.add(fl);
      }
      break;
    }
    case 'ghiveci': {
      g.add(cyl(w * 0.45, w * 0.32, h * 0.5, c, 0, 0, 0, 18));
      g.add(cyl(w * 0.42, w * 0.42, 0.02, mat('#4a3424'), 0, h * 0.48, 0, 18));
      const fl = mat(it.color2 || def.c2, { roughness: 0.6 }), leaf = mat('#4f7d3a', { roughness: 0.9 }), r = rng(5);
      g.add(sphere(w * 0.32, leaf, 0, h * 0.62, 0));
      for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, rr = w * (0.15 + r() * 0.18); g.add(sphere(0.04, fl, Math.cos(a) * rr, h * (0.62 + r() * 0.25), Math.sin(a) * rr)); }
      break;
    }
    case 'gard_viu': {
      g.add(rbox(w, h, d, Math.min(0.12, d / 3), mat(it.color, { roughness: 0.95 }), 0, 0, 0));
      break;
    }
    case 'gard': {
      const n = Math.max(2, Math.round(w / 0.14));
      for (let i = 0; i < n; i++) g.add(box(0.1, h - (i % 2) * 0.06, 0.025, c, -w / 2 + (i + 0.5) * w / n, 0, 0.02));
      g.add(box(w, 0.08, 0.04, c, 0, 0.25, -0.02)); g.add(box(w, 0.08, 0.04, c, 0, h - 0.35, -0.02));
      for (let i = 0; i <= Math.ceil(w / 2); i++) g.add(box(0.09, h + 0.05, 0.09, mat(shade(it.color, -0.12)), -w / 2 + Math.min(w, i * 2), 0, -0.06));
      break;
    }
    case 'alee_dale': {
      // dale late cu iarbă între ele, puțin rotite, ca la o alee de grădină
      const r = rng(seed), n = Math.max(2, Math.round(d / 0.75)), step = d / n;
      for (let i = 0; i < n; i++) { const k = box(w * (0.92 + r() * 0.08), h, step - 0.16, c, (r() - 0.5) * 0.06, 0, -d / 2 + (i + 0.5) * step); k.rotation.y = (r() - 0.5) * 0.05; g.add(k); }
      break;
    }
    case 'foc_gradina': {
      g.add(cyl(w / 2, w / 2 * 0.95, h, c, 0, 0, 0, 28)); g.add(cyl(w / 2 - 0.08, w / 2 - 0.08, 0.02, mat('#222'), 0, h - 0.01, 0, 24));
      const fm = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff8a2a', emissiveIntensity: lightsOn ? 3 : 1.4, transparent: true, opacity: 0.9 });
      const r = rng(seed); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, rr = (w / 2 - 0.18) * r(); const f = new THREE.Mesh(new THREE.ConeGeometry(0.05 + r() * 0.04, 0.2 + r() * 0.2, 6), fm); f.position.set(Math.cos(a) * rr, h + 0.12, Math.sin(a) * rr); g.add(f); }
      if (lightsOn) { const pl = new THREE.PointLight('#ff9a40', 2.5, 5, 2); pl.position.set(0, h + 0.4, 0); g.add(pl); }
      break;
    }
    case 'lounge': {
      // canapea în L pe soclu, cu bandă LED dedesubt
      const base = mat('#cfc8bb', { roughness: 0.8 }), sd = 0.8, seat = 0.42;
      g.add(box(w, 0.12, sd, base, 0, 0, -d / 2 + sd / 2)); g.add(box(sd, 0.12, d - sd, base, -w / 2 + sd / 2, 0, sd / 2));
      g.add(rbox(w, seat - 0.12, sd, 0.05, c, 0, 0.12, -d / 2 + sd / 2)); g.add(rbox(sd, seat - 0.12, d - sd, 0.05, c, -w / 2 + sd / 2, 0.12, sd / 2));
      g.add(rbox(w, h - seat, 0.2, 0.06, c, 0, seat, -d / 2 + 0.1)); g.add(rbox(0.2, h - seat, d - 0.2, 0.06, c, -w / 2 + 0.1, seat, 0.1));
      const r = rng(seed); for (let i = 0; i < 4; i++) g.add(rbox(0.42, 0.38, 0.12, 0.05, i % 2 ? c2 : mat('#d9cba8'), -w / 2 + 0.7 + i * 0.6, seat, -d / 2 + 0.27));
      g.add(box(w - 0.1, 0.012, 0.02, ledMat(), 0, 0.02, -d / 2 + sd + 0.01));
      break;
    }
    case 'perete_cascada': {
      // zid tencuit cu panou de piatră în mijloc, gură de apă și o perdea de apă care cade într-un bazin luminat
      const pl = mat(it.color2 || def.c2, { roughness: 0.9 }), st = stoneMat(Math.max(0.6, w * 0.55), h), dw = 0.25;
      g.add(box(w, h, dw, pl, 0, 0, -d / 2 + dw / 2));
      g.add(box(w * 0.55, h - 0.1, 0.04, st, 0, 0.05, -d / 2 + dw + 0.02));
      const sy = h * 0.62, wW = w * 0.32;
      g.add(box(wW + 0.08, 0.04, 0.16, mat('#2b2b2b', { metalness: 0.7, roughness: 0.3 }), 0, sy, -d / 2 + dw + 0.08));
      const wm = new THREE.MeshPhysicalMaterial({ color: '#cfe8f0', roughness: 0.05, transmission: 0.3, transparent: true, opacity: 0.55, emissive: '#bfe4ff', emissiveIntensity: lightsOn ? 0.9 : 0.05, side: THREE.DoubleSide, normalMap: waterNormals(), normalScale: new THREE.Vector2(0.6, 1.4) });
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(wW, sy - 0.32), wm); sheet.position.set(0, 0.32 + (sy - 0.32) / 2, -d / 2 + dw + 0.15); g.add(sheet);
      const bz = d - dw; g.add(box(w, 0.32, 0.06, st, 0, 0, d / 2 - 0.03)); g.add(box(0.06, 0.32, bz, st, -w / 2 + 0.03, 0, -d / 2 + dw + bz / 2)); g.add(box(0.06, 0.32, bz, st, w / 2 - 0.03, 0, -d / 2 + dw + bz / 2));
      const pool = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.02, bz - 0.06), new THREE.MeshPhysicalMaterial({ color: '#1d3b45', roughness: 0.03, clearcoat: 1, normalMap: waterNormals(), normalScale: new THREE.Vector2(0.4, 0.4), emissive: '#3aa0c8', emissiveIntensity: lightsOn ? 0.35 : 0 }));
      pool.position.set(0, 0.27, -d / 2 + dw + bz / 2); g.add(pool);
      g.add(box(w * 0.55, 0.012, 0.02, ledMat(), 0, h - 0.06, -d / 2 + dw + 0.05));
      if (lightsOn) { for (const x of [-w * 0.18, w * 0.18]) { const sp = new THREE.SpotLight('#ffd9a0', 6, h + 1, 0.55, 0.7, 2); sp.position.set(x, 0.3, -d / 2 + dw + 0.25); sp.target.position.set(x, h, -d / 2 + dw); g.add(sp, sp.target); } }
      break;
    }
    case 'pergola_led': {
      // pergolă din aluminiu negru cu lamele pe acoperiș și bandă LED de jur împrejur pe interior
      const al = mat(it.color, { metalness: 0.5, roughness: 0.45 }), p = 0.12, bh = 0.22;
      for (const x of [-w / 2 + p / 2, w / 2 - p / 2]) for (const z of [-d / 2 + p / 2, d / 2 - p / 2]) g.add(box(p, h - bh, p, al, x, 0, z));
      g.add(box(w, bh, p, al, 0, h - bh, -d / 2 + p / 2)); g.add(box(w, bh, p, al, 0, h - bh, d / 2 - p / 2));
      g.add(box(p, bh, d, al, -w / 2 + p / 2, h - bh, 0)); g.add(box(p, bh, d, al, w / 2 - p / 2, h - bh, 0));
      const n = Math.max(4, Math.round((w - 2 * p) / 0.2));
      for (let i = 0; i < n; i++) { const l = box(0.17, 0.025, d - 2 * p, al, -w / 2 + p + (i + 0.5) * (w - 2 * p) / n, h - 0.09, 0); l.rotation.z = 0.5; g.add(l); }
      const lm = ledMat();
      g.add(box(w - 2 * p, 0.015, 0.02, lm, 0, h - bh - 0.005, -d / 2 + p + 0.01)); g.add(box(w - 2 * p, 0.015, 0.02, lm, 0, h - bh - 0.005, d / 2 - p - 0.01));
      g.add(box(0.02, 0.015, d - 2 * p, lm, -w / 2 + p + 0.01, h - bh - 0.005, 0)); g.add(box(0.02, 0.015, d - 2 * p, lm, w / 2 - p - 0.01, h - bh - 0.005, 0));
      if (lightsOn) { const L = new THREE.PointLight('#ffcf8a', 6, Math.max(w, d) + 2, 2); L.position.y = h - 0.5; g.add(L); }
      break;
    }
    case 'gard_lamele': {
      // lamele late din lemn pe cadru negru, aplice sus-jos și iederă care urcă pe ele
      const n = Math.max(3, Math.round(w / 0.32));
      for (let i = 0; i < n; i++) g.add(box(0.2, h, 0.06, mat(shade(it.color, ((i * 53) % 9 - 4) * 0.012), { roughness: 0.65 }), -w / 2 + (i + 0.5) * w / n, 0, 0));
      g.add(box(w, 0.05, d, dark, 0, h, 0)); g.add(box(w, 0.25, d, mat('#3a3b3d'), 0, 0, 0));
      for (let x = -w / 2 + 0.75; x < w / 2; x += 1.5) {
        g.add(box(0.07, 0.3, 0.07, dark, x, h * 0.58, d / 2 + 0.035));
        const gl = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf8a', emissiveIntensity: lightsOn ? 3 : 0.2 });
        g.add(box(0.05, 0.01, 0.05, gl, x, h * 0.58 - 0.005, d / 2 + 0.035)); g.add(box(0.05, 0.01, 0.05, gl, x, h * 0.58 + 0.3, d / 2 + 0.035));
        if (lightsOn) { for (const dir of [-1, 1]) { const sp = new THREE.SpotLight('#ffcf8a', 3, 2.2, 0.35, 0.8, 2); sp.position.set(x, h * 0.58 + (dir > 0 ? 0.3 : 0), d / 2 + 0.06); sp.target.position.set(x, dir > 0 ? h + 1 : -1, d / 2 + 0.02); g.add(sp, sp.target); } }
      }
      const r = rng(seed), cl = [];
      for (let x = -w / 2 + 0.4; x < w / 2; x += 0.75 + r() * 0.5) { const hh = h * (0.45 + r() * 0.5); for (let y = 0.4; y < hh; y += 0.45) cl.push([x + (r() - 0.5) * 0.2, y, d / 2 + 0.07, 0.22 + r() * 0.12, 0.3, 0.07]); }
      climber(g, cl, it.color2 || def.c2, seed);
      break;
    }
    case 'perete_led': {
      // zid tencuit cu un capac care iese în afară; sub capac o bandă LED care spală zidul cu lumină
      g.add(box(w, h, d, c, 0, 0, 0)); g.add(box(w + 0.04, 0.06, d + 0.16, mat(shade(it.color, -0.05)), 0, h, 0.06));
      g.add(box(w, 0.012, 0.025, ledMat(), 0, h - 0.015, d / 2 + 0.09));
      // „spălarea” cu lumină: un gradient luminos pe fața zidului
      const wash = new THREE.Mesh(new THREE.PlaneGeometry(w, h * 0.7), washMat(lightsOn)); wash.position.set(0, h * 0.65, d / 2 + 0.003); g.add(wash);
      if (lightsOn) for (let x = -w / 2 + 1; x < w / 2; x += 2) { const sp = new THREE.SpotLight('#ffcf8a', 4, h + 1, 0.9, 0.9, 2); sp.position.set(x, h - 0.05, d / 2 + 0.15); sp.target.position.set(x, 0, d / 2 + 0.6); g.add(sp, sp.target); }
      break;
    }
    case 'perete_nise': {
      // zid placat cu piatră închisă la culoare, cu nișe rotunde: inel LED în jurul nișei și o plantă în fiecare
      const st = stoneMat(w, h, '#57534e'), n = Math.max(1, Math.round(w / 1.4)), R = Math.min(0.42, h * 0.2);
      g.add(box(w, h, d * 0.5, st, 0, 0, -d / 4));
      const lm = ledMat(), back = mat('#2a2826', { roughness: 1 }), leaf = it.color2 || def.c2;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (i + 0.5) * w / n, y = h * 0.55;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.03, 8, 40), lm); ring.position.set(x, y, 0.02); g.add(ring);
        // nișa se vede ca un cerc închis la culoare, cu fundul luminat de inel
        const nm = new THREE.MeshStandardMaterial({ color: '#2a2622', emissive: '#ffb870', emissiveIntensity: lightsOn ? 0.25 : 0, roughness: 1 });
        const hole = new THREE.Mesh(new THREE.CircleGeometry(R, 40), nm); hole.position.set(x, y, 0.004); g.add(hole);
        g.add(box(R * 1.5, 0.03, 0.12, mat('#3a3633'), x, y - R * 0.55, 0.06));
        const pg = new THREE.Group(); shrub(pg, R * 1.2, R * 1.2, leaf, seed + i); pg.position.set(x, y - R * 0.52, 0.08); g.add(pg);
        if (lightsOn) { const L = new THREE.PointLight('#ffcf8a', 1.2, 1.6, 2); L.position.set(x, y, 0.15); g.add(L); }
      }
      break;
    }
    case 'iaz': {
      // iaz cu margine de piatră, apă închisă care oglindește, nuferi și lumini sub apă
      const edge = mat('#4b4a48', { roughness: 0.8 }), b = 0.25;
      g.add(box(w + 2 * b, 0.1, b, edge, 0, 0, -d / 2 - b / 2)); g.add(box(w + 2 * b, 0.1, b, edge, 0, 0, d / 2 + b / 2));
      g.add(box(b, 0.1, d, edge, -w / 2 - b / 2, 0, 0)); g.add(box(b, 0.1, d, edge, w / 2 + b / 2, 0, 0));
      const water = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), new THREE.MeshPhysicalMaterial({ color: it.color, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.02, normalMap: waterNormals(), normalScale: new THREE.Vector2(0.25, 0.25), emissive: '#2f7f6a', emissiveIntensity: lightsOn ? 0.25 : 0 }));
      water.material.normalMap.repeat.set(w / 2, d / 2); water.position.y = 0.04; g.add(water);
      const r = rng(seed), pad = mat('#4c7a32', { roughness: 0.6, side: THREE.DoubleSide }), pink = mat('#f2b8c9', { roughness: 0.5 });
      for (let i = 0; i < Math.round(w * d * 1.6); i++) {
        const rr = 0.12 + r() * 0.1, lp = new THREE.Mesh(new THREE.CircleGeometry(rr, 18, 0.3, Math.PI * 2 - 0.3), pad); lp.rotation.x = -Math.PI / 2; lp.rotation.z = r() * 6.28;
        lp.position.set((r() - 0.5) * (w - 0.4), 0.062, (r() - 0.5) * (d - 0.4)); g.add(lp);
        if (r() > 0.6) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.07, 8, 1, true), pink); fl.rotation.x = Math.PI; fl.position.set(lp.position.x, 0.1, lp.position.z); g.add(fl); }
      }
      if (lightsOn) { const L = new THREE.PointLight('#bff0ff', 1.5, Math.max(w, d), 2); L.position.set(0, 0.0, 0); g.add(L); }
      break;
    }
    case 'balansoar': {
      // scaun ou din ratan, agățat de un arc de oțel pe o bază rotundă
      const st = mat('#2b2b2b', { metalness: 0.6, roughness: 0.35 });
      g.add(cyl(w * 0.42, w * 0.45, 0.06, st, 0, 0, 0, 28));
      const pz = -w * 0.46; g.add(cyl(0.035, 0.04, h, st, 0, 0, pz, 10));
      const arm = box(0.05, 0.05, -pz + 0.05, st, 0, h - 0.05, pz / 2); arm.rotation.x = 0; g.add(arm);
      g.add(cyl(0.008, 0.008, 0.32, st, 0, h - 0.37, 0, 6));
      const rat = new THREE.MeshStandardMaterial({ color: it.color, map: weaveTex(), roughness: 0.9, side: THREE.DoubleSide });
      // ou deschis în față: lipsește o felie pe partea dinspre +z
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 22, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0.05, Math.PI * 0.93), rat); egg.scale.set(1, 1.45, 1);
      egg.position.set(0, h - 1.06, 0); egg.castShadow = true; g.add(egg);
      g.add(rbox(0.66, 0.16, 0.6, 0.07, c2, 0, h - 1.5, 0.02));
      g.add(rbox(0.6, 0.45, 0.14, 0.06, c2, 0, h - 1.35, -0.25));
      break;
    }
    case 'lampion': case 'lampion_agatat': {
      // felinar din ratan cu lumină caldă înăuntru; cel suspendat are și un cablu în sus
      const rat = new THREE.MeshStandardMaterial({ color: it.color, map: weaveTex(), roughness: 0.9, transparent: true, alphaMap: weaveAlpha(), alphaTest: 0.3, side: THREE.DoubleSide });
      const body = new THREE.Mesh(new THREE.SphereGeometry(w / 2, 20, 14), rat); body.scale.y = h / w; body.position.y = h / 2; g.add(body);
      const glow = new THREE.MeshStandardMaterial({ color: '#fff0cc', emissive: '#ffb860', emissiveIntensity: lightsOn ? 4 : 0.3 });
      g.add(sphere(w * 0.16, glow, 0, h / 2, 0));
      if (it.type === 'lampion_agatat') g.add(cyl(0.006, 0.006, 0.9, dark, 0, h, 0, 6)); else g.add(cyl(w * 0.3, w * 0.3, 0.03, mat(shade(it.color, -0.2)), 0, 0, 0, 16));
      if (lightsOn) { const L = new THREE.PointLight('#ffb870', 1.6, 3.5, 2); L.position.y = h / 2; g.add(L); }
      break;
    }
    case 'pietre_rotunde': {
      // pietre rotunde pe o linie ușor șerpuită
      const r = rng(seed), n = Math.max(2, Math.round(d / 0.75)), step = d / n;
      for (let i = 0; i < n; i++) { const rr = w / 2 * (0.82 + r() * 0.18), k = cyl(rr, rr, h, mat(shade(it.color, (r() - 0.5) * 0.06), { roughness: 0.8 }), Math.sin(i * 0.9 + seed) * w * 0.35, 0, -d / 2 + (i + 0.5) * step, 28); g.add(k); }
      break;
    }
    case 'bordura_pietris': {
      // fâșie de pietre albe mici (bile turtite)
      const r = rng(seed), n = Math.round(w * d * 260), geo = new THREE.SphereGeometry(1, 7, 5), im = new THREE.InstancedMesh(geo, mat(it.color, { roughness: 0.55 }), n);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), E = new THREE.Euler(), C = new THREE.Color();
      for (let i = 0; i < n; i++) { const s = 0.02 + r() * 0.025; S.set(s * (1 + r() * 0.5), s * 0.55, s); Q.setFromEuler(E.set(0, r() * 6.28, 0)); V.set((r() - 0.5) * w, 0.015, (r() - 0.5) * d); M.compose(V, Q, S); im.setMatrixAt(i, M); im.setColorAt(i, C.set(it.color).offsetHSL(0, 0, -r() * 0.12)); }
      im.receiveShadow = true; g.add(im); g.add(box(w, 0.012, d, mat('#8d8a82'), 0, 0, 0));
      break;
    }
    case 'banda_led': {
      g.add(box(0.03, h, d, dark, 0, 0, 0)); g.add(box(0.012, 0.012, d, ledMat(), 0.018, h - 0.012, 0));
      break;
    }
    case 'sezlong': {
      // ramă joasă împletită, saltea groasă și spătar ridicat spre capul dinspre -z
      const rat = new THREE.MeshStandardMaterial({ color: it.color, map: weaveTex(), roughness: 0.9 });
      g.add(box(w, 0.22, d * 0.62, rat, 0, 0.06, d * 0.19)); for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) g.add(box(0.06, 0.08, 0.06, dark, x, 0, z));
      g.add(rbox(w - 0.04, 0.1, d * 0.6, 0.04, c2, 0, 0.28, d * 0.19));
      const bk = new THREE.Group(); bk.position.set(0, 0.3, -d / 2 + d * 0.38); bk.rotation.x = -0.75;
      bk.add(box(w, 0.08, d * 0.4, rat, 0, -0.08, -d * 0.2)); bk.add(rbox(w - 0.04, 0.09, d * 0.38, 0.04, c2, 0, 0, -d * 0.2)); g.add(bk);
      g.add(box(w, 0.06, d * 0.38, rat, 0, 0.06, -d / 2 + d * 0.19));
      g.add(rbox(0.4, 0.12, 0.28, 0.05, mat('#2f4a6e'), 0, 0.5, -d / 2 + 0.28));
      break;
    }
    case 'palmier': { palm(g, w, h, it.color, seed); break; }
    case 'spot_sol': {
      g.add(cyl(w / 2, w / 2, 0.02, c, 0, 0, 0, 16));
      const lm = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd9a0', emissiveIntensity: lightsOn ? 3 : 0.3 }); g.add(cyl(w / 2 - 0.02, w / 2 - 0.02, 0.022, lm, 0, 0.001, 0, 16));
      if (lightsOn) { const sp = new THREE.SpotLight('#ffd9a0', 3, 5, 0.5, 0.6, 2); sp.position.set(0, 0.05, 0); sp.target.position.set(0, 3, -0.4); g.add(sp, sp.target); }
      break;
    }
    case 'banca': {
      for (let i = 0; i < 4; i++) g.add(box(w, 0.035, 0.09, c, 0, 0.42, -d / 2 + 0.08 + i * 0.12));
      for (let i = 0; i < 3; i++) g.add(box(w, 0.08, 0.025, c, 0, 0.52 + i * 0.11, -d / 2 + 0.04));
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) { g.add(box(0.05, 0.42, d - 0.1, c2, x, 0, 0)); g.add(box(0.05, h - 0.42, 0.05, c2, x, 0.42, -d / 2 + 0.03)); }
      break;
    }
    case 'copertina': {
      // copertină din sticlă pe console metalice, cu tiranți spre perete
      g.add(box(w, 0.05, d, c, 0, h - 0.05, 0));
      const gl = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.02, d - 0.06), mat(it.color2 || def.c2, { roughness: 0.05, transparent: true, opacity: 0.45 })); gl.position.y = h + 0.012; g.add(gl);
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) {
        g.add(box(0.05, 0.05, d, c, x, h - 0.1, 0));
        const L = Math.hypot(d - 0.1, 0.6), rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, L, 8), c);
        rod.position.set(x, h + 0.3 - 0.02, 0); rod.rotation.x = Math.atan2(d - 0.1, 0.6); rod.castShadow = true; g.add(rod);
      }
      break;
    }
    case 'lamele': {
      const n = Math.max(3, Math.round(w / 0.11));
      for (let i = 0; i < n; i++) g.add(box(0.045, h, d, mat(shade(it.color, ((i * 37) % 7 - 3) * 0.008), { roughness: 0.7 }), -w / 2 + (i + 0.5) * w / n, 0, 0));
      g.add(box(w, 0.04, d + 0.02, dark, 0, h - 0.04, 0)); g.add(box(w, 0.04, d + 0.02, dark, 0, 0, 0));
      break;
    }
    case 'jardiniera': {
      g.add(box(w, h * 0.7, d, c, 0, 0, 0)); g.add(box(w - 0.06, 0.02, d - 0.06, mat('#3b2a1d'), 0, h * 0.7 - 0.03, 0));
      const lf = mat(it.color2 || def.c2, { roughness: 0.9 }), r = rng(seed);
      for (let i = 0; i < Math.round(w * 9); i++) g.add(sphere(0.07 + r() * 0.06, lf, (r() - 0.5) * (w - 0.12), h * 0.7 + 0.05 + r() * h * 0.35, (r() - 0.5) * (d - 0.12)));
      break;
    }
    case 'trepte': {
      // trepte din piatră; fiecare treaptă are ~17 cm, ultima e podestul din fața ușii
      const n = Math.max(1, Math.round(h / 0.17)), sh = h / n, sd = d / n, stone = mat(it.color, { roughness: 0.65 });
      for (let i = 0; i < n; i++) { g.add(box(w, sh * (i + 1), sd * (n - i) + 0.02, stone, 0, 0, -d / 2 + sd * (n - i) / 2)); g.add(box(w + 0.02, 0.02, 0.03, mat(shade(it.color, -0.08)), 0, sh * (i + 1) - 0.02, -d / 2 + sd * (n - i))); }
      break;
    }
    case 'numar_casa': {
      g.add(box(w, h, d, c, 0, 0, 0));
      const on = lightsOn, lm = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd8a0', emissiveIntensity: on ? 2 : 0.2 });
      for (let i = 0; i < 2; i++) g.add(box(0.08, h * 0.6, 0.01, lm, -0.06 + i * 0.12, h * 0.2, d / 2 + 0.003));
      break;
    }
    case 'ghiveci_mare': {
      g.add(cyl(w / 2, w * 0.38, 0.65, c, 0, 0, 0, 20)); g.add(cyl(w * 0.46, w * 0.46, 0.02, mat('#3b2a1d'), 0, 0.63, 0, 20));
      g.add(cyl(0.03, 0.04, h - 0.9, wood, 0, 0.65, 0, 8));
      const lf = mat(it.color2 || def.c2, { roughness: 0.9 }), r = rng(seed);
      for (let i = 0; i < 9; i++) g.add(sphere(0.16 + r() * 0.08, lf, (r() - 0.5) * 0.35, h - 0.35 + (r() - 0.5) * 0.35, (r() - 0.5) * 0.35));
      break;
    }
    case 'pergola': {
      for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) for (const z of [-d / 2 + 0.08, d / 2 - 0.08]) g.add(box(0.14, h, 0.14, c, x, 0, z));
      for (const z of [-d / 2 + 0.08, d / 2 - 0.08]) g.add(box(w + 0.3, 0.2, 0.07, c, 0, h - 0.2, z));
      const n = Math.round(w / 0.4);
      for (let i = 0; i <= n; i++) g.add(box(0.05, 0.14, d + 0.3, c, -w / 2 + i * w / n, h, 0));
      const ivy = mat(it.color2 || def.c2, { roughness: 0.95 }), r = rng(9);
      for (let i = 0; i < 18; i++) g.add(sphere(0.18 + r() * 0.12, ivy, (r() - 0.5) * w, h + 0.1, (r() > 0.5 ? 1 : -1) * (d / 2 - 0.05) + (r() - 0.5) * 0.3));
      break;
    }
    case 'felinar': {
      g.add(cyl(0.05, 0.07, h - 0.35, c, 0, 0, 0, 12));
      g.add(cyl(0.09, 0.12, 0.05, c, 0, 0, 0, 12));
      g.add(cyl(0.16, 0.1, 0.06, c, 0, h - 0.06, 0, 12));
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.28, 12), new THREE.MeshStandardMaterial({ color: '#fff4d8', emissive: lightsOn ? '#ffd38a' : '#000', emissiveIntensity: lightsOn ? 3 : 0, roughness: 0.3 }));
      glow.position.y = h - 0.21; g.add(glow);
      if (lightsOn) { const L = new THREE.PointLight('#ffcf8a', 9, 11, 2); L.position.y = h - 0.3; g.add(L); }
      break;
    }
    case 'bolard': {
      g.add(cyl(w / 2, w / 2, h - 0.12, c, 0, 0, 0, 14));
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 - 0.005, w / 2 - 0.005, 0.1, 14), new THREE.MeshStandardMaterial({ color: '#fff4d8', emissive: lightsOn ? '#ffd38a' : '#000', emissiveIntensity: lightsOn ? 3 : 0 }));
      glow.position.y = h - 0.07; g.add(glow);
      g.add(cyl(w / 2 + 0.01, w / 2 + 0.01, 0.03, c, 0, h - 0.03, 0, 14));
      if (lightsOn) { const L = new THREE.PointLight('#ffcf8a', 2.2, 3.5, 2); L.position.y = h - 0.1; g.add(L); }
      break;
    }
    case 'spot': {
      g.add(cyl(w / 2, w / 2, h, c, 0, 0, 0, 14));
      const glow = new THREE.Mesh(new THREE.CircleGeometry(w / 2 - 0.01, 14), new THREE.MeshStandardMaterial({ color: '#fff', emissive: lightsOn ? '#ffe2b0' : '#000', emissiveIntensity: lightsOn ? 4 : 0 }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = h + 0.002; g.add(glow);
      if (lightsOn) { const L = new THREE.SpotLight('#ffe2b0', 25, 9, 0.5, 0.6, 2); L.position.y = h + 0.05; L.target.position.set(0, 6, 0.6); g.add(L); g.add(L.target); }
      break;
    }
    case 'scara_l': case 'scara_u': {
      // două rampe cu podest; prima urcă spre -z, a doua se întoarce
      const n = Math.max(6, Math.round(h / 0.18)), rise = h / n, n1 = Math.floor(n / 2), n2 = n - n1 - 1;
      const U = it.type === 'scara_u', fw = U ? w / 2 - 0.03 : Math.min(1.0, w * 0.45);
      const land = fw, run1 = (d - land) / n1;
      const tread = mat(it.color), riser = mat('#f2f0ec');
      const x1 = U ? -w / 2 + fw / 2 : -w / 2 + fw / 2;
      for (let i = 0; i < n1; i++) { g.add(box(fw, 0.045, run1 + 0.03, tread, x1, (i + 1) * rise - 0.045, d / 2 - (i + 0.5) * run1)); g.add(box(fw - 0.02, rise - 0.045, 0.02, riser, x1, i * rise, d / 2 - i * run1 - 0.01)); }
      const ly = (n1 + 1) * rise;
      g.add(box(U ? w : w, 0.08, land, tread, 0, ly - 0.08, -d / 2 + land / 2));
      g.add(box(w, ly - 0.08, 0.04, riser, 0, 0, -d / 2 + land - 0.02));
      if (U) {
        const x2 = w / 2 - fw / 2, run2 = (d - land) / n2;
        for (let i = 0; i < n2; i++) { const y = ly + (i + 1) * rise; g.add(box(fw, 0.045, run2 + 0.03, tread, x2, y - 0.045, -d / 2 + land + (i + 0.5) * run2)); g.add(box(fw - 0.02, rise - 0.045, 0.02, riser, x2, y - rise, -d / 2 + land + i * run2 + 0.01)); }
        g.add(box(0.05, h + 0.9, 0.05, c2, 0, 0, -d / 2 + land));
      } else {
        const run2 = (w - fw) / n2;
        for (let i = 0; i < n2; i++) { const y = ly + (i + 1) * rise; g.add(box(run2 + 0.03, 0.045, fw, tread, -w / 2 + fw + (i + 0.5) * run2, y - 0.045, -d / 2 + land / 2)); g.add(box(0.02, rise - 0.045, fw - 0.02, riser, -w / 2 + fw + i * run2 + 0.01, y - rise, -d / 2 + land / 2)); }
      }
      // balustradă simplă pe marginea exterioară
      const rail = (x0, z0, y0, x1_, z1_, y1) => { const len = Math.hypot(x1_ - x0, z1_ - z0, y1 - y0); const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, len), c2); m.position.set((x0 + x1_) / 2, (y0 + y1) / 2 + 0.9, (z0 + z1_) / 2); m.lookAt(x1_, y1 + 0.9, z1_); m.castShadow = true; g.add(m); };
      rail(-w / 2 - 0.02, d / 2, rise, -w / 2 - 0.02, -d / 2 + land, ly);
      for (let i = 0; i <= n1; i += 2) g.add(box(0.025, 0.9, 0.025, c2, -w / 2 - 0.02, (i + 1) * rise, d / 2 - i * run1));
      break;
    }
    case 'scara_spirala': {
      const n = Math.max(10, Math.round(h / 0.2)), rise = h / n, R = Math.min(w, d) / 2, turn = Math.PI * 2 * 0.85;
      const tread = mat(it.color);
      g.add(cyl(0.07, 0.07, h + 0.95, c2, 0, 0, 0, 16));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * turn, y = (i + 1) * rise;
        const shape = new THREE.Shape(); const a0 = -turn / n * 0.55, a1 = turn / n * 0.55;
        shape.moveTo(0, 0); shape.absarc(0, 0, R, a0, a1, false); shape.lineTo(0, 0);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false, curveSegments: 6 });
        geo.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(geo, tread); m.position.y = y - 0.045; m.rotation.y = a; m.castShadow = m.receiveShadow = true; g.add(m);
        const px = Math.cos(a) * (R - 0.04), pz = -Math.sin(a) * (R - 0.04);
        g.add(box(0.02, 0.9, 0.02, c2, px, y, pz));
      }
      // mâna curentă în spirală
      const pts = []; for (let i = 0; i <= 60; i++) { const a = (i / 60) * turn; pts.push(new THREE.Vector3(Math.cos(a) * (R - 0.04), 0.9 + rise + (i / 60) * (h - rise), -Math.sin(a) * (R - 0.04))); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.022, 6), c2); tube.castShadow = true; g.add(tube);
      break;
    }
    case 'scara_plutitoare': {
      const n = Math.max(3, Math.round(h / 0.18)), rise = h / n, run = d / n;
      g.add(box(0.12, h + 0.2, d + 0.3, c2, -w / 2 - 0.06, 0, 0));
      for (let i = 0; i < n; i++) g.add(box(w, 0.07, run + 0.02, c, 0, (i + 1) * rise - 0.07, d / 2 - (i + 0.5) * run));
      // LED sub fiecare treaptă
      const lm = ledMat(); for (let i = 0; i < n; i++) g.add(box(w - 0.08, 0.01, 0.02, lm, 0, (i + 1) * rise - 0.082, d / 2 - i * run - 0.04));
      // parapet de sticlă pe partea liberă
      const len = Math.hypot(d, h), ang = Math.atan2(h, d);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.9, len), new THREE.MeshPhysicalMaterial({ color: '#d7ebf3', transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }));
      glass.position.set(w / 2 + 0.02, h / 2 + 0.5, 0); glass.rotation.x = ang; g.add(glass);
      break;
    }
    case 'scara_pod': {
      // trapă în tavan cu scară pliabilă coborâtă
      g.add(box(w + 0.08, 0.05, d + 0.08, c2, 0, h - 0.05, 0));
      const len = Math.hypot(d * 0.85, h), ang = Math.atan2(d * 0.85, h);
      const arm = new THREE.Group(); arm.position.set(0, h - 0.05, -d / 2 + 0.05); arm.rotation.x = -ang;
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) { const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.08), c); r1.position.set(x, -len / 2, 0); r1.castShadow = true; arm.add(r1); }
      const n = Math.round(len / 0.26);
      for (let i = 1; i <= n; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.03, 0.1), c); st.position.set(0, -i * len / (n + 1), 0); st.rotation.x = ang; st.castShadow = true; arm.add(st); }
      g.add(arm);
      break;
    }
    case 'scara_imperiala': {
      // o rampă largă până la podest, apoi două rampe care se întorc spre stânga și spre dreapta
      const n = Math.max(10, Math.round(h / 0.17)), rise = h / n, n1 = Math.round(n * 0.45), n2 = n - n1;
      const cw = w * 0.42, sw = (w - 0.2) / 2 - 0.3, land = 1.4, run1 = (d - land) / n1, run2 = (d - land) / n2;
      const tread = mat(it.color, { roughness: 0.25 }), side = mat(shade(it.color, -0.06));
      for (let i = 0; i < n1; i++) g.add(box(cw, (i + 1) * rise, run1, tread, 0, 0, d / 2 - (i + 0.5) * run1));
      const ly = n1 * rise;
      g.add(box(w, ly, land, tread, 0, 0, -d / 2 + land / 2));
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - sw / 2);
        for (let i = 0; i < n2; i++) { const y = ly + (i + 1) * rise; g.add(box(sw, 0.06, run2 + 0.02, tread, x, y - 0.06, -d / 2 + land + (i + 0.5) * run2)); g.add(box(sw, rise, 0.03, side, x, y - rise, -d / 2 + land + i * run2)); }
        // grinda de sub rampă
        const L = Math.hypot(d - land, h - ly), beam = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.18, L), side);
        beam.position.set(x, (ly + h) / 2 - 0.15, (-d / 2 + land + d / 2) / 2); beam.rotation.x = Math.atan2(h - ly, d - land); beam.castShadow = true; g.add(beam);
        // balustrade negre cu mână curentă
        for (const ex of [x - sw / 2, x + sw / 2]) {
          const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, L), c2); r.position.set(ex, (ly + h) / 2 + 0.95, (-d / 2 + land + d / 2) / 2); r.rotation.x = Math.atan2(h - ly, d - land); g.add(r);
          for (let i = 0; i <= n2; i += 2) g.add(box(0.02, 0.95, 0.02, c2, ex, ly + i * rise, -d / 2 + land + i * run2));
        }
      }
      for (const ex of [-cw / 2, cw / 2]) for (let i = 0; i <= n1; i += 2) g.add(box(0.02, 0.95, 0.02, c2, ex, i * rise, d / 2 - i * run1));
      g.add(box(w, 0.05, 0.05, c2, 0, ly + 0.95, -d / 2 + 0.03));
      break;
    }
    case 'scara_rulanta': {
      // scară rulantă: carcasă înclinată, trepte, balustrade din sticlă și mâini curente negre
      const flat = 1.0, L = d - 2 * flat, ang = Math.atan2(h, L), sl = Math.hypot(L, h);
      const body = mat(it.color, { metalness: 0.6, roughness: 0.3 }), glass = new THREE.MeshPhysicalMaterial({ color: it.color2 || '#cfe6f3', transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false });
      const step = mat('#4a4d52', { metalness: 0.5, roughness: 0.5 });
      g.add(box(w, 0.25, flat, body, 0, 0, d / 2 - flat / 2)); g.add(box(w, 0.25, flat, body, 0, h - 0.25, -d / 2 + flat / 2));
      const truss = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, sl), body); truss.position.set(0, h / 2 - 0.3, 0); truss.rotation.x = ang; truss.castShadow = true; g.add(truss);
      const n = Math.round(h / 0.2);
      for (let i = 0; i < n; i++) g.add(box(w - 0.3, 0.2, L / n, step, 0, (i + 0.5) * h / n - 0.05, d / 2 - flat - (i + 0.5) * L / n));
      for (const sx of [-1, 1]) {
        const gl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, sl + 0.4), glass); gl.position.set(sx * (w / 2 - 0.1), h / 2 + 0.6, 0); gl.rotation.x = ang; g.add(gl);
        const hr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, sl + 0.6), mat('#141516', { roughness: 0.4 })); hr.position.set(sx * (w / 2 - 0.1), h / 2 + 1.07, 0); hr.rotation.x = ang; g.add(hr);
      }
      break;
    }
    case 'lift': {
      // lift panoramic: puț din sticlă pe toată înălțimea, cabina jos
      const fr = mat(it.color, { metalness: 0.6, roughness: 0.3 }), glass = new THREE.MeshPhysicalMaterial({ color: it.color2 || '#cfe6f3', transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false });
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.08, h + 0.2, 0.08, fr, x * (w / 2 - 0.04), 0, z * (d / 2 - 0.04)));
      for (const y of [0, 2.4, h]) for (const [bw, bd, x, z] of [[w, 0.06, 0, -d / 2 + 0.03], [w, 0.06, 0, d / 2 - 0.03], [0.06, d, -w / 2 + 0.03, 0], [0.06, d, w / 2 - 0.03, 0]]) g.add(box(bw, 0.08, bd, fr, x, y, z));
      for (const [bw, bd, x, z] of [[w - 0.1, 0.02, 0, -d / 2 + 0.03], [0.02, d - 0.1, -w / 2 + 0.03, 0], [0.02, d - 0.1, w / 2 - 0.03, 0]]) { const gl = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), glass); gl.position.set(x, h / 2, z); g.add(gl); }
      g.add(box(w - 0.2, 0.06, d - 0.2, mat('#d9d6cf'), 0, 0.02, 0));
      g.add(box(w - 0.2, 0.05, d - 0.2, mat('#f4f4f2', { emissive: '#ffffff', emissiveIntensity: lightsOn ? 0.8 : 0.1 }), 0, 2.3, 0));
      for (const sx of [-1, 1]) g.add(box((w - 0.25) / 2, 2.2, 0.03, mat('#b8bcc0', { metalness: 0.8, roughness: 0.25 }), sx * (w - 0.25) / 4, 0.08, d / 2 - 0.05));
      break;
    }
    case 'balustrada': {
      const glass = new THREE.MeshPhysicalMaterial({ color: it.color2 || '#cfe6f3', transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false });
      const gl = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.08, 0.02), glass); gl.position.y = (h - 0.08) / 2 + 0.02; g.add(gl);
      g.add(box(w, 0.05, 0.06, mat(it.color, { metalness: 0.6, roughness: 0.3 }), 0, h - 0.05, 0));
      for (let i = 0; i <= Math.ceil(w / 1.2); i++) g.add(box(0.04, h, 0.04, mat(it.color, { metalness: 0.6, roughness: 0.3 }), -w / 2 + Math.min(w, i * 1.2), 0, 0));
      break;
    }
    case 'balcon': {
      // placă în consolă (fața spre +z iese din casă) cu parapet din sticlă
      const glass = new THREE.MeshPhysicalMaterial({ color: it.color2 || '#cfe6f3', transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false });
      g.add(box(w, 0.18, d, c, 0, -0.18, 0)); g.add(box(w, 0.02, d, mat('#a9a49b'), 0, 0, 0));
      const rail = mat('#3a3d42', { metalness: 0.5, roughness: 0.35 });
      for (const [bw, bd, x, z] of [[w, 0.02, 0, d / 2 - 0.03], [0.02, d, -w / 2 + 0.03, 0], [0.02, d, w / 2 - 0.03, 0]]) {
        const gl = new THREE.Mesh(new THREE.BoxGeometry(bw, h - 0.1, bd), glass); gl.position.set(x, (h - 0.1) / 2 + 0.03, z); g.add(gl);
        g.add(box(bw === 0.02 ? 0.05 : bw, 0.05, bd === 0.02 ? 0.05 : bd, rail, x, h - 0.05, z));
      }
      break;
    }
    case 'coloana_decor': {
      g.add(box(w, 0.12, d, c, 0, 0, 0)); g.add(box(w, 0.12, d, c, 0, h - 0.12, 0));
      g.add(cyl(w * 0.36, w * 0.4, h - 0.24, c, 0, 0.12, 0, 24));
      g.add(cyl(w * 0.45, w * 0.36, 0.1, c, 0, h - 0.22, 0, 24));
      break;
    }
    case 'poarta': case 'poarta_auto': {
      const pc = mat(it.color2 || '#b9a48a', { roughness: 0.85 }), m = mat(it.color, { metalness: 0.5, roughness: 0.4 });
      const pw = 0.4, inner = w - 2 * pw;
      for (const sx of [-1, 1]) { g.add(box(pw, h + 0.2, 0.4, pc, sx * (w / 2 - pw / 2), 0, 0)); g.add(box(pw + 0.06, 0.06, 0.46, mat(shade(it.color2 || '#b9a48a', -0.15)), sx * (w / 2 - pw / 2), h + 0.2, 0)); }
      const leaves = it.type === 'poarta' ? [[0, inner]] : [[0, inner]];
      for (const [x0, lw] of leaves) {
        g.add(box(lw, 0.06, 0.05, m, x0, 0.08, 0)); g.add(box(lw, 0.06, 0.05, m, x0, h - 0.06, 0)); g.add(box(lw, 0.05, 0.05, m, x0, h * 0.55, 0));
        const nb = Math.round(lw / 0.11);
        for (let i = 0; i <= nb; i++) g.add(box(0.03, h - 0.08, 0.03, m, x0 - lw / 2 + i * lw / nb, 0.08, 0));
        if (it.type === 'poarta_auto') { g.add(box(lw, 0.03, 0.08, mat('#55585c'), x0, 0, 0)); }
        else g.add(box(0.04, 0.1, 0.06, mat('#c9b26b', { metalness: 0.8, roughness: 0.3 }), lw / 2 - 0.12, 1.0, 0.05));
      }
      break;
    }
    case 'gard_metalic': {
      const pc = mat(it.color2 || '#b9a48a', { roughness: 0.85 }), m = mat(it.color, { metalness: 0.5, roughness: 0.4 });
      g.add(box(w, 0.4, 0.25, pc, 0, 0, 0));
      for (const x of [-w / 2 + 0.17, w / 2 - 0.17]) g.add(box(0.35, h + 0.1, 0.35, pc, x, 0, 0));
      const inner = w - 0.7, nb = Math.round(inner / 0.11);
      g.add(box(inner, 0.04, 0.04, m, 0, 0.5, 0)); g.add(box(inner, 0.04, 0.04, m, 0, h - 0.1, 0));
      for (let i = 0; i <= nb; i++) g.add(box(0.025, h - 0.4, 0.025, m, -inner / 2 + i * inner / nb, 0.4, 0));
      break;
    }
    case 'gard_zidarie': {
      g.add(box(w, 0.9, d, c, 0, 0, 0)); g.add(box(w + 0.04, 0.06, d + 0.06, mat(shade(it.color, -0.1)), 0, 0.9, 0));
      for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) { g.add(box(0.4, h, 0.4, c, x, 0, 0)); g.add(box(0.48, 0.06, 0.48, mat(shade(it.color, -0.1)), x, h, 0)); }
      const inner = w - 0.8, sl = mat(it.color2 || '#3a3d42', { metalness: 0.4, roughness: 0.45 });
      for (let i = 0; i < 6; i++) g.add(box(inner, 0.1, 0.04, sl, 0, 1.02 + i * ((h - 1.1) / 6), 0));
      break;
    }
    case 'stalp_lampa': {
      g.add(box(w, h - 0.35, d, c, 0, 0, 0)); g.add(box(w + 0.06, 0.06, d + 0.06, mat(shade(it.color, -0.15)), 0, h - 0.35, 0));
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.2), new THREE.MeshStandardMaterial({ color: '#fff4d8', emissive: lightsOn ? '#ffd38a' : '#000', emissiveIntensity: lightsOn ? 3 : 0, roughness: 0.3 }));
      glow.position.y = h - 0.15; g.add(glow); g.add(box(0.26, 0.04, 0.26, mat('#2f3135'), 0, h - 0.04, 0));
      if (lightsOn) { const L = new THREE.PointLight('#ffcf8a', 6, 8, 2); L.position.y = h - 0.15; g.add(L); }
      break;
    }
    case 'aplica': {
      // aplică pe perete, cu lumina în sus și în jos
      g.add(box(0.1, h, 0.05, c, 0, 0, -d / 2 + 0.025));
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.8, 0.06), new THREE.MeshStandardMaterial({ color: '#fff4d8', emissive: lightsOn ? '#ffd38a' : '#000', emissiveIntensity: lightsOn ? 2.5 : 0 }));
      glow.position.set(0, h / 2, -d / 2 + 0.08); g.add(glow);
      if (lightsOn) { const L = new THREE.PointLight('#ffd8a0', 3, 5, 2); L.position.set(0, h / 2, 0.15); g.add(L); }
      break;
    }
    case 'spot_tavan': {
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.015, 16), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: lightsOn ? '#ffe7c4' : '#000', emissiveIntensity: lightsOn ? 3 : 0 }));
      glow.position.y = 0.0; g.add(glow);
      g.add(cyl(w / 2 + 0.015, w / 2 + 0.015, 0.01, c, 0, 0.012, 0, 16));
      if (lightsOn) { const L = new THREE.SpotLight('#ffe2b8', 6, 6, 0.75, 0.6, 2); L.position.y = -0.02; L.target.position.set(0, -3, 0); g.add(L); g.add(L.target); }
      break;
    }
    case 'candelabru': {
      const gold = mat(it.color, { metalness: 0.85, roughness: 0.25 });
      g.add(cyl(0.01, 0.01, 0.5, gold, 0, h - 0.5, 0, 6));
      const crystal = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, roughness: 0.02, emissive: lightsOn ? '#ffe7c4' : '#000', emissiveIntensity: lightsOn ? 1.2 : 0 });
      for (const [r, y] of [[w / 2, 0.25], [w / 2.8, 0.5], [w / 5, 0.72]]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 8, 40), gold); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
        const n = Math.round(r * 30);
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), crystal); cr.position.set(Math.cos(a) * r, y - 0.1, Math.sin(a) * r); cr.scale.y = 2; g.add(cr); }
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const cnd = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8), new THREE.MeshStandardMaterial({ color: '#fff8e8', emissive: lightsOn ? '#ffd38a' : '#000', emissiveIntensity: lightsOn ? 3 : 0 })); cnd.position.set(Math.cos(a) * r, y + 0.06, Math.sin(a) * r); g.add(cnd); }
      }
      g.add(cyl(0.03, 0.03, h - 0.5, gold, 0, 0.1, 0, 8));
      if (lightsOn) { const L = new THREE.PointLight('#ffd8a0', 22, 14, 2); L.position.y = 0.4; g.add(L); }
      break;
    }
    case 'fantana': {
      const stone = mat(it.color, { roughness: 0.85 }), water = new THREE.MeshPhysicalMaterial({ color: it.color2 || '#4fa3c9', roughness: 0.05, transparent: true, opacity: 0.85, clearcoat: 1 });
      g.add(cyl(w / 2, w / 2, 0.45, stone, 0, 0, 0, 40));
      const wt = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 - 0.12, w / 2 - 0.12, 0.02, 40), water); wt.position.y = 0.4; g.add(wt);
      g.add(cyl(0.12, 0.18, h - 0.4, stone, 0, 0.4, 0, 16));
      g.add(cyl(w * 0.22, 0.12, 0.15, stone, 0, h * 0.72, 0, 32));
      const wt2 = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.2, w * 0.2, 0.02, 32), water); wt2.position.y = h * 0.72 + 0.14; g.add(wt2);
      g.add(sphere(0.12, stone, 0, h - 0.05, 0));
      break;
    }
    case 'semineu': {
      g.add(box(w, h, d, c));
      g.add(box(w + 0.1, 0.06, d + 0.08, mat('#cfc8bd'), 0, h, 0.02));
      g.add(box(w * 0.55, h * 0.5, 0.05, mat('#141414'), 0, 0.15, d / 2 - 0.02));
      g.add(box(w * 0.45, 0.06, 0.06, mat('#5b4630'), 0, 0.17, d / 2 - 0.05));
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 8), new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: lightsOn ? '#ff8a1e' : '#000', emissiveIntensity: lightsOn ? 2 : 0 }));
      fire.position.set(0, 0.35, d / 2 - 0.06); g.add(fire);
      if (lightsOn) { const L = new THREE.PointLight('#ff9a40', 4, 5, 2); L.position.set(0, 0.4, d / 2 + 0.2); g.add(L); }
      break;
    }
    case 'calorifer': {
      const n = Math.max(4, Math.round(w / 0.08));
      for (let i = 0; i < n; i++) g.add(box(w / n - 0.012, h, d, c, -w / 2 + (i + 0.5) * w / n, 0, 0));
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
  return canvasTex(1024, (g, s) => {
    const r = rng(seed);
    g.fillStyle = '#5f8343'; g.fillRect(0, 0, s, s);
    // pete mari mai deschise și mai închise, ca iarba reală care nu e uniformă
    for (let k = 0; k < 60; k++) { const x = r() * s, y = r() * s, rr = 40 + r() * 140, l = 26 + r() * 16;
      for (const [dx, dy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rr); gr.addColorStop(0, `hsla(${82 + r() * 18},40%,${l}%,0.35)`); gr.addColorStop(1, 'hsla(90,40%,30%,0)'); g.fillStyle = gr; g.fillRect(x + dx - rr, y + dy - rr, rr * 2, rr * 2); } }
    for (let k = 0; k < 42000; k++) { g.fillStyle = `hsla(${78 + r() * 30},${35 + r() * 25}%,${24 + r() * 24}%,0.55)`; g.save(); g.translate(r() * s, r() * s); g.rotate((r() - 0.5) * 0.8); g.fillRect(0, 0, 1.2, 3 + r() * 6); g.restore(); }
  });
}
// valuri fine pentru apa din piscină (hartă de normale)
let waterTex = null;
function waterNormals() {
  if (waterTex) return waterTex;
  const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d'), img = g.createImageData(n, n);
  const r = rng(5), waves = Array.from({ length: 9 }, () => [Math.floor(1 + r() * 5), Math.floor(1 + r() * 5) * (r() < 0.5 ? -1 : 1), r() * 6.28, 0.3 + r() * 0.7]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let dx = 0, dy = 0;
    for (const [kx, ky, ph, a] of waves) { const c = Math.cos((kx * x + ky * y) / n * 6.283 + ph) * a; dx += kx * c; dy += ky * c; }
    const i = (y * n + x) * 4; img.data[i] = 128 + dx * 9; img.data[i + 1] = 128 + dy * 9; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  waterTex = new THREE.CanvasTexture(cv); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  return waterTex;
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

// ---------- Finisaje pentru pereți și învelitori ----------
function bricks(seed, base = '#a4553a') {
  return canvasTex(512, (g, s) => {
    const r = rng(seed), rows = 16, bh = s / rows, bw = s / 4;
    g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < rows; i++) for (let j = -1; j < 5; j++) {
      const c = new THREE.Color(base); const hsl = {}; c.getHSL(hsl);
      c.setHSL(hsl.h + (r() - 0.5) * 0.03, hsl.s, hsl.l + (r() - 0.5) * 0.14);
      g.fillStyle = '#' + c.getHexString();
      g.fillRect(j * bw + (i % 2) * bw / 2 + 2, i * bh + 2, bw - 4, bh - 4);
    }
  });
}
function stone(seed) {
  return canvasTex(512, (g, s) => {
    const r = rng(seed);
    g.fillStyle = '#8d877d'; g.fillRect(0, 0, s, s);
    let y = 0;
    while (y < s) {
      const h = 30 + r() * 40; let x = -r() * 40;
      while (x < s) {
        const w = 50 + r() * 90, c = 120 + r() * 70;
        g.fillStyle = `rgb(${c},${c - 6 - r() * 10},${c - 16 - r() * 16})`;
        g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 - 3, h / 2 - 3, 0, 0, Math.PI * 2); g.fill();
        x += w;
      }
      y += h;
    }
  });
}
function cladding(seed) {
  return canvasTex(512, (g, s) => {
    const r = rng(seed), n = 8, pw = s / n;
    for (let i = 0; i < n; i++) {
      const c = new THREE.Color('#c08a5a'); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, hsl.l + (r() - 0.5) * 0.12);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(i * pw, 0, pw, s);
      g.globalAlpha = 0.1; for (let k = 0; k < 20; k++) { g.fillStyle = r() > 0.5 ? '#000' : '#fff'; g.fillRect(i * pw + r() * pw, 0, 1 + r() * 2, s); } g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(i * pw, 0, 2, s);
    }
  });
}
function smallTiles(seed) {
  // faianță albă: se colorează cu culoarea peretelui
  return canvasTex(512, (g, s) => {
    const r = rng(seed), n = 8, t = s / n;
    g.fillStyle = '#c9c9c9'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 245 + (r() - 0.5) * 10; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4); }
  });
}
function plaster(seed) {
  return canvasTex(256, (g, s) => {
    const r = rng(seed);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.035})`; g.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 3); }
  });
}
function roofTiles(seed) {
  return canvasTex(512, (g, s) => {
    const r = rng(seed), rows = 10, th = s / rows, cols = 8, tw = s / cols;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < rows; i++) for (let j = -1; j <= cols; j++) {
      const v = 200 + (r() - 0.5) * 40, x = j * tw + (i % 2) * tw / 2;
      const gr = g.createLinearGradient(0, i * th, 0, (i + 1) * th);
      gr.addColorStop(0, `rgb(${v},${v},${v})`); gr.addColorStop(1, `rgb(${v * 0.7},${v * 0.7},${v * 0.7})`);
      g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(x + 1, i * th, tw - 2, th - 1, [0, 0, tw / 2, tw / 2]) : g.rect(x + 1, i * th, tw - 2, th - 1); g.fill();
    }
  });
}

// tint = true: culoarea aleasă colorează textura
export const WALL_FINISHES = {
  vopsea: { name: 'Vopsea lavabilă', size: 2, tint: true, make: () => plaster(3), rough: 0.92 },
  faianta: { name: 'Faianță 15×15', size: 1.2, tint: true, make: () => smallTiles(5), rough: 0.25 },
  caramida: { name: 'Cărămidă aparentă', size: 1.6, tint: false, make: () => bricks(8), rough: 0.9 },
  piatra: { name: 'Piatră naturală', size: 2.2, tint: false, make: () => stone(12), rough: 0.95 },
  lemn: { name: 'Lambriu din lemn', size: 1.6, tint: false, make: () => cladding(4), rough: 0.7 },
  beton: { name: 'Beton aparent', size: 3, tint: false, make: () => concrete(9), rough: 0.85 },
};
const wfCache = {};
export function finishTexture(id) { return wfCache[id] || (wfCache[id] = (WALL_FINISHES[id] || WALL_FINISHES.vopsea).make()); }
let roofTex;
const roofTexs = {};
// învelitori: țiglă, tablă fălțuită (nervuri pe pantă), șindrilă bituminoasă
export function roofTexture(kind = 'tigla') {
  if (roofTexs[kind]) return roofTexs[kind];
  if (kind === 'tabla') return (roofTexs[kind] = canvasTex(512, (g, s) => {
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, s, s);
    const n = 4, sw = s / n;
    for (let i = 0; i < n; i++) {
      const x = i * sw, gr = g.createLinearGradient(x, 0, x + sw, 0);
      gr.addColorStop(0, '#cfcfcf'); gr.addColorStop(0.5, '#e2e2e2'); gr.addColorStop(1, '#c9c9c9'); g.fillStyle = gr; g.fillRect(x, 0, sw, s);
      g.fillStyle = '#f4f4f4'; g.fillRect(x, 0, 5, s); g.fillStyle = '#9a9a9a'; g.fillRect(x + 5, 0, 3, s);
    }
  }));
  if (kind === 'sindrila') return (roofTexs[kind] = canvasTex(512, (g, s) => {
    const r = rng(77), rows = 16, th = s / rows, cols = 6, tw = s / cols;
    g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < rows; i++) for (let j = -1; j <= cols; j++) {
      const v = 170 + (r() - 0.5) * 60, x = j * tw + (i % 2) * tw / 2;
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 1, i * th, tw - 2, th - 2);
      for (let k = 0; k < 40; k++) { const q = v + (r() - 0.5) * 70; g.fillStyle = `rgb(${q},${q},${q})`; g.fillRect(x + r() * tw, i * th + r() * th, 2, 2); }
    }
  }));
  return (roofTexs[kind] = roofTiles(21));
}

// Structura pereților: grosime tipică și cum se calculează cantitatea
export const STRUCTURES = {
  caramida: { name: 'Cărămidă plină', t: 0.25, unit: 'cărămizi', perM3: 400, note: '250×120×65 mm, cu mortar' },
  ceramic: { name: 'Blocuri ceramice', t: 0.25, unit: 'blocuri', perM3: 44, note: '380×250×238 mm' },
  bca: { name: 'BCA (beton celular)', t: 0.30, unit: 'blocuri', perM3: 22.2, note: '600×250×300 mm' },
  beton: { name: 'Beton armat', t: 0.20, unit: 'm³ beton', perM3: 1, note: 'turnat în cofraj' },
  lemn: { name: 'Structură din lemn', t: 0.18, unit: 'm³ lemn', perM3: 0.14, note: 'cadre 45×150 mm + izolație' },
  sip: { name: 'Panouri SIP', t: 0.17, unit: 'm² panouri', perM2: 1, note: 'OSB + polistiren' },
};
export const PARTITIONS = {
  bca10: { name: 'BCA 10 cm', t: 0.10, unit: 'blocuri', perM3: 26.7, note: '600×250×100 mm' },
  gips: { name: 'Gips-carton', t: 0.10, unit: 'm² plăci', perM2: 2, note: 'profile 75 mm, câte o placă pe față' },
  caramida12: { name: 'Cărămidă 12 cm', t: 0.12, unit: 'cărămizi', perM3: 400, note: '250×120×65 mm' },
};
export const KITCHEN_PALETTES = [
  ['#f2f0eb', '#b98a5a', 'Alb + blat stejar'],
  ['#3b3f45', '#ece9e3', 'Antracit + blat alb'],
  ['#a9b8a0', '#d9c8ad', 'Verde salvie + lemn'],
  ['#2f3e55', '#f1efea', 'Bleumarin + alb'],
  ['#6e4a32', '#222222', 'Nuc + blat negru'],
  ['#e6dccb', '#8e9093', 'Bej + blat gri'],
  ['#c96b4b', '#efece6', 'Teracotă + alb'],
  ['#ffffff', '#2b2b2b', 'Alb lucios + negru'],
];

// ---------- Texturi pentru alei și zone de grădină ----------
function pavers(seed, base = '#a59a8e') {
  return canvasTex(512, (g, s) => {
    const r = rng(seed); g.fillStyle = '#6f675e'; g.fillRect(0, 0, s, s);
    const bw = s / 4, bh = s / 8;
    for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) {
      const c = new THREE.Color(base); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, hsl.l + (r() - 0.5) * 0.12);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(x * bw + (y % 2) * bw / 2 + 2, y * bh + 2, bw - 4, bh - 4);
    }
  });
}
function slabs(seed, base, n) {
  return canvasTex(512, (g, s) => {
    const r = rng(seed); g.fillStyle = '#7d776f'; g.fillRect(0, 0, s, s); const ts = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = new THREE.Color(base); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, hsl.l + (r() - 0.5) * 0.08);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(x * ts + 3, y * ts + 3, ts - 6, ts - 6);
      g.globalAlpha = 0.07; for (let k = 0; k < 60; k++) { g.fillStyle = r() > 0.5 ? '#000' : '#fff'; g.fillRect(x * ts + r() * ts, y * ts + r() * ts, 2, 2); } g.globalAlpha = 1;
    }
  });
}
function flagstone(seed) {
  return canvasTex(512, (g, s) => {
    const r = rng(seed); g.fillStyle = '#5e6b4f'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const cx = r() * s, cy = r() * s, rad = 40 + r() * 45, c = new THREE.Color('#b9b1a2'); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, hsl.l + (r() - 0.5) * 0.14);
      g.fillStyle = '#' + c.getHexString(); g.beginPath();
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = rad * (0.7 + r() * 0.3); const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; k ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.closePath(); g.fill();
    }
  });
}
function gravel(seed, base = '#c9c1b2') {
  return canvasTex(512, (g, s) => {
    const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) { const c = new THREE.Color(base); c.offsetHSL(0, 0, (r() - 0.5) * 0.35); g.fillStyle = '#' + c.getHexString(); g.beginPath(); g.arc(r() * s, r() * s, 1 + r() * 2.5, 0, Math.PI * 2); g.fill(); }
  });
}
function lawn(seed) {
  return canvasTex(512, (g, s) => {
    const r = rng(seed);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#5d8f3e' : '#6a9c46'; g.fillRect(0, i * s / 8, s, s / 8); }
    g.globalAlpha = 0.35; for (let i = 0; i < 14000; i++) { g.fillStyle = r() > 0.5 ? '#4b7a31' : '#82b35a'; g.fillRect(r() * s, r() * s, 1, 3); } g.globalAlpha = 1;
  });
}
function soil(seed) {
  return canvasTex(256, (g, s) => { const r = rng(seed); g.fillStyle = '#4e3626'; g.fillRect(0, 0, s, s); for (let i = 0; i < 3000; i++) { g.fillStyle = r() > 0.5 ? '#3b281c' : '#6a4c37'; g.fillRect(r() * s, r() * s, 2, 2); } });
}
// size = câți metri acoperă o textură
export const PATH_MATS = {
  pavele: { name: 'Pavele', size: 1.6, make: () => pavers(31) },
  pavele_rosii: { name: 'Pavele roșiatice', size: 1.6, make: () => pavers(33, '#a3634a') },
  dale: { name: 'Dale de beton 40×40', size: 1.6, make: () => slabs(35, '#bdb8ae', 4) },
  piatra: { name: 'Piatră naturală', size: 2.4, make: () => flagstone(37) },
  pietris: { name: 'Pietriș', size: 1.2, make: () => gravel(39) },
  lemn: { name: 'Deck din lemn', size: 2.0, make: () => planks('#9b6a42', 0.12, 41) },
};
export const ZONE_TYPES = {
  gazon: { name: 'Gazon', size: 4, make: () => lawn(43) },
  flori: { name: 'Strat de flori', size: 1.2, make: () => soil(45), flowers: true },
  pietris: { name: 'Pietriș decorativ', size: 1.2, make: () => gravel(47, '#d8d2c4') },
  terasa: { name: 'Terasă din lemn', size: 2.0, make: () => planks('#a0703f', 0.12, 49) },
  pavaj: { name: 'Pavaj', size: 1.6, make: () => pavers(51) },
  apa: { name: 'Iaz / apă', size: 3, make: () => canvasTex(64, (g, s) => { g.fillStyle = '#3f8fb5'; g.fillRect(0, 0, s, s); }), water: true },
};
const gCache = {};
export function gardenTexture(kind, id) { const k = kind + id; const src = kind === 'path' ? PATH_MATS : ZONE_TYPES; return gCache[k] || (gCache[k] = (src[id] || Object.values(src)[0]).make()); }

// ---------- materiale pentru curte: piatră stivuită, împletitură de ratan, lumina care „spală” zidul ----------
const stoneCache = {};
function stoneMat(w, h, tint) {
  const k = tint || 'n'; const t0 = stoneCache[k] || (stoneCache[k] = stone(61));
  const t = t0.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 1.6, h / 1.6);
  return new THREE.MeshStandardMaterial({ map: t, color: tint || '#ffffff', roughness: 0.95, bumpMap: t, bumpScale: 3 });
}
let weaveT, weaveA;
function weaveTex() {
  return weaveT || (weaveT = (() => { const t = canvasTex(128, (g, s) => { g.fillStyle = '#e8d9c0'; g.fillRect(0, 0, s, s); g.strokeStyle = '#8a6a44'; g.lineWidth = 3; for (let i = 0; i < s; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s / 2, s); g.stroke(); g.beginPath(); g.moveTo(i, s); g.lineTo(i + s / 2, 0); g.stroke(); } }); t.repeat.set(6, 6); return t; })());
}
function weaveAlpha() {
  return weaveA || (weaveA = (() => { const t = canvasTex(128, (g, s) => { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); g.strokeStyle = '#fff'; g.lineWidth = 5; for (let i = -s; i < 2 * s; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s / 2, s); g.stroke(); g.beginPath(); g.moveTo(i, s); g.lineTo(i + s / 2, 0); g.stroke(); } }); t.colorSpace = THREE.NoColorSpace; t.repeat.set(4, 4); return t; })());
}
let washT;
function washMat(on) {
  washT = washT || (() => { const cv = document.createElement('canvas'); cv.width = 8; cv.height = 128; const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.35, 'rgba(255,200,130,0.35)'); gr.addColorStop(1, 'rgba(255,200,130,0)'); g.fillStyle = gr; g.fillRect(0, 0, 8, 128); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  return new THREE.MeshBasicMaterial({ map: washT, transparent: true, opacity: on ? 0.55 : 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
}
