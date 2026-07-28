import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import {
  Color,
  Matrix3,
  Mesh,
  Quaternion,
  Vector3,
  type Intersection,
  type Object3D,
} from 'three';
import type {
  BodyMap3DMarker,
  BodyMapAgeGroup,
  BodyMapModelSelection,
  BodyMapSkinTone,
} from '@/types/modules/bodyMap';
import type { BodyMapSurfaceHit } from './BodyMap3DViewer.types';

export type BodyModelProps = {
  selection: BodyMapModelSelection;
  markers: readonly BodyMap3DMarker[];
  selectedMarkerId?: string | null;
  disabled?: boolean;
  allowTechnicalMeshPreview?: boolean;
  visualMode?: 'skin' | 'clinical-network';
  rotation?: [number, number, number];
  scale?: number;
  onSurfacePress: (hit: BodyMapSurfaceHit) => void;
  onMarkerPress?: (marker: BodyMap3DMarker) => void;
};

type Proportions = {
  headRadius: number;
  shoulderWidth: number;
  torsoLength: number;
  torsoDepth: number;
  pelvisWidth: number;
  armLength: number;
  legLength: number;
  limbRadius: number;
  handScale: number;
  footScale: number;
};

const PROPORTIONS: Record<BodyMapAgeGroup, Proportions> = {
  baby: {
    headRadius: 0.245,
    shoulderWidth: 0.42,
    torsoLength: 0.48,
    torsoDepth: 0.2,
    pelvisWidth: 0.3,
    armLength: 0.42,
    legLength: 0.5,
    limbRadius: 0.075,
    handScale: 0.11,
    footScale: 0.15,
  },
  kleinkind: {
    headRadius: 0.205,
    shoulderWidth: 0.48,
    torsoLength: 0.61,
    torsoDepth: 0.2,
    pelvisWidth: 0.34,
    armLength: 0.61,
    legLength: 0.78,
    limbRadius: 0.073,
    handScale: 0.105,
    footScale: 0.17,
  },
  kind: {
    headRadius: 0.17,
    shoulderWidth: 0.55,
    torsoLength: 0.72,
    torsoDepth: 0.2,
    pelvisWidth: 0.38,
    armLength: 0.78,
    legLength: 1.02,
    limbRadius: 0.067,
    handScale: 0.1,
    footScale: 0.2,
  },
  jugendlicher: {
    headRadius: 0.155,
    shoulderWidth: 0.61,
    torsoLength: 0.77,
    torsoDepth: 0.21,
    pelvisWidth: 0.41,
    armLength: 0.86,
    legLength: 1.1,
    limbRadius: 0.062,
    handScale: 0.102,
    footScale: 0.22,
  },
  junger_erwachsener: {
    headRadius: 0.145,
    shoulderWidth: 0.65,
    torsoLength: 0.8,
    torsoDepth: 0.22,
    pelvisWidth: 0.43,
    armLength: 0.91,
    legLength: 1.16,
    limbRadius: 0.064,
    handScale: 0.105,
    footScale: 0.23,
  },
  erwachsener: {
    headRadius: 0.145,
    shoulderWidth: 0.66,
    torsoLength: 0.81,
    torsoDepth: 0.23,
    pelvisWidth: 0.44,
    armLength: 0.91,
    legLength: 1.15,
    limbRadius: 0.067,
    handScale: 0.108,
    footScale: 0.235,
  },
  senior: {
    headRadius: 0.148,
    shoulderWidth: 0.62,
    torsoLength: 0.79,
    torsoDepth: 0.245,
    pelvisWidth: 0.45,
    armLength: 0.88,
    legLength: 1.08,
    limbRadius: 0.064,
    handScale: 0.11,
    footScale: 0.24,
  },
  hochbetagt: {
    headRadius: 0.152,
    shoulderWidth: 0.59,
    torsoLength: 0.76,
    torsoDepth: 0.255,
    pelvisWidth: 0.46,
    armLength: 0.84,
    legLength: 1.01,
    limbRadius: 0.06,
    handScale: 0.11,
    footScale: 0.24,
  },
};

const SKIN_COLORS: Record<BodyMapSkinTone, string> = {
  sehr_hell: '#f4d4c4',
  hell: '#ddb29a',
  mittel: '#b97855',
  dunkel: '#75452f',
  sehr_dunkel: '#3d241c',
};

const FINGER_ZONE_BASES = [
  { id: 'daumen', offset: -0.72, length: 0.62, angle: 0.42 },
  { id: 'zeigefinger', offset: -0.36, length: 0.92, angle: 0.08 },
  { id: 'mittelfinger', offset: 0, length: 1, angle: 0 },
  { id: 'ringfinger', offset: 0.34, length: 0.9, angle: -0.05 },
  { id: 'kleiner-finger', offset: 0.66, length: 0.72, angle: -0.12 },
] as const;

const TOE_ZONE_BASES = [
  { id: 'grosszehe', offset: 0.42, length: 1, radius: 1 },
  { id: 'zweite-zehe', offset: 0.18, length: 0.84, radius: 0.8 },
  { id: 'dritte-zehe', offset: 0, length: 0.76, radius: 0.72 },
  { id: 'vierte-zehe', offset: -0.2, length: 0.67, radius: 0.64 },
  { id: 'kleine-zehe', offset: -0.38, length: 0.56, radius: 0.58 },
] as const;

function modelScale(ageGroup: BodyMapAgeGroup): number {
  if (ageGroup === 'baby') return 0.78;
  if (ageGroup === 'kleinkind') return 0.86;
  if (ageGroup === 'kind') return 0.93;
  if (ageGroup === 'jugendlicher') return 0.98;
  if (ageGroup === 'hochbetagt') return 0.97;
  return 1;
}

export function hitFromEvent(event: ThreeEvent<PointerEvent>): BodyMapSurfaceHit | null {
  const object = event.object as Object3D & { userData: { zoneId?: string } };
  const anatomicalZoneId = object.userData.zoneId;
  if (!anatomicalZoneId) return null;
  const worldPosition = event.point.clone();
  const localPosition = object.worldToLocal(worldPosition.clone());
  let modelRoot: Object3D | null = object;
  while (modelRoot && modelRoot.name !== 'bodymap-model-root') {
    modelRoot = modelRoot.parent;
  }
  const modelPosition = modelRoot
    ? modelRoot.worldToLocal(worldPosition.clone())
    : worldPosition.clone();
  const faceNormal = event.face?.normal?.clone() ?? new Vector3(0, 0, 1);
  const normalMatrix = new Matrix3().getNormalMatrix(object.matrixWorld);
  faceNormal.applyMatrix3(normalMatrix).normalize();
  const modelNormal = faceNormal.clone();
  if (modelRoot) {
    const rootWorldQuaternion = modelRoot.getWorldQuaternion(new Quaternion());
    modelNormal.applyQuaternion(rootWorldQuaternion.invert()).normalize();
  }
  const intersection = event.intersections[0] as
    | (Intersection<Object3D> & { faceIndex?: number; index?: number })
    | undefined;
  return {
    anatomicalZoneId,
    surfacePoint: {
      localPosition: { x: localPosition.x, y: localPosition.y, z: localPosition.z },
      worldPosition: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z },
      modelPosition: { x: modelPosition.x, y: modelPosition.y, z: modelPosition.z },
      normal: { x: faceNormal.x, y: faceNormal.y, z: faceNormal.z },
      modelNormal: { x: modelNormal.x, y: modelNormal.y, z: modelNormal.z },
      uv: event.uv ? { u: event.uv.x, v: event.uv.y } : null,
      meshName: object.name || anatomicalZoneId,
      primitiveIndex: intersection?.index ?? null,
      triangleIndex: event.faceIndex ?? intersection?.faceIndex ?? null,
    },
  };
}

type SurfaceProps = {
  zoneId: string;
  name: string;
  color: string;
  children: React.ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  disabled?: boolean;
  onSurfacePress: (hit: BodyMapSurfaceHit) => void;
};

function Surface({
  zoneId,
  name,
  color,
  children,
  position,
  rotation,
  scale,
  disabled,
  onSurfacePress,
}: SurfaceProps) {
  return (
    <mesh
      name={name}
      userData={{ zoneId }}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
      onPointerDown={(event) => {
        event.stopPropagation();
        if (disabled) return;
        const hit = hitFromEvent(event);
        if (hit) onSurfacePress(hit);
      }}
    >
      {children}
      <meshPhysicalMaterial
        color={color}
        roughness={0.62}
        metalness={0}
        clearcoat={0.12}
        clearcoatRoughness={0.82}
        envMapIntensity={0.35}
      />
    </mesh>
  );
}

export function PulsingFindingMarker({
  marker,
  selected,
  onPress,
}: {
  marker: BodyMap3DMarker;
  selected: boolean;
  onPress?: (marker: BodyMap3DMarker) => void;
}) {
  const pulseRef = useRef<Mesh>(null);
  const position = marker.surfacePoint.modelPosition ?? marker.surfacePoint.worldPosition;
  const normal = marker.surfacePoint.modelNormal ?? marker.surfacePoint.normal;
  const quaternion = useMemo(() => {
    const target = new Vector3(normal.x, normal.y, normal.z).normalize();
    return new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), target);
  }, [normal.x, normal.y, normal.z]);
  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const phase = clock.elapsedTime * (selected ? 4.8 : 3.2);
    const pulse = (selected ? 1.22 : 1) + Math.sin(phase) * (selected ? 0.2 : 0.13);
    pulseRef.current.scale.setScalar(pulse);
  });

  return (
    <group
      name={`marker-${marker.id}`}
      position={[
        position.x + normal.x * 0.012,
        position.y + normal.y * 0.012,
        position.z + normal.z * 0.012,
      ]}
      quaternion={quaternion}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPress?.(marker);
      }}
    >
      <mesh ref={pulseRef}>
        <ringGeometry args={[0.052, 0.074, 32]} />
        <meshBasicMaterial
          color={selected ? '#fff2a8' : '#ffd633'}
          transparent
          opacity={selected ? 0.92 : 0.72}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <circleGeometry args={[selected ? 0.046 : 0.04, 32]} />
        <meshStandardMaterial
          color="#ffd21f"
          emissive="#ffb000"
          emissiveIntensity={selected ? 1.65 : 1.1}
          roughness={0.28}
          metalness={0}
        />
      </mesh>
      <mesh position={[0, 0, 0.007]}>
        <circleGeometry args={[selected ? 0.019 : 0.015, 24]} />
        <meshBasicMaterial color="#fff8c7" />
      </mesh>
    </group>
  );
}

