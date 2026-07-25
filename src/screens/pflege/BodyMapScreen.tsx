import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const MARKER_TYPES: readonly { id: BodyMapMarkerType; label: string }[] = [
  { id: 'wunde', label: 'Wunde' },
  { id: 'dekubitus', label: 'Dekubitus' },
  { id: 'druckverletzung_medizinprodukt', label: 'Druckverletzung Medizinprodukt' },
  { id: 'tiefe_gewebeschaedigung', label: 'Tiefe Gewebeschädigung' },
  { id: 'hautroetung', label: 'Hautrötung' },
  { id: 'haematom', label: 'Hämatom' },
  { id: 'schwellung', label: 'Schwellung' },
  { id: 'narbe', label: 'Narbe' },
  { id: 'verbrennung', label: 'Verbrennung' },
  { id: 'hautveraenderung', label: 'Hautveränderung' },
  { id: 'schmerzpunkt', label: 'Schmerzpunkt' },
  { id: 'katheter', label: 'Katheter' },
  { id: 'stoma', label: 'Stoma' },
  { id: 'injektion', label: 'Injektion' },
  { id: 'verband', label: 'Verband' },
  { id: 'sonstiges', label: 'Sonstiges' },
];

const FINDING_STATUSES: readonly { id: BodyMapFindingStatus; label: string }[] = [
  { id: 'verdacht', label: 'Verdacht' },
  { id: 'aktiv', label: 'Aktiv' },
  { id: 'in_behandlung', label: 'In Behandlung' },
  { id: 'heilend', label: 'Heilend' },
  { id: 'abgeheilt', label: 'Abgeheilt' },
  { id: 'geschlossen', label: 'Geschlossen' },
  { id: 'wiedereroeffnet', label: 'Wiedereröffnet' },
];

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

