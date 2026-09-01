import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'src/liquid-command/screens/CommandCenterScreen.tsx'),
  'utf8',
);

describe('HealthOS Morph-Motion R11', () => {
  it('morpht Navigation und Desktop mit ruhiger Cubic-Bewegung', () => {
    expect(source).toContain('const sidebarMotion = useRef(new Animated.Value');
    expect(source).toContain('const gridMorph = useRef(new Animated.Value(1))');
    expect(source).toContain('duration: reducedMotion ? 0 : 380');
    expect(source).toContain('duration: reducedMotion ? 0 : 420');
    expect(source.match(/Easing\.out\(Easing\.cubic\)/g)).toHaveLength(2);
  });

  it('verschiebt und zentriert den Desktop im verbleibenden Flex-Raum', () => {
    expect(source).toContain('outputRange: [0, narrow ? 238 : 278]');
    expect(source).toContain('desktopPanel: { flex: 1');
    expect(source).toContain('justifyContent: "center"');
  });

  it('respektiert die Systemeinstellung Bewegung reduzieren', () => {
    expect(source).toContain('AccessibilityInfo.isReduceMotionEnabled()');
    expect(source).toContain('"reduceMotionChanged"');
    expect(source).toContain('duration: reducedMotion ? 0');
  });
});
