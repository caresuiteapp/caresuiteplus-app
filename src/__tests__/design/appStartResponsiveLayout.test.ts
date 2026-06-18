import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('AppStartScreen adaptive layout', () => {
  const source = readSrc('src/screens/AppStartScreen.tsx');

  it('uses CareAdaptiveShell with bare landing mode', () => {
    expect(source).toContain('CareAdaptiveShell');
    expect(source).toContain('bare');
  });

  it('uses CareSuiteLogo and brand tokens', () => {
    expect(source).toContain('CareSuiteLogo');
    expect(source).toContain('resolveCareSuitePalette');
    expect(source).toContain('careTypography');
    expect(source).toContain('AdaptiveCardGrid');
  });

  it('defines four platform-specific layout branches', () => {
    expect(source).toContain('isPhone');
    expect(source).toContain('isTablet');
    expect(source).toContain('isDesktopOrWide');
    expect(source).toContain('styles.tabletRow');
    expect(source).toContain('styles.desktopRow');
    expect(source).toContain('CareBotCard');
  });

  it('shows illustration area on tablet and desktop only', () => {
    expect(source).toContain('(isTablet || isDesktopOrWide)');
    expect(source).toContain('VoiceFlowPanel');
  });

  it('has no dev or WP navigation text', () => {
    for (const needle of ['WP ', 'Technisches Fundament', 'PUBLIC_ENTRIES', 'ModuleTile']) {
      expect(source).not.toContain(needle);
    }
  });
});
