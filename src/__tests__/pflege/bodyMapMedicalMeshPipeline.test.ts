import { describe, expect, it } from 'vitest';
import type { BodyMapModelSelection } from '@/types/modules/bodyMap';
import {
  canRenderMedicalMesh,
  getMedicalMeshDefinition,
  MEDICAL_MESH_VARIANTS,
  resolveMedicalMeshVariantId,
  zoneIdFromMedicalMesh,
} from '@/lib/pflege/bodyMap3d/medicalMeshCatalog';

const adultDivers = (
  genitalAnatomy: BodyMapModelSelection['genitalAnatomy'],
  chestAnatomy: BodyMapModelSelection['chestAnatomy'],
): BodyMapModelSelection => ({
  sex: 'divers',
  ageGroup: 'erwachsener',
  genitalAnatomy,
  chestAnatomy,
  skinTone: 'mittel',
});

describe('medizinische 3D-Mesh-Pipeline', () => {
  it('registriert genau 15 Grundmodelle und drei zusätzliche Divers-Varianten', () => {
    expect(MEDICAL_MESH_VARIANTS).toHaveLength(18);
    expect(new Set(MEDICAL_MESH_VARIANTS.map((entry) => entry.id)).size).toBe(18);
  });

  it('löst die drei zusätzlichen erwachsenen Divers-Konfigurationen eindeutig auf', () => {
    expect(resolveMedicalMeshVariantId(adultDivers('penis', 'brueste'))).toBe(
      'body-erwachsener-divers-penis-brueste',
    );
    expect(resolveMedicalMeshVariantId(adultDivers('vulva', 'keine_brueste'))).toBe(
      'body-erwachsener-divers-vulva-keine-brueste',
    );
    expect(resolveMedicalMeshVariantId(adultDivers('unbekannt', 'brueste'))).toBe(
      'body-erwachsener-divers-unbekannt-brueste',
    );
  });

  it('verwendet bis zur registrierten Mesh-Datei den sicheren parametrischen Fallback', () => {
    for (const definition of MEDICAL_MESH_VARIANTS) {
      expect(canRenderMedicalMesh(definition)).toBe(false);
    }
    expect(
      getMedicalMeshDefinition(adultDivers('penis', 'brueste')).reviewStatus,
    ).toBe('awaiting-mesh');
  });

  it('übernimmt Zonen-IDs aus GLB-Metadaten oder dem festgelegten Mesh-Namen', () => {
    expect(
      zoneIdFromMedicalMesh('beliebig', { anatomicalZoneId: 'surface-sacrum' }),
    ).toBe('surface-sacrum');
    expect(zoneIdFromMedicalMesh('zone__surface-heel-left', {})).toBe(
      'surface-heel-left',
    );
    expect(zoneIdFromMedicalMesh('decoration', {})).toBeNull();
  });
});
