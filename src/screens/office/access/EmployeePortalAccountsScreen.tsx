import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AccessListHero } from '@/components/access';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useDemoData } from '@/hooks/useDemoData';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { listEmployeePortalAccounts } from '@/lib/auth/accessManagementService';
import { colors, spacing, typography } from '@/theme';

export function EmployeePortalAccountsScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { data: accounts, loading, error, refresh } = useDemoData(
    () => {
      if (!tenantId) throw new Error('Kein Mandant.');
      return listEmployeePortalAccounts(tenantId);
    },
    [tenantId],
  );

  if (!tenantId) {
    return (
      <ScreenShell title="Mitarbeitendenportal" subtitle="Zugänge & Benutzer" scroll>
        <EmptyState title="Kein Mandant" message="Mandant konnte nicht aufgelöst werden." />
      </ScreenShell>
    );
  }

  if (loading && !accounts) {
    return (
      <ScreenShell title="Mitarbeitendenportal" subtitle="Wird geladen…" scroll>
        <LoadingState message="Mitarbeiterzugänge werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && !accounts) {
    return (
      <ScreenShell title="Mitarbeitendenportal" subtitle="Fehler" scroll>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const items = accounts ?? [];

  return (
    <ScreenShell title="Mitarbeitendenportal" subtitle="Zugänge & Benutzer" scroll>
      <AccessListHero variant="employee-portal" itemCount={items.length} />
      <PremiumButton
        title="Mitarbeiterzugang erstellen"
        fullWidth
        onPress={() => router.push('/business/office/access/employee-portal/new' as never)}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={<EmptyState title="Keine Mitarbeiterzugänge" message="Erstellen Sie den ersten Zugang." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/business/office/access/employee-portal/${item.id}` as never)}>
            <PremiumCard accentColor={colors.cyan}>
              <Text style={styles.title}>{item.username}</Text>
              <Text style={styles.meta}>Mitarbeiter-ID: {item.employeeId}</Text>
              <Text style={styles.status}>Status: {item.status}</Text>
            </PremiumCard>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary },
  status: { ...typography.caption },
  separator: { height: spacing.sm },
});
