---
name: run-cadru-studio
description: Run, test, screenshot or drive the Cadru Studio video app (index.html) headlessly - load every tab, generate a video from a script with auto images/music, export it, and upload to YouTube, all with the external APIs mocked. Use when asked to run, start, check, screenshot or verify a change in Cadru Studio.
---

# Run Cadru Studio

Cadru Studio is a single static page (`index.html`, no build step, no dependencies). This includes the canvas editor, MediaRecorder export, IndexedDB projects, Openverse auto images and music, and YouTube upload. The agent path is `driver.cjs`, which does the following:

- Serves the repo on a random local port.
- Drives the page with headless Chromium through the preinstalled Playwright.
- Mocks Openverse, Google sign-in and the YouTube upload API, so nothing real is called.
- Writes screenshots to `.claude/skills/run-cadru-studio/shots/`, which is gitignored.

All paths below are relative to the repo root.

## Prerequisites

Node and `require('playwright')` with its bundled Chromium. Both are already present in the cloud container, so there is nothing to install.

## Run (agent path)

```bash
node .claude/skills/run-cadru-studio/driver.cjs all
```

Flows: `smoke`, `create`, `export`, `publish`, `themes`, `all`. `themes` screenshots Montaj, Creează, Videoclipuri and Scenarii in every theme (`theme-<name>-<view>.png`).

- `smoke` loads all 8 tabs and takes a screenshot of each: `tab-<view>.png`.
- `create` does the following:
  - Types a script and clicks „Împarte în scene”.
  - Adds mocked music through „Adaugă ca muzică”.
  - Clicks „Generează video”, which fetches mocked images, then screenshots the timeline: `create-montaj.png`.
  - Prints the credits text.
- `export` runs `create`, then a real MediaRecorder export (it takes as long as the video, about 15 s) and takes `export-done.png` of the modal with the „Publică” section.
- `publish` fills a fake Client ID, picks a 2 MB fake file and runs the resumable upload against mocks, ending in `publish.png`. The note should read „Gata! … youtu.be/MOCKID”.

The driver exits 1 if the page threw any `pageerror`, so check the last line, `page errors: none`. Then look at the screenshots.

To extend it, add a flow block in `driver.cjs`. Select elements by id; the main ones are `#script`, `#btnToEditor`, `#btnExport`, `#mTitle`, `#ytGo` and `#ytNote`.

## Run (human path)

Open https://igorturcanu.github.io/cadru-studio/. GitHub Pages redeploys on every push to `main`. The same page also lives as a claude.ai artifact. Its source is this file's fragment between `<title>Cadru Studio</title>` and `</body>`, republished by hand.

## Gotchas

- **Serve over http, never `setContent`/`file://`.** IndexedDB (Proiecte) throws on about:blank.
- **`index.html` is UTF-8 Romanian.** A server without `charset=utf-8` shows mojibake („miÈ™cÄƒ”). The driver sets it.
- **`page.evaluate` can't see the app state.** `const S` is a top-level lexical binding, and even `addScriptTag('window.__S=S')` fails to expose it. Assert through the DOM instead: `#creditsOut`, `#sumNote`, `#mText`, timeline text.
- **Mocked image or audio bodies must be over 2 KB.** `ovBlob()` drops smaller blobs as broken. Mocks also need CORS headers. The YouTube mock must also expose `Location`, or the upload never starts.
- **`#btnToEditor` is async.** It waits for image fetches (3.2 s spacing between Openverse queries). Wait for `location.hash === '#montaj'`, not a fixed sleep.
- **The export is real time.** MediaRecorder records playback. Long-export logic (over 25 min) uses the constants `LONG`/`PART` (`25*60`/`20*60`). To test it, serve a copy with `const LONG = 5, PART = 4;`.
  - The parts mode then downloads `cadru-video-partea-0N.webm`.
  - Disk mode needs `showSaveFilePicker` mocked with an object whose `createWritable()` returns `{write, close, abort}`.
- **Feature availability depends on context.** In the artifact iframe, fetch, the file picker and Google sign-in are blocked by design. On Pages, `window.claude` is absent, so Scenarii and AI Personal are disabled. The driver tests the Pages context.
- **The sandbox can't reach real external services.** api.openverse.org and the googleapis upload host aren't reachable from the cloud container (curl gets `000`), so only mocked behaviour is verifiable here.

## Troubleshooting

- `ERR_CONNECTION_REFUSED` on a fixed port happened with an old `python -m http.server` that had died. The driver now uses its own server on port 0.
- `ReferenceError: S is not defined` from `page.evaluate` is not a page bug. See the Gotchas above.
