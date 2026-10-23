/** The existing glyphs mix fixed paths with size-relative rings. Draw them once
 * at a stable size, then scale the complete drawing to the shell's optical stage.
 * Otherwise the 34px KPI glyphs are clipped by 24–32px icon frames.
 */
export const SPACE_GLYPH_DRAWING_SIZE = 40;
export const SPACE_GLYPH_STAGE_RATIO = 0.86;

export function spaceGlyphGeometry(size: number, glyph?: string) {
  // These drawings are asymmetric: the invoice's back page is offset by 8/6px;
  // the office tower aligns its 31px drawing to the bottom of the 40px plane.
  const invoice = glyph === 'invoice' || glyph === 'mkpiOfficeInvoice';
  return {
    drawingSize: SPACE_GLYPH_DRAWING_SIZE,
    stageSize: size * SPACE_GLYPH_STAGE_RATIO,
    scale: (size * SPACE_GLYPH_STAGE_RATIO) / SPACE_GLYPH_DRAWING_SIZE,
    offsetX: invoice ? -4 : 0,
    offsetY: invoice ? -3 : glyph === 'office' ? -4.5 : 0,
  };
}
