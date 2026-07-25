import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('interne Bodymap-Mesh-Werkbank', () => {
  it('ist außerhalb Entwicklung nur über ein explizites Feature-Gate erreichbar', async () => {
    const source = await readFile('app/bodymap-mesh-workbench.tsx', 'utf8');
    expect(source).toContain('EXPO_PUBLIC_BODYMAP_MESH_WORKBENCH');
    expect(source).toContain('<Redirect href="/"');
  });

  it('vergleicht alle Varianten in vier Ansichten und zeigt Freigabegates', async () => {
    const source = await readFile(
      'src/screens/pflege/BodyMapMeshWorkbenchScreen.tsx',
      'utf8',
    );
    for (const label of ['Vorderseite', 'Rückseite', 'Linke Seite', 'Rechte Seite']) {
      expect(source).toContain(label);
    }
    for (const gate of [
      'GLB registriert',
      'Technisch geprüft',
      'Medizinisch geprüft',
      'Produktionsfreigabe',
    ]) {
      expect(source).toContain(gate);
    }
    expect(source).toContain('BODY_MAP_VISUAL_QA_CASES.map');
    expect(source).toContain('Parametrischer Sicherheitsfallback');
  });

  it('fällt bei Ladefehler oder während des Ladens auf das sichere Modell zurück', async () => {
    const source = await readFile(
      'src/components/pflege/bodyMap3d/ClinicalBodyModel.web.tsx',
      'utf8',
    );
    expect(source).toContain('MedicalMeshErrorBoundary');
    expect(source).toContain('<Suspense fallback={fallback}>');
    expect(source).toContain('<ParametricBodyModel {...props} />');
  });
});
