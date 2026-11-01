#!/usr/bin/env python3
"""
make_video.py - video relaxant lung (implicit 3 ore): imagini + muzică generate cu Gemini,
montate cu ffmpeg.

Pași (se pot rula separat sau toți odată):
  python3 make_video.py images     # generează imaginile de natură
  python3 make_video.py music      # generează piesele de pian (sau folosește --music-dir)
  python3 make_video.py build      # montează videoclipul final
  python3 make_video.py all        # toți pașii

Cerințe (Linux):
  sudo apt install ffmpeg
  pip install google-genai
  export GEMINI_API_KEY="cheia_ta"

Ideea de montaj: se randează UN SINGUR ciclu (ex. 16 min) de imagini cu zoom lent și
dizolvare, iar ciclul se repetă fără cusătură până la 3 ore. La fel și muzica.
Așa randarea durează minute, nu ore.
"""
import argparse
import asyncio
import base64
import os
import random
import shutil
import subprocess
import sys
import wave
from pathlib import Path

# ----------------------------------------------------------------------------
# SETĂRI - modifică aici
# ----------------------------------------------------------------------------
IMAGE_MODEL = "gemini-2.5-flash-image"          # verifică numele în documentația Gemini
MUSIC_MODEL = "models/lyria-realtime-exp"       # experimental - verifică în documentație

STYLE = (
    "photorealistic, ultra detailed, vivid natural colors, soft golden daylight, "
    "serene and peaceful atmosphere, bright and colorful, no people, no text, "
    "no watermark, 16:9 landscape"
)

SCENES = [
    "a misty rainforest with a gentle waterfall and ferns, small colorful birds on branches",
    "a calm turquoise lake surrounded by green mountains at sunrise, reflections on the water",
    "a sunlit meadow full of wildflowers with butterflies and a soft blue sky",
    "a quiet forest path with sunbeams through tall green trees, morning dew",
    "a rainbow over a lush valley with a small river",
    "a tropical beach with soft waves, palm trees and warm sunset colors",
    "a field of lavender at golden hour with distant hills",
    "a mossy stream flowing over smooth stones in a bright green forest",
    "cherry blossoms along a still pond with petals floating on the water",
    "a peaceful mountain lake with colorful autumn trees reflected in it",
    "a hidden waterfall with a pool of crystal clear water and tropical plants",
    "a flowering garden with a stone bridge and a small waterfall",
    "a snowy-peak mountain valley with green pastures and wildflowers in summer",
    "a calm river at dawn with pink and orange clouds",
    "a bamboo forest with soft light and a quiet path",
    "an ocean cliff with gentle waves and a colorful sky at sunset",
    "a field of sunflowers under a clear blue sky",
    "a magical forest clearing with glowing sunlight and bright flowers",
    "a stream with koi fish in a peaceful Japanese garden, vivid colors",
    "a green hillside with a small lake and fluffy white clouds",
    "a jungle river with exotic flowers and hummingbirds",
    "a quiet bay with turquoise water and white sand",
    "an alpine meadow with a wooden cabin far away and blooming flowers",
    "a rainforest canopy with rays of light and colorful parrots",
]

MUSIC_PROMPT = (
    "slow soft relaxing piano, warm and gentle, spacious reverb, calm and healing, "
    "very light nature ambience with distant birds, no drums, no vocals"
)
MUSIC_BPM = 60

WORK = Path("work")
IMG_DIR = WORK / "images"
MUSIC_DIR = WORK / "music"


# ----------------------------------------------------------------------------
# Utilitare
# ----------------------------------------------------------------------------
def run(cmd):
    print("+", " ".join(str(c) for c in cmd)[:300])
    subprocess.run([str(c) for c in cmd], check=True)


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return float(out)


def need_ffmpeg():
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        sys.exit("Lipsește ffmpeg. Instalează: sudo apt install ffmpeg")


def get_client(api_version=None):
    try:
        from google import genai
    except ImportError:
        sys.exit("Lipsește biblioteca: pip install google-genai")
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit('Setează cheia: export GEMINI_API_KEY="cheia_ta"')
    if api_version:
        return genai.Client(api_key=key, http_options={"api_version": api_version})
    return genai.Client(api_key=key)


