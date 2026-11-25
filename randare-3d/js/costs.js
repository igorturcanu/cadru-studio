// Calculatorul de costuri: transformă cantitățile din proiect în lista de cumpărături, cu prețuri orientative.
// Prețurile sunt intervale aproximative (minim–maxim), cu TVA, fără manoperă și transport, verificate în noiembrie 2026
// în ofertele publice ale magazinelor. Nu sunt prețuri fixe: utilizatorul le poate schimba în tabel, iar fișierul
// preturi.json (actualizat periodic) le înlocuiește pe cele de aici fără să fie nevoie de o versiune nouă a paginii.

// f = de câte ori e mai mare prețul local decât prețul de bază (Olanda, €), pentru materialele fără preț verificat separat
// tf = același lucru pentru unelte (uneltele au prețuri mai apropiate între țări)
export const REGIONS = {
  md: {
    name: 'Republica Moldova', cur: 'lei', dec: 0, labour: 0.6, eur: 19.8, f: null, tf: 19,
    note: 'Prețuri în lei moldovenești, cu TVA, din magazine și depozite din Chișinău.',
    shops: [['Supraten', 'https://www.supraten.md'], ['Baza Caliga', 'https://www.bazacaliga.md'], ['Stroimarket', 'https://stroimarket.md'], ['DocConstruct', 'https://docconstruct.md'], ['RoofLand', 'https://roofland.md'], ['Imperlux', 'https://imperlux.md']],
  },
  ro: {
    name: 'România', cur: 'RON', dec: 0, labour: 0.5, eur: 5.0, f: 4.2, tf: 4.8,
    note: 'Prețuri în lei românești, cu TVA, din magazinele de bricolaj și depozitele mari.',
    shops: [['Dedeman', 'https://www.dedeman.ro'], ['Hornbach', 'https://www.hornbach.ro'], ['Leroy Merlin', 'https://www.leroymerlin.ro'], ['Brico Depot', 'https://www.bricodepot.ro'], ['Arabesque', 'https://www.arabesque.ro'], ['Ambient', 'https://www.ambient.ro']],
  },
  nl: {
    name: 'Olanda', cur: '€', dec: 2, labour: 1.0, f: 1, tf: 1,
    note: 'Prețuri cu TVA (BTW 21%), magazine de bricolaj și depozite de materiale.',
    shops: [['Gamma', 'https://www.gamma.nl'], ['Karwei', 'https://www.karwei.nl'], ['Praxis', 'https://www.praxis.nl'], ['Hornbach', 'https://www.hornbach.nl'], ['Bouwmaat', 'https://www.bouwmaat.nl'], ['BouwCenter', 'https://www.bouwcenter.nl'], ['Sleiderink', 'https://www.sleiderink.nl']],
  },
  de: {
    name: 'Germania', cur: '€', dec: 2, labour: 1.0, f: 0.95, tf: 0.95,
    note: 'Prețuri cu TVA (MwSt. 19%), din magazinele de bricolaj (Baumarkt) și depozite.',
    shops: [['Hornbach', 'https://www.hornbach.de'], ['OBI', 'https://www.obi.de'], ['Bauhaus', 'https://www.bauhaus.info'], ['toom', 'https://toom.de'], ['hagebau', 'https://www.hagebau.de'], ['Globus Baumarkt', 'https://www.globus-baumarkt.de']],
  },
  fr: {
    name: 'Franța', cur: '€', dec: 2, labour: 0.9, f: 1.05, tf: 1.0,
    note: 'Prețuri TTC (TVA 20%), din magazinele de bricolaj și depozitele de materiale.',
    shops: [['Leroy Merlin', 'https://www.leroymerlin.fr'], ['Castorama', 'https://www.castorama.fr'], ['Brico Dépôt', 'https://www.bricodepot.fr'], ['Bricomarché', 'https://www.bricomarche.com'], ['Point.P', 'https://www.pointp.fr'], ['BigMat', 'https://www.bigmat.fr']],
  },
  uk: {
    name: 'Marea Britanie', cur: '£', dec: 2, labour: 1.0, eur: 0.87, f: 0.92, tf: 0.88,
    note: 'Prețuri cu TVA (VAT 20%), din magazine de bricolaj și depozite pentru constructori.',
    shops: [['B&Q', 'https://www.diy.com'], ['Wickes', 'https://www.wickes.co.uk'], ['Travis Perkins', 'https://www.travisperkins.co.uk'], ['Screwfix', 'https://www.screwfix.com'], ['Jewson', 'https://www.jewson.co.uk'], ['Selco', 'https://www.selcobw.com']],
  },
  ru: {
    name: 'Rusia', cur: '₽', dec: 0, labour: 0.45, eur: 95, f: 50, tf: 75,
    note: 'Prețuri în ruble, cu TVA, din hipermarketurile de bricolaj din Moscova și din regiuni.',
    shops: [['Лемана ПРО', 'https://lemanapro.ru'], ['Петрович', 'https://petrovich.ru'], ['ВсеИнструменты.ру', 'https://www.vseinstrumenti.ru'], ['Максидом', 'https://www.maxidom.ru']],
  },
};
export const REGION_KEYS = Object.keys(REGIONS);

