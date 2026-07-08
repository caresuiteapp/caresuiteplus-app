import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  PlatformAuditLink,
  PlatformConfirmModal,
  PlatformReadOnlyBanner,
  PlatformShellLayout,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import { listPlatformSystemSettings, platformRoleHasCapability, updatePlatformSystemSetting, getPlatformReleaseInfo } from '@/lib/platformConsole';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { spacing } from '@/theme';

function maskSettingValue(key: string, value: unknown): string {
  const sensitive = /secret|token|password|api_key|private/i.test(key);
  if (sensitive) return '••••••••';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '—');
}

export function PlatformSystemScreen() {
  const { platformUser } = usePlatformAuth();
  const canWrite = platformRoleHasCapability(platformUser?.role, 'system.write');
  const [settings, setSettings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; desc: string; action: (reason: string) => Promise<void> } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [lastAuditAction, setLastAuditAction] = useState<string | null>(null);

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

  const selected = settings.find((s) => String(s.setting_key) === editKey);
  const isSensitive = editKey ? /secret|token|password|api_key|private/i.test(editKey) : false;

  return (
    <PlatformShellLayout title="System" subtitle="Globale Einstellungen und Wartungsmodus">
      {!canWrite ? (
        <PlatformReadOnlyBanner message="Lesemodus — system.write erforderlich zum Ändern." />
      ) : null}
      {loading ? (
        <LoadingState message="Systemeinstellungen werden geladen…" />
      ) : error ? (
        <ErrorState title="System nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {settings.map((s) => {
            const key = String(s.setting_key);
            const sensitive = /secret|token|password|api_key|private/i.test(key);
            return (
              <Pressable
                key={key}
                style={styles.row}
                onPress={() => {
                  setEditKey(key);
                  if (!sensitive) setEditValue(JSON.stringify(s.value));
                }}
              >
                <Text style={styles.key}>{key}</Text>
                <Text style={styles.value}>{maskSettingValue(key, s.value)}</Text>
                {s.description ? <Text style={styles.desc}>{String(s.description)}</Text> : null}
                {canWrite && !sensitive ? <Text style={styles.link}>Bearbeiten</Text> : null}
              </Pressable>
            );
          })}

          {canWrite && editKey && !isSensitive ? (
            <View style={styles.formPanel}>
              <Text style={styles.sectionTitle}>Setting bearbeiten: {editKey}</Text>
              <TextInput
                style={styles.input}
                value={editValue}
                onChangeText={setEditValue}
                placeholder="JSON-Wert"
                placeholderTextColor={PLATFORM_COLORS.muted}
                multiline
              />
              <Pressable
                style={styles.primaryBtn}
                onPress={() =>
                  setConfirm({
                    title: 'System Setting ändern',
                    desc: `Kritische Änderung an „${editKey}". Grund ist Pflicht.`,
                    action: async (reason) => {
                      let parsed: unknown = editValue;
                      try {
                        parsed = JSON.parse(editValue);
                      } catch {
                        parsed = editValue;
                      }
                      const res = await updatePlatformSystemSetting(editKey, parsed, reason);
                      if (!res.ok) throw new Error(res.error);
                      setLastAuditAction('system.setting_changed');
                      await load();
                    },
                  })
                }
              >
                <Text style={styles.primaryBtnText}>Speichern</Text>
              </Pressable>
            </View>
          ) : null}

          {isSensitive && editKey ? (
            <Text style={styles.desc}>Sensitive Settings werden maskiert — kein Secret im UI.</Text>
          ) : null}

          {lastAuditAction ? <PlatformAuditLink action={lastAuditAction} label="Letzte Änderung im Audit" /> : null}
        </ScrollView>
      )}

      <PlatformConfirmModal
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.desc ?? ''}
        loading={confirmLoading}
        onCancel={() => setConfirm(null)}
        onConfirm={(reason) => {
          if (!confirm) return;
          setConfirmLoading(true);
          void confirm.action(reason).finally(() => {
            setConfirmLoading(false);
            setConfirm(null);
          });
        }}
      />
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
  formPanel: {
    marginTop: spacing.md,
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { color: PLATFORM_COLORS.text, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: PLATFORM_COLORS.text,
    backgroundColor: PLATFORM_COLORS.bg,
    minHeight: 80,
  },
  primaryBtn: {
    backgroundColor: '#132036',
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.accent,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  primaryBtnText: { color: PLATFORM_COLORS.accent, fontWeight: '700' },
  link: { color: PLATFORM_COLORS.accent, fontWeight: '600', fontSize: 12 },
});
