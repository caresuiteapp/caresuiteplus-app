import { createRequire } from 'node:module';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const nodeRequire = createRequire(join(process.cwd(), 'package.json'));
const metro = nodeRequire('metro-resolver');
const config = nodeRequire(join(process.cwd(), 'metro.config.js'));
const sqliteRoot = dirname(nodeRequire.resolve('expo-sqlite/package.json'));
const worker = join(sqliteRoot, 'web/worker.ts');
const wasm = join(sqliteRoot, 'web/wa-sqlite/wa-sqlite.wasm');

function context(originModulePath = worker, wasmEnabled = true) {
  return {
    originModulePath,
    assetExts: new Set(config.resolver.assetExts.filter((extension: string) => wasmEnabled || extension !== 'wasm')),
    sourceExts: config.resolver.sourceExts,
    mainFields: config.resolver.resolverMainFields,
    resolveRequest: config.resolver.resolveRequest,
    preferNativePlatform: false,
    getPackageForModule: () => null,
    doesFileExist: existsSync,
    fileSystemLookup: (path: string) => existsSync(path)
      ? { exists: true, type: statSync(path).isDirectory() ? 'd' : 'f', realPath: realpathSync(path) }
      : { exists: false },
    resolveAsset: (directory: string, name: string, extension: string) => {
      const path = join(directory, name + extension);
      return existsSync(path) ? [path] : null;
    },
  };
}

describe('installed Metro resolves the actual SQLite dependency', () => {
  it('shows why unregistered WASM is classified as a source module instead of an asset', () => {
    expect(existsSync(wasm)).toBe(true);
    // Metro's real crawler also excludes unknown extensions from its file map;
    // this resolver probe supplies a physical lookup so classification is visible.
    expect(metro.resolve(context(worker, false), './wa-sqlite/wa-sqlite.wasm', 'web'))
      .toEqual({ type: 'sourceFile', filePath: wasm });
  });
  it('resolves the existing worker WASM through the application Metro configuration', () => {
    expect(metro.resolve(context(), './wa-sqlite/wa-sqlite.wasm', 'web')).toEqual({ type: 'assetFiles', filePaths: [wasm] });
  });
  it.each(['web', 'android'])('keeps SQLite platform module selection on %s', (platform) => {
    const origin = join(sqliteRoot, 'build/SQLiteDatabase.js');
    const resolved = metro.resolve({ ...context(origin), preferNativePlatform: platform !== 'web' }, './ExpoSQLite', platform);
    expect(resolved.type).toBe('sourceFile');
    expect(resolve(resolved.filePath)).toBe(join(sqliteRoot, 'build', platform === 'web' ? 'ExpoSQLite.web.js' : 'ExpoSQLite.js'));
  });
});
