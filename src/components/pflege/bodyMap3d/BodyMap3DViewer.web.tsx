import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ACESFilmicToneMapping, SRGBColorSpace, Vector3 } from 'three';
import { getBodyMapModel } from '@/lib/pflege/bodyMap3d/modelCatalog';
import {
  canRenderRealHumanVisual,
  canPreviewMedicalMesh,
  canRenderMedicalMesh,
  getMedicalMeshDefinition,
  getRealHumanVisualDefinition,
  medicalMeshRendererLabel,
} from '@/lib/pflege/bodyMap3d/medicalMeshCatalog';
import { ClinicalBodyModel } from './ClinicalBodyModel';
import type { BodyMap3DViewerProps } from './BodyMap3DViewer.types';
import { getActiveBodyMapMedicalApproval } from '@/lib/pflege/bodyMap3d/medicalReviewRuntimeService';
import {
  liquidColors,
  liquidRadius,
  liquidShadows,
  liquidSpace,
  liquidTypography,
} from '@/liquid-command/foundation/tokens';

const VIEW_PRESETS = [
  { id: 'front', label: 'Vorne', yaw: 0 },
  { id: 'back', label: 'Hinten', yaw: Math.PI },
  { id: 'left', label: 'Links', yaw: Math.PI / 2 },
  { id: 'right', label: 'Rechts', yaw: -Math.PI / 2 },
] as const;

type ViewerTool = 'rotate' | 'marker';

function ViewerToolButton({
  icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: string;
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolButton,
        active && styles.toolButtonActive,
        pressed && styles.toolButtonPressed,
        disabled && styles.toolButtonDisabled,
      ]}
    >
      <Ionicons
        name={icon as never}
        size={21}
        color={active ? liquidColors.white : liquidColors.blue200}
      />
    </Pressable>
  );
}

function CameraZoomController({
  baseDistance,
  zoom,
}: {
  baseDistance: number;
  zoom: number;
}) {
  const { camera } = useThree();
  useEffect(() => {
    const direction = camera.position.clone();
    if (direction.lengthSq() < 0.0001) direction.copy(new Vector3(0, 0, 1));
    direction.normalize();
    camera.position.copy(direction.multiplyScalar(baseDistance / zoom));
    camera.updateProjectionMatrix();
  }, [baseDistance, camera, zoom]);
  return null;
}

