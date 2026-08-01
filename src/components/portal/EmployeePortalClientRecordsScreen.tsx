import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { darkGlassSurfaceText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton } from '@/components/ui';
import { dialPhoneNumber } from '@/components/portal/EmployeePortalClientRecordContactActions';
import { useEmployeePortalClientRecords } from '@/hooks/useEmployeePortalClientRecords';
import { spatialCare, spatialCareColors } from '@/design/tokens/spatialCareSuite';

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
  const text = darkGlassSurfaceText;
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
        colors={['rgba(10,42,82,0.98)', 'rgba(3,17,39,0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.directoryHeader}
      >
        <View style={styles.directoryCopy}>
          <Text style={styles.directoryEyebrow}>VERSORGUNGSVERZEICHNIS</Text>
          <Text style={styles.directoryTitle}>Alle Klient:innen</Text>
          <Text style={styles.directoryText}>
            {records.length} Akten in CareSuite · zum Nachschlagen und Öffnen
          </Text>
        </View>
        <View style={styles.directoryMetric}>
          <Text style={styles.directoryMetricValue}>{records.length}</Text>
          <Text style={styles.directoryMetricLabel}>AKTEN</Text>
        </View>
      </LinearGradient>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" color={spatialCareColors.pearlDeep} size={20} />
        <TextInput
          accessibilityLabel="Klientenakten durchsuchen"
          placeholder="Name, Ort, Adresse oder Telefonnummer suchen"
          placeholderTextColor="rgba(255,255,255,0.46)"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        {search ? (
          <Pressable accessibilityLabel="Suche löschen" onPress={() => setSearch('')} style={styles.clearButton}>
            <Ionicons name="close" color="#FFFFFF" size={18} />
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
            style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressed, webCursor]}
            accessibilityRole="button"
            accessibilityLabel={`Klientenakte ${record.displayName} öffnen`}
          >
            <LinearGradient
              colors={['rgba(9,39,78,0.98)', 'rgba(2,16,37,0.99)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.cardGlow} pointerEvents="none" />
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {record.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                  </Text>
                </View>
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
                    <Ionicons name="calendar-outline" color={spatialCareColors.pearlDeep} size={15} />
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
    borderColor: spatialCare.borderGlow, padding: careSpacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: careSpacing.lg, overflow: 'hidden',
  },
  directoryCopy: { flex: 1, minWidth: 0, gap: 4 },
  directoryEyebrow: { color: spatialCareColors.pearlDeep, fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  directoryTitle: { color: '#FFFFFF', fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.6 },
  directoryText: { color: spatialCare.textOnNightMuted, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  directoryMetric: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 1,
    borderColor: spatialCare.borderGlow, backgroundColor: 'rgba(22,131,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  directoryMetricValue: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, fontWeight: '900' },
  directoryMetricLabel: { color: spatialCareColors.pearlDeep, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  searchBar: {
    minHeight: 58, paddingHorizontal: 17, borderRadius: 18, borderWidth: 1,
    borderColor: spatialCare.border, backgroundColor: 'rgba(7,30,61,0.90)',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  searchInput: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 15, lineHeight: 20, outlineStyle: 'none' } as never,
  clearButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: careSpacing.md,
  },
  hint: {
    ...careTypography.caption,
    marginBottom: careSpacing.xs,
  },
  cardPressable: { flexGrow: 1, flexBasis: 460, minWidth: 300, maxWidth: '100%' },
  cardPressed: { opacity: 0.96, transform: [{ scale: 0.992 }] },
  card: {
    minHeight: 250, height: '100%', gap: careSpacing.md, padding: careSpacing.lg,
    borderRadius: spatialCare.radius.card, borderWidth: 1, borderColor: spatialCare.border,
    overflow: 'hidden',
  },
  cardGlow: { position: 'absolute', right: -48, top: -58, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(53,151,255,0.10)' },
  cardHeader: { flexDirection: 'row', gap: careSpacing.sm, alignItems: 'flex-start' },
  avatar: {
    width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: spatialCare.borderGlow,
    backgroundColor: 'rgba(22,131,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  titleCol: { flex: 1, gap: 4, minWidth: 0 },
  title: { ...careTypography.h3 },
  subtitle: { ...careTypography.body },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, alignItems: 'center' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30 },
  meta: { ...careTypography.caption },
  hintLine: { ...careTypography.caption, fontStyle: 'italic' },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginTop: 'auto',
    paddingTop: careSpacing.sm, borderTopWidth: 1, borderTopColor: spatialCare.borderDark,
  },
});
