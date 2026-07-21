import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AccessCredentialsPanel } from '@/components/auth/AccessCredentialsPanel';
import { AccessListHero } from '@/components/access';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import type { AccessCredentialsReveal } from '@/lib/auth/auth.types';
import { fetchClientPortalAccessList } from '@/lib/access/clientPortalAccessListService';
import { isClientPortalAccessLiveReady } from '@/lib/access/accessModuleConfig';
import { fetchClientList } from '@/lib/office/clientListService';
import {
  regenerateClientPortalAccessCode,
  setupClientPortalAccess,
} from '@/lib/clients/clientPortalAccessService';
import { PORTAL_ACCESS_STATUS_LABELS } from '@/types/modules/client';
import type { ClientPortalAccessListItem } from '@/lib/access/clientPortalAccessListMapper';
import { copyTextToClipboard } from '@/lib/platform/clipboard';
import { colors, spacing, typography } from '@/theme';

const QUICK_LINKS = [
  {
    title: 'Interne Benutzer',
    route: '/business/office/access/internal-users',
  },
  {
    title: 'Mitarbeiterzugang',
    route: '/business/office/access/employee-portal',
  },
  {
    title: 'Angehörigenportal',
    route: '/business/office/access/relative-portal',
  },
  {
    title: 'Rollen & Rechte',
    route: '/business/office/access/roles',
  },
  {
    title: 'Login-Protokoll',
    route: '/business/office/access/login-audit',
  },
] as const;

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('de-DE');
}

function resolveStatusLabel(item: ClientPortalAccessListItem): string {
  if (!item.portalEnabled) return PORTAL_ACCESS_STATUS_LABELS.nicht_eingerichtet;
  return PORTAL_ACCESS_STATUS_LABELS[item.status] ?? item.status;
}

