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

  it('erhält den Office-Zähler in der Arbeitsbereichsnavigation ohne entfernte Modul-Tableiste', () => {
    const shell = read('src/liquid-command/shell/LiquidCommandShell.tsx');

    expect(shell).toContain('useOfficeMessageNavBadges(true)');
    expect(shell).not.toContain('<OrbitModuleNavigation');
    expect(shell).toContain('<WorkAreaNavigation');
    expect(shell).toContain('messageBadge={messageBadge}');
    expect(shell).toContain("area.id === 'communication' && messageBadge");
  });

  it('zeigt den Datenbank-Zähler im Mitarbeitenden- und Klient:innenportal', () => {
    const portal = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');

    expect(portal).toContain("kind === 'client' || kind === 'employee'");
    expect(portal).toContain('sum + thread.unreadCount');
    expect(portal).toContain("item.id === 'messages' && messageBadge");
    expect(portal).toContain('badge={compactMessageBadge}');
    expect(portal).toContain('const compactMessageBadge = unreadMessageCount > 0');
  });
});
