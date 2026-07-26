import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { Link, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClinicalBodyModel } from '@/components/pflege/bodyMap3d/ClinicalBodyModel';
import {
  BODY_MAP_VISUAL_QA_CASES,
  getBodyMapVisualQaCase,
} from '@/lib/pflege/bodyMap3d/visualQaCatalog';
import {
  canPreviewMedicalMesh,
  getMedicalMeshDefinition,
  medicalMeshRendererLabel,
} from '@/lib/pflege/bodyMap3d/medicalMeshCatalog';
import { getBodyMapModel } from '@/lib/pflege/bodyMap3d/modelCatalog';
import type { BodyMap3DMarker } from '@/types/modules/bodyMap';

const VIEWS = [
  { id: 'front', label: 'Vorderseite', rotationY: 0 },
  { id: 'back', label: 'Rückseite', rotationY: Math.PI },
  { id: 'left', label: 'Linke Seite', rotationY: -Math.PI / 2 },
  { id: 'right', label: 'Rechte Seite', rotationY: Math.PI / 2 },
] as const;

function WorkbenchModelView({
  label,
  rotationY,
  qaCase,
  technicalMeshActive,
}: {
  label: string;
  rotationY: number;
  qaCase: ReturnType<typeof getBodyMapVisualQaCase>;
  technicalMeshActive: boolean;
}) {
  const model = getBodyMapModel(qaCase.selection);
  const cameraFov = 32;
  const cameraDistance =
    model.nominalHeightMeters /
    (2 * Math.tan((cameraFov * Math.PI) / 360) * 0.84);
  const qaMarker: BodyMap3DMarker = {
    id: `qa-marker-${qaCase.id}-${label}`,
    tenantId: 'visual-qa',
    clientId: 'visual-qa',
    woundId: null,
    gender: qaCase.selection.sex === 'divers' ? 'neutral' : qaCase.selection.sex,
    view: 'vorderseite',
    region: 'rumpf',
    markerType: 'wunde',
    xPercent: 50,
    yPercent: 50,
    note: 'Pulsierender gelber Phase-9-Befundpunkt',
    modelId: model.id,
    anatomyPackId: null,
    ageGroup: qaCase.selection.ageGroup,
    sex: qaCase.selection.sex,
    genitalAnatomy: qaCase.selection.genitalAnatomy,
    chestAnatomy: qaCase.selection.chestAnatomy,
    skinTone: qaCase.selection.skinTone,
    anatomicalZoneId: 'brustbein',
    surfacePoint: {
      localPosition: { x: 0, y: model.nominalHeightMeters * 0.62, z: 0.12 },
      worldPosition: { x: 0, y: 0.2, z: 0.12 },
      modelPosition: { x: 0, y: model.nominalHeightMeters * 0.62, z: 0.12 },
      normal: { x: 0, y: 0, z: 1 },
      modelNormal: { x: 0, y: 0, z: 1 },
      uv: { u: 0.5, v: 0.5 },
      meshName: 'zone__brustbein',
      primitiveIndex: null,
      triangleIndex: null,
    },
    pressureClassification: null,
    findingStatus: 'aktiv',
    findingDetails: { visualQa: true },
    createdAt: '2026-07-26T00:00:00.000Z',
    updatedAt: '2026-07-26T00:00:00.000Z',
  };
  return (
    <View style={styles.modelCard}>
      <Text style={styles.modelCardTitle}>{label}</Text>
      <View style={styles.canvas}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{
            position: [0, 0, cameraDistance],
            fov: cameraFov,
            near: 0.01,
            far: 50,
          }}
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        >
          <color attach="background" args={['#071326']} />
          <ambientLight intensity={1.5} />
          <hemisphereLight args={['#dcecff', '#13233f', 1.4]} />
          <directionalLight position={[3, 5, 4]} intensity={2.1} />
          <directionalLight position={[-3, 2, -4]} intensity={0.85} color="#70a5ff" />
          <ClinicalBodyModel
            selection={qaCase.selection}
            markers={[qaMarker]}
            selectedMarkerId={qaMarker.id}
            disabled
            allowTechnicalMeshPreview
            rotation={[0, rotationY, 0]}
            onSurfacePress={() => undefined}
          />
          <ContactShadows
            position={[0, technicalMeshActive ? -model.nominalHeightMeters / 2 : -1.31, 0]}
            opacity={0.35}
            scale={4}
            blur={2.5}
            far={3}
          />
        </Canvas>
      </View>
    </View>
  );
}

