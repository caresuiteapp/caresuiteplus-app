import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('AppStartScreen adaptive layout', () => {
  const source = readSrc('src/screens/AppStartScreen.tsx');

  it('uses AppScreen with PortalCard actions', () => {
    expect(source).toContain('AppScreen');
    expect(source).toContain('PortalCard');
    expect(source).toContain('CareSuiteLogo');
  });

  it('keeps a concise hero and action list', () => {
    expect(source).toContain('fetchAppStartSnapshot');
    expect(source).toContain('FooterLinks');
    expect(source).not.toContain('VoiceFlowPanel');
    expect(source).not.toContain('CareBotCard');
  });

  it('has no dev or WP navigation text', () => {
    for (const needle of ['WP ', 'Technisches Fundament', 'PUBLIC_ENTRIES', 'ModuleTile', 'CareBotCard']) {
      expect(source).not.toContain(needle);
    }
  });
});
