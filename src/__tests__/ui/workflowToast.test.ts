import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('WorkflowToast', () => {
  const source = readFileSync('src/components/ui/WorkflowToast.tsx', 'utf8');

  it('bleibt overlay-basiert und verschiebt kein Layout', () => {
    expect(source).toContain("position: 'absolute'");
    expect(source).toContain('pointerEvents="box-none"');
  });

  it('schließt nach exakt fünf Sekunden und räumt den Timer auf', () => {
    expect(source).toContain('}, 5000)');
    expect(source).toContain('clearTimeout(timer)');
  });
});