# ----------------------------------------------------------------------------
# 1. Imagini
# ----------------------------------------------------------------------------
def make_images(args):
    from google.genai import types
    client = get_client()
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    scenes = SCENES[:]
    random.shuffle(scenes)
    done = 0
    for i in range(args.images):
        out = IMG_DIR / f"img_{i:02d}.png"
        if out.exists():
            done += 1
            continue
        prompt = f"{scenes[i % len(scenes)]}. {STYLE}"
        print(f"[imagine {i + 1}/{args.images}] {prompt[:90]}...")
        try:
            try:
                cfg = types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                    image_config=types.ImageConfig(aspect_ratio="16:9"),
                )
            except Exception:  # versiune mai veche a bibliotecii
                cfg = types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])
            resp = client.models.generate_content(model=IMAGE_MODEL, contents=prompt, config=cfg)
            data = None
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    data = part.inline_data.data
                    break
            if data is None:
                print("   fără imagine în răspuns, sar peste")
                continue
            if isinstance(data, str):
                data = base64.b64decode(data)
            out.write_bytes(data)
            done += 1
        except Exception as e:  # limită de cereri, filtre etc.
            print(f"   eroare: {e}")
    print(f"Imagini gata: {done}/{args.images} în {IMG_DIR}/")
    if done < args.images:
        print("Rulează din nou comanda: continuă de unde a rămas.")


# ----------------------------------------------------------------------------
# 2. Muzică (Lyria RealTime - experimental). Alternativă: --music-dir cu piesele tale.
# ----------------------------------------------------------------------------
async def _lyria_track(client, out_path, seconds):
    from google.genai import types
    sample_rate, channels, width = 48000, 2, 2
    target = seconds * sample_rate * channels * width
    got = 0
    with wave.open(str(out_path), "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(width)
        wf.setframerate(sample_rate)
        async with client.aio.live.music.connect(model=MUSIC_MODEL) as session:
            await session.set_weighted_prompts(
                prompts=[types.WeightedPrompt(text=MUSIC_PROMPT, weight=1.0)]
            )
            await session.set_music_generation_config(
                config=types.LiveMusicGenerationConfig(bpm=MUSIC_BPM, temperature=1.0)
            )
            await session.play()
            async for msg in session.receive():
                sc = getattr(msg, "server_content", None)
                if not sc or not sc.audio_chunks:
                    continue
                chunk = sc.audio_chunks[0].data
                wf.writeframes(chunk)
                got += len(chunk)
                if got >= target:
                    break
            await session.stop()


def make_music(args):
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    if args.music_dir:
        src = Path(args.music_dir)
        files = [p for p in sorted(src.iterdir())
                 if p.suffix.lower() in (".mp3", ".wav", ".m4a", ".flac", ".ogg")]
        if not files:
            sys.exit(f"Nu am găsit piese audio în {src}")
        for p in files:
            dst = MUSIC_DIR / p.name
            if not dst.exists():
                shutil.copy(p, dst)
        print(f"Am copiat {len(files)} piese din {src} în {MUSIC_DIR}/")
        return
    client = get_client(api_version="v1alpha")
    for i in range(args.tracks):
        out = MUSIC_DIR / f"track_{i:02d}.wav"
        if out.exists():
            continue
        print(f"[piesa {i + 1}/{args.tracks}] ~{args.track_seconds}s ...")
        try:
            asyncio.run(_lyria_track(client, out, args.track_seconds))
        except Exception as e:
            out.unlink(missing_ok=True)
            print(f"   eroare: {e}")
            print("   Dacă Lyria nu merge, generează piese în Gemini și folosește --music-dir.")
    print(f"Piese în {MUSIC_DIR}/")


# ----------------------------------------------------------------------------
# 3. Montaj
# ----------------------------------------------------------------------------
def build_audio_cycle(xfade):
    """Pune piesele cap la cap cu dizolvare și face un ciclu care se repetă fără cusătură."""
    tracks = [p for p in sorted(MUSIC_DIR.iterdir())
              if p.suffix.lower() in (".mp3", ".wav", ".m4a", ".flac", ".ogg")]
    if not tracks:
        sys.exit("Nu există muzică. Rulează pasul 'music' sau folosește --music-dir.")
    durs = [probe_duration(t) for t in tracks]
    if min(durs) <= xfade * 2:
        sys.exit("O piesă e prea scurtă pentru dizolvarea setată.")
    seq = tracks + [tracks[0]]          # prima piesă din nou la final -> buclă fără cusătură
    inputs = []
    for t in seq:
        inputs += ["-i", t]
    parts = []
    prev = "[0:a]"
    for k in range(1, len(seq)):
        lab = f"[a{k}]"
        parts.append(f"{prev}[{k}:a]acrossfade=d={xfade}:c1=tri:c2=tri{lab}")
        prev = lab
    cycle_len = sum(durs) - len(tracks) * xfade
    parts.append(f"{prev}atrim=start={xfade}:duration={cycle_len},asetpts=PTS-STARTPTS[aout]")
    out = WORK / "audio_cycle.wav"
    run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(parts),
         "-map", "[aout]", "-ar", "48000", "-ac", "2", out])
    print(f"Ciclu audio: {cycle_len / 60:.1f} min")
    return out


