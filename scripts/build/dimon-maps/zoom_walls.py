import os
import sys, json
from PIL import Image, ImageDraw
ASSET = os.environ.get("DIMON_MAPS", "assets/dimon/maps")
SP = os.environ.get("DIMON_WORK", "work")
name, x0, y0, x1, y1, sc, g, ox, oy = sys.argv[1], *map(int, sys.argv[2:6]), float(sys.argv[6]), int(sys.argv[7]), int(sys.argv[8]), int(sys.argv[9])
im = Image.open(f"{ASSET}/{name}.webp").convert("RGB").crop((x0, y0, x1, y1))
im = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS)
d = ImageDraw.Draw(im)
for x1_, y1_, x2_, y2_ in json.load(open(SP + f"/{name}_walls.json")):
    d.line([((x1_ - x0) * sc, (y1_ - y0) * sc), ((x2_ - x0) * sc, (y2_ - y0) * sc)], fill=(255, 0, 255), width=2)
cx = ox + g / 2
while cx < x1:
    cy = oy + g / 2
    while cy < y1:
        if cx >= x0 and cy >= y0:
            X, Y = (cx - x0) * sc, (cy - y0) * sc
            d.ellipse([X - 3, Y - 3, X + 3, Y + 3], fill=(255, 255, 0))
        cy += g
    cx += g
im.save(SP + f"/zoom_{name}.png"); print(im.size)
