# Dimön map tools

Scripts used to derive **Foundry core Wall documents** and a suitable **square grid** from the AI-drawn Dimön maps
(`assets/dimon/maps/`). Nothing here runs in Foundry; the results are baked into the `dimon` Adventure pack.

Requires Python 3 with `pillow numpy opencv-python-headless scipy`. Set `DIMON_MAPS` (image folder) and `DIMON_WORK`
(a scratch folder holding `<map>_pins.json` etc., see `params/`) before running.

| Script | Purpose |
|---|---|
| `walls2.py <map> <thr> <close> <erode> <eps>` | Marble/stone dungeon: non-rock mask → close → fill small holes → erode half a wall thickness → contour = wall segments. Env: `OPENK`, `MAXHOLE`, `FOPEN`. |
| `cave_walls2.py <map> <thr> <close> <open> <erode> <eps>` | Cave: bright gravel bands + holes that contain a room pin (+ `*_ellipses.json` for big rooms). |
| `wall_bfs.py <map> <grid> <ox> <oy> <pin>` | Exact cell-to-cell flood fill against the wall segments — reproduces Foundry's centre-point collision, so wall bugs are found without repacking. |
| `grid_search.py <map> <gmin> <gmax> [step]` | Searches grid size + offset (`scene.grid.size`, `shiftX/shiftY`) so every room is reachable. |
| `tiles.py`, `zoom_walls.py` | Gridded/zoomed crops used to place pins and inspect walls. |
| `make_tokens.py` | Round transparent token images from portraits (Foundry's dynamic ring does **not** crop the subject). |

`params/*_carve.json` widens a passage (rectangles), `*_exclude.json` removes noise (rectangles), `*_ellipses.json` fills big rooms.

Notes: Foundry v14 collision tests the token's **centre point** only; a scene's `shiftX/shiftY` moves the scene rectangle by
`-shift`, so wall and note coordinates are image pixels **minus** the shift (the pack builder does this); `padding` is 0.
