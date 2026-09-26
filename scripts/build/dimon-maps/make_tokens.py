"""Runda tokenbilder (transparent cirkel) ur porträtten — Foundrys dynamiska ring ritar ring/bakgrund men beskär inte subjektet."""
import os, glob, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
SRC = os.environ.get("DIMON_NPC", "assets/dimon/npc")
OUT = os.environ.get("DIMON_TOKENS", "assets/dimon/tokens")
os.makedirs(OUT, exist_ok=True)
S = 512
n = 0
for f in sorted(glob.glob(SRC + r"\*.png")):
    slug = os.path.splitext(os.path.basename(f))[0]
    im = Image.open(f).convert("RGBA")
    w, h = im.size
    # inskriven cirkel, något uppflyttad (ansikten sitter i övre delen); 6 % beskärning bort från kanterna
    r = int(min(w, h) * 0.47)
    cx, cy = w // 2, int(h * 0.47)
    box = (cx - r, cy - r, cx + r, cy + r)
    crop = im.crop(box).resize((S, S), Image.LANCZOS)
    mask = Image.new("L", (S * 4, S * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, S * 4 - 1, S * 4 - 1), fill=255)
    mask = mask.resize((S, S), Image.LANCZOS)
    crop.putalpha(mask)
    crop.save(os.path.join(OUT, slug + ".webp"), "WEBP", quality=90, lossless=False, method=6)
    n += 1
print(n, "tokens ->", OUT)
