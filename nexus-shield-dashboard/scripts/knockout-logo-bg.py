"""Knock out connected navy background; keep metallic lockup + wordmark."""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(
    r"C:\Users\HP\.cursor\projects\c-Users-HP-Projects-core-ai-firewall\assets"
    r"\c__Users_HP_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"58b769be2d435b8fce61f51e8f86f47f_images_nexus_shield_new_lego-33b63f50-82ee-4e14-991b-edac90ec9e25.jpg"
)
DESTS = [
    Path(r"C:\Users\HP\Projects\core-ai-firewall\nexus-shield-dashboard\public\images\nexusshield-logo.png"),
    Path(r"C:\Users\HP\Projects\core-ai-firewall\nexusshield_mobile\assets\images\nexusshield-logo.png"),
]


def main() -> None:
    rgb = np.array(Image.open(SRC).convert("RGB"))
    h, w, _ = rgb.shape
    bg = np.median(
        np.concatenate(
            [rgb[0, :], rgb[-1, :], rgb[:, 0], rgb[:, -1]],
            axis=0,
        ),
        axis=0,
    ).astype(np.float32)

    dist = np.linalg.norm(rgb.astype(np.float32) - bg, axis=2)
    is_bg_seed = dist < 22.0

    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg_seed[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg_seed[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    flood_limit = 36.0
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and dist[ny, nx] < flood_limit:
                visited[ny, nx] = True
                q.append((ny, nx))

    # Soft edge: leftover near-bg pixels on the fringe get partial alpha.
    alpha = np.where(visited, 0.0, 255.0)
    fringe = (~visited) & (dist < 48.0)
    alpha[fringe] = np.clip((dist[fringe] - 18.0) * 9.0, 0, 255)

    rgba = np.dstack([rgb, alpha.astype(np.uint8)])
    ys, xs = np.where(alpha > 12)
    top, bottom = int(ys.min()), int(ys.max())
    left, right = int(xs.min()), int(xs.max())
    pad = 6
    top = max(0, top - pad)
    left = max(0, left - pad)
    bottom = min(h - 1, bottom + pad)
    right = min(w - 1, right + pad)
    cropped = rgba[top : bottom + 1, left : right + 1]

    out = Image.fromarray(cropped, "RGBA")
    out = out.resize((out.width * 2, out.height * 2), Image.Resampling.LANCZOS)
    print("out", out.size, "bg", bg.tolist())
    for dest in DESTS:
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG", optimize=True)
        print("wrote", dest, dest.stat().st_size)


if __name__ == "__main__":
    main()
