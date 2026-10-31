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
    inputs = []
    for p in seq:
        inputs += ["-i", p]
    logo_idx = None
    if args.logo:
        inputs += ["-i", args.logo]
        logo_idx = len(seq)

    parts = []
    for i in range(len(seq)):
        # zoom foarte lent spre centru; scalare mărită ca să nu tremure
        parts.append(
            f"[{i}:v]scale={w * 2}:{h * 2}:force_original_aspect_ratio=increase,"
            f"crop={w * 2}:{h * 2},"
            f"zoompan=z='1+0.12*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            f"d={frames}:s={w}x{h}:fps={fps},setsar=1,format=yuv420p[v{i}]"
        )
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
         "-maxrate", "3M", "-bufsize", "6M", "-pix_fmt", "yuv420p", out])
    print(f"Ciclu video: {period / 60:.1f} min")
    return out


def build(args):
    need_ffmpeg()
    WORK.mkdir(exist_ok=True)
    audio = build_audio_cycle(args.audio_fade)
    video = build_video_cycle(args)
    total = int(args.hours * 3600)
    out = Path(args.output)
    run(["ffmpeg", "-y",
         "-stream_loop", "-1", "-i", video,
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
    ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--output", default="video_3_ore.mp4")
    args = ap.parse_args()

    if args.step in ("images", "all"):
        make_images(args)
    if args.step in ("music", "all"):
        make_music(args)
    if args.step in ("build", "all"):
        build(args)


if __name__ == "__main__":
    main()
