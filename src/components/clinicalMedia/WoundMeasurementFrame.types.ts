export type WoundMeasurementFrameProps = {
  html: string;
  onMeasurement: (measurement: unknown) => void;
};

export function readMeasurementFrameMessage(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (message.type === 'wound-measurement' && message.measurement && typeof message.measurement === 'object') {
    return { type: 'measurement' as const, value: message.measurement };
  }
  if (message.type === 'wound-editor-height' && typeof message.height === 'number' && Number.isFinite(message.height)) {
    return { type: 'height' as const, value: Math.max(250, Math.min(1800, Math.ceil(message.height))) };
  }
  return null;
}
