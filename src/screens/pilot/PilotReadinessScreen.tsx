import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { PilotReadinessHero } from '@/components/pilot';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SuccessState,
} from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import {
  fetchPilotReadinessSnapshot,
  getPilotChecklistCategoryLabel,
  loadPilotChecklistState,
  PILOT_CHECKLIST_TEMPLATE,
  runPilotDatevExportSmoke,
  togglePilotChecklistItem,
  type PilotChecklistState,
  type PilotReadinessSnapshot,
} from '@/lib/pilot';
import { PILOT_MILESTONE_ID, PILOT_TENANT_IDS, type PilotTenantId } from '@/lib/pilot/pilotConfig';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, typography } from '@/theme';

/** Live-Pilot Readiness — Checkliste rm-001 (3 ambulante Mandanten) */
export function PilotReadinessScreen() {
  const router = useRouter();
  const { colors } = useLegacyTheme();
  const { can, check, roleLabel } = usePermissions();
  const { profile } = useAuth();
  const [snapshot, setSnapshot] = useState<PilotReadinessSnapshot | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<PilotTenantId>(PILOT_TENANT_IDS[0]);
  const [checklist, setChecklist] = useState<PilotChecklistState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const snapResult = await fetchPilotReadinessSnapshot(profile?.roleKey);
    if (!snapResult.ok) {
      setError(snapResult.error);
      setLoading(false);
      return;
    }
    setSnapshot(snapResult.data);
    const state = await loadPilotChecklistState(selectedTenant);
    setChecklist(state);
    setLoading(false);
  }, [profile?.roleKey, selectedTenant]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = useCallback(
    async (itemId: string) => {
      setBusy(true);
      const next = await togglePilotChecklistItem(selectedTenant, itemId);
      setChecklist(next);
      setBusy(false);
      await refresh();
    },
    [selectedTenant, refresh],
  );

  const handleDatevSmoke = useCallback(async () => {
    setBusy(true);
    const result = await runPilotDatevExportSmoke(selectedTenant, profile?.roleKey);
    setBusy(false);
    if (result.ok) {
      setMessage(`DATEV-Export ${result.data.invoiceNumber} in Outbox (${result.data.outboxId}).`);
      await refresh();
      setTimeout(() => setMessage(null), 3000);
    } else {
      setError(result.error);
    }
  }, [selectedTenant, profile?.roleKey, refresh]);

  if (!can('roadmap.view')) {
    return (
      <ScreenShell title="Pilot-Readiness" subtitle={roleLabel ?? 'Betrieb'} showBack>
        <LockedActionBanner message={check('roadmap.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && !snapshot) {
    return (
      <ScreenShell title="Pilot-Readiness" subtitle={`Meilenstein ${PILOT_MILESTONE_ID}`} showBack>
        <LoadingState message="Pilot-Checkliste wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !snapshot) {
    return (
      <ScreenShell title="Pilot-Readiness" showBack>
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const tenantRow = snapshot!.tenants.find((t) => t.tenantId === selectedTenant);

  return (
    <ScreenShell
      title="Live-Pilot Readiness"
      subtitle={`${PILOT_MILESTONE_ID} · ${snapshot!.overallReadinessPercent}% gesamt`}
      showBack
      rightSlot={
        <PremiumButton
          title="Release"
          size="sm"
          variant="ghost"
          onPress={() => router.push('/business/release' as never)}
        />
      }
    >
      {message ? <SuccessState message={message} /> : null}
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        <PilotReadinessHero
          overallReadinessPercent={snapshot!.overallReadinessPercent}
          releaseGateLinked={snapshot!.releaseGateLinked}
          selectedTenantName={tenantRow?.name}
          selectedTenantPercent={tenantRow?.readinessPercent}
          selectedTenantPhase={tenantRow?.phase}
        />

        <Text style={styles.sectionTitle}>Pilot-Mandant wählen</Text>
        {snapshot!.tenants.map((t) => (
          <PremiumCard
            key={t.tenantId}
            accentColor={t.tenantId === selectedTenant ? colors.primary : colors.textMuted}
            onPress={() => setSelectedTenant(t.tenantId)}
          >
            <View style={styles.row}>
              <Text style={styles.title}>{t.name}</Text>
              <PremiumBadge label={`${t.readinessPercent}%`} variant="cyan" />
            </View>
            <Text style={styles.meta}>
              {t.checklistDone}/{t.checklistTotal} Pflichtpunkte · Phase: {t.phase}
            </Text>
          </PremiumCard>
        ))}

        <Text style={styles.sectionTitle}>Checkliste — {tenantRow?.name}</Text>
        {(['auth', 'clients', 'assignments', 'reporting', 'release_gates'] as const).map((category) => {
          const items = PILOT_CHECKLIST_TEMPLATE.filter((i) => i.category === category);
          if (!items.length) return null;
          return (
            <PremiumCard key={category} accentColor={colors.cyan}>
              <Text style={styles.sectionTitle}>{getPilotChecklistCategoryLabel(category)}</Text>
              {items.map((item) => {
                const done = checklist?.checkedIds.includes(item.id) ?? false;
                return (
                  <Pressable
                    key={item.id}
                    style={styles.checkRow}
                    onPress={() => handleToggle(item.id)}
                    disabled={busy}
                  >
                    <PremiumBadge label={done ? '✓' : '○'} variant={done ? 'green' : 'orange'} />
                    <View style={styles.checkText}>
                      <Text style={styles.checkLabel}>
                        {item.label}
                        {!item.required ? ' (optional)' : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {category === 'release_gates' ? (
                <PremiumButton
                  title="DATEV-Export Smoke-Test"
                  size="sm"
                  variant="secondary"
                  onPress={handleDatevSmoke}
                  disabled={busy || !can('integrations.manage')}
                />
              ) : null}
            </PremiumCard>
          );
        })}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.bodyStrong, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginBottom: 2 },
  checkRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm },
  checkText: { flex: 1 },
  checkLabel: { ...typography.body },
});
