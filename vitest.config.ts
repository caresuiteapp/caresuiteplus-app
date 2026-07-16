import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
    env: {
      EXPO_PUBLIC_DEMO_MODE: 'true',
    },
  },
  resolve: {
    alias: [
      {
        find: '@/lib/supabase/client',
        replacement: path.resolve(__dirname, 'src/__tests__/mocks/supabaseClient.ts'),
      },
      {
        find: /^react-native$/,
        replacement: path.resolve(__dirname, 'node_modules/react-native-web'),
      },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
});
