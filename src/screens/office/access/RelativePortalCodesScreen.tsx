import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
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
import { isRelativePortalAccessLiveReady } from '@/lib/access/accessModuleConfig';
import { fetchRelativePortalAccessList } from '@/lib/access/relativePortalAccessListService';
import {
  listRelativeContactIdsForClient,
  setupRelativePortalAccess,
} from '@/lib/access/relativePortalAccessService';
import { fetchClientList } from '@/lib/office/clientListService';
import { colors, spacing, typography } from '@/theme';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('de-DE');
}

export function RelativePortalCodesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const isLive = isRelativePortalAccessLiveReady();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [credentials, setCredentials] = useState<AccessCredentialsReveal | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const listQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchRelativePortalAccessList(tenantId, profile?.roleKey);
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

  const contactsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !selectedClientId) {
        return Promise.resolve({ ok: true as const, data: [] as Array<{ id: string; name: string }> });
      }
      return listRelativeContactIdsForClient(tenantId, selectedClientId);
    },
    [tenantId, selectedClientId],
    { enabled: !!tenantId && !!selectedClientId },
  );

  const items = listQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        key: client.id,
        label: `${client.firstName} ${client.lastName}`,
      })),
    [clients],
  );

  const contactOptions = useMemo(
    () =>
      contacts.map((contact) => ({
        key: contact.id,
        label: contact.name,
      })),
    [contacts],
  );

  useEffect(() => {
    if (selectedClientId || clientOptions.length === 0) return;
    setSelectedClientId(clientOptions[0]!.key);
  }, [clientOptions, selectedClientId]);

  useEffect(() => {
    setSelectedContactId('');
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedContactId || contactOptions.length === 0) return;
    setSelectedContactId(contactOptions[0]!.key);
  }, [contactOptions, selectedContactId]);

  if (!tenantId) {
    return (
      <ScreenShell title="Angehörigenportal" subtitle="Zugänge & Benutzer" scroll>
        <EmptyState title="Kein Mandant" message="Mandant konnte nicht aufgelöst werden." />
      </ScreenShell>
    );
  }

  const handleGenerate = async () => {
    if (!selectedClientId) {
      setActionError('Bitte wählen Sie eine Klient:in aus.');
      return;
    }
    if (!selectedContactId) {
      setActionError('Bitte wählen Sie einen Angehörigen-Kontakt aus.');
      return;
    }

    setActionError(null);
    setGenerating(true);

    const result = await setupRelativePortalAccess({
      tenantId,
      clientId: selectedClientId,
      relativeContactId: selectedContactId,
      createdBy: profile?.id ?? null,
    });

    setGenerating(false);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setCredentials(result.data.credentials);
    await listQuery.refresh();
  };

  if (credentials) {
    return (
      <ScreenShell title="Angehörigen-Code erstellt" subtitle="Angehörigenportal" scroll>
        <AccessCredentialsPanel
          title="Portal-Code erstellt"
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      </ScreenShell>
    );
  }

  if (
    (listQuery.loading && !listQuery.data) ||
    (clientsQuery.loading && !clientsQuery.data)
  ) {
    return (
      <ScreenShell title="Angehörigenportal" subtitle="Wird geladen…" scroll>
        <LoadingState message="Angehörigen-Codes werden geladen…" />
      </ScreenShell>
    );
  }

  if (listQuery.error && !listQuery.data) {
    return (
      <ScreenShell title="Angehörigenportal" subtitle="Fehler" scroll>
        <ErrorState message={listQuery.error} onRetry={listQuery.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Angehörigenportal" subtitle="Zugänge & Benutzer" scroll>
      <AccessListHero variant="relative-portal" itemCount={items.length} liveReady={isLive} />

      <SectionPanel title="Code generieren">
        {clientsQuery.error ? (
          <ErrorState message={clientsQuery.error} onRetry={clientsQuery.refresh} />
        ) : clientOptions.length === 0 ? (
          <EmptyState
            title="Keine Klient:innen"
            message="Legen Sie zuerst eine Klient:in mit Angehörigen-Kontakt im Office an."
            actionLabel="Klient:innen"
            onAction={() => router.push('/business/office/clients' as never)}
          />
        ) : (
          <>
            <Text style={styles.sectionHint}>
              Klient:in und Angehörigen-Kontakt auswählen, dann Einmal-Code erzeugen.
            </Text>
            <FilterChipGroup
              options={clientOptions}
              value={selectedClientId}
              onChange={setSelectedClientId}
            />
            {contactsQuery.loading && selectedClientId ? (
              <LoadingState message="Angehörigen-Kontakte werden geladen…" />
            ) : contactOptions.length === 0 && selectedClientId ? (
              <EmptyState
                title="Kein Angehörigen-Kontakt"
                message="Erfassen Sie in der Klientenakte einen Angehörigen-Kontakt."
                actionLabel="Klientenakte"
                onAction={() =>
                  router.push(`/business/office/clients/${selectedClientId}` as never)
                }
              />
            ) : contactOptions.length > 0 ? (
              <FilterChipGroup
                options={contactOptions}
                value={selectedContactId}
                onChange={setSelectedContactId}
              />
            ) : null}
            {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
            <PremiumButton
              title="Angehörigen-Code generieren"
              fullWidth
              loading={generating}
              disabled={!selectedContactId}
              onPress={() => void handleGenerate()}
            />
          </>
        )}
      </SectionPanel>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListHeaderComponent={<Text style={styles.listTitle}>Aktive Angehörigen-Codes</Text>}
        ListEmptyComponent={
          <EmptyState
            title="Keine Angehörigen-Codes"
            message={
              isLive
                ? 'Generieren Sie den ersten Code für eine Klient:in mit Angehörigen-Kontakt.'
                : 'Generieren Sie den ersten Code.'
            }
          />
        }
        renderItem={({ item }) => (
          <PremiumCard accentColor={colors.violet}>
            <View style={styles.cardHeader}>
              <Text style={styles.title}>{item.clientName}</Text>
              <PremiumBadge
                label={item.status}
                variant={item.status === 'active' ? 'green' : 'muted'}
                dot
              />
            </View>
            <Text style={styles.meta}>Angehörige:r: {item.relativeContactName}</Text>
            <Text style={styles.meta}>Letzte Nutzung: {formatDateTime(item.lastUsedAt)}</Text>
            <Text style={styles.meta}>Erstellt: {formatDateTime(item.createdAt)}</Text>
          </PremiumCard>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
});
