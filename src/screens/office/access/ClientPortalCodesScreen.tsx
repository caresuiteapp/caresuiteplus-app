import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AccessCredentialsPanel } from '@/components/auth/AccessCredentialsPanel';
import { AccessListHero } from '@/components/access';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useDemoData } from '@/hooks/useDemoData';
import type { AccessCredentialsReveal } from '@/lib/auth/auth.types';
import { createClientPortalAccess, listClientPortalCodes } from '@/lib/auth/accessManagementService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { colors, spacing, typography } from '@/theme';

export function ClientPortalCodesScreen() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [credentials, setCredentials] = useState<AccessCredentialsReveal | null>(null);
  const { data: codes, loading, error, refresh } = useDemoData(
    () => listClientPortalCodes(DEMO_TENANT_ID),
    [refreshKey],
  );

  const handleGenerate = async () => {
    const result = await createClientPortalAccess({
      clientId: `client-${Date.now().toString(36)}`,
    });
    if (result.ok) {
      setCredentials(result.data.credentials);
      setRefreshKey((value) => value + 1);
    }
  };

  if (credentials) {
    return (
      <ScreenShell title="Portal-Code erstellt" subtitle="Klient:innenportal" scroll>
        <AccessCredentialsPanel
          title="Portal-Code erstellt"
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      </ScreenShell>
    );
  }

  if (loading && !codes) {
    return (
      <ScreenShell title="Klient:innenportal" subtitle="Wird geladen…" scroll>
        <LoadingState message="Portal-Codes werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && !codes) {
    return (
      <ScreenShell title="Klient:innenportal" subtitle="Fehler" scroll>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const items = codes ?? [];

  return (
    <ScreenShell title="Klient:innenportal" subtitle="Zugänge & Benutzer" scroll key={refreshKey}>
      <AccessListHero variant="client-portal" itemCount={items.length} />
      <PremiumButton title="Klient:innen-Code generieren" fullWidth onPress={handleGenerate} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={<EmptyState title="Keine Portal-Codes" message="Generieren Sie den ersten Code." />}
        renderItem={({ item }) => (
          <PremiumCard accentColor={colors.gold}>
            <Text style={styles.title}>Klient: {item.clientId}</Text>
            <Text style={styles.meta}>Status: {item.status}</Text>
            {item.expiresAt ? (
              <Text style={styles.meta}>
                Gültig bis: {new Date(item.expiresAt).toLocaleDateString('de-DE')}
              </Text>
            ) : null}
          </PremiumCard>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary },
  separator: { height: spacing.sm },
});
