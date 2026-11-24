# Cadru Studio

Studio video în română care merge direct în browser. Faci video-uri pentru canale YouTube fără prezentator.

**Adresa:** https://igorturcanu.github.io/cadru-studio/

## Ce face

- **Creează:** scenariu → voce → fundal → opțiuni, apoi „Generează video” construiește montajul scenă cu scenă.
- **Montaj:** încarci, lipești sau imporți din link filme, poze și audio. Le pui pe timeline, le tai și adaugi text (subtitrare, titlu, karaoke), filtre, zoom, voce și muzică. Exporți video WebM sau MP4.
- **Video AI 4K:** clipuri generate cu Gemini Omni Flash, Kling 3.0, Seedance 2.5, Veo 3.1 sau Grok Imagine 1.5, crescute la 4K.
- **Export 4K:** Montajul exportă la 720p, 1080p sau 4K (3840×2160).
- **Miniaturi:** editor de thumbnail 1280×720, salvat ca PNG.
- **Proiecte:** se salvează în browser (IndexedDB), cu tot cu fișiere.
- **Ghid:** fiecare buton explicat.

Totul rulează local, în browser. Fișierele nu pleacă de pe dispozitiv.

## Claude vizionează video de pe YouTube (/watch)

În `.claude/skills/watch/` e skill-ul `/watch` (din [bradautomates/claude-video](https://github.com/bradautomates/claude-video), MIT). În Claude Code, în acest repo, scrii `/watch <link YouTube> <întrebarea ta>` și Claude „vizionează” videoul: cadre + transcript, sau Gemini dacă pui o cheie gratuită. Detalii în [`.claude/skills/watch/SURSA.md`](.claude/skills/watch/SURSA.md).

## AI pe site-ul tău (cheia Groq)

În tabul **Scenarii → 🔑 Cheia ta AI (Groq)** pui cheia ta Groq (`gsk_…`) și alegi modelul. Apoi „Scrie scenariul”, „5 idei de titlu” și „Împarte cu AI” merg direct pe GitHub Pages, fără claude.ai. Cheia se păstrează doar în browserul tău (localStorage) și se trimite doar la `api.groq.com`. Nu o pune niciodată în cod sau în repo.

În claude.ai, aceleași butoane folosesc Claude. Bifa „Folosește Groq și în claude.ai” forțează Groq și acolo.

## Video AI 4K (Gemini Omni Flash, Kling 3.0, Seedance 2.5, Veo 3.1, Grok Imagine)

Fila **Video AI 4K** generează clipuri AI și le pune direct în Materiale. Toate modelele merg prin [fal.ai](https://fal.ai), cu cheia ta (păstrată doar în browser, trimisă doar la `queue.fal.run`).

| Model | Endpoint fal.ai | Ce iese |
|---|---|---|
| Gemini Omni Flash 1.2 | `google/gemini-omni-flash/v1.2/text-to-video`, `google/gemini-omni-flash/image-to-video` | 360p–4K, 3–15 s, sunet |
| Kling 3.0 Pro | `fal-ai/kling-video/v3/pro/text-to-video`, `.../image-to-video` | 1080p, sunet |
| Kling 3.0 4K | `fal-ai/kling-video/v3/4k/text-to-video`, `.../image-to-video` | 4K nativ (~$0.42/s) |
| Seedance 2.5 | `bytedance/seedance-2.5/text-to-video`, `.../image-to-video` | 480p/720p, până la 30 s, sunet |
| Seedance 2.5 Flash | `bytedance/seedance-2.5/flash/text-to-video` | 480p/720p, ieftin |
| Veo 3.1 | `fal-ai/veo3.1`, `fal-ai/veo3.1/image-to-video` | 720p–4K, până la 8 s |
| Grok Imagine 1.5 (xAI) | `xai/grok-imagine-video/v1.5/text-to-video`, `.../v1.5/image-to-video` | 480p–1080p, până la 15 s, cu sunet |

- **Costă bani:** generarea (per secundă, plătită la fal.ai) și „4K cu AI” (`fal-ai/bytedance-upscaler/upscale/video`, `target_resolution: 4k`).
- **Gratuit:** „4K local” (redesenare la 3840×2160 în browser), exportul din Montaj la 4K (selectorul „Export 4K” din antet) și „Fă promptul mai bun” cu cheia Groq.
- Opțiunile (durată, format, rezoluție) se citesc live din schema modelului pe fal.ai când browserul o poate încărca; altfel se folosesc valorile de mai sus. În „Avansat” poți schimba endpointul și adăuga parametri JSON.
- **▶ Totul automat:** din câteva fraze face scenele, clipurile, muzica gratuită, titlul și descrierea, le pune pe timeline și pornește exportul 4K. Durata poate fi „doar scenele”, 10 minute, 1 oră sau 3 ore (clipurile se repetă în buclă).
- **Local, gratuit: ComfyUI** (de ex. MiniMax H3 sau Wan pe placa ta video ori pe un server GPU închiriat). Pornești ComfyUI cu `--enable-cors-header`, pui `{{PROMPT}}` în promptul pozitiv, exporți workflow-ul cu Workflow → Export (API) și îl încarci în filă. Cadru trimite scenele la `/prompt`, așteaptă în `/history` și ia video-ul din `/view`.
- **Video de 3 ore în 4K, rapid:** `python3 tools/ai_video_4k.py loop a.mp4 b.mp4 … --music muzica.mp3 --hours 3` repetă clipurile și muzica fără re-encodare, deci durează minute, nu ore. Exportul din browser merge în timp real (3 ore durează 3 ore).
- **Regizor AI (gratuit cu Groq):** scrii câteva fraze, primești 3–10 scene cu prompt complet și mișcare de cameră. Le generezi aici sau copiezi prompturile în site-uri cu credite gratuite (ex. Digen AI, care nu are API) și încarci clipurile înapoi.
- Pe calculator: `tools/ai_video_4k.py` (`gen`, `upscale`, `join`), cu `FAL_KEY` în mediu.

## Muzică (generator de muzică instrumentală)

Fila **Muzică** (și separat la `/muzica/`) compune muzică direct în browser, fără cont și fără cheie:

- 119 stiluri (relaxare, somn, meditație, lo-fi, pian, cinematic, jazz, electronic, world, inclusiv doină și horă, copii, sărbători, gaming, natură pură).
- 62 de instrumente pe 6 piste (acorduri, melodie, bas, pad, ornamente, tobe) și 9 seturi de tobe; tempo, tonalitate, 15 scări, energie, volum pe pistă, reverb, fade.
- 17 sunete de natură (ploaie, ocean, foc, păsări…) și frecvențe 174–963 Hz plus binaurale.
- De la 30 de secunde la 3 ore. „＋ În video (Cadru)” pune melodia în Materiale ca muzică de fundal; „Descarcă” dă WAV, MP4 (AAC) sau WebM (Opus).
- Limite: fără voce și versuri; sunetul e sintetizat, potrivit pentru ambient, pian, lo-fi, meditație. Pentru voce, secțiunea „Prompt pentru AI” scrie descrierea pentru Suno sau AI Personal.

Mostre de un minut în `muzica/mostre/`.

## AI Personal: ce merge unde

- **Pe orice site (gratuit):** căutare poze și muzică cu licență liberă (Openverse) și imagini AI rapide (Pollinations), cu buton „＋ În Materiale”.
- **Doar în claude.ai, cu conectorul AI Personal:** imagini 8K și melodii generate (costă bani).

## Planora 3D (randări 3D pentru case)

În folderul `randare-3d/` e un sait separat: pagină de prezentare și editor de plan 2D/3D cu randări foto și vederi 360°. Detalii în [randare-3d/README.md](randare-3d/README.md).

## Pași următori

- Server mic pentru import din linkuri care nu permit descărcarea directă
- Voce AI și imagini de stoc puse automat pe scene
- Conturi și proiecte sincronizate între dispozitive

Un singur fișier: `index.html`, fără build.
