import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import { PlatformShellLayout as DesktopPlatformShell } from '@/components/platformConsole/PlatformShellLayout.web';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import {

  PlatformAuditLink,



  PlatformFormField,



  PlatformStatusBadge,

  PlatformTenantEnvironmentBadge,

  PLATFORM_COLORS,

} from '@/components/platformConsole';

import { ErrorState, LoadingState } from '@/components/ui';

import {

  getPlatformTenantDetail,

  platformRoleHasCapability,


  updatePlatformTenantStatus,

  updatePlatformTenantRecord,

} from '@/lib/platformConsole';

import type { PlatformTenantDetail } from '@/lib/platformConsole';
import type { PlatformTenantRecordUpdate } from '@/lib/platformConsole/platformTenantService';


import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';

import {

  TenantAuditTab,

  TenantBillingPreviewTab,

  TenantCreditsTab,

  TenantDiagnosisTab,

  TenantDiscountsTab,

  TenantEntitlementsTab,

  TenantFeatureFlagsTab,

  TenantInvoicesTab,

  TenantLimitsTab,

  TenantPaymentsTab,

  TenantSubscriptionTab,


  TenantUsersTab,

} from './PlatformTenantOperatorTabs';

import { spacing } from '@/theme';
import { PlatformConfirmModal } from '@/components/platformConsole/PlatformConfirmModal.web';
import type { PlatformCapability } from '@/types/platformConsole';
import { ConsoleStyle, ConsoleBadge } from '@/components/platformConsole/ConsoleWorkspaceUi.web';
import { consoleDate, consoleLabel } from '@/lib/platformConsole/consoleWorkspaceModel';



const TAB_GROUPS = [
  { key: 'record', label: 'Mandantenakte', tabs: [
    { key: 'overview', label: 'Übersicht' }, { key: 'recordEdit', label: 'Stammdaten bearbeiten' },
  ] },
  { key: 'contract', label: 'Vertrag & Produkte', tabs: [
    { key: 'subscription', label: 'Vertrag' },
    { key: 'entitlements', label: 'Berechtigungen' }, { key: 'limits', label: 'Limits' },
    { key: 'flags', label: 'Feature Flags' },
  ] },
  { key: 'finance', label: 'Finanzen', tabs: [
    { key: 'billing', label: 'Rechnungen' }, { key: 'preview', label: 'Abrechnungsvorschau' },
    { key: 'payments', label: 'Zahlungen' }, { key: 'credits', label: 'Guthaben' },
    { key: 'discounts', label: 'Rabatte' },
  ] },
  { key: 'access', label: 'Zugriff & Support', tabs: [
    { key: 'users', label: 'Benutzer' }, { key: 'support', label: 'Support' },
  ] },
  { key: 'operations', label: 'Betrieb & Prüfung', tabs: [
    { key: 'diagnosis', label: 'Diagnose' }, { key: 'audit', label: 'Audit' },
  ] },
] as const;

