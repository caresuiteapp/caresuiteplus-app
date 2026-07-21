import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Background barrel integrity', () => {
  it('exportiert ausschließlich vorhandene Hintergrundmodule', () => {
    const indexPath = path.resolve(process.cwd(), 'src/components/backgrounds/index.ts');
    const source = fs.readFileSync(indexPath, 'utf8');
    const exports = [...source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);

    const unresolved = exports.filter((relativePath) => {
      const absoluteBase = path.resolve(path.dirname(indexPath), relativePath);
      return !['.ts', '.tsx', '.js', '.jsx'].some((extension) =>
        fs.existsSync(`${absoluteBase}${extension}`),
      );
    });

    expect(unresolved).toEqual([]);
  });

  it('exportiert das entfernte dunkle Testdesign nicht erneut', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/backgrounds/index.ts'),
      'utf8',
    );

    expect(source).not.toContain('DarkLiquidGlassBackground');
  });
});
