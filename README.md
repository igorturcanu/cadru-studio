# Cadru Studio

Studio video în română care merge direct în browser. Faci video-uri pentru canale YouTube fără prezentator.

**Adresa:** https://igorturcanu.github.io/cadru-studio/

## Ce face

- **Creează:** scenariu → voce → fundal → opțiuni, apoi „Generează video” construiește montajul scenă cu scenă.
- **Montaj:** încarci, lipești sau imporți din link filme, poze și audio. Le pui pe timeline, le tai și adaugi text (subtitrare, titlu, karaoke), filtre, zoom, voce și muzică. Exporți video WebM sau MP4.
- **Miniaturi:** editor de thumbnail 1280×720, salvat ca PNG.
- **Proiecte:** se salvează în browser (IndexedDB), cu tot cu fișiere.
- **Ghid:** fiecare buton explicat.

Totul rulează local, în browser. Fișierele nu pleacă de pe dispozitiv.

## AI pe site-ul tău (cheia Groq)

În tabul **Scenarii → 🔑 Cheia ta AI (Groq)** pui cheia ta Groq (`gsk_…`) și alegi modelul. Apoi „Scrie scenariul”, „5 idei de titlu” și „Împarte cu AI” merg direct pe GitHub Pages, fără claude.ai. Cheia se păstrează doar în browserul tău (localStorage) și se trimite doar la `api.groq.com`. Nu o pune niciodată în cod sau în repo.

În claude.ai, aceleași butoane folosesc Claude. Bifa „Folosește Groq și în claude.ai” forțează Groq și acolo.

## AI Personal: ce merge unde

- **Pe orice site (gratuit):** căutare poze și muzică cu licență liberă (Openverse) și imagini AI rapide (Pollinations), cu buton „＋ În Materiale”.
- **Doar în claude.ai, cu conectorul AI Personal:** imagini 8K și melodii generate (costă bani).

## Pași următori

- Server mic pentru import din linkuri care nu permit descărcarea directă
- Voce AI și imagini de stoc puse automat pe scene
- Conturi și proiecte sincronizate între dispozitive

Un singur fișier: `index.html`, fără build.
