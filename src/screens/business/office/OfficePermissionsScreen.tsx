import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchModuleAssignmentList } from '@/lib/officeModules/moduleAssignmentService';
import { PRODUCT_LABELS } from '@/data/demo/products';
import type { ProductKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

export function OfficePermissionsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<ProductKey | 'all'>('all');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchModuleAssignmentList(tenantId, 'permissions', profile?.roleKey, {
        search,
        moduleKey: moduleFilter === 'all' ? null : moduleFilter,
      });
    },
    [tenantId, profile?.roleKey, search, moduleFilter],
    { enabled: !!tenantId },
  );

  const moduleOptions = useMemo(
    () => [
      { key: 'all', label: 'Alle Module' },
      ...(['assist', 'pflege', 'beratung', 'stationaer', 'akademie', 'office'] as ProductKey[]).map((key) => ({
        key,
        label: PRODUCT_LABELS[key].replace('CareSuite+ ', ''),
      })),
    ],
    [],
  );

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Berechtigungen" subtitle="Wird geladen…">
        <LoadingState message="Berechtigungsprofile werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Berechtigungen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  const items = query.data ?? [];

  return (
    <CareLightPageShell title="Berechtigungen" subtitle={`Office · ${roleLabel ?? 'Demo'}`}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionPanel title="Modul-Berechtigungsprofile">
          <PremiumInput label="Suche" value={search} onChangeText={setSearch} placeholder="Profil oder Modul…" />
          <FilterChipGroup
            options={moduleOptions}
            value={moduleFilter}
            onChange={(value) => setModuleFilter(value as ProductKey | 'all')}
          />
          {items.length === 0 ? (
            <EmptyState title="Keine Profile" message="Passen Sie Filter oder Modulzuordnungen an." />
          ) : (
            items.map((item) => (
              <PremiumCard key={item.id} style={styles.card}>
                <Text style={styles.primary}>{item.title}</Text>
                <Text style={styles.secondary}>{item.subtitle}</Text>
                {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
              </PremiumCard>
            ))
          )}
        </SectionPanel>
        <PremiumButton title="Rollen & Rechte" onPress={() => router.push('/business/office/access/roles' as never)} />
        <PremiumButton
          title="Modulrechte pro Benutzer"
          variant="secondary"
          onPress={() => router.push('/business/office/access/module-permissions' as never)}
        />
        <PremiumButton
          title="Modulzuordnungen"
          variant="secondary"
          onPress={() => router.push('/business/office/modules' as never)}
        />
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  card: { marginBottom: spacing.sm },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  meta: { ...typography.caption, marginTop: spacing.xs },
});
