import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('AppStartScreen adaptive layout', () => {
  const source = readSrc('src/screens/AppStartScreen.tsx');

  it('uses AppScreen with aurora dark landing shell', () => {
    expect(source).toContain('AppScreen');
    expect(source).toContain('PortalCard');
  });

  it('uses robot logo asset and galaxy typography', () => {
    expect(source).toContain('caresuite-robot-logo.png');
    expect(source).toContain('resolveGalaxyTypography');
    expect(source).toContain('AdaptiveCardGrid');
  });

  it('defines platform-specific layout branches', () => {
    expect(source).toContain('isPhone');
    expect(source).toContain('isDesktopOrWide');
    expect(source).toContain('styles.tabletRow');
    expect(source).toContain('styles.desktopRow');
  });

  it('shows only the landing headline in the hero', () => {
    expect(source).toContain(
      'CareSuite+ Software für Office, Assist, Pflege (Ambulant & Stationär), Beratung und Akademie',
    );
    expect(source).not.toContain('CareBotCard');
    expect(source).not.toContain('VoiceFlowPanel');
    expect(source).not.toContain('Modul suchen');
  });

  it('has no dev or WP navigation text', () => {
    for (const needle of ['WP ', 'Technisches Fundament', 'PUBLIC_ENTRIES', 'ModuleTile']) {
      expect(source).not.toContain(needle);
    }
  });
});