// [nume, unitate, [min, max] Olanda (€), [min, max] Moldova (lei), prețuri verificate separat pe alte țări]
const BASE = {
  caramida: ['Cărămidă plină', 'buc', [0.35, 0.75], [6, 12], { uk: [0.9, 1.7], ro: [1.4, 2.8] }],
  ceramic: ['Bloc ceramic 38 cm', 'buc', [2.5, 4.2], [28, 42], { ro: [11, 17] }],
  bca: ['BCA (beton celular)', 'm³', [120, 175], [2300, 3300], { ro: [470, 730], de: [180, 240], fr: [200, 290], uk: [190, 320], ru: [5500, 8000] }],
  beton: ['Beton C25/30 (livrat)', 'm³', [140, 195], [1500, 2100], { ro: [450, 600], ru: [5500, 7500] }],
  lemn: ['Lemn de construcție', 'm³', [550, 850], [5500, 7500], { ro: [1400, 2200], ru: [17000, 28000] }],
  sip: ['Panouri SIP', 'm²', [45, 75], [600, 950]],
  bca10: ['BCA 10 cm (pereți interiori)', 'm³', [120, 175], [2300, 3300], { ro: [470, 730], de: [180, 240], fr: [200, 290], uk: [190, 320], ru: [5500, 8000] }],
  gips: ['Gips-carton cu profile', 'm²', [5, 9], [70, 110]],
  caramida12: ['Cărămidă (pereți interiori)', 'buc', [0.35, 0.75], [6, 12], { uk: [0.9, 1.7], ro: [1.4, 2.8] }],
  mortar: ['Mortar / adeziv, sac 25 kg', 'saci', [6, 11], [90, 140], { ro: [22, 40], de: [4.9, 6.5], fr: [5, 9], uk: [7, 9.7], ru: [280, 450] }],
  fundatie: ['Beton pentru fundație (estimare)', 'm³', [140, 195], [1500, 2100], { ro: [450, 600], ru: [5500, 7500] }],
  planseu: ['Beton pentru planșeu', 'm³', [140, 195], [1500, 2100], { ro: [450, 600], ru: [5500, 7500] }],
  tigla_metalica: ['Țiglă metalică', 'm²', [12, 22], [140, 245], { ro: [35, 60], ru: [550, 900] }],
  tigla_ceramica: ['Țiglă ceramică', 'm²', [35, 65], [350, 550], { ro: [75, 140] }],
  tigla_beton: ['Țiglă din beton', 'm²', [26, 36], [250, 350], { fr: [14, 30] }],
  hidro: ['Membrană bituminoasă (terasă)', 'm²', [12, 25], [120, 250]],
  sarpanta: ['Lemn pentru șarpantă', 'm³', [550, 850], [5500, 7500], { ro: [1400, 2200], ru: [17000, 28000] }],
  izo_acoperis: ['Vată minerală 20 cm (acoperiș)', 'm²', [12, 20], [120, 200]],
  izo_fatada: ['Termoizolație fațadă 10 cm (polistiren)', 'm²', [15, 26], [150, 260]],
  ferestre: ['Ferestre PVC cu geam termopan', 'm²', [250, 450], [1800, 3000], { ro: [800, 1400], fr: [280, 520], uk: [250, 450], ru: [6000, 12000] }],
  usi: ['Uși (interioare și de intrare)', 'buc', [150, 450], [2000, 6000]],
  glaf: ['Glaf exterior din aluminiu', 'm', [15, 30], [150, 300]],
  jgheab: ['Jgheab', 'm', [12, 25], [120, 250]],
  burlan: ['Burlan', 'm', [10, 20], [100, 200]],
  stejar: ['Parchet', 'm²', [30, 60], [350, 700]], nuc: ['Parchet nuc', 'm²', [40, 75], [450, 900]], frasin: ['Parchet frasin', 'm²', [30, 60], [350, 700]],
  gresie: ['Gresie', 'm²', [25, 50], [250, 500]], ardezie: ['Gresie gri', 'm²', [25, 50], [250, 500]],
  marmura: ['Marmură', 'm²', [70, 150], [1000, 2000]], beton_slefuit: ['Beton șlefuit', 'm²', [40, 80], [400, 800]],
  vopsea: ['Vopsea lavabilă', 'L', [8, 15], [70, 140]],
  pavele: ['Pavele', 'm²', [20, 35], [180, 300]], pavele_rosii: ['Pavele roșiatice', 'm²', [22, 38], [190, 320]],
  dale: ['Dale de beton', 'm²', [15, 30], [150, 250]], piatra: ['Piatră naturală', 'm²', [40, 80], [350, 700]],
  pietris: ['Pietriș', 'm²', [4, 8], [40, 80]], lemn_deck: ['Deck din lemn', 'm²', [40, 80], [500, 900]],
  gazon: ['Gazon rulou', 'm²', [4, 8], [40, 70]], flori: ['Strat de flori (pământ și plante)', 'm²', [15, 30], [150, 300]],
  apa: ['Iaz: folie EPDM și pietre', 'm²', [15, 30], [150, 300]],
};
// unelte pentru cine construiește singur: [nume, [min, max] Olanda (€), câte bucăți]
const TOOL_BASE = {
  bormasina: ['Bormașină cu percuție', [60, 180]],
  rotopercutor: ['Rotopercutor SDS-plus', [90, 260]],
  surubelnita: ['Mașină de înșurubat cu acumulator', [60, 180]],
  flex: ['Polizor unghiular (flex) 125 mm', [40, 130]],
  circular: ['Fierăstrău circular', [70, 220]],
  laser: ['Nivelă laser cu linii în cruce', [50, 250]],
  nivela: ['Nivelă cu bulă 1,2 m', [12, 40]],
  ruleta: ['Ruletă 8 m', [6, 18]],
  betoniera: ['Betonieră 140–160 L', [190, 380]],
  roaba: ['Roabă de construcții', [45, 110]],
  mistrie: ['Set de mistrii, drișcă și fier de glet', [15, 45]],
  ferastrau_bca: ['Fierăstrău pentru BCA', [18, 45]],
  mixer: ['Mixer pentru mortar și adeziv', [60, 160]],
  scara: ['Scară telescopică 3,8 m', [80, 200]],
  schela: ['Schelă mobilă pe roți (2–4 m)', [250, 650]],
  protectie: ['Echipament de protecție (cască, ochelari, mănuși)', [25, 60]],
};
// rotunjire „de magazin”: zecimale la prețurile mici, numere întregi sau zeci la cele mari
const rnd = (v) => (v < 20 ? Math.round(v * 100) / 100 : v < 200 ? Math.round(v * 2) / 2 : v < 2000 ? Math.round(v) : Math.round(v / 10) * 10);
function build() {
  const P = {}, T = {};
  for (const [k, [name, unit, nl, md, over = {}]] of Object.entries(BASE)) {
    const r = {};
    for (const [rk, R] of Object.entries(REGIONS)) r[rk] = over[rk] || (rk === 'nl' ? nl : rk === 'md' ? md : nl.map((v) => rnd(v * R.f)));
    P[k] = { name, unit, r };
  }
  for (const [k, [name, nl]] of Object.entries(TOOL_BASE)) {
    const r = {};
    for (const [rk, R] of Object.entries(REGIONS)) r[rk] = nl.map((v) => rnd(v * R.tf));
    T[k] = { name, r };
  }
  return { P, T };
}
const built = build();
export const PRICES = built.P;
export const TOOLS = built.T;
export const ROOF_COVERS = ['tigla_metalica', 'tigla_ceramica', 'tigla_beton'];
export const PRICE_INFO = { updated: '2026-11-24', source: 'built-in' };

