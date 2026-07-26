import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { BodyMap3DViewer, type BodyMapSurfaceHit } from '@/components/pflege/bodyMap3d';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SegmentedTabs,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  createBodyMapMarker,
  fetchBodyMapMarkers,
} from '@/lib/pflege/bodyMapService';
import {
  addBodyMapFindingProgress,
  createPressureInjuryAssessment,
  fetchBodyMapClinicalRecord,
  uploadBodyMapClinicalPhoto,
} from '@/lib/pflege/bodyMapClinicalService';
import {
  BODY_MAP_AGE_LABELS,
  BODY_MAP_ANATOMY_PACKS,
  BODY_MAP_CHEST_OPTIONS,
  BODY_MAP_SEX_LABELS,
  getBodyMapAnatomyPack,
  getBodyMapModel,
  validateBodyMapSelection,
} from '@/lib/pflege/bodyMap3d/modelCatalog';
import {
  ANATOMICAL_ZONE_BY_ID,
  getAnatomicalPath,
} from '@/lib/pflege/bodyMap3d/anatomicalZones';
import {
  BODY_MAP_FINDING_DEFINITIONS,
  buildClinicalLocationSnapshot,
  markerMatchesModelSelection,
  recommendedFindingDefinitions,
  resolveAnatomicalCandidates,
} from '@/lib/pflege/bodyMap3d/clinicalInteractionCatalog';
import { PRESSURE_INJURY_CLASSIFICATIONS } from '@/lib/pflege/bodyMap3d/pressureInjuryCatalog';
import type {
  BodyMap3DMarker,
  BodyMapAgeGroup,
  BodyMapChestAnatomy,
  BodyMapGenitalAnatomy,
  BodyMapFindingStatus,
  BodyMapMarker,
  BodyMapMarkerType,
  BodyMapModelSelection,
  BodyMapRegion,
  BodyMapSex,
  BodyMapSkinTone,
} from '@/types/modules/bodyMap';
import { colors, spacing, typography } from '@/theme';

const AGE_GROUPS = Object.keys(BODY_MAP_AGE_LABELS) as BodyMapAgeGroup[];
const SEX_OPTIONS = Object.keys(BODY_MAP_SEX_LABELS) as BodyMapSex[];

const SKIN_TONES: readonly { id: BodyMapSkinTone; label: string; color: string }[] = [
  { id: 'sehr_hell', label: 'Sehr hell', color: '#f4d4c4' },
  { id: 'hell', label: 'Hell', color: '#ddb29a' },
  { id: 'mittel', label: 'Mittel', color: '#b97855' },
  { id: 'dunkel', label: 'Dunkel', color: '#75452f' },
  { id: 'sehr_dunkel', label: 'Sehr dunkel', color: '#3d241c' },
];

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

