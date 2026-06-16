import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, PremiumButton, PremiumCard } from '@/components/ui';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { listInternalUsers } from '@/lib/auth/accessManagementService';
import { colors, typography } from '@/theme';

export function InternalUserDetailScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = tenantId ? listInternalUsers(tenantId).find((entry) => entry.id === id) : undefined;

  if (!tenantId) {
    return (
      <ScreenShell title="Interner Benutzer" subtitle="Kein Mandant">
        <EmptyState title="Kein Mandant" message="Mandant konnte nicht aufgelöst werden." />
      </ScreenShell>
    );
  }

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
        <Text style={styles.row}>Rolle: {user.roleKey}</Text>
        <Text style={styles.row}>Status: {user.status}</Text>
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
        title="Modulrechte bearbeiten"
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
