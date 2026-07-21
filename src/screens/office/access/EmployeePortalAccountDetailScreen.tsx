import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AccessCredentialsPanel } from '@/components/auth/AccessCredentialsPanel';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import type { AccessCredentialsReveal } from '@/lib/auth/auth.types';
import {
  blockEmployeePortalAccount,
  fetchEmployeePortalAccountById,
  resetEmployeePortalPassword,
  unblockEmployeePortalAccount,
} from '@/lib/auth/accessManagementService';
import { useAuth } from '@/lib/auth/context';
import { colors, typography } from '@/theme';
import { ACCESS_STATUS_LABELS } from './accessLabels';

export function EmployeePortalAccountDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [credentials, setCredentials] = useState<AccessCredentialsReveal | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !id) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchEmployeePortalAccountById(tenantId, id, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  const account = query.data ?? null;

  const handleReset = async () => {
    if (!tenantId || !account) return;
    setActionError(null);
    setActionLoading(true);
    const result = await resetEmployeePortalPassword(
      account.id,
      profile?.id ?? null,
      tenantId,
      profile?.roleKey,
    );
    setActionLoading(false);
    if (result.ok) {
      setCredentials(result.data);
    } else {
      setActionError(result.error);
    }
  };

  const handleBlock = async () => {
    if (!tenantId || !account) return;
    setActionError(null);
    setActionLoading(true);
    const result = await blockEmployeePortalAccount(
      account.id,
      profile?.id ?? null,
      'Manuell durch die Verwaltung gesperrt',
      tenantId,
      profile?.roleKey,
    );
    setActionLoading(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    await query.refresh();
  };

  const handleUnblock = async () => {
    if (!tenantId || !account) return;
    setActionError(null);
    setActionLoading(true);
    const result = await unblockEmployeePortalAccount(account.id, tenantId, profile?.roleKey);
    setActionLoading(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    await query.refresh();
  };

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Mitarbeiterzugang" subtitle="Wird geladen…" scroll>
        <LoadingState message="Zugang wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Mitarbeiterzugang" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  if (!account) {
    return (
      <ScreenShell title="Mitarbeiterzugang" subtitle="Nicht gefunden">
        <EmptyState title="Zugang nicht gefunden" message="Der Mitarbeiterzugang existiert nicht." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} fullWidth />
      </ScreenShell>
    );
  }

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
    <ScreenShell title={account.username} subtitle="Mitarbeitendenportal" scroll>
      {actionError ? <ErrorState message={actionError} onRetry={() => setActionError(null)} /> : null}
      <PremiumCard accentColor={colors.cyan}>
        <Text style={styles.row}>Mitarbeitende:r: {account.employeeName ?? 'Nicht aufgelöst'}</Text>
        {account.employeeNumber ? (
          <Text style={styles.row}>Personalnummer: {account.employeeNumber}</Text>
        ) : null}
        <Text style={styles.row}>Status: {ACCESS_STATUS_LABELS[account.status]}</Text>
        <Text style={styles.row}>
          Erstlogin: {account.firstLoginCompleted ? 'abgeschlossen' : 'ausstehend'}
        </Text>
        {account.lastLoginAt ? (
          <Text style={styles.row}>
            Letzter Login: {new Date(account.lastLoginAt).toLocaleString('de-DE')}
          </Text>
        ) : null}
      </PremiumCard>
      <PremiumButton
        title="Passwort zurücksetzen"
        onPress={() => void handleReset()}
        loading={actionLoading}
        disabled={actionLoading}
        fullWidth
      />
      {account.status === 'blocked' ? (
        <PremiumButton title="Entsperren" variant="secondary" onPress={() => void handleUnblock()} loading={actionLoading} disabled={actionLoading} fullWidth />
      ) : (
        <PremiumButton title="Sperren" variant="secondary" onPress={() => void handleBlock()} loading={actionLoading} disabled={actionLoading} fullWidth />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { ...typography.body, marginBottom: 4 },
});