export function BodyMapScreen({
  careContext = 'pflege',
}: {
  careContext?: 'pflege' | 'stationaer';
} = {}) {
  const router = useRouter();
  const { clientId: clientIdParam, id, woundId } = useLocalSearchParams<{
    clientId?: string;
    id?: string;
    woundId?: string;
  }>();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const clientId = clientIdParam ?? id ?? 'client-001';
  const isStationaerContext = careContext === 'stationaer';
  const subjectType = isStationaerContext ? 'resident' : 'client';
  const subjectLabel = isStationaerContext ? 'Bewohner:in' : 'Klient:in';
  const screenTitle = isStationaerContext
    ? 'Stationäre medizinische 3D-Bodymap'
    : 'Medizinische 3D-Bodymap';

  const [sex, setSex] = useState<BodyMapSex | null>(null);
  const [ageGroup, setAgeGroup] = useState<BodyMapAgeGroup | null>(null);
  const [genitalAnatomy, setGenitalAnatomy] = useState<BodyMapGenitalAnatomy | null>(null);
  const [chestAnatomy, setChestAnatomy] = useState<BodyMapChestAnatomy | null>(null);
  const [skinTone, setSkinTone] = useState<BodyMapSkinTone>('mittel');
  const [selection, setSelection] = useState<BodyMapModelSelection | null>(null);
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
  const [progressPhoto, setProgressPhoto] = useState<PickedClinicalPhoto | null>(null);
  const [progressSaving, setProgressSaving] = useState(false);
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

  const selectionDraft = useMemo<BodyMapModelSelection | null>(() => {
    if (!sex || !ageGroup) return null;
    return {
      sex,
      ageGroup,
      genitalAnatomy: sex === 'divers' ? genitalAnatomy : null,
      chestAnatomy: sex === 'divers' ? chestAnatomy : null,
      skinTone,
    };
  }, [sex, ageGroup, genitalAnatomy, chestAnatomy, skinTone]);

  const selectionErrors = selectionDraft ? validateBodyMapSelection(selectionDraft) : [];
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

  function openSelectedModel() {
    if (!selectionDraft) return;
    const errors = validateBodyMapSelection(selectionDraft);
    if (errors.length > 0) {
      setActionError(errors.join(' '));
      return;
    }
    setSelection(selectionDraft);
    setActionError(null);
  }

  function resetModelSelection() {
    setSelection(null);
    setPendingHit(null);
    setSelectedAnatomicalZoneId(null);
    setSelectedMarkerId(null);
  }

  function handleSurfacePress(hit: BodyMapSurfaceHit) {
    setPendingHit(hit);
    setSelectedAnatomicalZoneId(hit.anatomicalZoneId);
    const firstRecommendation = recommendedFindingDefinitions(hit.anatomicalZoneId)[0];
    if (firstRecommendation) setMarkerType(firstRecommendation.id);
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
    setProgressStatus(
      (marker?.findingStatus as BodyMapFindingStatus | null | undefined) ?? 'in_behandlung',
    );
    setProgressNote('');
    setProgressPhoto(null);
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
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoBanner
          variant="info"
          title="Klinische 3D-Dokumentation"
          message="Körpermodell auswählen, dreidimensional untersuchen und die exakte Oberfläche für einen Befund antippen."
        />
        {actionError ? (
          <InfoBanner variant="danger" title="Aktion fehlgeschlagen" message={actionError} />
        ) : null}

        {!selection ? (
          <SectionPanel
            title="1. Körpermodell auswählen"
            subtitle="15 Grundkörper und drei modulare Divers-Anatomievarianten"
          >
            <Text style={styles.fieldLabel}>Geschlechtseinordnung</Text>
            <SegmentedTabs
              tabs={SEX_OPTIONS.map((entry) => ({
                key: entry,
                label: BODY_MAP_SEX_LABELS[entry],
              }))}
              activeKey={sex ?? ''}
              onSelect={(key) => {
                const nextSex = key as BodyMapSex;
                setSex(nextSex);
                if (nextSex !== 'divers') {
                  setGenitalAnatomy(null);
                  setChestAnatomy(null);
                }
              }}
            />

            <Text style={styles.fieldLabel}>Altersgruppe</Text>
            <View style={styles.choiceRow}>
              {AGE_GROUPS.map((entry) => (
                <SelectionChip
                  key={entry}
                  label={BODY_MAP_AGE_LABELS[entry]}
                  active={ageGroup === entry}
                  onPress={() => setAgeGroup(entry)}
                />
              ))}
            </View>

            {sex === 'divers' ? (
              <>
                <Text style={styles.fieldLabel}>Welche Genitalanatomie liegt vor?</Text>
                <View style={styles.choiceRow}>
                  {BODY_MAP_ANATOMY_PACKS.map((entry) => (
                    <SelectionChip
                      key={entry.id}
                      label={entry.label}
                      active={genitalAnatomy === entry.genitalAnatomy}
                      onPress={() => setGenitalAnatomy(entry.genitalAnatomy)}
                    />
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Welche Brustausprägung liegt vor?</Text>
                <View style={styles.choiceRow}>
                  {BODY_MAP_CHEST_OPTIONS.map((entry) => (
                    <SelectionChip
                      key={entry.id}
                      label={entry.label}
                      active={chestAnatomy === entry.id}
                      onPress={() => setChestAnatomy(entry.id)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.fieldLabel}>Hautton der Darstellung</Text>
            <View style={styles.choiceRow}>
              {SKIN_TONES.map((entry) => (
                <SelectionChip
                  key={entry.id}
                  label={entry.label}
                  color={entry.color}
                  active={skinTone === entry.id}
                  onPress={() => setSkinTone(entry.id)}
                />
              ))}
            </View>

            {selectionErrors.length > 0 ? (
              <InfoBanner
                variant="warning"
                title="Auswahl noch unvollständig"
                message={selectionErrors.join(' ')}
              />
            ) : null}

            <PremiumButton
              title="3D-Bodymap öffnen"
              disabled={!selectionDraft || selectionErrors.length > 0}
              onPress={openSelectedModel}
            />
          </SectionPanel>
        ) : (
          <>
            <SectionPanel
              title="2. Körperoberfläche untersuchen"
              subtitle="Jede markierte Stelle bleibt an ihrer dreidimensionalen Oberflächenkoordinate verankert"
            >
              <View style={styles.modelToolbar}>
                <View style={styles.modelMeta}>
                  <Text style={styles.modelTitle}>{getBodyMapModel(selection).label}</Text>
                  <Text style={styles.modelSubtitle}>
                    {selection.sex === 'divers'
                      ? `${getBodyMapAnatomyPack(selection)?.label ?? 'Anatomie unbekannt'} · ${
                          BODY_MAP_CHEST_OPTIONS.find((entry) => entry.id === selection.chestAnatomy)
                            ?.label ?? 'Brustausprägung unbekannt'
                        }`
                      : BODY_MAP_SEX_LABELS[selection.sex]}
                  </Text>
                </View>
                <PremiumButton
                  title="Modell wechseln"
                  variant="secondary"
                  onPress={resetModelSelection}
                />
              </View>

              <BodyMap3DViewer
                selection={selection}
                markers={persisted3DMarkers.filter(
                  (marker) =>
                    markerMatchesModelSelection(
                      marker,
                      selection,
                      getBodyMapModel(selection).id,
                    ),
                )}
                selectedMarkerId={selectedMarkerId}
                disabled={isReadOnly}
                allowTechnicalMeshPreview
                onSurfacePress={handleSurfacePress}
                onMarkerPress={(marker) => openMarkerDetail(marker.id)}
              />
            </SectionPanel>

            <SectionPanel title={`Gespeicherte Befunde (${query.data?.length ?? 0})`}>
              {(query.data?.length ?? 0) === 0 ? (
                <EmptyState
                  title="Noch keine Befunde"
                  message="Tippen Sie auf eine Körperstelle, um den ersten Befund anzulegen."
                />
              ) : (
                (query.data ?? []).map((marker) => (
                  <Pressable
                    key={marker.id}
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
                        {marker.region} · {new Date(marker.updatedAt).toLocaleString('de-DE')}
                      </Text>
                      {marker.note ? <Text style={styles.findingNote}>{marker.note}</Text> : null}
                    </View>
                  </Pressable>
                ))
              )}
            </SectionPanel>
          </>
        )}
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

              {detailMarker?.note ? (
                <InfoBanner variant="info" title="Ausgangsbefund" message={detailMarker.note} />
              ) : null}

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
