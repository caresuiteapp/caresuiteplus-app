import type {
  BodyMapModelId,
  BodyMapModelSelection,
  BodyMapSkinTone,
} from '@/types/modules/bodyMap';
import medicalMeshManifest from '../../../../assets/bodymap3d/v2/medical-mesh-manifest.json';
import { getBodyMapModel } from './modelCatalog';

export type MedicalMeshReviewStatus =
  | 'awaiting-mesh'
  | 'technical-review'
  | 'medical-review'
  | 'released';

export type MedicalMeshDefinition = {
  id: string;
  baseModelId: BodyMapModelId;
  assetPath: string | null;
  version: number;
  reviewStatus: MedicalMeshReviewStatus;
  nominalHeightMeters: number;
  meshContractVersion: number;
};

type MedicalMeshManifest = {
  schemaVersion: number;
  meshContractVersion: number;
  renderer: string;
  variants: MedicalMeshDefinition[];
};

const manifest = medicalMeshManifest as MedicalMeshManifest;

export const MEDICAL_MESH_VARIANTS: readonly MedicalMeshDefinition[] =
  manifest.variants;

export const MEDICAL_MESH_CONTRACT_VERSION = manifest.meshContractVersion;

export function resolveMedicalMeshVariantId(
  selection: BodyMapModelSelection,
): string {
  const baseModel = getBodyMapModel(selection);
  if (selection.sex !== 'divers' || selection.ageGroup !== 'erwachsener') {
    return baseModel.id;
  }
  if (selection.genitalAnatomy === 'penis' && selection.chestAnatomy === 'brueste') {
    return 'body-erwachsener-divers-penis-brueste';
  }
  if (
    selection.genitalAnatomy === 'vulva' &&
    selection.chestAnatomy === 'keine_brueste'
  ) {
    return 'body-erwachsener-divers-vulva-keine-brueste';
  }
  if (
    selection.genitalAnatomy === 'unbekannt' &&
    selection.chestAnatomy === 'brueste'
  ) {
    return 'body-erwachsener-divers-unbekannt-brueste';
  }
  return baseModel.id;
}

export function getMedicalMeshDefinition(
  selection: BodyMapModelSelection,
): MedicalMeshDefinition {
  const variantId = resolveMedicalMeshVariantId(selection);
  const definition = MEDICAL_MESH_VARIANTS.find((entry) => entry.id === variantId);
  if (!definition) {
    throw new Error(`Keine medizinische Mesh-Definition für ${variantId} registriert.`);
  }
  return definition;
}

export function canRenderMedicalMesh(
  definition: MedicalMeshDefinition,
): definition is MedicalMeshDefinition & { assetPath: string } {
  return Boolean(definition.assetPath) && definition.reviewStatus !== 'awaiting-mesh';
}

export function zoneIdFromMedicalMesh(
  meshName: string,
  userData: Record<string, unknown>,
): string | null {
  const explicitZone =
    typeof userData.anatomicalZoneId === 'string'
      ? userData.anatomicalZoneId
      : typeof userData.zoneId === 'string'
        ? userData.zoneId
        : null;
  if (explicitZone) return explicitZone;
  if (meshName.startsWith('zone__')) return meshName.slice('zone__'.length);
  return null;
}

export const MEDICAL_SKIN_TINTS: Record<BodyMapSkinTone, string> = {
  sehr_hell: '#f4d4c4',
  hell: '#ddb29a',
  mittel: '#b97855',
  dunkel: '#75452f',
  sehr_dunkel: '#3d241c',
};

export function medicalMeshRendererLabel(
  definition: MedicalMeshDefinition,
): string {
  return canRenderMedicalMesh(definition)
    ? `Medizinisches GLB-Mesh v${definition.version}`
    : 'Parametrischer technischer Fallback';
}
