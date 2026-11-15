export const BODY_MAP_PATH = '/bodymap3d/v10/index.html';
export const BODY_MAP_FIGURES = ['older-man', 'older-woman', 'adult-man', 'adult-woman', 'boy', 'girl'] as const;
export type WoundFigure = typeof BODY_MAP_FIGURES[number];
const REGIONS = ['torso', 'hand', 'foot', 'eye', 'ear', 'head', 'back', 'arm', 'knee', 'pelvis'] as const;
const CATEGORIES = ['Hautbefund', 'Wunde', 'Verletzung', 'Druckstelle', 'Katheterstelle', 'Sonstiges'] as const;
type Vector = [number, number, number];
export type WoundBodyMark = {
  name: string; kind: typeof CATEGORIES[number]; text: string; figure: WoundFigure;
  focusRegion: typeof REGIONS[number] | null; side: 'left' | 'right';
  point?: Vector; target: Vector; yaw: number; pitch: number; height: number;
  detailAngle: number; anatomyIndex: number; clinical: boolean;
  diagram?: { view: number; x: number; y: number };
};
export type WoundBodyMapFrameProps = {
  marks?: (WoundBodyMark & { id: string })[];
  canWrite?: boolean;
  figure: WoundFigure;
  onMark?: (value: WoundBodyMark) => void;
  view?: 'preview' | 'location';
};
export const EMPTY_BODY_MARKS: NonNullable<WoundBodyMapFrameProps['marks']> = [];
const numeric = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const vector = (value: unknown): value is Vector =>
  Array.isArray(value) && value.length === 3 && value.every(n => numeric(n, -5, 5));

export function readBodyMark(value: unknown): WoundBodyMark | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const mark = value as WoundBodyMark;
  if (!BODY_MAP_FIGURES.includes(mark.figure) || !CATEGORIES.includes(mark.kind) || typeof mark.name !== 'string'
    || !mark.name.trim() || mark.name.length > 120 || typeof mark.text !== 'string' || mark.text.length > 1500
    || (mark.focusRegion !== null && !REGIONS.includes(mark.focusRegion)) || !['left', 'right'].includes(mark.side)
    || !vector(mark.target) || !numeric(mark.yaw, -10000, 10000) || !numeric(mark.pitch, -2, 2) || !numeric(mark.height, .01, 5)) return null;
  let diagram: WoundBodyMark['diagram'];
  if (mark.diagram) {
    if (!Number.isInteger(mark.diagram.view) || !numeric(mark.diagram.view, 0, 2)
        || !numeric(mark.diagram.x, 0, 100) || !numeric(mark.diagram.y, 0, 100)) return null;
    diagram = { view: mark.diagram.view, x: mark.diagram.x, y: mark.diagram.y };
  } else if (!vector(mark.point)) return null;
  const isChild = mark.figure === 'boy' || mark.figure === 'girl';
  return {
    name: mark.name.trim(), kind: mark.kind, text: mark.text.trim(), figure: mark.figure,
    focusRegion: mark.focusRegion, side: mark.side, ...(diagram ? { diagram } : { point: mark.point }),
    target: mark.target, yaw: mark.yaw, pitch: mark.pitch, height: mark.height,
    detailAngle: Number.isInteger(mark.detailAngle) && numeric(mark.detailAngle, 0, 4) ? mark.detailAngle : 0,
    anatomyIndex: Number.isInteger(mark.anatomyIndex) && numeric(mark.anatomyIndex, 0, 2) ? mark.anatomyIndex : 0,
    clinical: !isChild && mark.clinical === true,
  };
}

export function bodyMapMessage(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (message.type === 'caresuite-body-ready') return { type: 'ready' as const };
  if (message.type === 'caresuite-body-height' && numeric(message.height, 0, 16000)) {
    return { type: 'height' as const, height: Math.max(350, Math.min(2100, message.height + 4)) };
  }
  if (message.type === 'caresuite-body-mark') {
    const mark = readBodyMark(message.mark);
    if (mark) return { type: 'mark' as const, mark };
  }
  return null;
}
