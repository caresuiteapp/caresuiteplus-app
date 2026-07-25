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

  it('bietet reproduzierbare Vorder-, Rück- und Seitenansichten', () => {
    const source = read('src/components/pflege/bodyMap3d/BodyMap3DViewer.web.tsx');
    expect(source).toContain('VIEW_PRESETS');
    expect(source).toContain("label: 'Vorne'");
    expect(source).toContain("label: 'Hinten'");
    expect(source).toContain("label: 'Links'");
    expect(source).toContain("label: 'Rechts'");
    expect(source).toContain('rotation={[0, modelRotation, 0]}');
  });

  it('unterstützt auf Android Rotation und Zwei-Finger-Zoom', () => {
    const source = read('src/components/pflege/bodyMap3d/BodyMap3DViewer.native.tsx');
    expect(source).toContain('PanResponder.create');
    expect(source).toContain('touchDistance');
    expect(source).toContain('touches.length >= 2');
    expect(source).toContain('setRotation');
    expect(source).toContain('setZoom');
    expect(source).toContain('VIEW_PRESETS');
    expect(source).toContain('setRotation([...preset.rotation])');
  });

  it('ermittelt dreidimensionale Oberfläche, Normale, UV und Dreieck', () => {
    const source = read('src/components/pflege/bodyMap3d/ParametricBodyModel.tsx');
    expect(source).toContain('worldPosition');
    expect(source).toContain('localPosition');
    expect(source).toContain('modelPosition');
    expect(source).toContain('modelNormal');
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

  it('enthält die klinisch erforderlichen Detailoberflächen', () => {
    const source = read('src/components/pflege/bodyMap3d/ParametricBodyModel.tsx');
    for (const surface of [
      'surface-pupil-left',
      'surface-upper-eyelid-left',
      'surface-cheek-left',
      'surface-nose-wing-left',
      'surface-ear-concha-left',
      'surface-upper-lip',
      'surface-chin',
      'surface-clavicle-left',
      'surface-navel',
      'surface-scapula-left',
      'surface-thoracic-spine',
      'surface-sacrum',
      'surface-coccyx',
      'surface-nipple-left',
      'surface-buttock-left',
      'surface-ischial-left',
      'surface-anus',
      'surface-anogenital-unspecified',
      'surface-penis',
      'surface-glans',
      'surface-labium-majus-left',
      'surface-labium-minus-left',
      'surface-clitoral-region',
      'surface-vaginal-opening',
      'FINGER_ZONE_BASES',
      'surface-wrist-left',
      'surface-hand-back-left',
      'surface-posterior-thigh-left',
      'surface-popliteal-left',
      'surface-calf-left',
      'surface-heel-left',
      'surface-sole-left',
      'TOE_ZONE_BASES',
      'isInner',
    ]) {
      expect(source).toContain(surface);
    }
  });

  it('variiert erwachsene Schulter- und Beckenproportionen nach Modell', () => {
    const source = read('src/components/pflege/bodyMap3d/ParametricBodyModel.tsx');
    expect(source).toContain('shoulderFactor');
    expect(source).toContain('pelvisFactor');
    expect(source).toContain("selection.sex === 'maennlich'");
    expect(source).toContain("selection.sex === 'weiblich'");
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
