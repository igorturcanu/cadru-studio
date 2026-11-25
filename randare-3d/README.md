# Planora 3D

Sait de prezentare + editor web pentru randări 3D de case, construit după modelul paginii de randare 3D a Cedreo (aceleași secțiuni și funcții principale), cu nume, texte și imagini proprii.

- **Pagina de prezentare:** `randare-3d/index.html`
- **Editorul:** `randare-3d/editor.html` (șabloane: `editor.html?sablon=apartament`, `?sablon=casa`, `?sablon=gol`)
- Pe GitHub Pages: https://igorturcanu.github.io/cadru-studio/randare-3d/

## Ce merge de-adevăratelea

- **Plan 2D:** camere trase ca dreptunghi, pereți colț cu colț, uși și ferestre, cote, suprafețe, mutarea colțurilor, unealtă de măsurat, export PNG.
- **3D în timp real** (three.js): pereți cu goluri, pardoseli cu texturi, peste 60 de obiecte (mobilier, lumini, baie, bucătărie, exterior), selectare în 3D, pereți tăiați, tavan automat în interior, camere: perspectivă, de sus, interior, exterior.
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
- **Niveluri:** parter și oricâte etaje; „Adaugă nivel deasupra” copiază pereții, ferestrele și camerele de dedesubt. Planul arată estompat nivelul de jos, iar „Toate nivelurile” arată casa întreagă.
- **Mod persoană:** vederile Interior, Exterior și Grădină te pun la înălțimea ochilor; te rotești 360° pe loc, mergi cu rotița, W/A/S/D sau săgețile (pe telefon cu butoanele ▲▼), dublu-clic pe podea ca să ajungi acolo. Pereții te opresc, ușile te lasă să treci. Modificările din proiect nu mută camera.
- **Scări:** dreaptă, în L, în U, în spirală, cu trepte în consolă și scară de pod; urcă singure până la nivelul de deasupra și fac gol în planșeu.
- **Scurgerea apei:** glafuri exterioare cu lăcrimar (aluminiu, piatră, tablă), pervaz interior, culoarea tâmplăriei, jgheaburi și burlane în 5 culori.
- **Grădină:** unelte pentru alei (6 materiale) și zone (gazon, flori, pietriș, terasă, pavaj, iaz), plus copaci, brad, pom fructifer, gard viu, gard, bancă, pergolă și iluminat de grădină care se aprinde seara.
- **Calculator de costuri:** cantitățile din proiect (toate nivelurile) se transformă în listă de cumpărături cu prețuri orientative pentru 7 țări: Republica Moldova, România, Olanda, Germania, Franța, Marea Britanie și Rusia (țara implicită urmează limba paginii), cu interval minim–maxim, prețuri proprii salvate, manoperă estimată, 16 unelte de construcție cu bifă, lista magazinelor și tipărire PDF.
- **Prețuri actualizate:** pagina citește `preturi.json` la fiecare deschidere, deci prețurile noi apar fără o versiune nouă a codului. Fișierul se regenerează cu `node randare-3d/tools/preturi-export.mjs AAAA-LL-ZZ`, iar o sarcină programată săptămânală verifică prețurile și propune actualizarea printr-un pull request.
- **Modele de case:** galerie cu imagini: vilă cu hol dublu înalt (scară imperială, scară rulantă, lift, candelabru, garaj dublu, piscină, fântână), casă modernă cu acoperiș plat, bloc de locuințe P+3 cu 8 apartamente, duplex, casă mică, plus modelele vechi (`?sablon=vila`, `casa_moderna`, `bloc`, `duplex`, `casa_mica`).
- **Porți, garduri și lumini:** poartă pietonală, poartă auto culisantă, gard metalic, gard din zidărie, stâlp cu lampă, aplice, spoturi încastrate, candelabru, balcon în consolă, balustradă din sticlă, coloane.
- **Pereți dintr-un clic:** clic pe perete și scrii lungimea, grosimea și înălțimea; butoane pentru fereastră, ușă, ușă dublă, glisantă și de balcon, puse automat în primul loc liber; dublu-clic pe un perete deschide direct mărimile.
- **Ieși afară / Intră în casă:** în modul persoană un buton te scoate prin cea mai apropiată ușă exterioară sau te bagă înapoi în casă.
- **Case parter moderne:** 4 modele noi, originale: casă parter cu streașină lată, casă în L cu curte interioară și piscină, casă cu acoperiș jos în patru ape, casă cu garaj închis (`?sablon=parter_modern`, `parter_l`, `parter_4ape`, `parter_garaj`).
- **Natură mai reală:** iarbă 3D cu fire (sute de mii de smocuri, desenate dintr-o singură dată), cer cu nori și soare, pădure la orizont cu ceață, copaci cu frunziș texturat (foios, brad cu ramuri zimțate, mesteacăn, tuia), iarbă decorativă cu spice, lavandă, bolovani, piscină cu mozaic și apă care reflectă cerul.
- **Fațade:** acoperiș plat cu streașină lată, lambriu de lemn dedesubt și bandă LED care se aprinde seara; acoperiș jos în patru ape cu streașină de 95 cm; perete de sticlă (3,6 m), ușă de garaj secțională; sticla reflectă cerul; finisaj de fațadă (lemn, piatră, cărămidă) doar pe partea de afară a peretelui.
- **Decor interior:** draperii, plantă mare (ficus), vază cu flori, cărți, oglindă rotundă; în modelele noi camerele sunt mobilate complet.
- **Video tur:** butonul 🎬 înregistrează un clip (20–60 s, 720p, 1080p sau 9:16): camera zboară în jurul casei, se apropie de ușă, intră și se uită de jur împrejur. Se descarcă ca .mp4 sau .webm.
- **Ferestre și uși cu formă:** fereastră rotundă, arcuită, înclinată, triunghiulară, panoramică (fără montant), cu grilaj și cu obloane; ușă pivot din lemn, ușă cu sticlă, ușă clasică cu panouri, ușă arcuită. Zidăria se închide în jurul formei, cu ramă și sticlă pe contur.
- **Acoperișuri moderne:** într-o apă (pantă de 10° cu pereții ridicați sub ea), în două ape fără streașină; învelitoare din țiglă, tablă fălțuită sau șindrilă bituminoasă.
- **Decor de fațadă:** soclu din piatră, ancadramente albe la ferestre, brâu sub streașină, streșini din lemn cu LED între etaje (fiecare cu bifă), copertină de sticlă peste ușă, lamele verticale din lemn, jardiniere, trepte de intrare, număr de casă luminos, ușă de garaj din lemn.
- **Birou de lucru:** bibliotecă cu dulapuri și cărți, birou cu sertare, monitor și lampă, scaun ergonomic, colț de lectură.
- **Bucătărie și scară cu LED:** bandă LED sub corpurile suspendate și la plintă, insulă cu lamele de lemn pe spate, scară cu trepte în consolă luminată sub fiecare treaptă.
- **Grădină:** alee din dale prin iarbă, vatră de foc, canapea de exterior în L, spoturi încastrate în sol.
- **Modele noi (runda 5):** casă modernă cu etaj și streșini din lemn, casă cu acoperiș din tablă, casă cu acoperiș într-o apă, vilă clasică cu ferestre arcuite (`?sablon=etaj_modern`, `casa_tabla`, `casa_o_apa`, `vila_clasica`); casa cu grădină și casa mică au acum soclu de piatră, obloane și uși clasice.
- **Proiectele mele:** mai multe proiecte salvate în browser, cu miniatură, deschidere, dublare și ștergere; un șablon deschis devine proiect nou și nu-l înlocuiește pe cel curent.
- **Fișă client:** o pagină cu randarea 3D, planul, camerele și cantitățile de materiale, cu câmpuri pentru client și observații; se tipărește sau se salvează ca PDF.
- **Planșă de prezentare:** din fișa client, butonul „Descarcă planșa de prezentare” compune o singură imagine: casa văzută din față, dinspre intrare (camera trece de gard dacă e nevoie), apoi fiecare nivel randat de sus, mobilat și fără tavan, cu numele camerelor, suprafețele și cotele generale, plus lista camerelor.
- **Curte de lux (runda 6):** perete cu cascadă și bazin, pergolă de aluminiu cu lamele și LED, gard din lamele de lemn cu aplice și iederă, zid de grădină cu LED care spală zidul, zid cu nișe rotunde luminate, iaz cu nuferi, balansoar ou, felinare din ratan (pe jos și suspendate), pietre rotunde de călcat, bordură din pietriș alb, bandă LED pe marginea aleii, palmier, șezlong. Model nou: casă parter cu curte de lux luminată (`?sablon=curte_lux`).
- **Porți în gard:** golurile pentru porți se calculează acum după poziția porții, așa că poarta nu se mai suprapune cu gardul.
- **Proiecte:** salvare automată în browser, anulare/refacere, export/import `.json`, galerie „Randările mele” (IndexedDB).

## Ce e simulat sau lipsește față de Cedreo

- Randarea nu e fotorealistă cu ray tracing în cloud: e o randare WebGL în browser, îmbunătățită prin acumulare de cadre.
- Mobilierul e modelat din forme simple, nu un catalog de mii de modele 3D.
- Fără conturi, plăți sau proiecte în cloud: prețurile de pe pagină sunt orientative și butoanele duc în editor.
- Fără import din CAD sau din imagini; pe scări nu se urcă efectiv în modul persoană (se schimbă nivelul cu butoanele).
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
