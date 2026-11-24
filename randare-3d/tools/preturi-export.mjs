// Scrie preturi.json din prețurile de bază din js/costs.js.
// Folosire: node randare-3d/tools/preturi-export.mjs [data, de ex. 2026-11-24]
// Actualizarea periodică modifică direct preturi.json (doar valorile care s-au schimbat) și data din „updated”.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const { priceFileData, applyPriceFile } = await import(join(here, '../js/costs.js'));
const out = join(here, '../preturi.json');
// păstrează valorile deja actualizate din fișier
if (existsSync(out)) applyPriceFile(JSON.parse(readFileSync(out, 'utf8')));
const d = priceFileData();
if (process.argv[2]) d.updated = process.argv[2];
d.note = 'Intervale de preț [minim, maxim] cu TVA, pe țări: md (lei MD), ro (RON), nl/de/fr (€), uk (£), ru (₽). rates = cât face 1 € în moneda locală.';
writeFileSync(out, JSON.stringify(d, null, 1).replace(/\[\s+([\d.]+),\s+([\d.]+)\s+\]/g, '[$1, $2]') + '\n');
console.log('scris', out, Object.keys(d.prices).length, 'materiale,', Object.keys(d.tools).length, 'unelte');
