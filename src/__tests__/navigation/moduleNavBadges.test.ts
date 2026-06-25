import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Module nav badges', () => {
  it('ModuleNavSidebar nutzt dynamische Badges', () => {
    const sidebar = readSrc('src/components/layout/platform/modulenavsidebar.tsx');
    expect(sidebar).toContain('useModuleNavBadges');
    expect(sidebar).toContain('navBadges[item.key]');
    expect(sidebar).toContain('AccentTextChip');
  });

  it('ShellNavigationDrawer zeigt dynamische Badges auf Mobile', () => {
    const drawer = readSrc('src/components/layout/ShellNavigationDrawer.tsx');
    expect(drawer).toContain('useModuleNavBadges');
    expect(drawer).toContain('navBadges[item.key]');
  });

  it('Office-Nav-Badges nutzen Realtime-Inbox und isNewChat', () => {
    expect(readSrc('src/hooks/useOfficeMessageNavBadges.ts')).toContain('subscribeToOfficeMessageInbox');
    expect(readSrc('src/lib/office/officeMessageNavBadges.ts')).toContain('isNewChat');
    expect(readSrc('src/lib/office/messagethreadservice.ts')).toContain('fetchOfficeMessageNavBadgeData');
    expect(readSrc('src/hooks/useOfficeMessageNavBadges.ts')).toContain('resolveOfficeMessageNavBadgeContext');
  });
});
