#!/usr/bin/env python3
"""Generate transparent, cover-fit CareSuite+ favicon from robot logo PNG."""
from __future__ import annotations

import struct
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "images" / "caresuite-robot-logo.png"
FAVICON_PNG = ROOT / "assets" / "favicon.png"
FAVICON_ICO = ROOT / "assets" / "favicon.ico"
PUBLIC_DIR = ROOT / "public"
PUBLIC_ICO = PUBLIC_DIR / "favicon.ico"
PUBLIC_PNG = PUBLIC_DIR / "favicon.png"
PUBLIC_APPLE = PUBLIC_DIR / "apple-touch-icon.png"

BLACK_THRESHOLD = 28
WHITE_THRESHOLD = 240
CORNER_MATCH_TOLERANCE = 18
ALPHA_CONTENT_MIN = 128
ROW_COL_MIN_FILL = 0.08
PADDING_RATIO = 0
# Cover + overscale (Netflix-style tab dominance); minor arm/foot crop OK.
SCALE_BOOST = 1.22
# Shift crop window upward to emphasize head/torso over feet.
CROP_BIAS_Y = 0.05
PNG_SIZES = [512, 192, 32, 16]
ICO_SIZES = [16, 32, 48, 64, 128, 256]


def is_near_black(r: int, g: int, b: int) -> bool:
    return r <= BLACK_THRESHOLD and g <= BLACK_THRESHOLD and b <= BLACK_THRESHOLD


def is_near_white(r: int, g: int, b: int) -> bool:
    return r >= WHITE_THRESHOLD and g >= WHITE_THRESHOLD and b >= WHITE_THRESHOLD


def matches_color(r: int, g: int, b: int, ref: tuple[int, int, int]) -> bool:
    rr, rg, rb = ref
    return (
        abs(r - rr) <= CORNER_MATCH_TOLERANCE
        and abs(g - rg) <= CORNER_MATCH_TOLERANCE
        and abs(b - rb) <= CORNER_MATCH_TOLERANCE
    )


