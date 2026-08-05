import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('systemweite Ungelesen-Anzeige R4', () => {
  it('blendet Office-Badges nicht schon auf der Nachrichtenroute aus', () => {
    const hook = read('src/hooks/useOfficeMessageNavBadges.ts');

    expect(hook).toContain('computeOfficeMessageNavBadgeCounts(query.data?.newThreads ?? [])');
    expect(hook).not.toContain('markOfficeMessageNavThreadsSeen');
    expect(hook).not.toContain('applyOfficeMessageNavBadgeRouteOverrides');
  });

  it('zeigt den Zähler in Office-Dock, Arbeitsbereich und mobiler Navigation', () => {
    const shell = read('src/liquid-command/shell/LiquidCommandShell.tsx');

    expect(shell).toContain('useOfficeMessageNavBadges(true)');
    expect(shell).toContain("module.key === 'office' && messageBadge");
    expect(shell).toContain("area.id === 'communication' && messageBadge");
    expect(shell).toContain("item.key === 'messages' && messageBadge");
  });

  it('zeigt den Datenbank-Zähler im Mitarbeitenden- und Klient:innenportal', () => {
    const portal = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');

    expect(portal).toContain("kind === 'client' || kind === 'employee'");
    expect(portal).toContain('sum + thread.unreadCount');
    expect(portal).toContain("item.id === 'messages' && messageBadge");
    expect(portal).toContain('badge={messageBadge}');
  });
});
