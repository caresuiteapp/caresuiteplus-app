// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  // Built marketing bundles are outputs. The separate marketing package has
  // its own dependencies and build; checks for it require that package context.
  ignorePatterns: ['/dist*/**/*', '/public/landingpage/assets/**/*.js', '/marketing/healthos-landingpage/**'],
  rules: {
    // Expo 57's ESLint preset enables React Compiler diagnostics. CareSuite does
    // not enable the React Compiler yet, so these opt-in migration diagnostics
    // must not be treated as runtime or release errors.
    'react-hooks/immutability': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/purity': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/static-components': 'off',
    'react-hooks/use-memo': 'off',
  },
  overrides: [
    {
      files: ['public/platform-runtime.js', 'public/platform-observation.js'],
      env: { browser: true, es2021: true },
    },
    {
      files: ['public/neo-voice/v1/neo-worker.js'],
      env: { worker: true, es2021: true },
      // Loaded by this worker's importScripts calls.
      globals: { ort: 'readonly', createPiperPhonemize: 'readonly' },
    },
    {
      // This serverless API handler runs in Node.js, not in the browser.
      files: ['api/**/*.js'],
      env: { node: true },
    },
    {
      // Expo Router and a few source-contract tests intentionally require modules dynamically.
      files: ['app/_layout.tsx', 'app/_layout.web.tsx', 'src/__tests__/**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        'import/first': 'off',
      },
    },
    {
      // These shell variants are retained for the next responsive cutover.
      files: ['src/liquid-command/shell/LiquidCommandShell.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      // Supabase Edge Functions are executed by Deno and intentionally use
      // URL imports. Node's import resolver cannot resolve those modules.
      files: ['supabase/functions/**/*.ts'],
      rules: {
        'import/no-unresolved': ['error', { ignore: ['^https://'] }],
      },
    },
    {
      // React Three Fiber extends JSX with Three.js scene properties.
      files: [
        'src/components/pflege/bodyMap3d/**/*.{ts,tsx}',
        'src/screens/pflege/BodyMap*.tsx',
      ],
      rules: {
        'react/no-unknown-property': 'off',
      },
    },
  ],
};
