import type { NeoVercelEngine } from './neo-vercel-handler';

/** Keep ESM outside the CommonJS startup graph emitted for Vercel API routes. */
export function createNeoVercelRuntimeEngine(): NeoVercelEngine {
  let pending: Promise<NeoVercelEngine> | undefined;
  const load = () => {
    pending ??= import('./neo-vercel-engine.mjs').then(module => module.createNeoVercelEngine()).catch(error => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
  return {
    status: async () => (await load()).status(),
    transcribe: async (audio, signal) => {
      signal.throwIfAborted();
      const engine = await load();
      signal.throwIfAborted();
      return engine.transcribe(audio, signal);
    },
  };
}
