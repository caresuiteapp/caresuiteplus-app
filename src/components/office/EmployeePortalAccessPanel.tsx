import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AccessCredentialsPanel } from '@/components/auth/AccessCredentialsPanel';
import { EmployeePortalImpactPanel } from '@/components/office/EmployeePortalImpactPanel';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import type { AccessCredentialsReveal, EmployeePortalAccount } from '@/lib/auth/auth.types';
import {
  createEmployeePortalAccount,
  fetchEmployeePortalAccountByEmployeeId,
  resetEmployeePortalPassword,
} from '@/lib/auth/accessManagementService';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { usePermissions } from '@/hooks/usePermissions';
import { copyTextToClipboard } from '@/lib/platform/clipboard';
import { colors, spacing, typography } from '@/theme';

type EmployeePortalAccessPanelProps = {
  tenantId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  portalActive?: boolean;
  lastLoginAt?: string | null;
  isReadOnly?: boolean;
  onAccessChanged?: () => void;
};

const EMPLOYEE_PORTAL_LOGIN_PATH = '/auth/employee-portal-login';

function resolveAccountStatus(account: EmployeePortalAccount | null, portalActive?: boolean): string {
  if (!account) return 'Noch nicht eingerichtet';
  if (account.blockedAt || account.status === 'blocked') return 'Gesperrt';
  if (account.firstLoginCompleted) return 'Aktiv';
  if (portalActive) return 'Aktiv';
  if (account.status === 'pending_first_login') return 'Einladung ausstehend';
  return 'Eingerichtet';
}

function statusVariant(account: EmployeePortalAccount | null): 'green' | 'muted' | 'orange' {
  if (account?.blockedAt || account?.status === 'blocked') return 'orange';
  if (account?.firstLoginCompleted || account?.status === 'active') return 'green';
  return 'muted';
}

export function EmployeePortalAccessPanel({
  tenantId,
  employeeId,
  firstName,
  lastName,
  portalActive,
  lastLoginAt,
  isReadOnly = false,
  onAccessChanged,
}: EmployeePortalAccessPanelProps) {
  const { profile } = useAuth();
  const companyName = useTenantDisplayName();
  const { can } = usePermissions();
  const canManageAccess = can('office.access' as never);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [account, setAccount] = useState<EmployeePortalAccount | null>(null);
  const [credentials, setCredentials] = useState<AccessCredentialsReveal | null>(null);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchEmployeePortalAccountByEmployeeId(
      tenantId,
      employeeId,
      profile?.roleKey,
    );
    setLoading(false);
    if (!result.ok) {
      setAccount(null);
      setError(result.error);
      return;
    }
    setAccount(result.data);
  }, [tenantId, employeeId, profile?.roleKey]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  async function handleCreateAccess() {
    if (!canManageAccess || isReadOnly) return;
    setSaving(true);
    setError(null);
    setCopyMessage(null);
    const result = await createEmployeePortalAccount({
      tenantId,
      companyName,
      employeeId,
      firstName,
      lastName,
      createdBy: profile?.id ?? null,
      actorRoleKey: profile?.roleKey,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setAccount(result.data.account);
    setCredentials(result.data.credentials);
    onAccessChanged?.();
  }

  async function handleResetPassword() {
    if (!account || !canManageAccess || isReadOnly) return;
    setSaving(true);
    setError(null);
    setCopyMessage(null);
    const result = await resetEmployeePortalPassword(
      account.id,
      profile?.id ?? null,
      tenantId,
      profile?.roleKey,
    );
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCredentials(result.data);
    await loadAccount();
    onAccessChanged?.();
  }

  async function handleCopy(value: string, label: string) {
    const copied = await copyTextToClipboard(value);
    setCopyMessage(copied ? `${label} kopiert.` : `${label} konnte nicht kopiert werden.`);
  }

  const statusLabel = resolveAccountStatus(account, portalActive);
  const hasAccess = Boolean(account);
  const displayLastLogin = account?.lastLoginAt ?? lastLoginAt ?? null;

  return (
    <View style={styles.root}>
      <SectionPanel title="Mitarbeiter:innen-Portal" subtitle="Zugang anlegen und verwalten">
        {loading ? <LoadingState message="Portalzugang wird geladen…" /> : null}
        {error ? <ErrorState message={error} onRetry={() => void loadAccount()} /> : null}
        {copyMessage ? <SuccessState message={copyMessage} /> : null}

        {!loading ? (
          <>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <PremiumBadge label={statusLabel} variant={statusVariant(account)} dot />
            </View>

            {account?.username ? (
              <View style={styles.credentialRow}>
                <View style={styles.credentialText}>
                  <Text style={styles.credentialCaption}>Benutzername</Text>
                  <Text style={styles.credentialValue}>{account.username}</Text>
                </View>
                <PremiumButton
                  title="Kopieren"
                  variant="secondary"
                  size="sm"
                  onPress={() => void handleCopy(account.username, 'Benutzername')}
                />
              </View>
            ) : (
              <Text style={styles.hint}>
                Benutzername wird bei der Einrichtung aus Vor- und Nachname erzeugt.
              </Text>
            )}

            {displayLastLogin ? (
              <Text style={styles.hint}>
                Letzter Login: {new Date(displayLastLogin).toLocaleString('de-DE')}
              </Text>
            ) : null}

            {credentials ? (
              <AccessCredentialsPanel
                title="Zugangsdaten"
                credentials={credentials}
                onClose={() => setCredentials(null)}
                onCopy={() => {
                  const parts = [credentials.username, credentials.oneTimePassword].filter(Boolean);
                  if (parts.length > 0) void handleCopy(parts.join('\n'), 'Zugangsdaten');
                }}
              />
            ) : null}

            <Text style={styles.instructions}>
              Anmeldung über „Mitarbeiter:innen-Portal“ ({EMPLOYEE_PORTAL_LOGIN_PATH}) mit
              Benutzername und Einmalpasswort. Nach dem ersten Login muss ein neues Passwort gesetzt
              werden.
            </Text>

            {!isReadOnly && canManageAccess ? (
              <View style={styles.actions}>
                {!hasAccess ? (
                  <PremiumButton
                    title="Zugang anlegen"
                    onPress={() => void handleCreateAccess()}
                    loading={saving}
                    fullWidth
                  />
                ) : (
                  <PremiumButton
                    title="Passwort zurücksetzen"
                    variant="secondary"
                    onPress={() => void handleResetPassword()}
                    loading={saving}
                    fullWidth
                  />
                )}
              </View>
            ) : !canManageAccess ? (
              <Text style={styles.hint}>
                Keine Berechtigung für Portalzugänge (office.access). Bitte Administrator:in
                kontaktieren.
              </Text>
            ) : null}
          </>
        ) : null}
      </SectionPanel>

      <EmployeePortalImpactPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusLabel: { ...typography.label },
  credentialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  credentialText: { flex: 1 },
  credentialCaption: { ...typography.caption, color: colors.textMuted },
  credentialValue: { ...typography.bodyStrong },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  instructions: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
});
