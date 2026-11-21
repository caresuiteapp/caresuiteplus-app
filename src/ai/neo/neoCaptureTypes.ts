export type NeoCaptureSource = 'own' | 'device';
export type NeoCaptureCallbacks = {
  onText: (text: string, startedAt: number, endedAt: number) => void;
  onStatus: (state: 'starting' | 'listening' | 'processing' | 'paused') => void;
  onError: (message: string) => void;
  transcribe: (wav: Uint8Array, signal: AbortSignal) => Promise<string>;
};
export type NeoCapture = { start(): Promise<void>; stop(): Promise<void>; cancel(): void };
