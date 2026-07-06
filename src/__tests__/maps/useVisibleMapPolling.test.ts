import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('useVisibleMapPolling', () => {
  it('pauses polling when tab or app becomes hidden', () => {
    const source = readSrc('src/components/maps/useVisibleMapPolling.ts');
    expect(source).toContain('visibilitychange');
    expect(source).toContain('AppState.addEventListener');
    expect(source).toContain('appActive');
  });
});
