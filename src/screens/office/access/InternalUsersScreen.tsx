import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AccessListHero } from '@/components/access';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useDemoData } from '@/hooks/useDemoData';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { listInternalUsers } from '@/lib/auth/accessManagementService';
import { colors, spacing, typography } from '@/theme';

export function InternalUsersScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { data: users, loading, error, refresh } = useDemoData(
    () => {
      if (!tenantId) throw new Error('Kein Mandant.');
      return listInternalUsers(tenantId);
    },
    [tenantId],
  );

  if (!tenantId) {
    return (
      <ScreenShell title="Interne Benutzer" subtitle="Zugänge & Benutzer" scroll>
        <EmptyState title="Kein Mandant" message="Mandant konnte nicht aufgelöst werden." />
      </ScreenShell>
    );
  }

  if (loading && !users) {
    return (
      <ScreenShell title="Interne Benutzer" subtitle="Wird geladen…" scroll>
        <LoadingState message="Interne Benutzer werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && !users) {
    return (
      <ScreenShell title="Interne Benutzer" subtitle="Fehler" scroll>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const items = users ?? [];

  return (
    <ScreenShell title="Interne Benutzer" subtitle="Zugänge & Benutzer" scroll>
      <AccessListHero variant="internal-users" itemCount={items.length} />
      <PremiumButton
        title="Neue:n Benutzer:in anlegen"
        fullWidth
        onPress={() => router.push('/business/office/access/internal-users/new' as never)}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={<EmptyState title="Keine internen Benutzer" message="Legen Sie den ersten Zugang an." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/business/office/access/internal-users/${item.id}` as never)}>
            <PremiumCard accentColor={colors.orange}>
              <Text style={styles.title}>{item.displayName}</Text>
              <Text style={styles.meta}>{item.username} · {item.roleKey}</Text>
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