export function ClientPortalCodesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const isLive = isClientPortalAccessLiveReady();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [credentials, setCredentials] = useState<AccessCredentialsReveal | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const listQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientPortalAccessList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const clientsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientList(tenantId, profile?.roleKey, { lifecycleFilter: 'active' });
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = listQuery.data ?? [];
  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        key: client.id,
        label: `${client.firstName} ${client.lastName}`,
      })),
    [clients],
  );

  useEffect(() => {
    if (selectedClientId || clientOptions.length === 0) return;
    setSelectedClientId(clientOptions[0]!.key);
  }, [clientOptions, selectedClientId]);

  if (!tenantId) {
    return (
      <ScreenShell title="Klient:innenportal" subtitle="Zugänge & Benutzer" scroll>
        <EmptyState title="Kein Mandant" message="Mandant konnte nicht aufgelöst werden." />
      </ScreenShell>
    );
  }

  const handleGenerate = async () => {
    const client = clients.find((entry) => entry.id === selectedClientId);
    if (!client) {
      setActionError('Bitte wählen Sie eine Klient:in aus.');
      return;
    }

    setActionError(null);
    setGenerating(true);

    const existing = items.find((entry) => entry.clientId === client.id && entry.portalEnabled);
    const result = existing
      ? await regenerateClientPortalAccessCode({
          tenantId,
          clientId: client.id,
          accessId: existing.id,
          actorRoleKey: profile?.roleKey,
        })
      : await setupClientPortalAccess({
          tenantId,
          clientId: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          actorRoleKey: profile?.roleKey,
        });

    setGenerating(false);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setCredentials({
      username: result.data.credentials.username,
      portalCode: result.data.credentials.accessCode,
    });
    await listQuery.refresh();
  };

  const handleCopyCredentials = async () => {
    if (!credentials?.username || !credentials.portalCode) return;
    await copyTextToClipboard(`${credentials.username}\n${credentials.portalCode}`);
  };

  if (credentials) {
    return (
      <ScreenShell title="Portal-Code erstellt" subtitle="Klient:innenportal" scroll>
        <AccessCredentialsPanel
          title="Portal-Zugang erstellt"
          credentials={credentials}
          onClose={() => setCredentials(null)}
          onCopy={() => void handleCopyCredentials()}
        />
      </ScreenShell>
    );
  }

  if ((listQuery.loading && !listQuery.data) || (clientsQuery.loading && !clientsQuery.data)) {
    return (
      <ScreenShell title="Klient:innenportal" subtitle="Wird geladen…" scroll>
        <LoadingState message="Portal-Zugänge werden geladen…" />
      </ScreenShell>
    );
  }

  if (listQuery.error && !listQuery.data) {
    return (
      <ScreenShell title="Klient:innenportal" subtitle="Fehler" scroll>
        <ErrorState message={listQuery.error} onRetry={listQuery.refresh} />
      </ScreenShell>
    );
  }

  const selectedClient = clients.find((entry) => entry.id === selectedClientId);
  const selectedHasPortal = items.some(
    (entry) => entry.clientId === selectedClientId && entry.portalEnabled,
  );
  const generateLabel = selectedHasPortal ? 'Neuen Code erzeugen' : 'Klient:innen-Code generieren';

  return (
    <ScreenShell title="Klient:innenportal" subtitle="Zugänge & Benutzer" scroll>
      <AccessListHero variant="client-portal" itemCount={items.length} liveReady={isLive} />

      <SectionPanel title="Code generieren">
        {clientsQuery.error ? (
          <ErrorState message={clientsQuery.error} onRetry={clientsQuery.refresh} />
        ) : clientOptions.length === 0 ? (
          <EmptyState
            title="Keine Klient:innen"
            message="Legen Sie zuerst eine Klient:in im Office an."
            actionLabel="Klient:innen"
            onAction={() => router.push('/business/office/clients' as never)}
          />
        ) : (
          <>
            <Text style={styles.sectionHint}>Klient:in auswählen und Portal-Zugang einrichten.</Text>
            <FilterChipGroup
              options={clientOptions}
              value={selectedClientId}
              onChange={(key) => setSelectedClientId(Array.isArray(key) ? key[0] ?? '' : key)}
            />
            {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
            <PremiumButton
              title={generateLabel}
              fullWidth
              loading={generating}
              onPress={() => void handleGenerate()}
            />
            {selectedClient && selectedHasPortal ? (
              <PremiumButton
                title="Portal-Tab in Akte öffnen"
                variant="secondary"
                fullWidth
                onPress={() =>
                  router.push(`/business/office/clients/${selectedClient.id}/portal` as never)
                }
              />
            ) : null}
          </>
        )}
      </SectionPanel>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListHeaderComponent={<Text style={styles.listTitle}>Aktive Portal-Zugänge</Text>}
        ListEmptyComponent={
          <EmptyState
            title="Keine Portal-Codes"
            message={
              isLive
                ? 'Richten Sie den ersten Zugang über die Klientenakte oder oben ein.'
                : 'Generieren Sie den ersten Code.'
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/business/office/clients/${item.clientId}/portal` as never)}
          >
            <PremiumCard accentColor={colors.gold}>
              <View style={styles.cardHeader}>
                <Text style={styles.title}>{item.clientName}</Text>
                <PremiumBadge
                  label={resolveStatusLabel(item)}
                  variant={item.portalEnabled && item.status === 'aktiv' ? 'green' : 'muted'}
                  dot
                />
              </View>
              {item.portalUsername ? (
                <Text style={styles.meta}>Benutzername: {item.portalUsername}</Text>
              ) : null}
              <Text style={styles.meta}>Letzter Login: {formatDateTime(item.lastLoginAt)}</Text>
              <Text style={styles.meta}>Code erstellt: {formatDateTime(item.codeCreatedAt)}</Text>
            </PremiumCard>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <SectionPanel title="Weitere Zugänge">
        <View style={styles.actions}>
          {QUICK_LINKS.map((link) => (
            <PremiumButton
              key={link.route}
              title={link.title}
              variant="secondary"
              fullWidth
              onPress={() => router.push(link.route as never)}
            />
          ))}
        </View>
      </SectionPanel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionHint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  errorText: { ...typography.caption, color: colors.orange, marginBottom: spacing.sm },
  listTitle: { ...typography.bodyStrong, marginBottom: spacing.sm },
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  separator: { height: spacing.sm },
  actions: { gap: spacing.sm },
});
