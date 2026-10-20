import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import {
  listPlatformOperatorUsers,
  platformRoleHasCapability,
  PLATFORM_ROLE_LABELS,
  updatePlatformOperatorUser,
} from '@/lib/platformConsole';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import type { PlatformOperatorUserRow, PlatformRoleKey, PlatformUserStatus } from '@/types/platformConsole';
import { spacing } from '@/theme';

const ROLES = Object.keys(PLATFORM_ROLE_LABELS) as PlatformRoleKey[];
const STATUSES: PlatformUserStatus[] = ['active', 'disabled', 'revoked'];
const STATUS_LABELS: Record<PlatformUserStatus, string> = {
  active: 'Aktiv',
  disabled: 'Deaktiviert',
  revoked: 'Zugriff entzogen',
};

function dateLabel(value: string | null) {
  if (!value) return 'Noch nie';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function PlatformUsersScreen() {
  const { platformUser } = usePlatformAuth();
  const canWrite = platformRoleHasCapability(platformUser?.role, 'users.write');
  const [users, setUsers] = useState<PlatformOperatorUserRow[]>([]);
  const [selected, setSelected] = useState<PlatformOperatorUserRow | null>(null);
  const [role, setRole] = useState<PlatformRoleKey>('platform_readonly');
  const [status, setStatus] = useState<PlatformUserStatus>('active');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [auditAction, setAuditAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listPlatformOperatorUsers();
    if (!result.ok) setError(result.error);
    else {
      setUsers(result.data);
      setSelected((current) => current ? result.data.find((item) => item.id === current.id) ?? null : null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = useMemo(() => [
    { key: 'person', label: 'Benutzer:in', flex: 2, minWidth: 220, render: (item: PlatformOperatorUserRow) => (
      <View><Text style={styles.strong}>{item.full_name || 'Ohne Namen'}</Text><Text style={styles.muted}>{item.email}</Text></View>
    ) },
    { key: 'role', label: 'Rolle', flex: 1, minWidth: 155, render: (item: PlatformOperatorUserRow) => PLATFORM_ROLE_LABELS[item.role] },
    { key: 'status', label: 'Status', width: 145, render: (item: PlatformOperatorUserRow) => <PlatformStatusBadge status={item.status} label={STATUS_LABELS[item.status]} /> },
    { key: 'last', label: 'Letzter Login', flex: 1, minWidth: 170, render: (item: PlatformOperatorUserRow) => dateLabel(item.last_login_at) },
  ], []);

  function choose(item: PlatformOperatorUserRow) {
    setSelected(item);
    setRole(item.role);
    setStatus(item.status);
  }

  return (
    <PlatformShellLayout title="Benutzer & Rollen" subtitle="Plattformzugriffe nach dem Prinzip der minimalen Berechtigung verwalten">
      {!canWrite ? <PlatformReadOnlyBanner message="Lesemodus — nur Platform Owner dürfen Rollen und Zugriffe ändern." /> : null}
      {loading ? <LoadingState message="Plattformbenutzer werden geladen…" /> : error ? (
        <ErrorState title="Benutzerverwaltung nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summary}>
            <View><Text style={styles.summaryValue}>{users.length}</Text><Text style={styles.muted}>Benutzer insgesamt</Text></View>
            <View><Text style={styles.summaryValue}>{users.filter((item) => item.status === 'active').length}</Text><Text style={styles.muted}>Aktive Zugriffe</Text></View>
            <View><Text style={styles.summaryValue}>{users.filter((item) => item.role === 'platform_owner' && item.status === 'active').length}</Text><Text style={styles.muted}>Aktive Owner</Text></View>
          </View>
          <PlatformDataTable
            columns={columns}
            data={users}
            keyExtractor={(item) => item.id}
            selectedId={selected?.id}
            onRowPress={choose}
            emptyTitle="Keine Plattformbenutzer"
            emptyMessage="Für dieses Projekt wurden noch keine Betreiberzugriffe eingerichtet."
          />

          {selected ? (
            <View style={styles.panel}>
              <View><Text style={styles.panelTitle}>Zugriff bearbeiten</Text><Text style={styles.muted}>{selected.full_name || selected.email}</Text></View>
              <PlatformFormField label="Rolle" required hint="Die Rolle bestimmt den vollständigen Funktionsumfang im Platform Console.">
                <View style={styles.options}>{ROLES.map((item) => (
                  <Pressable key={item} style={[styles.option, role === item && styles.optionActive]} onPress={() => canWrite && setRole(item)} disabled={!canWrite}>
                    <Text style={[styles.optionText, role === item && styles.optionTextActive]}>{PLATFORM_ROLE_LABELS[item]}</Text>
                  </Pressable>
                ))}</View>
              </PlatformFormField>
              <PlatformFormField label="Zugriffsstatus" required hint="Entzogen ist endgültiger als deaktiviert und bleibt im Audit nachvollziehbar.">
                <View style={styles.options}>{STATUSES.map((item) => (
                  <Pressable key={item} style={[styles.option, status === item && styles.optionActive]} onPress={() => canWrite && setStatus(item)} disabled={!canWrite}>
                    <Text style={[styles.optionText, status === item && styles.optionTextActive]}>{STATUS_LABELS[item]}</Text>
                  </Pressable>
                ))}</View>
              </PlatformFormField>
              {canWrite ? (
                <Pressable
                  style={[styles.primary, role === selected.role && status === selected.status && styles.disabled]}
                  disabled={role === selected.role && status === selected.status}
                  onPress={() => setConfirmOpen(true)}
                ><Text style={styles.primaryText}>Änderung prüfen und speichern</Text></Pressable>
              ) : null}
            </View>
          ) : null}
          {auditAction ? <PlatformAuditLink action={auditAction} label="Änderung im Audit anzeigen" /> : null}
        </ScrollView>
      )}
      <PlatformConfirmModal
        visible={confirmOpen}
        title="Plattformzugriff ändern"
        description={`Rolle und Status für ${selected?.email ?? 'diesen Benutzer'} werden geändert. Diese Aktion wird protokolliert.`}
        confirmLabel="Zugriff ändern"
        danger={status !== 'active'}
        loading={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={(reason) => {
          if (!selected) return;
          setSaving(true);
          void updatePlatformOperatorUser(selected.id, role, status, reason).then((result) => {
            if (!result.ok) throw new Error(result.error);
            setAuditAction('platform.user_updated');
            setConfirmOpen(false);
            return load();
          }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Zugriff konnte nicht geändert werden.')).finally(() => setSaving(false));
        }}
      />
    </PlatformShellLayout>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, padding: spacing.md, borderRadius: 14, backgroundColor: PLATFORM_COLORS.panel, borderWidth: 1, borderColor: PLATFORM_COLORS.border },
  summaryValue: { color: PLATFORM_COLORS.text, fontSize: 22, fontWeight: '800' },
  panel: { gap: spacing.md, padding: spacing.lg, borderRadius: 14, backgroundColor: PLATFORM_COLORS.panel, borderWidth: 1, borderColor: PLATFORM_COLORS.border },
  panelTitle: { color: PLATFORM_COLORS.text, fontSize: 18, fontWeight: '800' },
  strong: { color: PLATFORM_COLORS.text, fontWeight: '700' },
  muted: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  option: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, backgroundColor: PLATFORM_COLORS.panelSoft, borderWidth: 1, borderColor: PLATFORM_COLORS.border },
  optionActive: { backgroundColor: PLATFORM_COLORS.accentSoft, borderColor: PLATFORM_COLORS.accent },
  optionText: { color: PLATFORM_COLORS.muted, fontSize: 12, fontWeight: '600' },
  optionTextActive: { color: PLATFORM_COLORS.accent },
  primary: { alignSelf: 'flex-start', backgroundColor: PLATFORM_COLORS.accent, paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: 10 },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