// fișierul preturi.json: { updated, prices: { cheie: { țară: [min, max] } }, tools: { ... }, rates: { țară: curs } }
// înlocuiește doar ce conține, restul rămâne cum e mai sus
export function applyPriceFile(d) {
  if (!d || typeof d !== 'object') return false;
  const ok = (v) => Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && isFinite(x) && x >= 0) && v[0] <= v[1];
  for (const [src, dst] of [[d.prices, PRICES], [d.tools, TOOLS]]) {
    if (!src) continue;
    for (const [k, byReg] of Object.entries(src)) if (dst[k] && byReg) for (const [rk, v] of Object.entries(byReg)) if (REGIONS[rk] && ok(v)) dst[k].r[rk] = v;
  }
  if (d.rates) for (const [rk, v] of Object.entries(d.rates)) if (REGIONS[rk] && typeof v === 'number' && v > 0) REGIONS[rk].eur = v;
  if (typeof d.updated === 'string') { PRICE_INFO.updated = d.updated; PRICE_INFO.source = 'file'; }
  return true;
}
// datele curente, în forma fișierului preturi.json (folosit de unealta care scrie fișierul)
export function priceFileData() {
  const pick = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.r]));
  return { updated: PRICE_INFO.updated, rates: Object.fromEntries(Object.entries(REGIONS).filter(([, R]) => R.eur).map(([k, R]) => [k, R.eur])), prices: pick(PRICES), tools: pick(TOOLS) };
}

