import { Component, Suspense, useMemo, type ErrorInfo, type ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Color,
  Matrix3,
  Mesh,
  Quaternion,
  Vector3,
  type BufferAttribute,
  type Material,
  type Object3D,
} from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  canRenderRealHumanVisual,
  canRenderMedicalMesh,
  getMedicalMeshDefinition,
  getRealHumanVisualDefinition,
  MEDICAL_SKIN_TINTS,
  zoneIdFromMedicalMesh,
} from '@/lib/pflege/bodyMap3d/medicalMeshCatalog';
import {
  hiddenClinicalInteractionMaterial,
  isClinicalInteractionMesh,
} from '@/lib/pflege/bodyMap3d/clinicalInteractionVisibility';
import {
  hitFromEvent,
  ParametricBodyModel,
  PulsingFindingMarker,
  type BodyModelProps,
} from './ParametricBodyModel';
import type { BodyMap3DMarker } from '@/types/modules/bodyMap';

function tintClinicalSkinMaterial(
  material: Material & { color?: Color; name?: string },
  color: string,
) {
  const isSkinMaterial =
    material.userData?.bodymapSkinMaterial === true ||
    material.name?.toLowerCase().startsWith('skin');
  if (!isSkinMaterial || !material.color) return material;
  const clone = material.clone() as Material & { color?: Color };
  clone.color?.set(color);
  return clone;
}

function prepareMedicalScene(
  scene: Object3D,
  skinTone: BodyModelProps['selection']['skinTone'],
  hideTechnicalSurface = false,
) {
  const clone = cloneSkeleton(scene);
  clone.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const renderSurface = mesh.userData?.bodymapRenderSurface === true;
    const interactionProxy = isClinicalInteractionMesh(mesh);
    const zoneId = zoneIdFromMedicalMesh(mesh.name, mesh.userData);
    if (zoneId) mesh.userData.zoneId = zoneId;
    if (interactionProxy) mesh.userData.bodymapInteractionProxy = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (renderSurface) {
      mesh.raycast = () => {};
      mesh.userData.bodymapVisualOnly = true;
      if (hideTechnicalSurface) mesh.visible = false;
    }
    if (interactionProxy) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = -100;
    }
    const prepareMaterial = (source: Material) => {
      const material = tintClinicalSkinMaterial(
        source,
        MEDICAL_SKIN_TINTS[skinTone],
      );
      if (interactionProxy) {
        return hiddenClinicalInteractionMaterial(material);
      }
      return material;
    };
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(prepareMaterial);
    } else if (mesh.material) {
      mesh.material = prepareMaterial(mesh.material);
    }
  });
  return clone;
}

function prepareRealHumanScene(
  scene: Object3D,
  skinTone: BodyModelProps['selection']['skinTone'],
  visualMode: BodyModelProps['visualMode'] = 'skin',
  wireframe = false,
) {
  const clone = cloneSkeleton(scene);
  clone.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.raycast = () => {};
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const prepareMaterial = (source: Material) => {
      if (visualMode !== 'clinical-network') {
        return tintClinicalSkinMaterial(source, MEDICAL_SKIN_TINTS[skinTone]);
      }
      const material = source.clone() as Material & {
        color?: Color;
        emissive?: Color;
        emissiveIntensity?: number;
        metalness?: number;
        opacity?: number;
        roughness?: number;
        transparent?: boolean;
        wireframe?: boolean;
        depthWrite?: boolean;
      };
      material.color?.set(wireframe ? '#67c6ff' : '#0b579c');
      material.emissive?.set(wireframe ? '#1683ff' : '#062c55');
      material.emissiveIntensity = wireframe ? 0.85 : 0.38;
      material.metalness = 0.12;
      material.roughness = 0.58;
      material.transparent = true;
      material.opacity = wireframe ? 0.22 : 0.72;
      material.wireframe = wireframe;
      material.depthWrite = !wireframe;
      return material;
    };
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(prepareMaterial);
    } else if (mesh.material) {
      mesh.material = prepareMaterial(mesh.material);
    }
  });
  return clone;
}

