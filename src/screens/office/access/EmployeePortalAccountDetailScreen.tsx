import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AccessCredentialsPanel } from '@/components/auth/AccessCredentialsPanel';
import { ScreenShell } from '@/components/layout';
import { EmptyState, PremiumButton, PremiumCard } from '@/components/ui';
import type { AccessCredentialsReveal } from '@/lib/auth/auth.types';
import {
  blockEmployeeAccess,
  resetEmployeePassword,
  unblockEmployeeAccess,
} from '@/lib/auth/employeePortalAuthService';
import { listEmployeePortalAccounts } from '@/lib/auth/accessManagementService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { colors, typography } from '@/theme';

export function EmployeePortalAccountDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = listEmployeePortalAccounts(DEMO_TENANT_ID).find((entry) => entry.id === id);
  const [credentials, setCredentials] = useState<AccessCredentialsReveal | null>(null);

  if (!account) {
    return (
      <ScreenShell title="Mitarbeiterzugang" subtitle="Nicht gefunden">
        <EmptyState title="Zugang nicht gefunden" message="Der Mitarbeiterzugang existiert nicht." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} fullWidth />
      </ScreenShell>
    );
  }

  const handleReset = async () => {
    const result = await resetEmployeePassword(account.id, null);
    if (result.ok) {
      setCredentials(result.data);
    }
  };

  const handleBlock = async () => {
    await blockEmployeeAccess(account.id, null, 'Manuell gesperrt');
    router.back();
  };

  const handleUnblock = async () => {
    await unblockEmployeeAccess(account.id);
    router.back();
  };

  if (credentials) {
    return (
      <ScreenShell title="Passwort zurückgesetzt" subtitle={account.username} scroll>
        <AccessCredentialsPanel
          title="Neues Einmalpasswort"
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={account.username} subtitle="Mitarbeiterzugang" scroll>
      <PremiumCard accentColor={colors.cyan}>
        <Text style={styles.row}>Status: {account.status}</Text>
        <Text style={styles.row}>Mitarbeiter-ID: {account.employeeId}</Text>
        <Text style={styles.row}>
          Erstlogin: {account.firstLoginCompleted ? 'abgeschlossen' : 'ausstehend'}
        </Text>
        {account.blockedReason ? <Text style={styles.row}>Grund: {account.blockedReason}</Text> : null}
      </PremiumCard>
      <PremiumButton title="Passwort zurücksetzen" onPress={handleReset} fullWidth />
      {account.status === 'blocked' ? (
        <PremiumButton title="Zugang entsperren" variant="secondary" onPress={handleUnblock} fullWidth />
      ) : (
        <PremiumButton title="Zugang sperren" variant="secondary" onPress={handleBlock} fullWidth />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { ...typography.body, marginBottom: 4 },
});
