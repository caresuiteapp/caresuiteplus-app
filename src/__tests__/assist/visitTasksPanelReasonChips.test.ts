import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readSrc(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('VisitTasksPanel desktop reason chips', () => {
  it('uses Pressable with web onClick for catalog chips', () => {
    const panel = readSrc('src/components/assist/VisitTasksPanel.tsx');
    expect(panel).toContain('Pressable');
    expect(panel).toContain("Platform.OS === 'web'");
    expect(panel).toContain('onClick');
    expect(panel).toContain('Grund auswählen (Office-Katalog)');
  });
});