export function BodyMapScreen() {
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

  const [sex, setSex] = useState<BodyMapSex | null>(null);
  const [ageGroup, setAgeGroup] = useState<BodyMapAgeGroup | null>(null);
  const [genitalAnatomy, setGenitalAnatomy] = useState<BodyMapGenitalAnatomy | null>(null);
  const [chestAnatomy, setChestAnatomy] = useState<BodyMapChestAnatomy | null>(null);
  const [skinTone, setSkinTone] = useState<BodyMapSkinTone>('mittel');
  const [selection, setSelection] = useState<BodyMapModelSelection | null>(null);
  const [pendingHit, setPendingHit] = useState<BodyMapSurfaceHit | null>(null);
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
      return fetchBodyMapMarkers(tenantId, clientId, profile?.roleKey);
    },
    [tenantId, clientId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const clinicalQuery = useAsyncQuery(
    () => {
      if (!tenantId || !detailMarkerId) {
        return Promise.resolve({ ok: false as const, error: 'Befund fehlt.' });
      }
      return fetchBodyMapClinicalRecord(tenantId, clientId, detailMarkerId);
    },
    [tenantId, clientId, detailMarkerId],
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
  const selectedZone = pendingHit
    ? ANATOMICAL_ZONE_BY_ID.get(pendingHit.anatomicalZoneId) ?? null
    : null;
  const selectedZonePath = pendingHit
    ? getAnatomicalPath(pendingHit.anatomicalZoneId).map((entry) => entry.label).join(' › ')
    : '';
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
    setSelectedMarkerId(null);
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
    setPickedPhoto(null);
    setMeasurementReferencePresent(false);
  }

  async function handleSaveFinding() {
    if (!tenantId || !selection || !pendingHit || isReadOnly) return;
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
        gender: legacyGender(selection.sex),
        view: 'vorderseite',
        region: legacyRegion(pendingHit.anatomicalZoneId),
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
        anatomicalZoneId: pendingHit.anatomicalZoneId,
        surfacePoint: pendingHit.surfacePoint,
        pressureClassification: isPressureFinding ? pressureClassification : null,
        findingStatus: 'aktiv',
        findingDetails: {
          anatomicalPath: getAnatomicalPath(pendingHit.anatomicalZoneId).map(
            (entry) => entry.id,
          ),
          sensitiveArea: selectedZone?.sensitive ?? false,
          pressureRiskArea: selectedZone?.pressureRisk ?? false,
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
          presentOnAdmission: null,
          deviceRelated: markerType === 'druckverletzung_medizinprodukt',
          medicalDevice: null,
          lengthCm: optionalPositiveNumber(lengthCm),
          widthCm: optionalPositiveNumber(widthCm),
          depthCm: optionalPositiveNumber(depthCm),
          tissuePercentages: {},
          exudate: { amount: exudateAmount },
          pain: {
            score: pain == null ? null : Math.min(10, pain),
            scale: 'NRS',
            duringCare: true,
          },
          infectionSigns: {},
          escalationFlags: PRESSURE_INJURY_CLASSIFICATIONS.find(
            (entry) => entry.id === pressureClassification,
          )?.urgentReview
            ? ['neu_ab_kategorie_2']
            : [],
          treatmentPlan: { dressing: treatment.trim() },
          pressureReliefPlan: { positioning: pressureReliefPlan.trim() },
          nextReviewAt: null,
        },
        profile?.id ?? null,
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
        });
        if (!photoResult.ok) followUpErrors.push(`Foto: ${photoResult.error}`);
      }
    }

    setSelectedMarkerId(result.data.id);
    setPendingHit(null);
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
      <ScreenShell title="Medizinische 3D-Bodymap" subtitle="Wird geladen…">
        <LoadingState message="Bodymap und Befunde werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Medizinische 3D-Bodymap" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Medizinische 3D-Bodymap"
      subtitle={`Anatomische Befunddokumentation · ${roleLabel ?? 'Pflege'} · Klient:in ${clientId}`}
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
                  (marker) => marker.modelId === getBodyMapModel(selection).id,
                )}
                selectedMarkerId={selectedMarkerId}
                disabled={isReadOnly}
                onSurfacePress={setPendingHit}
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
                    <View style={styles.redX}>
                      <Text style={styles.redXText}>×</Text>
                    </View>
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
        onRequestClose={() => setPendingHit(null)}
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
                <Pressable style={styles.modalClose} onPress={() => setPendingHit(null)}>
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

              <Text style={styles.fieldLabel}>Was liegt an dieser Stelle vor?</Text>
              <View style={styles.choiceRow}>
                {MARKER_TYPES.map((entry) => (
                  <SelectionChip
                    key={entry.id}
                    label={entry.label}
                    active={markerType === entry.id}
                    onPress={() => setMarkerType(entry.id)}
                  />
                ))}
              </View>

              {isPressureFinding ? (
                <>
                  <Text style={styles.fieldLabel}>Dekubitus-/Druckverletzungsklassifikation</Text>
                  <View style={styles.choiceRow}>
                    {PRESSURE_INJURY_CLASSIFICATIONS.map((entry) => (
                      <SelectionChip
                        key={entry.id}
                        label={`${entry.shortLabel} · ${entry.label}`}
                        active={pressureClassification === entry.id}
                        onPress={() => setPressureClassification(entry.id)}
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
                  <PremiumInput
                    label="Druckentlastungs-/Lagerungsplan"
                    value={pressureReliefPlan}
                    onChangeText={setPressureReliefPlan}
                    editable={!isReadOnly}
                    multiline
                    hint="Lagerung, Intervall, Hilfsmittel und Mobilisation dokumentieren."
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
                  onPress={() => setPendingHit(null)}
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
                  {(clinicalQuery.data?.history ?? []).map((entry) => (
                    <View key={entry.id} style={styles.historyRow}>
                      <Text style={styles.historyTitle}>
                        {entry.eventType} · {new Date(entry.createdAt).toLocaleString('de-DE')}
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
  findingRowSelected: { borderColor: '#ef233c', backgroundColor: 'rgba(239,35,60,0.08)' },
  redX: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ef233c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redXText: { color: '#fff', fontSize: 25, fontWeight: '900', lineHeight: 28 },
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
});
