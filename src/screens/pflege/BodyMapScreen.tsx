import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
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
  patchBodyMapMarker,
  removeBodyMapMarker,
} from '@/lib/pflege/bodyMapService';
import type {
  BodyMapGender,
  BodyMapMarker,
  BodyMapMarkerType,
  BodyMapRegion,
  BodyMapView,
} from '@/types/modules/bodyMap';
import { colors, spacing, typography } from '@/theme';

const REGIONS: { key: BodyMapRegion; label: string; style: object }[] = [
  { key: 'kopf', label: 'Kopf', style: { top: '4%', left: '38%', width: '24%', height: '12%' } },
  { key: 'rumpf', label: 'Rumpf', style: { top: '18%', left: '32%', width: '36%', height: '28%' } },
  { key: 'arm_links', label: 'Arm links', style: { top: '20%', left: '8%', width: '18%', height: '30%' } },
  { key: 'arm_rechts', label: 'Arm rechts', style: { top: '20%', left: '74%', width: '18%', height: '30%' } },
  { key: 'bein_links', label: 'Bein links', style: { top: '48%', left: '30%', width: '16%', height: '34%' } },
  { key: 'bein_rechts', label: 'Bein rechts', style: { top: '48%', left: '54%', width: '16%', height: '34%' } },
  { key: 'fuesse', label: 'Füße', style: { top: '84%', left: '32%', width: '36%', height: '10%' } },
  { key: 'sakral', label: 'Sakral', style: { top: '44%', left: '38%', width: '24%', height: '8%' } },
  { key: 'intim_klinisch', label: 'Intim klinisch', style: { top: '52%', left: '38%', width: '24%', height: '8%' } },
];

