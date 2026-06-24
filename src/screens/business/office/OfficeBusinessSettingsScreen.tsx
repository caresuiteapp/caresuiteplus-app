import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchOfficeSettingsSnapshot } from '@/lib/office/officeBusinessSettingsService';
import { spacing, typography } from '@/theme';

export function OfficeBusinessSettingsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const officeAccent = moduleColor('office');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeSettingsSnapshot(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Office Einstellungen" subtitle="Wird geladen…">
        <LoadingState message="Einstellungen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Office Einstellungen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const snapshot = query.data;
  if (!snapshot || snapshot.links.length === 0) {
    return (
      <ScreenShell title="Office Einstellungen" subtitle="Leer">
        <EmptyState title="Keine Einstellungsbereiche" message="Konfiguration ist im Demo-Mandanten nicht verfügbar." />
      </ScreenShell>
    );
  }

  return (
    <C14vSubpageShell
      title="Office Einstellungen"
      eyebrow="OFFICE · KONFIGURATION"
      subtitle={`${snapshot.tenantLabel} · ${roleLabel ?? 'Demo'}`}
      moduleLabel="Office"
      accentColor={officeAccent}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionPanel title="Einstellungsbereiche">
          <Text style={styles.lead}>Zentrale Office-Konfiguration — direkte Navigation zu Fachbereichen.</Text>
          {snapshot.links.map((link) => (
            <PremiumButton
              key={link.id}
              title={link.label}
              variant="secondary"
              onPress={() => router.push(link.route as never)}
            />
          ))}
        </SectionPanel>
      </ScrollView>
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.sm },
  lead: { ...typography.body, marginBottom: spacing.sm },
});
