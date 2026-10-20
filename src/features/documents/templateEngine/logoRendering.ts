export type LogoRenderInput = {
  logoUrl: string | null;
  companyName: string;
  widthMm: number;
  naturalWidthPx?: number | null;
  naturalHeightPx?: number | null;
};

export type LogoRenderDimensions = {
  widthMm: number;
  heightMm: number;
};

const MIN_LOGO_WIDTH_MM = 35;
const MAX_LOGO_WIDTH_MM = 55;

/** Berechnet Logo-Höhe proportional — keine Verzerrung. */
export function calculateLogoDimensions(input: {
  widthMm: number;
  naturalWidthPx?: number | null;
  naturalHeightPx?: number | null;
}): LogoRenderDimensions {
  const widthMm = clampLogoWidth(input.widthMm);
  const nw = input.naturalWidthPx ?? 0;
  const nh = input.naturalHeightPx ?? 0;

  if (nw > 0 && nh > 0) {
    const aspect = nh / nw;
    return { widthMm, heightMm: round1(widthMm * aspect) };
  }

  // Fallback-Seitenverhältnis 3:1 (typisch für Logos)
  return { widthMm, heightMm: round1(widthMm / 3) };
}

export function clampLogoWidth(widthMm: number): number {
  return Math.min(MAX_LOGO_WIDTH_MM, Math.max(MIN_LOGO_WIDTH_MM, widthMm));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** HTML für Logo — object-fit/contain-Äquivalent via expliziten Maßen. */
export function buildLogoHtml(input: LogoRenderInput): string {
  const dims = calculateLogoDimensions({
    widthMm: input.widthMm,
    naturalWidthPx: input.naturalWidthPx,
    naturalHeightPx: input.naturalHeightPx,
  });

  if (input.logoUrl?.trim()) {
    return `<img class="cs-logo" src="${escapeAttr(input.logoUrl)}" alt="Logo" width="${dims.widthMm}mm" height="${dims.heightMm}mm" style="width:${dims.widthMm}mm;height:${dims.heightMm}mm;object-fit:contain;" />`;
  }

  const name = escapeHtml(input.companyName.trim() || 'Unternehmen');
  return `<div class="cs-logo cs-logo-text" style="width:${dims.widthMm}mm;font-weight:700;font-size:14pt;">${name}</div>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
