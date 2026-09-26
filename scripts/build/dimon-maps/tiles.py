import os
import sys
from PIL import Image, ImageDraw
ASSET = os.environ.get("DIMON_MAPS", "assets/dimon/maps")
SP = os.environ.get("DIMON_WORK", "work")
name, cols, rows, scale = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4])
step = int(sys.argv[5]) if len(sys.argv) > 5 else 50
im = Image.open(f"{ASSET}/{name}.webp").convert("RGB")
W, H = im.size
tw, th = W // cols, H // rows
for r in range(rows):
    for c in range(cols):
        x0, y0 = c * tw, r * th
        x1, y1 = min(W, x0 + tw + 30), min(H, y0 + th + 30)  # litet överlapp
        t = im.crop((x0, y0, x1, y1)).resize((int((x1 - x0) * scale), int((y1 - y0) * scale)), Image.LANCZOS)
        d = ImageDraw.Draw(t, "RGBA")
        gx = (x0 // step + 1) * step
        while gx < x1:
            X = (gx - x0) * scale
            d.line([(X, 0), (X, t.height)], fill=(255, 255, 0, 110 if gx % 100 == 0 else 50), width=1)
            if gx % 100 == 0: d.text((X + 2, 2), str(gx), fill=(255, 255, 0, 255))
            gx += step
        gy = (y0 // step + 1) * step
        while gy < y1:
            Y = (gy - y0) * scale
            d.line([(0, Y), (t.width, Y)], fill=(0, 255, 255, 110 if gy % 100 == 0 else 50), width=1)
            if gy % 100 == 0: d.text((2, Y + 2), str(gy), fill=(0, 255, 255, 255))
            gy += step
        t.save(SP + f"/tile_{name}_{r}{c}.png")
        print(f"tile_{name}_{r}{c}", x0, y0, x1, y1, t.size)
