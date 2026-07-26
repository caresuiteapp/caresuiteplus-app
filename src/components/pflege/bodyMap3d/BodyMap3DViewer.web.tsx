import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { colors, spacing, typography } from '@/theme';
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

const VIEW_PRESETS = [
  { id: 'front', label: 'Vorne', yaw: 0 },
  { id: 'back', label: 'Hinten', yaw: Math.PI },
  { id: 'left', label: 'Links', yaw: Math.PI / 2 },
  { id: 'right', label: 'Rechts', yaw: -Math.PI / 2 },
] as const;

export function BodyMap3DViewer({
  selection,
  markers,
  selectedMarkerId,
  disabled,
  allowTechnicalMeshPreview = true,
  onSurfacePress,
  onMarkerPress,
}: BodyMap3DViewerProps) {
  const model = getBodyMapModel(selection);
  const medicalMesh = getMedicalMeshDefinition(selection);
  const realHumanVisual = getRealHumanVisualDefinition(selection);
  const realHumanActive = canRenderRealHumanVisual(realHumanVisual);
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

  return (
    <View style={styles.shell}>
      <View style={styles.statusRow}>
        <View>
          <Text style={styles.modelLabel}>{model.label}</Text>
          <Text style={styles.rendererStatus}>
            {medicalMeshRendererLabel(medicalMesh, {
              allowTechnicalPreview: allowTechnicalMeshPreview,
            })}
          </Text>
          {technicalPreviewActive ? (
            <Text style={styles.technicalWarning}>
              TECHNISCHE REFERENZ · NICHT MEDIZINISCH FREIGEGEBEN
            </Text>
          ) : null}
          {realHumanActive && realHumanVisual.medicalReviewStatus !== 'approved' ? (
            <Text style={styles.technicalWarning}>
              REAL-HUMAN PRODUKTIONSKANDIDAT · MEDIZINISCHE PRÜFUNG AUSSTEHEND
            </Text>
          ) : null}
          <Text style={styles.help}>Ziehen: drehen · Mausrad/2 Finger: zoomen · Rechtsziehen: verschieben</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {realHumanActive ? 'REAL' : medicalRendererActive ? 'GLB' : '3D'}
          </Text>
        </View>
      </View>
      <View style={styles.viewPresets}>
        {VIEW_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            accessibilityRole="button"
            accessibilityState={{ selected: activeView === preset.id }}
            style={[styles.viewButton, activeView === preset.id && styles.viewButtonActive]}
            onPress={() => setActiveView(preset.id)}
          >
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
        <Canvas
          shadows
          dpr={[1, 1.8]}
          camera={{
            position: [0, 0.25, model.cameraDistance],
            fov: 34,
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
          <color attach="background" args={['#071326']} />
          <ambientLight intensity={0.72} />
          <hemisphereLight args={['#f2f7ff', '#15243d', 1.05]} />
          <directionalLight
            castShadow
            position={[2.7, 4.5, 3.4]}
            intensity={2.7}
            color="#fff3e9"
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight position={[-3.2, 2.2, -3.8]} intensity={1.15} color="#70a5ff" />
          <directionalLight position={[0.3, 1.1, -4.5]} intensity={0.65} color="#dbe9ff" />
          <ClinicalBodyModel
            selection={selection}
            markers={markers}
            selectedMarkerId={selectedMarkerId}
            disabled={disabled}
            allowTechnicalMeshPreview={allowTechnicalMeshPreview}
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
            makeDefault
            enableDamping
            dampingFactor={0.08}
            target={[0, 0, 0]}
            minDistance={1.25}
            maxDistance={8}
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
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: '#071326',
  },
  statusRow: {
    minHeight: 70,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(8, 22, 43, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112, 165, 255, 0.22)',
  },
  modelLabel: { ...typography.label, color: '#f5f9ff' },
  rendererStatus: {
    ...typography.caption,
    color: '#66a3ff',
    marginTop: 3,
    fontWeight: '700',
  },
  technicalWarning: {
    ...typography.caption,
    color: '#ffbd66',
    marginTop: 3,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  help: { ...typography.caption, color: '#a9b9d2', marginTop: 4 },
  badge: {
    minWidth: 42,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#1769e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typography.caption, color: '#fff', fontWeight: '800' },
  viewPresets: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    backgroundColor: 'rgba(7,19,38,0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,165,255,0.16)',
  },
  viewButton: {
    minWidth: 72,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(112,165,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  viewButtonActive: {
    borderColor: '#66a3ff',
    backgroundColor: 'rgba(23,105,224,0.34)',
  },
  viewButtonText: { ...typography.caption, color: '#a9b9d2', fontWeight: '700' },
  viewButtonTextActive: { color: '#fff' },
  canvas: { flex: 1, minHeight: 550 },
});
