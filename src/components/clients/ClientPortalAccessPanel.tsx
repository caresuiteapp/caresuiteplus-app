import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ClientModuleAssignmentPanel } from '@/components/office/ClientModuleAssignmentPanel';
import { PortalRequestsOfficePanel } from '@/components/office/PortalRequestsOfficePanel';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useAuth } from '@/lib/auth/context';
import {
  fetchClientModuleAssignments,
  saveClientModuleAssignments,
} from '@/lib/portal/clientModuleAssignmentService';
import {
  buildPortalNavigation,
  resolveCombinedModuleLabel,
} from '@/lib/portal/engine';
import type { PortalModuleKey } from '@/lib/portal/types';
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
import { colors, spacing } from '@/theme';

type ClientPortalAccessPanelProps = {
  client: ClientFullDetail;
  tenantId: string;
  isReadOnly?: boolean;
  onRefresh?: () => void;
};

const PORTAL_LOGIN_PATH = '/auth/portal-code-login';
const PORTAL_LOGIN_LABEL = 'Anmeldung Klient:innen Portal';

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
  const { profile } = useAuth();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [revealedCredentials, setRevealedCredentials] = useState<ClientPortalCredentialsReveal | null>(null);
  const [accessOverride, setAccessOverride] = useState<ClientPortalAccess | null>(null);

  const [portalModules, setPortalModules] = useState<PortalModuleKey[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [modulesSaving, setModulesSaving] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);

  const access = useMemo(() => {
    if (accessOverride) return accessOverride;
    return client.portalAccess[0] ?? null;
  }, [accessOverride, client.portalAccess]);

  const portalStatus = resolvePortalStatus(access);
  const isActive = access?.portalEnabled === true && access.status === 'aktiv';

  const portalNavigation = useMemo(() => {
    if (portalModules.length === 0) return [];
    return buildPortalNavigation({
      activeModuleKeys: portalModules,
      hasModuleAssignments: true,
    });
  }, [portalModules]);

  useEffect(() => {
    let cancelled = false;

    async function loadModules() {
      setModulesLoading(true);
      setModulesError(null);
      const result = await fetchClientModuleAssignments(tenantId, client.id);
      if (cancelled) return;
      setModulesLoading(false);
      if (result.ok) {
        setPortalModules(result.data.map((assignment) => assignment.moduleKey));
      } else {
        setModulesError(result.error);
      }
    }

    void loadModules();
    return () => {
      cancelled = true;
    };
  }, [tenantId, client.id]);

  async function refreshAccessRecord() {
    const result = await fetchClientPortalAccess(tenantId, client.id);
    if (result.ok && result.data[0]) {
      setAccessOverride(result.data[0]);
    }
    onRefresh?.();
  }

  async function handleModulesChange(modules: PortalModuleKey[]) {
    if (isReadOnly) return;
    const previous = portalModules;
    setPortalModules(modules);
    setModulesError(null);
    setModulesSaving(true);
    const result = await saveClientModuleAssignments(
      tenantId,
      client.id,
      modules,
      profile?.id ?? null,
    );
    setModulesSaving(false);
    if (!result.ok) {
      setModulesError(result.error);
      setPortalModules(previous);
    }
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

  async function handleCopyBoth() {
    const username = revealedCredentials?.username ?? access?.portalUsername;
    const code = revealedCredentials?.accessCode;
    if (!username || !code) return;
    const copied = await copyTextToClipboard(`${username}\n${code}`);
    setCopyMessage(
      copied ? 'Benutzername und Portal-Code kopiert.' : 'Kopieren fehlgeschlagen.',
    );
  }

  const canCopyBoth =
    Boolean(revealedCredentials?.accessCode) &&
    Boolean(revealedCredentials?.username ?? access?.portalUsername);

  return (
    <View style={styles.root}>
      <ClientModuleAssignmentPanel
        selected={portalModules}
        onChange={(modules) => void handleModulesChange(modules)}
        disabled={isReadOnly || modulesSaving}
      />

      {isActive ? (
        <PortalRequestsOfficePanel tenantId={tenantId} clientId={client.id} />
      ) : null}

      {modulesLoading ? <LoadingState message="Portal-Module werden geladen…" /> : null}
      {modulesError ? <ErrorState message={modulesError} onRetry={() => setModulesError(null)} /> : null}
      {modulesSaving ? <SuccessState message="Portal-Module werden gespeichert…" /> : null}

      <GlassCard style={styles.previewCard}>
        <Text style={[type.bodyStrong, { color: text.primary }]}>Portal-Ansicht für Klient:in</Text>
        <Text style={[type.caption, { color: text.secondary }]}>
          Das Klient:innenportal passt Navigation, Begriffe und Dashboard-Inhalte an die zugewiesenen
          Module an.
        </Text>
        {portalModules.length === 0 ? (
          <Text style={[type.caption, { color: text.muted }]}>
            Noch keine Module zugewiesen — nach dem Login erscheint ein Hinweis zur Einrichtung.
          </Text>
        ) : (
          <>
            <Text style={[type.caption, { color: text.muted }]}>
              Variante: {resolveCombinedModuleLabel(portalModules)}
            </Text>
            <View style={styles.navPreview}>
              {portalNavigation.map((item) => (
                <PremiumBadge key={item.key} label={item.label} variant="cyan" />
              ))}
            </View>
          </>
        )}
      </GlassCard>

      <SectionPanel
        title="Klient:innenportal"
        subtitle="Zugangsdaten und Anmeldung"
      >
        {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
        {copyMessage ? <SuccessState message={copyMessage} /> : null}

        <GlassCard glow accentColor="#FFD166" style={styles.card}>
          <View style={styles.row}>
            <Text style={[type.caption, { color: text.secondary }]}>Status</Text>
            <PremiumBadge label={portalStatus} variant={statusVariant(access)} dot />
          </View>

          {access?.portalUsername ? (
            <View style={styles.credentialRow}>
              <View style={styles.credentialText}>
                <Text style={[type.caption, { color: text.secondary }]}>Benutzername</Text>
                <Text style={[type.bodyStrong, { color: text.primary }]}>{access.portalUsername}</Text>
              </View>
              <PremiumButton
                title="Kopieren"
                variant="secondary"
                onPress={() => void handleCopy(access.portalUsername!, 'Benutzername')}
              />
            </View>
          ) : (
            <Text style={[type.caption, { color: text.muted }]}>
              Benutzername wird bei der Einrichtung aus Vor- und Nachname erzeugt.
            </Text>
          )}

          {revealedCredentials?.accessCode ? (
            <View style={styles.credentialRow}>
              <View style={styles.credentialText}>
                <Text style={[type.caption, { color: text.secondary }]}>Portal-Code (6-stellig)</Text>
                <Text style={[styles.codeValue, { color: text.primary }]}>
                  {revealedCredentials.accessCode}
                </Text>
                <Text style={[type.caption, { color: colors.orange }]}>
                  Nur einmal sichtbar — bitte an die Klient:in weitergeben.
                </Text>
              </View>
              <View style={styles.credentialActions}>
                <PremiumButton
                  title="Kopieren"
                  variant="secondary"
                  onPress={() => void handleCopy(revealedCredentials.accessCode, 'Portal-Code')}
                />
                {canCopyBoth ? (
                  <PremiumButton
                    title="Beide kopieren"
                    variant="secondary"
                    onPress={() => void handleCopyBoth()}
                  />
                ) : null}
              </View>
            </View>
          ) : isActive ? (
            <Text style={[type.caption, { color: text.muted }]}>
              Portal-Code ist aus Sicherheitsgründen maskiert. Bei Bedarf neuen Code erzeugen.
            </Text>
          ) : null}

          {access?.lastLoginAt ? (
            <Text style={[type.caption, { color: text.muted }]}>
              Letzter Login: {new Date(access.lastLoginAt).toLocaleString('de-DE')}
            </Text>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.instructions}>
          <Text style={[type.bodyStrong, { color: text.primary }]}>
            So geben Sie die Zugangsdaten weiter
          </Text>
          <Text style={[type.body, { color: text.secondary, lineHeight: 22 }]}>
            1. Portal-Module zuweisen — Navigation und Inhalte passen sich automatisch an.{'\n'}
            2. Portal-Zugang einrichten und Benutzername sowie Portal-Code kopieren.{'\n'}
            3. Klient:in persönlich, telefonisch oder per Post informieren.{'\n'}
            4. Anmeldung über „{PORTAL_LOGIN_LABEL}“ ({PORTAL_LOGIN_PATH}) mit Benutzername und
            6-stelligem Portal-Code.{'\n'}
            5. Bei Verlust: „Neuen Code erzeugen“ — der alte Code wird ungültig.
          </Text>
        </GlassCard>

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  previewCard: { marginBottom: spacing.xs },
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
  credentialActions: { gap: spacing.xs },
  codeValue: { fontSize: 22, fontWeight: '700', letterSpacing: 2, marginTop: 2 },
  instructions: { marginBottom: spacing.sm },
  navPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
  actions: { gap: spacing.sm },
});