function nearestUvVertex(
  uv: BufferAttribute,
  target: { u: number; v: number },
): number | null {
  if (uv.count === 0) return null;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < uv.count; index += 1) {
    const deltaU = Math.min(
      Math.abs(uv.getX(index) - target.u),
      1 - Math.abs(uv.getX(index) - target.u),
    );
    const deltaV = uv.getY(index) - target.v;
    const distance = deltaU * deltaU + deltaV * deltaV;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

/**
 * Überträgt ausschließlich die Darstellungskoordinate. Der klinische
 * Originaldatensatz samt ID, Verlauf, Medien und Befunddetails bleibt
 * unverändert. UV + anatomische Zone sind über alle Altersmeshes stabil.
 */
function markersProjectedToScene(
  scene: Object3D,
  markers: readonly BodyMap3DMarker[],
): BodyMap3DMarker[] {
  scene.updateMatrixWorld(true);
  const zoneMeshes = new Map<string, Mesh>();
  scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || mesh.userData?.bodymapInteractionProxy !== true) return;
    const zoneId = typeof mesh.userData.zoneId === 'string' ? mesh.userData.zoneId : null;
    if (zoneId && !zoneMeshes.has(zoneId)) zoneMeshes.set(zoneId, mesh);
  });

  const inverseSceneRotation = scene.getWorldQuaternion(new Quaternion()).invert();
  return markers.map((marker) => {
    const uvTarget = marker.surfacePoint.uv;
    const mesh = zoneMeshes.get(marker.anatomicalZoneId);
    const positionAttribute = mesh?.geometry.getAttribute('position') as
      | BufferAttribute
      | undefined;
    const normalAttribute = mesh?.geometry.getAttribute('normal') as
      | BufferAttribute
      | undefined;
    const uvAttribute = mesh?.geometry.getAttribute('uv') as BufferAttribute | undefined;
    if (!mesh || !uvTarget || !positionAttribute || !normalAttribute || !uvAttribute) {
      return marker;
    }
    const vertexIndex = nearestUvVertex(uvAttribute, uvTarget);
    if (vertexIndex === null) return marker;

    const projectedPosition = new Vector3().fromBufferAttribute(
      positionAttribute,
      vertexIndex,
    );
    mesh.localToWorld(projectedPosition);
    scene.worldToLocal(projectedPosition);

    const projectedNormal = new Vector3().fromBufferAttribute(
      normalAttribute,
      vertexIndex,
    );
    projectedNormal
      .applyMatrix3(new Matrix3().getNormalMatrix(mesh.matrixWorld))
      .applyQuaternion(inverseSceneRotation)
      .normalize();

    return {
      ...marker,
      surfacePoint: {
        ...marker.surfacePoint,
        modelPosition: {
          x: projectedPosition.x,
          y: projectedPosition.y,
          z: projectedPosition.z,
        },
        modelNormal: {
          x: projectedNormal.x,
          y: projectedNormal.y,
          z: projectedNormal.z,
        },
      },
    };
  });
}

function MedicalGltfBodyModel({
  assetPath,
  visualAssetPath,
  modelOffsetY,
  markers,
  selectedMarkerId,
  disabled,
  rotation = [0, 0, 0],
  scale = 1,
  visualMode = 'skin',
  selection,
  onSurfacePress,
  onMarkerPress,
}: BodyModelProps & {
  assetPath: string;
  visualAssetPath: string | null;
  modelOffsetY: number;
}) {
  const { scene } = useGLTF(assetPath);
  const visualGltf = useGLTF(visualAssetPath ?? assetPath);
  const clinicalScene = useMemo(
    () => prepareMedicalScene(scene, selection.skinTone, Boolean(visualAssetPath)),
    [scene, selection.skinTone, visualAssetPath],
  );
  const realHumanScene = useMemo(
    () =>
      visualAssetPath
        ? prepareRealHumanScene(visualGltf.scene, selection.skinTone, visualMode)
        : null,
    [selection.skinTone, visualAssetPath, visualGltf.scene, visualMode],
  );
  const clinicalNetworkScene = useMemo(
    () =>
      visualAssetPath && visualMode === 'clinical-network'
        ? prepareRealHumanScene(visualGltf.scene, selection.skinTone, visualMode, true)
        : null,
    [selection.skinTone, visualAssetPath, visualGltf.scene, visualMode],
  );
  const projectedMarkers = useMemo(
    () => markersProjectedToScene(clinicalScene, markers),
    [clinicalScene, markers],
  );

  return (
    <group
      name="bodymap-model-root"
      position={[0, modelOffsetY, 0]}
      rotation={rotation}
      scale={scale}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        if (disabled) return;
        const hit = hitFromEvent(event);
        if (hit) onSurfacePress(hit);
      }}
    >
      {realHumanScene ? <primitive object={realHumanScene} /> : null}
      {clinicalNetworkScene ? <primitive object={clinicalNetworkScene} /> : null}
      <primitive object={clinicalScene} />
      {projectedMarkers.map((marker) => (
        <PulsingFindingMarker
          key={marker.id}
          marker={marker}
          selected={marker.id === selectedMarkerId}
          onPress={onMarkerPress}
        />
      ))}
    </group>
  );
}

class MedicalMeshErrorBoundary extends Component<
  { fallback: ReactNode; resetKey: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Medizinisches Bodymap-Mesh konnte nicht geladen werden.', {
      message: error.message,
      componentStack: info.componentStack,
      asset: this.props.resetKey,
    });
  }

  componentDidUpdate(previousProps: Readonly<{ resetKey: string }>) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ClinicalBodyModel(props: BodyModelProps) {
  const definition = getMedicalMeshDefinition(props.selection);
  const visualDefinition = getRealHumanVisualDefinition(props.selection);
  const realHumanActive = canRenderRealHumanVisual(visualDefinition);
  const versionedVisualAssetPath = realHumanActive
    ? `${visualDefinition.visualAssetPath}?v=${visualDefinition.assetSha256.slice(0, 16)}`
    : null;
  if (
    !definition.assetPath ||
    (!realHumanActive &&
      !canRenderMedicalMesh(definition, {
        allowTechnicalPreview: props.allowTechnicalMeshPreview,
      }))
  ) {
    return <ParametricBodyModel {...props} />;
  }
  const fallback = <ParametricBodyModel {...props} />;
  return (
    <MedicalMeshErrorBoundary
      fallback={fallback}
      resetKey={`${definition.assetPath}:${versionedVisualAssetPath ?? ''}`}
    >
      <Suspense fallback={fallback}>
        <MedicalGltfBodyModel
          {...props}
          assetPath={definition.assetPath}
          visualAssetPath={versionedVisualAssetPath}
          modelOffsetY={-definition.nominalHeightMeters / 2}
        />
      </Suspense>
    </MedicalMeshErrorBoundary>
  );
}
