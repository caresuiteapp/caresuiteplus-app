export type PhotoPoint = { x: number; y: number };
export type PhotoScale = { from: PhotoPoint; to: PhotoPoint; millimetres: number };
export type Tissue = 'necrosis' | 'granulation' | 'fibrin' | 'epithelium';
export type TissueSection = { tissue: Tissue } & (
  | { shape: PhotoPoint[] }
  | { sample: [number, number, number]; tolerance: number }
);
export type WoundTrace = {
  width: number;
  height: number;
  outline: PhotoPoint[];
  scale: PhotoScale;
  sections: TissueSection[];
};
export type WoundMeasurement = WoundTrace & {
  areaCm2: number;
  lengthCm: number;
  widthCm: number;
  shares: Record<Tissue | 'unassigned', number>;
};

export const TISSUE_LABELS: Record<Tissue | 'unassigned', string> = {
  necrosis: 'Nekrose', granulation: 'Granulation', fibrin: 'Fibrin',
  epithelium: 'Epithel', unassigned: 'Nicht zugeordnet',
};

/** The editor runs this same self-contained implementation in an isolated frame. */
export function woundPlanimetryRuntime() {
  const tissueKeys = ['necrosis', 'granulation', 'fibrin', 'epithelium'] as const;
  function pointValid(point: PhotoPoint) {
    return !!point && Number.isFinite(point.x) && Number.isFinite(point.y)
      && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
  }

  function cross(a: PhotoPoint, b: PhotoPoint, c: PhotoPoint) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  function distance(a: PhotoPoint, b: PhotoPoint) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pixel(point: PhotoPoint, width: number, height: number) {
    return { x: point.x * width, y: point.y * height };
  }

  function area(contour: PhotoPoint[]) {
    let twiceArea = 0;
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i], b = contour[(i + 1) % contour.length];
      twiceArea += a.x * b.y - b.x * a.y;
    }
    return Math.abs(twiceArea) / 2;
  }

  function overlapping(a: PhotoPoint, b: PhotoPoint, c: PhotoPoint, d: PhotoPoint) {
    if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x)
      || Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) return false;
    return cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0;
  }

  function usableContour(contour: PhotoPoint[]) {
    if (!Array.isArray(contour) || contour.length < 3 || contour.length > 600
      || !contour.every(pointValid) || area(contour) === 0) return false;
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i], b = contour[(i + 1) % contour.length];
      if (distance(a, b) < 1e-8) return false;
      for (let j = i + 2; j < contour.length; j++) {
        if (i === 0 && j === contour.length - 1) continue;
        if (overlapping(a, b, contour[j], contour[(j + 1) % contour.length])) return false;
      }
    }
    return true;
  }

  function dimensions(trace: Pick<WoundTrace, 'outline' | 'width' | 'height'> & { scale?: PhotoScale }) {
    const { outline, width, height, scale } = trace;
    if (!Number.isInteger(width) || width < 2 || width > 50000
      || !Number.isInteger(height) || height < 2 || height > 50000 || !usableContour(outline)) return null;
    const pixels = outline.map(point => pixel(point, width, height));
    let longest = 0, first = pixels[0], last = pixels[1];
    for (let i = 0; i < pixels.length; i++) {
      for (let j = i + 1; j < pixels.length; j++) {
        const length = distance(pixels[i], pixels[j]);
        if (length > longest) { longest = length; first = pixels[i]; last = pixels[j]; }
      }
    }
    const unitDistance = scale && pointValid(scale.from) && pointValid(scale.to) && Number.isFinite(scale.millimetres)
      && scale.millimetres > 0 && scale.millimetres <= 1000
      ? distance(pixel(scale.from, width, height), pixel(scale.to, width, height)) : 0;
    const cmPerPixel = scale && unitDistance >= 10 ? scale.millimetres / 10 / unitDistance : null;
    // Width is the full projection perpendicular to the longest chord.
    const spans = pixels.map(p => cross(first, last, p) / longest);
    const areaPx2 = area(pixels), widthPx = Math.max(...spans) - Math.min(...spans);
    return {
      areaPx2, lengthPx: longest, widthPx,
      centimetres: cmPerPixel === null ? null : {
        areaCm2: areaPx2 * cmPerPixel ** 2,
        lengthCm: longest * cmPerPixel, widthCm: widthPx * cmPerPixel,
      },
    };
  }

  function spansAt(contour: PhotoPoint[], y: number, width: number) {
    const xs: number[] = [];
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i], b = contour[(i + 1) % contour.length];
      if ((a.y <= y && y < b.y) || (b.y <= y && y < a.y)) {
        xs.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
      }
    }
    xs.sort((a, b) => a - b);
    const spans: [number, number][] = [];
    for (let i = 0; i + 1 < xs.length; i += 2) {
      spans.push([Math.max(0, Math.ceil(xs[i] * width - .5)), Math.min(width, Math.ceil(xs[i + 1] * width - .5))]);
    }
    return spans;
  }

  function segment(outline: PhotoPoint[], sections: TissueSection[], image: {
    width: number; height: number; data: Uint8ClampedArray;
  }) {
    const { width, height, data } = image;
    const mask = new Int8Array(width * height);
    if (!usableContour(outline)) return null;
    for (let y = 0; y < height; y++) {
      const row = y * width, normalizedY = (y + .5) / height;
      const inside = spansAt(outline, normalizedY, width);
      for (const [start, end] of inside) mask.fill(1, row + start, row + end);
      for (const section of sections) {
        const code = tissueKeys.indexOf(section.tissue) + 2;
        const ranges = 'shape' in section ? spansAt(section.shape, normalizedY, width) : inside;
        for (const [start, end] of ranges) {
          for (let x = start; x < end; x++) {
            const offset = row + x;
            if (!mask[offset]) continue;
            if ('sample' in section) {
              const [r, g, b] = section.sample;
              const i = offset * 4;
              const square = (data[i] - r) ** 2 + (data[i + 1] - g) ** 2 + (data[i + 2] - b) ** 2;
              if (square > section.tolerance ** 2) continue;
            }
            mask[offset] = code;
          }
        }
      }
    }
    const counts = [0, 0, 0, 0, 0, 0];
    for (const value of mask) counts[value]++;
    const total = width * height - counts[0];
    if (!total) return null;
    const percentages = counts.slice(1).map(n => n * 10000 / total);
    const units = percentages.map(Math.floor);
    const order = percentages.map((n, i) => ({ fraction: n - units[i], i })).sort((a, b) => b.fraction - a.fraction);
    const remainder = 10000 - units.reduce((sum, n) => sum + n, 0);
    for (const { i } of order.slice(0, remainder)) units[i]++;
    return {
      mask,
      shares: { unassigned: units[0] / 100, necrosis: units[1] / 100, granulation: units[2] / 100,
        fibrin: units[3] / 100, epithelium: units[4] / 100 },
    };
  }

  return { usableContour, dimensions, segment };
}

export const woundPlanimetry = woundPlanimetryRuntime();
