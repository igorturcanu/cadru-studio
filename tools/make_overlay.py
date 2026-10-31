#!/usr/bin/env python3
"""Desenează butoanele de canal (pictogramă, LIKE, SUBSCRIBE, clopoțel) ca PNG transparent.

  python3 tools/make_overlay.py --avatar avatar.png --out work/cta.png
  python3 tools/make_overlay.py --avatar avatar.png --endcard work/images/img_01.jpg --out work/endcard.png

Fără --avatar se folosește o pictogramă simplă cu lună.
"""
import argparse
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def avatar_img(path, d):
    if path:
        a = Image.open(path).convert("RGBA")
        s = min(a.size)
        a = a.crop(((a.width - s) // 2, (a.height - s) // 2, (a.width + s) // 2, (a.height + s) // 2))
        a = a.resize((d, d), Image.LANCZOS)
    else:
        a = Image.new("RGBA", (d, d), (24, 40, 80, 255))
        dr = ImageDraw.Draw(a)
        dr.ellipse((d * .28, d * .22, d * .72, d * .66), fill=(250, 235, 180, 255))
        dr.ellipse((d * .38, d * .16, d * .82, d * .60), fill=(24, 40, 80, 255))
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, d - 1, d - 1), fill=255)
    out = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    out.paste(a, (0, 0), mask)
    ring = ImageDraw.Draw(out)
    ring.ellipse((0, 0, d - 1, d - 1), outline=(255, 255, 255, 255), width=max(3, d // 30))
    return out


def thumb(dr, x, y, s, color):
    # palmă + deget mare, desen simplu
    dr.rounded_rectangle((x, y + s * .38, x + s * .22, y + s), radius=s * .05, fill=color)
    dr.rounded_rectangle((x + s * .28, y + s * .38, x + s * .95, y + s), radius=s * .12, fill=color)
    dr.polygon([(x + s * .30, y + s * .42), (x + s * .48, y), (x + s * .62, y + s * .06),
                (x + s * .58, y + s * .40)], fill=color)


def bell(dr, x, y, s, color):
    dr.pieslice((x + s * .12, y + s * .08, x + s * .88, y + s * .9), 180, 360, fill=color)
    dr.rectangle((x + s * .12, y + s * .48, x + s * .88, y + s * .74), fill=color)
    dr.polygon([(x, y + s * .82), (x + s * .12, y + s * .66), (x + s * .88, y + s * .66),
                (x + s, y + s * .82)], fill=color)
    dr.ellipse((x + s * .38, y + s * .80, x + s * .62, y + s), fill=color)
    dr.ellipse((x + s * .44, y, x + s * .56, y + s * .14), fill=color)


def pill(dr, box, fill, text, f, tcolor, icon=None, outline=None):
    x0, y0, x1, y1 = box
    h = y1 - y0
    dr.rounded_rectangle(box, radius=h / 2, fill=fill, outline=outline, width=3 if outline else 0)
    tw = dr.textlength(text, font=f)
    isz = h * .5 if icon else 0
    gap = h * .22 if icon else 0
    total = isz + gap + tw
    sx = x0 + (x1 - x0 - total) / 2
    if icon:
        icon(dr, sx, y0 + (h - isz) / 2 - h * .02, isz, tcolor)
    dr.text((sx + isz + gap, y0 + h / 2), text, font=f, fill=tcolor, anchor="lm")


def cta_row(W, H, avatar, name, message):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    k = W / 1920
    bh = int(86 * k)
    d = int(118 * k)
    f_btn = font(BOLD, int(36 * k))
    widths = [d, int(230 * k), int(330 * k), bh]
    gap = int(26 * k)
    total = sum(widths) + gap * 3
    x = (W - total) // 2
    cy = int(H * 0.66)                      # puțin sub mijloc
    # fundal discret, ca butoanele să se vadă pe orice imagine
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    top = cy - d // 2 - int(80 * k)
    sd.rounded_rectangle((x - int(40 * k), top, x + total + int(40 * k), cy + d // 2 + int(24 * k)),
                         radius=int(40 * k), fill=(0, 0, 0, 110))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(int(6 * k))))
    dr = ImageDraw.Draw(img)
    if message:
        dr.text((W / 2, top + int(40 * k)), message, font=font(BOLD, int(34 * k)),
                fill=(255, 255, 255, 255), anchor="mm")
    img.alpha_composite(avatar_img(avatar, d), (x, cy - d // 2))
    x += d + gap
    pill(dr, (x, cy - bh // 2, x + widths[1], cy + bh // 2), (255, 255, 255, 245), "LIKE", f_btn,
         (20, 20, 20, 255), thumb)
    x += widths[1] + gap
    pill(dr, (x, cy - bh // 2, x + widths[2], cy + bh // 2), (230, 33, 23, 255), "SUBSCRIBE", f_btn,
         (255, 255, 255, 255))
    x += widths[2] + gap
    dr.ellipse((x, cy - bh // 2, x + bh, cy + bh // 2), fill=(255, 255, 255, 245))
    bell(dr, x + bh * .25, cy - bh * .25, bh * .5, (20, 20, 20, 255))
    return img


def endcard(W, H, bg, avatar, name):
    b = Image.open(bg).convert("RGB")
    s = max(W / b.width, H / b.height)
    b = b.resize((int(b.width * s) + 1, int(b.height * s) + 1), Image.LANCZOS)
    b = b.crop(((b.width - W) // 2, (b.height - H) // 2, (b.width - W) // 2 + W, (b.height - H) // 2 + H))
    b = b.filter(ImageFilter.GaussianBlur(18 * W / 1920)).convert("RGBA")
    b = Image.alpha_composite(b, Image.new("RGBA", (W, H), (5, 10, 25, 120)))
    dr = ImageDraw.Draw(b)
    k = W / 1920
    dr.text((W / 2, H * .24), "Thank you for listening", font=font(BOLD, int(70 * k)),
            fill=(255, 255, 255, 255), anchor="mm")
    dr.text((W / 2, H * .33), "Sweet dreams  •  Vise frumoase", font=font(REG, int(44 * k)),
            fill=(225, 232, 245, 255), anchor="mm")
    if name:
        dr.text((W / 2, H * .43), name, font=font(BOLD, int(40 * k)), fill=(255, 255, 255, 255), anchor="mm")
    row = cta_row(W, H, avatar, name, "Like & Subscribe for more calm music")
    return Image.alpha_composite(b, row).convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--avatar")
    ap.add_argument("--name", default="Sounds and Dreamscapes")
    ap.add_argument("--message", default="If this music helps you relax, please Like & Subscribe")
    ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--endcard", help="imagine de fundal pentru cadrul de final")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    W, H = [int(v) for v in a.size.lower().split("x")]
    if a.endcard:
        endcard(W, H, a.endcard, a.avatar, a.name).save(a.out)
    else:
        cta_row(W, H, a.avatar, a.name, a.message).save(a.out)
    print("Salvat:", a.out)


if __name__ == "__main__":
    main()
