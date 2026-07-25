import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('3D-Bodymap Viewer-Vertrag', () => {
  it('nutzt WebGL Canvas und OrbitControls für Maus- und Touchsteuerung', () => {
    const source = read('src/components/pflege/bodyMap3d/BodyMap3DViewer.web.tsx');
    expect(source).toContain('<Canvas');
    expect(source).toContain('<OrbitControls');
    expect(source).toContain('enableDamping');
    expect(source).toContain('minDistance');
    expect(source).toContain('maxDistance');
  });

  it('unterstützt auf Android Rotation und Zwei-Finger-Zoom', () => {
    const source = read('src/components/pflege/bodyMap3d/BodyMap3DViewer.native.tsx');
    expect(source).toContain('PanResponder.create');
    expect(source).toContain('touchDistance');
    expect(source).toContain('touches.length >= 2');
    expect(source).toContain('setRotation');
    expect(source).toContain('setZoom');
  });

  it('ermittelt dreidimensionale Oberfläche, Normale, UV und Dreieck', () => {
    const source = read('src/components/pflege/bodyMap3d/ParametricBodyModel.tsx');
    expect(source).toContain('worldPosition');
    expect(source).toContain('localPosition');
    expect(source).toContain('normalMatrix');
    expect(source).toContain('triangleIndex');
    expect(source).toContain('meshName');
  });

  it('rendert ein räumlich ausgerichtetes rotes X', () => {
    const source = read('src/components/pflege/bodyMap3d/ParametricBodyModel.tsx');
    expect(source).toContain('function XMarker');
    expect(source).toContain('#ef233c');
    expect(source).toContain('setFromUnitVectors');
  });

  it('ersetzt die alte 2D-Rechteckkarte im Pflege-Screen', () => {
    const source = read('src/screens/pflege/BodyMapScreen.tsx');
    expect(source).toContain('<BodyMap3DViewer');
    expect(source).toContain('Welche Genitalanatomie liegt vor?');
    expect(source).toContain('Welche Brustausprägung liegt vor?');
    expect(source).not.toContain('const REGIONS');
    expect(source).not.toContain('styles.canvas');
  });
});
