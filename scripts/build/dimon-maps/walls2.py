"""Väggar ur "icke-berg"-mask: nonrock = lum>thr → stäng → fyll hål → erodera E px → kontur.
python walls2.py <name> <thr> <close> <erode> <eps> [carvefile]"""
import sys, json, os
import numpy as np, cv2
from PIL import Image

ASSET = os.environ.get("DIMON_MAPS", "assets/dimon/maps")
SP = os.environ.get("DIMON_WORK", "work")
name, thr, cl, er, eps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5])
minarea = 1500
im = Image.open(f"{ASSET}/{name}.webp").convert("RGB")
rgb = np.asarray(im)
lum = rgb.astype(float).mean(axis=2)
k = lambda n: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (n, n))
m = (lum > thr).astype("uint8") * 255
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k(cl))
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k(int(os.environ.get("OPENK", "1"))))
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
keep = np.zeros_like(m)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] >= minarea: keep[lab == i] = 255
inv = 255 - keep
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
for i in range(1, n2):
    x, y, w, h, a = st2[i]
    if x > 0 and y > 0 and x + w < keep.shape[1] and y + h < keep.shape[0] and a < int(os.environ.get("MAXHOLE", "9000")):
        keep[lab2 == i] = 255
carve = os.path.join(SP, f"{name}_carve.json")
if os.path.exists(carve):
    for x1, y1, x2, y2 in json.load(open(carve)):
        keep[y1:y2, x1:x2] = 255
exc = os.path.join(SP, f"{name}_exclude.json")
if os.path.exists(exc):
    for x1, y1, x2, y2 in json.load(open(exc)):
        keep[y1:y2, x1:x2] = 0
floor = cv2.erode(keep, k(2 * er + 1)) if er > 0 else keep
fo = int(os.environ.get("FOPEN", "1"))
if fo > 1: floor = cv2.morphologyEx(floor, cv2.MORPH_OPEN, k(fo))
n3, lab3, st3, _ = cv2.connectedComponentsWithStats(floor, 8)
big = np.zeros_like(floor)
for i in range(1, n3):
    if st3[i, cv2.CC_STAT_AREA] >= 800: big[lab3 == i] = 255
floor = big
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
ov[floor > 0] = (ov[floor > 0] * 0.75 + np.array([0, 90, 0]) * 0.25).astype("uint8")
for x1, y1, x2, y2 in walls:
    cv2.line(ov, (x1, y1), (x2, y2), (255, 0, 255), 2)
Image.fromarray(ov).save(SP + f"/{name}_walls_full.png")
t = Image.fromarray(ov); t.thumbnail((1000, 1300)); t.save(SP + f"/{name}_walls.png")
n4, lab4, st4, _ = cv2.connectedComponentsWithStats(floor, 8)
print("floor comps:", n4 - 1, "walls:", len(walls))
dt = cv2.distanceTransform(floor, cv2.DIST_L2, 5)
pf = SP + f"/{name}_pins.json"
if os.path.exists(pf):
    for lbl, x, y in json.load(open(pf, encoding="utf-8")):
        # närmaste golvpixel inom 40 px
        y0, y1, x0, x1 = max(0, y - 40), y + 40, max(0, x - 40), x + 40
        sub = lab4[y0:y1, x0:x1]
        print(lbl, "comp", int(lab4[y, x]), "| near comps", sorted(set(sub.flatten()) - {0}), "| local w %.0f" % (dt[y0:y1, x0:x1].max() * 2))
