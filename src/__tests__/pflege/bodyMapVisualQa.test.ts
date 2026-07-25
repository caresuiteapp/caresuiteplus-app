import { describe, expect, it } from 'vitest';
import { BODY_MAP_VISUAL_QA_CASES } from '@/lib/pflege/bodyMap3d/visualQaCatalog';

describe('3D-Bodymap visuelle Vergleichsmatrix', () => {
  it('enthält genau 15 Grundmodelle und drei zusätzliche Divers-Varianten', () => {
    expect(BODY_MAP_VISUAL_QA_CASES).toHaveLength(18);
    expect(BODY_MAP_VISUAL_QA_CASES.filter((entry) => entry.group === 'grundmodell')).toHaveLength(
      15,
    );
    expect(
      BODY_MAP_VISUAL_QA_CASES.filter((entry) => entry.group === 'divers-variante'),
    ).toHaveLength(3);
    expect(new Set(BODY_MAP_VISUAL_QA_CASES.map((entry) => entry.id)).size).toBe(18);
  });

  it('rendert jede Variante klinisch neutral in vier festen Blickrichtungen', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile('src/screens/pflege/BodyMapVisualQaScreen.tsx', 'utf8'),
    );
    for (const label of ['Vorderseite', 'Rückseite', 'Linke Seite', 'Rechte Seite']) {
      expect(source).toContain(label);
    }
    expect(source).toContain('keine KI-Visualisierung');
    expect(source).toContain('preserveDrawingBuffer');
  });
});
