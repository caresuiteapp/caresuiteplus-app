import { createGkvTestExportHandler } from '../_lib/gkv-test-export';
export default createGkvTestExportHandler({ fetch, env: {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
} });
