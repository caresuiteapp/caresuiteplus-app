import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchPermissionAuditHistory,
  fetchRoleMatrixForRole,
  fetchRoleMatrixOverview,
  getPermissionAreaLabel,
  PERMISSION_ACTIONS,
  PERMISSION_AREAS,
  previewRoleMatrixChange,
  restoreRoleDefaults,
  saveRoleMatrix,
  type PermissionAction,
  type PermissionAreaKey,
  type RoleAreaMatrix,
} from '@/lib/permissions';
import type { CanonicalWorkspaceRoleKey } from '@/types/permissions/workspace';
import { colors, spacing, typography } from '@/theme';

function cloneMatrix(matrix: RoleAreaMatrix): RoleAreaMatrix {
  return JSON.parse(JSON.stringify(matrix)) as RoleAreaMatrix;
}

export function RolePermissionsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [selectedRole, setSelectedRole] = useState<CanonicalWorkspaceRoleKey>('owner');
  const [draftMatrix, setDraftMatrix] = useState<RoleAreaMatrix | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);

  const overviewQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchRoleMatrixOverview(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const roleQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchRoleMatrixForRole(tenantId, selectedRole, profile?.roleKey);
    },
    [tenantId, selectedRole, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const auditQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchPermissionAuditHistory(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const activeMatrix = draftMatrix ?? roleQuery.data?.areaPermissions ?? null;

  const selectedEntry = useMemo(
    () => overviewQuery.data?.find((r) => r.roleKey === selectedRole),
    [overviewQuery.data, selectedRole],
  );

  function togglePermission(area: PermissionAreaKey, action: PermissionAction) {
    if (!activeMatrix) return;
    const next = cloneMatrix(activeMatrix);
    next[area][action] = !next[area][action];
    setDraftMatrix(next);
    setSaveMessage(null);
  }

  async function handlePreview() {
    if (!tenantId || !activeMatrix) return;
    const preview = previewRoleMatrixChange(tenantId, selectedRole, activeMatrix);
    setPreviewText(
      [
        preview.warnings.length ? preview.warnings.join(' ') : 'Keine Warnungen.',
        preview.grantedAreas.length
          ? `Neu: ${preview.grantedAreas.map(getPermissionAreaLabel).join(', ')}`
          : null,
        preview.revokedAreas.length
          ? `Entzogen: ${preview.revokedAreas.map(getPermissionAreaLabel).join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  async function handleSave() {
    if (!tenantId || !activeMatrix) return;
    const result = await saveRoleMatrix(
      {
        tenantId,
        roleKey: selectedRole,
        areaPermissions: activeMatrix,
        actorUserId: profile?.id ?? null,
        actorRoleKey: selectedRole,
        confirmHealthData: true,
        confirmBillingOverride: true,
      },
      profile?.roleKey,
    );
    if (result.ok) {
      setSaveMessage('Rechte gespeichert — wirksam ab sofort.');
      setDraftMatrix(null);
      roleQuery.refresh();
      auditQuery.refresh();
    } else {
      setSaveMessage(result.error);
    }
  }

  async function handleRestore() {
    if (!tenantId) return;
    const result = await restoreRoleDefaults(
      tenantId,
      selectedRole,
      profile?.id ?? null,
      profile?.roleKey,
    );
    if (result.ok) {
      setDraftMatrix(null);
      roleQuery.refresh();
      auditQuery.refresh();
      setSaveMessage('Standardrechte wiederhergestellt.');
    }
  }

  if ((overviewQuery.loading || roleQuery.loading) && !activeMatrix) {
    return (
      <ScreenShell title="Rollen & Rechte" subtitle="Wird geladen…" scroll>
        <LoadingState message="Rollenmatrix wird geladen…" />
      </ScreenShell>
    );
  }

  if ((overviewQuery.error || roleQuery.error) && !activeMatrix) {
    return (
      <ScreenShell title="Rollen & Rechte" subtitle="Fehler" scroll>
        <ErrorState message={overviewQuery.error ?? roleQuery.error ?? 'Fehler'} onRetry={overviewQuery.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Rollen & Rechte" subtitle="Verwaltung · Rechtematrix" scroll>
      <SectionPanel title="Rollenübersicht">
        <View style={styles.roleRow}>
          {(overviewQuery.data ?? []).map((entry) => (
            <Pressable
              key={entry.roleKey}
              onPress={() => {
                setSelectedRole(entry.roleKey);
                setDraftMatrix(null);
                setSaveMessage(null);
              }}
              style={[styles.roleChip, selectedRole === entry.roleKey && styles.roleChipActive]}
            >
              <Text style={styles.roleChipText}>{entry.label}</Text>
              {entry.isSystemRole ? <Text style={styles.systemBadge}>System</Text> : null}
            </Pressable>
          ))}
        </View>
      </SectionPanel>

      {selectedEntry ? (
        <SectionPanel title={`Matrix: ${selectedEntry.label}`}>
          {PERMISSION_AREAS.map((area) => (
            <PremiumCard key={area.key} accentColor={colors.cyan}>
              <Text style={styles.areaTitle}>{area.label}</Text>
              <Text style={styles.areaMeta}>{area.description}</Text>
              <View style={styles.actionRow}>
                {PERMISSION_ACTIONS.map((action) => {
                  const enabled = activeMatrix?.[area.key]?.[action.key] ?? false;
                  return (
                    <Pressable
                      key={action.key}
                      onPress={() => togglePermission(area.key, action.key)}
                      style={[styles.actionChip, enabled && styles.actionChipOn]}
                    >
                      <Text style={styles.actionChipText}>
                        {action.label}: {enabled ? 'ja' : 'nein'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </PremiumCard>
          ))}
        </SectionPanel>
      ) : null}

      <SectionPanel title="Aktionen">
        <View style={styles.actions}>
          <PremiumButton title="Auswirkung anzeigen" onPress={handlePreview} />
          <PremiumButton title="Speichern" onPress={handleSave} />
          <PremiumButton title="Standard wiederherstellen" variant="secondary" onPress={handleRestore} />
        </View>
        {previewText ? <Text style={styles.message}>{previewText}</Text> : null}
        {saveMessage ? <Text style={styles.message}>{saveMessage}</Text> : null}
      </SectionPanel>

      <SectionPanel title="Audit-Verlauf">
        {(auditQuery.data ?? []).length === 0 ? (
          <EmptyState title="Keine Änderungen" message="Noch keine Rechteänderungen protokolliert." />
        ) : (
          (auditQuery.data ?? []).slice(0, 8).map((event) => (
            <PremiumCard key={event.id} accentColor={colors.orange}>
              <Text style={styles.auditSummary}>{event.summary}</Text>
              <Text style={styles.areaMeta}>{new Date(event.createdAt).toLocaleString('de-DE')}</Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roleChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleChipActive: { borderColor: colors.orange, backgroundColor: colors.bgElevated },
  roleChipText: { ...typography.caption },
  systemBadge: { ...typography.caption, color: colors.textSecondary },
  areaTitle: { ...typography.bodyStrong, marginBottom: spacing.xs },
  areaMeta: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actionChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionChipOn: { borderColor: colors.cyan, backgroundColor: colors.bgElevated },
  actionChipText: { ...typography.caption },
  actions: { gap: spacing.sm },
  message: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  auditSummary: { ...typography.bodyStrong },
});
