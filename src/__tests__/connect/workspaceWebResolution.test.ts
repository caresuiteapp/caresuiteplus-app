import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
describe('real web module resolution for Google Workspace', () => {
  it('exports and executes the shared page loader when web files have precedence', async () => {
    const calls: unknown[][] = [];
    const result = await build({ stdin: { contents: "export { loadWorkspacePage } from './src/lib/googleWorkspace/workspaceData';", resolveDir: process.cwd(), loader: 'ts' },
      bundle: true, write: false, format: 'cjs', platform: 'browser', resolveExtensions: ['.web.ts', '.web.tsx', '.ts', '.tsx', '.js'],
      plugins: [{ name: 'read-only-provider', setup(plugin) {
        plugin.onResolve({ filter: /googleWorkspaceService$/ }, () => ({ path: 'provider', namespace: 'test' }));
        plugin.onLoad({ filter: /^provider$/, namespace: 'test' }, () => ({ contents: 'export const invokeGoogleWorkspaceAction = (...args) => globalThis.readProvider(...args);', loader: 'js' }));
      } }], absWorkingDir: resolve(process.cwd()) });
    const module = { exports: {} as { loadWorkspacePage: (service: string) => Promise<{ items: { title: string }[] }> } };
    const context = { module, exports: module.exports, readProvider: async (...args: unknown[]) => { calls.push(args); return { files: [{ id: 'file-1', name: 'Originalvertrag.pdf' }] }; } };
    new Script(result.outputFiles[0].text).runInNewContext(context);
    expect(typeof module.exports.loadWorkspacePage).toBe('function');
    expect((await module.exports.loadWorkspacePage('drive')).items[0].title).toBe('Originalvertrag.pdf');
    expect(calls[0][0]).toBe('drive_list');
  });
});
