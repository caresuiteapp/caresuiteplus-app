import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { getBodyMapModel } from '@/lib/pflege/bodyMap3d/modelCatalog';
import { ParametricBodyModel } from './ParametricBodyModel';
import type { BodyMap3DViewerProps } from './BodyMap3DViewer.types';

export function BodyMap3DViewer({
  selection,
  markers,
  selectedMarkerId,
  disabled,
  onSurfacePress,
  onMarkerPress,
}: BodyMap3DViewerProps) {
  const model = getBodyMapModel(selection);

  return (
    <View style={styles.shell}>
      <View style={styles.statusRow}>
        <View>
          <Text style={styles.modelLabel}>{model.label}</Text>
          <Text style={styles.help}>Ziehen: drehen · Mausrad/2 Finger: zoomen · Rechtsziehen: verschieben</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>3D</Text>
        </View>
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
        >
          <color attach="background" args={['#071326']} />
          <ambientLight intensity={1.5} />
          <hemisphereLight args={['#dcecff', '#13233f', 1.4]} />
          <directionalLight
            castShadow
            position={[3, 5, 4]}
            intensity={2.2}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <directionalLight position={[-3, 2, -4]} intensity={0.9} color="#70a5ff" />
          <ParametricBodyModel
            selection={selection}
            markers={markers}
            selectedMarkerId={selectedMarkerId}
            disabled={disabled}
            onSurfacePress={onSurfacePress}
            onMarkerPress={onMarkerPress}
          />
          <ContactShadows
            position={[0, -1.31, 0]}
            opacity={0.38}
            scale={4}
            blur={2.6}
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
  canvas: { flex: 1, minHeight: 550 },
});
