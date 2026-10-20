import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ClientCareGradeBudgetsPanel } from '@/components/office/ClientCareGradeBudgetsPanel';
import { EmptyState, ErrorState, LoadingState, PremiumInput } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchClientList } from '@/lib/office/clientListService';
import { spacing } from '@/theme';

/** Central Assist budget workspace using the same live profile as the client record. */
export function AssistBudgetOverviewScreen() {
  const params = useLocalSearchParams<{ clientId?: string }>();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const text = useAuroraAdaptiveText();
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const clientsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientList(tenantId, profile?.roleKey, { lifecycleFilter: 'active' });
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);
  const visibleClients = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('de-DE');
    if (!needle) return clients;
    return clients.filter((client) =>
      `${client.firstName} ${client.lastName} ${client.careLevel ?? ''}`
        .toLocaleLowerCase('de-DE')
        .includes(needle),
    );
  }, [clients, search]);

  useEffect(() => {
    if (params.clientId && clients.some((client) => client.id === params.clientId)) {
      if (selectedClientId !== params.clientId) setSelectedClientId(params.clientId);
      return;
    }
    if (selectedClientId && clients.some((client) => client.id === selectedClientId)) return;
    setSelectedClientId(clients[0]?.id ?? null);
  }, [clients, params.clientId, selectedClientId]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

  return (
    <ScreenShell title="Budgets" subtitle="Anspruch, Verbrauch und Prognose">
      <View style={styles.clientWorkspace} testID="assist-budget-client-selector">
        <View style={styles.selectorHeading}>
          <View style={styles.selectorCopy}>
            <Text style={[styles.selectorTitle, { color: text.primary }]}>Klient:in auswählen</Text>
            <Text style={[styles.selectorSubtitle, { color: text.secondary }]}>
              Die Budgetwerte werden direkt aus dem persönlichen Abrechnungsprofil geladen.
            </Text>
          </View>
          {selectedClient ? (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeLabel}>AKTIVE AUSWAHL</Text>
              <Text style={styles.selectedBadgeName}>{selectedClient.firstName} {selectedClient.lastName}</Text>
            </View>
          ) : null}
        </View>

        <PremiumInput
          label="Klient:in suchen"
          value={search}
          onChangeText={setSearch}
          placeholder="Name oder Pflegegrad …"
        />

        {clientsQuery.loading && clients.length === 0 ? (
          <LoadingState message="Klient:innen und Budgets werden geladen …" />
        ) : clientsQuery.error && clients.length === 0 ? (
          <ErrorState message={clientsQuery.error} onRetry={clientsQuery.refresh} />
        ) : clients.length === 0 ? (
          <EmptyState
            title="Keine aktiven Klient:innen"
            message="Sobald ein aktiver Klient vorhanden ist, erscheint hier automatisch die Budgetübersicht."
          />
        ) : visibleClients.length === 0 ? (
          <EmptyState title="Kein Suchtreffer" message="Bitte prüfen Sie den eingegebenen Namen oder Pflegegrad." />
        ) : (
          <View style={styles.clientGrid}>
            {visibleClients.map((client) => {
              const selected = client.id === selectedClientId;
              const careLevel = client.careLevel?.replace(/[^0-9]/g, '') || client.careLevel;
              return (
                <Pressable
                  key={client.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedClientId(client.id)}
                  style={({ pressed }) => [
                    styles.clientCard,
                    selected && styles.clientCardSelected,
                    pressed && styles.clientCardPressed,
                  ]}
                >
                  <Text style={[styles.clientName, { color: text.primary }]}>{client.firstName} {client.lastName}</Text>
                  <Text style={[styles.clientMeta, { color: text.secondary }]}>
                    {careLevel ? `Pflegegrad ${careLevel}` : 'Pflegegrad nicht hinterlegt'}
                  </Text>
                  <Text style={[styles.clientAction, selected && styles.clientActionSelected]}>
                    {selected ? 'Budget geöffnet' : 'Budget öffnen'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {selectedClientId ? (
        <View testID="assist-budget-live-panel">
          <ClientCareGradeBudgetsPanel clientId={selectedClientId} onRecordRefresh={clientsQuery.refresh} />
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  clientWorkspace: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(78,181,255,0.25)',
    backgroundColor: 'rgba(7,31,67,0.76)',
  },
  selectorHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectorCopy: { flex: 1, minWidth: 260 },
  selectorTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900' },
  selectorSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 19 },
  selectedBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: 'rgba(59,231,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,231,255,0.28)',
  },
  selectedBadgeLabel: {
    color: 'rgba(186,230,253,0.75)',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  selectedBadgeName: { color: '#FFFFFF', marginTop: 2, fontSize: 14, lineHeight: 19, fontWeight: '900' },
  clientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  clientCard: {
    minWidth: 210,
    flexGrow: 1,
    flexBasis: 240,
    maxWidth: 360,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.20)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  clientCardSelected: { borderColor: '#3BE7FF', backgroundColor: 'rgba(59,231,255,0.10)' },
  clientCardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  clientName: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  clientMeta: { marginTop: 4, fontSize: 12, lineHeight: 17 },
  clientAction: { marginTop: spacing.sm, color: '#7DD3FC', fontSize: 11, lineHeight: 16, fontWeight: '800' },
  clientActionSelected: { color: '#65F2A7' },
});
