import type {
  BodyMapModelId,
  BodyMapModelSelection,
  BodyMapSkinTone,
} from '@/types/modules/bodyMap';
import medicalMeshManifest from '../../../../assets/bodymap3d/v2/medical-mesh-manifest.json';
import realHumanManifest from '../../../../assets/bodymap3d/v3/real-human-manifest.json';
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
  selfDeveloped?: boolean;
  medicalReleaseBlocked?: boolean;
};

type MedicalMeshManifest = {
  schemaVersion: number;
  meshContractVersion: number;
  renderer: string;
  variants: MedicalMeshDefinition[];
};

const manifest = medicalMeshManifest as MedicalMeshManifest;

export type RealHumanVisualDefinition = {
  id: string;
  baseModelId: BodyMapModelId;
  visualAssetPath: string;
  assetSha256: string;
  interactionAssetPath: string;
  nominalHeightMeters: number;
  visualStatus: 'production-candidate';
  medicalReviewStatus: 'pending' | 'in-review' | 'approved';
  sourceLicense: 'CC0-1.0';
  vertices: number;
  triangles: number;
  fileSizeBytes: number;
};

type RealHumanManifest = {
  schemaVersion: number;
  visualAssetContractVersion: number;
  variants: RealHumanVisualDefinition[];
};

const realHuman = realHumanManifest as RealHumanManifest;

export const MEDICAL_MESH_VARIANTS: readonly MedicalMeshDefinition[] =
  manifest.variants;

export const MEDICAL_MESH_CONTRACT_VERSION = manifest.meshContractVersion;
export const REAL_HUMAN_VISUAL_VARIANTS: readonly RealHumanVisualDefinition[] =
  realHuman.variants;

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
    selection.genitalAnatomy === 'penis' &&
    selection.chestAnatomy === 'keine_brueste'
  ) {
    return 'body-erwachsener-divers-penis-keine-brueste';
  }
  if (selection.genitalAnatomy === 'vulva' && selection.chestAnatomy === 'brueste') {
    return 'body-erwachsener-divers-vulva-brueste';
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
  if (
    selection.genitalAnatomy === 'unbekannt' &&
    selection.chestAnatomy === 'keine_brueste'
  ) {
    return 'body-erwachsener-divers-unbekannt-keine-brueste';
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

export function getRealHumanVisualDefinition(
  selection: BodyMapModelSelection,
): RealHumanVisualDefinition | null {
  const variantId = resolveMedicalMeshVariantId(selection);
  return REAL_HUMAN_VISUAL_VARIANTS.find((entry) => entry.id === variantId) ?? null;
}

export function canRenderRealHumanVisual(
  definition: RealHumanVisualDefinition | null,
): definition is RealHumanVisualDefinition {
  return Boolean(
    definition?.visualAssetPath &&
      definition.visualStatus === 'production-candidate',
  );
}

export function canRenderMedicalMesh(
  definition: MedicalMeshDefinition,
  options: { allowTechnicalPreview?: boolean } = {},
): definition is MedicalMeshDefinition & { assetPath: string } {
  if (!definition.assetPath) return false;
  if (definition.reviewStatus === 'released') return true;
  return (
    options.allowTechnicalPreview === true &&
    (definition.reviewStatus === 'technical-review' ||
      definition.reviewStatus === 'medical-review')
  );
}

export function canPreviewMedicalMesh(
  definition: MedicalMeshDefinition,
): definition is MedicalMeshDefinition & { assetPath: string } {
  return canRenderMedicalMesh(definition, { allowTechnicalPreview: true });
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
  options: { allowTechnicalPreview?: boolean } = {},
): string {
  const visualDefinition = REAL_HUMAN_VISUAL_VARIANTS.find(
    (entry) => entry.id === definition.id,
  );
  if (canRenderRealHumanVisual(visualDefinition ?? null)) {
    return visualDefinition?.medicalReviewStatus === 'approved'
      ? 'Real-Human 3D · medizinisch freigegeben'
      : 'Real-Human 3D · medizinische Prüfung ausstehend';
  }
  return canRenderMedicalMesh(definition, options)
    ? definition.reviewStatus === 'released'
      ? `Medizinisch freigegebenes GLB-Mesh v${definition.version}`
      : 'Technisches GLB-Referenzmesh · kontinuierliche Oberfläche'
    : 'Parametrischer technischer Fallback';
}
