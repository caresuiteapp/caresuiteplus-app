import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Assist Aufgaben list', () => {
  it('AssistTasksListScreen öffnet Details im zentrierten Modal statt Router-Navigation', () => {
    const source = readSrc('src/screens/assist/AssistTasksListScreen.tsx');
    expect(source).toContain('AssignmentDetailGlassModal');
    expect(source).toContain('setSelectedTask');
    expect(source).not.toContain('router.push(`/assist/einsaetze/${item.id}`');
  });

  it('AssignmentDetailGlassModal nutzt PlatformModal mit Tabs-Panel', () => {
    const source = readSrc('src/components/assist/AssignmentDetailGlassModal.tsx');
    expect(source).toContain('PlatformModal');
    expect(source).toContain('AssignmentDetailTabsPanel');
  });

  it('EntityListScreen nutzt Aurora-Glas und lesbare Textfarben', () => {
    const source = readSrc('src/components/lists/EntityListScreen.tsx');
    expect(source).toContain('useAuroraAdaptiveText');
    expect(source).toContain('useAuroraGlassPanelStyle');
  });
});
