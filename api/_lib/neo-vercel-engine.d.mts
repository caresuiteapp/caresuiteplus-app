import type { ExecFileOptions } from 'node:child_process';
import type { Worker, WorkerOptions } from 'node:worker_threads';
export const NEO_VERCEL_MODELS: Readonly<Record<string, { size: number; sha256: string }>>;
export const NEO_VERCEL_WASM: Readonly<{ file: string; size: number; sha256: string }>;
export function validateNeoVercelWav(bytes: Buffer): { seconds: number; rms: number };
export function decodeNeoVercelSamples(bytes: Buffer): Float32Array;
export class NeoWasmClient {
  constructor(configuration: { source: string; model: string }, options?: { createWorker?: (url: URL, options: WorkerOptions) => Worker; timeoutMs?: number });
  prepare(signal?: AbortSignal): Promise<void>;
  transcribe(samples: Float32Array, signal: AbortSignal): Promise<{ text: string; engine: string }>;
  close(reason?: Error): Promise<{ terminatedChildren: number }>;
}
export function createNeoVercelEngine(options?: { assetDirectory?: string; enabled?: boolean; allowUnvalidatedArtifacts?: boolean; forceWasm?: boolean; execute?: (file: string, args: string[], options: ExecFileOptions) => Promise<unknown>; wasmOptions?: { createWorker?: (url: URL, options: WorkerOptions) => Worker; timeoutMs?: number } }): {
  status(): Promise<{ transcriptionReady: boolean; backend: 'native' | 'wasm' | 'unavailable' }>;
  transcribe(encoded: string, signal: AbortSignal): Promise<{ text: string; engine: string }>;
  dispose(): Promise<void>;
};

export function runNeoInferenceWithFallback<T>(options: { native?: (signal: AbortSignal) => Promise<T>; wasm: (signal: AbortSignal) => Promise<T>; signal: AbortSignal; onNativeFailure?: () => void; budgetMs?: number; minimumFallbackMs?: number; now?: () => number }): Promise<T>;
