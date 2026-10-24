type Rgba = readonly [number, number, number, number];

function color(value: string): Rgba | null {
  value = value.trim().toLowerCase();
  if (value === 'transparent') return [0, 0, 0, 0];
  if (value === 'white') return [255, 255, 255, 1];
  if (value === 'black') return [0, 0, 0, 1];
  const hex = value.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map(char => char + char).join('') : hex;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1];
  }
  const rgb = value.match(/^rgba?\((.*)\)$/)?.[1];
  if (!rgb) return null;
  const parts = rgb.trim().split(/\s*[,/]\s*|\s+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4 || parts.some(part => !/^[\d.]+%?$/.test(part))) return null;
  const channel = (part: string) => Math.max(0, Math.min(255, parseFloat(part) * (part.endsWith('%') ? 2.55 : 1)));
  const alpha = parts[3] === undefined ? 1 : Math.max(0, Math.min(1, parseFloat(parts[3]) / (parts[3].endsWith('%') ? 100 : 1)));
  return [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha];
}

function terms(value: string): string[] {
  const result: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (value[i] === ',' && depth === 0) { result.push(value.slice(start, i).trim()); start = i + 1; }
  }
  result.push(value.slice(start).trim());
  return result;
}

// CSS Color 4/5: normalize percentages, interpolate premultiplied sRGB,
// then unpremultiply before applying any percentage-sum alpha multiplier.
// https://www.w3.org/TR/css-color-5/#color-mix
// https://www.w3.org/TR/css-color-4/#interpolation-alpha
export function resolveWorkspaceColorMixes(value: string, level = 0): string {
  if (level >= 12) return value;
  let cursor = 0;
  while (cursor < value.length) {
    const start = value.indexOf('color-mix(', cursor);
    if (start < 0) break;
    let end = start + 10, depth = 1;
    while (end < value.length && depth) { if (value[end] === '(') depth++; if (value[end] === ')') depth--; end++; }
    if (depth) break;
    const parts = terms(value.slice(start + 10, end - 1));
    const parse = (part: string) => {
      const weight = part.match(/\s+([\d.]+)%$/);
      return { rgba: color(resolveWorkspaceColorMixes(weight ? part.slice(0, weight.index) : part, level + 1)), weight: weight ? Number(weight[1]) / 100 : undefined };
    };
    let replacement: string | null = null;
    if (parts.length === 3 && parts[0] === 'in srgb') {
      const a = parse(parts[1]), b = parse(parts[2]);
      const wa = a.weight ?? (b.weight === undefined ? .5 : 1 - b.weight), wb = b.weight ?? 1 - wa, sum = wa + wb;
      if (a.rgba && b.rgba && wa >= 0 && wa <= 1 && wb >= 0 && wb <= 1 && sum > 0) {
        const aa = a.rgba[3] * wa / sum, ab = b.rgba[3] * wb / sum, alpha = aa + ab;
        const rgb = [0, 1, 2].map(index => alpha ? Math.round((a.rgba![index] * aa + b.rgba![index] * ab) / alpha) : 0);
        replacement = `rgba(${rgb.join(',')},${Number((alpha * Math.min(1, sum)).toFixed(6))})`;
      }
    }
    if (replacement) { value = value.slice(0, start) + replacement + value.slice(end); cursor = start + replacement.length; }
    else cursor = end;
  }
  return value;
}
