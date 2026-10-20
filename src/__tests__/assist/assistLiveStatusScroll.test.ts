import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Assist Live-Status scroll regression', () => {
  const source = readSrc('src/screens/assist/AssistLiveStatusScreen.tsx');

  it('gives the nested live-status list a bounded, scrollable viewport', () => {
    expect(source).toContain('testID="assist-live-status-scroll"');
    expect(source).toContain('style={styles.scrollViewport}');
    expect(source).toContain('nestedScrollEnabled');
    expect(source).toContain('showsVerticalScrollIndicator');
    expect(source).toContain('flex: 1');
    expect(source).toContain('minHeight: 0');
  });

  it('keeps touch and wheel scrolling active in the locked web shell', () => {
    expect(source).toContain("overflowY: 'auto'");
    expect(source).toContain("overflowX: 'hidden'");
    expect(source).toContain("touchAction: 'pan-y'");
    expect(source).toContain("WebkitOverflowScrolling: 'touch'");
    expect(source).toContain("overscrollBehavior: 'contain'");
  });

  it('retains pull-to-refresh and reachable assignment details', () => {
    expect(source).toContain('RefreshControl');
    expect(source).toContain('title="Einsatzdetails"');
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
  });
});
