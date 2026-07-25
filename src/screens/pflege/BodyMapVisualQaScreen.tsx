import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ParametricBodyModel } from '@/components/pflege/bodyMap3d/ParametricBodyModel';
import {
  BODY_MAP_VISUAL_QA_CASES,
  getBodyMapVisualQaCase,
} from '@/lib/pflege/bodyMap3d/visualQaCatalog';
import { getBodyMapModel } from '@/lib/pflege/bodyMap3d/modelCatalog';

const ANGLES = [
  { id: 'front', label: 'Vorderseite', rotationY: 0 },
  { id: 'back', label: 'Rückseite', rotationY: Math.PI },
  { id: 'left', label: 'Linke Seite', rotationY: -Math.PI / 2 },
  { id: 'right', label: 'Rechte Seite', rotationY: Math.PI / 2 },
] as const;

function ClinicalModelView({
  label,
  rotationY,
  qaCase,
}: {
  label: string;
  rotationY: number;
  qaCase: ReturnType<typeof getBodyMapVisualQaCase>;
}) {
  const model = getBodyMapModel(qaCase.selection);
  const qaCameraDistance =
    qaCase.selection.ageGroup === 'baby'
      ? 4.4
      : qaCase.selection.ageGroup === 'kleinkind'
        ? 4.5
        : qaCase.selection.ageGroup === 'kind'
          ? 4.7
          : 5;
  return (
    <View style={styles.viewCard}>
      <Text style={styles.viewLabel}>{label}</Text>
      <View style={styles.canvas}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{
            position: [0, 0.05, Math.max(model.cameraDistance, qaCameraDistance)],
            fov: 34,
            near: 0.01,
            far: 50,
          }}
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        >
          <color attach="background" args={['#071326']} />
          <ambientLight intensity={1.55} />
          <hemisphereLight args={['#dcecff', '#13233f', 1.4]} />
          <directionalLight position={[3, 5, 4]} intensity={2.15} />
          <directionalLight position={[-3, 2, -4]} intensity={0.9} color="#70a5ff" />
          <ParametricBodyModel
            selection={qaCase.selection}
            markers={[]}
            disabled
            rotation={[0, rotationY, 0]}
            onSurfacePress={() => undefined}
          />
          <ContactShadows
            position={[0, -1.31, 0]}
            opacity={0.36}
            scale={4}
            blur={2.6}
            far={3}
          />
        </Canvas>
      </View>
    </View>
  );
}

export function BodyMapVisualQaScreen() {
  const { variant } = useLocalSearchParams<{ variant?: string }>();
  const qaCase = getBodyMapVisualQaCase(variant);
  const caseIndex = BODY_MAP_VISUAL_QA_CASES.findIndex((entry) => entry.id === qaCase.id);

  return (
    <View
      style={styles.page}
      testID="bodymap-visual-qa-ready"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>CARESUITE · 3D-BODYMAP · VISUELLE QA</Text>
          <Text style={styles.title}>{qaCase.label}</Text>
          <Text style={styles.subtitle}>{qaCase.subtitle}</Text>
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterNumber}>{String(caseIndex + 1).padStart(2, '0')}</Text>
          <Text style={styles.counterTotal}>/ 18</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {ANGLES.map((angle) => (
          <ClinicalModelView
            key={angle.id}
            label={angle.label}
            rotationY={angle.rotationY}
            qaCase={qaCase}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerStrong}>Tatsächlich implementiertes WebGL-Modell</Text>
        <Text style={styles.footerText}>
          Parametrischer technischer Prototyp · Hautton Mittel · keine KI-Visualisierung
        </Text>
        <Text style={styles.caseId}>{qaCase.id}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    minHeight: 1400,
    backgroundColor: '#04101f',
    paddingHorizontal: 28,
    paddingVertical: 22,
  },
  header: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,165,255,0.28)',
    paddingBottom: 16,
    marginBottom: 18,
  },
  eyebrow: {
    color: '#66a3ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: '#f5f9ff',
    fontSize: 27,
    fontWeight: '800',
    marginTop: 5,
  },
  subtitle: {
    color: '#a9b9d2',
    fontSize: 14,
    marginTop: 4,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderWidth: 1,
    borderColor: 'rgba(112,165,255,0.34)',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(23,105,224,0.14)',
  },
  counterNumber: { color: '#ffffff', fontSize: 27, fontWeight: '900' },
  counterTotal: { color: '#8fa6c8', fontSize: 15, marginLeft: 5 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  viewCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 420,
    height: 520,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(112,165,255,0.24)',
    backgroundColor: '#071326',
  },
  viewLabel: {
    height: 42,
    color: '#dce9fb',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 15,
    paddingTop: 13,
    backgroundColor: '#0a1a31',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,165,255,0.18)',
  },
  canvas: { flex: 1 },
  footer: {
    minHeight: 58,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(112,165,255,0.2)',
    paddingTop: 14,
  },
  footerStrong: { color: '#dce9fb', fontSize: 12, fontWeight: '800' },
  footerText: { color: '#7f94b3', fontSize: 12, flex: 1 },
  caseId: {
    color: '#66a3ff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});
