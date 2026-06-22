import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchTIProviders } from '@/lib/ti/tiProviderService';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { TIDashboardHero, TIConnectionStatusBadge, TISecurityNotice } from '@/components/ti';
import { EmptyState, ErrorState, InfoBanner, LoadingState, PremiumButton, PremiumCard, PremiumInput } from '@/components/ui';
import { useTIDashboard } from '@/hooks/ti';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { isTILiveReady, TI_PREPARED_MESSAGE } from '@/lib/ti/tiModuleConfig';
import { colors, spacing, typography } from '@/theme';

export function TIDashboardScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh } = useTIDashboard();

  if (!can('ti.view')) {
    return (
      <ScreenShell title="Telematikinfrastruktur" subtitle={roleLabel ?? 'Betrieb'} showBack={false}>
        <LockedActionBanner message={check('ti.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && !data) {
    return (
      <ScreenShell title="Telematikinfrastruktur" showBack={false}>
        <LoadingState message="TI-Status wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !data) {
    return (
      <ScreenShell title="Telematikinfrastruktur" showBack={false}>
        <ErrorState title="Telematikinfrastruktur" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Telematikinfrastruktur"
      subtitle="KIM · eGK · ePA · eMP · E-Rezept"
      showBack={false}
      rightSlot={
        <TIConnectionStatusBadge status={data!.connectionStatus} />
      }
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.cyan} />}
        contentContainerStyle={styles.scroll}
      >
        <TIDashboardHero data={data!} roleKey={roleKey} />

        {!isTILiveReady() ? (
          <InfoBanner title="Demo-funktional" message={TI_PREPARED_MESSAGE} />
        ) : null}

        <Text style={styles.section}>Schnellzugriff</Text>
        <PremiumCard accentColor={colors.cyan} onPress={() => router.push('/business/ti/kim' as never)}>
          <Text style={styles.cardTitle}>KIM-Postfach</Text>
          <Text style={styles.cardMeta}>{data!.unreadKimCount} ungelesen</Text>
        </PremiumCard>
        <PremiumCard accentColor={colors.cyanSoft} onPress={() => router.push('/business/ti/providers' as never)}>
          <Text style={styles.cardTitle}>TI-Provider</Text>
          <Text style={styles.cardMeta}>Verbindung & Konfiguration</Text>
        </PremiumCard>
        <PremiumCard accentColor={colors.violet} onPress={() => router.push('/business/ti/consent' as never)}>
          <Text style={styles.cardTitle}>Einwilligungen</Text>
          <Text style={styles.cardMeta}>{data!.pendingConsents} ausstehend</Text>
        </PremiumCard>
        <PremiumCard accentColor={colors.textMuted} onPress={() => router.push('/business/ti/audit' as never)}>
          <Text style={styles.cardTitle}>Audit-Log</Text>
          <Text style={styles.cardMeta}>Sicherheitsprotokoll</Text>
        </PremiumCard>

        <Text style={styles.section}>Modulstatus</Text>
        {data!.moduleStatus.map((mod) => (
          <PremiumCard key={mod.module} accentColor={colors.cyan}>
            <View style={styles.moduleRow}>
              <Text style={styles.cardTitle}>{mod.module}</Text>
              <TIConnectionStatusBadge status={mod.status} />
            </View>
            <Text style={styles.cardMeta}>{mod.label}</Text>
          </PremiumCard>
        ))}

        <Text style={styles.section}>TI-Module</Text>
        <View style={styles.prepRow}>
          <PremiumButton title="eGK" size="sm" variant="secondary" onPress={() => router.push('/business/ti/egk' as never)} />
          <PremiumButton title="ePA" size="sm" variant="secondary" onPress={() => router.push('/business/ti/epa' as never)} />
          <PremiumButton title="eMP" size="sm" variant="secondary" onPress={() => router.push('/business/ti/emp' as never)} />
          <PremiumButton title="E-Rezept" size="sm" variant="secondary" onPress={() => router.push('/business/ti/erezept' as never)} />
        </View>

        <Text style={styles.section}>Sicherheit</Text>
        <TISecurityNotice />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  section: { ...typography.bodyStrong, marginTop: spacing.sm, color: colors.cyan },
  cardTitle: { ...typography.bodyStrong },
  cardMeta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  moduleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  prepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