type TabKey = (typeof TAB_GROUPS)[number]['tabs'][number]['key'];
const TAB_CAPABILITIES: Record<TabKey, PlatformCapability> = {
  overview:'tenants.read',recordEdit:'tenants.write',subscription:'plans.read',entitlements:'modules.read',limits:'plans.read',
  flags:'flags.read',billing:'billing.read',preview:'billing.read',payments:'payments.read',credits:'billing.read',
  discounts:'discounts.read',users:'tenants.read',support:'support.read',diagnosis:'tenants.read',audit:'audit.read',
};
const TAB_DESCRIPTIONS: Record<TabKey,string> = {
  overview:'Unternehmensstatus, Kontaktdaten und aktivierte Funktionen im Zusammenhang prüfen.',
  recordEdit:'Rechtliche Angaben, Ansprechpartner, E-Mail-Adressen und Datenumgebung verbindlich pflegen.',
  subscription:'Vertragsversion, Laufzeit, Status und zugeordnete Erweiterungen für dieses Unternehmen bearbeiten.',
  entitlements:'Den tatsächlich berechneten Funktionszugriff einschließlich seiner Vertragsgrundlage prüfen.',
  limits:'Vereinbarte Kapazitäten und die aktuell zugrunde liegenden Vertragslimits nachvollziehen.',
  flags:'Technische Freigaben für genau dieses Unternehmen prüfen und mit Begründung ändern.',
  billing:'Rechnungen, Fälligkeiten und dokumentierte Zahlungsstände dieses Unternehmens prüfen.',
  preview:'Die nächste Abrechnung aus den aktuell hinterlegten Vertragsgrundlagen berechnen und kontrollieren.',
  payments:'Dokumentierte Zahlungseingänge, Rechnungszuordnungen und fehlgeschlagene Vorgänge nachvollziehen.',
  credits:'Guthabenbestand und Buchungshistorie prüfen; Korrekturen benötigen eine nachvollziehbare Grundlage.',
  discounts:'Aktive Sonderkonditionen und ihre Laufzeiten prüfen, zuweisen oder beenden.',
  users:'Die dem Unternehmen zugeordneten Konten und ihre Kontaktinformationen einsehen.',
  support:'Unternehmensbezogene Supportanfragen und bestätigte Datenzugriffe im Support-Arbeitsbereich bearbeiten.',
  diagnosis:'Einrichtungsstand und betriebliche Auffälligkeiten prüfen, bevor Sie einen Fehler eskalieren.',
  audit:'Änderungen an diesem Unternehmen mit Zeitpunkt, ausführender Rolle und Begründung nachvollziehen.',
};




export function PlatformTenantDetailScreen() {
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const id = typeof tenantId === 'string' ? tenantId : '';
  return <TenantDetailContent key={id} tenantId={id} />;
}

