import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton } from '@/components/ui';
import { ClientAnimalAvatar } from '@/components/clients/ClientAnimalAvatar';
import { dialPhoneNumber } from '@/components/portal/EmployeePortalClientRecordContactActions';
import { useEmployeePortalClientRecords } from '@/hooks/useEmployeePortalClientRecords';
import { spatialCare } from '@/design/tokens/spatialCareSuite';
import { portalPremium } from '@/design/tokens/portalPremium';
import { useDeviceClass } from '@/hooks/useDeviceClass';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function EmployeePortalClientRecordsScreen() {
  const router = useRouter();
  const { width, isPhone } = useDeviceClass();
  const compact = isPhone || width < 760;
  const text = portalPremium.text;
  const { records, loading, error, refresh } = useEmployeePortalClientRecords();
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase('de');
  const visibleRecords = useMemo(() => {
    if (!normalizedSearch) return records;
    return records.filter((record) =>
      [record.displayName, record.street, record.zip, record.city, record.phone, record.mobile]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('de').includes(normalizedSearch)),
    );
  }, [normalizedSearch, records]);

  if (loading && records.length === 0) {
    return <LoadingState message="Klientenakten werden geladen…" />;
  }

  if (error && records.length === 0) {
    return (
      <ErrorState title="Klientenakten" message={error} onRetry={() => void refresh()} />
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        title="Keine Klient:innen"
        message="Aktuell sind keine Klient:innenakten vorhanden."
        actionLabel="Erneut laden"
        onAction={() => void refresh()}
      />
    );
  }

  return (
    <ScrollView
      style={styles.viewport}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      testID="employee-portal-client-records"
    >
      <LinearGradient
        colors={['#FFFFFF', '#EEF6FF', '#DCEEFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.directoryHeader, compact && styles.directoryHeaderCompact]}
      >
        <View style={styles.directoryCopy}>
          <Text style={styles.directoryEyebrow}>VERSORGUNGSVERZEICHNIS</Text>
          <Text style={[styles.directoryTitle, compact && styles.directoryTitleCompact]}>Alle Klient:innen</Text>
          <Text style={styles.directoryText}>
            {records.length} Akten in CareSuite · zum Nachschlagen und Öffnen
          </Text>
        </View>
        <View style={[styles.directoryMetric, compact && styles.directoryMetricCompact]}>
          <Text style={styles.directoryMetricValue}>{records.length}</Text>
          <Text style={styles.directoryMetricLabel}>AKTEN</Text>
        </View>
      </LinearGradient>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" color={portalPremium.accent.blueDark} size={20} />
        <TextInput
          accessibilityLabel="Klientenakten durchsuchen"
          placeholder="Name, Ort, Adresse oder Telefonnummer suchen"
          placeholderTextColor={portalPremium.text.muted}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        {search ? (
          <Pressable accessibilityLabel="Suche löschen" onPress={() => setSearch('')} style={styles.clearButton}>
            <Ionicons name="close" color={portalPremium.accent.blueDark} size={18} />
          </Pressable>
        ) : null}
      </View>

      {visibleRecords.length === 0 ? (
        <EmptyState title="Keine Treffer" message="Zu Ihrer Suche wurde keine Klientenakte gefunden." />
      ) : null}

      <View style={styles.grid}>
      {visibleRecords.map((record) => {
        const location = [record.street, [record.zip, record.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        const phone = record.mobile ?? record.phone;

        return (
          <Pressable
            key={record.clientId}
            onPress={() => router.push(`/portal/employee/clients/${record.clientId}` as never)}
            style={({ pressed }) => [styles.cardPressable, compact && styles.cardPressableCompact, pressed && styles.cardPressed, webCursor]}
            accessibilityRole="button"
            accessibilityLabel={`Klientenakte ${record.displayName} öffnen`}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F2F8FF', '#E5F2FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.card, compact && styles.cardCompact]}
            >
              <View style={styles.cardGlow} pointerEvents="none" />
              <View style={[styles.cardHeader, compact && styles.cardHeaderCompact]}>
                <ClientAnimalAvatar
                  clientId={record.clientId}
                  clientName={record.displayName}
                  size={48}
                />
                <View style={styles.titleCol}>
                  <Text style={[styles.title, { color: text.primary }]}>{record.displayName}</Text>
                  {location ? (
                    <Text style={[styles.subtitle, { color: text.secondary }]}>
                      {location}
                    </Text>
                  ) : null}
                </View>
                {record.careGradeLabel ? (
                  <PremiumBadge label={record.careGradeLabel} variant="cyan" />
                ) : null}
              </View>

              <View style={styles.metaRow}>
                {record.nextAssignmentAt ? (
                  <View style={styles.metaChip}>
                    <Ionicons name="calendar-outline" color={portalPremium.accent.blueDark} size={15} />
                    <Text style={[styles.meta, { color: text.secondary }]}>Nächster Einsatz {formatDate(record.nextAssignmentAt)}</Text>
                  </View>
                ) : null}
                {record.activeAssignmentCount > 0 ? (
                  <PremiumBadge
                    label={`${record.activeAssignmentCount} aktiv`}
                    variant="green"
                  />
                ) : null}
              </View>

              {record.hints ? (
                <Text style={[styles.hintLine, { color: text.secondary }]}>
                  {record.hints}
                </Text>
              ) : null}

              <View style={styles.actions}>
                {phone ? (
                  <PremiumButton
                    title="Anrufen"
                    size="sm"
                    variant="secondary"
                    onPress={() => dialPhoneNumber(phone)}
                  />
                ) : null}
                <PremiumButton
                  title="Akte öffnen"
                  size="sm"
                  variant={phone ? 'ghost' : 'secondary'}
                  onPress={() => router.push(`/portal/employee/clients/${record.clientId}` as never)}
                />
              </View>
            </LinearGradient>
          </Pressable>
        );
      })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1, minHeight: 0, width: '100%',
    ...(Platform.OS === 'web' ? ({ overflowY: 'auto', overflowX: 'hidden', touchAction: 'pan-y' } as never) : {}),
  },
  container: {
    gap: careSpacing.lg,
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
    paddingBottom: careSpacing.xxl,
  },
  directoryHeader: {
    minHeight: 150, borderRadius: spatialCare.radius.stage, borderWidth: 1,
    borderColor: portalPremium.border, padding: careSpacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: careSpacing.lg, overflow: 'hidden',
  },
  directoryHeaderCompact: {
    minHeight: 0,
    padding: careSpacing.md,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: careSpacing.md,
  },
  directoryCopy: { flex: 1, minWidth: 0, gap: 4 },
  directoryEyebrow: { color: portalPremium.accent.blueDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  directoryTitle: { color: portalPremium.text.primary, fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.6 },
  directoryTitleCompact: { fontSize: 24, lineHeight: 29 },
  directoryText: { color: portalPremium.text.secondary, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  directoryMetric: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 1,
    borderColor: portalPremium.borderStrong, backgroundColor: 'rgba(5,108,232,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  directoryMetricCompact: {
    width: '100%',
    height: 58,
    borderRadius: 17,
    flexDirection: 'row',
    gap: 8,
  },
  directoryMetricValue: { color: portalPremium.text.primary, fontSize: 28, lineHeight: 32, fontWeight: '900' },
  directoryMetricLabel: { color: portalPremium.accent.blueDark, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  searchBar: {
    minHeight: 58, paddingHorizontal: 17, borderRadius: 18, borderWidth: 1,
    borderColor: portalPremium.border, backgroundColor: portalPremium.surfaceRaised,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  searchInput: { flex: 1, minWidth: 0, color: portalPremium.text.primary, fontSize: 15, lineHeight: 20, outlineStyle: 'none' } as never,
  clearButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: portalPremium.surfaceSoft },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: careSpacing.md,
  },
  hint: {
    ...careTypography.caption,
    marginBottom: careSpacing.xs,
  },
  cardPressable: { flexGrow: 1, flexBasis: 460, minWidth: 0, maxWidth: '100%' },
  cardPressableCompact: { flexBasis: '100%', width: '100%' },
  cardPressed: { opacity: 0.96, transform: [{ scale: 0.992 }] },
  card: {
    minHeight: 250, height: '100%', gap: careSpacing.md, padding: careSpacing.lg,
    borderRadius: spatialCare.radius.card, borderWidth: 1, borderColor: portalPremium.border,
    overflow: 'hidden',
  },
  cardCompact: {
    minHeight: 0,
    height: 'auto',
    padding: careSpacing.md,
  },
  cardGlow: { position: 'absolute', right: -48, top: -58, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(53,151,255,0.10)' },
  cardHeader: { flexDirection: 'row', gap: careSpacing.sm, alignItems: 'flex-start' },
  cardHeaderCompact: { flexWrap: 'wrap' },
  titleCol: { flex: 1, gap: 4, minWidth: 0 },
  title: { ...careTypography.h3 },
  subtitle: { ...careTypography.body },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, alignItems: 'center' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30 },
  meta: { ...careTypography.caption },
  hintLine: { ...careTypography.caption, fontStyle: 'italic' },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginTop: 'auto',
    paddingTop: careSpacing.sm, borderTopWidth: 1, borderTopColor: portalPremium.borderSoft,
  },
});
