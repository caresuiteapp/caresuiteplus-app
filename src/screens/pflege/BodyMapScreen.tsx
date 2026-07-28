import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenShell } from '@/components/layout';
import { BodyMap3DViewer, type BodyMapSurfaceHit } from '@/components/pflege/bodyMap3d';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumInput,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useClientDetail } from '@/hooks/useClientDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  createBodyMapMarker,
  fetchBodyMapMarkers,
  patchBodyMapMarker,
  removeBodyMapMarker,
} from '@/lib/pflege/bodyMapService';
import {
  addBodyMapFindingProgress,
  createPressureInjuryAssessment,
  fetchBodyMapClinicalRecord,
  uploadBodyMapClinicalPhoto,
} from '@/lib/pflege/bodyMapClinicalService';
import {
  getBodyMapAnatomyPack,
  getBodyMapModel,
} from '@/lib/pflege/bodyMap3d/modelCatalog';
import {
  ANATOMICAL_ZONE_BY_ID,
  getAnatomicalPath,
} from '@/lib/pflege/bodyMap3d/anatomicalZones';
import {
  BODY_MAP_FINDING_DEFINITIONS,
  buildClinicalLocationSnapshot,
  recommendedFindingDefinitions,
  resolveAnatomicalCandidates,
} from '@/lib/pflege/bodyMap3d/clinicalInteractionCatalog';
import { PRESSURE_INJURY_CLASSIFICATIONS } from '@/lib/pflege/bodyMap3d/pressureInjuryCatalog';
import type {
  BodyMap3DMarker,
  BodyMapFindingStatus,
  BodyMapMarker,
  BodyMapMarkerType,
  BodyMapModelSelection,
  BodyMapRegion,
  BodyMapSex,
} from '@/types/modules/bodyMap';
import { colors, spacing, typography } from '@/theme';
import {
  liquidColors,
  liquidRadius,
  liquidShadows,
  liquidSpace,
  liquidTypography,
} from '@/liquid-command/foundation/tokens';

const CLINICAL_BODYMAP_SELECTION: BodyMapModelSelection = {
  sex: 'divers',
  ageGroup: 'erwachsener',
  genitalAnatomy: 'unbekannt',
  chestAnatomy: 'keine_brueste',
  skinTone: 'mittel',
};

const MARKER_TYPES = BODY_MAP_FINDING_DEFINITIONS;

const FINDING_STATUSES: readonly { id: BodyMapFindingStatus; label: string }[] = [
  { id: 'verdacht', label: 'Verdacht' },
  { id: 'aktiv', label: 'Aktiv' },
  { id: 'in_behandlung', label: 'In Behandlung' },
  { id: 'heilend', label: 'Heilend' },
  { id: 'abgeheilt', label: 'Abgeheilt' },
  { id: 'geschlossen', label: 'Geschlossen' },
  { id: 'wiedereroeffnet', label: 'Wiedereröffnet' },
];

const WOUND_EDGE_OPTIONS = [
  ['unauffaellig', 'Unauffällig'],
  ['mazeriert', 'Mazeriert'],
  ['unterminiert', 'Unterhöhlt'],
  ['gerollt', 'Eingerollt'],
  ['hyperkeratotisch', 'Hyperkeratotisch'],
] as const;

const SURROUNDING_SKIN_OPTIONS = [
  ['roetung', 'Rötung'],
  ['ueberwaermung', 'Überwärmung'],
  ['oedem', 'Ödem'],
  ['mazeration', 'Mazeration'],
  ['trocken', 'Trocken'],
  ['fragil', 'Fragil'],
] as const;

const INFECTION_SIGN_OPTIONS = [
  ['zunehmende_roetung', 'Zunehmende Rötung'],
  ['ueberwaermung', 'Überwärmung'],
  ['schwellung', 'Schwellung'],
  ['eitriges_exsudat', 'Eitriges Exsudat'],
  ['auffaelliger_geruch', 'Auffälliger Geruch'],
  ['zunehmender_schmerz', 'Zunehmender Schmerz'],
  ['fieber', 'Fieber'],
] as const;

type PickedClinicalPhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
};

function optionalPositiveNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isValidOptionalPositiveNumber(value: string): boolean {
  return !value.trim() || optionalPositiveNumber(value) != null;
}

function isValidClockPosition(value: string): boolean {
  if (!value.trim()) return true;
  const parsed = optionalPositiveNumber(value);
  return parsed != null && Number.isInteger(parsed) && parsed >= 1 && parsed <= 12;
}

function isValidIsoDate(value: string): boolean {
  if (!value.trim()) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function labelsForFlags(
  flags: Record<string, boolean | string>,
  options: readonly (readonly [string, string])[],
): string {
  return Object.entries(flags)
    .filter(([, enabled]) => enabled === true)
    .map(([id]) => options.find(([optionId]) => optionId === id)?.[1] ?? id)
    .join(', ');
}

function historyEventLabel(eventType: string): string {
  return (
    {
      created: 'Befund angelegt',
      updated: 'Befund aktualisiert',
      classified: 'Klassifikation geändert',
      treatment: 'Behandlung dokumentiert',
      photo: 'Foto hinzugefügt',
      healing: 'Heilungsverlauf',
      closed: 'Befund geschlossen',
      reopened: 'Befund wiedereröffnet',
    }[eventType] ?? eventType
  );
}

async function readPickedPhoto(uri: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(uri);
    if (!response.ok && response.status !== 0) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function legacyGender(sex: BodyMapSex): 'weiblich' | 'maennlich' | 'neutral' {
  if (sex === 'divers') return 'neutral';
  return sex;
}

function legacyRegion(zoneId: string): BodyMapRegion {
  if (/kopf|gesicht|auge|ohr|mund|nase|stirn|kinn/.test(zoneId)) return 'kopf';
  if (/arm|hand|finger|ellenbogen|schulter/.test(zoneId)) {
    return zoneId.endsWith('-links') ? 'arm_links' : 'arm_rechts';
  }
  if (/bein|huefte|trochanter|knie|unterschenkel|oberschenkel|knoechel/.test(zoneId)) {
    return zoneId.endsWith('-links') ? 'bein_links' : 'bein_rechts';
  }
  if (/fuss|ferse|zehe|achilles/.test(zoneId)) return 'fuesse';
  if (/kreuzbein|steissbein|sitzbein|gesaess/.test(zoneId)) return 'sakral';
  if (/genital|penis|vulva|vaginal|anus|skrotum|labium|harnroehre/.test(zoneId)) {
    return 'intim_klinisch';
  }
  return 'rumpf';
}

function markerCoordinates(hit: BodyMapSurfaceHit): { xPercent: number; yPercent: number } {
  const uv = hit.surfacePoint.uv;
  if (uv) {
    return {
      xPercent: Math.min(100, Math.max(0, uv.u * 100)),
      yPercent: Math.min(100, Math.max(0, (1 - uv.v) * 100)),
    };
  }
  return { xPercent: 50, yPercent: 50 };
}

function isPersisted3DMarker(marker: BodyMapMarker): marker is BodyMap3DMarker {
  return Boolean(
    marker.modelId &&
      marker.ageGroup &&
      marker.sex &&
      marker.skinTone &&
      marker.anatomicalZoneId &&
      marker.surfacePoint,
  );
}

function SelectionChip({
  active,
  label,
  color,
  onPress,
}: {
  active: boolean;
  label: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.choiceChip, active && styles.choiceChipActive]}
      onPress={onPress}
    >
      {color ? <View style={[styles.skinSwatch, { backgroundColor: color }]} /> : null}
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PulsingFindingDot({ selected = false }: { selected?: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: selected ? 620 : 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: selected ? 620 : 900,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, selected]);

  return (
    <View style={styles.findingPulseOuter}>
      <Animated.View
        style={[
          styles.findingPulseHalo,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.78] }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.72, selected ? 1.34 : 1.18],
                }),
              },
            ],
          },
        ]}
      />
      <View style={[styles.findingPulseCore, selected && styles.findingPulseCoreSelected]} />
    </View>
  );
}

type BodyMapWorkspacePanel = 'model' | 'findings' | 'clinical';

