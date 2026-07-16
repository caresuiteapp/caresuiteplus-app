import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  PlatformAuditLink,
  PlatformConfirmModal,
  PlatformDataTable,
  PlatformFormField,
  PlatformReadOnlyBanner,
  PlatformShellLayout,
  PlatformStatusBadge,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import { listPlatformReleases, listPlatformSystemSettings, platformRoleHasCapability, registerPlatformRelease, updatePlatformSystemSetting, getPlatformReleaseInfo } from '@/lib/platformConsole';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import type { PlatformReleaseRow } from '@/types/platformConsole';
import { spacing } from '@/theme';

function maskSettingValue(key: string, value: unknown): string {
  const sensitive = /secret|token|password|api_key|private/i.test(key);
  if (sensitive) return '••••••••';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '—');
}

const SETTING_LABELS: Record<string, string> = {
  maintenance_mode: 'Wartungsmodus',
  default_trial_days: 'Standard-Testzeitraum (Tage)',
  support_session_minutes: 'Support-Sitzung (Minuten)',
  invoice_due_days: 'Zahlungsziel (Tage)',
  platform_notice: 'Plattformhinweis',
};

function settingLabel(key: string) {
  return SETTING_LABELS[key] ?? key.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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
                <Text style={styles.key}>{settingLabel(key)}</Text>
                <Text style={styles.value}>{maskSettingValue(key, s.value)}</Text>
                {s.description ? <Text style={styles.desc}>{String(s.description)}</Text> : null}
                {canWrite && !sensitive ? <Text style={styles.link}>Bearbeiten</Text> : null}
              </Pressable>
            );
          })}

          {canWrite && editKey && !isSensitive ? (
            <View style={styles.formPanel}>
              <Text style={styles.sectionTitle}>Einstellung bearbeiten: {settingLabel(editKey)}</Text>
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
  const { platformUser } = usePlatformAuth();
  const canWrite = platformRoleHasCapability(platformUser?.role, 'system.write');
  const info = getPlatformReleaseInfo();
  const [items, setItems] = useState<PlatformReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [environment, setEnvironment] = useState<PlatformReleaseRow['environment']>('production');
  const [status, setStatus] = useState<PlatformReleaseRow['status']>('ready');
  const [version, setVersion] = useState('');
  const [commit, setCommit] = useState('');
  const [url, setUrl] = useState('');
  const [migration, setMigration] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listPlatformReleases();
    if (!result.ok) setError(result.error);
    else setItems(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = useMemo(() => [
    { key: 'version', label: 'Version', minWidth: 145, render: (item: PlatformReleaseRow) => item.version_label },
    { key: 'environment', label: 'Umgebung', width: 120, render: (item: PlatformReleaseRow) => item.environment === 'production' ? 'Produktion' : item.environment === 'staging' ? 'Staging' : 'Vorschau' },
    { key: 'status', label: 'Status', width: 130, render: (item: PlatformReleaseRow) => <PlatformStatusBadge status={item.status} /> },
    { key: 'commit', label: 'Commit', minWidth: 120, render: (item: PlatformReleaseRow) => item.commit_sha?.slice(0, 12) || '—' },
    { key: 'migration', label: 'Migration', minWidth: 130, render: (item: PlatformReleaseRow) => item.migration_version || 'Keine' },
    { key: 'date', label: 'Bereitgestellt', minWidth: 170, render: (item: PlatformReleaseRow) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.deployed_at)) },
  ], []);

  const valid = version.trim().length >= 2;
  return (
    <PlatformShellLayout title="Releases" subtitle="Deployments, Datenbankstände und Prüfergebnisse nachvollziehbar dokumentieren">
      {!canWrite ? <PlatformReadOnlyBanner message="Lesemodus — Release-Registrierung erfordert system.write." /> : null}
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.releaseSummary}>
          <InfoCard label="Aktuelle Umgebung" value={info.environment} />
          <InfoCard label="Build-Konfiguration" value={info.buildHint} />
          <InfoCard label="Datenverbindung" value={info.supabaseUrlMasked} />
        </View>
        {loading ? <LoadingState message="Releaseverlauf wird geladen…" /> : error ? <ErrorState title="Releases nicht verfügbar" message={error} onRetry={() => void load()} /> : (
          <PlatformDataTable columns={columns} data={items} keyExtractor={(item) => item.id} emptyTitle="Noch keine Releases registriert" emptyMessage="Das nächste Deployment kann hier revisionssicher erfasst werden." />
        )}
        {canWrite ? (
          <View style={styles.formPanel}>
            <Text style={styles.sectionTitle}>Deployment registrieren</Text>
            <Text style={styles.desc}>Das Deployment selbst wird durch die Pipeline ausgeführt. Hier wird der geprüfte Stand nachvollziehbar festgehalten.</Text>
            <PlatformFormField label="Version oder Release-Name" required><TextInput style={styles.compactInput} value={version} onChangeText={setVersion} placeholder="z. B. 2026.07.16-2" placeholderTextColor={PLATFORM_COLORS.muted} /></PlatformFormField>
            <PlatformFormField label="Umgebung" required><View style={styles.choiceRow}>{(['preview', 'staging', 'production'] as const).map((item) => <Choice key={item} selected={environment === item} label={item === 'production' ? 'Produktion' : item === 'staging' ? 'Staging' : 'Vorschau'} onPress={() => setEnvironment(item)} />)}</View></PlatformFormField>
            <PlatformFormField label="Ergebnis" required><View style={styles.choiceRow}>{(['planned', 'building', 'ready', 'failed', 'rolled_back'] as const).map((item) => <Choice key={item} selected={status === item} label={item === 'ready' ? 'Bereit' : item === 'failed' ? 'Fehlgeschlagen' : item === 'rolled_back' ? 'Zurückgesetzt' : item === 'building' ? 'Wird gebaut' : 'Geplant'} onPress={() => setStatus(item)} />)}</View></PlatformFormField>
            <View style={styles.formGrid}>
              <PlatformFormField label="Git-Commit" hint="Kurz- oder Vollhash"><TextInput style={styles.compactInput} value={commit} onChangeText={setCommit} placeholder="z. B. 58046ca7" placeholderTextColor={PLATFORM_COLORS.muted} /></PlatformFormField>
              <PlatformFormField label="Datenbankmigration"><TextInput style={styles.compactInput} value={migration} onChangeText={setMigration} placeholder="z. B. 0258" placeholderTextColor={PLATFORM_COLORS.muted} /></PlatformFormField>
            </View>
            <PlatformFormField label="Deployment-URL"><TextInput style={styles.compactInput} value={url} onChangeText={setUrl} placeholder="https://…" placeholderTextColor={PLATFORM_COLORS.muted} autoCapitalize="none" /></PlatformFormField>
            <PlatformFormField label="Prüfnotiz"><TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Build, Migration und Smoke-Test zusammenfassen" placeholderTextColor={PLATFORM_COLORS.muted} multiline /></PlatformFormField>
            <Pressable style={[styles.primaryBtn, !valid && styles.disabled]} disabled={!valid} onPress={() => setConfirmOpen(true)}><Text style={styles.primaryBtnText}>Release prüfen und registrieren</Text></Pressable>
          </View>
        ) : null}
      </ScrollView>
      <PlatformConfirmModal
        visible={confirmOpen}
        title="Release registrieren"
        description={`${version || 'Dieses Release'} wird für ${environment} mit Status ${status} dokumentiert.`}
        confirmLabel="Release registrieren"
        loading={saving}
        danger={status === 'failed' || status === 'rolled_back'}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={(reason) => {
          setSaving(true);
          void registerPlatformRelease({ environment, version_label: version.trim(), commit_sha: commit.trim() || null, status, deployment_url: url.trim() || null, migration_version: migration.trim() || null, notes: notes.trim() || null, checks: { build: status === 'ready', recorded_in_console: true } }, reason).then((result) => {
            if (!result.ok) throw new Error(result.error);
            setVersion(''); setCommit(''); setUrl(''); setMigration(''); setNotes(''); setConfirmOpen(false);
            return load();
          }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Release konnte nicht registriert werden.')).finally(() => setSaving(false));
        }}
      />
    </PlatformShellLayout>
  );
}

function Choice({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return <Pressable style={[styles.choice, selected && styles.choiceActive]} onPress={onPress}><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text></Pressable>;
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
  releaseSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.accent,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  primaryBtnText: { color: PLATFORM_COLORS.accent, fontWeight: '700' },
  link: { color: PLATFORM_COLORS.accent, fontWeight: '600', fontSize: 12 },
  compactInput: { borderWidth: 1, borderColor: PLATFORM_COLORS.border, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 10, color: PLATFORM_COLORS.text, backgroundColor: PLATFORM_COLORS.bg },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: PLATFORM_COLORS.border, backgroundColor: PLATFORM_COLORS.panelSoft },
  choiceActive: { borderColor: PLATFORM_COLORS.accent, backgroundColor: PLATFORM_COLORS.accentSoft },
  choiceText: { color: PLATFORM_COLORS.muted, fontSize: 12, fontWeight: '600' },
  choiceTextActive: { color: PLATFORM_COLORS.accent },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  disabled: { opacity: 0.45 },
});
