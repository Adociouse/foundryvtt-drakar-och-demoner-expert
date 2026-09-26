import os
"""Exakt cell-BFS mot väggsegmenten (som Foundrys centrum-kollision). python wall_bfs.py <name> <g> <ox> <oy>"""
import sys, json, numpy as np
from collections import deque
SP = os.environ.get("DIMON_WORK", "work")
name, g, ox, oy = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
W_ = np.array(json.load(open(SP + f"/\{name}_walls.json")), float)  # x1,y1,x2,y2
pins = json.load(open(SP + f"/\{name}_pins.json", encoding="utf-8"))
floor = np.load(SP + f"/\{name}_floor.npy") > 0
H, W = floor.shape

def blocked(a, b):
    # segment a-b mot alla väggar (vektoriserat)
    x1, y1, x2, y2 = W_[:, 0], W_[:, 1], W_[:, 2], W_[:, 3]
    ax, ay = a; bx, by = b
    d1 = (bx - ax) * (y1 - ay) - (by - ay) * (x1 - ax)
    d2 = (bx - ax) * (y2 - ay) - (by - ay) * (x2 - ax)
    d3 = (x2 - x1) * (ay - y1) - (y2 - y1) * (ax - x1)
    d4 = (x2 - x1) * (by - y1) - (y2 - y1) * (bx - x1)
    return bool(np.any((d1 * d2 <= 0) & (d3 * d4 <= 0)))

cols = np.arange(ox + g / 2, W, g); rows = np.arange(oy + g / 2, H, g)
allc = {(i, j): (float(cx), float(cy)) for j, cy in enumerate(rows) for i, cx in enumerate(cols)}
def flood(s):
    seen = {s}; dq = deque([s])
    while dq:
        i, j = dq.popleft()
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                if not di and not dj: continue
                if __import__('os').environ.get('DIR4') and di and dj: continue
                k = (i + di, j + dj)
                if k in allc and k not in seen and not blocked(allc[(i, j)], allc[k]):
                    seen.add(k); dq.append(k)
    return seen
def cellof(x, y): return (int((x - ox - g / 2) // g) + 1 if False else int((x - ox) // g), int((y - oy) // g))
si, sj = cellof(pins[-1][1], pins[-1][2]) if len(sys.argv) < 6 else cellof(*[p for p in pins if p[0] == sys.argv[5]][0][1:])
best = None
for a in range(-2, 3):
    for b in range(-2, 3):
        if (si + a, sj + b) in allc:
            cx_, cy_ = allc[(si + a, sj + b)]
            if not floor[int(cy_), int(cx_)]: continue   # start bara på golvcell
            s = flood((si + a, sj + b))
            if best is None or len(s) > len(best): best = s
miss = []
for lbl, x, y in pins:
    pi, pj = cellof(x, y)
    ok = any((pi + a, pj + b) in best for a in range(-2, 3) for b in range(-2, 3))
    if not ok: miss.append(lbl)
print(f"{name} g={g} off=({ox},{oy}): reachable cells {len(best)}; unreached pins {miss}")

if len(sys.argv) > 6:
    a_lbl = sys.argv[6]
    p_ = [p for p in pins if p[0] == a_lbl][0]
    pi, pj = cellof(p_[1], p_[2]); comp = None
    for a in range(-2, 3):
        for b in range(-2, 3):
            if (pi + a, pj + b) in allc:
                cx_, cy_ = allc[(pi + a, pj + b)]
                if floor[int(cy_), int(cx_)]:
                    s = flood((pi + a, pj + b))
                    if comp is None or len(s) > len(comp): comp = s
    print("component of", a_lbl, "cells:", len(comp), "in main:", len(comp & best))
    if not (comp & best):
        import itertools
        bestd = (1e9, None, None)
        for c1 in comp:
            for c2 in best:
                d = (c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2
                if d < bestd[0]: bestd = (d, c1, c2)
        print("closest cells between components:", allc[bestd[1]], allc[bestd[2]], "dist cells", bestd[0] ** 0.5)
