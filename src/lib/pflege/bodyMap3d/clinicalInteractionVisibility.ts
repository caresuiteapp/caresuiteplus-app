import type { Material, Mesh } from 'three';

/**
 * Erkennt sowohl aktuelle als auch ältere CareSuite-GLB-Trefferflächen.
 * Ältere Modellgenerationen kennzeichneten nicht jede Zone explizit mit
 * `bodymapInteractionProxy`, verwendeten aber durchgehend zone__-Namen,
 * anatomische IDs oder technicalReference.
 */
export function isClinicalInteractionMesh(mesh: Mesh): boolean {
  return (
    mesh.userData?.bodymapInteractionProxy === true ||
    mesh.userData?.technicalReference === true ||
    typeof mesh.userData?.anatomicalZoneId === 'string' ||
    typeof mesh.userData?.zoneId === 'string' ||
    mesh.name.startsWith('zone__')
  );
}

/**
 * Der Klon bleibt am Mesh, damit Three.js/R3F weiterhin darauf raycasten kann.
 * `visible=false` betrifft das Materialrendering, nicht Mesh.raycast.
 */
export function hiddenClinicalInteractionMaterial(source: Material): Material {
  const material = source.clone();
  material.visible = false;
  material.transparent = true;
  material.opacity = 0;
  material.depthWrite = false;
  material.depthTest = false;
  material.colorWrite = false;
  material.toneMapped = false;
  return material;
}
