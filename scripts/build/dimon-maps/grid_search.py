import os
"""Sök rutstorlek + offset (core: scene.grid.size, shiftX/shiftY) så att alla rum nås med
cell-till-cell-steg (centrum-kollision, som Foundry v14 gör). python grid_search.py <name> <gmin> <gmax> [step]"""
import sys, json, numpy as np, cv2
from collections import deque
SP = os.environ.get("DIMON_WORK", "work")
name, gmin, gmax = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
gstep = int(sys.argv[4]) if len(sys.argv) > 4 else 2
floor = (np.load(SP + f"/\{name}_floor.npy") > 0)
H, W = floor.shape
pins = json.load(open(SP + f"/\{name}_pins.json", encoding="utf-8"))
allfloor = floor.astype("uint8")

def seg_ok(x1, y1, x2, y2):
    n = int(max(abs(x2 - x1), abs(y2 - y1)) / 3) + 1
    xs = np.linspace(x1, x2, n).round().astype(int); ys = np.linspace(y1, y2, n).round().astype(int)
    return floor[ys, xs].all()

def evaluate(g, ox, oy):
    cols = np.arange(ox, W, g) + g // 2 if False else np.arange(ox + g / 2, W, g)
    rows = np.arange(oy + g / 2, H, g)
    valid = {}
    for j, cy in enumerate(rows):
        for i, cx in enumerate(cols):
            if floor[int(cy), int(cx)]: valid[(i, j)] = (int(cx), int(cy))
    # startnod = närmaste giltig cell till pin 1
    def nearest(p):
        best, bd = None, 1e9
        for k, (x, y) in valid.items():
            d = (x - p[1]) ** 2 + (y - p[2]) ** 2
            if d < bd: best, bd = k, d
        return best, bd ** 0.5
    start, _ = nearest(pins[0])
    seen = {start}; dq = deque([start])
    while dq:
        i, j = dq.popleft(); x, y = valid[(i, j)]
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                if di == 0 and dj == 0: continue
                if __import__('os').environ.get('DIR4') and di and dj: continue
                k = (i + di, j + dj)
                if k in valid and k not in seen:
                    x2, y2 = valid[k]
                    if seg_ok(x, y, x2, y2):
                        seen.add(k); dq.append(k)
    reach = 0; miss = []
    for p in pins:
        k, d = nearest(p)
        if k in seen and d < 0.9 * g: reach += 1
        else: miss.append(p[0])
    return reach, miss, len(seen)

best = []
for g in range(gmin, gmax + 1, gstep):
    bres = None
    for ox in range(0, g, max(2, g // 12)):
        for oy in range(0, g, max(2, g // 12)):
            r, miss, cells = evaluate(g, ox, oy)
            if bres is None or (r, cells) > (bres[0], bres[3]): bres = (r, miss, (ox, oy), cells)
    print(f"grid {g}px: best offset {bres[2]} reaches {bres[0]}/{len(pins)} pins, cells {bres[3]}, missing {bres[1]}")