export function BodyMap3DViewer({
  selection,
  markers,
  selectedMarkerId,
  disabled,
  allowTechnicalMeshPreview = true,
  presentationMode = 'embedded',
  onSurfacePress,
  onMarkerPress,
}: BodyMap3DViewerProps) {
  const viewport = useWindowDimensions();
  const clinicalMode = presentationMode === 'clinical';
  const compact = viewport.width < 760;
  const orbitRef = useRef<{
    reset: () => void;
    update: () => void;
  } | null>(null);
  const [activeTool, setActiveTool] = useState<ViewerTool>('marker');
  const [zoom, setZoom] = useState(1);
  const model = getBodyMapModel(selection);
  const medicalMesh = getMedicalMeshDefinition(selection);
  const realHumanVisual = getRealHumanVisualDefinition(selection);
  const realHumanActive = canRenderRealHumanVisual(realHumanVisual);
  const [medicalApproved, setMedicalApproved] = useState(false);
  useEffect(() => {
    let active = true;
    setMedicalApproved(false);
    if (clinicalMode || !realHumanActive) return () => { active = false; };
    void getActiveBodyMapMedicalApproval(
      realHumanVisual.id,
      realHumanVisual.assetSha256,
    ).then((approval) => {
      if (active) setMedicalApproved(approval.approved);
    });
    return () => {
      active = false;
    };
  }, [clinicalMode, realHumanActive, realHumanVisual?.assetSha256, realHumanVisual?.id]);
  const medicalRendererActive =
    realHumanActive ||
    canRenderMedicalMesh(medicalMesh, {
      allowTechnicalPreview: allowTechnicalMeshPreview,
    });
  const technicalPreviewActive =
    !realHumanActive &&
    allowTechnicalMeshPreview &&
    canPreviewMedicalMesh(medicalMesh) &&
    medicalMesh.reviewStatus !== 'released';
  const [activeView, setActiveView] =
    useState<(typeof VIEW_PRESETS)[number]['id']>('front');
  const modelRotation = VIEW_PRESETS.find((preset) => preset.id === activeView)?.yaw ?? 0;
  const groundY = -medicalMesh.nominalHeightMeters / 2 - 0.015;
  const cameraFov = 32;
  const cameraDistance =
    medicalMesh.nominalHeightMeters /
    (2 * Math.tan((cameraFov * Math.PI) / 360) * 0.84);
  const reviewHeight = Math.max(720, Math.min(980, viewport.height - 150));
  const setPreset = (viewId: (typeof VIEW_PRESETS)[number]['id']) => {
    setActiveView(viewId);
    setZoom(1);
    orbitRef.current?.reset();
    orbitRef.current?.update();
  };
  const zoomIn = () => setZoom((current) => Math.min(2.4, current * 1.2));
  const zoomOut = () => setZoom((current) => Math.max(0.62, current / 1.2));

  return (
    <View
      style={[
        styles.shell,
        presentationMode === 'review' && { minHeight: reviewHeight },
        clinicalMode && styles.shellClinical,
        compact && styles.shellCompact,
      ]}
    >
      <View style={styles.statusRow}>
        <View style={styles.statusCopy}>
          <Text style={styles.modelLabel}>
            {clinicalMode ? 'Klinische 3D-Anatomiekarte' : model.label}
          </Text>
          <Text style={styles.rendererStatus}>
            {clinicalMode
              ? 'Blaues anatomisches Netzwerk · alle Befunde auf einer gemeinsamen Karte'
              : realHumanActive
              ? medicalApproved
                ? 'Real-Human 3D · medizinisch freigegeben'
                : 'Real-Human 3D · medizinische Prüfung ausstehend'
              : medicalMeshRendererLabel(medicalMesh, {
                  allowTechnicalPreview: allowTechnicalMeshPreview,
                })}
          </Text>
          {!clinicalMode && technicalPreviewActive ? (
            <Text style={styles.technicalWarning}>
              TECHNISCHE REFERENZ · NICHT MEDIZINISCH FREIGEGEBEN
            </Text>
          ) : null}
          {!clinicalMode && realHumanActive && !medicalApproved ? (
            <Text style={styles.technicalWarning}>
              REAL-HUMAN PRODUKTIONSKANDIDAT · MEDIZINISCHE PRÜFUNG AUSSTEHEND
            </Text>
          ) : null}
          <Text style={styles.help}>
            {activeTool === 'marker'
              ? 'Ziel aktiv: Körperstelle antippen · Marker öffnen den klinischen Verlauf'
              : 'Navigation aktiv: ziehen, zoomen und die Perspektive verschieben'}
          </Text>
        </View>
        <View style={styles.badge}>
          <View style={styles.badgePulse} />
          <Text style={styles.badgeText}>{clinicalMode ? 'NETZ' : realHumanActive ? 'REAL' : medicalRendererActive ? 'GLB' : '3D'}</Text>
        </View>
      </View>
      <View style={styles.viewPresets}>
        {VIEW_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            accessibilityRole="button"
            accessibilityState={{ selected: activeView === preset.id }}
            style={[styles.viewButton, activeView === preset.id && styles.viewButtonActive]}
            onPress={() => setPreset(preset.id)}
          >
            <Ionicons
              name={
                preset.id === 'front'
                  ? 'body-outline'
                  : preset.id === 'back'
                    ? 'accessibility-outline'
                    : 'scan-outline'
              }
              size={16}
              color={activeView === preset.id ? liquidColors.white : liquidColors.white64}
            />
            <Text
              style={[
                styles.viewButtonText,
                activeView === preset.id && styles.viewButtonTextActive,
              ]}
            >
              {preset.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.canvas}>
        <View style={[styles.toolRail, compact && styles.toolRailCompact]}>
          <ViewerToolButton
            icon="hand-left-outline"
            label="Körperkarte drehen"
            active={activeTool === 'rotate'}
            onPress={() => setActiveTool('rotate')}
          />
          <ViewerToolButton
            icon="locate-outline"
            label="Befundpunkt setzen"
            active={activeTool === 'marker'}
            disabled={disabled}
            onPress={() => setActiveTool('marker')}
          />
          <ViewerToolButton
            icon="refresh-outline"
            label="Ansicht zurücksetzen"
            active={false}
            onPress={() => setPreset('front')}
          />
        </View>
        <View style={[styles.zoomRail, compact && styles.zoomRailCompact]}>
          <ViewerToolButton
            icon="add-outline"
            label="Vergrößern"
            active={false}
            onPress={zoomIn}
          />
          <ViewerToolButton
            icon="remove-outline"
            label="Verkleinern"
            active={false}
            onPress={zoomOut}
          />
          <ViewerToolButton
            icon="expand-outline"
            label="Ganzkörper zentrieren"
            active={false}
            onPress={() => setPreset(activeView)}
          />
        </View>
        <Canvas
          key={`${model.id}:${presentationMode}`}
          shadows
          dpr={[1, 1.8]}
          camera={{
            position: [0, 0, cameraDistance],
            fov: cameraFov,
            near: 0.01,
            far: 50,
          }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
            gl.outputColorSpace = SRGBColorSpace;
          }}
        >
          <CameraZoomController baseDistance={cameraDistance} zoom={zoom} />
          <color attach="background" args={['#F4F9FF']} />
          <ambientLight intensity={clinicalMode ? 0.9 : 0.72} />
          <hemisphereLight args={['#FFFFFF', '#CFE4F7', clinicalMode ? 1.35 : 1.05]} />
          <directionalLight
            castShadow
            position={[2.7, 4.5, 3.4]}
            intensity={clinicalMode ? 2.2 : 2.7}
            color={clinicalMode ? '#78cfff' : '#fff3e9'}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight position={[-3.2, 2.2, -3.8]} intensity={1.15} color="#70a5ff" />
          <directionalLight position={[0.3, 1.1, -4.5]} intensity={0.65} color="#dbe9ff" />
          <ClinicalBodyModel
            selection={selection}
            markers={markers}
            selectedMarkerId={selectedMarkerId}
            disabled={disabled || activeTool !== 'marker'}
            allowTechnicalMeshPreview={allowTechnicalMeshPreview}
            visualMode={clinicalMode ? 'clinical-network' : 'skin'}
            rotation={[0, modelRotation, 0]}
            onSurfacePress={onSurfacePress}
            onMarkerPress={onMarkerPress}
          />
          <ContactShadows
            position={[0, groundY, 0]}
            opacity={0.46}
            scale={4}
            blur={2.2}
            far={3}
          />
          <OrbitControls
            ref={orbitRef as never}
            makeDefault
            enableDamping
            dampingFactor={0.08}
            enableRotate={activeTool === 'rotate'}
            enablePan={activeTool === 'rotate'}
            enableZoom
            target={[0, 0, 0]}
            minDistance={Math.max(0.35, medicalMesh.nominalHeightMeters * 0.72)}
            maxDistance={Math.max(3, medicalMesh.nominalHeightMeters * 4.5)}
            minPolarAngle={0.15}
            maxPolarAngle={Math.PI - 0.15}
          />
        </Canvas>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 620,
    borderRadius: liquidRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: liquidColors.navy950,
  },
  shellClinical: {
    minHeight: 660,
    borderColor: liquidColors.blue400,
    ...liquidShadows.focus,
  },
  shellCompact: {
    minHeight: 610,
  },
  statusRow: {
    minHeight: 84,
    paddingHorizontal: liquidSpace.lg,
    paddingVertical: liquidSpace.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: liquidSpace.md,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: liquidColors.blue300Alpha32,
  },
  statusCopy: {
    flex: 1,
  },
  modelLabel: {
    ...liquidTypography.section,
    color: liquidColors.white,
  },
  rendererStatus: {
    ...liquidTypography.meta,
    color: liquidColors.blue200,
    marginTop: 3,
    fontWeight: '700',
  },
  technicalWarning: {
    ...liquidTypography.meta,
    color: '#ffbd66',
    marginTop: 3,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  help: {
    ...liquidTypography.meta,
    color: liquidColors.white56,
    marginTop: 4,
  },
  badge: {
    minWidth: 72,
    height: 34,
    paddingHorizontal: liquidSpace.md,
    borderRadius: liquidRadius.pill,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: liquidColors.blue500Alpha16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  badgePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: liquidColors.blue300,
    shadowColor: liquidColors.blue300,
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  badgeText: {
    ...liquidTypography.meta,
    color: liquidColors.white,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  viewPresets: {
    minHeight: 56,
    paddingHorizontal: liquidSpace.lg,
    paddingVertical: liquidSpace.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: liquidSpace.sm,
    backgroundColor: 'rgba(248,251,255,0.98)',
    borderBottomWidth: 1,
    borderBottomColor: liquidColors.white12,
  },
  viewButton: {
    minWidth: 94,
    minHeight: 38,
    paddingHorizontal: liquidSpace.md,
    borderRadius: liquidRadius.pill,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: liquidColors.white08,
  },
  viewButtonActive: {
    borderColor: liquidColors.blue400,
    backgroundColor: liquidColors.blue500Alpha16,
    ...liquidShadows.focus,
  },
  viewButtonText: {
    ...liquidTypography.meta,
    color: liquidColors.white64,
    fontWeight: '700',
  },
  viewButtonTextActive: {
    color: liquidColors.white,
  },
  canvas: {
    position: 'relative',
    flex: 1,
    minHeight: 550,
    backgroundColor: liquidColors.navy950,
  },
  toolRail: {
    position: 'absolute',
    zIndex: 5,
    top: liquidSpace.md,
    left: liquidSpace.md,
    width: 52,
    padding: 5,
    borderRadius: liquidRadius.card,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(255,255,255,0.94)',
    gap: 5,
  },
  toolRailCompact: {
    top: liquidSpace.sm,
    left: liquidSpace.sm,
  },
  zoomRail: {
    position: 'absolute',
    zIndex: 5,
    right: liquidSpace.md,
    bottom: liquidSpace.md,
    width: 52,
    padding: 5,
    borderRadius: liquidRadius.card,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(255,255,255,0.94)',
    gap: 5,
  },
  zoomRailCompact: {
    right: liquidSpace.sm,
    bottom: liquidSpace.sm,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: liquidRadius.control,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButtonActive: {
    borderColor: liquidColors.blue400,
    backgroundColor: liquidColors.blue600,
    ...liquidShadows.focus,
  },
  toolButtonPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.96 }],
  },
  toolButtonDisabled: {
    opacity: 0.35,
  },
});
