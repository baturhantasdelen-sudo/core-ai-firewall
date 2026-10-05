"""Shield-only emblem for adaptive launcher (1024², LANCZOS upscale from lockup crop)."""
from __future__ import annotations

import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
LOCKUP = os.path.join(ROOT, "assets", "icon", "nexus_logo_transparent.png")
OUT = os.path.join(ROOT, "assets", "icon", "nexus_emblem_transparent.png")

CANVAS = 1024
SAFE_FRACTION = 0.58
SHIELD_HEIGHT_RATIO = 0.465


def main() -> None:
    lockup = Image.open(LOCKUP).convert("RGBA")
    w, h = lockup.size
    shield = lockup.crop((0, 0, w, int(h * SHIELD_HEIGHT_RATIO)))
    bbox = shield.getbbox()
    if bbox:
        shield = shield.crop(bbox)

    sw, sh = shield.size
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    scale = min(CANVAS * SAFE_FRACTION / sw, CANVAS * SAFE_FRACTION / sh)
    nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
    shield = shield.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (CANVAS - nw) // 2
    y = (CANVAS - nh) // 2 - int(CANVAS * 0.03)
    canvas.paste(shield, (x, y), shield)
    canvas.save(OUT, format="PNG", compress_level=1)
    print(f"Wrote {OUT} ({CANVAS}x{CANVAS}) from crop {sw}x{sh}")


if __name__ == "__main__":
    main()
