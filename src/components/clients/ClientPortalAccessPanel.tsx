import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  ErrorState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import type { ClientFullDetail } from '@/types/modules/client';
import {
  PORTAL_ACCESS_STATUS_LABELS,
  type ClientPortalAccess,
  type ClientPortalCredentialsReveal,
} from '@/types/modules/client';
import {
  fetchClientPortalAccess,
  regenerateClientPortalAccessCode,
  setupClientPortalAccess,
} from '@/lib/clients/clientPortalAccessService';
import { copyTextToClipboard } from '@/lib/platform/clipboard';
import { colors, spacing, typography } from '@/theme';

type ClientPortalAccessPanelProps = {
  client: ClientFullDetail;
  tenantId: string;
  isReadOnly?: boolean;
  onRefresh?: () => void;
};

function resolvePortalStatus(access: ClientPortalAccess | null): string {
  if (!access) return 'Noch nicht eingerichtet';
  if (!access.portalEnabled) return PORTAL_ACCESS_STATUS_LABELS.nicht_eingerichtet;
  return PORTAL_ACCESS_STATUS_LABELS[access.status] ?? access.status;
}

function statusVariant(access: ClientPortalAccess | null): 'green' | 'muted' | 'orange' {
  if (access?.portalEnabled && access.status === 'aktiv') return 'green';
  if (access?.status === 'gesperrt') return 'orange';
  return 'muted';
}

export function ClientPortalAccessPanel({
  client,
  tenantId,
  isReadOnly = false,
  onRefresh,
}: ClientPortalAccessPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [revealedCredentials, setRevealedCredentials] = useState<ClientPortalCredentialsReveal | null>(null);
  const [accessOverride, setAccessOverride] = useState<ClientPortalAccess | null>(null);

  const access = useMemo(() => {
    if (accessOverride) return accessOverride;
    return client.portalAccess[0] ?? null;
  }, [accessOverride, client.portalAccess]);

  const portalStatus = resolvePortalStatus(access);
  const isActive = access?.portalEnabled === true && access.status === 'aktiv';

  async function refreshAccessRecord() {
    const result = await fetchClientPortalAccess(tenantId, client.id);
    if (result.ok && result.data[0]) {
      setAccessOverride(result.data[0]);
    }
    onRefresh?.();
  }

  async function handleSetup() {
    setError(null);
    setCopyMessage(null);
    setLoading(true);
    const result = await setupClientPortalAccess({
      tenantId,
      clientId: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setAccessOverride(result.data.access);
    setRevealedCredentials(result.data.credentials);
    await refreshAccessRecord();
  }

  async function handleRegenerate() {
    if (!access) return;
    setError(null);
    setCopyMessage(null);
    setLoading(true);
    const result = await regenerateClientPortalAccessCode({
      tenantId,
      clientId: client.id,
      accessId: access.id,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setAccessOverride(result.data.access);
    setRevealedCredentials(result.data.credentials);
    await refreshAccessRecord();
  }

  async function handleCopy(value: string, label: string) {
    const copied = await copyTextToClipboard(value);
    setCopyMessage(copied ? `${label} kopiert.` : `${label} konnte nicht kopiert werden.`);
  }

  return (
    <SectionPanel title="Klient:innenportal">
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      {copyMessage ? <SuccessState message={copyMessage} /> : null}

      <PremiumCard style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <PremiumBadge label={portalStatus} variant={statusVariant(access)} dot />
        </View>

        {access?.portalUsername ? (
          <View style={styles.credentialRow}>
            <View style={styles.credentialText}>
              <Text style={styles.label}>Benutzername</Text>
              <Text style={styles.value}>{access.portalUsername}</Text>
            </View>
            <PremiumButton
              title="Kopieren"
              variant="secondary"
              onPress={() => void handleCopy(access.portalUsername!, 'Benutzername')}
            />
          </View>
        ) : (
          <Text style={styles.hint}>Benutzername wird bei der Einrichtung aus Vor- und Nachname erzeugt.</Text>
        )}

        {revealedCredentials?.accessCode ? (
          <View style={styles.credentialRow}>
            <View style={styles.credentialText}>
              <Text style={styles.label}>Zugangscode (6 Zeichen)</Text>
              <Text style={styles.codeValue}>{revealedCredentials.accessCode}</Text>
              <Text style={styles.warning}>Nur einmal sichtbar — bitte an die Klient:in weitergeben.</Text>
            </View>
            <PremiumButton
              title="Kopieren"
              variant="secondary"
              onPress={() => void handleCopy(revealedCredentials.accessCode, 'Zugangscode')}
            />
          </View>
        ) : isActive ? (
          <Text style={styles.hint}>Zugangscode ist aus Sicherheitsgründen maskiert. Bei Bedarf neuen Code erzeugen.</Text>
        ) : null}

        {access?.lastLoginAt ? (
          <Text style={styles.meta}>
            Letzter Login: {new Date(access.lastLoginAt).toLocaleString('de-DE')}
          </Text>
        ) : null}
      </PremiumCard>

      <PremiumCard style={styles.instructions}>
        <Text style={styles.instructionsTitle}>So geben Sie die Zugangsdaten weiter</Text>
        <Text style={styles.instructionsBody}>
          1. Portal-Zugang einrichten und Benutzername sowie Zugangscode kopieren.{'\n'}
          2. Klient:in persönlich, telefonisch oder per Post informieren.{'\n'}
          3. Login unter /auth/portal-code-login mit Benutzername + 6-stelligem Code.{'\n'}
          4. Bei Verlust: „Neuen Code erzeugen“ — der alte Code wird ungültig.
        </Text>
      </PremiumCard>

      {!isReadOnly ? (
        <View style={styles.actions}>
          {!isActive ? (
            <PremiumButton
              title="Portal-Zugang einrichten"
              onPress={() => void handleSetup()}
              loading={loading}
              fullWidth
            />
          ) : null}
          {access?.portalUsername ? (
            <PremiumButton
              title="Neuen Code erzeugen"
              variant="secondary"
              onPress={() => void handleRegenerate()}
              loading={loading}
              fullWidth
            />
          ) : null}
        </View>
      ) : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  credentialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  credentialText: { flex: 1 },
  label: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.bodyStrong, marginTop: 2 },
  codeValue: { ...typography.h3, letterSpacing: 2, marginTop: 2 },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  warning: { ...typography.caption, color: colors.orange, marginTop: spacing.xs },
  meta: { ...typography.caption, marginTop: spacing.sm },
  instructions: { marginBottom: spacing.sm },
  instructionsTitle: { ...typography.bodyStrong, marginBottom: spacing.xs },
  instructionsBody: { ...typography.body, lineHeight: 22 },
  actions: { gap: spacing.sm },
});
