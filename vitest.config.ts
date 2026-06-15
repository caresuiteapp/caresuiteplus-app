import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: [
      {
        find: '@/lib/supabase/client',
        replacement: path.resolve(__dirname, 'src/__tests__/mocks/supabaseClient.ts'),
      },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
});
