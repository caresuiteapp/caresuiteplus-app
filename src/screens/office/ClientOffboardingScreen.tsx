import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CareDateInput } from '@/components/inputs';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  completeClientOffboarding,
  fetchClientOffboardingSummary,
  generateClientOffboardingProtocol,
  lockClientOffboardingPortalAccess,
  markClientOffboardingAction,
  refreshClientOffboardingChecks,
  startClientOffboarding,
} from '@/lib/office/offboarding';
import type { ServiceResult } from '@/types';
import {
  CLIENT_OFFBOARDING_ACTION_LABELS,
  CLIENT_TERMINATION_KIND_LABELS,
  type ClientOffboardingActionKey,
  type ClientPortalClosureMode,
  type ClientTerminationKind,
} from '@/types/modules/clientOffboarding';
import { radius, spacing, typography } from '@/theme';

const TERMINATION_TYPES = Object.entries(CLIENT_TERMINATION_KIND_LABELS) as [ClientTerminationKind, string][];
const PORTAL_MODES: [ClientPortalClosureMode, string][] = [
  ['effective_date', 'Zum Beendigungsdatum'],
  ['immediate', 'Sofort sperren'],
  ['read_only_grace', 'Lesezugriff mit Nachfrist'],
];
const MANUAL_ACTIONS = new Set<ClientOffboardingActionKey>([
  'reassign_or_cancel_assignments',
  'complete_documentation',
  'collect_or_defer_signatures',
  'prepare_final_billing',
  'notify_client_or_representative',
  'notify_cost_bearer',
  'notify_authority_if_required',
  'export_case_documents',
]);

