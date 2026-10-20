import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
} from 'three';
import {
  hiddenClinicalInteractionMaterial,
  isClinicalInteractionMesh,
} from '@/lib/pflege/bodyMap3d/clinicalInteractionVisibility';

describe('klinische Bodymap-Trefferflächen', () => {
  it('erkennt alle historischen Kennzeichnungsformen', () => {
    const byName = new Mesh();
    byName.name = 'zone__surface-eye-left';
    expect(isClinicalInteractionMesh(byName)).toBe(true);

    const byTechnicalReference = new Mesh();
    byTechnicalReference.userData.technicalReference = true;
    expect(isClinicalInteractionMesh(byTechnicalReference)).toBe(true);

    const byAnatomicalZone = new Mesh();
    byAnatomicalZone.userData.anatomicalZoneId = 'surface-hand-left';
    expect(isClinicalInteractionMesh(byAnatomicalZone)).toBe(true);

    const visibleHumanSurface = new Mesh();
    visibleHumanSurface.name = 'real-human-body';
    visibleHumanSurface.userData.bodymapRealHumanSurface = true;
    expect(isClinicalInteractionMesh(visibleHumanSurface)).toBe(false);
  });

  it('unterbindet Rendering vollständig, lässt Raycasting aber bestehen', () => {
    const material = hiddenClinicalInteractionMaterial(
      new MeshStandardMaterial({ color: '#ff0000' }),
    );
    expect(material.visible).toBe(false);
    expect(material.opacity).toBe(0);
    expect(material.colorWrite).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.depthTest).toBe(false);

    const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
    mesh.updateMatrixWorld(true);
    const raycaster = new Raycaster(
      undefined,
      undefined,
      0,
      Number.POSITIVE_INFINITY,
    );
    raycaster.ray.origin.set(0, 0, 2);
    raycaster.ray.direction.set(0, 0, -1);
    expect(raycaster.intersectObject(mesh)).not.toHaveLength(0);
  });
});
