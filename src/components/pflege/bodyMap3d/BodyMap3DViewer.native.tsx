import { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber/native';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { getBodyMapModel } from '@/lib/pflege/bodyMap3d/modelCatalog';
import { ClinicalBodyModel } from './ClinicalBodyModel';
import type { BodyMap3DViewerProps } from './BodyMap3DViewer.types';

const VIEW_PRESETS = [
  { id: 'front', label: 'Vorne', rotation: [0, 0, 0] as [number, number, number] },
  { id: 'back', label: 'Hinten', rotation: [0, Math.PI, 0] as [number, number, number] },
  { id: 'left', label: 'Links', rotation: [0, Math.PI / 2, 0] as [number, number, number] },
  { id: 'right', label: 'Rechts', rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
] as const;

function touchDistance(touches: readonly { pageX: number; pageY: number }[]): number | null {
  if (touches.length < 2) return null;
  const [a, b] = touches;
  if (!a || !b) return null;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

export function BodyMap3DViewer({
  selection,
  markers,
  selectedMarkerId,
  disabled,
  allowTechnicalMeshPreview: _allowTechnicalMeshPreview,
  presentationMode = 'embedded',
  onSurfacePress,
  onMarkerPress,
}: BodyMap3DViewerProps) {
  const model = getBodyMapModel(selection);
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState<'navigate' | 'marker'>('navigate');
  const rotationStart = useRef<[number, number]>([0, 0]);
  const zoomStart = useRef(1);
  const pinchStart = useRef<number | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          activeTool === 'navigate' &&
          (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),
        onPanResponderGrant: (event) => {
          rotationStart.current = [rotation[0], rotation[1]];
          zoomStart.current = zoom;
          pinchStart.current = touchDistance(event.nativeEvent.touches);
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2) {
            const distance = touchDistance(touches);
            if (distance && pinchStart.current) {
              setZoom(Math.min(2.6, Math.max(0.58, zoomStart.current * (distance / pinchStart.current))));
            }
            return;
          }
          setRotation([
            Math.min(0.75, Math.max(-0.75, rotationStart.current[0] + gesture.dy * 0.006)),
            rotationStart.current[1] + gesture.dx * 0.009,
            0,
          ]);
        },
      }),
    [activeTool, rotation, zoom],
  );

  const clinicalMode = presentationMode === 'clinical';

  return (
    <View style={[styles.shell, clinicalMode && styles.clinicalShell]}>
      <View style={styles.statusRow}>
        <View>
          <Text style={styles.modelLabel}>
            {clinicalMode ? 'Klinische 3D-BodyMap' : model.label}
          </Text>
          <Text style={styles.rendererStatus}>
            {clinicalMode ? 'Einheitliches anatomisches 3D-Netz' : 'Native 3D-Darstellung'}
          </Text>
          <Text style={styles.help}>
            {activeTool === 'navigate'
              ? '1 Finger: drehen · 2 Finger: zoomen'
              : 'Körperoberfläche antippen: Befund setzen'}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>3D</Text>
        </View>
      </View>
      <View style={styles.toolRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="3D-Modell drehen"
          style={[styles.toolButton, activeTool === 'navigate' && styles.toolButtonActive]}
          onPress={() => setActiveTool('navigate')}
        >
          <Ionicons
            name="hand-left-outline"
            size={18}
            color={activeTool === 'navigate' ? '#ffffff' : '#8fc8ff'}
          />
          <Text style={styles.toolButtonText}>Drehen</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Befund auf der Körperoberfläche setzen"
          style={[styles.toolButton, activeTool === 'marker' && styles.toolButtonActive]}
          onPress={() => setActiveTool('marker')}
          disabled={disabled}
        >
          <Ionicons
            name="locate-outline"
            size={18}
            color={activeTool === 'marker' ? '#ffffff' : '#8fc8ff'}
          />
          <Text style={styles.toolButtonText}>Befund</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="3D-Ansicht zurücksetzen"
          style={styles.toolButton}
          onPress={() => {
            setRotation([0, 0, 0]);
            setZoom(1);
          }}
        >
          <Ionicons name="refresh-outline" size={18} color="#8fc8ff" />
          <Text style={styles.toolButtonText}>Reset</Text>
        </Pressable>
      </View>
      <View style={styles.viewPresets}>
        {VIEW_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            accessibilityRole="button"
            style={styles.viewButton}
            onPress={() => setRotation([...preset.rotation])}
          >
            <Text style={styles.viewButtonText}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.canvas} {...panResponder.panHandlers}>
        <Canvas
          shadows
          camera={{
            position: [0, 0.25, model.cameraDistance],
            fov: 34,
            near: 0.01,
            far: 50,
          }}
        >
          <color attach="background" args={['#F4F9FF']} />
          <ambientLight intensity={1.55} />
          <hemisphereLight args={['#ffffff', '#cfe4f7', 1.35]} />
          <directionalLight position={[3, 5, 4]} intensity={2.1} />
          <directionalLight position={[-3, 2, -4]} intensity={0.85} color="#70a5ff" />
          <ClinicalBodyModel
            selection={selection}
            markers={markers}
            selectedMarkerId={selectedMarkerId}
            disabled={disabled || activeTool !== 'marker'}
            visualMode={presentationMode === 'clinical' ? 'clinical-network' : 'skin'}
            rotation={rotation}
            scale={zoom}
            onSurfacePress={onSurfacePress}
            onMarkerPress={onMarkerPress}
          />
        </Canvas>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 590,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: '#F4F9FF',
  },
  clinicalShell: {
    borderColor: 'rgba(65, 151, 255, 0.72)',
    shadowColor: '#1479ff',
    shadowOpacity: 0.3,
    shadowRadius: 18,
  },
  statusRow: {
    minHeight: 70,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112, 165, 255, 0.22)',
  },
  modelLabel: { ...typography.label, color: '#0B1220' },
  rendererStatus: {
    ...typography.caption,
    color: '#66a3ff',
    marginTop: 3,
    fontWeight: '700',
  },
  help: { ...typography.caption, color: '#52657A', marginTop: 4 },
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
  toolRow: {
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: '#F8FBFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,165,255,0.16)',
  },
  toolButton: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(112,165,255,0.3)',
    backgroundColor: 'rgba(23,105,224,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  toolButtonActive: {
    borderColor: '#2289ff',
    backgroundColor: '#1769e0',
  },
  toolButtonText: { ...typography.caption, color: '#0B1220', fontWeight: '800' },
  viewPresets: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    backgroundColor: '#F8FBFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,165,255,0.16)',
  },
  viewButton: {
    minWidth: 72,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(112,165,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23,105,224,0.18)',
  },
  viewButtonText: { ...typography.caption, color: '#0B1220', fontWeight: '700' },
  canvas: { flex: 1, minHeight: 520 },
});
