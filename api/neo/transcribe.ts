import { createNeoVercelHandler } from '../_lib/neo-vercel-handler';
import { createNeoVercelEngine } from '../_lib/neo-vercel-engine.mjs';
export default createNeoVercelHandler('transcribe', { fetch: globalThis.fetch, engine: createNeoVercelEngine(), env: { EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY } });
