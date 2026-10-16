#!/usr/bin/env python3
"""Turn scripts/demo-frames.sh output into assets/context-receipt-demo.gif.

The band text and colours come from the real Claude Code runtime (claude plugin test);
the surrounding terminal chrome is drawn here. It is a rendering, not a screen capture.
"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 15)
BOLD = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 15)
W, H, LH, PAD = 1000, 300, 22, 18
BG, FG, DIM = (30, 32, 40), (214, 217, 224), (120, 125, 138)
COLORS = {"green": (110, 200, 120), "yellow": (230, 200, 90), "red": (235, 105, 100), None: FG}

frames, receipt = [], ""
for line in open(sys.argv[1], encoding="utf-8"):
    kind, *rest = line.rstrip("\n").split("\t")
    if kind == "FRAME": frames.append((rest[0], json.loads(rest[1])))
    elif kind == "RECEIPT": receipt = json.loads(rest[0])

def canvas(title):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 28], fill=(22, 23, 29))
    for i, c in enumerate([(237, 106, 94), (245, 191, 79), (98, 197, 84)]):
        d.ellipse([12 + i * 20, 9, 24 + i * 20, 21], fill=c)
    d.text((W // 2 - 120, 6), title, font=FONT, fill=DIM)
    return im, d

out = []
history = []
for prompt, parts in frames:
    im, d = canvas("claude — context-receipt demo")
    y = 44
    history.append(prompt)
    for p in history[-3:]:
        d.text((PAD, y), f"> {p}", font=FONT, fill=FG); y += LH
        d.text((PAD, y), "  ● … tool calls …", font=FONT, fill=DIM); y += LH
    y = H - 3 * LH - 12
    x = PAD
    for part in parts:
        f = BOLD if part["bold"] else FONT
        col = DIM if part["dim"] else COLORS.get(part["color"], FG)
        d.text((x, y), part["t"], font=f, fill=col); x += d.textlength(part["t"], font=f)
    y += LH + 4
    d.rectangle([PAD - 6, y - 2, W - PAD, y + LH + 4], outline=(80, 84, 96))
    d.text((PAD, y + 2), "> ", font=FONT, fill=FG)
    out.append(im)

im, d = canvas("/receipt")
y = 40
d.text((PAD, y), "> /receipt", font=FONT, fill=FG); y += LH + 4
for l in receipt.splitlines()[:10]:
    d.text((PAD, y), l, font=FONT, fill=DIM if l.startswith("Estimates") else FG); y += LH - 2
out.append(im)

out[0].save(sys.argv[2], save_all=True, append_images=out[1:], duration=[2600] * (len(out) - 1) + [4200], loop=0)
out[-2].save(sys.argv[2].replace(".gif", ".png"))
print("wrote", sys.argv[2])
