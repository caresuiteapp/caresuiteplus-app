import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformShellLayout, PLATFORM_COLORS } from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import { listPlatformModules, listPlatformPlans } from '@/lib/platformConsole';
import { spacing } from '@/theme';

export function PlatformModulesCatalogScreen() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listPlatformModules();
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setItems(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PlatformShellLayout title="Module" subtitle="Modulverzeichnis — Plan-Zuordnung über Tarife, Mandanten-Overrides im Mandantendetail">
      {loading ? (
        <LoadingState message="Module werden geladen…" />
      ) : error ? (
        <ErrorState title="Module nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.note}>
            Globale Modulstatus-Änderungen (beta/coming_soon) erfordern platform_update_module_status (2.0C).
            Plan-Module: /platform/plans · Mandanten-Overrides: Mandantendetail → Module.
          </Text>
          {items.map((mod) => (
            <View key={String(mod.module_key)} style={styles.row}>
              <Text style={styles.title}>{String(mod.module_name ?? mod.module_key)}</Text>
              <Text style={styles.meta}>
                {String(mod.module_key)} · {String(mod.status ?? 'available')}
                {mod.is_beta ? ' · Beta' : ''}
                {mod.is_internal ? ' · Intern' : ''}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </PlatformShellLayout>
  );
}

export function PlatformPlansScreen() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listPlatformPlans();
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setItems(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PlatformShellLayout title="Tarife" subtitle="Plattform-Tarife und enthaltene Module">
      {loading ? (
        <LoadingState message="Tarife werden geladen…" />
      ) : error ? (
        <ErrorState title="Tarife nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((plan) => (
            <View key={String(plan.plan_key)} style={styles.row}>
              <Text style={styles.title}>{String(plan.plan_name ?? plan.plan_key)}</Text>
              <Text style={styles.meta}>
                {String(plan.plan_key)} · {(Number(plan.monthly_price_cents) / 100).toFixed(2)} €/Monat
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </PlatformShellLayout>
  );
}

export function PlatformPlaceholderScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <PlatformShellLayout title={title} subtitle={subtitle}>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Bereich vorbereitet — Daten werden über gesicherte Platform-RPCs geladen.
        </Text>
      </View>
    </PlatformShellLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: {
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: 4,
  },
  title: { color: PLATFORM_COLORS.text, fontWeight: '600', fontSize: 15 },
  meta: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  note: { color: PLATFORM_COLORS.muted, fontSize: 12, marginBottom: spacing.sm, lineHeight: 18 },
  placeholder: {
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 10,
    padding: spacing.lg,
  },
  placeholderText: { color: PLATFORM_COLORS.muted, fontSize: 14 },
});