export function ClientOffboardingScreen({ clientId }: { clientId?: string } = {}) {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const id = clientId ?? routeId;
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const canManage = can('office.clients.status_change');
  const canView = canManage;
  const [terminationKind, setTerminationKind] = useState<ClientTerminationKind>('ordinary_by_client');
  const [noticeDate, setNoticeDate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [lastServiceDate, setLastServiceDate] = useState('');
  const [reasonCategory, setReasonCategory] = useState('Vertrag / Versorgung');
  const [internalReason, setInternalReason] = useState('');
  const [externalReason, setExternalReason] = useState('');
  const [portalClosureMode, setPortalClosureMode] = useState<ClientPortalClosureMode>('effective_date');
  const [portalGraceDate, setPortalGraceDate] = useState('');
  const [legalHold, setLegalHold] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  const query = useAsyncQuery(
    async () => {
      if (!tenantId || !id) return { ok: false as const, error: 'Klient:in oder Mandant fehlt.' };
      return fetchClientOffboardingSummary(tenantId, id);
    },
    [tenantId, id],
    { enabled: !!tenantId && !!id && canView },
  );

  useEffect(() => {
    const current = query.data?.case;
    if (!current || current.status === 'draft') return;
    setTerminationKind(current.terminationKind ?? 'ordinary_by_client');
    setNoticeDate(current.noticeDate ?? '');
    setEffectiveDate(current.effectiveDate ?? '');
    setLastServiceDate(current.lastServiceDate ?? '');
    setReasonCategory(current.reasonCategory ?? 'Vertrag / Versorgung');
    setInternalReason(current.internalReason ?? '');
    setExternalReason(current.externalReason ?? '');
    setPortalClosureMode(current.portalClosureMode);
    setPortalGraceDate(current.portalGraceUntil?.slice(0, 10) ?? '');
    setLegalHold(current.legalHold);
  }, [query.data]);

  const execute = async <T,>(key: string, success: string, action: () => Promise<ServiceResult<T>>) => {
    setBusy(key);
    setMessage(null);
    try {
      const result = await action();
      if (!result.ok) {
        setMessage({ type: 'danger', text: result.error });
        return;
      }
      setMessage({ type: 'success', text: success });
      await query.refresh();
    } catch (error) {
      setMessage({ type: 'danger', text: error instanceof Error ? error.message : 'Aktion fehlgeschlagen.' });
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return (
      <ScreenShell title="Kündigung / Offboarding" showBack onBack={() => router.back()}>
        <LockedActionBanner message={check('office.clients.status_change').reason ?? 'Keine Berechtigung für Kündigung und Offboarding.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }
  if (query.loading && !query.data) {
    return <ScreenShell title="Kündigung / Offboarding" showBack><LoadingState message="Offboarding-Akte wird geladen…" /></ScreenShell>;
  }
  if (query.error && !query.data) {
    return <ScreenShell title="Kündigung / Offboarding" showBack><ErrorState message={query.error} onRetry={query.refresh} /></ScreenShell>;
  }
  const summary = query.data;
  if (!summary) {
    return <ScreenShell title="Kündigung / Offboarding" showBack><EmptyState title="Keine Daten" message="Offboarding konnte nicht geladen werden." /></ScreenShell>;
  }
  const completed = summary.case.status === 'completed';

  return (
    <ScreenShell title="Kündigung / Offboarding" subtitle={summary.clientName} showBack onBack={() => router.back()} scroll>
      {message ? (
        <InfoBanner title={message.type === 'success' ? 'Gespeichert' : 'Aktion nicht möglich'} message={message.text} variant={message.type} presentation="inline" />
      ) : null}

      <SectionPanel title="Sichere Beendigung" subtitle={`${summary.progressPercent} % der Abschlussmaßnahmen erledigt`}>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${summary.progressPercent}%` }]} /></View>
        <InfoBanner
          title="Kein Löschen – vollständige Historie bleibt erhalten"
          message="Einsätze, Dokumentation, Unterschriften, Abrechnung, Nachrichten und Einwilligungen bleiben revisionssicher in der Klient:innenakte. Archivierung beendet nur die operative Nutzung."
          variant={completed ? 'success' : 'warning'}
          presentation="inline"
        />
      </SectionPanel>

      {!completed ? (
        <SectionPanel title="1. Kündigung erfassen" subtitle="Fristen, Gründe und letzter Leistungstag">
          <Text style={styles.label}>Art der Beendigung</Text>
          <View style={styles.choiceGrid}>
            {TERMINATION_TYPES.map(([key, label]) => <Choice key={key} label={label} selected={terminationKind === key} onPress={() => setTerminationKind(key)} />)}
          </View>
          <CareDateInput label="Zugang der Kündigung" value={noticeDate} onChange={setNoticeDate} viewContext="form" />
          <CareDateInput label="Beendigungsdatum" value={effectiveDate} onChange={setEffectiveDate} viewContext="form" />
          <CareDateInput label="Letzter geplanter Leistungstag" value={lastServiceDate} onChange={setLastServiceDate} viewContext="form" />
          <PremiumInput label="Grundkategorie" value={reasonCategory} onChangeText={setReasonCategory} onLightSurface viewContext="form" />
          <PremiumInput label="Interner, vollständiger Sachverhalt (Pflicht)" value={internalReason} onChangeText={setInternalReason} multiline onLightSurface viewContext="form" />
          <PremiumInput label="Sachliche Begründung für Klient:in / Vertretung" value={externalReason} onChangeText={setExternalReason} multiline onLightSurface viewContext="form" />
          <InfoBanner title="Sachlich und diskriminierungsfrei" message="Die externe Begründung beschreibt Vertrag, Versorgung und konkrete Abläufe – keine Diagnose und keine wertende Zuschreibung." presentation="inline" />
          <Text style={styles.label}>Klientenportal</Text>
          <View style={styles.choiceGrid}>
            {PORTAL_MODES.map(([key, label]) => <Choice key={key} label={label} selected={portalClosureMode === key} onPress={() => setPortalClosureMode(key)} />)}
          </View>
          {portalClosureMode === 'read_only_grace' ? <CareDateInput label="Portal-Nachfrist bis" value={portalGraceDate} onChange={setPortalGraceDate} viewContext="form" /> : null}
          <Choice label="Rechtliche Aufbewahrungssperre / Legal Hold" selected={legalHold} onPress={() => setLegalHold((value) => !value)} />
          {canManage ? (
            <PremiumButton
              title={summary.case.status === 'draft' ? 'Kündigung und Offboarding verbindlich starten' : 'Kündigungsdaten aktualisieren'}
              loading={busy === 'start'}
              disabled={!noticeDate || !effectiveDate || !reasonCategory.trim() || !internalReason.trim() || (terminationKind.includes('by_provider') && !externalReason.trim()) || (portalClosureMode === 'read_only_grace' && !portalGraceDate)}
              onPress={() => tenantId && id && execute('start', 'Kündigungs- und Offboardingakte wurde gespeichert.', () => startClientOffboarding({
                tenantId, clientId: id, terminationKind, noticeDate, effectiveDate, lastServiceDate: lastServiceDate || null,
                reasonCategory, internalReason, externalReason, portalClosureMode,
                portalGraceUntil: portalGraceDate ? `${portalGraceDate}T23:59:59.999Z` : null,
                legalHold, actorId: profile?.id,
              }))}
            />
          ) : <LockedActionBanner message={check('office.clients.status_change').reason ?? 'Keine Änderungsberechtigung.'} roleLabel={roleLabel} />}
        </SectionPanel>
      ) : null}

      {summary.hardBlockers.length > 0 && !completed ? (
        <SectionPanel title="Verbindliche Sperren" subtitle="Archivierung ist bis zur Klärung nicht möglich">
          {summary.hardBlockers.map((entry) => <StatusRow key={entry.checkKey} label={entry.message} done={false} />)}
          <PremiumButton title="Live-Prüfung aktualisieren" variant="secondary" loading={busy === 'refresh'} onPress={() => tenantId && id && execute('refresh', 'Prüfstatus aktualisiert.', () => refreshClientOffboardingChecks(tenantId, id, profile?.id))} />
        </SectionPanel>
      ) : null}

      {summary.actions.length > 0 ? (
        <SectionPanel title="2. Abschlussmaßnahmen" subtitle="Jeder Schritt wird mit Person und Zeitpunkt protokolliert">
          {summary.actions.map((action) => {
            const done = action.status === 'completed' || action.status === 'not_applicable';
            const manual = MANUAL_ACTIONS.has(action.actionKey);
            return (
              <Pressable
                key={action.id}
                disabled={!canManage || !manual || completed}
                onPress={() => tenantId && id && execute(`action-${action.actionKey}`, 'Abschlussmaßnahme aktualisiert.', () => markClientOffboardingAction({
                  tenantId, clientId: id, actionKey: action.actionKey, completed: !done, actorId: profile?.id,
                }))}
                style={[styles.actionRow, manual && !completed && styles.actionRowEnabled]}
              >
                <View style={[styles.check, done && styles.checkDone]}><Text style={done ? styles.checkTextDone : styles.checkText}>{done ? '✓' : '•'}</Text></View>
                <Text style={styles.actionLabel}>{CLIENT_OFFBOARDING_ACTION_LABELS[action.actionKey]}</Text>
                <Text style={done ? styles.done : styles.open}>{done ? 'Erledigt' : 'Offen'}</Text>
              </Pressable>
            );
          })}
        </SectionPanel>
      ) : null}

      {!completed && summary.case.status !== 'draft' && canManage ? (
        <SectionPanel title="3. Portal und Endfreigabe" subtitle="Zugriff beenden, danach Akte archivieren">
          <PremiumButton
            title={summary.portalLocked ? 'Klientenportal und Geräte gesperrt' : 'Klientenportal und Push-Geräte jetzt sperren'}
            variant="secondary"
            disabled={summary.portalLocked}
            loading={busy === 'portal'}
            onPress={() => tenantId && id && execute('portal', 'Portalzugang und Geräte wurden gesperrt.', () => lockClientOffboardingPortalAccess(tenantId, id, profile?.id))}
          />
          <PremiumButton
            title={summary.case.finalProtocol ? 'Abschlussprotokoll revisionssicher gespeichert' : 'Abschlussprotokoll erzeugen'}
            variant="secondary"
            disabled={!!summary.case.finalProtocol}
            loading={busy === 'protocol'}
            onPress={() => tenantId && id && execute('protocol', 'Revisionssicherer Abschluss-Snapshot wurde erzeugt.', () => generateClientOffboardingProtocol(tenantId, id, profile?.id))}
          />
          <PremiumButton
            title="Endfreigabe erteilen und Klient:innenakte archivieren"
            disabled={summary.hardBlockers.length > 0}
            loading={busy === 'complete'}
            onPress={() => tenantId && id && execute('complete', 'Klient:innenakte wurde vollständig archiviert.', () => completeClientOffboarding(tenantId, id, profile?.id))}
          />
        </SectionPanel>
      ) : null}
    </ScreenShell>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{selected ? '✓ ' : ''}{label}</Text></Pressable>;
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return <View style={styles.actionRow}><View style={[styles.check, done && styles.checkDone]}><Text style={done ? styles.checkTextDone : styles.checkText}>{done ? '✓' : '!'}</Text></View><Text style={styles.actionLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  progressTrack: { height: 10, borderRadius: 99, overflow: 'hidden', backgroundColor: '#D8E7F7', marginBottom: spacing.md },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: '#0879F5' },
  label: { ...typography.label, color: '#09213F', marginBottom: spacing.xs },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  choice: { borderWidth: 1, borderColor: '#9CC8F7', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#F5FAFF', marginBottom: spacing.sm },
  choiceSelected: { borderColor: '#056CE8', backgroundColor: '#DCEEFF' },
  choiceText: { ...typography.caption, color: '#395571', fontWeight: '700' },
  choiceTextSelected: { color: '#045BBF' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#BBD5EE' },
  actionRowEnabled: { cursor: 'pointer' as never },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C2475D', backgroundColor: '#FFF3F5' },
  checkDone: { borderColor: '#188A6B', backgroundColor: '#DDF7EF' },
  checkText: { color: '#A8203A', fontWeight: '900' },
  checkTextDone: { color: '#08735A', fontWeight: '900' },
  actionLabel: { ...typography.body, color: '#09213F', flex: 1, fontWeight: '600' },
  open: { ...typography.caption, color: '#A8203A', fontWeight: '700' },
  done: { ...typography.caption, color: '#08735A', fontWeight: '700' },
});
