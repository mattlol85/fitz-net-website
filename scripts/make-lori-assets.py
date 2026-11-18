#!/usr/bin/env python3
"""Generate the Lori-Net ("LN", pink) brand assets from the Fitz-Net ("FN") originals.

Every LN asset is derived from its FN counterpart so the two sites stay in step:
  * blue  (#021aaf)  -> pink  (LORI_PINK)
  * grey  (#6f6f6f)  -> mauve (LORI_MAUVE), white stays white
  * the sans "F" in the box logos becomes an "L" (arms erased, bottom bar drawn)
  * the mono "Fitz" in the wordmark and typing animation is re-typed as "Lori"

Usage (needs Pillow, and a monospace font close to the original; SF Mono on macOS):
    python3 scripts/make-lori-assets.py [--font /System/Library/Fonts/SFNSMono.ttf]
"""
import argparse
import os

from PIL import Image, ImageDraw, ImageFont, ImageSequence

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "src", "img")
PUBLIC = os.path.join(ROOT, "public")

LORI_PINK = (230, 0, 126)    # #e6007e
LORI_MAUVE = (181, 82, 126)  # #b5527e
WHITE = (255, 255, 255)

# Wordmark geometry measured from Fitz_Net_Logo.png (1000x1000).
WORD_FIRST_INK_X = 55   # left edge of the "F"
WORD_BASELINE = 522     # bottom of the "F"
WORD_CAP = 136          # cap height of the "F"
WORD_ADVANCE = 112      # monospace advance
WORD_INK_CENTER = 263   # centre of the "Fitz" ink (55..471); "Lori" is centred on it
# The typing GIF is the same artwork shifted by this offset.
GIF_OFFSET = (132, -113)  # only the vertical part is used: the GIF re-centres per frame


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def is_blueish(r, g, b):
    return b > r + 40 and b > g + 30


def recolor_pixel(r, g, b):
    """Map a pixel of the FN palette (blue/grey blended with white) to the LN palette."""
    if is_blueish(r, g, b):
        t = max(0.0, min(1.0, (255 - r) / 253))
        return mix(WHITE, LORI_PINK, t)
    if abs(r - g) < 14 and abs(g - b) < 14:
        t = max(0.0, min(1.0, (255 - r) / (255 - 111)))
        return mix(WHITE, LORI_MAUVE, t)
    return (r, g, b)


def recolor(im):
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r < 200 and is_blueish(r, g, b) and a < 255:
                px[x, y] = (*LORI_PINK, a)  # anti-aliased edge on transparency
            else:
                px[x, y] = (*recolor_pixel(r, g, b), a)
    return im


def blue_bbox(im):
    px = im.load()
    w, h = im.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 128 and is_blueish(r, g, b):
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def f_to_l(im):
    """Turn the blue sans "F" of a box logo into an "L" of the same weight."""
    im = im.convert("RGBA")
    px = im.load()
    x0, y0, x1, y1 = blue_bbox(im)
    mid = (y0 + y1) // 2

    def blue_at(x, y):
        r, g, b, a = px[x, y]
        return a > 128 and is_blueish(r, g, b)

    # Stem: blue run at a row between the arms.
    probe = y0 + (y1 - y0) * 3 // 4
    stem_right = x0
    while blue_at(stem_right + 1, probe):
        stem_right += 1
    # Arm thickness: blue run down the right side of the top arm.
    arm_x = x1 - 2
    arm = 0
    while blue_at(arm_x, y0 + arm):
        arm += 1
    # L arm length follows the F's (shorter) middle arm.
    mid_right = stem_right
    for y in range(mid - arm, y1):
        row_right = max((x for x in range(stem_right, x1 + 1) if blue_at(x, y)), default=stem_right)
        mid_right = max(mid_right, row_right) if row_right < x1 - 4 else mid_right
    if mid_right <= stem_right:
        mid_right = x1 - (x1 - x0) // 20

    bg = px[x1 + 1, y0] if im.getpixel((x1 + 1, y0))[3] else (0, 0, 0, 0)
    for y in range(y0, y1 + 1):
        for x in range(stem_right + 1, x1 + 1):
            px[x, y] = bg
    stem_color = px[x0 + 2, mid]
    for y in range(y1 - arm + 1, y1 + 1):
        for x in range(x0, mid_right + 1):
            px[x, y] = stem_color
    return im


def mono_font(path, size):
    return ImageFont.truetype(path, size)


def render_mono(text, font_path, color, scale=1.0):
    """Render text in the wordmark's monospace metrics. Returns (RGBA image, origin_x, baseline_y)."""
    probe = mono_font(font_path, 400)
    fb = probe.getbbox("F", anchor="ls")
    size = round(400 * WORD_CAP * scale / (fb[3] - fb[1]))
    font = mono_font(font_path, size)
    adv = font.getlength("F")
    pad = size
    width = int(adv * len(text)) + 2 * pad
    height = size * 2
    canvas = Image.new("L", (width, height), 0)
    d = ImageDraw.Draw(canvas)
    base = int(size * 1.4)
    for i, ch in enumerate(text):
        d.text((pad + i * adv, base), ch, font=font, fill=255, anchor="ls")
    # Squash horizontally so the advance matches the original monospace grid.
    sx = WORD_ADVANCE * scale / adv
    canvas = canvas.resize((max(1, round(width * sx)), height), Image.LANCZOS)
    # Origin: where the "F"'s ink starts in this pipeline.
    f_ink = font.getbbox("F", anchor="ls")[0]
    origin_x = (pad + f_ink) * sx
    layer = Image.new("RGBA", canvas.size, (*color, 0))
    layer.putalpha(canvas)
    return layer, origin_x, base


