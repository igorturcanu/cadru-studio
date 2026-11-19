# Planora 3D

Sait de prezentare + editor web pentru randări 3D de case, construit după modelul paginii de randare 3D a Cedreo (aceleași secțiuni și funcții principale), cu nume, texte și imagini proprii.

- **Pagina de prezentare:** `randare-3d/index.html`
- **Editorul:** `randare-3d/editor.html` (șabloane: `editor.html?sablon=apartament`, `?sablon=casa`, `?sablon=gol`)
- Pe GitHub Pages: https://igorturcanu.github.io/cadru-studio/randare-3d/

## Ce merge de-adevăratelea

- **Plan 2D:** camere trase ca dreptunghi, pereți colț cu colț, uși și ferestre, cote, suprafețe, mutarea colțurilor, unealtă de măsurat, export PNG.
- **3D în timp real** (three.js): pereți cu goluri, pardoseli cu texturi, peste 35 de obiecte (mobilier, lumini, baie, bucătărie, exterior), selectare în 3D, pereți tăiați, tavan automat în interior, camere: perspectivă, de sus, interior, exterior.
- **Lumină:** ora zilei și orientarea nord mută soarele și umbrele; seara se aprind lămpile, noaptea e lumina lunii.
- **Randare foto:** HD / Full HD / 4K, formate 16:9, 4:3, 1:1, 4:5; 8–64 de treceri cu umbre moi și antialiasing (media mai multor cadre).
- **Vedere 360°:** panoramă echirectangulară 4096×2048 din poziția camerei, cu vizualizator în pagină.
- **Pereți și materiale:** grosimea fiecărui perete (butoane rapide 10–40 cm), finisaje pe perete, pe cameră sau pe toată casa (vopsea în orice culoare, faianță, cărămidă aparentă, piatră, lambriu, beton aparent).
- **Structura casei:** cărămidă plină, blocuri ceramice, BCA, beton armat, structură din lemn, panouri SIP; pereți interiori din BCA, gips-carton sau cărămidă. Grosimile se aplică pe plan, iar tabelul de cantități estimează cărămizi/blocuri, volumul de zidărie, vopseaua, pardoselile și suprafața acoperișului.
- **Bucătărie:** corp de bucătărie, insulă, coloană cuptor, corp suspendat, hotă; culori separate pentru fronturi și blat, 8 palete aplicabile pe toată bucătăria.
- **Unelte noi:** ușă dublă, ușă glisantă, ușă de balcon, cote fixe pe plan, etichete text, scară, șemineu, calorifer.
- **Acoperiș:** în două ape, în patru ape sau terasă, cu țiglă în mai multe culori.
- **Calitate înaltă:** umbre de contact (ambient occlusion GTAO) în vederea live și în randare, lumină de mediu, tavan luminat în interior.
- **Limbi:** română, engleză, rusă, franceză, germană (selector în antet, sau `?lang=en` / `ru` / `fr` / `de`). Textele sunt în `js/i18n-dict.js`.
- **Proiectele mele:** mai multe proiecte salvate în browser, cu miniatură, deschidere, dublare și ștergere; un șablon deschis devine proiect nou și nu-l înlocuiește pe cel curent.
- **Fișă client:** o pagină cu randarea 3D, planul, camerele și cantitățile de materiale, cu câmpuri pentru client și observații; se tipărește sau se salvează ca PDF.
- **Proiecte:** salvare automată în browser, anulare/refacere, export/import `.json`, galerie „Randările mele” (IndexedDB).

## Ce e simulat sau lipsește față de Cedreo

- Randarea nu e fotorealistă cu ray tracing în cloud: e o randare WebGL în browser, îmbunătățită prin acumulare de cadre.
- Mobilierul e modelat din forme simple, nu un catalog de mii de modele 3D.
- Fără conturi, plăți sau proiecte în cloud: prețurile de pe pagină sunt orientative și butoanele duc în editor.
- Un singur nivel (scara e decorativă); fără import din CAD sau din imagini.
- Cantitățile de materiale sunt estimări fără pierderi și fără fundație.

## Viteză

Măsurat cu Chromium pe o conexiune 4G lentă simulată (1,6 Mbit/s, 150 ms latență), cu fișiere comprimate gzip ca pe GitHub Pages:

| | înainte | acum |
|---|---|---|
| Pagina de prezentare pe mobil (încărcare completă) | 2,2 s, 382 KB | 0,5 s, 45 KB |
| Pagina de prezentare pe desktop | 3,7 s, 659 KB | 0,8 s, 99 KB |
| Editorul (încărcare completă) | 2,5 s, 20 de cereri | 2,0 s, 7 cereri |
| Vederea 3D în repaus, 5 secunde | ~300 de cadre | 2 cadre |

Ce s-a schimbat: imagini WebP în două mărimi (800 px și 1600 px), fiecare limbă într-un fișier separat (`js/lang/xx.js`, generat cu `node randare-3d/tools/lang-build.js` din `js/i18n-dict.js`), modulele pentru umbrele de contact se descarcă doar când e nevoie de ele, iar vederea 3D se desenează doar când se schimbă ceva.

## Imaginile din galerie

Toate imaginile din `galerie/` sunt generate cu editorul (`window.planora.renderPhoto`). Pagina folosește versiunile `.webp`; fișierele `.jpg` rămân ca sursă. Motorul 3D, three.js r160, e inclus în `vendor/` (licență MIT).
