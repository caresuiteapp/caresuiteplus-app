import type { ExecFileOptions } from 'node:child_process';
export function validateNeoVercelWav(bytes: Buffer): { seconds: number; rms: number };
export function createNeoVercelEngine(options?: { assetDirectory?: string; enabled?: boolean; execute?: (file: string, args: string[], options: ExecFileOptions) => Promise<unknown> }): {
  status(): Promise<{ transcriptionReady: boolean }>;
  transcribe(encoded: string, signal: AbortSignal): Promise<{ text: string; engine: string }>;
};
