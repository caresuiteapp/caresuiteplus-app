import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, 'src/liquid-command/screens/CommandCenterScreen.tsx'),
  'utf8',
);

function pngSize(filePath: string) {
  const data = fs.readFileSync(filePath);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

describe('Command Center ruhige visuelle Dichte R11', () => {
  it.each([
    ['compact', 512, 512],
    ['medium', 1024, 512],
    ['large', 1536, 512],
  ] as const)('bewahrt 21 echte %s-Artworks', (folder, width, height) => {
    const files = fs.readdirSync(path.join(root, 'assets/healthos/widgets-premium', folder)).filter((file) => file.endsWith('.png'));
    expect(files).toHaveLength(21);
    for (const file of files) expect(pngSize(path.join(root, 'assets/healthos/widgets-premium', folder, file))).toEqual({ width, height });
  });

  it('nutzt Morphing nur als fokussierte Zustandsbewegung', () => {
    expect(source).toContain('transition: "transform 300ms cubic-bezier(.2,.8,.2,1), border-color 240ms ease"');
    expect(source).toContain('outputRange: [0.985, 1]');
    expect(source).not.toContain('Animated.loop');
  });
});
