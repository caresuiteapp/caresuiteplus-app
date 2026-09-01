import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../liquid-command/screens/CommandCenterScreen.tsx', import.meta.url),
  'utf8',
);

describe('HealthOS Workspace-Harmonie R11', () => {
  it('kennzeichnet die neue Center-Architektur und ruhige Dichte', () => {
    expect(source).toContain('healthosWorkspaceRevision: "r11-app-center"');
    expect(source).toContain('healthosVisualDensityRevision: "r11-calm"');
    expect(source).toContain('PERSÖNLICHER ARBEITSPLATZ');
    expect(source).toContain('Mein Desktop');
  });

  it('verwendet getrennte Motiv- und Beschriftungsflächen', () => {
    expect(source).toContain('styles.imageStage');
    expect(source).toContain('styles.labelBar');
    expect(source).toContain('resizeMode="contain"');
    expect(source).toContain('styles.categoryPill');
  });

  it('enthält keinen unteren Dock-Bereich mehr', () => {
    expect(source).not.toContain('dockRegion');
    expect(source).not.toContain('DockWidget');
    expect(source).not.toContain('folderCreate');
  });
});
