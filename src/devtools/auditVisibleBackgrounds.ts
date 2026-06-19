/**
 * Runtime DOM audit for large light/white visible backgrounds.
 * Thresholds match console audit snippet: brightness > 205, area > 5000, alpha > 0.4.
 */

export type BackgroundOffender = {
  tag: string;
  className: string;
  testId: string | null;
  id: string | null;
  backgroundColor: string;
  rect: { x: number; y: number; width: number; height: number };
  area: number;
  brightness: number;
  alpha: number;
};

export type AuditVisibleBackgroundsOptions = {
  minBrightness?: number;
  minArea?: number;
  minAlpha?: number;
  outline?: boolean;
  topN?: number;
};

const OUTLINE_ATTR = 'data-care-audit-outline';

function parseBackgroundColor(color: string): { r: number; g: number; b: number; a: number } | null {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
    return null;
  }

  const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgb) {
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: 1 };
  }

  const rgba = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
  if (rgba) {
    return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: +rgba[4] };
  }

  return null;
}

function luminance(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function isVisible(rect: DOMRect): boolean {
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0;
}

function clearAuditOutlines(): void {
  document.querySelectorAll(`[${OUTLINE_ATTR}]`).forEach((node) => node.remove());
}

function outlineOffenders(entries: Array<{ el: Element; index: number }>): void {
  clearAuditOutlines();

  entries.forEach(({ el, index }) => {
    const rect = el.getBoundingClientRect();
    const box = document.createElement('div');
    box.setAttribute(OUTLINE_ATTR, String(index + 1));
    box.style.position = 'fixed';
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.pointerEvents = 'none';
    box.style.zIndex = '2147483646';
    box.style.boxSizing = 'border-box';
    box.style.border = '2px solid #ff3b30';
    box.style.background = 'rgba(255,59,48,0.08)';
    box.style.color = '#fff';
    box.style.font = '11px/1.2 monospace';
    box.style.padding = '2px 4px';
    box.textContent = `#${index + 1}`;
    document.body.appendChild(box);
  });
}

export function auditVisibleBackgrounds(
  options: AuditVisibleBackgroundsOptions = {},
): BackgroundOffender[] {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return [];
  }

  const minBrightness = options.minBrightness ?? 205;
  const minArea = options.minArea ?? 5000;
  const minAlpha = options.minAlpha ?? 0.4;
  const topN = options.topN ?? 20;
  const shouldOutline =
    options.outline ?? (typeof __DEV__ !== 'undefined' && __DEV__);

  const offenders: Array<BackgroundOffender & { el: Element }> = [];

  for (const el of Array.from(document.querySelectorAll('*'))) {
    if (!(el instanceof Element)) continue;

    const rect = el.getBoundingClientRect();
    if (!isVisible(rect)) continue;

    const area = rect.width * rect.height;
    if (area < minArea) continue;

    const bg = window.getComputedStyle(el).backgroundColor;
    const parsed = parseBackgroundColor(bg);
    if (!parsed || parsed.a < minAlpha) continue;

    const brightness = luminance(parsed.r, parsed.g, parsed.b);
    if (brightness <= minBrightness) continue;

    offenders.push({
      el,
      tag: el.tagName.toLowerCase(),
      className: typeof el.className === 'string' ? el.className : '',
      testId: el.getAttribute('data-testid'),
      id: el.getAttribute('id'),
      backgroundColor: bg,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      area: Math.round(area),
      brightness: Math.round(brightness * 10) / 10,
      alpha: parsed.a,
    });
  }

  offenders.sort((a, b) => b.area - a.area);

  if (shouldOutline) {
    outlineOffenders(
      offenders.slice(0, topN).map((entry, index) => ({ el: entry.el, index })),
    );
  }

  return offenders.slice(0, topN).map(({ el: _el, ...rest }) => rest);
}
