import { createNeoVercelHandler } from '../_lib/neo-vercel-handler';
import { createNeoVercelRuntimeEngine } from '../_lib/neo-vercel-runtime';
export default createNeoVercelHandler('transcribe', { fetch: globalThis.fetch, engine: createNeoVercelRuntimeEngine(), env: { EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY } });
