import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
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

type ModelProps = {
  selection: BodyMapModelSelection;
  markers: readonly BodyMap3DMarker[];
  selectedMarkerId?: string | null;
  disabled?: boolean;
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
};

const SKIN_COLORS: Record<BodyMapSkinTone, string> = {
  sehr_hell: '#f4d4c4',
  hell: '#ddb29a',
  mittel: '#b97855',
  dunkel: '#75452f',
  sehr_dunkel: '#3d241c',
};

function modelScale(ageGroup: BodyMapAgeGroup): number {
  if (ageGroup === 'baby') return 0.78;
  if (ageGroup === 'kleinkind') return 0.86;
  if (ageGroup === 'kind') return 0.93;
  return 1;
}

function hitFromEvent(event: ThreeEvent<PointerEvent>): BodyMapSurfaceHit | null {
  const object = event.object as Object3D & { userData: { zoneId?: string } };
  const anatomicalZoneId = object.userData.zoneId;
  if (!anatomicalZoneId) return null;
  const worldPosition = event.point.clone();
  const localPosition = object.worldToLocal(worldPosition.clone());
  const faceNormal = event.face?.normal?.clone() ?? new Vector3(0, 0, 1);
  const normalMatrix = new Matrix3().getNormalMatrix(object.matrixWorld);
  faceNormal.applyMatrix3(normalMatrix).normalize();
  const intersection = event.intersections[0] as
    | (Intersection<Object3D> & { faceIndex?: number; index?: number })
    | undefined;
  return {
    anatomicalZoneId,
    surfacePoint: {
      localPosition: { x: localPosition.x, y: localPosition.y, z: localPosition.z },
      worldPosition: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z },
      normal: { x: faceNormal.x, y: faceNormal.y, z: faceNormal.z },
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
        roughness={0.58}
        metalness={0}
        clearcoat={0.08}
        clearcoatRoughness={0.75}
      />
    </mesh>
  );
}

function XMarker({
  marker,
  selected,
  onPress,
}: {
  marker: BodyMap3DMarker;
  selected: boolean;
  onPress?: (marker: BodyMap3DMarker) => void;
}) {
  const position = marker.surfacePoint.worldPosition;
  const normal = marker.surfacePoint.normal;
  const quaternion = useMemo(() => {
    const target = new Vector3(normal.x, normal.y, normal.z).normalize();
    return new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), target);
  }, [normal.x, normal.y, normal.z]);
  const markerScale = selected ? 1.35 : 1;

  return (
    <group
      name={`marker-${marker.id}`}
      position={[
        position.x + normal.x * 0.012,
        position.y + normal.y * 0.012,
        position.z + normal.z * 0.012,
      ]}
      quaternion={quaternion}
      scale={markerScale}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPress?.(marker);
      }}
    >
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.095, 0.014, 0.014]} />
        <meshStandardMaterial color="#ef233c" emissive="#7d0012" emissiveIntensity={0.7} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.095, 0.014, 0.014]} />
        <meshStandardMaterial color="#ef233c" emissive="#7d0012" emissiveIntensity={0.7} />
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
  onSurfacePress,
  onMarkerPress,
}: ModelProps) {
  const p = PROPORTIONS[selection.ageGroup];
  const skin = new Color(SKIN_COLORS[selection.skinTone]).getStyle();
  const heightScale = modelScale(selection.ageGroup);
  const legCenterY = p.legLength / 2;
  const pelvisY = p.legLength + 0.08;
  const torsoY = pelvisY + p.torsoLength / 2 + 0.14;
  const shoulderY = pelvisY + p.torsoLength + 0.08;
  const headY = shoulderY + p.headRadius * 2.15;
  const armX = p.shoulderWidth / 2 + p.limbRadius * 1.6;
  const upperArmLength = p.armLength * 0.48;
  const lowerArmLength = p.armLength * 0.42;
  const elbowY = shoulderY - upperArmLength;
  const handY = elbowY - lowerArmLength - p.handScale * 0.35;
  const legX = p.pelvisWidth * 0.28;
  const isBreastPresentation =
    selection.chestAnatomy === 'brueste' ||
    (selection.sex === 'weiblich' && selection.chestAnatomy !== 'keine_brueste');
  const showAdultChest =
    selection.ageGroup === 'junger_erwachsener' || selection.ageGroup === 'erwachsener';

  return (
    <group rotation={rotation} scale={scale * heightScale} position={[0, -1.25, 0]}>
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
        <Surface
          key={`ear-${side}`}
          zoneId={side < 0 ? 'ohr-links' : 'ohr-rechts'}
          name={side < 0 ? 'surface-ear-left' : 'surface-ear-right'}
          color={skin}
          position={[side * p.headRadius * 0.88, headY, 0]}
          scale={[0.35, 0.78, 0.3]}
          disabled={disabled}
          onSurfacePress={onSurfacePress}
        >
          <sphereGeometry args={[p.headRadius * 0.32, 20, 14]} />
        </Surface>
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
        scale={[p.shoulderWidth / 0.52, 1, p.torsoDepth / 0.24]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <capsuleGeometry args={[0.23, Math.max(0.12, p.torsoLength - 0.35), 12, 32]} />
      </Surface>

      {isBreastPresentation && showAdultChest
        ? [-1, 1].map((side) => (
            <Surface
              key={`breast-${side}`}
              zoneId={side < 0 ? 'brust-links' : 'brust-rechts'}
              name={side < 0 ? 'surface-breast-left' : 'surface-breast-right'}
              color={skin}
              position={[side * p.shoulderWidth * 0.2, torsoY + p.torsoLength * 0.2, p.torsoDepth]}
              scale={[1.15, 0.9, 0.65]}
              disabled={disabled}
              onSurfacePress={onSurfacePress}
            >
              <sphereGeometry args={[p.shoulderWidth * 0.16, 24, 18]} />
            </Surface>
          ))
        : null}

      <Surface
        zoneId="becken"
        name="surface-pelvis"
        color={skin}
        position={[0, pelvisY, 0]}
        scale={[p.pelvisWidth / 0.38, 0.72, p.torsoDepth / 0.24]}
        disabled={disabled}
        onSurfacePress={onSurfacePress}
      >
        <sphereGeometry args={[0.23, 30, 22]} />
      </Surface>

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
            zoneId={side < 0 ? 'ferse-links' : 'ferse-rechts'}
            name={side < 0 ? 'surface-foot-left' : 'surface-foot-right'}
            color={skin}
            position={[side * legX, -0.03, p.footScale * 0.35]}
            scale={[0.55, 0.42, 1.25]}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
          >
            <sphereGeometry args={[p.footScale, 24, 18]} />
          </Surface>
        </group>
      ))}

      {markers.map((marker) => (
        <XMarker
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
