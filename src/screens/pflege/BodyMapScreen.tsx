import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const [local3DMarkers, setLocal3DMarkers] = useState<BodyMap3DMarker[]>([]);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
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

  async function handleSaveFinding() {
    if (!tenantId || !selection || !pendingHit || isReadOnly) return;
    setSaving(true);
    setActionError(null);
    const coordinates = markerCoordinates(pendingHit);
    const decoratedNote = isPressureFinding
      ? `${PRESSURE_INJURY_CLASSIFICATIONS.find((entry) => entry.id === pressureClassification)?.label ?? pressureClassification}${note.trim() ? ` — ${note.trim()}` : ''}`
      : note.trim();
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
      },
      profile?.roleKey,
    );
    setSaving(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    const model = getBodyMapModel(selection);
    const anatomyPack = getBodyMapAnatomyPack(selection);
    const marker: BodyMap3DMarker = {
      ...result.data,
      modelId: model.id,
      anatomyPackId: anatomyPack?.id ?? null,
      anatomicalZoneId: pendingHit.anatomicalZoneId,
      surfacePoint: pendingHit.surfacePoint,
    };
    setLocal3DMarkers((current) => [marker, ...current]);
    setSelectedMarkerId(marker.id);
    setPendingHit(null);
    setNote('');
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
                markers={local3DMarkers}
                selectedMarkerId={selectedMarkerId}
                disabled={isReadOnly}
                onSurfacePress={setPendingHit}
                onMarkerPress={(marker) => setSelectedMarkerId(marker.id)}
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
                    onPress={() => setSelectedMarkerId(marker.id)}
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
                label="Beschreibung, Diagnose, Behandlung oder Beobachtung"
                value={note}
                onChangeText={setNote}
                editable={!isReadOnly}
                multiline
              />

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
});
