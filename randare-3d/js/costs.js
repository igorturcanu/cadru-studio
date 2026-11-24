// Calculatorul de costuri: transformă cantitățile din proiect în lista de cumpărături, cu prețuri orientative.
// Prețurile sunt intervale aproximative (minim–maxim) pentru materiale, fără manoperă, adunate în noiembrie 2026
// din oferte publice ale magazinelor de materiale. Nu sunt prețuri fixe: utilizatorul le poate schimba în tabel.

export const REGIONS = {
  nl: {
    name: 'Olanda', cur: '€', dec: 2, labour: 1.0,
    note: 'Prețuri cu TVA (BTW 21%), magazine de bricolaj și depozite de materiale.',
    shops: [
      ['Gamma', 'https://www.gamma.nl'], ['Karwei', 'https://www.karwei.nl'], ['Praxis', 'https://www.praxis.nl'],
      ['Hornbach', 'https://www.hornbach.nl'], ['Bouwmaat', 'https://www.bouwmaat.nl'], ['BouwCenter', 'https://www.bouwcenter.nl'],
      ['Sleiderink', 'https://www.sleiderink.nl'],
    ],
  },
  md: {
    name: 'Republica Moldova', cur: 'lei', dec: 0, labour: 0.6, eur: 19.8,
    note: 'Prețuri în lei, cu TVA, din magazine și depozite din Chișinău.',
    shops: [
      ['Supraten', 'https://www.supraten.md'], ['Baza Caliga', 'https://www.bazacaliga.md'], ['Stroimarket', 'https://stroimarket.md'],
      ['DocConstruct', 'https://docconstruct.md'], ['RoofLand', 'https://roofland.md'], ['Imperlux', 'https://imperlux.md'],
    ],
  },
};

// [nume, unitate, [min, max] Olanda (€), [min, max] Moldova (lei)]
export const PRICES = {
  caramida: ['Cărămidă plină', 'buc', [0.35, 0.75], [6, 12]],
  ceramic: ['Bloc ceramic 38 cm', 'buc', [2.5, 4.2], [28, 42]],
  bca: ['BCA (beton celular)', 'm³', [120, 175], [2300, 3300]],
  beton: ['Beton C25/30 (livrat)', 'm³', [140, 195], [1500, 2100]],
  lemn: ['Lemn de construcție', 'm³', [550, 850], [5500, 7500]],
  sip: ['Panouri SIP', 'm²', [45, 75], [600, 950]],
  bca10: ['BCA 10 cm (pereți interiori)', 'm³', [120, 175], [2300, 3300]],
  gips: ['Gips-carton cu profile', 'm²', [5, 9], [70, 110]],
  caramida12: ['Cărămidă (pereți interiori)', 'buc', [0.35, 0.75], [6, 12]],
  mortar: ['Mortar / adeziv, sac 25 kg', 'saci', [6, 11], [90, 140]],
  fundatie: ['Beton pentru fundație (estimare)', 'm³', [140, 195], [1500, 2100]],
  planseu: ['Beton pentru planșeu', 'm³', [140, 195], [1500, 2100]],
  tigla_metalica: ['Țiglă metalică', 'm²', [12, 22], [140, 245]],
  tigla_ceramica: ['Țiglă ceramică', 'm²', [35, 65], [350, 550]],
  tigla_beton: ['Țiglă din beton', 'm²', [26, 36], [250, 350]],
  hidro: ['Membrană bituminoasă (terasă)', 'm²', [12, 25], [120, 250]],
  sarpanta: ['Lemn pentru șarpantă', 'm³', [550, 850], [5500, 7500]],
  izo_acoperis: ['Vată minerală 20 cm (acoperiș)', 'm²', [12, 20], [120, 200]],
  izo_fatada: ['Termoizolație fațadă 10 cm (polistiren)', 'm²', [15, 26], [150, 260]],
  ferestre: ['Ferestre PVC cu geam termopan', 'm²', [250, 450], [1800, 3000]],
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
export const ROOF_COVERS = ['tigla_metalica', 'tigla_ceramica', 'tigla_beton'];

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
    if (env.roof === 'plat') add('Acoperiș', 'hidro', q.roofArea * 1.1);
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
