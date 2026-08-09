// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist*/**/*'],
  overrides: [
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