def build_video_cycle(args):
    imgs = sorted(IMG_DIR.glob("*.png")) + sorted(IMG_DIR.glob("*.jpg"))
    if len(imgs) < 2:
        sys.exit("Ai nevoie de cel puțin 2 imagini în work/images/")
    w, h = [int(x) for x in args.size.lower().split("x")]
    fps, s, t = args.fps, args.seconds_per_image, args.fade
    n = len(imgs)
    frames = s * fps
    seq = imgs + [imgs[0]]              # prima imagine din nou -> buclă fără cusătură
    # 1) fiecare imagine devine un clip separat, cu zoom lin la nivel de sub-pixel
    #    (filtrul perspective interpolează, deci imaginea nu "tremură" ca la zoompan)
    clip_dir = WORK / "clips"
    clip_dir.mkdir(parents=True, exist_ok=True)
    z = f"(1+{args.zoom}*on/{frames})"
    mx, my = f"W/2*(1-1/{z})", f"H/2*(1-1/{z})"
    persp = (f"perspective=x0='{mx}':y0='{my}':x1='W-{mx}':y1='{my}':"
             f"x2='{mx}':y2='H-{my}':x3='W-{mx}':y3='H-{my}':interpolation=cubic:eval=frame")
    clips = []
    for i, p in enumerate(seq):
        c = clip_dir / f"clip_{i:02d}_{w}x{h}_{s}s_z{args.zoom}.mp4"
        if not c.exists():
            print(f"[clip {i + 1}/{len(seq)}] {p.name}")
            run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", fps, "-t", s, "-i", p,
                 "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
                        f"setsar=1,format=yuv420p" + (f",{persp}" if args.zoom else ""),
                 "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", c])
        clips.append(c)
    inputs = []
    for c in clips:
        inputs += ["-i", c]
    logo_idx = None
    if args.logo:
        inputs += ["-i", args.logo]
        logo_idx = len(seq)

    parts = [f"[{i}:v]setpts=PTS-STARTPTS[v{i}]" for i in range(len(seq))]
    prev = "[v0]"
    for k in range(1, len(seq)):
        lab = f"[x{k}]"
        parts.append(
            f"{prev}[v{k}]xfade=transition=fade:duration={t}:offset={k * (s - t)}{lab}"
        )
        prev = lab
    period = n * (s - t)
    parts.append(f"{prev}trim=start={t}:duration={period},setpts=PTS-STARTPTS[vc]")
    last = "[vc]"
    if logo_idx is not None:
        parts.append(f"[{logo_idx}:v]scale=-1:{h // 9}[lg]")
        parts.append(f"{last}[lg]overlay=x=30:y=H-h-30[vout]")
        last = "[vout]"
    out = WORK / "video_cycle.mp4"
    run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(parts), "-map", last,
         "-r", fps, "-c:v", "libx264", "-preset", "medium", "-crf", "24",
         "-maxrate", MAXRATE[0], "-bufsize", MAXRATE[1], "-pix_fmt", "yuv420p", out])
    print(f"Ciclu video: {period / 60:.1f} min")
    return out


MAXRATE = ["3M", "6M"]      # schimbat de --maxrate


def enc():
    return ["-c:v", "libx264", "-preset", "medium", "-crf", "24", "-maxrate", MAXRATE[0],
            "-bufsize", MAXRATE[1], "-pix_fmt", "yuv420p"]


def _overlay_variant(video, out, fps, length, cta=None, cta_windows=(), endcard=None, end_secs=25):
    """Re-encodează (o parte din) ciclu cu butoanele afișate în ferestrele date (cu fade)."""
    inputs = ["-i", video]
    parts, last, idx = [], "[0:v]", 1
    for (a, b) in cta_windows:
        inputs += ["-loop", "1", "-framerate", fps, "-t", length, "-i", cta]
        parts.append(f"[{idx}:v]format=rgba,fade=t=in:st={a}:d=1:alpha=1,"
                     f"fade=t=out:st={b - 1}:d=1:alpha=1[o{idx}]")
        parts.append(f"{last}[o{idx}]overlay=enable='between(t,{a},{b})'[c{idx}]")
        last, idx = f"[c{idx}]", idx + 1
    if endcard:
        st = length - end_secs
        inputs += ["-loop", "1", "-framerate", fps, "-t", length, "-i", endcard]
        parts.append(f"[{idx}:v]format=rgba,fade=t=in:st={st}:d=3:alpha=1[o{idx}]")
        parts.append(f"{last}[o{idx}]overlay=enable='gte(t,{st})'[c{idx}]")
        last = f"[c{idx}]"
    run(["ffmpeg", "-y", "-v", "error", *inputs, "-t", length, "-filter_complex", ";".join(parts),
         "-map", last, "-r", fps, *enc(), out])