def dominant_edge_color(img: Image.Image) -> tuple[int, int, int] | None:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    samples: list[tuple[int, int, int]] = []
    for x, y in (
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (w // 2, h - 1),
        (0, h // 2),
        (w - 1, h // 2),
    ):
        r, g, b, a = px[x, y]
        if a >= ALPHA_CONTENT_MIN:
            samples.append((r, g, b))
    if not samples:
        return None
    return (
        sum(s[0] for s in samples) // len(samples),
        sum(s[1] for s in samples) // len(samples),
        sum(s[2] for s in samples) // len(samples),
    )


def is_removable_background(
    r: int, g: int, b: int, corner_color: tuple[int, int, int] | None
) -> bool:
    if is_near_black(r, g, b) or is_near_white(r, g, b):
        return True
    if corner_color and matches_color(r, g, b, corner_color):
        return True
    return False


def flood_fill_background(img: Image.Image) -> Image.Image:
    """Remove near-black, near-white, and dominant edge-matte from borders."""
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    corner_color = dominant_edge_color(rgba)
    visited = [[False] * w for _ in range(h)]
    queue: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            return
        r, g, b, a = px[x, y]
        if a < ALPHA_CONTENT_MIN:
            visited[y][x] = True
            queue.append((x, y))
            return
        if not is_removable_background(r, g, b, corner_color):
            return
        visited[y][x] = True
        queue.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while queue:
        x, y = queue.popleft()
        r, g, b, a = px[x, y]
        if a >= ALPHA_CONTENT_MIN and is_removable_background(r, g, b, corner_color):
            px[x, y] = (0, 0, 0, 0)
        try_push(x - 1, y)
        try_push(x + 1, y)
        try_push(x, y - 1)
        try_push(x, y + 1)

    return rgba


def is_content_pixel(
    r: int, g: int, b: int, a: int, corner_color: tuple[int, int, int] | None
) -> bool:
    if a < ALPHA_CONTENT_MIN:
        return False
    if is_near_white(r, g, b):
        return False
    if corner_color and matches_color(r, g, b, corner_color):
        return False
    return True


def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    corner_color = dominant_edge_color(rgba)
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_content_pixel(r, g, b, a, corner_color):
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if not found:
        alpha = rgba.split()[3]
        return alpha.getbbox() or (0, 0, w, h)
    return min_x, min_y, max_x + 1, max_y + 1


def trim_empty_margin(img: Image.Image) -> Image.Image:
    """Drop sparse rows/columns (dead space inside alpha bbox)."""
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size

    def row_fill(y: int) -> float:
        return sum(1 for x in range(w) if px[x, y][3] >= ALPHA_CONTENT_MIN) / w

    def col_fill(x: int) -> float:
        return sum(1 for y in range(h) if px[x, y][3] >= ALPHA_CONTENT_MIN) / h

    top = 0
    while top < h and row_fill(top) < ROW_COL_MIN_FILL:
        top += 1
    bottom = h - 1
    while bottom > top and row_fill(bottom) < ROW_COL_MIN_FILL:
        bottom -= 1
    left = 0
    while left < w and col_fill(left) < ROW_COL_MIN_FILL:
        left += 1
    right = w - 1
    while right > left and col_fill(right) < ROW_COL_MIN_FILL:
        right -= 1
    if top >= bottom or left >= right:
        return rgba
    return rgba.crop((left, top, right + 1, bottom + 1))


def trim_content(img: Image.Image) -> Image.Image:
    bbox = content_bbox(img)
    cropped = img.crop(bbox)
    return trim_empty_margin(cropped)


def bbox_coverage(img: Image.Image) -> tuple[float, float]:
    left, top, right, bottom = content_bbox(img)
    return (right - left) / img.width * 100, (bottom - top) / img.height * 100


def render_icon_contain(cropped: Image.Image, size: int) -> Image.Image:
    """Legacy contain fit — kept for before/after coverage reporting."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = max(1, int(round(size * (1 - PADDING_RATIO * 2))))
    cw, ch = cropped.size
    scale = min(inner / cw, inner / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = (size - nw) // 2
    oy = (size - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def render_icon(cropped: Image.Image, size: int) -> Image.Image:
    """Cover fit: scale to fill square, center-crop overflow, optional SCALE_BOOST."""
    inner = max(1, int(round(size * (1 - PADDING_RATIO * 2))))
    cw, ch = cropped.size
    scale = max(inner / cw, inner / ch) * SCALE_BOOST
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - inner) // 2
    top = max(0, (nh - inner) // 2 - int(nh * CROP_BIAS_Y))
    top = min(top, max(0, nh - inner))
    square = resized.crop((left, top, left + inner, top + inner))
    if inner == size:
        return square
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = (size - inner) // 2
    oy = (size - inner) // 2
    canvas.paste(square, (ox, oy), square)
    return square


def verify_transparent_corners(img: Image.Image, label: str) -> None:
    px = img.load()
    w, h = img.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    opaque = [c for c in corners if px[c][3] > 0]
    if opaque:
        print(f"WARNING {label}: opaque corners at {opaque}", file=sys.stderr)
    else:
        print(f"OK {label}: all four corners alpha=0")


def write_ico(path: Path, icons: list[Image.Image]) -> None:
    """Write multi-size ICO without extra dependencies."""
    if not icons:
        raise ValueError("No icons to write")

    entries: list[tuple[Image.Image, bytes]] = []
    for icon in icons:
        png_bytes = _png_bytes(icon)
        entries.append((icon, png_bytes))

    offset = 6 + 16 * len(entries)
    chunks: list[bytes] = []
    directory: list[bytes] = []

    for icon, png_bytes in entries:
        size = icon.size[0]
        w_byte = 0 if size >= 256 else size
        h_byte = 0 if size >= 256 else size
        directory.append(
            struct.pack(
                "<BBBBHHII",
                w_byte,
                h_byte,
                0,
                0,
                1,
                32,
                len(png_bytes),
                offset,
            )
        )
        chunks.append(png_bytes)
        offset += len(png_bytes)

    header = struct.pack("<HHH", 0, 1, len(entries))
    with path.open("wb") as f:
        f.write(header)
        for entry in directory:
            f.write(entry)
        for chunk in chunks:
            f.write(chunk)


def _png_bytes(img: Image.Image) -> bytes:
    from io import BytesIO

    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def main() -> int:
    if not SOURCE.exists():
        print(f"Source not found: {SOURCE}", file=sys.stderr)
        return 1

    raw = Image.open(SOURCE)
    transparent = flood_fill_background(raw)
    cropped = trim_content(transparent)
    cw, ch = cropped.size
    print(f"Source cropped: {cw}x{ch} (aspect {cw / ch:.3f})")

    before_w, before_h = bbox_coverage(render_icon_contain(cropped, 512))
    print(
        f"Coverage 512px (contain, before): width={before_w:.1f}%, height={before_h:.1f}%"
    )

    FAVICON_PNG.parent.mkdir(parents=True, exist_ok=True)

    master = render_icon(cropped, 512)
    after_w, after_h = bbox_coverage(master)
    print(
        f"Coverage 512px (cover+boost, after): width={after_w:.1f}%, height={after_h:.1f}%"
    )
    verify_transparent_corners(master, "512px PNG")
    master.save(FAVICON_PNG, format="PNG", optimize=True)
    print(f"Wrote {FAVICON_PNG} ({FAVICON_PNG.stat().st_size} bytes)")

    ico_icons = [render_icon(cropped, s) for s in ICO_SIZES]
    write_ico(FAVICON_ICO, ico_icons)
    print(f"Wrote {FAVICON_ICO} ({FAVICON_ICO.stat().st_size} bytes)")

    icon_192 = render_icon(cropped, 192)
    for size in PNG_SIZES:
        if size == 512:
            continue
        out = ROOT / "assets" / f"favicon-{size}.png"
        (icon_192 if size == 192 else render_icon(cropped, size)).save(
            out, format="PNG", optimize=True
        )
        print(f"Wrote {out}")

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_ICO.write_bytes(FAVICON_ICO.read_bytes())
    master.save(PUBLIC_PNG, format="PNG", optimize=True)
    icon_192.save(PUBLIC_APPLE, format="PNG", optimize=True)
    print(f"Synced {PUBLIC_ICO}, {PUBLIC_PNG}, and {PUBLIC_APPLE}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
