# Skill-ul /watch (vizionează video)

Copiat din https://github.com/bradautomates/claude-video (licență MIT, commit 03ceb42, v0.3.2),
proiectul arătat în Short-ul https://youtube.com/shorts/ShvJkccNpQ8.

Doar `SKILL.md` și `scripts/` (fără hook-ul de pornire și fără scriptul de build).

## Cum îl folosești în Claude Code (în acest repo)

1. Deschizi Claude Code în folderul `cadru-studio` (pe calculator sau pe claude.ai/code).
2. Scrii: `/watch https://youtube.com/... ce se explică în video?`
3. Prima dată, skill-ul verifică ce lipsește (`yt-dlp`, `ffmpeg`) și te întreabă cum să vizioneze:
   - **gemini** (recomandat): Gemini vizionează tot videoul, ai nevoie de o cheie gratuită de la https://aistudio.google.com/apikey
   - **local**: scoate cadre + subtitrare pe calculatorul tău, fără cheie.
4. Apoi poți cere: „Vizionează, învață ce predă și fă-mi un skill pe care să-l folosesc mereu”.

Nu merge în chatul obișnuit claude.ai, doar în Claude Code.
Cheile se păstrează în `~/.config/watch/.env`, niciodată în repo.