const MARKER_TYPES: BodyMapMarkerType[] = [
  'wunde',
  'dekubitus',
  'hautroetung',
  'haematom',
  'schmerzpunkt',
  'katheter',
  'stoma',
  'injektion',
  'verband',
  'sonstiges',
];

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

  const [gender, setGender] = useState<BodyMapGender>('neutral');
  const [view, setView] = useState<BodyMapView>('vorderseite');
  const [selectedRegion, setSelectedRegion] = useState<BodyMapRegion | null>(null);
  const [markerType, setMarkerType] = useState<BodyMapMarkerType>('wunde');
  const [note, setNote] = useState('');
  const [tapPoint, setTapPoint] = useState<{ x: number; y: number } | null>(null);
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

  const visibleMarkers = useMemo(
    () => (query.data ?? []).filter((m) => m.view === view && m.gender === gender),
    [query.data, view, gender],
  );

  const refresh = query.refresh;

  const handleCanvasPress = useCallback((evt: GestureResponderEvent) => {
    const { locationX, locationY } = evt.nativeEvent;
    setTapPoint({ x: locationX, y: locationY });
  }, []);

  async function handleSaveMarker() {
    if (!tenantId || isReadOnly || !selectedRegion) return;
    setSaving(true);
    setActionError(null);
    const xPercent = tapPoint ? Math.min(100, Math.max(0, (tapPoint.x / 280) * 100)) : 50;
    const yPercent = tapPoint ? Math.min(100, Math.max(0, (tapPoint.y / 420) * 100)) : 50;
    const result = await createBodyMapMarker(
      tenantId,
      {
        clientId,
        gender,
        view,
        region: selectedRegion,
        markerType,
        xPercent,
        yPercent,
        note: note.trim(),
        woundId: woundId ?? null,
      },
      profile?.roleKey,
    );
    setSaving(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setNote('');
    setTapPoint(null);
    setSelectedRegion(null);
    await refresh();
  }

  async function handleDeleteMarker(marker: BodyMapMarker) {
    if (!tenantId || isReadOnly) return;
    setSaving(true);
    const result = await removeBodyMapMarker(tenantId, clientId, marker.id, profile?.roleKey);
    setSaving(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setSelectedMarkerId(null);
    await refresh();
  }

  async function handleUpdateMarkerNote(marker: BodyMapMarker, nextNote: string) {
    if (!tenantId || isReadOnly) return;
    const result = await patchBodyMapMarker(
      tenantId,
      clientId,
      marker.id,
      { note: nextNote },
      profile?.roleKey,
    );
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    await refresh();
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="BodyMap" subtitle="Wird geladen…">
        <LoadingState message="Marker werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="BodyMap" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="BodyMap"
      subtitle={`Klinische Markierung · ${roleLabel ?? 'Demo'} · Klient:in ${clientId}`}
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoBanner
          variant="info"
          title="Interaktive BodyMap"
          message="Region wählen, Marker-Typ setzen, speichern — Demo-Persistenz im Mandanten."
        />
        {actionError ? <InfoBanner variant="danger" title="Aktion fehlgeschlagen" message={actionError} /> : null}

        <SectionPanel title="Modell & Ansicht">
          <SegmentedTabs
            tabs={[
              { key: 'weiblich', label: 'Weiblich' },
              { key: 'maennlich', label: 'Männlich' },
              { key: 'neutral', label: 'Neutral' },
            ]}
            activeKey={gender}
            onSelect={(k) => setGender(k as BodyMapGender)}
          />
          <SegmentedTabs
            tabs={[
              { key: 'vorderseite', label: 'Vorderseite' },
              { key: 'rueckseite', label: 'Rückseite' },
            ]}
            activeKey={view}
            onSelect={(k) => setView(k as BodyMapView)}
          />
        </SectionPanel>

        <SectionPanel title="Körperregion" subtitle="Region antippen">
          <Pressable style={styles.canvas} onPress={handleCanvasPress}>
            {REGIONS.map((region) => (
              <Pressable
                key={region.key}
                style={[
                  styles.region,
                  region.style,
                  selectedRegion === region.key && styles.regionSelected,
                ]}
                onPress={() => setSelectedRegion(region.key)}
              >
                <Text style={styles.regionLabel}>{region.label}</Text>
              </Pressable>
            ))}
            {visibleMarkers.map((marker) => (
              <Pressable
                key={marker.id}
                style={[
                  styles.markerDot,
                  {
                    left: `${marker.xPercent}%`,
                    top: `${marker.yPercent}%`,
                  },
                  selectedMarkerId === marker.id && styles.markerSelected,
                ]}
                onPress={() => setSelectedMarkerId(marker.id)}
              >
                <Text style={styles.markerDotText}>●</Text>
              </Pressable>
            ))}
          </Pressable>
        </SectionPanel>

        <SectionPanel title="Marker setzen" subtitle={selectedRegion ? `Region: ${selectedRegion}` : 'Zuerst Region wählen'}>
          <View style={styles.typeRow}>
            {MARKER_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[styles.typeChip, markerType === type && styles.typeChipActive]}
                onPress={() => setMarkerType(type)}
              >
                <Text style={styles.typeChipText}>{type}</Text>
              </Pressable>
            ))}
          </View>
          <PremiumInput label="Notiz" value={note} onChangeText={setNote} editable={!isReadOnly} />
          <PremiumButton
            title={saving ? 'Speichern…' : 'Marker speichern'}
            disabled={isReadOnly || saving || !selectedRegion}
            onPress={handleSaveMarker}
          />
        </SectionPanel>

        <SectionPanel title={`Gespeicherte Marker (${visibleMarkers.length})`}>
          {visibleMarkers.length === 0 ? (
            <EmptyState title="Keine Marker" message="Noch keine Marker für diese Ansicht gespeichert." />
          ) : (
            visibleMarkers.map((marker) => (
              <View key={marker.id} style={styles.markerRow}>
                <Text style={styles.markerTitle}>
                  {marker.markerType} · {marker.region}
                </Text>
                <PremiumInput
                  label="Notiz bearbeiten"
                  value={marker.note}
                  onChangeText={(v) => handleUpdateMarkerNote(marker, v)}
                  editable={!isReadOnly}
                />
                {!isReadOnly ? (
                  <PremiumButton
                    title="Marker entfernen"
                    variant="secondary"
                    onPress={() => handleDeleteMarker(marker)}
                  />
                ) : null}
              </View>
            ))
          )}
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  canvas: {
    height: 420,
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    position: 'relative',
    overflow: 'hidden',
  },
  region: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  regionSelected: { borderColor: colors.orange, backgroundColor: colors.borderOrange },
  regionLabel: { ...typography.caption, textAlign: 'center' },
  markerDot: { position: 'absolute', marginLeft: -8, marginTop: -8 },
  markerSelected: { transform: [{ scale: 1.4 }] },
  markerDotText: { color: colors.orange, fontSize: 18 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  typeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  typeChipActive: { borderColor: colors.orange, backgroundColor: colors.borderOrange },
  typeChipText: { ...typography.caption },
  markerRow: { marginBottom: spacing.md, gap: spacing.xs },
  markerTitle: { ...typography.label },
});
