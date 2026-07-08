import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformShellLayout, PLATFORM_COLORS } from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import { getPlatformReleaseInfo, listPlatformSystemSettings } from '@/lib/platformConsole';
import { spacing } from '@/theme';

export function PlatformSystemScreen() {
  const [settings, setSettings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listPlatformSystemSettings();
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setSettings(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PlatformShellLayout title="System" subtitle="Globale Einstellungen und Wartungsmodus">
      {loading ? (
        <LoadingState message="Systemeinstellungen werden geladen…" />
      ) : error ? (
        <ErrorState title="System nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {settings.map((s) => (
            <View key={String(s.setting_key)} style={styles.row}>
              <Text style={styles.key}>{String(s.setting_key)}</Text>
              <Text style={styles.value}>{JSON.stringify(s.value)}</Text>
              {s.description ? <Text style={styles.desc}>{String(s.description)}</Text> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </PlatformShellLayout>
  );
}

export function PlatformReleasesScreen() {
  const info = getPlatformReleaseInfo();
  return (
    <PlatformShellLayout title="Releases" subtitle="Build-, Environment- und Migrationshinweise (ohne Secrets)">
      <View style={styles.list}>
        <InfoCard label="Environment" value={info.environment} />
        <InfoCard label="Demo Mode" value={info.demoMode ? 'Ja' : 'Nein'} />
        <InfoCard label="Supabase URL" value={info.supabaseUrlMasked} />
        <InfoCard label="Build" value={info.buildHint} />
        <Text style={styles.note}>
          Migrationsstatus und Smoke-Prüfungen werden über CI/Deploy-Pipeline gepflegt — keine Secrets in der UI.
        </Text>
      </View>
    </PlatformShellLayout>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
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
  key: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  value: { color: PLATFORM_COLORS.text, fontSize: 15, fontWeight: '600' },
  desc: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  note: { color: PLATFORM_COLORS.muted, fontSize: 12, marginTop: spacing.md },
});