export function ParametricBodyModel({
  selection,
  markers,
  selectedMarkerId,
  disabled,
  rotation = [0, 0, 0],
  scale = 1,
  visualMode = 'skin',
  onSurfacePress,
  onMarkerPress,
}: BodyModelProps) {
  const p = PROPORTIONS[selection.ageGroup];
  const skin = new Color(
    visualMode === 'clinical-network' ? '#0a67b7' : SKIN_COLORS[selection.skinTone],
  ).getStyle();
  const heightScale = modelScale(selection.ageGroup);
  const adultBodyShape =
    selection.ageGroup === 'jugendlicher' ||
    selection.ageGroup === 'junger_erwachsener' ||
    selection.ageGroup === 'erwachsener' ||
    selection.ageGroup === 'senior' ||
    selection.ageGroup === 'hochbetagt';
  const shoulderFactor = adultBodyShape
    ? selection.sex === 'maennlich'
      ? 1.08
      : selection.sex === 'weiblich'
        ? 0.96
        : 1
    : 1;
  const pelvisFactor = adultBodyShape
    ? selection.sex === 'weiblich'
      ? 1.1
      : selection.sex === 'maennlich'
        ? 0.95
        : 1.03
    : 1;
  const depthFactor = adultBodyShape && selection.sex === 'maennlich' ? 1.04 : 1;
  const shoulderWidth = p.shoulderWidth * shoulderFactor;
  const pelvisWidth = p.pelvisWidth * pelvisFactor;
  const torsoDepth = p.torsoDepth * depthFactor;
  const legCenterY = p.legLength / 2;
  const pelvisY = p.legLength + 0.08;
  const torsoY = pelvisY + p.torsoLength / 2 + 0.14;
  const shoulderY = pelvisY + p.torsoLength + 0.08;
  const headY = shoulderY + p.headRadius * 2.15;
  const armX = shoulderWidth / 2 + p.limbRadius * 1.6;
  const upperArmLength = p.armLength * 0.48;
  const lowerArmLength = p.armLength * 0.42;
  const elbowY = shoulderY - upperArmLength;
  const handY = elbowY - lowerArmLength - p.handScale * 0.35;
  const legX = pelvisWidth * 0.28;
  const isBreastPresentation =
    selection.chestAnatomy === 'brueste' ||
    (selection.sex === 'weiblich' && selection.chestAnatomy !== 'keine_brueste');
  const showAdultChest =
    selection.ageGroup === 'jugendlicher' ||
    selection.ageGroup === 'junger_erwachsener' ||
    selection.ageGroup === 'erwachsener' ||
    selection.ageGroup === 'senior' ||
    selection.ageGroup === 'hochbetagt';
  const resolvedGenitalAnatomy =
    selection.sex === 'divers'
      ? selection.genitalAnatomy
      : selection.sex === 'maennlich'
        ? 'penis'
        : 'vulva';
  const anatomicalMaturity =
    selection.ageGroup === 'baby'
      ? 0.48
      : selection.ageGroup === 'kleinkind'
        ? 0.58
        : selection.ageGroup === 'kind'
          ? 0.72
          : selection.ageGroup === 'jugendlicher'
            ? 0.9
          : 1;
  const genitalUnit = Math.max(0.026, pelvisWidth * 0.14 * anatomicalMaturity);
  const genitalY = pelvisY - pelvisWidth * 0.22;
  const genitalFrontZ = torsoDepth * 0.86;
  const mucosaColor = selection.skinTone === 'sehr_dunkel' ? '#6f343d' : '#b75f6b';

  return (
    <group
      name="bodymap-model-root"
      rotation={rotation}
      scale={scale * heightScale}
      position={[0, -1.25, 0]}
    >
      <Surface
        zoneId="kopf"
        name="surface-head"
        color={skin}
        position={[0, headY, 0]}
        scale={[0.88, 1.08, 0.92]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[p.headRadius, 32, 24]} />
      </Surface>
      <Surface
        zoneId="nase"
        name="surface-nose"
        color={skin}
        position={[0, headY, p.headRadius * 0.92]}
        rotation={[Math.PI / 2, 0, 0]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <coneGeometry args={[p.headRadius * 0.13, p.headRadius * 0.3, 18]} />
      </Surface>
      {[-1, 1].map((side) => (
        <Surface
          key={`eye-${side}`}
          zoneId={side < 0 ? 'auge-links' : 'auge-rechts'}
          name={side < 0 ? 'surface-eye-left' : 'surface-eye-right'}
          color="#f6f7fb"
          position={[side * p.headRadius * 0.34, headY + p.headRadius * 0.1, p.headRadius * 0.84]}
          scale={[1, 0.58, 0.42]}
          disabled={disabled}
          onSurfacePress={onSurfacePress}
        >
          <sphereGeometry args={[p.headRadius * 0.13, 20, 14]} />
        </Surface>
      ))}
      {[-1, 1].map((side) => (
        <group key={`iris-${side}`}>
          <Surface
            zoneId={side < 0 ? 'auge-links' : 'auge-rechts'}
            name={side < 0 ? 'surface-iris-left' : 'surface-iris-right'}
            color="#587b8f"
            position={[
              side * p.headRadius * 0.34,
              headY + p.headRadius * 0.1,
              p.headRadius * 0.955,
            ]}
            scale={[1, 0.72, 0.3]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.headRadius * 0.061, 20, 14]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'auge-links' : 'auge-rechts'}
            name={side < 0 ? 'surface-pupil-left' : 'surface-pupil-right'}
            color="#111820"
            position={[
              side * p.headRadius * 0.34,
              headY + p.headRadius * 0.1,
              p.headRadius * 0.975,
            ]}
            scale={[1, 0.72, 0.3]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.headRadius * 0.027, 16, 12]} />
          </Surface>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={`eyelids-${side}`}>
          <Surface
            zoneId={side < 0 ? 'oberlid-links' : 'oberlid-rechts'}
            name={side < 0 ? 'surface-upper-eyelid-left' : 'surface-upper-eyelid-right'}
            color={skin}
            position={[
              side * p.headRadius * 0.34,
              headY + p.headRadius * 0.1,
              p.headRadius * 0.967,
            ]}
            scale={[1.32, 0.78, 0.42]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <torusGeometry
              args={[p.headRadius * 0.082, p.headRadius * 0.012, 8, 20, Math.PI]}
            />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'unterlid-links' : 'unterlid-rechts'}
            name={side < 0 ? 'surface-lower-eyelid-left' : 'surface-lower-eyelid-right'}
            color={skin}
            position={[
              side * p.headRadius * 0.34,
              headY + p.headRadius * 0.1,
              p.headRadius * 0.967,
            ]}
            rotation={[0, 0, Math.PI]}
            scale={[1.32, 0.78, 0.42]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <torusGeometry
              args={[p.headRadius * 0.082, p.headRadius * 0.011, 8, 20, Math.PI]}
            />
          </Surface>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <Surface
          key={`cheek-${side}`}
          zoneId={side < 0 ? 'wange-links' : 'wange-rechts'}
          name={side < 0 ? 'surface-cheek-left' : 'surface-cheek-right'}
          color={skin}
          position={[
            side * p.headRadius * 0.48,
            headY - p.headRadius * 0.16,
            p.headRadius * 0.76,
          ]}
          scale={[1.15, 0.92, 0.38]}
          disabled={disabled}
          onSurfacePress={onSurfacePress}
        >
          <sphereGeometry args={[p.headRadius * 0.19, 22, 16]} />
        </Surface>
      ))}
      {[-1, 1].map((side) => (
        <Surface
          key={`nose-wing-${side}`}
          zoneId={side < 0 ? 'nasenfluegel-links' : 'nasenfluegel-rechts'}
          name={side < 0 ? 'surface-nose-wing-left' : 'surface-nose-wing-right'}
          color={skin}
          position={[
            side * p.headRadius * 0.1,
            headY - p.headRadius * 0.12,
            p.headRadius * 0.965,
          ]}
          scale={[0.9, 0.65, 0.62]}
          disabled={disabled}
          onSurfacePress={onSurfacePress}
        >
          <sphereGeometry args={[p.headRadius * 0.075, 18, 12]} />
        </Surface>
      ))}
      {[-1, 1].map((side) => (
        <group key={`ear-${side}`}>
          <Surface
            zoneId={side < 0 ? 'ohr-links' : 'ohr-rechts'}
            name={side < 0 ? 'surface-ear-left' : 'surface-ear-right'}
            color={skin}
            position={[side * p.headRadius * 0.9, headY, 0]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[0.52, 1, 0.72]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <torusGeometry args={[p.headRadius * 0.18, p.headRadius * 0.055, 10, 28]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'ohr-links' : 'ohr-rechts'}
            name={side < 0 ? 'surface-ear-concha-left' : 'surface-ear-concha-right'}
            color={mucosaColor}
            position={[side * p.headRadius * 0.91, headY - p.headRadius * 0.01, 0]}
            scale={[0.32, 0.7, 0.36]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.headRadius * 0.12, 18, 14]} />
          </Surface>
        </group>
      ))}
      <Surface
        zoneId="mund"
        name="surface-mouth"
        color="#a84d52"
        position={[0, headY - p.headRadius * 0.38, p.headRadius * 0.91]}
        scale={[1.5, 0.38, 0.28]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[p.headRadius * 0.14, 20, 12]} />
      </Surface>
      <Surface
        zoneId="oberlippe"
        name="surface-upper-lip"
        color={mucosaColor}
        position={[0, headY - p.headRadius * 0.35, p.headRadius * 0.945]}
        scale={[1.7, 0.3, 0.22]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[p.headRadius * 0.115, 20, 12]} />
      </Surface>
      <Surface
        zoneId="unterlippe"
        name="surface-lower-lip"
        color={mucosaColor}
        position={[0, headY - p.headRadius * 0.42, p.headRadius * 0.95]}
        scale={[1.7, 0.32, 0.22]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[p.headRadius * 0.115, 20, 12]} />
      </Surface>
      <Surface
        zoneId="kinn"
        name="surface-chin"
        color={skin}
        position={[0, headY - p.headRadius * 0.66, p.headRadius * 0.68]}
        scale={[1.25, 0.7, 0.52]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[p.headRadius * 0.19, 22, 16]} />
      </Surface>

      <Surface
        zoneId="hals"
        name="surface-neck"
        color={skin}
        position={[0, shoulderY + p.headRadius * 0.3, 0]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <capsuleGeometry args={[p.headRadius * 0.31, p.headRadius * 0.42, 8, 20]} />
      </Surface>

      <Surface
        zoneId="brustkorb"
        name="surface-torso"
        color={skin}
        position={[0, torsoY, 0]}
        scale={[shoulderWidth / 0.52, 1, torsoDepth / 0.24]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <capsuleGeometry args={[0.23, Math.max(0.12, p.torsoLength - 0.35), 12, 32]} />
      </Surface>
      <Surface
        zoneId="bauch"
        name="surface-abdomen"
        color={skin}
        position={[0, torsoY - p.torsoLength * 0.25, torsoDepth * 0.7]}
        scale={[shoulderWidth / 0.62, 1.05, 0.42]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[0.22, 30, 22]} />
      </Surface>
      <Surface
        zoneId="bauchnabel"
        name="surface-navel"
        color={mucosaColor}
        position={[0, torsoY - p.torsoLength * 0.25, torsoDepth * 1.02]}
        scale={[1, 1, 0.38]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <torusGeometry args={[0.018 * anatomicalMaturity, 0.005, 8, 20]} />
      </Surface>
      {[-1, 1].map((side) => (
        <Surface
          key={`clavicle-${side}`}
          zoneId={side < 0 ? 'schluesselbein-links' : 'schluesselbein-rechts'}
          name={side < 0 ? 'surface-clavicle-left' : 'surface-clavicle-right'}
          color={skin}
          position={[
            side * shoulderWidth * 0.19,
            shoulderY - p.headRadius * 0.17,
            torsoDepth * 0.78,
          ]}
          rotation={[0, 0, side * Math.PI * 0.42]}
          scale={[0.55, 1, 0.5]}
          disabled={disabled}
          onSurfacePress={onSurfacePress}
        >
          <capsuleGeometry args={[p.limbRadius * 0.18, shoulderWidth * 0.28, 6, 16]} />
        </Surface>
      ))}
      {[-1, 1].map((side) => (
        <Surface
          key={`shoulder-${side}`}
          zoneId={side < 0 ? 'schulter-links' : 'schulter-rechts'}
          name={side < 0 ? 'surface-shoulder-left' : 'surface-shoulder-right'}
          color={skin}
          position={[side * shoulderWidth * 0.49, shoulderY - p.limbRadius * 0.35, 0]}
          scale={[1.12, 0.92, 1]}
          disabled={disabled}
          onSurfacePress={onSurfacePress}
        >
          <sphereGeometry args={[p.limbRadius * 1.32, 24, 18]} />
        </Surface>
      ))}
      <Surface
        zoneId="oberer-ruecken"
        name="surface-upper-back"
        color={skin}
        position={[0, torsoY + p.torsoLength * 0.2, -torsoDepth * 0.91]}
        scale={[shoulderWidth / 0.6, 1.3, 0.3]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[0.22, 30, 22]} />
      </Surface>
      {[-1, 1].map((side) => (
        <Surface
          key={`scapula-${side}`}
          zoneId={side < 0 ? 'schulterblatt-links' : 'schulterblatt-rechts'}
          name={side < 0 ? 'surface-scapula-left' : 'surface-scapula-right'}
          color={skin}
          position={[
            side * shoulderWidth * 0.22,
            torsoY + p.torsoLength * 0.19,
            -torsoDepth * 1.04,
          ]}
          scale={[1.15, 1.38, 0.25]}
          disabled={disabled}
          onSurfacePress={onSurfacePress}
        >
          <sphereGeometry args={[shoulderWidth * 0.115, 22, 16]} />
        </Surface>
      ))}
      <Surface
        zoneId="wirbelsaeule-brust"
        name="surface-thoracic-spine"
        color={skin}
        position={[0, torsoY + p.torsoLength * 0.1, -torsoDepth * 1.08]}
        scale={[0.42, 1, 0.35]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <capsuleGeometry args={[p.limbRadius * 0.2, p.torsoLength * 0.48, 8, 20]} />
      </Surface>
      <Surface
        zoneId="unterer-ruecken"
        name="surface-lower-back"
        color={skin}
        position={[0, torsoY - p.torsoLength * 0.3, -torsoDepth * 0.96]}
        scale={[shoulderWidth / 0.7, 0.9, 0.28]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[0.21, 26, 18]} />
      </Surface>

      {isBreastPresentation && showAdultChest
        ? [-1, 1].map((side) => (
            <Surface
              key={`breast-${side}`}
              zoneId={side < 0 ? 'brust-links' : 'brust-rechts'}
              name={side < 0 ? 'surface-breast-left' : 'surface-breast-right'}
              color={skin}
              position={[side * shoulderWidth * 0.2, torsoY + p.torsoLength * 0.2, torsoDepth]}
              scale={[1.15, 0.9, 0.65]}
              disabled={disabled}
              onSurfacePress={onSurfacePress}
            >
              <sphereGeometry args={[shoulderWidth * 0.16, 24, 18]} />
            </Surface>
          ))
        : null}
      {showAdultChest
        ? [-1, 1].map((side) => {
            const nippleProjection = isBreastPresentation
              ? torsoDepth + shoulderWidth * 0.105
              : torsoDepth * 1.02;
            return (
              <Surface
                key={`nipple-${side}`}
                zoneId={side < 0 ? 'brustwarze-links' : 'brustwarze-rechts'}
                name={side < 0 ? 'surface-nipple-left' : 'surface-nipple-right'}
                color={mucosaColor}
                position={[
                  side * shoulderWidth * 0.2,
                  torsoY + p.torsoLength * 0.2,
                  nippleProjection,
                ]}
                scale={[1, 1, 0.55]}
                disabled={disabled}
                onSurfacePress={onSurfacePress}
              >
                <sphereGeometry args={[shoulderWidth * 0.035, 18, 12]} />
              </Surface>
            );
          })
        : null}

      <Surface
        zoneId="becken"
        name="surface-pelvis"
        color={skin}
        position={[0, pelvisY, 0]}
        scale={[pelvisWidth / 0.38, 0.72, torsoDepth / 0.24]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[0.23, 30, 22]} />
      </Surface>
      <Surface
        zoneId="kreuzbein"
        name="surface-sacrum"
        color={skin}
        position={[0, pelvisY + pelvisWidth * 0.08, -torsoDepth * 1.03]}
        scale={[1.15, 1.3, 0.28]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[pelvisWidth * 0.12, 22, 16]} />
      </Surface>
      <Surface
        zoneId="steissbein"
        name="surface-coccyx"
        color={skin}
        position={[0, pelvisY - pelvisWidth * 0.17, -torsoDepth * 1.04]}
        scale={[0.72, 1.2, 0.3]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[pelvisWidth * 0.075, 18, 14]} />
      </Surface>

      {[-1, 1].map((side) => (
        <group key={`buttock-${side}`}>
          <Surface
            zoneId={side < 0 ? 'gesaess-links' : 'gesaess-rechts'}
            name={side < 0 ? 'surface-buttock-left' : 'surface-buttock-right'}
            color={skin}
            position={[
              side * pelvisWidth * 0.2,
              pelvisY - pelvisWidth * 0.04,
              -torsoDepth * 0.72,
            ]}
            scale={[1, 1.15, 0.66]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[pelvisWidth * 0.24, 26, 20]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'sitzbeinhoecker-links' : 'sitzbeinhoecker-rechts'}
            name={side < 0 ? 'surface-ischial-left' : 'surface-ischial-right'}
            color={skin}
            position={[
              side * pelvisWidth * 0.2,
              pelvisY - pelvisWidth * 0.24,
              -torsoDepth * 1.02,
            ]}
            scale={[1, 0.72, 0.35]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[pelvisWidth * 0.095, 18, 14]} />
          </Surface>
        </group>
      ))}
      <Surface
        zoneId="anus"
        name="surface-anus"
        color={mucosaColor}
        position={[0, pelvisY - pelvisWidth * 0.26, -torsoDepth * 0.98]}
        rotation={[0, 0, 0]}
        scale={[1, 1.25, 0.42]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <torusGeometry args={[genitalUnit * 0.26, genitalUnit * 0.09, 10, 24]} />
      </Surface>

      {resolvedGenitalAnatomy === 'unbekannt' ? (
        <Surface
          zoneId="anogenitalregion"
          name="surface-anogenital-unspecified"
          color={skin}
          position={[0, genitalY, genitalFrontZ + genitalUnit * 0.18]}
          scale={[1.25, 1.12, 0.38]}
          disabled={disabled}
          onSurfacePress={onSurfacePress}
        >
          <sphereGeometry args={[genitalUnit * 0.78, 22, 16]} />
        </Surface>
      ) : null}

      {resolvedGenitalAnatomy === 'penis' ? (
        <group>
          <Surface
            zoneId="penis"
            name="surface-penis"
            color={skin}
            position={[0, genitalY, genitalFrontZ + genitalUnit * 0.72]}
            rotation={[Math.PI * 0.44, 0, 0]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <capsuleGeometry args={[genitalUnit * 0.36, genitalUnit * 1.25, 10, 22]} />
          </Surface>
          <Surface
            zoneId="eichel"
            name="surface-glans"
            color={mucosaColor}
            position={[0, genitalY - genitalUnit * 0.64, genitalFrontZ + genitalUnit * 1.03]}
            scale={[0.88, 1.08, 0.88]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[genitalUnit * 0.42, 22, 16]} />
          </Surface>
          {[-1, 1].map((side) => (
            <Surface
              key={`scrotum-${side}`}
              zoneId="skrotum"
              name={side < 0 ? 'surface-scrotum-left' : 'surface-scrotum-right'}
              color={skin}
              position={[
                side * genitalUnit * 0.34,
                genitalY - genitalUnit * 0.03,
                genitalFrontZ + genitalUnit * 0.28,
              ]}
              scale={[0.82, 1.12, 0.88]}
              disabled={disabled}
              onSurfacePress={onSurfacePress}
            >
              <sphereGeometry args={[genitalUnit * 0.48, 22, 16]} />
            </Surface>
          ))}
          <Surface
            zoneId="harnroehrenoeffnung-penis"
            name="surface-urethral-opening-penis"
            color="#6f2733"
            position={[0, genitalY - genitalUnit * 0.68, genitalFrontZ + genitalUnit * 1.39]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[genitalUnit * 0.09, 14, 10]} />
          </Surface>
        </group>
      ) : null}

      {resolvedGenitalAnatomy === 'vulva' ? (
        <group>
          <Surface
            zoneId="vulva"
            name="surface-mons-pubis"
            color={skin}
            position={[0, genitalY + genitalUnit * 0.92, genitalFrontZ + genitalUnit * 0.08]}
            scale={[1.35, 0.82, 0.48]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[genitalUnit * 0.62, 22, 16]} />
          </Surface>
          {[-1, 1].map((side) => (
            <group key={`labia-${side}`}>
              <Surface
                zoneId={side < 0 ? 'labium-majus-links' : 'labium-majus-rechts'}
                name={side < 0 ? 'surface-labium-majus-left' : 'surface-labium-majus-right'}
                color={skin}
                position={[
                  side * genitalUnit * 0.42,
                  genitalY - genitalUnit * 0.13,
                  genitalFrontZ + genitalUnit * 0.22,
                ]}
                scale={[0.65, 1.38, 0.62]}
                disabled={disabled}
                onSurfacePress={onSurfacePress}
              >
                <capsuleGeometry args={[genitalUnit * 0.28, genitalUnit * 0.72, 10, 20]} />
              </Surface>
              <Surface
                zoneId={side < 0 ? 'labium-minus-links' : 'labium-minus-rechts'}
                name={side < 0 ? 'surface-labium-minus-left' : 'surface-labium-minus-right'}
                color={mucosaColor}
                position={[
                  side * genitalUnit * 0.18,
                  genitalY - genitalUnit * 0.13,
                  genitalFrontZ + genitalUnit * 0.37,
                ]}
                scale={[0.48, 1.2, 0.42]}
                disabled={disabled}
                onSurfacePress={onSurfacePress}
              >
                <capsuleGeometry args={[genitalUnit * 0.2, genitalUnit * 0.58, 10, 18]} />
              </Surface>
            </group>
          ))}
          <Surface
            zoneId="klitorisregion"
            name="surface-clitoral-region"
            color={mucosaColor}
            position={[0, genitalY + genitalUnit * 0.48, genitalFrontZ + genitalUnit * 0.43]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[genitalUnit * 0.14, 16, 12]} />
          </Surface>
          <Surface
            zoneId="harnroehrenoeffnung-vulva"
            name="surface-urethral-opening-vulva"
            color="#6f2733"
            position={[0, genitalY + genitalUnit * 0.12, genitalFrontZ + genitalUnit * 0.48]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[genitalUnit * 0.075, 14, 10]} />
          </Surface>
          <Surface
            zoneId="vaginaloeffnung"
            name="surface-vaginal-opening"
            color="#6f2733"
            position={[0, genitalY - genitalUnit * 0.32, genitalFrontZ + genitalUnit * 0.46]}
            scale={[0.72, 1.2, 0.5]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <torusGeometry args={[genitalUnit * 0.22, genitalUnit * 0.075, 10, 24]} />
          </Surface>
        </group>
      ) : null}

      {[-1, 1].map((side) => (
        <group key={`arm-${side}`}>
          <Surface
            zoneId={side < 0 ? 'oberarm-links' : 'oberarm-rechts'}
            name={side < 0 ? 'surface-upper-arm-left' : 'surface-upper-arm-right'}
            color={skin}
            position={[side * armX, shoulderY - upperArmLength / 2, 0]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <capsuleGeometry args={[p.limbRadius, upperArmLength - p.limbRadius * 2, 8, 20]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'ellenbogen-links' : 'ellenbogen-rechts'}
            name={side < 0 ? 'surface-elbow-left' : 'surface-elbow-right'}
            color={skin}
            position={[side * armX, elbowY, 0]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.limbRadius * 1.05, 20, 16]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'unterarm-links' : 'unterarm-rechts'}
            name={side < 0 ? 'surface-forearm-left' : 'surface-forearm-right'}
            color={skin}
            position={[side * armX, elbowY - lowerArmLength / 2, 0]}
            scale={[0.88, 1, 0.92]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <capsuleGeometry args={[p.limbRadius, lowerArmLength - p.limbRadius * 2, 8, 20]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'handgelenk-links' : 'handgelenk-rechts'}
            name={side < 0 ? 'surface-wrist-left' : 'surface-wrist-right'}
            color={skin}
            position={[side * armX, handY + p.handScale * 0.78, 0]}
            scale={[0.82, 1, 0.78]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <capsuleGeometry args={[p.limbRadius * 0.58, p.handScale * 0.2, 7, 16]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'handflaeche-links' : 'handflaeche-rechts'}
            name={side < 0 ? 'surface-hand-left' : 'surface-hand-right'}
            color={skin}
            position={[side * armX, handY, 0]}
            scale={[0.72, 1.15, 0.35]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.handScale, 24, 18]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'handruecken-links' : 'handruecken-rechts'}
            name={side < 0 ? 'surface-hand-back-left' : 'surface-hand-back-right'}
            color={skin}
            position={[side * armX, handY, -p.handScale * 0.31]}
            scale={[0.7, 1.1, 0.18]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.handScale, 22, 16]} />
          </Surface>
          {FINGER_ZONE_BASES.map((finger) => (
            <Surface
              key={`${finger.id}-${side}`}
              zoneId={`${finger.id}-${side < 0 ? 'links' : 'rechts'}`}
              name={`surface-${finger.id}-${side < 0 ? 'left' : 'right'}`}
              color={skin}
              position={[
                side * armX + finger.offset * p.handScale * 0.54,
                handY - p.handScale * (0.8 + finger.length * 0.38),
                p.handScale * 0.05,
              ]}
              rotation={[0, 0, finger.angle * side]}
              scale={[0.72, 1, 0.68]}
              disabled={disabled}
              onSurfacePress={onSurfacePress}
            >
              <capsuleGeometry
                args={[
                  p.handScale * 0.105,
                  p.handScale * finger.length * 0.72,
                  7,
                  14,
                ]}
              />
            </Surface>
          ))}
        </group>
      ))}

      {[-1, 1].map((side) => (
        <group key={`leg-${side}`}>
          <Surface
            zoneId={side < 0 ? 'oberschenkel-vorn-links' : 'oberschenkel-vorn-rechts'}
            name={side < 0 ? 'surface-thigh-left' : 'surface-thigh-right'}
            color={skin}
            position={[side * legX, legCenterY + p.legLength * 0.25, 0]}
            scale={[1.18, 1, 1.1]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <capsuleGeometry args={[p.limbRadius, p.legLength * 0.4, 10, 24]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'oberschenkel-hinten-links' : 'oberschenkel-hinten-rechts'}
            name={side < 0 ? 'surface-posterior-thigh-left' : 'surface-posterior-thigh-right'}
            color={skin}
            position={[
              side * legX,
              legCenterY + p.legLength * 0.25,
              -p.limbRadius * 0.92,
            ]}
            scale={[1.08, 1, 0.34]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <capsuleGeometry args={[p.limbRadius, p.legLength * 0.36, 9, 22]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'knie-links' : 'knie-rechts'}
            name={side < 0 ? 'surface-knee-left' : 'surface-knee-right'}
            color={skin}
            position={[side * legX, legCenterY, p.limbRadius * 0.18]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.limbRadius * 1.22, 22, 18]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'kniekehle-links' : 'kniekehle-rechts'}
            name={side < 0 ? 'surface-popliteal-left' : 'surface-popliteal-right'}
            color={skin}
            position={[side * legX, legCenterY, -p.limbRadius * 1.04]}
            scale={[0.9, 0.78, 0.3]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.limbRadius * 0.86, 18, 14]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'unterschenkel-vorn-links' : 'unterschenkel-vorn-rechts'}
            name={side < 0 ? 'surface-lower-leg-left' : 'surface-lower-leg-right'}
            color={skin}
            position={[side * legX, legCenterY - p.legLength * 0.25, 0]}
            scale={[0.95, 1, 0.9]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <capsuleGeometry args={[p.limbRadius, p.legLength * 0.4, 10, 24]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'unterschenkel-hinten-links' : 'unterschenkel-hinten-rechts'}
            name={side < 0 ? 'surface-calf-left' : 'surface-calf-right'}
            color={skin}
            position={[
              side * legX,
              legCenterY - p.legLength * 0.22,
              -p.limbRadius * 0.88,
            ]}
            scale={[1.02, 1, 0.44]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <capsuleGeometry args={[p.limbRadius * 0.92, p.legLength * 0.31, 9, 22]} />
          </Surface>
          {[-1, 1].map((ankleSide) => {
            const isInner = ankleSide === -side;
            return (
              <Surface
                key={`ankle-${side}-${ankleSide}`}
                zoneId={`${isInner ? 'innenknoechel' : 'aussenknoechel'}-${side < 0 ? 'links' : 'rechts'}`}
                name={`surface-${isInner ? 'inner' : 'outer'}-ankle-${side < 0 ? 'left' : 'right'}`}
                color={skin}
                position={[
                  side * legX + ankleSide * p.limbRadius * 0.66,
                  p.limbRadius * 1.1,
                  0,
                ]}
                scale={[0.72, 1, 0.82]}
                disabled={disabled}
                onSurfacePress={onSurfacePress}
              >
                <sphereGeometry args={[p.limbRadius * 0.52, 18, 14]} />
              </Surface>
            );
          })}
          <Surface
            zoneId={side < 0 ? 'fussruecken-links' : 'fussruecken-rechts'}
            name={side < 0 ? 'surface-foot-left' : 'surface-foot-right'}
            color={skin}
            position={[side * legX, -0.03, p.footScale * 0.35]}
            scale={[0.55, 0.42, 1.25]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.footScale, 24, 18]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'ferse-links' : 'ferse-rechts'}
            name={side < 0 ? 'surface-heel-left' : 'surface-heel-right'}
            color={skin}
            position={[side * legX, -0.035, -p.footScale * 0.42]}
            scale={[0.72, 0.72, 0.75]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.footScale * 0.5, 22, 16]} />
          </Surface>
          <Surface
            zoneId={side < 0 ? 'fusssohle-links' : 'fusssohle-rechts'}
            name={side < 0 ? 'surface-sole-left' : 'surface-sole-right'}
            color={skin}
            position={[side * legX, -p.footScale * 0.14, p.footScale * 0.35]}
            scale={[0.53, 0.13, 1.18]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.footScale, 24, 18]} />
          </Surface>
          {TOE_ZONE_BASES.map((toe) => (
            <Surface
              key={`${toe.id}-${side}`}
              zoneId={`${toe.id}-${side < 0 ? 'links' : 'rechts'}`}
              name={`surface-${toe.id}-${side < 0 ? 'left' : 'right'}`}
              color={skin}
              position={[
                side * legX - side * toe.offset * p.footScale * 0.55,
                -0.035,
                p.footScale * (1.2 + toe.length * 0.24),
              ]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[0.92, 1, 0.82]}
              disabled={disabled}
              onSurfacePress={onSurfacePress}
            >
              <capsuleGeometry
                args={[
                  p.footScale * 0.105 * toe.radius,
                  p.footScale * 0.28 * toe.length,
                  7,
                  14,
                ]}
              />
            </Surface>
          ))}
        </group>
      ))}

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

export function isBodySurfaceObject(value: unknown): value is Mesh {
  return value instanceof Mesh && typeof value.userData?.zoneId === 'string';
}
