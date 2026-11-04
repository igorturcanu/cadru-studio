#!/usr/bin/env python3
"""make_short.py - Short vertical (implicit 4K 2160x3840, 58 s) care prezintă un video lung.

  python3 tools/make_short.py --images work/vert --audio work/audio_cycle.wav \
      --avatar avatar.jpg --hook "Need 3 hours of calm?" --out short.mp4

- imaginile verticale din --images (ordonate după nume), fiecare cu zoom foarte lent, fără tremur
- prima imagine revine la final, ca reluarea automată să pară continuă
- text mare la început (--hook), iar la final avatar + "Full 3-hour version" + SUBSCRIBE
- muzica: o bucată din --audio (de la --audio-start), stinsă lin la final; opțional apă fină (--water)
"""
import argparse
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def run(cmd):
    cmd = [str(c) for c in cmd]
    print(" ".join(cmd)[:200])
    subprocess.run(cmd, check=True)


def center_text(d, W, y, s, f, fill, sw=8):
    w = d.textlength(s, font=f)
    d.text(((W - w) / 2, y), s, font=f, fill=fill, stroke_width=sw, stroke_fill=(15, 15, 25))


def hook_png(W, H, text, out):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(SERIF, W // 11)
    lines = text.split("|")
    y = int(H * 0.30)
    for ln in lines:
        center_text(d, W, y, ln, f, (255, 246, 228), sw=W // 240)
        y += int(W / 11 * 1.35)
    im.save(out)


def end_png(W, H, avatar, name, line1, out):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # voal întunecat discret pe mijloc
    veil = Image.new("RGBA", (W, int(H * 0.42)), (0, 0, 0, 120))
    im.alpha_composite(veil, (0, int(H * 0.29)))
    D = W // 4
    if avatar:
        a = Image.open(avatar).convert("RGBA")
        s = min(a.size)
        a = a.crop(((a.width - s) // 2, (a.height - s) // 2, (a.width + s) // 2, (a.height + s) // 2))
        a = a.resize((D, D), Image.LANCZOS)
        m = Image.new("L", (D, D), 0)
        ImageDraw.Draw(m).ellipse((0, 0, D - 1, D - 1), fill=255)
        im.paste(a, ((W - D) // 2, int(H * 0.31)), m)
        d.ellipse(((W - D) // 2, int(H * 0.31), (W + D) // 2 - 1, int(H * 0.31) + D - 1),
                  outline=(232, 200, 95, 255), width=W // 160)
    y = int(H * 0.31) + D + W // 30
    center_text(d, W, y, name, ImageFont.truetype(BOLD, W // 16), (255, 255, 255), sw=W // 400)
    y += W // 9
    center_text(d, W, y, line1, ImageFont.truetype(BOLD, W // 22), (255, 214, 120), sw=W // 400)
    # buton SUBSCRIBE
    f = ImageFont.truetype(BOLD, W // 15)
    tw = d.textlength("SUBSCRIBE", font=f)
    bw, bh = tw + W // 8, W // 7
    y += W // 7
    x0 = (W - bw) / 2
    d.rounded_rectangle((x0, y, x0 + bw, y + bh), radius=bh / 2, fill=(214, 40, 40))
    d.text((x0 + (bw - tw) / 2, y + (bh - W / 15) / 2 - W / 120), "SUBSCRIBE", font=f, fill="white")
    im.save(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--images", required=True, help="folder cu imagini verticale")
    ap.add_argument("--audio", required=True)
    ap.add_argument("--audio-start", type=float, default=20)
    ap.add_argument("--avatar")
    ap.add_argument("--name", default="Sounds and Dreamscapes")
    ap.add_argument("--hook", default="Need 3 hours|of calm?", help="| = rând nou")
    ap.add_argument("--end-text", default="Full 3-hour version ▶ tap the link")
    ap.add_argument("--size", default="2160x3840")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--seconds", type=float, default=58)
    ap.add_argument("--fade", type=float, default=1.5)
    ap.add_argument("--zoom", type=float, default=0.04)
    ap.add_argument("--water", type=float, default=0)
    ap.add_argument("--work", default="work/short")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    W, H = [int(v) for v in a.size.split("x")]
    work = Path(a.work)
    work.mkdir(parents=True, exist_ok=True)
    imgs = sorted(Path(a.images).glob("*.jpg")) + sorted(Path(a.images).glob("*.png"))
    seq = imgs + [imgs[0]]
    n = len(seq)
    t = a.fade
    seg = (a.seconds + (n - 1) * t) / n        # durata fiecărei imagini, cu suprapunere
    fr = int(round(seg * a.fps))
    clips = []
    for i, p in enumerate(seq):
        c = work / f"clip_{i:02d}_{p.stem}_{W}x{H}_z{a.zoom}.mp4"
        clips.append(c)
        if c.exists():
            continue
        ease = f"(0.5-0.5*cos(PI*on/{fr}))"
        z = f"(1+{a.zoom}*{ease})" if i % 2 == 0 else f"(1+{a.zoom}*(1-{ease}))"
        mx, my = f"W/2*(1-1/{z})", f"H/2*(1-1/{z})"
        persp = (f",perspective=x0='{mx}':y0='{my}':x1='W-{mx}':y1='{my}':"
                 f"x2='{mx}':y2='H-{my}':x3='W-{mx}':y3='H-{my}':interpolation=cubic:eval=frame"
                 if a.zoom else "")
        run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", a.fps, "-t", seg, "-i", p,
             "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,"
                    f"format=yuv420p{persp},eq=saturation=1.12:contrast=1.03,unsharp=5:5:0.4",
             "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", c])
    hook, end = work / "hook.png", work / "end.png"
    hook_png(W, H, a.hook, hook)
    end_png(W, H, a.avatar, a.name, a.end_text, end)

    inputs = []
    for c in clips:
        inputs += ["-i", c]
    parts = []
    prev = "[0:v]"
    for k in range(1, n):
        parts.append(f"{prev}[{k}:v]xfade=transition=fade:duration={t}:offset={k * (seg - t):.3f}[x{k}]")
        prev = f"[x{k}]"
    L = a.seconds
    hi, ei, ai = n, n + 1, n + 2
    inputs += ["-loop", "1", "-framerate", a.fps, "-t", L, "-i", hook,
               "-loop", "1", "-framerate", a.fps, "-t", L, "-i", end,
               "-ss", a.audio_start, "-t", L, "-i", a.audio]
    parts.append(f"[{hi}:v]format=rgba,fade=t=out:st=2.4:d=0.8:alpha=1[hk]")
    parts.append(f"{prev}[hk]overlay=enable='lte(t,3.3)'[v1]")
    parts.append(f"[{ei}:v]format=rgba,fade=t=in:st={L - 8}:d=1:alpha=1[ed]")
    parts.append(f"[v1][ed]overlay=enable='gte(t,{L - 8})',trim=duration={L}[vout]")
    afx = f"afade=t=in:d=0.3,afade=t=out:st={L - 3}:d=3"
    if a.water:
        g = a.water
        inputs += ["-f", "lavfi", "-t", L, "-i", "anoisesrc=color=pink:sample_rate=48000:seed=7",
                   "-f", "lavfi", "-t", L, "-i", "anoisesrc=color=brown:sample_rate=48000:seed=11"]
        parts.append(f"[{ai + 1}:a]highpass=f=500,lowpass=f=4500,tremolo=f=0.13:d=0.35,volume={g}[w1]")
        parts.append(f"[{ai + 2}:a]highpass=f=60,lowpass=f=900,volume={g * 0.6}[w2]")
        parts.append("[w1][w2]amix=inputs=2:normalize=0,aformat=channel_layouts=stereo[wt]")
        parts.append(f"[{ai}:a][wt]amix=inputs=2:normalize=0,{afx}[aout]")
    else:
        parts.append(f"[{ai}:a]{afx}[aout]")
    run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(parts),
         "-map", "[vout]", "-map", "[aout]", "-t", L, "-r", a.fps,
         "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-maxrate", "40M", "-bufsize", "80M",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", a.out])
    print("Gata:", a.out)


if __name__ == "__main__":
    main()
