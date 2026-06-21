import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildAssistSetupHints } from '@/lib/assist/assistSetupHints';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('assist navigation cleanup', () => {
  it('touren route does not redirect to fahrten', () => {
    const tourenRoute = readSrc('app/assist/touren.tsx');
    expect(tourenRoute).not.toContain('Redirect');
    expect(tourenRoute).not.toContain('/assist/fahrten');
    expect(tourenRoute).toContain('AssistTourenScreen');
  });

  it('assistnav keeps separate touren and fahrten hrefs', () => {
    const nav = readSrc('src/lib/navigation/modulenav/assistnav.ts');
    expect(nav).toContain("href: '/assist/fahrten'");
    expect(nav).toContain("href: '/assist/touren'");
  });

  it('setup hints omit stale migration-prep banner text', () => {
    const hints = buildAssistSetupHints();
    const blob = hints.map((h) => `${h.title} ${h.message}`).join(' ');
    expect(blob).not.toMatch(/Migration 0156 vorbereitet/i);
    expect(blob).not.toMatch(/noch nicht remote/i);
    expect(blob).not.toMatch(/nicht remote angewendet/i);
  });

  it('live-status screen uses user-facing map text without internal table names', () => {
    const live = readSrc('src/screens/assist/AssistLiveStatusScreen.tsx');
    expect(live).toContain('Kartenansicht');
    expect(live).not.toContain('assist_location_points');
    expect(live).not.toContain('assist_tracking_points');
  });

  it('einstellungen route uses AssistSettingsScreen', () => {
    const settings = readSrc('app/assist/einstellungen.tsx');
    expect(settings).toContain('AssistSettingsScreen');
    expect(settings).not.toContain('AssistIndexScreen');
  });
});