def lori_shift(font_path):
    """Horizontal nudge that centres the full "Lori" ink where the "Fitz" ink was.

    The cells stay on the monospace grid; the shift is the same for every typing frame so the
    letters do not jump as they appear."""
    layer, ox, _ = render_mono("Lori", font_path, LORI_PINK)
    x0, _, x1, _ = layer.getchannel("A").getbbox()
    return WORD_INK_CENTER - (WORD_FIRST_INK_X - ox + (x0 + x1) / 2)


def stamp_text(im, text, font_path, first_ink_x, baseline, color, shift=0.0):
    layer, ox, base = render_mono(text, font_path, color)
    im.alpha_composite(layer, (round(first_ink_x - ox + shift), round(baseline - base)))


def erase_blue(im, box, fill):
    """Clear the blue "Fitz" ink in box, including its faint anti-aliased edge (any blue tint).
    Neutral pixels (the grey typing cursor, the white canvas) are left alone."""
    px = im.load()
    x0, y0, x1, y1 = box
    for y in range(max(0, y0), min(im.size[1], y1)):
        for x in range(max(0, x0), min(im.size[0], x1)):
            r, g, b, a = px[x, y]
            if a and b - r > 6:
                px[x, y] = fill


def box_logos():
    for name in ["Straight", "Offset1", "Offset2"]:
        src = Image.open(os.path.join(IMG, f"FN_Logo_{name}.png"))
        recolor(f_to_l(src)).save(os.path.join(IMG, f"LN_Logo_{name}.png"), optimize=True)


def wordmark(font_path):
    im = Image.open(os.path.join(IMG, "Fitz_Net_Logo.png")).convert("RGBA")
    erase_blue(im, (0, 300, 486, 600), (0, 0, 0, 0))
    im = recolor(im)
    stamp_text(im, "Lori", font_path, WORD_FIRST_INK_X, WORD_BASELINE, LORI_PINK,
               lori_shift(font_path))
    im.save(os.path.join(IMG, "Lori_Net_Logo.png"), optimize=True)


# "Fitz" cells relative to the left edge of the "F" ink (from the finished frame).
FITZ_CELLS = [(0, 81), (112, 199), (216, 305), (338, 416)]


def fitz_state(frame):
    """(left edge of the "F" ink, number of "Fitz" letters typed) for one animation frame.

    The original re-centres the text after every keystroke, so the letters move between frames;
    each frame is anchored to wherever its own "F" sits."""
    px = frame.load()
    w, h = frame.size
    left = next((x for x in range(w)
                 if any(is_blueish(*px[x, y][:3]) for y in range(200, 460, 3))), None)
    if left is None:
        return None, 0
    typed = sum(
        1 for (a, b) in FITZ_CELLS
        if any(is_blueish(*px[x, y][:3])
               for x in range(left + a, min(w, left + b), 3) for y in range(200, 460, 3))
    )
    return left, typed


def lori_frame(frame, font_path, shift, baseline):
    rgba = frame.convert("RGBA")
    left, k = fitz_state(rgba)
    erase_blue(rgba, (0, 0, *rgba.size), (255, 255, 255, 255))
    rgba = recolor(rgba)
    if k:
        stamp_text(rgba, "Lori"[:k], font_path, left, baseline, LORI_PINK, shift)
    return rgba.convert("RGB").quantize(colors=64, method=Image.MEDIANCUT)


def animations(font_path):
    shift = lori_shift(font_path)
    baseline = WORD_BASELINE + GIF_OFFSET[1]
    for src_name, dst_name, loop in [
        ("FN_Logo_Animation_nonloop.gif", "LN_Logo_Animation_nonloop.gif", None),
        ("FN_Logo_Animation.gif", "LN_Logo_Animation.gif", 0),
    ]:
        src = Image.open(os.path.join(IMG, src_name))
        frames, durations, cache = [], [], {}
        for frame in ImageSequence.Iterator(src):
            durations.append(frame.info.get("duration", 30))
            key = frame.convert("RGB").tobytes()
            if key not in cache:  # most frames repeat the previous one; process each look once
                cache[key] = lori_frame(frame, font_path, shift, baseline)
            frames.append(cache[key])
        kwargs = {"save_all": True, "append_images": frames[1:], "duration": durations,
                  "disposal": 1, "optimize": False}
        if loop is not None:
            kwargs["loop"] = loop
        frames[0].save(os.path.join(IMG, dst_name), **kwargs)


def icons():
    out = os.path.join(PUBLIC, "lori")
    os.makedirs(out, exist_ok=True)
    logo = Image.open(os.path.join(IMG, "LN_Logo_Offset2.png")).convert("RGBA")
    for size, name in [(192, "logo192.png"), (512, "logo512.png")]:
        logo.resize((size, size), Image.LANCZOS).save(os.path.join(out, name), optimize=True)
    logo.resize((256, 256), Image.LANCZOS).save(
        os.path.join(out, "favicon.ico"), sizes=[(256, 256), (64, 64), (32, 32), (16, 16)])


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--font", default="/System/Library/Fonts/SFNSMono.ttf",
                    help="monospace font used to re-type 'Fitz' as 'Lori'")
    args = ap.parse_args()
    box_logos()
    wordmark(args.font)
    animations(args.font)
    icons()
    print("Lori-Net assets written to src/img and public/lori")


if __name__ == "__main__":
    main()
