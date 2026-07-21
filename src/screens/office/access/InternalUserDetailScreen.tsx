import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchInternalUserById } from '@/lib/auth/accessManagementService';
import { useAuth } from '@/lib/auth/context';
import { getInternalRoleLabel } from '@/lib/auth/internalRoleLabels';
import { colors, typography } from '@/theme';
import { ACCESS_STATUS_LABELS } from './accessLabels';

export function InternalUserDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !id) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInternalUserById(tenantId, id, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Interner Benutzer" subtitle="Wird geladen…" scroll>
        <LoadingState message="Benutzer wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Interner Benutzer" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const user = query.data;

  if (!user) {
    return (
      <ScreenShell title="Interner Benutzer" subtitle="Nicht gefunden">
        <EmptyState title="Benutzer nicht gefunden" message="Der Zugang existiert nicht oder wurde archiviert." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} fullWidth />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={user.displayName} subtitle="Interner Benutzer" scroll>
      <PremiumCard accentColor={colors.orange}>
        <Text style={styles.row}>Benutzername: {user.username}</Text>
        <Text style={styles.row}>E-Mail: {user.email}</Text>
        <Text style={styles.row}>Rolle: {getInternalRoleLabel(user.roleKey)}</Text>
        <Text style={styles.row}>Status: {ACCESS_STATUS_LABELS[user.status]}</Text>
        <Text style={styles.row}>
          Erstlogin: {user.firstLoginCompleted ? 'abgeschlossen' : 'ausstehend'}
        </Text>
        {user.lastLoginAt ? (
          <Text style={styles.row}>
            Letzter Login: {new Date(user.lastLoginAt).toLocaleString('de-DE')}
          </Text>
        ) : null}
      </PremiumCard>
      <PremiumButton
        title="Berechtigungsprofile anzeigen"
        variant="secondary"
        onPress={() => router.push('/business/office/access/module-permissions' as never)}
        fullWidth
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { ...typography.body, marginBottom: 4 },
});
