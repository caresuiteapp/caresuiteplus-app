import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Assist assignments protected deep link', () => {
  it('/assist/assignments uses hydration-safe auth navigation', () => {
    const route = readSrc('app/assist/(tabs)/assignments.tsx');
    const layout = readSrc('app/assist/_layout.tsx');
    const guard = readSrc('src/lib/auth/RequireAuth.tsx');

    expect(route).toContain('AssignmentsAdaptiveScreen');
    expect(layout).toContain('RequireAuth');
    expect(layout).toContain('/auth/business-login');
    expect(guard).toContain('useHydrated');
    expect(guard).toContain('startTransition');
    expect(guard).toContain('router.replace(target as never)');
  });
});
