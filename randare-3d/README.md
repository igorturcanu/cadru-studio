# Planora 3D

Sait de prezentare + editor web pentru randări 3D de case, construit după modelul paginii de randare 3D a Cedreo (aceleași secțiuni și funcții principale), cu nume, texte și imagini proprii.

- **Pagina de prezentare:** `randare-3d/index.html`
- **Editorul:** `randare-3d/editor.html` (șabloane: `editor.html?sablon=apartament`, `?sablon=casa`, `?sablon=gol`)
- Pe GitHub Pages: https://igorturcanu.github.io/cadru-studio/randare-3d/

## Ce merge de-adevăratelea

- **Plan 2D:** camere trase ca dreptunghi, pereți colț cu colț, uși și ferestre, cote, suprafețe, mutarea colțurilor, unealtă de măsurat, export PNG.
- **3D în timp real** (three.js): pereți cu goluri, pardoseli cu texturi, 26 de obiecte (mobilier, lumini, baie, bucătărie, exterior), selectare în 3D, pereți tăiați, tavan automat în interior, camere: perspectivă, de sus, interior, exterior.
- **Lumină:** ora zilei și orientarea nord mută soarele și umbrele; seara se aprind lămpile, noaptea e lumina lunii.
- **Randare foto:** HD / Full HD / 4K, formate 16:9, 4:3, 1:1, 4:5; 8–64 de treceri cu umbre moi și antialiasing (media mai multor cadre).
- **Vedere 360°:** panoramă echirectangulară 4096×2048 din poziția camerei, cu vizualizator în pagină.
- **Proiecte:** salvare automată în browser, anulare/refacere, export/import `.json`, galerie „Randările mele” (IndexedDB).

## Ce e simulat sau lipsește față de Cedreo

- Randarea nu e fotorealistă cu ray tracing în cloud: e o randare WebGL în browser, îmbunătățită prin acumulare de cadre.
- Mobilierul e modelat din forme simple, nu un catalog de mii de modele 3D.
- Fără conturi, plăți sau proiecte în cloud: prețurile de pe pagină sunt orientative și butoanele duc în editor.
- Fără acoperișuri, scări sau mai multe niveluri; fără import din CAD sau din imagini.

## Imaginile din galerie

Toate imaginile din `galerie/` sunt generate cu editorul (`window.planora.renderPhoto`). Motorul 3D, three.js r160, e inclus în `vendor/` (licență MIT).
