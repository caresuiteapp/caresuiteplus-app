#!/usr/bin/env python3
"""Generate CareSuite+ premium minimalist animated loading GIF."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "images" / "caresuite-loading.gif"

# Render supersampled for crisp edges, then downscale.
SCALE = 2
WIDTH = 1200
HEIGHT = 400
FPS = 30
DURATION = 2.8
NUM_FRAMES = int(FPS * DURATION)

TEXT = "CareSuite+"
FONT_SIZE = 104
DOT_RADIUS = 7
DOT_SPACING = 34
DOT_ROW_GAP = 40

# Controlled premium spectrum — blue / cyan / indigo / violet / magenta / pink.
SPECTRUM = [
    (88, 156, 255),
    (72, 210, 255),
    (92, 198, 232),
    (118, 142, 255),
    (156, 118, 255),
    (196, 128, 255),
    (255, 142, 210),
]

BASE_TEXT = (236, 240, 248)
ACCENT_BLEND = 0.42
SHIMMER_BLEND = 0.55


def lerp_color(
    c1: tuple[int, int, int],
    c2: tuple[int, int, int],
    t: float,
) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def spectrum_color(position: float) -> tuple[int, int, int]:
    pos = position % 1.0
    n = len(SPECTRUM)
    idx = pos * n
    i = int(idx) % n
    j = (i + 1) % n
    t = idx - int(idx)
    return lerp_color(SPECTRUM[i], SPECTRUM[j], t)


def create_text_fill(width: int, height: int, offset: float) -> Image.Image:
    img = Image.new("RGBA", (width, height))
    pixels = img.load()
    for x in range(width):
        accent = spectrum_color((x / max(width - 1, 1)) + offset)
        color = lerp_color(BASE_TEXT, accent, ACCENT_BLEND)
        for y in range(height):
            pixels[x, y] = (*color, 255)
    return img


def render_text_mask(
    text: str,
    font: ImageFont.FreeTypeFont,
    padding: int = 56,
) -> tuple[Image.Image, int, int]:
    dummy = Image.new("L", (1, 1))
    draw = ImageDraw.Draw(dummy)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0] + padding * 2
    th = bbox[3] - bbox[1] + padding * 2

    mask = Image.new("L", (tw, th), 0)
    draw = ImageDraw.Draw(mask)
    draw.text((padding - bbox[0], padding - bbox[1]), text, fill=255, font=font)
    return mask, tw, th


def create_shimmer_overlay(
    width: int,
    height: int,
    position: float,
    mask: Image.Image,
    offset: float,
) -> Image.Image:
    shimmer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    band_width = max(12, int(width * 0.11))
    center = int(position * (width + band_width)) - band_width // 2
    highlight = lerp_color((255, 255, 255), spectrum_color(offset + 0.18), SHIMMER_BLEND)

    pixels = shimmer.load()
    mask_pixels = mask.load()
    for x in range(width):
        dist = abs(x - center)
        if dist >= band_width:
            continue
        intensity = (1.0 - dist / band_width) ** 3.2
        alpha = int(72 * intensity)
        if alpha <= 0:
            continue
        for y in range(height):
            if mask_pixels[x, y] > 0:
                pixels[x, y] = (*highlight, alpha)

    return shimmer


def subtle_glow(layer: Image.Image) -> Image.Image:
    glow = layer.filter(ImageFilter.GaussianBlur(5))
    pixels = glow.load()
    for y in range(glow.height):
        for x in range(glow.width):
            r, g, b, a = pixels[x, y]
            if a:
                pixels[x, y] = (r, g, b, min(255, int(a * 0.18)))
    return glow


def dot_pulse(frame_idx: int, dot_index: int) -> tuple[float, int]:
    phase = (frame_idx / NUM_FRAMES + dot_index / 3.0) % 1.0
    local = (phase * 3.0) % 1.0
    if local < 0.38:
        pulse = math.sin((local / 0.38) * math.pi) ** 1.15
    else:
        pulse = 0.18
    scale = 0.9 + 0.22 * pulse
    opacity = int(52 + 168 * pulse)
    return scale, opacity


def resize_rgba(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.resize(size, Image.Resampling.LANCZOS)


def generate_frame(
    frame_idx: int,
    text_mask: Image.Image,
    text_w: int,
    text_h: int,
) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH * SCALE, HEIGHT * SCALE), (0, 0, 0, 0))

    loop_t = frame_idx / NUM_FRAMES
    breath = 1.0 + 0.006 * math.sin(2 * math.pi * loop_t)
    grad_offset = loop_t * 0.85
    shimmer_pos = (loop_t * 1.2) % 1.2

    fill = create_text_fill(text_w, text_h, grad_offset)
    text_layer = Image.new("RGBA", (text_w, text_h), (0, 0, 0, 0))
    text_layer.paste(fill, (0, 0), text_mask)

    shimmer = create_shimmer_overlay(text_w, text_h, shimmer_pos, text_mask, grad_offset)
    text_layer = Image.alpha_composite(text_layer, shimmer)
    glow = subtle_glow(text_layer)

    if breath != 1.0:
        scaled_w = max(1, int(text_w * breath))
        scaled_h = max(1, int(text_h * breath))
        text_layer = resize_rgba(text_layer, (scaled_w, scaled_h))
        glow = resize_rgba(glow, (scaled_w, scaled_h))
        text_w_render, text_h_render = scaled_w, scaled_h
    else:
        text_w_render, text_h_render = text_w, text_h

    dots_block_h = DOT_ROW_GAP + DOT_RADIUS * 2
    content_h = text_h_render + dots_block_h
    text_x = ((WIDTH * SCALE) - text_w_render) // 2
    text_y = ((HEIGHT * SCALE) - content_h) // 2

    canvas.alpha_composite(glow, (text_x, text_y))
    canvas.alpha_composite(text_layer, (text_x, text_y))

    dots_y = text_y + text_h_render + DOT_ROW_GAP + DOT_RADIUS
    center_x = (WIDTH * SCALE) // 2
    dot_xs = [center_x - DOT_SPACING * SCALE, center_x, center_x + DOT_SPACING * SCALE]

    draw = ImageDraw.Draw(canvas)
    for i, dot_x in enumerate(dot_xs):
        scale, opacity = dot_pulse(frame_idx, i)
        radius = DOT_RADIUS * SCALE * scale
        color = spectrum_color(grad_offset + i * 0.09)

        halo_r = radius + 3 * SCALE
        draw.ellipse(
            (dot_x - halo_r, dots_y - halo_r, dot_x + halo_r, dots_y + halo_r),
            fill=(*color, int(opacity * 0.14)),
        )
        draw.ellipse(
            (dot_x - radius, dots_y - radius, dot_x + radius, dots_y + radius),
            fill=(*color, opacity),
        )

    return canvas.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def rgba_to_paletted(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.split()[3]
    rgb = rgba.convert("RGB")
    paletted = rgb.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    mask = Image.eval(alpha, lambda value: 255 if value < 12 else 0)
    paletted.paste(0, mask)
    return paletted


def load_font() -> ImageFont.FreeTypeFont:
    candidates = [
        Path(r"C:\Windows\Fonts\segoeui.ttf"),
        Path(r"C:\Windows\Fonts\seguisb.ttf"),
        Path(r"C:\Windows\Fonts\calibri.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), FONT_SIZE * SCALE)
    return ImageFont.load_default()


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    font = load_font()
    text_mask, text_w, text_h = render_text_mask(TEXT, font)

    frames = [generate_frame(i, text_mask, text_w, text_h) for i in range(NUM_FRAMES)]
    paletted_frames = [rgba_to_paletted(frame) for frame in frames]

    duration_ms = int(1000 / FPS)
    paletted_frames[0].save(
        OUTPUT,
        save_all=True,
        append_images=paletted_frames[1:],
        duration=duration_ms,
        loop=0,
        transparency=0,
        disposal=2,
        optimize=True,
    )

    size_kb = OUTPUT.stat().st_size / 1024
    print(f"Saved: {OUTPUT}")
    print(f"Size: {size_kb:.1f} KB")
    print(f"Dimensions: {WIDTH}x{HEIGHT}, {NUM_FRAMES} frames @ {FPS} fps ({DURATION}s loop)")


if __name__ == "__main__":
    main()
