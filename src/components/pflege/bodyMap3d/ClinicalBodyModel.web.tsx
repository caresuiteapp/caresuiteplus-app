import { Component, Suspense, useMemo, type ErrorInfo, type ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Color, Mesh, type Material, type Object3D } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  canRenderMedicalMesh,
  getMedicalMeshDefinition,
  MEDICAL_SKIN_TINTS,
  zoneIdFromMedicalMesh,
} from '@/lib/pflege/bodyMap3d/medicalMeshCatalog';
import {
  hitFromEvent,
  ParametricBodyModel,
  PulsingFindingMarker,
  type BodyModelProps,
} from './ParametricBodyModel';

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

function prepareMedicalScene(scene: Object3D, skinTone: BodyModelProps['selection']['skinTone']) {
  const clone = cloneSkeleton(scene);
  clone.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const zoneId = zoneIdFromMedicalMesh(mesh.name, mesh.userData);
    if (zoneId) mesh.userData.zoneId = zoneId;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) =>
        tintClinicalSkinMaterial(material, MEDICAL_SKIN_TINTS[skinTone]),
      );
    } else if (mesh.material) {
      mesh.material = tintClinicalSkinMaterial(
        mesh.material,
        MEDICAL_SKIN_TINTS[skinTone],
      );
    }
  });
  return clone;
}

function MedicalGltfBodyModel({
  assetPath,
  modelOffsetY,
  markers,
  selectedMarkerId,
  disabled,
  rotation = [0, 0, 0],
  scale = 1,
  selection,
  onSurfacePress,
  onMarkerPress,
}: BodyModelProps & { assetPath: string; modelOffsetY: number }) {
  const { scene } = useGLTF(assetPath);
  const clinicalScene = useMemo(
    () => prepareMedicalScene(scene, selection.skinTone),
    [scene, selection.skinTone],
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
      <primitive object={clinicalScene} />
      {markers.map((marker) => (
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
  if (
    !canRenderMedicalMesh(definition, {
      allowTechnicalPreview: props.allowTechnicalMeshPreview,
    })
  ) {
    return <ParametricBodyModel {...props} />;
  }
  const fallback = <ParametricBodyModel {...props} />;
  return (
    <MedicalMeshErrorBoundary
      fallback={fallback}
      resetKey={definition.assetPath}
    >
      <Suspense fallback={fallback}>
        <MedicalGltfBodyModel
          {...props}
          assetPath={definition.assetPath}
          modelOffsetY={-definition.nominalHeightMeters / 2}
        />
      </Suspense>
    </MedicalMeshErrorBoundary>
  );
}