function CheckRow({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean;
  detail: string;
}) {
  return (
    <View style={styles.checkRow}>
      <Text style={[styles.checkIcon, passed ? styles.checkPassed : styles.checkPending]}>
        {passed ? '✓' : '○'}
      </Text>
      <View style={styles.checkText}>
        <Text style={styles.checkLabel}>{label}</Text>
        <Text style={styles.checkDetail}>{detail}</Text>
      </View>
    </View>
  );
}

export function BodyMapMeshWorkbenchScreen() {
  const { variant } = useLocalSearchParams<{ variant?: string }>();
  const qaCase = getBodyMapVisualQaCase(variant);
  const definition = getMedicalMeshDefinition(qaCase.selection);
  const active = canPreviewMedicalMesh(definition);
  const released = definition.reviewStatus === 'released';

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      testID="bodymap-mesh-workbench-ready"
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CARESUITE · BODYMAP MESH WORKBENCH</Text>
          <Text style={styles.title}>{qaCase.label}</Text>
          <Text style={styles.subtitle}>{qaCase.subtitle}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            released ? styles.statusActive : styles.statusPending,
          ]}
        >
          <Text style={styles.statusBadgeText}>
            {active ? definition.reviewStatus : 'FALLBACK'}
          </Text>
        </View>
      </View>

      <View style={styles.workspace}>
        <View style={styles.sidebar}>
          <Text style={styles.panelTitle}>30 Modellvarianten</Text>
          <Text style={styles.panelHint}>
            Jede Variante bleibt getrennt versioniert und medizinisch freigabepflichtig.
          </Text>
          <View style={styles.variantList}>
            {BODY_MAP_VISUAL_QA_CASES.map((entry, index) => (
              <Link
                key={entry.id}
                href={`/bodymap-mesh-workbench?variant=${entry.id}`}
                style={[
                  styles.variantLink,
                  entry.id === qaCase.id && styles.variantLinkActive,
                ]}
              >
                {String(index + 1).padStart(2, '0')} · {entry.label}
              </Link>
            ))}
          </View>

          <View style={styles.contractPanel}>
            <Text style={styles.panelTitle}>Aktiver Renderer</Text>
            <Text style={styles.rendererLabel}>
              {medicalMeshRendererLabel(definition, { allowTechnicalPreview: true })}
            </Text>
            <Text style={styles.meta}>Variant-ID: {definition.id}</Text>
            <Text style={styles.meta}>Version: {definition.version}</Text>
            <Text style={styles.meta}>
              Asset: {definition.assetPath ?? 'noch nicht registriert'}
            </Text>
            <Text style={styles.meta}>
              Entwicklung: {definition.selfDeveloped ? 'CareSuite selbst entwickelt' : 'ausstehend'}
            </Text>
            <Text style={styles.meta}>
              Medizinische Sperre: {definition.medicalReleaseBlocked ? 'aktiv' : 'nicht gesetzt'}
            </Text>
          </View>

          <View style={styles.contractPanel}>
            <Text style={styles.panelTitle}>Freigabegates</Text>
            <CheckRow
              label="GLB registriert"
              passed={Boolean(definition.assetPath)}
              detail="Binärdatei und Qualitätsbericht vorhanden"
            />
            <CheckRow
              label="Technisch geprüft"
              passed={active}
              detail="Zonen, UV, Normalen, Maße und Budgets bestanden"
            />
            <CheckRow
              label="Medizinisch geprüft"
              passed={released}
              detail="Anatomie und sensible Bereiche fachlich freigegeben"
            />
            <CheckRow
              label="Produktionsfreigabe"
              passed={released}
              detail="30er-Vergleich und klinische Abnahme dokumentiert"
            />
          </View>
        </View>

        <View style={styles.main}>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>
              {active
                ? released
                  ? 'Medizinisch freigegebenes GLB-Mesh wird gerendert'
                  : 'Technisches Referenzmesh wird mit sichtbarer Freigabekennzeichnung gerendert'
                : 'Parametrischer Sicherheitsfallback wird gerendert'}
            </Text>
            <Text style={styles.noticeText}>
              {active && !released
                ? 'Dieses Modell ist nicht medizinisch freigegeben. Es darf technisch verwendet werden, wird aber in der Patienten-Bodymap dauerhaft eindeutig als technische Referenz gekennzeichnet.'
                : 'Ein fehlendes oder fehlerhaftes GLB darf die produktive Bodymap niemals unbedienbar machen.'}
            </Text>
          </View>
          <View style={styles.grid}>
            {VIEWS.map((view) => (
              <WorkbenchModelView
                key={view.id}
                label={view.label}
                rotationY={view.rotationY}
                qaCase={qaCase}
                technicalMeshActive={active}
              />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#04101f' },
  pageContent: { minHeight: 1200, padding: 24 },
  header: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,165,255,0.28)',
    paddingBottom: 18,
    marginBottom: 18,
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#66a3ff', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#f5f9ff', fontSize: 28, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#a9b9d2', fontSize: 14, marginTop: 4 },
  statusBadge: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusActive: { borderColor: '#3bd671', backgroundColor: 'rgba(59,214,113,0.13)' },
  statusPending: { borderColor: '#f6ae2d', backgroundColor: 'rgba(246,174,45,0.13)' },
  statusBadgeText: { color: '#f5f9ff', fontSize: 12, fontWeight: '900' },
  workspace: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  sidebar: { width: 330, gap: 14 },
  main: { flex: 1, minWidth: 0 },
  panelTitle: { color: '#e9f2ff', fontSize: 14, fontWeight: '900' },
  panelHint: { color: '#8297b6', fontSize: 12, lineHeight: 18 },
  variantList: {
    borderWidth: 1,
    borderColor: 'rgba(112,165,255,0.2)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  variantLink: {
    color: '#9fb1ca',
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#08172b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,165,255,0.1)',
  },
  variantLinkActive: { color: '#fff', backgroundColor: 'rgba(23,105,224,0.38)' },
  contractPanel: {
    borderWidth: 1,
    borderColor: 'rgba(112,165,255,0.2)',
    borderRadius: 16,
    backgroundColor: '#08172b',
    padding: 14,
    gap: 8,
  },
  rendererLabel: { color: '#66a3ff', fontSize: 12, fontWeight: '800' },
  meta: { color: '#91a5c1', fontSize: 11 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 4 },
  checkIcon: { fontSize: 18, lineHeight: 20, fontWeight: '900' },
  checkPassed: { color: '#3bd671' },
  checkPending: { color: '#f6ae2d' },
  checkText: { flex: 1 },
  checkLabel: { color: '#e9f2ff', fontSize: 12, fontWeight: '800' },
  checkDetail: { color: '#7f94b3', fontSize: 10, lineHeight: 15, marginTop: 2 },
  notice: {
    borderWidth: 1,
    borderColor: 'rgba(102,163,255,0.25)',
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(23,105,224,0.1)',
    marginBottom: 14,
  },
  noticeTitle: { color: '#e9f2ff', fontSize: 13, fontWeight: '900' },
  noticeText: { color: '#91a5c1', fontSize: 11, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  modelCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 360,
    height: 480,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(112,165,255,0.22)',
    backgroundColor: '#071326',
  },
  modelCardTitle: {
    height: 40,
    paddingHorizontal: 14,
    paddingTop: 12,
    color: '#dce9fb',
    backgroundColor: '#0a1a31',
    fontSize: 12,
    fontWeight: '900',
  },
  canvas: { flex: 1 },
});
