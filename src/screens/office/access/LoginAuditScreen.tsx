import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AccessListHero } from '@/components/access';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchAccessAuditEventsList } from '@/lib/auth/accessManagementService';
import { colors, spacing, typography } from '@/theme';

export function LoginAuditScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchAccessAuditEventsList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (!tenantId) {
    return (
      <ScreenShell title="Login-Protokoll" subtitle="Zugänge & Benutzer" scroll>
        <EmptyState title="Kein Mandant" message="Mandant konnte nicht aufgelöst werden." />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Login-Protokoll" subtitle="Wird geladen…" scroll>
        <LoadingState message="Login-Ereignisse werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Login-Protokoll" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const items = query.data ?? [];

  return (
    <ScreenShell title="Login-Protokoll" subtitle="Zugänge & Benutzer" scroll>
      <AccessListHero variant="login-audit" itemCount={items.length} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={<EmptyState title="Keine Login-Ereignisse" message="Es wurden noch keine Logins protokolliert." />}
        renderItem={({ item }) => (
          <PremiumCard accentColor={item.success ? colors.success : colors.orange}>
            <Text style={styles.title}>
              {item.loginType} · {item.success ? 'Erfolg' : 'Fehler'}
            </Text>
            <Text style={styles.meta}>{item.usernameOrCodeHint}</Text>
            {item.failureReason ? <Text style={styles.meta}>{item.failureReason}</Text> : null}
            <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString('de-DE')}</Text>
          </PremiumCard>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary },
  separator: { height: spacing.sm },
});
