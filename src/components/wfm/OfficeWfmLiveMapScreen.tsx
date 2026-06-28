import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AssistLiveMap } from '@/components/maps/AssistLiveMap';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getAssistMapDemoPosition } from '@/lib/assist/assistMapProvider';
import { isAssistMapProviderConfigured } from '@/lib/assist/gpsTrackingConfig';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';
import { getWfmMapMarkers } from '@/lib/wfm';
import { typography } from '@/theme';

export function OfficeWfmLiveMapScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { width } = useWindowDimensions();
  const splitLayout = width >= 1024;
  const { can, check, roleLabel, roleKey } = usePermissions();
  const text = useAuroraAdaptiveText();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canView = can('time.tracking.team.view');
  const mapProviderReady = isAssistMapProviderConfigured();
  const demoMapPreview = getServiceMode() !== 'supabase' || isDemoMode();

  const query = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView) return { ok: true as const, data: [] };
      return getWfmMapMarkers(tenantId, roleKey);
    }, [tenantId, canView, roleKey]),
    [tenantId, canView, roleKey],
  );

  const markers = query.data ?? [];
  const selected = markers.find((m) => m.employeeId === selectedId) ?? markers[0] ?? null;

  const mapPosition = useMemo((): import('@/lib/assist/assistMapProvider').AssistMapPosition | null => {
    if (selected) {
      return {
        latitude: selected.latitude,
        longitude: selected.longitude,
        accuracyMeters: null,
        capturedAt: selected.capturedAt,
      };
    }
    if (demoMapPreview && mapProviderReady) return getAssistMapDemoPosition();
    return null;
  }, [selected, demoMapPreview, mapProviderReady]);

  if (!canView) {
    return (
      <ScreenShell title="Live-Karte" subtitle="Mitarbeiter im Einsatz">
        <LockedActionBanner
          message={check('time.tracking.team.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Live-Karte" subtitle="Mitarbeiter im Einsatz oder unterwegs" scroll={!splitLayout}>
      <PremiumButton
        title="← Live-Mitarbeiter"
        variant="ghost"
        onPress={() => router.push('/business/office/time-tracking/live' as never)}
      />

      {query.loading && !query.data ? <LoadingState message="Karte wird geladen…" /> : null}
      {query.error ? (
        <ErrorState title="Fehler" message={query.error} onRetry={() => void query.refresh()} />
      ) : null}

      <View style={splitLayout ? styles.split : undefined}>
        <View style={[styles.mapWrap, splitLayout && styles.mapHalf]}>
          {mapPosition && mapProviderReady ? (
            <AssistLiveMap position={mapPosition} height={splitLayout ? 420 : 280} />
          ) : (
            <EmptyState
              title="Keine Kartenposition"
              message={
                mapProviderReady
                  ? 'Aktive Einsätze mit GPS-Zustimmung erscheinen auf der Karte.'
                  : 'Kartenanbieter ist nicht konfiguriert.'
              }
            />
          )}
        </View>

        <View style={splitLayout ? styles.listHalf : undefined}>
          <SectionPanel title="Aktive Positionen">
            {markers.length === 0 ? (
              <Text style={{ color: text.secondary }}>Keine GPS-Positionen verfügbar.</Text>
            ) : (
              markers.map((marker) => (
                <View key={marker.employeeId} style={styles.row}>
                  <PremiumButton
                    title={marker.employeeName}
                    variant={selectedId === marker.employeeId ? 'primary' : 'ghost'}
                    onPress={() => setSelectedId(marker.employeeId)}
                  />
                  <PremiumBadge label={marker.statusLabel} variant="cyan" />
                </View>
              ))
            )}
          </SectionPanel>
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', gap: careSpacing.md },
  mapWrap: { marginBottom: careSpacing.md },
  mapHalf: { flex: 1 },
  listHalf: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: careSpacing.sm, marginBottom: careSpacing.xs },
});
