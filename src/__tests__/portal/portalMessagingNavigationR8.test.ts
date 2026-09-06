import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { liquidPortalNavigation } from '@/liquid-command/navigation/portalCatalog';

const root = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Portal messaging and navigation R8', () => {
  it('uses the live open Office threads as the single dashboard chat source', () => {
    const home = readSrc('src/liquid-command/screens/PortalHomeScreen.tsx');

    expect(home).toContain("usePortalOfficeMessages('open')");
    expect(home).toContain('const activeChats = threads.length');
    expect(home).toContain('label="Aktive Chats"');
    expect(home).not.toContain('fetchPortalMessages');
    expect(home).not.toContain('data.messages');
  });

  it('refreshes the inbox on thread and message mutations', () => {
    const realtime = readSrc('src/lib/office/officemessagerealtime.ts');

    expect(realtime).toContain("table: 'message_threads'");
    expect(realtime).toContain("table: 'messages'");
    expect(realtime).toContain("type: 'message_changed'");
    expect(realtime).toContain('POLL_INTERVAL_MS');
  });

  it('exposes the reduced employee portal work and account areas', () => {
    const ids = liquidPortalNavigation.employee.map((item) => item.id);

    expect(ids).toEqual([
      'home',
      'assignments',
      'open-assignments',
      'clients',
      'calendar',
      'time',
      'logbook',
      'leave',
      'absence',
      'documents',
      'uploads',
      'messages',
      'payroll',
      'profile',
    ]);
  });

  it('exposes all client portal communication and account areas', () => {
    const ids = liquidPortalNavigation.client.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining([
      'home',
      'appointments',
      'live',
      'documents',
      'signatures',
      'proofs',
      'messages',
      'announcements',
      'budget',
      'help',
      'profile',
    ]));
  });

  it('keeps messages in compact navigation and every other route in the More menu', () => {
    const shell = readSrc('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');

    for (const kind of ['employee', 'client'] as const) {
      const items = liquidPortalNavigation[kind];
      expect(items.find((item) => item.id === 'messages')?.compact).toBe(true);
      expect(items.some((item) => !item.compact)).toBe(true);
    }
    expect(shell).toContain('Weitere Portalbereiche öffnen');
    expect(shell).toContain('Alle Bereiche');
    expect(shell).toContain('moreNavigation.map');
  });
});
