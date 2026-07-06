import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AccessListHero } from '@/components/access';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchInternalUsersList } from '@/lib/auth/accessManagementService';
import { getInternalRoleLabel } from '@/lib/auth/internalRoleLabels';
import { colors, spacing, typography } from '@/theme';
import { ACCESS_STATUS_LABELS } from './accessLabels';

export function InternalUsersScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInternalUsersList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (!tenantId) {
    return (
      <ScreenShell title="Interne Benutzer" subtitle="Zugänge & Benutzer" scroll>
        <EmptyState title="Kein Mandant" message="Mandant konnte nicht aufgelöst werden." />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Interne Benutzer" subtitle="Wird geladen…" scroll>
        <LoadingState message="Interne Benutzer werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Interne Benutzer" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const items = query.data ?? [];

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
              <Text style={styles.meta}>
                {item.username} · {getInternalRoleLabel(item.roleKey)}
              </Text>
              <Text style={styles.status}>Status: {ACCESS_STATUS_LABELS[item.status]}</Text>
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
