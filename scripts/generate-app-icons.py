#!/usr/bin/env python3
"""Generate native icons from the approved Play/website artwork, never the mascot.

Uses the same Pillow toolchain as generate-favicon.py. No network requests.
"""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/landingpage/media/caresuite-assist-icon.webp'
CANONICAL = ROOT / 'assets/brand/caresuite-app-icon.png'
BACKGROUND = (248, 250, 252, 255)
SIZE = 1024
ADAPTIVE_SCALE = 0.70


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def frame(image, size, ratio=1.0, background=(0, 0, 0, 0)):
    inner = round(size * ratio)
    artwork = image.resize((inner, inner), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size), background)
    canvas.alpha_composite(artwork, ((size - inner) // 2, (size - inner) // 2))
    return canvas


def main():
    source = Image.open(SOURCE).convert('RGBA')
    if source.width != source.height or source.width < 256:
        raise ValueError('Approved store artwork must be square and at least 256 px.')
    CANONICAL.parent.mkdir(parents=True, exist_ok=True)
    source.save(CANONICAL, optimize=True)
    # The blue ring, CS and robot stay inside Android's 66/108 safe circle.
    # Only the light glass surround can be clipped by a launcher shape.
    foreground = frame(source, SIZE, ADAPTIVE_SCALE)
    # A themed icon is an alpha mask, not a grayscale square. Keep the actual
    # ring/robot contours and remove the white glass background.
    ink = ImageOps.grayscale(source).point(lambda value: 255 if value < 170 else 0)
    ink = Image.composite(ink, Image.new('L', source.size), source.getchannel('A'))
    silhouette = Image.new('RGBA', source.size, (255, 255, 255, 255))
    silhouette.putalpha(ink)
    outputs = {
        'icon.png': frame(source, SIZE, background=BACKGROUND),
        'android-icon-foreground.png': foreground,
        'android-icon-background.png': Image.new('RGBA', (SIZE, SIZE), BACKGROUND),
        'android-icon-monochrome.png': frame(silhouette, SIZE, ADAPTIVE_SCALE),
        'splash-icon.png': frame(source, SIZE, background=BACKGROUND),
        'notification-icon.png': frame(silhouette, 96, ADAPTIVE_SCALE),
    }
    for name, image in outputs.items():
        target = ROOT / 'assets' / name
        image.save(target, optimize=True)
        print(f'Wrote {target.relative_to(ROOT)}')
    manifest = {
        'source': str(SOURCE.relative_to(ROOT)),
        'sourceSha256': digest(SOURCE),
        'png': str(CANONICAL.relative_to(ROOT)),
        'pngSha256': digest(CANONICAL),
        'backgroundColor': '#F8FAFC',
        'adaptiveScale': ADAPTIVE_SCALE,
        'splashImageWidth': 200,
        'origin': 'Existing official Google Play artwork; marketing/healthos-landingpage/store-assets.sources.json',
    }
    (CANONICAL.parent / 'app-icon-source.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
