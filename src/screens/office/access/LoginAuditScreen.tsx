import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AccessListHero } from '@/components/access';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard } from '@/components/ui';
import { useDemoData } from '@/hooks/useDemoData';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { listAccessAuditEvents } from '@/lib/auth/accessManagementService';
import { colors, spacing, typography } from '@/theme';

export function LoginAuditScreen() {
  const tenantId = useServiceTenantId();
  const { data: events, loading, error, refresh } = useDemoData(
    () => {
      if (!tenantId) throw new Error('Kein Mandant.');
      return listAccessAuditEvents(tenantId);
    },
    [tenantId],
  );

  if (!tenantId) {
    return (
      <ScreenShell title="Login-Protokoll" subtitle="Zugänge & Benutzer" scroll>
        <EmptyState title="Kein Mandant" message="Mandant konnte nicht aufgelöst werden." />
      </ScreenShell>
    );
  }

  if (loading && !events) {
    return (
      <ScreenShell title="Login-Protokoll" subtitle="Wird geladen…" scroll>
        <LoadingState message="Login-Ereignisse werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && !events) {
    return (
      <ScreenShell title="Login-Protokoll" subtitle="Fehler" scroll>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const items = events ?? [];

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
