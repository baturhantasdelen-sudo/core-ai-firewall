"""Build transparent lockup PNG from original brand art (full resolution, lossless PNG)."""
from __future__ import annotations

import os
from collections import deque

from PIL import Image

DEFAULT_SRC = (
    r"C:\Users\HP\.cursor\projects\c-Users-HP-Projects-core-ai-firewall\assets"
    r"\c__Users_HP_AppData_Roaming_Cursor_User_workspaceStorage_58b769be2d435b8fce61f51e8f86f47f"
    r"_images_nexus_shield_new_lego-c6cc8aa3-109a-43b6-b937-075d3a012663.jpg"
)

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "assets", "icon", "nexus_logo_transparent.png")


def _is_background(r: int, g: int, b: int) -> bool:
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    mx, mn = max(r, g, b), min(r, g, b)
    sat = mx - mn
    if luma < 30:
        return True
    if luma < 68 and sat < 40:
        return True
    if luma < 52 and r < 58 and g < 58 and b < 72:
        return True
    return False


def _flood_background(im: Image.Image) -> Image.Image:
    w, h = im.size
    px = im.load()
    seen = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        seen[y][x] = True
        r, g, b, _a = px[x, y]
        if not _is_background(r, g, b):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    return im


def main() -> None:
    src = os.environ.get("NEXUS_LOGO_SRC", DEFAULT_SRC)
    if not os.path.isfile(src):
        raise SystemExit(f"Source not found: {src}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im = Image.open(src)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    im = _flood_background(im)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(OUT, format="PNG", compress_level=1)
    print(f"Wrote {OUT} size={im.size}")


if __name__ == "__main__":
    main()