function TenantDetailContent({ tenantId }: { tenantId: string }) {
  const router = useRouter();

  const { platformUser } = usePlatformAuth();

  const [detail, setDetail] = useState<PlatformTenantDetail | null>(null);

  const [tab, setTab] = useState<TabKey>('overview');
  const visibleGroups=TAB_GROUPS.map(group=>({...group,tabs:group.tabs.filter(item=>platformRoleHasCapability(platformUser?.role,TAB_CAPABILITIES[item.key]))})).filter(group=>group.tabs.length>0);
  useEffect(()=>{if(!platformRoleHasCapability(platformUser?.role,TAB_CAPABILITIES[tab]))setTab('overview');},[platformUser?.role,tab]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<{

    title: string;

    description: string;

    action: (reason: string) => Promise<void>;

    danger?: boolean;

    typed?: string;

    auditAction?: string;

  } | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const [lastAuditAction, setLastAuditAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const requestNumber = useRef(0);
  const actionLock = useRef(false);
  const [recordDirty, setRecordDirty] = useState(false);
  const confirmLeave = useUnsavedWebChanges(recordDirty, actionLoading);
  const changeTab = async (next: TabKey) => {
    if (next === tab || !await confirmLeave()) return;
    setRecordDirty(false); setTab(next);
  };
  const mounted = useRef(true);



  const canWrite = platformRoleHasCapability(platformUser?.role, 'tenants.suspend');

  const canEditRecord = platformRoleHasCapability(platformUser?.role, 'tenants.write');



  const load = useCallback(async () => {
    const request = ++requestNumber.current;
    setLoading(true);
    setError(null);
    try {
      if (!tenantId) throw new Error('Die Unternehmens-ID fehlt. Bitte öffnen Sie das Unternehmen erneut aus der Liste.');
      const result = await getPlatformTenantDetail(tenantId);
      if (request !== requestNumber.current) return;
      if (!result.ok) throw new Error(result.error);
      setDetail(result.data);
    } catch (cause) {
      if (request !== requestNumber.current) return;
      setError(cause instanceof Error ? cause.message : 'Unternehmensdaten konnten nicht geladen werden.');
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [tenantId]);



  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; requestNumber.current++; };
  }, [load]);



  const tenantName = useMemo(() => {

    const t = detail?.tenant;

    if (!t) return 'Mandant';

    return String(t.tenant_name ?? t.tenantName ?? 'Mandant');

  }, [detail]);



  async function runConfirm(reason: string) {

    if (!confirm || actionLock.current) return;
    actionLock.current = true;
    setActionError(null);
    setLastAuditAction(null);
    setActionLoading(true);
    try {
      await confirm.action(reason);
      if (!mounted.current) return;
      if (confirm.auditAction) setLastAuditAction(confirm.auditAction);
      setConfirm(null);
      await load();
    } catch (cause) {
      if (!mounted.current) return;
      setActionError(cause instanceof Error ? cause.message : 'Änderung konnte nicht gespeichert werden.');
    } finally {
      actionLock.current = false;
      if (mounted.current) setActionLoading(false);
    }
  }



  if (loading) {

    return (

      <DesktopPlatformShell title="Mandant">

        <LoadingState message="Mandantendetails werden geladen…" />

      </DesktopPlatformShell>

    );

  }



  if (error || !detail) {

    return (

      <DesktopPlatformShell title="Mandant">

        <ErrorState title="Mandant nicht gefunden" message={error ?? 'Unbekannter Fehler'} onRetry={() => void load()} />

      </DesktopPlatformShell>

    );

  }



  const tid = String(tenantId);

  const activeGroup = visibleGroups.find((group) => group.tabs.some((item) => item.key === tab)) ?? visibleGroups[0];



  return (

    <DesktopPlatformShell scroll={false} title={tenantName} subtitle="Mandantenakte, Vertrag, Finanzen und Support">

      <View style={styles.navigation}>
        <View style={styles.groupTabs}>
          {visibleGroups.map((group) => {
            const active = group.key === activeGroup?.key;
            return (
              <Pressable accessibilityRole="tab" accessibilityState={{selected:active}} key={group.key} style={[styles.groupTab, active && styles.groupTabActive]} onPress={() => void changeTab(group.tabs[0].key)}>
                <Text style={[styles.groupTabText, active && styles.groupTabTextActive]}>{group.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {activeGroup && activeGroup.tabs.length > 1 ? (
          <View style={styles.subTabs}>
            {activeGroup.tabs.map((item) => (
              <Pressable accessibilityRole="tab" accessibilityState={{selected:item.key===tab}} key={item.key} style={[styles.subTab, item.key === tab && styles.subTabActive]} onPress={() => void changeTab(item.key)}>
                <Text style={[styles.subTabText, item.key === tab && styles.subTabTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>



      {actionError ? <Text accessibilityRole="alert" style={{ color: PLATFORM_COLORS.danger }}>{actionError}</Text> : null}
      {lastAuditAction ? (

        <View style={styles.auditBanner}>

          <Text style={styles.auditHint}>Aktion protokolliert.</Text>

          <PlatformAuditLink tenantId={tid} action={lastAuditAction} />

        </View>

      ) : null}



      <ScrollView contentContainerStyle={styles.content}>
        <div className="cs-console"><ConsoleStyle /><section className="cs-hero" style={{padding:'20px 24px'}}><div>
          <div className="cs-eyebrow">Unternehmensakte · {activeGroup?.label??'Übersicht'}</div>
          <h2>{activeGroup?.tabs.find(item=>item.key===tab)?.label??'Übersicht'}</h2>
          <p>{TAB_DESCRIPTIONS[tab]}</p>
          <div className="cs-actions" style={{marginTop:12}}><ConsoleBadge value={detail.tenant.status} label={consoleLabel(detail.tenant.status)}/><small>Unternehmens-ID: {tid} · Stand: {consoleDate(detail.tenant.updated_at??detail.tenant.updatedAt)}</small></div>
        </div></section></div>

        {tab === 'overview' ? (

          <OverviewTab

            detail={detail}

            canWrite={canWrite}

            onSuspend={() =>

              setConfirm({

                title: 'Mandant sperren',

                description: `Der Mandant „${tenantName}" wird gesperrt. Nutzer können sich nicht mehr anmelden.`,

                danger: true,

                typed: 'SPERREN',

                auditAction: 'tenant.suspended',

                action: async (reason) => {

                  const result = await updatePlatformTenantStatus(tid, 'suspended', reason);
                  if (!result.ok) throw new Error(result.error);

                },

              })

            }

            onUnsuspend={() =>

              setConfirm({

                title: 'Mandant entsperren',

                description: `Der Mandant „${tenantName}" wird wieder freigegeben.`,

                auditAction: 'tenant.unsuspended',

                action: async (reason) => {

                  const result = await updatePlatformTenantStatus(tid, 'active', reason);
                  if (!result.ok) throw new Error(result.error);

                },

              })

            }

          />

        ) : null}

        {tab === 'recordEdit' ? (
          <TenantRecordEditTab
            detail={detail}
            canWrite={canEditRecord}
            onDirtyChange={setRecordDirty}
            disabled={actionLoading}
            onSave={(update) => setConfirm({
              title: 'Mandantenakte speichern',
              description: `Stammdaten und Datenklassifizierung für „${tenantName}" verbindlich aktualisieren.`,
              auditAction: 'tenant.record_updated',
              action: async (reason) => {
                const result = await updatePlatformTenantRecord(tid, update, reason);
                if (!result.ok) throw new Error(result.error);
              },
            })}
          />
        ) : null}



        {tab === 'subscription' ? (
          <TenantSubscriptionTab tenantId={tid} detail={detail} role={platformUser?.role} onReload={load} />
        ) : null}

        {tab === 'entitlements' ? (
          <TenantEntitlementsTab tenantId={tid} role={platformUser?.role} />
        ) : null}

        {tab === 'billing' ? (

          <TenantInvoicesTab tenantId={tid} detail={detail} role={platformUser?.role} onReload={load} />

        ) : null}



        {tab === 'preview' ? (
          <TenantBillingPreviewTab tenantId={tid} role={platformUser?.role} />
        ) : null}

        {tab === 'credits' ? (
          <TenantCreditsTab tenantId={tid} role={platformUser?.role} onReload={load} />
        ) : null}

        {tab === 'payments' ? (

          <TenantPaymentsTab tenantId={tid} detail={detail} role={platformUser?.role} onReload={load} />

        ) : null}



        {tab === 'discounts' ? (

          <TenantDiscountsTab tenantId={tid} detail={detail} role={platformUser?.role} onReload={load} />

        ) : null}



        {tab === 'support' ? (

          <View style={styles.panel}><Text style={styles.panelTitle}>Support zu diesem Unternehmen</Text><Text style={styles.panelHint}>Tickets und Nachrichten bearbeiten Sie in der Support-Zentrale. Zugriff auf weitere Unternehmensdaten wird dort mit Zweck, Umfang und Ablaufzeit angefragt und durch das Unternehmen bestätigt.</Text><Pressable style={styles.saveButton} onPress={() => router.push({ pathname: '/platform/support', params: { company: tenantName } } as never)}><Text style={styles.saveButtonText}>Support-Zentrale öffnen</Text></Pressable></View>

        ) : null}



        {tab === 'flags' ? (

          <TenantFeatureFlagsTab tenantId={tid} role={platformUser?.role} />

        ) : null}



        {tab === 'limits' ? <TenantLimitsTab detail={detail} /> : null}

        {tab === 'users' ? <TenantUsersTab tenantId={tid} /> : null}

        {tab === 'diagnosis' ? <TenantDiagnosisTab tenantId={tid} detail={detail} /> : null}

        {tab === 'audit' ? <TenantAuditTab tenantId={tid} /> : null}

      </ScrollView>



      <PlatformConfirmModal
        error={actionError}

        visible={Boolean(confirm)}

        title={confirm?.title ?? ''}

        description={confirm?.description ?? ''}

        danger={confirm?.danger}

        requireTypedConfirmation={confirm?.typed}

        loading={actionLoading}

        onCancel={() => { if (!actionLock.current) setConfirm(null); }}

        onConfirm={(reason) => void runConfirm(reason)}

      />

    </DesktopPlatformShell>

  );

}



function OverviewTab({

  detail,

  canWrite,

  onSuspend,

  onUnsuspend,

}: {

  detail: PlatformTenantDetail;

  canWrite: boolean;

  onSuspend: () => void;

  onUnsuspend: () => void;

}) {

  const t = detail.tenant;
  const environmentMode = String(t.environmentMode ?? t.environment_mode ?? 'unclassified');
  const environmentNotes = String(t.environmentNotes ?? t.environment_notes ?? '');
  const activeModules = detail.modules.filter((module) => ['enabled', 'beta_enabled', 'trial'].includes(module.status));

  return (
    <View style={styles.recordGrid}>
      <View style={[styles.panel, styles.environmentPanel]}>
        <View style={styles.panelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.panelTitle}>Datenklassifizierung</Text>
            <Text style={styles.panelHint}>Verbindliche Kennzeichnung für Echt-, Pilot- und Testdaten.</Text>
          </View>
          <PlatformTenantEnvironmentBadge mode={environmentMode} />
        </View>
        <Text style={styles.environmentExplanation}>
          {environmentMode === 'production'
            ? 'Dieses Unternehmen verwendet die Produktivumgebung.'
            : environmentMode === 'unclassified'
              ? 'Dieser Mandant ist noch nicht verlässlich klassifiziert und darf nicht als echter Produktivmandant behandelt werden.'
              : 'Dieser Mandant enthält Test-, Demo- oder Pilotdaten und ist kein bestätigter echter Produktivmandant.'}
        </Text>
        {environmentNotes ? <Text style={styles.panelHint}>{environmentNotes}</Text> : null}
      </View>

      <View style={styles.recordColumns}>
        <View style={[styles.panel, styles.recordColumn]}>
          <Text style={styles.panelTitle}>Stammdaten</Text>
          <InfoRow label="Mandanten-ID" value={String(t.tenant_id ?? t.tenantId ?? '—')} />
          <InfoRow label="Firmenname" value={String(t.tenant_name ?? t.tenantName ?? '—')} />
          <InfoRow label="Rechtlicher Name" value={String(t.legal_name ?? t.legalName ?? '—')} />
          <InfoRow label="Slug" value={String(t.slug ?? '—')} />
          <InfoRow label="Land" value={String(t.country ?? 'DE')} />
          <InfoRow label="Zeitzone" value={String(t.timezone ?? 'Europe/Berlin')} />
        </View>

        <View style={[styles.panel, styles.recordColumn]}>
          <Text style={styles.panelTitle}>Kontakt</Text>
          <InfoRow label="Ansprechperson" value={String(t.primary_contact_name ?? '—')} />
          <InfoRow label="E-Mail" value={String(t.primary_contact_email ?? '—')} />
          <InfoRow label="Telefon" value={String(t.primary_contact_phone ?? '—')} />
          <InfoRow label="Abrechnung" value={String(t.billing_email ?? '—')} />
          <InfoRow label="Support" value={String(t.support_email ?? '—')} />
        </View>
      </View>

      <View style={styles.recordColumns}>
        <View style={[styles.panel, styles.recordColumn]}>
          <Text style={styles.panelTitle}>Vertrag & Betrieb</Text>
          <InfoBadgeRow label="Mandantenstatus" status={String(t.status ?? '—')} />
          <InfoBadgeRow label="Lifecycle" status={String(t.lifecycle_status ?? t.lifecycleStatus ?? '—')} />
          <InfoBadgeRow label="Abrechnung" status={String(t.billing_status ?? t.billingStatus ?? '—')} />
          <InfoRow label="Tarif" value={(t.plan_key ?? t.planKey ?? detail.plan?.plan_key) === 'free_platform' ? 'Kostenlos · 0 €' : String(t.plan_key ?? t.planKey ?? detail.plan?.plan_key ?? '—')} />
        </View>

        <View style={[styles.panel, styles.recordColumn]}>
          <Text style={styles.panelTitle}>Aktive Produkte</Text>
          {activeModules.length ? activeModules.map((module) => (
            <View key={module.moduleKey} style={styles.productRow}>
              <Text style={styles.productName}>{module.moduleName}</Text>
              <PlatformStatusBadge status={module.status} />
            </View>
          )) : <Text style={styles.panelHint}>Keine aktiven Funktionsbereiche.</Text>}
        </View>
      </View>

      {canWrite ? (
        <View style={[styles.panel, styles.dangerPanel]}>
          <Text style={styles.panelTitle}>Sicherheitsaktionen</Text>
          <Text style={styles.panelHint}>Sperren und Entsperren werden mit Begründung im Audit protokolliert.</Text>
          <View style={styles.actions}>

          <Pressable style={styles.btnDanger} onPress={onSuspend}>

            <Text style={styles.btnText}>Sperren</Text>

          </Pressable>

          <Pressable style={styles.btn} onPress={onUnsuspend}>

            <Text style={styles.btnText}>Entsperren</Text>

          </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );

}

function TenantRecordEditTab({
  detail,
  canWrite,
  onSave,
  onDirtyChange,
  disabled,
}: {
  detail: PlatformTenantDetail;
  canWrite: boolean;
  disabled?: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (update: PlatformTenantRecordUpdate) => void;
}) {
  const t = detail.tenant;
  const initialMode = String(t.environmentMode ?? t.environment_mode ?? 'unclassified');
  const [legalName, setLegalName] = useState(String(t.legal_name ?? t.legalName ?? ''));
  const [slug, setSlug] = useState(String(t.slug ?? ''));
  const [contactName, setContactName] = useState(String(t.primary_contact_name ?? ''));
  const [contactEmail, setContactEmail] = useState(String(t.primary_contact_email ?? ''));
  const [contactPhone, setContactPhone] = useState(String(t.primary_contact_phone ?? ''));
  const [billingEmail, setBillingEmail] = useState(String(t.billing_email ?? ''));
  const [supportEmail, setSupportEmail] = useState(String(t.support_email ?? ''));
  const [country, setCountry] = useState(String(t.country ?? 'DE'));
  const [timezone, setTimezone] = useState(String(t.timezone ?? 'Europe/Berlin'));
  const [environmentMode, setEnvironmentMode] = useState<PlatformTenantRecordUpdate['environmentMode'] | null>(
    ['production', 'pilot', 'demo', 'sandbox', 'internal_test'].includes(initialMode) ? initialMode as PlatformTenantRecordUpdate['environmentMode'] : null,
  );
  const [environmentNotes, setEnvironmentNotes] = useState(String(t.environmentNotes ?? t.environment_notes ?? ''));

  const currentValues = [legalName, slug, contactName, contactEmail, contactPhone, billingEmail, supportEmail, country, timezone, environmentMode, environmentNotes];
  const initialValues = useRef(currentValues);
  const dirty = currentValues.some((value, index) => value !== initialValues.current[index]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const emailError = [contactEmail, billingEmail, supportEmail].some(value => value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
  const recordError = emailError ? 'Bitte gültige E-Mail-Adressen angeben.' : !/^[A-Za-z]{2}$/.test(country.trim()) ? 'Bitte das zweistellige Länderkürzel angeben, zum Beispiel DE.' : null;

  if (!canWrite) {
    return <View style={styles.panel}><Text style={styles.panelTitle}>Nur Leserechte</Text><Text style={styles.panelHint}>Ihr Plattformkonto benötigt die Berechtigung zur Unternehmensverwaltung.</Text></View>;
  }

  return (
    <View style={styles.recordGrid}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Echt- oder Testmandant</Text>
        <Text style={styles.panelHint}>Diese Auswahl ist verpflichtend. „Produktion“ darf nur für bestätigte echte Kunden verwendet werden.</Text>
        <View style={styles.environmentOptions}>
          {([
            ['production', 'Echt · Produktion'], ['pilot', 'Fiktiver Pilot'], ['demo', 'Demo'],
            ['sandbox', 'Sandbox'], ['internal_test', 'Interner Test'],
          ] as const).map(([key, label]) => (
            <Pressable key={key} style={[styles.environmentOption, environmentMode === key && styles.environmentOptionActive]} onPress={() => setEnvironmentMode(key)}>
              <Text style={[styles.environmentOptionText, environmentMode === key && styles.environmentOptionTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <PlatformFormField label="Einordnung / Hinweis" required>
          <TextInput editable={!disabled} style={[styles.input, styles.multiline]} multiline value={environmentNotes} onChangeText={setEnvironmentNotes} placeholder="Warum ist dieser Mandant Produktion, Pilot oder Test?" placeholderTextColor={PLATFORM_COLORS.muted} />
        </PlatformFormField>
      </View>

      <View style={styles.recordColumns}>
        <View style={[styles.panel, styles.recordColumn]}>
          <Text style={styles.panelTitle}>Unternehmen</Text>
          <PlatformFormField label="Rechtlicher Name"><TextInput editable={!disabled} style={styles.input} value={legalName} onChangeText={setLegalName} /></PlatformFormField>
          <PlatformFormField label="Slug"><TextInput editable={!disabled} style={styles.input} value={slug} onChangeText={setSlug} autoCapitalize="none" /></PlatformFormField>
          <PlatformFormField label="Land"><TextInput editable={!disabled} style={styles.input} value={country} onChangeText={setCountry} autoCapitalize="characters" /></PlatformFormField>
          <PlatformFormField label="Zeitzone"><TextInput editable={!disabled} style={styles.input} value={timezone} onChangeText={setTimezone} autoCapitalize="none" /></PlatformFormField>
        </View>
        <View style={[styles.panel, styles.recordColumn]}>
          <Text style={styles.panelTitle}>Kontakt & Abrechnung</Text>
          <PlatformFormField label="Ansprechperson"><TextInput editable={!disabled} style={styles.input} value={contactName} onChangeText={setContactName} /></PlatformFormField>
          <PlatformFormField label="Kontakt-E-Mail"><TextInput editable={!disabled} style={styles.input} value={contactEmail} onChangeText={setContactEmail} autoCapitalize="none" keyboardType="email-address" /></PlatformFormField>
          <PlatformFormField label="Telefon"><TextInput editable={!disabled} style={styles.input} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" /></PlatformFormField>
          <PlatformFormField label="Abrechnungs-E-Mail"><TextInput editable={!disabled} style={styles.input} value={billingEmail} onChangeText={setBillingEmail} autoCapitalize="none" keyboardType="email-address" /></PlatformFormField>
          <PlatformFormField label="Support-E-Mail"><TextInput editable={!disabled} style={styles.input} value={supportEmail} onChangeText={setSupportEmail} autoCapitalize="none" keyboardType="email-address" /></PlatformFormField>
        </View>
      </View>

      {recordError ? <Text accessibilityRole="alert" style={styles.panelHint}>{recordError}</Text> : null}
      <Pressable
        accessibilityRole="button"
        style={[styles.saveButton, (!environmentMode || !environmentNotes.trim()) && styles.disabledButton]}
        disabled={disabled || !dirty || !!recordError || !environmentMode || !environmentNotes.trim()}
        onPress={() => environmentMode && onSave({
          legalName: legalName.trim() || null, slug: slug.trim() || null,
          primaryContactName: contactName.trim() || null, primaryContactEmail: contactEmail.trim() || null,
          primaryContactPhone: contactPhone.trim() || null, billingEmail: billingEmail.trim() || null,
          supportEmail: supportEmail.trim() || null, country: country.trim() || 'DE',
          timezone: timezone.trim() || 'Europe/Berlin', environmentMode,
          environmentNotes: environmentNotes.trim(),
        })}
      >
        <Text style={styles.saveButtonText}>Mandantenakte speichern</Text>
      </Pressable>
    </View>
  );
}



function InfoRow({ label, value }: { label: string; value: string }) {

  return (

    <View style={styles.infoRow}>

      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue}>{value}</Text>

    </View>

  );

}

function InfoBadgeRow({ label, status }: { label: string; status: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><PlatformStatusBadge status={status} /></View>;
}



const styles = StyleSheet.create({

  navigation: { gap: spacing.xs, marginBottom: spacing.xs },
  groupTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  groupTab: { borderWidth: 1, borderColor: PLATFORM_COLORS.border, borderRadius: 8, backgroundColor: PLATFORM_COLORS.panel, paddingHorizontal: spacing.md, paddingVertical: 9 },
  groupTabActive: { borderColor: PLATFORM_COLORS.accent, backgroundColor: PLATFORM_COLORS.accentSoft },
  groupTabText: { color: PLATFORM_COLORS.muted, fontSize: font(13), fontWeight: '700' },
  groupTabTextActive: { color: PLATFORM_COLORS.accent },
  subTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: 8, backgroundColor: '#EAF0F7' },
  subTab: { borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  subTabActive: { backgroundColor: PLATFORM_COLORS.panel, borderWidth: 1, borderColor: PLATFORM_COLORS.border },
  subTabText: { color: PLATFORM_COLORS.muted, fontSize: font(13), fontWeight: '600' },
  subTabTextActive: { color: PLATFORM_COLORS.text },

  content: { paddingTop: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },

  panel: {

    backgroundColor: PLATFORM_COLORS.panel,

    borderWidth: 1,

    borderColor: PLATFORM_COLORS.border,

    borderRadius: 10,

    padding: spacing.md,

    gap: spacing.sm,

  },

  recordGrid: { gap: spacing.md },
  recordColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  recordColumn: { flexGrow: 1, flexBasis: 300, minWidth: 0 },
  environmentPanel: { borderColor: '#FCD34D' },
  dangerPanel: { borderColor: '#FCA5A5' },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  panelTitle: { color: PLATFORM_COLORS.text, fontSize: font(15), fontWeight: '800' },
  panelHint: { color: PLATFORM_COLORS.muted, fontSize: font(13), lineHeight: font(20) },
  environmentExplanation: { color: PLATFORM_COLORS.text, fontSize: font(13), lineHeight: font(20) },
  productRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  productName: { color: PLATFORM_COLORS.text, fontSize: font(13), fontWeight: '600' },
  environmentOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  environmentOption: { borderWidth: 1, borderColor: PLATFORM_COLORS.border, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 7, backgroundColor: PLATFORM_COLORS.panelSoft },
  environmentOptionActive: { borderColor: PLATFORM_COLORS.accent, backgroundColor: PLATFORM_COLORS.accentSoft },
  environmentOptionText: { color: PLATFORM_COLORS.muted, fontSize: font(13), fontWeight: '700' },
  environmentOptionTextActive: { color: PLATFORM_COLORS.accent },
  input: { borderWidth: 1, borderColor: PLATFORM_COLORS.border, borderRadius: 8, backgroundColor: PLATFORM_COLORS.panelSoft, color: PLATFORM_COLORS.text, paddingHorizontal: spacing.sm, paddingVertical: 10 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: { alignSelf: 'flex-start', borderRadius: 8, backgroundColor: PLATFORM_COLORS.accent, paddingHorizontal: spacing.lg, paddingVertical: 11 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '800' },
  disabledButton: { opacity: 0.45 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },

  infoLabel: { color: PLATFORM_COLORS.muted, fontSize: font(13) },

  infoValue: { flex: 1, minWidth: 0, textAlign: 'right', color: PLATFORM_COLORS.text, fontSize: font(13), fontWeight: '600' },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },

  btn: {

    backgroundColor: '#F1F5F9',

    paddingHorizontal: spacing.md,

    paddingVertical: 8,

    borderRadius: 8,

    borderWidth: 1,

    borderColor: PLATFORM_COLORS.border,

  },

  btnDanger: {

    backgroundColor: '#FFF1F0',

    paddingHorizontal: spacing.md,

    paddingVertical: 8,

    borderRadius: 8,

    borderWidth: 1,

    borderColor: PLATFORM_COLORS.danger,

  },

  btnText: { color: PLATFORM_COLORS.text, fontSize: font(13), fontWeight: '600' },

  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },

  moduleName: { color: PLATFORM_COLORS.text, fontWeight: '600' },

  moduleMeta: { color: PLATFORM_COLORS.muted, fontSize: font(13) },

  auditBanner: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: spacing.sm,

    marginTop: spacing.sm,

  },

  auditHint: { color: PLATFORM_COLORS.muted, fontSize: font(13) },

});
