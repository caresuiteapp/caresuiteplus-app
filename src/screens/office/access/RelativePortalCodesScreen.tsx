import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AccessCredentialsPanel } from '@/components/auth/AccessCredentialsPanel';
import { AccessListHero } from '@/components/access';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useDemoData } from '@/hooks/useDemoData';
import { useServiceTenantId } from '@/hooks/useTenantId';
import type { AccessCredentialsReveal } from '@/lib/auth/auth.types';
import { generateRelativePortalCode } from '@/lib/auth/relativePortalAuthService';
import { getRelativePortalCodes } from '@/lib/auth/demoAccessStore';
import { colors, spacing, typography } from '@/theme';

export function RelativePortalCodesScreen() {
  const tenantId = useServiceTenantId();
  const [refreshKey, setRefreshKey] = useState(0);
  const [credentials, setCredentials] = useState<AccessCredentialsReveal | null>(null);
  const { data: codes, loading, error, refresh } = useDemoData(
    () => {
      if (!tenantId) throw new Error('Kein Mandant.');
      return getRelativePortalCodes(tenantId);
    },
    [tenantId, refreshKey],
  );

  const handleGenerate = async () => {
    if (!tenantId) return;
    const result = await generateRelativePortalCode({
      tenantId,
      clientId: `client-${Date.now().toString(36)}`,
      createdBy: null,
    });
    if (result.ok) {
      setCredentials(result.data.credentials);
      setRefreshKey((value) => value + 1);
    }
  };

  if (!tenantId) {
    return (
      <ScreenShell title="Angehörigenportal" subtitle="Zugänge & Benutzer" scroll>
        <EmptyState title="Kein Mandant" message="Mandant konnte nicht aufgelöst werden." />
      </ScreenShell>
    );
  }

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

  if (loading && !codes) {
    return (
      <ScreenShell title="Angehörigenportal" subtitle="Wird geladen…" scroll>
        <LoadingState message="Angehörigen-Codes werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && !codes) {
    return (
      <ScreenShell title="Angehörigenportal" subtitle="Fehler" scroll>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const items = codes ?? [];

  return (
    <ScreenShell title="Angehörigenportal" subtitle="Zugänge & Benutzer" scroll key={refreshKey}>
      <AccessListHero variant="relative-portal" itemCount={items.length} />
      <PremiumButton title="Angehörigen-Code generieren" fullWidth onPress={handleGenerate} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={<EmptyState title="Keine Angehörigen-Codes" message="Generieren Sie den ersten Code." />}
        renderItem={({ item }) => (
          <PremiumCard accentColor={colors.gold}>
            <Text style={styles.title}>Klient: {item.clientId}</Text>
            <Text style={styles.meta}>Kontakt: {item.relativeContactId}</Text>
            <Text style={styles.meta}>Status: {item.status}</Text>
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
