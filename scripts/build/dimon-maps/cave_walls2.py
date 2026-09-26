"""Grotta: golv = ljusa grusband (lum>thr) + hål som innehåller rumsnål; kontur = vägg.
python cave_walls2.py <name> <thr> <close> <open> <erode> <eps>"""
import sys, json, os
import numpy as np, cv2
from PIL import Image
ASSET = os.environ.get("DIMON_MAPS", "assets/dimon/maps")
SP = os.environ.get("DIMON_WORK", "work")
name, thr, cl, op, er, eps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), float(sys.argv[6])
im = Image.open(f"{ASSET}/{name}.webp").convert("RGB")
rgb = np.asarray(im); lum = rgb.astype(float).mean(axis=2)
k = lambda n: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (n, n))
m = ((lum > thr).astype("uint8")) * 255
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k(cl))
if op > 1: m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k(op))
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
keep = np.zeros_like(m)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] >= 2500: keep[lab == i] = 255
pins = json.load(open(SP + f"/{name}_pins.json", encoding="utf-8"))
inv = 255 - keep
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
fill = set()
for lbl, x, y in pins:
    c = int(lab2[y, x])
    if c > 0 and st2[c, cv2.CC_STAT_AREA] < 0.3 * inv.size:  # inte "bakgrundsberget"
        fill.add(c)
for i in range(1, n2):
    if st2[i, cv2.CC_STAT_AREA] < 1500: fill.add(i)
for c in fill: keep[lab2 == c] = 255
ef = os.path.join(SP, f"{name}_ellipses.json")
if os.path.exists(ef):
    for cx, cy, rx, ry in json.load(open(ef)): cv2.ellipse(keep, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
for path, val in ((f"{name}_carve.json", 255), (f"{name}_exclude.json", 0)):
    fp = os.path.join(SP, path)
    if os.path.exists(fp):
        for x1, y1, x2, y2 in json.load(open(fp)): keep[y1:y2, x1:x2] = val
floor = cv2.erode(keep, k(2 * er + 1)) if er > 0 else keep
fo = int(os.environ.get("FOPEN", "1"))
if fo > 1: floor = cv2.morphologyEx(floor, cv2.MORPH_OPEN, k(fo))
n3, lab3, st3, _ = cv2.connectedComponentsWithStats(floor, 8)
big = np.zeros_like(floor)
for i in range(1, n3):
    if st3[i, cv2.CC_STAT_AREA] >= 1500: big[lab3 == i] = 255
floor = big
# SLIVER: fyll smala enclosed hål (<4000 px) inne i golvet
_inv = 255 - floor
_n, _l, _s, _ = cv2.connectedComponentsWithStats(_inv, 4)
for i in range(1, _n):
    x, y, w, h, a = _s[i]
    if a < 4000 and x > 0 and y > 0 and x + w < floor.shape[1] and y + h < floor.shape[0]: floor[_l == i] = 255
np.save(SP + f"/{name}_floor.npy", floor)
cnts, _ = cv2.findContours(floor, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
walls = []
for c in cnts:
    ap = cv2.approxPolyDP(c, eps, True)[:, 0, :]
    if len(ap) < 3: continue
    for i in range(len(ap)):
        a, b = ap[i], ap[(i + 1) % len(ap)]
        if (a == b).all(): continue
        walls.append([int(a[0]), int(a[1]), int(b[0]), int(b[1])])
json.dump(walls, open(SP + f"/{name}_walls.json", "w"))
ov = rgb.copy()
ov[floor > 0] = (ov[floor > 0] * 0.6 + np.array([0, 160, 0]) * 0.4).astype("uint8")
for x1, y1, x2, y2 in walls: cv2.line(ov, (x1, y1), (x2, y2), (255, 0, 255), 2)
t = Image.fromarray(ov); t.thumbnail((1000, 1000)); t.save(SP + f"/{name}_walls.png")
n4, lab4, _, _ = cv2.connectedComponentsWithStats(floor, 8)
print("floor comps:", n4 - 1, "walls:", len(walls))
for lbl, x, y in pins: print(lbl, "comp", int(lab4[y, x]), end=" | ")
print()
