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

  it('zeigt technische GLB-Referenzen sichtbar, ohne medizinische Freigabe vorzutäuschen', () => {
    const source = read('src/components/pflege/bodyMap3d/BodyMap3DViewer.web.tsx');
    expect(source).toContain('allowTechnicalMeshPreview = true');
    expect(source).toContain('TECHNISCHE REFERENZ · NICHT MEDIZINISCH FREIGEGEBEN');
    expect(source).toContain('allowTechnicalMeshPreview={allowTechnicalMeshPreview}');
  });

  it('rendert alte klinische Trefferflächen niemals als sichtbare Körperteile', () => {
    const source = read(
      'src/components/pflege/bodyMap3d/ClinicalBodyModel.web.tsx',
    );
    const visibilitySource = read(
      'src/lib/pflege/bodyMap3d/clinicalInteractionVisibility.ts',
    );
    expect(source).toContain('isClinicalInteractionMesh(mesh)');
    expect(source).toContain('hiddenClinicalInteractionMaterial(material)');
    expect(visibilitySource).toContain("mesh.name.startsWith('zone__')");
    expect(visibilitySource).toContain(
      'mesh.userData?.technicalReference === true',
    );
    expect(visibilitySource).toContain(
      "typeof mesh.userData?.anatomicalZoneId === 'string'",
    );
    expect(source).toContain('mesh.userData.bodymapInteractionProxy = true');
    expect(visibilitySource).toContain('material.visible = false');
    expect(visibilitySource).toContain('material.opacity = 0');
    expect(visibilitySource).toContain('material.colorWrite = false');
  });

  it('lädt neu erzeugte Körper trotz Browser- und CDN-Cache sicher nach', () => {
    const source = read(
      'src/components/pflege/bodyMap3d/ClinicalBodyModel.web.tsx',
    );
    expect(source).toContain('versionedVisualAssetPath');
    expect(source).toContain('visualDefinition.assetSha256.slice(0, 16)');
    expect(source).toContain('visualAssetPath={versionedVisualAssetPath}');
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

  it('rendert einen räumlich ausgerichteten pulsierenden gelben Befundpunkt', () => {
    const source = read('src/components/pflege/bodyMap3d/ParametricBodyModel.tsx');
    expect(source).toContain('function PulsingFindingMarker');
    expect(source).toContain('#ffd21f');
    expect(source).toContain('useFrame');
    expect(source).toContain('ringGeometry');
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

  it('ersetzt die alte 2D-Rechteckkarte und die sichtbare Variantenwahl durch die klinische 3D-Karte', () => {
    const source = read('src/screens/pflege/BodyMapScreen.tsx');
    expect(source).toContain('<BodyMap3DViewer');
    expect(source).toContain('CLINICAL_BODYMAP_SELECTION');
    expect(source).toContain('presentationMode="clinical"');
    expect(source).toContain('Einheitliches blaues 3D-Anatomienetz');
    expect(source).not.toContain('Welche Genitalanatomie liegt vor?');
    expect(source).not.toContain('Welche Brustausprägung liegt vor?');
    expect(source).not.toContain('const REGIONS');
    expect(source).not.toContain('styles.canvas');
  });

  it('bietet im klinischen Modus Navigation, Zielwerkzeug, Zoom und Netzwerkdarstellung', () => {
    const viewer = read('src/components/pflege/bodyMap3d/BodyMap3DViewer.web.tsx');
    const model = read('src/components/pflege/bodyMap3d/ClinicalBodyModel.web.tsx');
    expect(viewer).toContain("type ViewerTool = 'rotate' | 'marker'");
    expect(viewer).toContain('Befundpunkt setzen');
    expect(viewer).toContain('Vergrößern');
    expect(viewer).toContain("disabled={disabled || activeTool !== 'marker'}");
    expect(viewer).toContain("onPress={() => setActiveTool('marker')}");
    expect(viewer).toContain("visualMode={clinicalMode ? 'clinical-network' : 'skin'}");
    expect(model).toContain("visualMode === 'clinical-network'");
    expect(model).toContain('clinicalNetworkScene');
  });
});
