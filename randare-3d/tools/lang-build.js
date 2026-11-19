// Împarte dicționarul js/i18n-dict.js într-un fișier mic pentru fiecare limbă (js/lang/xx.js),
// ca browserul să descarce doar limba aleasă. Rulează după ce modifici traducerile:
//   node randare-3d/tools/lang-build.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.window = {};
require(path.join(root, 'js/i18n-dict.js'));
for (const [lang, dict] of Object.entries(window.PLANORA_DICT)) {
  const out = `// Generat automat din js/i18n-dict.js de tools/lang-build.js. Nu edita aici.\n(window.PLANORA_DICT = window.PLANORA_DICT || {}).${lang} = ${JSON.stringify(dict)};\n`;
  fs.writeFileSync(path.join(root, 'js/lang', lang + '.js'), out);
  console.log(lang, Object.keys(dict).length, 'texte,', Math.round(out.length / 1024), 'KB');
}
