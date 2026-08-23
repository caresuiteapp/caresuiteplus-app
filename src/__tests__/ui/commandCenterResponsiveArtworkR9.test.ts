import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const screenPath = path.join(
  projectRoot,
  'src/liquid-command/screens/CommandCenterScreen.tsx',
);
const screenSource = fs.readFileSync(screenPath, 'utf8');
const widgetRoot = path.join(projectRoot, 'assets/healthos/widgets-premium');

function pngSize(filePath: string) {
  const data = fs.readFileSync(filePath);
  expect(data.subarray(1, 4).toString('ascii')).toBe('PNG');
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

describe('Command Center responsive Widget-Artworks R9', () => {
  it.each([
    ['compact', 512, 512],
    ['medium', 1024, 512],
    ['large', 1536, 512],
  ] as const)('liefert 21 echte %s-Assets in der richtigen Größe', (folder, width, height) => {
    const files = fs
      .readdirSync(path.join(widgetRoot, folder))
      .filter((file) => file.endsWith('.png'))
      .sort();

    expect(files).toHaveLength(21);
    for (const file of files) {
      expect(pngSize(path.join(widgetRoot, folder, file))).toEqual({ width, height });
    }
  });

  it('verwendet für alle drei Größen eigene Assetpfade', () => {
    expect(screenSource.match(/widgets-premium\/compact\//g)).toHaveLength(21);
    expect(screenSource.match(/widgets-premium\/medium\//g)).toHaveLength(21);
    expect(screenSource.match(/widgets-premium\/large\//g)).toHaveLength(21);
  });

  it('zeigt die Artworks ohne Cover-Cropping und mit vergrößerter Bühne', () => {
    expect(screenSource).toContain('healthosResponsiveArtworkRevision: "r9"');
    expect(screenSource).toContain('resizeMode="contain"');
    expect(screenSource).toContain('Math.max(124, Math.min(158');
    expect(screenSource).toContain('bottom: 34');
  });
});