// q = rezultatul quantities() din editor; env = P.env; opt = { roofCover }
// întoarce [{ key, group, qty }]
export function costLines(q, env, opt) {
  const L = [], add = (group, key, qty) => { if (qty > 0.001) L.push({ group, key, qty }); };
  const S = env.structure, PT = env.partition;
  // structura
  if (S === 'caramida') add('Structură', 'caramida', Math.ceil(q.ext.vol * 400));
  else if (S === 'ceramic') add('Structură', 'ceramic', Math.ceil(q.ext.vol * 44));
  else if (S === 'sip') add('Structură', 'sip', q.ext.area);
  else add('Structură', S, q.ext.vol);
  if (PT === 'caramida12') add('Structură', 'caramida12', Math.ceil(q.int.vol * 400));
  else if (PT === 'gips') add('Structură', 'gips', q.int.area);
  else add('Structură', 'bca10', q.int.vol);
  const brickVol = (S === 'caramida' || S === 'ceramic' ? q.ext.vol : 0) + (PT === 'caramida12' ? q.int.vol : 0);
  const blockVol = (S === 'bca' ? q.ext.vol : 0) + (PT === 'bca10' ? q.int.vol : 0);
  add('Structură', 'mortar', Math.ceil(brickVol * 2.5 + blockVol * 1.2));
  add('Structură', 'fundatie', q.extGround * 0.4 * 0.9);
  add('Structură', 'planseu', q.slab * 0.18);
  // acoperiș
  if (q.roofArea) {
    if (env.roof === 'plat' || env.roof === 'plat_streasina') add('Acoperiș', 'hidro', q.roofArea * 1.1);
    else { add('Acoperiș', opt.roofCover, q.roofArea * 1.1); add('Acoperiș', 'sarpanta', q.roofArea * 0.035); }
    add('Acoperiș', 'izo_acoperis', q.roofArea);
  }
  add('Acoperiș', 'jgheab', q.gutter);
  add('Acoperiș', 'burlan', (q.downpipes || 0) * (q.pipeLen || 0));
  // anvelopă și tâmplărie
  add('Fațadă și tâmplărie', 'izo_fatada', q.ext.area);
  add('Fațadă și tâmplărie', 'ferestre', q.windows.area);
  add('Fațadă și tâmplărie', 'usi', q.doors);
  add('Fațadă și tâmplărie', 'glaf', q.windows.sills);
  // finisaje
  for (const [f, a] of Object.entries(q.floors)) add('Finisaje', f === 'beton' ? 'beton_slefuit' : f, a * 1.1);
  add('Finisaje', 'vopsea', Math.ceil(q.paint * 2 * 0.12));
  // grădină
  for (const [m, a] of Object.entries(q.paths)) add('Grădină', m === 'lemn' ? 'lemn_deck' : m, a * 1.05);
  for (const [z, a] of Object.entries(q.zones)) add('Grădină', { terasa: 'lemn_deck', pavaj: 'pavele' }[z] || z, a * 1.05);
  return L.filter((l) => PRICES[l.key]);
}
