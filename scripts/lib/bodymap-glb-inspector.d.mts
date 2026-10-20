export type BodyMapGlbInspectionOptions = {
  expectedVariantId?: string | null;
  requiredZoneIds?: string[];
  expectedHeightMeters?: number | null;
  maximumVertices?: number;
  maximumTriangles?: number;
  maximumFileSizeBytes?: number;
};

export type BodyMapGlbInspectionReport = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: null | {
    bytes: number;
    chunks: number;
    scenes: number;
    nodes: number;
    meshes: number;
    primitives: number;
    vertices: number;
    triangles: number;
    materials: number;
    skinMaterials: number;
    textures: number;
    images: number;
    animations: number;
    skins: number;
    morphTargetPrimitives: number;
    bounds: null | {
      min: { x: number; y: number; z: number };
      max: { x: number; y: number; z: number };
      dimensions: { width: number; height: number; depth: number };
    };
  };
  metadata?: Record<string, unknown> | null;
  zones: { found: string[]; missing: string[] };
};

export function inspectBodyMapGlb(
  bytes: Uint8Array,
  options?: BodyMapGlbInspectionOptions,
): BodyMapGlbInspectionReport;

export function formatBodyMapGlbReport(
  report: BodyMapGlbInspectionReport,
): string;