def build(args):
    need_ffmpeg()
    WORK.mkdir(exist_ok=True)
    audio = build_audio_cycle(args.audio_fade)
    video = build_video_cycle(args)
    total = int(args.hours * 3600)
    out = Path(args.output)
    vin = ["-stream_loop", "-1", "-i", video]
    if args.cta or args.endcard:
        # butoane la început, la mijloc și la sfârșit + cadru de final:
        # doar ciclurile care le conțin se re-encodează, restul se copiază
        period = probe_duration(video)
        n_full, rest = divmod(total, period)
        n_full = int(n_full)
        if rest < 60:                      # ultimul ciclu prea scurt -> îl lungim pe cel de dinainte
            n_full, rest = n_full - 1, rest + period
        assert n_full >= 2, "durata e prea scurtă pentru butoane la început/mijloc/sfârșit"
        fps = args.fps
        seg = WORK / "segments"
        seg.mkdir(exist_ok=True)
        cw = lambda t: (t, t + args.cta_seconds)
        start_v = seg / "start.mp4"
        _overlay_variant(video, start_v, fps, period, args.cta, [cw(args.cta_start)] if args.cta else [])
        mid_t = total / 2
        mid_k = min(int(mid_t // period), n_full - 1)
        mid_v = seg / "mid.mp4"
        if mid_k == 0:
            mid_k = 1
        _overlay_variant(video, mid_v, fps, period, args.cta,
                         [cw(max(5, min(mid_t - mid_k * period, period - args.cta_seconds - 5)))]
                         if args.cta else [])
        end_v = seg / "end.mp4"
        tail_src = video
        if rest > period:                  # sfârșitul ține mai mult de un ciclu
            tail_src = seg / "tail_src.mp4"
            run(["ffmpeg", "-y", "-v", "error", "-stream_loop", "1", "-i", video, "-t", rest,
                 "-c", "copy", tail_src])
        end_cta = [cw(rest - args.end_seconds - args.cta_seconds - 30)] if args.cta else []
        _overlay_variant(tail_src, end_v, fps, rest, args.cta, end_cta, args.endcard, args.end_seconds)
        order = [start_v] + [video] * (mid_k - 1) + [mid_v] + [video] * (n_full - mid_k - 1) + [end_v]
        lst = seg / "list.txt"
        lst.write_text("".join(f"file '{Path(p).resolve()}'\n" for p in order))
        vin = ["-f", "concat", "-safe", "0", "-i", lst]
    run(["ffmpeg", "-y", *vin,
         "-stream_loop", "-1", "-i", audio,
         "-t", total, "-map", "0:v", "-map", "1:a",
         "-c:v", "copy",
         "-af", f"afade=t=in:d=3,afade=t=out:st={total - 8}:d=8",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out])
    print(f"\nGata: {out}  ({probe_duration(out) / 3600:.2f} ore)")


# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", choices=["images", "music", "build", "all"])
    ap.add_argument("--hours", type=float, default=3.0, help="durata finală (implicit 3)")
    ap.add_argument("--images", type=int, default=24, help="câte imagini să genereze")
    ap.add_argument("--seconds-per-image", type=int, default=40)
    ap.add_argument("--fade", type=int, default=4, help="secunde de dizolvare între imagini")
    ap.add_argument("--tracks", type=int, default=6, help="câte piese să genereze")
    ap.add_argument("--track-seconds", type=int, default=180)
    ap.add_argument("--audio-fade", type=int, default=4, help="secunde de dizolvare între piese")
    ap.add_argument("--music-dir", help="folder cu piesele tale (în loc de generare Lyria)")
    ap.add_argument("--logo", help="logo PNG pus în colțul stânga-jos (opțional)")
    ap.add_argument("--cta", help="PNG transparent cu butoanele (tools/make_overlay.py)")
    ap.add_argument("--cta-start", type=float, default=8, help="secunda la care apar prima dată")
    ap.add_argument("--cta-seconds", type=float, default=15, help="cât timp stau pe ecran")
    ap.add_argument("--endcard", help="PNG cu cadrul de final (tools/make_overlay.py --endcard)")
    ap.add_argument("--end-seconds", type=float, default=25)
    ap.add_argument("--maxrate", default="3M",
                    help="debit video maxim (ex. 1.3M pentru un fișier de ~2 GB la 3 ore)")
    ap.add_argument("--zoom", type=float, default=0,
                    help="zoom lent pe fiecare imagine (0 = imagini nemișcate, ex. 0.1 = 10%%)")
    ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--output", default="video_3_ore.mp4")
    args = ap.parse_args()
    rate = float(args.maxrate.rstrip("Mm"))
    MAXRATE[:] = [args.maxrate, f"{rate * 2:g}M"]

    if args.step in ("images", "all"):
        make_images(args)
    if args.step in ("music", "all"):
        make_music(args)
    if args.step in ("build", "all"):
        build(args)


if __name__ == "__main__":
    main()