function WorkspaceTool({
  icon,
  label,
  active,
  count,
  onPress,
}: {
  icon: string;
  label: string;
  active: boolean;
  count?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.workspaceTool,
        active && styles.workspaceToolActive,
        pressed && styles.workspaceToolPressed,
      ]}
    >
      <Ionicons
        color={active ? liquidColors.white : liquidColors.blue200}
        name={icon as never}
        size={21}
      />
      <Text style={[styles.workspaceToolLabel, active && styles.workspaceToolLabelActive]}>
        {label}
      </Text>
      {typeof count === 'number' ? (
        <View style={styles.workspaceToolBadge}>
          <Text style={styles.workspaceToolBadgeText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function BodyMapMetric({
  icon,
  label,
  value,
  tone = 'blue',
}: {
  icon: string;
  label: string;
  value: string;
  tone?: 'blue' | 'yellow' | 'green';
}) {
  return (
    <View style={styles.metricCard}>
      <View
        style={[
          styles.metricIcon,
          tone === 'yellow' && styles.metricIconYellow,
          tone === 'green' && styles.metricIconGreen,
        ]}
      >
        <Ionicons name={icon as never} size={18} color={liquidColors.white} />
      </View>
      <View>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </View>
  );
}

export function BodyMapScreen({
  careContext = 'pflege',
}: {
  careContext?: 'pflege' | 'stationaer';
} = {}) {
  const router = useRouter();
  const viewport = useWindowDimensions();
  const { clientId: clientIdParam, id, woundId } = useLocalSearchParams<{
    clientId?: string;
    id?: string;
    woundId?: string;
  }>();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const clientId = clientIdParam ?? id ?? 'client-001';
  const clientDetail = useClientDetail(clientId);
  const isStationaerContext = careContext === 'stationaer';
  const subjectType = isStationaerContext ? 'resident' : 'client';
  const subjectLabel = isStationaerContext ? 'Bewohner:in' : 'Klient:in';
  const screenTitle = isStationaerContext
    ? 'Stationäre medizinische 3D-Bodymap'
    : 'Medizinische 3D-Bodymap';

  const selection = CLINICAL_BODYMAP_SELECTION;
  const [pendingHit, setPendingHit] = useState<BodyMapSurfaceHit | null>(null);
  const [selectedAnatomicalZoneId, setSelectedAnatomicalZoneId] = useState<string | null>(
    null,
  );
  const [markerType, setMarkerType] = useState<BodyMapMarkerType>('wunde');
  const [pressureClassification, setPressureClassification] = useState('kategorie_1');
  const [note, setNote] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [depthCm, setDepthCm] = useState('');
  const [painScore, setPainScore] = useState('');
  const [exudateAmount, setExudateAmount] = useState<'kein' | 'gering' | 'mittel' | 'stark'>('kein');
  const [pressureReliefPlan, setPressureReliefPlan] = useState('');
  const [granulationPercent, setGranulationPercent] = useState('');
  const [fibrinPercent, setFibrinPercent] = useState('');
  const [necrosisPercent, setNecrosisPercent] = useState('');
  const [exudateCharacter, setExudateCharacter] =
    useState<'seroes' | 'blutig' | 'seroes_blutig' | 'eitrig'>('seroes');
  const [odor, setOdor] = useState<'kein' | 'auffaellig'>('kein');
  const [woundEdge, setWoundEdge] = useState('unauffaellig');
  const [surroundingSkinFlags, setSurroundingSkinFlags] = useState<string[]>([]);
  const [infectionSignFlags, setInfectionSignFlags] = useState<string[]>([]);
  const [underminingFrom, setUnderminingFrom] = useState('');
  const [underminingTo, setUnderminingTo] = useState('');
  const [underminingDepth, setUnderminingDepth] = useState('');
  const [tunnelingPresent, setTunnelingPresent] = useState(false);
  const [medicalDevice, setMedicalDevice] = useState('');
  const [presentOnAdmission, setPresentOnAdmission] = useState<boolean | null>(null);
  const [nextReviewDate, setNextReviewDate] = useState('');
  const [pickedPhoto, setPickedPhoto] = useState<PickedClinicalPhoto | null>(null);
  const [measurementReferencePresent, setMeasurementReferencePresent] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [detailMarkerId, setDetailMarkerId] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<BodyMapFindingStatus>('in_behandlung');
  const [progressNote, setProgressNote] = useState('');
  const [detailNote, setDetailNote] = useState('');
  const [progressPhoto, setProgressPhoto] = useState<PickedClinicalPhoto | null>(null);
  const [progressSaving, setProgressSaving] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [workspacePanel, setWorkspacePanel] = useState<BodyMapWorkspacePanel>('model');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchBodyMapMarkers(tenantId, clientId, profile?.roleKey, subjectType);
    },
    [tenantId, clientId, profile?.roleKey, subjectType],
    { enabled: !!tenantId },
  );

  const clinicalQuery = useAsyncQuery(
    () => {
      if (!tenantId || !detailMarkerId) {
        return Promise.resolve({ ok: false as const, error: 'Befund fehlt.' });
      }
      return fetchBodyMapClinicalRecord(
        tenantId,
        clientId,
        detailMarkerId,
        subjectType,
      );
    },
    [tenantId, clientId, detailMarkerId, subjectType],
    { enabled: !!tenantId && !!detailMarkerId },
  );

  const effectiveZoneId = selectedAnatomicalZoneId ?? pendingHit?.anatomicalZoneId ?? null;
  const selectedZone = effectiveZoneId
    ? ANATOMICAL_ZONE_BY_ID.get(effectiveZoneId) ?? null
    : null;
  const selectedZonePath = effectiveZoneId
    ? getAnatomicalPath(effectiveZoneId).map((entry) => entry.label).join(' › ')
    : '';
  const anatomicalCandidates = useMemo(
    () =>
      pendingHit && selection
        ? resolveAnatomicalCandidates(pendingHit.anatomicalZoneId, selection)
        : [],
    [pendingHit, selection],
  );
  const findingDefinitions = useMemo(
    () => (effectiveZoneId ? recommendedFindingDefinitions(effectiveZoneId) : MARKER_TYPES),
    [effectiveZoneId],
  );
  const isPressureFinding =
    markerType === 'dekubitus' ||
    markerType === 'druckverletzung_medizinprodukt' ||
    markerType === 'tiefe_gewebeschaedigung';
  const persisted3DMarkers = useMemo(
    () => (query.data ?? []).filter(isPersisted3DMarker),
    [query.data],
  );
  const detailMarker = useMemo(
    () => (query.data ?? []).find((marker) => marker.id === detailMarkerId) ?? null,
    [detailMarkerId, query.data],
  );
  const compactWorkspace = viewport.width < 1180;
  const phoneWorkspace = viewport.width < 720;

  function handleSurfacePress(hit: BodyMapSurfaceHit) {
    setPendingHit(hit);
    setSelectedAnatomicalZoneId(hit.anatomicalZoneId);
    const firstRecommendation = recommendedFindingDefinitions(hit.anatomicalZoneId)[0];
    if (firstRecommendation) setMarkerType(firstRecommendation.id);
    setWorkspacePanel('clinical');
    setActionError(null);
  }

  function selectMarkerType(nextType: BodyMapMarkerType) {
    setMarkerType(nextType);
    if (nextType === 'druckverletzung_medizinprodukt') {
      setPressureClassification('medizinproduktbezogen');
    } else if (nextType === 'tiefe_gewebeschaedigung') {
      setPressureClassification('tiefe_gewebeschaedigung');
    } else if (
      nextType === 'dekubitus' &&
      ['medizinproduktbezogen', 'tiefe_gewebeschaedigung'].includes(
        pressureClassification,
      )
    ) {
      setPressureClassification('kategorie_1');
    }
  }

  function selectPressureClassification(nextClassification: string) {
    setPressureClassification(nextClassification);
    if (nextClassification === 'medizinproduktbezogen') {
      setMarkerType('druckverletzung_medizinprodukt');
    } else if (nextClassification === 'tiefe_gewebeschaedigung') {
      setMarkerType('tiefe_gewebeschaedigung');
    }
  }

  function closeFindingDraft() {
    setPendingHit(null);
    setSelectedAnatomicalZoneId(null);
    resetFindingDraft();
  }

  async function handlePickPhoto() {
    setActionError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPickedPhoto({
      uri: asset.uri,
      fileName: asset.name ?? `bodymap-foto-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: asset.size ?? null,
    });
  }

  async function handlePickProgressPhoto() {
    setActionError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setProgressPhoto({
      uri: asset.uri,
      fileName: asset.name ?? `bodymap-verlauf-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: asset.size ?? null,
    });
  }

  function openMarkerDetail(markerId: string) {
    const marker = (query.data ?? []).find((entry) => entry.id === markerId);
    setSelectedMarkerId(markerId);
    setDetailMarkerId(markerId);
    setWorkspacePanel('clinical');
    setProgressStatus(
      (marker?.findingStatus as BodyMapFindingStatus | null | undefined) ?? 'in_behandlung',
    );
    setDetailNote(marker?.note ?? '');
    setProgressNote('');
    setProgressPhoto(null);
  }

  async function handleUpdateFinding() {
    if (!tenantId || !detailMarker || isReadOnly) return;
    setDetailSaving(true);
    setActionError(null);
    const result = await patchBodyMapMarker(
      tenantId,
      clientId,
      detailMarker.id,
      { note: detailNote.trim() },
      profile?.roleKey,
      subjectType,
    );
    setDetailSaving(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    await query.refresh();
  }

  function handleDeleteFinding() {
    if (!tenantId || !detailMarker || isReadOnly) return;
    Alert.alert(
      'Befund wirklich löschen?',
      'Der Befundpunkt wird aus der BodyMap entfernt. Zugeordnete klinische Verlaufsdaten bleiben entsprechend der Aufbewahrungsregeln nachvollziehbar.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Befund löschen',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDetailSaving(true);
              setActionError(null);
              const result = await removeBodyMapMarker(
                tenantId,
                clientId,
                detailMarker.id,
                profile?.roleKey,
                subjectType,
              );
              setDetailSaving(false);
              if (!result.ok) {
                setActionError(result.error);
                return;
              }
              setDetailMarkerId(null);
              setSelectedMarkerId(null);
              await query.refresh();
            })();
          },
        },
      ],
    );
  }

  async function handleSaveProgress() {
    if (!tenantId || !detailMarker || isReadOnly) return;
    setProgressSaving(true);
    setActionError(null);
    const result = await addBodyMapFindingProgress({
      tenantId,
      clientId,
      markerId: detailMarker.id,
      status: progressStatus,
      note: progressNote,
      createdBy: profile?.id ?? null,
      subjectType,
    });
    const errors: string[] = [];
    if (!result.ok) {
      errors.push(result.error);
    } else if (progressPhoto) {
      const bytes = await readPickedPhoto(progressPhoto.uri);
      if (!bytes) {
        errors.push('Das Verlaufsfoto konnte nicht gelesen werden.');
      } else {
        const photoResult = await uploadBodyMapClinicalPhoto({
          tenantId,
          clientId,
          markerId: detailMarker.id,
          fileName: progressPhoto.fileName,
          mimeType: progressPhoto.mimeType,
          bytes,
          capturePhase:
            progressStatus === 'geschlossen' || progressStatus === 'abgeheilt'
              ? 'closure'
              : progressStatus === 'wiedereroeffnet'
                ? 'reopening'
                : 'progress',
          note: progressNote,
          createdBy: profile?.id ?? null,
          subjectType,
        });
        if (!photoResult.ok) errors.push(photoResult.error);
      }
    }
    setProgressSaving(false);
    if (errors.length > 0) {
      setActionError(errors.join(' '));
      return;
    }
    setProgressNote('');
    setProgressPhoto(null);
    await Promise.all([query.refresh(), clinicalQuery.refresh()]);
  }

  function resetFindingDraft() {
    setNote('');
    setDiagnosis('');
    setTreatment('');
    setLengthCm('');
    setWidthCm('');
    setDepthCm('');
    setPainScore('');
    setExudateAmount('kein');
    setPressureReliefPlan('');
    setGranulationPercent('');
    setFibrinPercent('');
    setNecrosisPercent('');
    setExudateCharacter('seroes');
    setOdor('kein');
    setWoundEdge('unauffaellig');
    setSurroundingSkinFlags([]);
    setInfectionSignFlags([]);
    setUnderminingFrom('');
    setUnderminingTo('');
    setUnderminingDepth('');
    setTunnelingPresent(false);
    setMedicalDevice('');
    setPresentOnAdmission(null);
    setNextReviewDate('');
    setPickedPhoto(null);
    setMeasurementReferencePresent(false);
  }

  async function handleSaveFinding() {
    if (!tenantId || !selection || !pendingHit || !effectiveZoneId || isReadOnly) return;
    const numericFields = [
      ['Länge', lengthCm],
      ['Breite', widthCm],
      ['Tiefe', depthCm],
      ['Schmerz', painScore],
      ['Granulation', granulationPercent],
      ['Fibrin', fibrinPercent],
      ['Nekrose', necrosisPercent],
      ['maximale Unterminierungstiefe', underminingDepth],
    ] as const;
    const invalidNumericField = numericFields.find(
      ([, value]) => !isValidOptionalPositiveNumber(value),
    );
    if (isPressureFinding && invalidNumericField) {
      setActionError(`${invalidNumericField[0]} muss eine Zahl größer oder gleich 0 sein.`);
      return;
    }
    const parsedPainScore = optionalPositiveNumber(painScore);
    if (isPressureFinding && parsedPainScore != null && parsedPainScore > 10) {
      setActionError('Der Schmerzwert muss zwischen 0 und 10 liegen.');
      return;
    }
    if (
      isPressureFinding &&
      (!isValidClockPosition(underminingFrom) || !isValidClockPosition(underminingTo))
    ) {
      setActionError(
        'Die Uhrposition der Unterminierung muss als ganze Zahl von 1 bis 12 angegeben werden.',
      );
      return;
    }
    if (isPressureFinding && !isValidIsoDate(nextReviewDate)) {
      setActionError('Die nächste Kontrolle muss ein gültiges Datum im Format JJJJ-MM-TT sein.');
      return;
    }
    if (isPressureFinding && !nextReviewDate.trim()) {
      setActionError('Für eine Druckverletzung muss die nächste Kontrolle geplant werden.');
      return;
    }
    if (isPressureFinding && !pressureReliefPlan.trim()) {
      setActionError(
        'Für eine Druckverletzung muss ein Druckentlastungs- oder Lagerungsplan dokumentiert werden.',
      );
      return;
    }
    if (
      markerType === 'druckverletzung_medizinprodukt' &&
      !medicalDevice.trim()
    ) {
      setActionError('Bitte das verursachende Medizinprodukt angeben.');
      return;
    }
    const tissuePercentages = {
      granulation: optionalPositiveNumber(granulationPercent) ?? 0,
      fibrin: optionalPositiveNumber(fibrinPercent) ?? 0,
      nekrose: optionalPositiveNumber(necrosisPercent) ?? 0,
    };
    const tissueTotal = Object.values(tissuePercentages).reduce((sum, value) => sum + value, 0);
    if (isPressureFinding && tissueTotal > 100) {
      setActionError(`Die Gewebeanteile ergeben ${tissueTotal} %. Maximal zulässig sind 100 %.`);
      return;
    }
    setSaving(true);
    setActionError(null);
    const coordinates = markerCoordinates(pendingHit);
    const decoratedNote = isPressureFinding
      ? `${PRESSURE_INJURY_CLASSIFICATIONS.find((entry) => entry.id === pressureClassification)?.label ?? pressureClassification}${note.trim() ? ` — ${note.trim()}` : ''}`
      : note.trim();
    const model = getBodyMapModel(selection);
    const anatomyPack = getBodyMapAnatomyPack(selection);
    const result = await createBodyMapMarker(
      tenantId,
      {
        clientId,
        subjectType,
        subjectId: clientId,
        gender: legacyGender(selection.sex),
        view: 'vorderseite',
        region: legacyRegion(effectiveZoneId),
        markerType,
        ...coordinates,
        note: decoratedNote,
        woundId: woundId ?? null,
        modelId: model.id,
        anatomyPackId: anatomyPack?.id ?? null,
        ageGroup: selection.ageGroup,
        sex: selection.sex,
        genitalAnatomy: selection.genitalAnatomy,
        chestAnatomy: selection.chestAnatomy,
        skinTone: selection.skinTone,
        anatomicalZoneId: effectiveZoneId,
        surfacePoint: pendingHit.surfacePoint,
        pressureClassification: isPressureFinding ? pressureClassification : null,
        findingStatus: 'aktiv',
        findingDetails: {
          ...buildClinicalLocationSnapshot(effectiveZoneId),
          originalMeshZoneId: pendingHit.anatomicalZoneId,
          diagnosis: diagnosis.trim(),
          treatment: treatment.trim(),
        },
      },
      profile?.roleKey,
    );
    setSaving(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    const followUpErrors: string[] = [];
    if (isPressureFinding) {
      const pain = optionalPositiveNumber(painScore);
      const assessmentResult = await createPressureInjuryAssessment(
        tenantId,
        clientId,
        result.data.id,
        {
          classification: pressureClassification,
          presentOnAdmission,
          deviceRelated: markerType === 'druckverletzung_medizinprodukt',
          medicalDevice: medicalDevice.trim() || null,
          lengthCm: optionalPositiveNumber(lengthCm),
          widthCm: optionalPositiveNumber(widthCm),
          depthCm: optionalPositiveNumber(depthCm),
          underminingClockFrom: optionalPositiveNumber(underminingFrom),
          underminingClockTo: optionalPositiveNumber(underminingTo),
          underminingMaxDepthCm: optionalPositiveNumber(underminingDepth),
          tunnelingPresent,
          tissuePercentages,
          exudate: { amount: exudateAmount, character: exudateCharacter, odor },
          pain: {
            score: pain,
            scale: 'NRS',
            duringCare: true,
          },
          woundEdge: { [woundEdge]: true },
          surroundingSkin: Object.fromEntries(
            surroundingSkinFlags.map((flag) => [flag, true]),
          ),
          infectionSigns: Object.fromEntries(infectionSignFlags.map((flag) => [flag, true])),
          escalationFlags: [
            ...(PRESSURE_INJURY_CLASSIFICATIONS.find(
              (entry) => entry.id === pressureClassification,
            )?.urgentReview
              ? ['neu_ab_kategorie_2']
              : []),
            ...infectionSignFlags.filter((flag) =>
              ['eitriges_exsudat', 'auffaelliger_geruch', 'zunehmender_schmerz', 'fieber'].includes(
                flag,
              ),
            ),
            ...(tunnelingPresent ? ['fistelgang'] : []),
            ...(markerType === 'druckverletzung_medizinprodukt'
              ? ['medizinproduktbezogen']
              : []),
          ],
          treatmentPlan: { dressing: treatment.trim() },
          pressureReliefPlan: { positioning: pressureReliefPlan.trim() },
          nextReviewAt: /^\d{4}-\d{2}-\d{2}$/.test(nextReviewDate)
            ? new Date(`${nextReviewDate}T12:00:00`).toISOString()
            : null,
        },
        profile?.id ?? null,
        subjectType,
      );
      if (!assessmentResult.ok) {
        followUpErrors.push(`Dekubitus-Assessment: ${assessmentResult.error}`);
      }
    }

    if (pickedPhoto) {
      const bytes = await readPickedPhoto(pickedPhoto.uri);
      if (!bytes) {
        followUpErrors.push('Das ausgewählte Foto konnte nicht gelesen werden.');
      } else {
        const photoResult = await uploadBodyMapClinicalPhoto({
          tenantId,
          clientId,
          markerId: result.data.id,
          fileName: pickedPhoto.fileName,
          mimeType: pickedPhoto.mimeType,
          bytes,
          capturePhase: 'initial',
          measurementReferencePresent,
          note: note.trim(),
          createdBy: profile?.id ?? null,
          subjectType,
        });
        if (!photoResult.ok) followUpErrors.push(`Foto: ${photoResult.error}`);
      }
    }

    setSelectedMarkerId(result.data.id);
    setPendingHit(null);
    setSelectedAnatomicalZoneId(null);
    resetFindingDraft();
    if (followUpErrors.length > 0) {
      setActionError(
        `Der Befund wurde gespeichert. Zusatzdaten konnten nicht vollständig gespeichert werden: ${followUpErrors.join(
          ' ',
        )}`,
      );
    }
    await query.refresh();
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title={screenTitle} subtitle="Wird geladen…">
        <LoadingState message="Bodymap und Befunde werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title={screenTitle} subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={screenTitle}
      subtitle={`Anatomische Befunddokumentation · ${roleLabel ?? (isStationaerContext ? 'Stationär' : 'Pflege')} · ${subjectLabel} ${clientId}`}
      onBack={() => router.back()}
      scroll={false}
      showBreadcrumbs={false}
    >
      <ScrollView
        style={styles.workspaceScroll}
        contentContainerStyle={[
          styles.workspaceScrollContent,
          phoneWorkspace && styles.workspaceScrollContentPhone,
        ]}
      >
        <View style={[styles.workspaceHero, phoneWorkspace && styles.workspaceHeroPhone]}>
          <View style={styles.workspaceHeroCopy}>
            <Text style={styles.workspaceEyebrow}>KLINISCHE DOKUMENTATION · DAUERHAFT</Text>
            <Text style={[styles.workspaceTitle, phoneWorkspace && styles.workspaceTitlePhone]}>
              BodyMap
            </Text>
            <Text style={styles.workspaceSubtitle}>
              Körperoberfläche untersuchen, Befunde exakt verorten und den vollständigen
              klinischen Verlauf dokumentieren.
            </Text>
            <View style={styles.workspaceContextRow}>
              <View style={styles.workspaceContextPill}>
                <Ionicons name="person-outline" size={15} color={liquidColors.blue200} />
                <Text style={styles.workspaceContextText}>
                  {clientDetail.data
                    ? `${clientDetail.data.firstName} ${clientDetail.data.lastName}`
                    : `${subjectLabel} ${clientId}`}
                </Text>
              </View>
              <View style={styles.workspaceContextPill}>
                <Ionicons name="shield-checkmark-outline" size={15} color={liquidColors.success} />
                <Text style={styles.workspaceContextText}>
                  {isReadOnly ? 'Nur Lesen' : 'Dokumentation freigegeben'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.workspaceMetrics}>
            <BodyMapMetric
              icon="location-outline"
              label="Befunde"
              value={String(query.data?.length ?? 0)}
            />
            <BodyMapMetric
              icon="pulse-outline"
              label="Aktiv"
              value={String(
                (query.data ?? []).filter(
                  (marker) =>
                    !['abgeheilt', 'geschlossen'].includes(marker.findingStatus ?? 'aktiv'),
                ).length,
              )}
              tone="yellow"
            />
            <BodyMapMetric
              icon="git-network-outline"
              label="3D-Netz"
              value="1"
              tone="green"
            />
          </View>
        </View>

        {actionError ? (
          <InfoBanner variant="danger" title="Aktion fehlgeschlagen" message={actionError} />
        ) : null}

        <View
          testID="bodymap-liquid-workspace"
          style={[
            styles.workspace,
            compactWorkspace && styles.workspaceCompact,
            phoneWorkspace && styles.workspacePhone,
          ]}
        >
          <View
            style={[
              styles.workspaceRail,
              compactWorkspace && styles.workspaceRailCompact,
              phoneWorkspace && styles.workspaceRailPhone,
            ]}
          >
            <WorkspaceTool
              icon="body-outline"
              label="Modell"
              active={workspacePanel === 'model'}
              onPress={() => setWorkspacePanel('model')}
            />
            <WorkspaceTool
              icon="location-outline"
              label="Befunde"
              count={query.data?.length ?? 0}
              active={workspacePanel === 'findings'}
              onPress={() => setWorkspacePanel('findings')}
            />
            <WorkspaceTool
              icon="medkit-outline"
              label="Klinik"
              active={workspacePanel === 'clinical'}
              onPress={() => setWorkspacePanel('clinical')}
            />
          </View>

          <ScrollView
            style={[
              styles.workspaceSidePanel,
              compactWorkspace && styles.workspaceSidePanelCompact,
              phoneWorkspace && styles.workspaceSidePanelPhone,
            ]}
            contentContainerStyle={styles.workspaceSidePanelContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {workspacePanel === 'model' ? (
              <>
                <View style={styles.panelHeading}>
                  <View>
                    <Text style={styles.panelEyebrow}>3D-ANSICHT</Text>
                    <Text style={styles.panelTitle}>Klinische Karte</Text>
                  </View>
                  <Ionicons name="body-outline" size={22} color={liquidColors.blue200} />
                </View>
                <View style={styles.inlineNotice}>
                  <Ionicons name="git-network-outline" size={18} color={liquidColors.blue200} />
                  <Text style={styles.inlineNoticeText}>
                    Einheitliches blaues 3D-Anatomienetz ohne Körpervarianten und Hautrealismus.
                  </Text>
                </View>
                <View style={styles.viewGuideList}>
                  <View style={styles.viewGuideRow}>
                    <Ionicons name="hand-left-outline" size={19} color={liquidColors.blue200} />
                    <View style={styles.viewGuideCopy}>
                      <Text style={styles.viewGuideTitle}>Drehen und verschieben</Text>
                      <Text style={styles.viewGuideText}>
                        Ziehen mit Maus oder Finger bewegt die anatomische Karte.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.viewGuideRow}>
                    <Ionicons name="locate-outline" size={19} color={liquidColors.blue200} />
                    <View style={styles.viewGuideCopy}>
                      <Text style={styles.viewGuideTitle}>Befund setzen</Text>
                      <Text style={styles.viewGuideText}>
                        Zielwerkzeug aktivieren und die exakte Körperstelle antippen.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.viewGuideRow}>
                    <Ionicons name="scan-outline" size={19} color={liquidColors.blue200} />
                    <View style={styles.viewGuideCopy}>
                      <Text style={styles.viewGuideTitle}>Vorne, hinten und seitlich</Text>
                      <Text style={styles.viewGuideText}>
                        Ansichten bleiben reproduzierbar und markerstabil.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.viewGuideRow}>
                    <Ionicons name="accessibility-outline" size={19} color={liquidColors.success} />
                    <View style={styles.viewGuideCopy}>
                      <Text style={styles.viewGuideTitle}>Anatomisch verankert</Text>
                      <Text style={styles.viewGuideText}>
                        Alle bisherigen Marker werden auf die gemeinsame Körperkarte übertragen.
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.panelHeading}>
                  <View>
                    <Text style={styles.panelEyebrow}>
                      {workspacePanel === 'clinical' ? 'KLINISCH' : 'BEFUNDE'}
                    </Text>
                    <Text style={styles.panelTitle}>
                      {workspacePanel === 'clinical' ? 'Dokumentation' : 'Gespeichert'}
                    </Text>
                  </View>
                  <View style={styles.panelCount}>
                    <Text style={styles.panelCountText}>{query.data?.length ?? 0}</Text>
                  </View>
                </View>
                {(query.data?.length ?? 0) === 0 ? (
                  <EmptyState
                    title="Noch keine Befunde"
                    message="Aktivieren Sie das Zielwerkzeug und tippen Sie auf die Körperoberfläche."
                  />
                ) : (
                  <View style={styles.findingList}>
                    {(query.data ?? []).map((marker) => (
                      <Pressable
                        key={marker.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Befund ${marker.markerType} öffnen`}
                        style={[
                          styles.findingRow,
                          selectedMarkerId === marker.id && styles.findingRowSelected,
                        ]}
                        onPress={() => openMarkerDetail(marker.id)}
                      >
                        <PulsingFindingDot selected={selectedMarkerId === marker.id} />
                        <View style={styles.findingCopy}>
                          <Text style={styles.findingTitle}>
                            {MARKER_TYPES.find((entry) => entry.id === marker.markerType)?.label ??
                              marker.markerType}
                          </Text>
                          <Text style={styles.findingMeta}>
                            {marker.anatomicalZoneId
                              ? getAnatomicalPath(marker.anatomicalZoneId)
                                  .map((entry) => entry.label)
                                  .slice(-2)
                                  .join(' › ')
                              : marker.region}
                          </Text>
                          <Text style={styles.findingStatus}>
                            {FINDING_STATUSES.find(
                              (status) => status.id === (marker.findingStatus ?? 'aktiv'),
                            )?.label ?? marker.findingStatus}
                            {' · '}
                            {new Date(marker.updatedAt).toLocaleDateString('de-DE')}
                          </Text>
                          {marker.note ? (
                            <Text style={styles.findingNote} numberOfLines={2}>
                              {marker.note}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name="chevron-forward-outline"
                          size={18}
                          color={liquidColors.white56}
                        />
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <View style={[styles.workspaceStage, phoneWorkspace && styles.workspaceStagePhone]}>
            <View style={styles.stageHeader}>
              <View style={styles.stageTitleWrap}>
                <Text style={styles.panelEyebrow}>ANATOMISCHE 3D-OBERFLÄCHE</Text>
                <Text style={styles.stageTitle}>Klinische 3D-BodyMap</Text>
                <Text style={styles.stageSubtitle}>
                  Zielwerkzeug setzt anatomisch verankerte Befunde · Marker öffnen den Verlauf
                </Text>
              </View>
              <View style={styles.stageLiveBadge}>
                <View style={styles.stageLiveDot} />
                <Text style={styles.stageLiveText}>3D AKTIV</Text>
              </View>
            </View>

            <BodyMap3DViewer
              selection={selection}
              markers={persisted3DMarkers}
              selectedMarkerId={selectedMarkerId}
              disabled={isReadOnly}
              allowTechnicalMeshPreview
              presentationMode="clinical"
              onSurfacePress={handleSurfacePress}
              onMarkerPress={(marker) => openMarkerDetail(marker.id)}
            />
          </View>
        </View>

        <View style={styles.capabilityStrip}>
          <View style={styles.capability}>
            <Ionicons name="locate-outline" size={20} color={liquidColors.blue200} />
            <View>
              <Text style={styles.capabilityTitle}>3D-verankert</Text>
              <Text style={styles.capabilityText}>UV, Normale und anatomische Zone</Text>
            </View>
          </View>
          <View style={styles.capability}>
            <Ionicons name="camera-outline" size={20} color={liquidColors.blue200} />
            <View>
              <Text style={styles.capabilityTitle}>Klinische Medien</Text>
              <Text style={styles.capabilityText}>Initial-, Verlaufs- und Abschlussfotos</Text>
            </View>
          </View>
          <View style={styles.capability}>
            <Ionicons name="time-outline" size={20} color={liquidColors.blue200} />
            <View>
              <Text style={styles.capabilityTitle}>Lückenloser Verlauf</Text>
              <Text style={styles.capabilityText}>Status, Behandlung und Kontrollen</Text>
            </View>
          </View>
          <View style={styles.capability}>
            <Ionicons name="bed-outline" size={20} color={liquidColors.blue200} />
            <View>
              <Text style={styles.capabilityTitle}>Dekubitus</Text>
              <Text style={styles.capabilityText}>Kategorien, Maße und Druckentlastung</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={!!pendingHit}
        transparent
        animationType="slide"
        onRequestClose={closeFindingDraft}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <Text style={styles.modalEyebrow}>NEUER BEFUND</Text>
                  <Text style={styles.modalTitle}>{selectedZone?.label ?? 'Körperstelle'}</Text>
                  <Text style={styles.modalPath}>{selectedZonePath}</Text>
                </View>
                <Pressable style={styles.modalClose} onPress={closeFindingDraft}>
                  <Text style={styles.modalCloseText}>×</Text>
                </Pressable>
              </View>

              {selectedZone?.sensitive ? (
                <InfoBanner
                  variant="warning"
                  title="Medizinisch sensibler Bereich"
                  message="Die anatomische Darstellung bleibt vollständig erhalten. Zugriff und Bearbeitung werden protokolliert."
                />
              ) : null}

              <Text style={styles.fieldLabel}>Anatomische Stelle präzisieren</Text>
              <Text style={styles.selectionHint}>
                Der direkt getroffene Bereich steht zuerst. Wählen Sie bei Bedarf die
                medizinisch genauere Unter- oder Nachbarstruktur aus.
              </Text>
              <View style={styles.choiceRow}>
                {anatomicalCandidates.map((entry) => (
                  <SelectionChip
                    key={entry.id}
                    label={entry.label}
                    active={effectiveZoneId === entry.id}
                    onPress={() => setSelectedAnatomicalZoneId(entry.id)}
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>Was liegt an dieser Stelle vor?</Text>
              <View style={styles.choiceRow}>
                {findingDefinitions.map((entry) => (
                  <SelectionChip
                    key={entry.id}
                    label={entry.label}
                    active={markerType === entry.id}
                    onPress={() => selectMarkerType(entry.id)}
                  />
                ))}
              </View>
              <View style={styles.findingDefinitionCard}>
                <Text style={styles.findingDefinitionTitle}>
                  {MARKER_TYPES.find((entry) => entry.id === markerType)?.label ?? markerType}
                </Text>
                <Text style={styles.findingDefinitionText}>
                  {MARKER_TYPES.find((entry) => entry.id === markerType)?.description ??
                    'Klinischen Befund strukturiert beschreiben.'}
                </Text>
                {selectedZone?.pressureRisk ? (
                  <Text style={styles.findingDefinitionWarning}>
                    Druckgefährdete Körperstelle: Hautzustand, Druckentlastung und nächste
                    Kontrolle ausdrücklich dokumentieren.
                  </Text>
                ) : null}
              </View>

              {isPressureFinding ? (
                <>
                  <Text style={styles.fieldLabel}>Bei Aufnahme bereits vorhanden?</Text>
                  <View style={styles.choiceRow}>
                    <SelectionChip
                      label="Ja"
                      active={presentOnAdmission === true}
                      onPress={() => setPresentOnAdmission(true)}
                    />
                    <SelectionChip
                      label="Nein"
                      active={presentOnAdmission === false}
                      onPress={() => setPresentOnAdmission(false)}
                    />
                    <SelectionChip
                      label="Unbekannt"
                      active={presentOnAdmission === null}
                      onPress={() => setPresentOnAdmission(null)}
                    />
                  </View>
                  <Text style={styles.fieldLabel}>Dekubitus-/Druckverletzungsklassifikation</Text>
                  <View style={styles.choiceRow}>
                    {PRESSURE_INJURY_CLASSIFICATIONS.map((entry) => (
                      <SelectionChip
                        key={entry.id}
                        label={`${entry.shortLabel} · ${entry.label}`}
                        active={pressureClassification === entry.id}
                        onPress={() => selectPressureClassification(entry.id)}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              <PremiumInput
                label="Beobachtung / Beschreibung"
                value={note}
                onChangeText={setNote}
                editable={!isReadOnly}
                multiline
              />
              <PremiumInput
                label="Diagnose / Verdachtsdiagnose"
                value={diagnosis}
                onChangeText={setDiagnosis}
                editable={!isReadOnly}
                multiline
              />
              <PremiumInput
                label="Behandlung / Maßnahmen"
                value={treatment}
                onChangeText={setTreatment}
                editable={!isReadOnly}
                multiline
              />

              {isPressureFinding ? (
                <>
                  <Text style={styles.fieldLabel}>Wundmaße in Zentimetern</Text>
                  <View style={styles.measurementRow}>
                    <PremiumInput
                      label="Länge"
                      value={lengthCm}
                      onChangeText={setLengthCm}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                      style={styles.measurementInput}
                    />
                    <PremiumInput
                      label="Breite"
                      value={widthCm}
                      onChangeText={setWidthCm}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                      style={styles.measurementInput}
                    />
                    <PremiumInput
                      label="Tiefe"
                      value={depthCm}
                      onChangeText={setDepthCm}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                      style={styles.measurementInput}
                    />
                    <PremiumInput
                      label="Schmerz 0–10"
                      value={painScore}
                      onChangeText={setPainScore}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                      style={styles.measurementInput}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Gewebeanteile in Prozent</Text>
                  <View style={styles.measurementRow}>
                    <PremiumInput
                      label="Granulation"
                      value={granulationPercent}
                      onChangeText={setGranulationPercent}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                      style={styles.measurementInput}
                    />
                    <PremiumInput
                      label="Fibrin"
                      value={fibrinPercent}
                      onChangeText={setFibrinPercent}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                      style={styles.measurementInput}
                    />
                    <PremiumInput
                      label="Nekrose"
                      value={necrosisPercent}
                      onChangeText={setNecrosisPercent}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                      style={styles.measurementInput}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Exsudatmenge</Text>
                  <View style={styles.choiceRow}>
                    {(['kein', 'gering', 'mittel', 'stark'] as const).map((amount) => (
                      <SelectionChip
                        key={amount}
                        label={amount[0].toUpperCase() + amount.slice(1)}
                        active={exudateAmount === amount}
                        onPress={() => setExudateAmount(amount)}
                      />
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>Exsudatart</Text>
                  <View style={styles.choiceRow}>
                    {(
                      [
                        ['seroes', 'Serös'],
                        ['blutig', 'Blutig'],
                        ['seroes_blutig', 'Serös-blutig'],
                        ['eitrig', 'Eitrig'],
                      ] as const
                    ).map(([id, label]) => (
                      <SelectionChip
                        key={id}
                        label={label}
                        active={exudateCharacter === id}
                        onPress={() => setExudateCharacter(id)}
                      />
                    ))}
                    <SelectionChip
                      label={odor === 'auffaellig' ? 'Geruch auffällig' : 'Kein auffälliger Geruch'}
                      active={odor === 'auffaellig'}
                      onPress={() =>
                        setOdor((value) => (value === 'auffaellig' ? 'kein' : 'auffaellig'))
                      }
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Wundrand</Text>
                  <View style={styles.choiceRow}>
                    {WOUND_EDGE_OPTIONS.map(([id, label]) => (
                      <SelectionChip
                        key={id}
                        label={label}
                        active={woundEdge === id}
                        onPress={() => setWoundEdge(id)}
                      />
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Wundumgebung</Text>
                  <View style={styles.choiceRow}>
                    {SURROUNDING_SKIN_OPTIONS.map(([id, label]) => (
                      <SelectionChip
                        key={id}
                        label={label}
                        active={surroundingSkinFlags.includes(id)}
                        onPress={() =>
                          setSurroundingSkinFlags((flags) =>
                            flags.includes(id)
                              ? flags.filter((flag) => flag !== id)
                              : [...flags, id],
                          )
                        }
                      />
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Infektions-/Warnzeichen</Text>
                  <View style={styles.choiceRow}>
                    {INFECTION_SIGN_OPTIONS.map(([id, label]) => (
                      <SelectionChip
                        key={id}
                        label={label}
                        active={infectionSignFlags.includes(id)}
                        onPress={() =>
                          setInfectionSignFlags((flags) =>
                            flags.includes(id)
                              ? flags.filter((flag) => flag !== id)
                              : [...flags, id],
                          )
                        }
                      />
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Unterminierung und Tunnelung</Text>
                  <View style={styles.measurementRow}>
                    <PremiumInput
                      label="Uhr von (1–12)"
                      value={underminingFrom}
                      onChangeText={setUnderminingFrom}
                      keyboardType="number-pad"
                      editable={!isReadOnly}
                      style={styles.measurementInput}
                    />
                    <PremiumInput
                      label="Uhr bis (1–12)"
                      value={underminingTo}
                      onChangeText={setUnderminingTo}
                      keyboardType="number-pad"
                      editable={!isReadOnly}
                      style={styles.measurementInput}
                    />
                    <PremiumInput
                      label="Max. Tiefe cm"
                      value={underminingDepth}
                      onChangeText={setUnderminingDepth}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                      style={styles.measurementInput}
                    />
                  </View>
                  <SelectionChip
                    label={tunnelingPresent ? 'Tunnel/Fistelgang vorhanden' : 'Kein Tunnel angegeben'}
                    active={tunnelingPresent}
                    onPress={() => setTunnelingPresent((value) => !value)}
                  />

                  {markerType === 'druckverletzung_medizinprodukt' ? (
                    <PremiumInput
                      label="Verursachendes Medizinprodukt"
                      value={medicalDevice}
                      onChangeText={setMedicalDevice}
                      editable={!isReadOnly}
                      placeholder="z. B. Sauerstoffbrille, Maske, Sonde"
                    />
                  ) : null}

                  <PremiumInput
                    label="Druckentlastungs-/Lagerungsplan"
                    value={pressureReliefPlan}
                    onChangeText={setPressureReliefPlan}
                    editable={!isReadOnly}
                    multiline
                    hint="Lagerung, Intervall, Hilfsmittel und Mobilisation dokumentieren."
                  />
                  <PremiumInput
                    label="Nächste Kontrolle"
                    value={nextReviewDate}
                    onChangeText={setNextReviewDate}
                    editable={!isReadOnly}
                    placeholder="JJJJ-MM-TT"
                    hint="Beispiel: 2026-07-26"
                  />
                </>
              ) : null}

              <Text style={styles.fieldLabel}>Klinisches Foto / Verlaufskontrolle</Text>
              <View style={styles.photoRow}>
                <PremiumButton
                  title={pickedPhoto ? 'Anderes Foto wählen' : 'Foto anhängen'}
                  variant="secondary"
                  disabled={isReadOnly}
                  onPress={handlePickPhoto}
                />
                {pickedPhoto ? (
                  <View style={styles.photoMeta}>
                    <Text style={styles.photoName}>{pickedPhoto.fileName}</Text>
                    <Text style={styles.photoSize}>
                      {pickedPhoto.sizeBytes == null
                        ? 'Bilddatei'
                        : `${Math.round(pickedPhoto.sizeBytes / 1024)} KB`}
                    </Text>
                  </View>
                ) : null}
              </View>
              {pickedPhoto ? (
                <SelectionChip
                  label={
                    measurementReferencePresent
                      ? 'Messreferenz vorhanden'
                      : 'Messreferenz nicht angegeben'
                  }
                  active={measurementReferencePresent}
                  onPress={() => setMeasurementReferencePresent((value) => !value)}
                />
              ) : null}

              <View style={styles.modalActions}>
                <PremiumButton
                  title="Abbrechen"
                  variant="secondary"
                  onPress={closeFindingDraft}
                />
                <PremiumButton
                  title={saving ? 'Befund wird gespeichert…' : 'Befund speichern'}
                  disabled={saving || isReadOnly}
                  onPress={handleSaveFinding}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!detailMarker}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailMarkerId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <Text style={styles.modalEyebrow}>BEFUND & VERLAUF</Text>
                  <Text style={styles.modalTitle}>
                    {detailMarker
                      ? MARKER_TYPES.find((entry) => entry.id === detailMarker.markerType)?.label ??
                        detailMarker.markerType
                      : 'Befund'}
                  </Text>
                  <Text style={styles.modalPath}>
                    {detailMarker?.anatomicalZoneId
                      ? getAnatomicalPath(detailMarker.anatomicalZoneId)
                          .map((entry) => entry.label)
                          .join(' › ')
                      : detailMarker?.region}
                  </Text>
                </View>
                <Pressable style={styles.modalClose} onPress={() => setDetailMarkerId(null)}>
                  <Text style={styles.modalCloseText}>×</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Befundbeschreibung</Text>
              <PremiumInput
                label="Beschreibung, Diagnose und Besonderheiten"
                value={detailNote}
                onChangeText={setDetailNote}
                multiline
                editable={!isReadOnly}
              />
              <View style={styles.findingMasterActions}>
                <PremiumButton
                  title={detailSaving ? 'Wird gespeichert…' : 'Beschreibung speichern'}
                  disabled={detailSaving || isReadOnly || detailNote.trim() === detailMarker?.note}
                  onPress={handleUpdateFinding}
                />
                <PremiumButton
                  title="Befund löschen"
                  variant="ghost"
                  style={styles.dangerButton}
                  disabled={detailSaving || isReadOnly}
                  onPress={handleDeleteFinding}
                />
              </View>

              <Text style={styles.fieldLabel}>Aktueller Status</Text>
              <View style={styles.choiceRow}>
                {FINDING_STATUSES.map((status) => (
                  <SelectionChip
                    key={status.id}
                    label={status.label}
                    active={progressStatus === status.id}
                    onPress={() => setProgressStatus(status.id)}
                  />
                ))}
              </View>
              <PremiumInput
                label="Verlauf, Behandlung und klinische Veränderung"
                value={progressNote}
                onChangeText={setProgressNote}
                multiline
                editable={!isReadOnly}
              />
              <View style={styles.photoRow}>
                <PremiumButton
                  title={progressPhoto ? 'Anderes Verlaufsfoto' : 'Verlaufsfoto anhängen'}
                  variant="secondary"
                  disabled={isReadOnly}
                  onPress={handlePickProgressPhoto}
                />
                {progressPhoto ? (
                  <Text style={styles.photoName}>{progressPhoto.fileName}</Text>
                ) : null}
              </View>
              <PremiumButton
                title={progressSaving ? 'Verlauf wird gespeichert…' : 'Verlauf speichern'}
                disabled={progressSaving || isReadOnly || !progressNote.trim()}
                onPress={handleSaveProgress}
              />

              <Text style={styles.fieldLabel}>Dokumentierter Verlauf</Text>
              {clinicalQuery.loading ? (
                <LoadingState message="Verlauf wird geladen…" />
              ) : clinicalQuery.error ? (
                <ErrorState message={clinicalQuery.error} onRetry={clinicalQuery.refresh} />
              ) : (
                <>
                  <Text style={styles.recordSummary}>
                    {clinicalQuery.data?.media.length ?? 0} Medien ·{' '}
                    {clinicalQuery.data?.pressureAssessments.length ?? 0} Dekubitus-Assessments ·{' '}
                    {clinicalQuery.data?.history.length ?? 0} Verlaufsereignisse
                  </Text>
                  {(clinicalQuery.data?.media ?? []).length > 0 ? (
                    <>
                      <Text style={styles.fieldLabel}>Klinische Medien</Text>
                      <View style={styles.mediaGrid}>
                        {(clinicalQuery.data?.media ?? []).map((media) => (
                          <View key={media.id} style={styles.mediaCard}>
                            {media.signedUrl && media.mimeType?.startsWith('image/') ? (
                              <Image
                                source={{ uri: media.signedUrl }}
                                style={styles.mediaPreview}
                                resizeMode="cover"
                                accessibilityLabel={media.originalFileName ?? 'Klinisches Foto'}
                              />
                            ) : (
                              <View style={[styles.mediaPreview, styles.mediaPlaceholder]}>
                                <Text style={styles.mediaPlaceholderText}>Datei</Text>
                              </View>
                            )}
                            <Text style={styles.mediaName} numberOfLines={2}>
                              {media.originalFileName ?? 'Klinisches Medium'}
                            </Text>
                            <Text style={styles.photoSize}>
                              {media.capturePhase ?? 'Verlauf'} ·{' '}
                              {new Date(media.capturedAt ?? media.createdAt).toLocaleString('de-DE')}
                            </Text>
                            <View style={styles.mediaActions}>
                              <PremiumButton
                                title="Vorschau"
                                variant="secondary"
                                disabled={!media.signedUrl}
                                onPress={() => {
                                  if (media.signedUrl) void Linking.openURL(media.signedUrl);
                                }}
                              />
                              <PremiumButton
                                title="Download"
                                variant="secondary"
                                disabled={!media.downloadUrl}
                                onPress={() => {
                                  if (media.downloadUrl) void Linking.openURL(media.downloadUrl);
                                }}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}
                  {(clinicalQuery.data?.pressureAssessments ?? []).length > 0 ? (
                    <>
                      <Text style={styles.fieldLabel}>Dekubitus-Assessments</Text>
                      {(clinicalQuery.data?.pressureAssessments ?? []).map((assessment) => {
                        const classification =
                          PRESSURE_INJURY_CLASSIFICATIONS.find(
                            (entry) => entry.id === assessment.classification,
                          )?.label ?? assessment.classification;
                        const woundEdgeLabels = labelsForFlags(
                          assessment.woundEdge,
                          WOUND_EDGE_OPTIONS,
                        );
                        const surroundingSkinLabels = labelsForFlags(
                          assessment.surroundingSkin,
                          SURROUNDING_SKIN_OPTIONS,
                        );
                        const infectionLabels = labelsForFlags(
                          assessment.infectionSigns,
                          INFECTION_SIGN_OPTIONS,
                        );
                        return (
                          <View key={assessment.id} style={styles.assessmentCard}>
                            <Text style={styles.assessmentTitle}>{classification}</Text>
                            <Text style={styles.historyTitle}>
                              {new Date(assessment.assessedAt).toLocaleString('de-DE')}
                            </Text>
                            <Text style={styles.findingNote}>
                              Maße: {assessment.lengthCm ?? '–'} × {assessment.widthCm ?? '–'} ×{' '}
                              {assessment.depthCm ?? '–'} cm · Schmerz:{' '}
                              {assessment.pain.score ?? '–'}/10
                            </Text>
                            <Text style={styles.findingMeta}>
                              Gewebe: Granulation {assessment.tissuePercentages.granulation ?? 0} %,
                              Fibrin {assessment.tissuePercentages.fibrin ?? 0} %, Nekrose{' '}
                              {assessment.tissuePercentages.nekrose ?? 0} %
                            </Text>
                            <Text style={styles.findingMeta}>
                              Exsudat: {assessment.exudate.amount ?? 'nicht angegeben'} ·{' '}
                              {assessment.exudate.character ?? 'Art nicht angegeben'} · Geruch:{' '}
                              {assessment.exudate.odor ?? 'nicht angegeben'}
                            </Text>
                            {woundEdgeLabels ? (
                              <Text style={styles.findingMeta}>Wundrand: {woundEdgeLabels}</Text>
                            ) : null}
                            {surroundingSkinLabels ? (
                              <Text style={styles.findingMeta}>
                                Wundumgebung: {surroundingSkinLabels}
                              </Text>
                            ) : null}
                            {infectionLabels ? (
                              <Text style={styles.warningText}>
                                Infektions-/Warnzeichen: {infectionLabels}
                              </Text>
                            ) : null}
                            {assessment.underminingClockFrom != null ||
                            assessment.underminingClockTo != null ? (
                              <Text style={styles.findingMeta}>
                                Unterminierung: {assessment.underminingClockFrom ?? '–'} bis{' '}
                                {assessment.underminingClockTo ?? '–'} Uhr, max.{' '}
                                {assessment.underminingMaxDepthCm ?? '–'} cm
                              </Text>
                            ) : null}
                            {assessment.tunnelingPresent ? (
                              <Text style={styles.warningText}>Tunnel/Fistelgang vorhanden</Text>
                            ) : null}
                            {assessment.medicalDevice ? (
                              <Text style={styles.findingMeta}>
                                Medizinprodukt: {assessment.medicalDevice}
                              </Text>
                            ) : null}
                            {assessment.nextReviewAt ? (
                              <Text style={styles.reviewText}>
                                Nächste Kontrolle:{' '}
                                {new Date(assessment.nextReviewAt).toLocaleString('de-DE')}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </>
                  ) : null}
                  {(clinicalQuery.data?.history ?? []).map((entry) => (
                    <View key={entry.id} style={styles.historyRow}>
                      <Text style={styles.historyTitle}>
                        {historyEventLabel(entry.eventType)} ·{' '}
                        {new Date(entry.createdAt).toLocaleString('de-DE')}
                      </Text>
                      {entry.note ? <Text style={styles.findingNote}>{entry.note}</Text> : null}
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  workspaceScroll: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
  workspaceScrollContent: {
    padding: liquidSpace.lg,
    paddingBottom: 64,
    gap: liquidSpace.lg,
  },
  workspaceScrollContentPhone: {
    padding: liquidSpace.sm,
    paddingBottom: 96,
  },
  workspaceHero: {
    minHeight: 168,
    padding: liquidSpace.xl,
    borderRadius: liquidRadius.panel,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(3,17,39,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: liquidSpace.xl,
    overflow: 'hidden',
  },
  workspaceHeroPhone: {
    padding: liquidSpace.lg,
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  workspaceHeroCopy: {
    flex: 1,
    maxWidth: 820,
  },
  workspaceEyebrow: {
    ...liquidTypography.kicker,
    color: liquidColors.blue200,
  },
  workspaceTitle: {
    ...liquidTypography.display,
    fontSize: 38,
    lineHeight: 44,
    marginTop: 5,
  },
  workspaceTitlePhone: {
    fontSize: 31,
    lineHeight: 37,
  },
  workspaceSubtitle: {
    ...liquidTypography.body,
    color: liquidColors.white72,
    maxWidth: 760,
    marginTop: 5,
  },
  workspaceContextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: liquidSpace.sm,
    marginTop: liquidSpace.md,
  },
  workspaceContextPill: {
    minHeight: 34,
    paddingHorizontal: liquidSpace.md,
    borderRadius: liquidRadius.pill,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.sm,
  },
  workspaceContextText: {
    ...liquidTypography.meta,
    color: liquidColors.white88,
    fontWeight: '700',
  },
  workspaceMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: liquidSpace.sm,
  },
  metricCard: {
    minWidth: 122,
    minHeight: 66,
    paddingHorizontal: liquidSpace.md,
    paddingVertical: liquidSpace.sm,
    borderRadius: liquidRadius.card,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: 'rgba(5,28,57,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.sm,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: liquidColors.blue600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIconYellow: {
    backgroundColor: '#9A6700',
  },
  metricIconGreen: {
    backgroundColor: '#08785D',
  },
  metricValue: {
    color: liquidColors.white,
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '800',
  },
  metricLabel: {
    ...liquidTypography.meta,
    color: liquidColors.white64,
  },
  workspace: {
    width: '100%',
    minHeight: 760,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: liquidSpace.md,
  },
  workspaceCompact: {
    flexWrap: 'wrap',
    minHeight: 0,
  },
  workspacePhone: {
    flexDirection: 'column',
    gap: liquidSpace.sm,
  },
  workspaceRail: {
    width: 86,
    padding: liquidSpace.sm,
    borderRadius: liquidRadius.panel,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(3,17,39,0.92)',
    alignItems: 'stretch',
    gap: liquidSpace.sm,
  },
  workspaceRailCompact: {
    width: '100%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
  },
  workspaceRailPhone: {
    minHeight: 68,
    padding: 6,
  },
  workspaceTool: {
    position: 'relative',
    minHeight: 76,
    paddingHorizontal: 4,
    borderRadius: liquidRadius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  workspaceToolActive: {
    borderColor: liquidColors.blue400,
    backgroundColor: liquidColors.blue500Alpha16,
    ...liquidShadows.focus,
  },
  workspaceToolPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },
  workspaceToolLabel: {
    ...liquidTypography.meta,
    color: liquidColors.white56,
    fontSize: 10,
    fontWeight: '700',
  },
  workspaceToolLabelActive: {
    color: liquidColors.white,
  },
  workspaceToolBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: liquidColors.blue600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspaceToolBadgeText: {
    color: liquidColors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  workspaceSidePanel: {
    width: 332,
    minWidth: 300,
    maxHeight: 820,
    borderRadius: liquidRadius.panel,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(5,28,57,0.9)',
    overflow: 'hidden',
  },
  workspaceSidePanelContent: {
    padding: liquidSpace.lg,
    paddingBottom: liquidSpace.xl,
  },
  workspaceSidePanelCompact: {
    width: 340,
    maxHeight: 720,
  },
  workspaceSidePanelPhone: {
    width: '100%',
    minWidth: 0,
    maxHeight: 620,
  },
  panelHeading: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: liquidSpace.md,
    marginBottom: liquidSpace.md,
  },
  panelEyebrow: {
    ...liquidTypography.kicker,
    color: liquidColors.blue200,
  },
  panelTitle: {
    ...liquidTypography.section,
    fontSize: 21,
    lineHeight: 26,
    marginTop: 2,
  },
  panelCount: {
    minWidth: 38,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: liquidColors.blue500Alpha16,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelCountText: {
    color: liquidColors.blue200,
    fontWeight: '800',
  },
  inlineNotice: {
    padding: liquidSpace.sm,
    borderRadius: liquidRadius.small,
    backgroundColor: liquidColors.blue500Alpha16,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.sm,
  },
  inlineNoticeText: {
    ...liquidTypography.meta,
    color: liquidColors.white88,
    flex: 1,
  },
  viewGuideList: {
    marginTop: liquidSpace.lg,
    gap: liquidSpace.sm,
  },
  viewGuideRow: {
    minHeight: 70,
    padding: liquidSpace.sm,
    borderRadius: liquidRadius.card,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: liquidSpace.sm,
  },
  viewGuideCopy: {
    flex: 1,
  },
  viewGuideTitle: {
    ...liquidTypography.meta,
    color: liquidColors.white,
    fontWeight: '800',
  },
  viewGuideText: {
    ...liquidTypography.meta,
    color: liquidColors.white56,
    marginTop: 3,
  },
  panelWarning: {
    ...liquidTypography.meta,
    color: liquidColors.warning,
    marginBottom: liquidSpace.sm,
  },
  findingList: {
    gap: liquidSpace.sm,
  },
  findingStatus: {
    ...liquidTypography.meta,
    color: liquidColors.blue200,
    marginTop: 3,
  },
  workspaceStage: {
    flex: 1,
    minWidth: 520,
    minHeight: 760,
    padding: liquidSpace.md,
    borderRadius: liquidRadius.panel,
    borderWidth: 1,
    borderColor: liquidColors.blue400,
    backgroundColor: 'rgba(3,17,39,0.94)',
    ...liquidShadows.panel,
  },
  workspaceStagePhone: {
    minWidth: 0,
    width: '100%',
    minHeight: 650,
    padding: liquidSpace.sm,
  },
  stageHeader: {
    minHeight: 76,
    paddingHorizontal: liquidSpace.sm,
    paddingBottom: liquidSpace.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: liquidSpace.md,
  },
  stageTitleWrap: {
    flex: 1,
  },
  stageTitle: {
    ...liquidTypography.section,
    fontSize: 22,
    lineHeight: 27,
    marginTop: 2,
  },
  stageSubtitle: {
    ...liquidTypography.meta,
    color: liquidColors.white64,
    marginTop: 3,
  },
  stageModelButton: {
    minHeight: 38,
    paddingHorizontal: liquidSpace.md,
    borderRadius: liquidRadius.pill,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: liquidColors.blue500Alpha16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.sm,
  },
  stageModelButtonText: {
    ...liquidTypography.meta,
    color: liquidColors.white,
    fontWeight: '800',
  },
  stageLiveBadge: {
    minHeight: 34,
    paddingHorizontal: liquidSpace.md,
    borderRadius: liquidRadius.pill,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: liquidColors.blue500Alpha16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.sm,
  },
  stageLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: liquidColors.blue300,
    shadowColor: liquidColors.blue300,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  stageLiveText: {
    ...liquidTypography.meta,
    color: liquidColors.blue200,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stageEmpty: {
    flex: 1,
    minHeight: 610,
    borderRadius: liquidRadius.card,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: liquidColors.navy950,
    alignItems: 'center',
    justifyContent: 'center',
    padding: liquidSpace.xl,
  },
  stageEmptyGlow: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: liquidColors.blue500Alpha16,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    alignItems: 'center',
    justifyContent: 'center',
    ...liquidShadows.focus,
  },
  stageEmptyTitle: {
    ...liquidTypography.section,
    fontSize: 22,
    marginTop: liquidSpace.lg,
  },
  stageEmptyText: {
    ...liquidTypography.body,
    color: liquidColors.white64,
    textAlign: 'center',
    maxWidth: 420,
    marginTop: liquidSpace.sm,
  },
  capabilityStrip: {
    width: '100%',
    padding: liquidSpace.md,
    borderRadius: liquidRadius.panel,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: 'rgba(3,17,39,0.78)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: liquidSpace.md,
  },
  capability: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.sm,
  },
  capabilityTitle: {
    ...liquidTypography.meta,
    color: liquidColors.white,
    fontWeight: '800',
  },
  capabilityText: {
    ...liquidTypography.meta,
    color: liquidColors.white56,
    marginTop: 1,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  selectionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    maxWidth: 760,
  },
  findingDefinitionCard: {
    borderWidth: 1,
    borderColor: 'rgba(102,163,255,0.28)',
    borderRadius: 14,
    padding: spacing.sm,
    backgroundColor: 'rgba(33,91,164,0.09)',
    marginBottom: spacing.sm,
  },
  findingDefinitionTitle: {
    ...typography.label,
    color: colors.textPrimary,
  },
  findingDefinitionText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
  findingDefinitionWarning: {
    ...typography.caption,
    color: '#ffbd66',
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  choiceChip: {
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  choiceChipActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(37,99,235,0.18)',
  },
  choiceChipText: { ...typography.caption, color: colors.textSecondary },
  choiceChipTextActive: { color: colors.textPrimary, fontWeight: '700' },
  skinSwatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#ffffff55' },
  modelToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modelMeta: { flex: 1 },
  modelTitle: { ...typography.label, color: colors.textPrimary },
  modelSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  findingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  findingRowSelected: {
    borderColor: '#ffd21f',
    backgroundColor: 'rgba(255,210,31,0.08)',
  },
  findingPulseOuter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,210,31,0.64)',
    backgroundColor: 'rgba(255,210,31,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  findingPulseHalo: {
    position: 'absolute',
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#ffd21f',
  },
  findingPulseCore: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#ffd21f',
    shadowColor: '#ffb000',
    shadowOpacity: 0.9,
    shadowRadius: 9,
    zIndex: 2,
  },
  findingPulseCoreSelected: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#fff2a8',
  },
  findingCopy: { flex: 1 },
  findingTitle: { ...typography.label, color: colors.textPrimary },
  findingMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  findingNote: { ...typography.body, color: colors.textPrimary, marginTop: spacing.xs },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(1,7,18,0.76)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#0b1930',
    borderWidth: 1,
    borderColor: 'rgba(112,165,255,0.3)',
  },
  modalContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modalTitleWrap: { flex: 1 },
  modalEyebrow: {
    ...typography.caption,
    color: '#66a3ff',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  modalTitle: { ...typography.h2, color: '#f5f9ff', marginTop: 4 },
  modalPath: { ...typography.caption, color: '#a9b9d2', marginTop: 4 },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { color: '#fff', fontSize: 28, lineHeight: 30 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  findingMasterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  dangerButton: {
    borderColor: 'rgba(255,91,110,0.58)',
    backgroundColor: 'rgba(255,91,110,0.08)',
  },
  measurementRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  measurementInput: { minWidth: 120 },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoMeta: { flex: 1, minWidth: 180 },
  photoName: { ...typography.label, color: colors.textPrimary },
  photoSize: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  recordSummary: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  historyRow: {
    borderLeftWidth: 3,
    borderLeftColor: '#66a3ff',
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  historyTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  assessmentCard: {
    borderWidth: 1,
    borderColor: 'rgba(102,163,255,0.32)',
    borderRadius: 14,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(33,91,164,0.1)',
  },
  assessmentTitle: { ...typography.label, color: colors.textPrimary, marginBottom: 2 },
  warningText: { ...typography.caption, color: '#ffbd66', marginTop: 4, fontWeight: '700' },
  reviewText: { ...typography.caption, color: '#7dd3fc', marginTop: 4, fontWeight: '700' },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  mediaCard: {
    width: 240,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mediaPreview: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    backgroundColor: '#071326',
  },
  mediaPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  mediaPlaceholderText: { ...typography.label, color: colors.textSecondary },
  mediaName: { ...typography.label, color: colors.textPrimary, marginTop: spacing.xs },
  mediaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
