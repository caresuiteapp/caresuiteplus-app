import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('company access in the Web bundle', () => {
  it('exports the shared hook when Web files take precedence over generic TypeScript files', async () => {
    // Vitest normally selects .ts before .web.ts. Metro does the reverse on
    // Web, so an extensionless facade can accidentally re-export itself.
    const bundle = await build({
      absWorkingDir: projectRoot,
      stdin: {
        contents: "export { useCompanyAccess } from './src/hooks/useCompanyAccess.web';",
        resolveDir: projectRoot,
        loader: 'ts',
      },
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs',
      logLevel: 'silent',
      resolveExtensions: ['.web.ts', '.web.tsx', '.ts', '.tsx', '.js'],
      external: ['react'],
      plugins: [{
        name: 'isolated-company-service',
        setup(builder) {
          builder.onResolve({ filter: /^@\/lib\/tenant\/companyAccessService$/ }, () => ({
            path: 'company-service', namespace: 'fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents: "export function loadCompanyAccess() { throw new Error('No live requests in this bundle test.'); }",
          }));
        },
      }],
    });
    const result = { exports: {} as Record<string, unknown> };
    new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(
      createRequire(import.meta.url), result, result.exports,
    );
    expect(result.exports.useCompanyAccess).toBeTypeOf('function');
  });
});
