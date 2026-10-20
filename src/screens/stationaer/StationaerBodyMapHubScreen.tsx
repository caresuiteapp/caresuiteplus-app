import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useResidentList } from '@/hooks/useResidentList';
import { colors, spacing, typography } from '@/theme';

export function StationaerBodyMapHubScreen() {
  const router = useRouter();
  const list = useResidentList();

  if (list.loading && list.allItems.length === 0) {
    return (
      <ScreenShell title="3D-Bodymap Stationär" subtitle="Bewohner:innen werden geladen…">
        <LoadingState message="Bewohner:innen und Bodymap-Zugänge werden geladen…" />
      </ScreenShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <ScreenShell title="3D-Bodymap Stationär" subtitle="Fehler">
        <ErrorState message={list.error} onRetry={list.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="3D-Bodymap Stationär"
      subtitle="Bewohnerbezogene Befund-, Wund- und Dekubitusdokumentation"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <InfoBanner
          variant="info"
          title="Eine klinische Engine für Pflege und Stationär"
          message="Alle 30 technischen Körpervarianten, anatomischen Treffer, gelben Pulsmarker, Dekubitus-Assessments, Fotos und Verläufe stehen bewohnerbezogen zur Verfügung."
        />
        <SectionPanel
          title="Bewohner:in auswählen"
          subtitle={`${list.filteredCount} von ${list.totalCount} Bewohner:innen`}
        >
          <View style={styles.toolbar}>
            <PremiumInput
              label="Suche"
              value={list.search}
              onChangeText={list.setSearch}
              placeholder="Name, Zimmer, Wohnbereich oder Pflegegrad"
              style={styles.search}
            />
            <PremiumButton
              title={list.refreshing ? 'Aktualisierung…' : 'Aktualisieren'}
              variant="secondary"
              disabled={list.refreshing}
              onPress={list.refresh}
            />
          </View>

          {list.isEmpty ? (
            <EmptyState
              title="Keine Bewohner:innen"
              message="Für den aktuellen Mandanten sind keine aktiven Bewohner:innen verfügbar."
            />
          ) : list.isFilterEmpty ? (
            <EmptyState
              title="Keine Treffer"
              message="Die Suche liefert keine Bewohner:innen."
              actionLabel="Suche zurücksetzen"
              onAction={list.resetFilters}
            />
          ) : (
            <View style={styles.grid}>
              {list.items.map((resident) => (
                <Pressable
                  key={resident.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Bodymap für ${resident.firstName} ${resident.lastName} öffnen`}
                  style={styles.residentCard}
                  onPress={() =>
                    router.push(`/stationaer/bewohner/${resident.id}/bodymap` as never)
                  }
                >
                  <View style={styles.marker}>
                    <View style={styles.markerCore} />
                  </View>
                  <View style={styles.residentCopy}>
                    <Text style={styles.residentName}>
                      {resident.lastName}, {resident.firstName}
                    </Text>
                    <Text style={styles.residentMeta}>
                      {resident.roomName}
                      {resident.wing ? ` · ${resident.wing}` : ''}
                    </Text>
                    <View style={styles.badges}>
                      <PremiumBadge label="3D-Bodymap" variant="orange" dot />
                      {resident.careLevel ? (
                        <PremiumBadge label={resident.careLevel} variant="muted" />
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.openLabel}>Öffnen ›</Text>
                </Pressable>
              ))}
            </View>
          )}

          {list.hasMore ? (
            <PremiumButton title="Weitere Bewohner:innen" onPress={list.loadMore} />
          ) : null}
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  search: { flex: 1, minWidth: 260 },
  grid: { gap: spacing.sm },
  residentCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,210,31,0.62)',
    backgroundColor: 'rgba(255,210,31,0.12)',
  },
  markerCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffd21f',
  },
  residentCopy: { flex: 1 },
  residentName: { ...typography.label, color: colors.textPrimary },
  residentMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  openLabel: { ...typography.label, color: '#ffd21f' },
});
