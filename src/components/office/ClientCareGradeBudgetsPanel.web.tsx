import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientBudgetVisualCards } from './ClientBudgetVisualCards.web';
import { ClientFundingSourceSelector } from './ClientFundingSourceSelector.web';
import { BudgetCorrectionModal, BudgetRecalcModal, ConversionToggleModal, ExternalSachleistungModal, EditCareFundModal, EditCareGradeModal, EditValidFromModal } from './ClientCareGradeBudgetsModals.web';
import { BUDGET_WORKSPACE_CSS } from './budgetWorkspaceCss.web';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import { subscribeToClientBudgetChanges } from '@/lib/realtime/presets';
import { buildClientBudgetVisualModels } from '@/lib/assist/clientBudgetVisuals.web';
import { getBudgetWorkspaceProfile, listBudgetWorkspaceTransactions } from '@/lib/assist/budgetWorkspaceService.web';
import { setBudgetWorkspaceFundingSources } from '@/lib/assist/budgetWorkspaceMutations.web';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { CLIENT_BUDGET_TRANSACTION_LABELS, BUDGET_TEMPLATE_LABELS, type ClientBudgetAccount, type ClientBillingWarning } from '@/types/assist/clientAssistBilling';
import { CLIENT_FUNDING_SOURCE_LABELS, normalizeClientFundingSources, type ClientFundingSourceKey } from '@/types/clients/clientFundingSource';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';

type Modal = 'careGrade' | 'careFund' | 'validFrom' | 'conversion' | 'correction' | 'recalc' | 'externalSachleistung' | null;
type Props = { clientId: string; clientName?: string; onRecordRefresh?: () => void | Promise<void>; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void };
const PAGE_SIZE = 20;
const FILTERS = [{ key: 'all', label: 'Alles' }, { key: 'usage', label: 'Verbraucht' }, { key: 'reservation', label: 'Reservierungen' }, { key: 'allocation', label: 'Zuteilungen' }, { key: 'adjustment', label: 'Korrekturen' }, { key: 'release', label: 'Freigaben' }, { key: 'reversal', label: 'Stornos' }];
const LIFECYCLE_LABELS: Record<string, string> = { geplant: 'Geplant', durchgefuehrt: 'Durchgeführt', nachgewiesen: 'Nachgewiesen', abgerechnet: 'Abgerechnet', storniert: 'Storniert' };
const equalSources = (a: readonly ClientFundingSourceKey[], b: readonly ClientFundingSourceKey[]) => normalizeClientFundingSources(a).join('|') === normalizeClientFundingSources(b).join('|');
const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateLabel = (value: string, month = false) => { const date = new Date(month ? `${value.slice(0, 10)}T12:00:00` : value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('de-DE', month ? { month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(date) : 'Datum nicht verfügbar'; };
function accountLabel(account: Pick<ClientBudgetAccount, 'label' | 'catalogKey'>) { return account.label?.trim() || BUDGET_TEMPLATE_LABELS[account.catalogKey as keyof typeof BUDGET_TEMPLATE_LABELS] || 'Budgetkonto'; }
function warningAction(warning: ClientBillingWarning): { title: string; modal: Modal } | null {
  if (warning.warningType === 'care_entitlement_unconfirmed') return { title: 'Anspruch bestätigen', modal: 'careGrade' };
  if (warning.warningType === 'missing_care_grade') return { title: 'Pflegegrad hinterlegen', modal: 'careGrade' };
  if (warning.warningType === 'no_budget_accounts') return { title: 'Budgetkonten anlegen', modal: 'recalc' };
  if (warning.warningType === 'pg1_conversion_invalid' || warning.warningType === 'conversion_not_enabled' || warning.warningType === 'conversion_ineligible') return { title: 'Umwandlung prüfen', modal: 'conversion' };
  return null;
}

/** Key the embedded view as well as the dedicated screen; no prior client data survives an identity change. */
export function ClientCareGradeBudgetsPanel(props: Props) {
  const tenantId = useServiceTenantId();
  const { user } = useAuth();
  const access = usePermissions();
  const allowed = Boolean(tenantId && user?.id && access.roleKey && !isPortalOnlyRole(access.roleKey) && (access.can('office.clients.view') || access.can('clients.billing_profile.view')));
  const scope = JSON.stringify([tenantId, user?.id, access.roleKey, [...new Set(access.permissions)].sort(), props.clientId]);
  if (!allowed) return <div className="cs-budget-workspace"><style>{BUDGET_WORKSPACE_CSS}</style><p className="bw-message" role="status">Für diese Budgetübersicht ist ein freigegebener Verwaltungszugang erforderlich.</p></div>;
  return <BudgetPanelSession key={scope} {...props} tenantId={tenantId!} scope={scope} canEdit={access.can('office.clients.edit') || access.can('clients.billing_profile.edit') || access.can('clients.budgets.edit')} />;
}

function BudgetPanelSession({ clientId, clientName, onRecordRefresh, onDirtyChange, onBusyChange, tenantId, scope, canEdit }: Props & { tenantId: string; scope: string; canEdit: boolean }) {
  const [modal, setModal] = useState<Modal>(null);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<ClientFundingSourceKey[]>([]);
  const [base, setBase] = useState<ClientFundingSourceKey[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [fundingBusy, setFundingBusy] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const operation = useRef<{ id: string; sources: ClientFundingSourceKey[]; expected: ClientFundingSourceKey[]; effectiveFrom: string } | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const subscribe = useCallback((id: string, handler: () => void) => subscribeToClientBudgetChanges(id, clientId, handler), [clientId]);
  const profileQuery = useAsyncQuery(() => getBudgetWorkspaceProfile({ tenantId, clientId }), [tenantId, clientId], {
    queryKey: `${scope}:profile`, live: { tenantId, subscribe, pollMs: 30_000, refreshOnFocus: true },
  });
  const profile = profileQuery.data;
  const sources = profile?.fundingSources ?? [];
  const dirty = initialized && !equalSources(draft, base);
  const needsFundingConfirmation = initialized && !profile?.fundingSelection && draft.length > 0;
  const conflict = dirty && !equalSources(sources, base);
  const busy = fundingBusy || uncertain || modal !== null;
  const draftRef = useRef(draft); draftRef.current = draft;
  const baseRef = useRef(base); baseRef.current = base;
  useEffect(() => {
    if (!profile || locked.current || uncertain) return;
    if (!initialized || equalSources(draftRef.current, baseRef.current)) {
      const saved = normalizeClientFundingSources(profile.fundingSources ?? []);
      setDraft(saved); setBase(saved); setInitialized(true);
    }
  }, [profile, initialized, uncertain]);
  useEffect(() => { onDirtyChange?.(dirty || modal !== null || uncertain); }, [dirty, modal, uncertain, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onDirtyChange?.(false); onBusyChange?.(false); }, [onDirtyChange, onBusyChange]);
  useUnsavedWebChanges(dirty || modal !== null || uncertain, busy);

  const transactionsQuery = useAsyncQuery(() => listBudgetWorkspaceTransactions(tenantId, clientId, { transactionType: filter === 'all' ? undefined : filter, offset: page * PAGE_SIZE, limit: PAGE_SIZE + 1 }), [tenantId, clientId, filter, page], {
    queryKey: `${scope}:transactions:${filter}:${page}`, enabled: Boolean(profile), live: { tenantId, subscribe, pollMs: 30_000, refreshOnFocus: true },
  });
  const models = useMemo(() => profile ? buildClientBudgetVisualModels(profile) : null, [profile]);
  async function refreshAll() {
    const [profileOk, transactionsOk] = await Promise.all([profileQuery.refreshWithResult(), transactionsQuery.refreshWithResult()]);
    if (!alive.current) return;
    await onRecordRefresh?.();
    if (!profileOk || !transactionsOk) throw new Error('Die Übersicht konnte noch nicht vollständig neu geladen werden. Bitte aktualisieren.');
  }
  async function refresh() { setSuccess(null); try { await refreshAll(); } catch (cause) { if (alive.current) setFundingError(cause instanceof Error ? cause.message : 'Aktualisierung fehlgeschlagen.'); } }
  async function saveFunding() {
    if (!canEdit || locked.current || !profile || modal !== null || (!uncertain && ((!dirty && !needsFundingConfirmation) || conflict || draft.length === 0 || Boolean(profileQuery.refreshError)))) return;
    locked.current = true; setFundingBusy(true); setFundingError(null); setSuccess(null);
    try {
      if (!operation.current) {
        const id = globalThis.crypto?.randomUUID?.();
        if (!id) { setFundingError('Die sichere Auftragskennung konnte nicht erstellt werden. Bitte die Seite neu laden.'); return; }
        operation.current = { id, sources: normalizeClientFundingSources(draft), expected: normalizeClientFundingSources(profile.fundingSelection?.sources ?? []), effectiveFrom: localDate() };
      }
      const pending = operation.current;
      const result = await setBudgetWorkspaceFundingSources(tenantId, clientId, pending.sources, pending.effectiveFrom, pending.expected, pending.id);
      if (!alive.current) return;
      if (!result.ok) {
        setFundingError(result.error); setUncertain(Boolean(result.uncertain));
        if (!result.uncertain) operation.current = null;
        return;
      }
      if (!equalSources(result.data.sources, pending.sources)) { setFundingError('Die Speicherbestätigung passt nicht zur Auswahl. Bitte den Speicherstand erneut prüfen.'); setUncertain(true); return; }
      const saved = normalizeClientFundingSources(result.data.sources);
      setBase(saved); setDraft(saved); setUncertain(false); operation.current = null;
      profileQuery.setData({ ...profile, fundingSources: saved, fundingSelection: { id: result.data.id, sources: saved, effectiveFrom: result.data.effectiveFrom } });
      setSuccess('Finanzierungsarten gespeichert.');
      try { await refreshAll(); } catch (cause) { if (alive.current) setFundingError(cause instanceof Error ? cause.message : 'Gespeichert; die Übersicht muss neu geladen werden.'); }
    } catch {
      if (alive.current) { setUncertain(true); setFundingError('Die Speicherbestätigung fehlt. Prüfen Sie den Speicherstand, bevor Sie weiterarbeiten. Ihre Auswahl bleibt erhalten.'); }
    } finally { locked.current = false; if (alive.current) setFundingBusy(false); }
  }
  function resetFunding() { setDraft(normalizeClientFundingSources(sources)); setBase(normalizeClientFundingSources(sources)); setFundingError(null); setSuccess(null); operation.current = null; }
  function openModal(value: Modal) { if (!canEdit || busy || dirty || profileQuery.refreshError) return; setModal(value); setSuccess(null); }
  const baseModalProps = { onClose: () => setModal(null), onSaved: refreshAll, isReadOnly: !canEdit, clientId };
  const transactions = transactionsQuery.data ?? [];
  const visibleTransactions = transactions.slice(0, PAGE_SIZE);
  const extraAccounts = profile?.budgetAccounts.filter(account => account.catalogKey !== 'paragraph_45b' && !account.catalogKey.startsWith('umwandlung_')) ?? [];
  const extraSources = sources.filter(source => source === 'verhinderungspflege' || source === 'selbstzahler');
  const rate = models?.find(model => model.hourlyRateCents)?.hourlyRateCents;
  return <section className="cs-budget-workspace" data-budget-workspace="web-v1" aria-label={clientName ? `Budgets für ${clientName}` : 'Persönliche Budgetübersicht'}>
    <style>{BUDGET_WORKSPACE_CSS}</style>
    {profileQuery.loading && !profile ? <><p role="status" className="bw-muted">Budgetübersicht wird geladen …</p><div className="bw-skeleton" aria-hidden="true" /><div className="bw-skeleton" aria-hidden="true" /></> : null}
    {profileQuery.error && !profile ? <div role="alert" className="bw-message bw-message--error">{profileQuery.error}<div className="bw-actions"><button className="bw-button" onClick={() => void profileQuery.refresh()}>Erneut versuchen</button></div></div> : null}
    {profile && models ? <>
      <section className="bw-surface bw-summary">
        <div className="bw-topline"><div><p className="bw-eyebrow">Persönliche Budgetübersicht</p><h2>{clientName || 'Budget auf einen Blick'}</h2><p className="bw-muted">Gespeicherte Beträge, Verbrauch und geplante Einsätze im aktuellen Zeitraum.</p></div><button className="bw-button" disabled={fundingBusy || modal !== null || profileQuery.refreshing} onClick={() => void refresh()}>{profileQuery.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</button></div>
        <dl className="bw-facts"><div><dt>Zeitraum</dt><dd>{dateLabel(profile.asOfDate, true)}</dd></div><div><dt>Pflegegrad</dt><dd>{profile.careGrade?.startsWith('pg') ? `Pflegegrad ${profile.careGrade.slice(2)}` : profile.careGrade === 'hospiz' ? 'Hospiz' : 'Nicht hinterlegt'}</dd></div><div><dt>Stundensatz</dt><dd>{rate ? `${formatCurrency(rate, true)} / Std.` : 'Nicht hinterlegt'}</dd></div><div><dt>Pflegekasse</dt><dd>{profile.careEntitlement?.careFundName?.trim() || 'Nicht hinterlegt'}</dd>{profile.careEntitlement?.careFundMemberId ? <p className="bw-muted">Versichertennr. {profile.careEntitlement.careFundMemberId}</p> : null}</div></dl>
      </section>
      {profileQuery.refreshError ? <div role="alert" className="bw-message bw-message--error">Die Aktualisierung ist fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand. {profileQuery.refreshError}</div> : null}
      {success ? <p role="status" className="bw-message bw-message--success">{success}</p> : null}
      <section className="bw-surface">
        <ClientFundingSourceSelector values={draft} disabled={!canEdit || busy || Boolean(profileQuery.refreshError)} onChange={values => { setDraft(values); setFundingError(null); setSuccess(null); }} error={fundingError ?? undefined} />
        {conflict && !uncertain ? <div role="alert" className="bw-message bw-message--warning">Die gespeicherte Auswahl wurde inzwischen geändert. Ihr Entwurf bleibt erhalten. Laden Sie den aktuellen Stand, bevor Sie erneut speichern.<div className="bw-actions"><button className="bw-button" onClick={resetFunding}>Gespeicherte Auswahl übernehmen</button></div></div> : null}
        {canEdit ? <div className="bw-funding-actions"><p className="bw-muted">{dirty ? 'Auswahl noch nicht gespeichert. ' : needsFundingConfirmation ? 'Aus bisherigen Angaben übernommen. Bitte einmal bestätigen. ' : ''}Änderungen gelten ab heute. Abgeschlossene Rechnungen bleiben unverändert.</p><div className="bw-actions">{dirty && !uncertain ? <button className="bw-button" disabled={busy} onClick={resetFunding}>Zurücksetzen</button> : null}<button className="bw-button bw-button--primary" disabled={fundingBusy || modal !== null || (!uncertain && ((!dirty && !needsFundingConfirmation) || conflict || draft.length === 0 || Boolean(profileQuery.refreshError)))} onClick={() => void saveFunding()}>{fundingBusy ? 'Wird gespeichert …' : uncertain ? 'Speicherstand prüfen' : needsFundingConfirmation && !dirty ? 'Auswahl bestätigen' : 'Auswahl speichern'}</button></div></div> : <p className="bw-muted" style={{ marginTop: 12 }}>Sie können die gespeicherten Finanzierungsarten einsehen.</p>}
      </section>
      <ClientBudgetVisualCards models={models} />
      {extraAccounts.length > 0 || extraSources.length > 0 ? <section className="bw-surface"><div className="bw-topline"><div><h3>Weitere Finanzierungsarten</h3><p className="bw-muted">Die gespeicherten Konten für Verhinderungspflege, Selbstzahlung und weitere Vereinbarungen.</p></div></div><dl className="bw-facts">{extraAccounts.map(account => <div key={account.id}><dt>{accountLabel(account)}</dt><dd>{formatCurrency(account.remainingCents ?? account.allocatedCents - account.usedCents - account.reservedCents, true)}</dd><p className="bw-muted">{account.status !== 'active' || !account.isEnabled || account.locked ? 'Derzeit nicht freigegeben' : 'Nach Verbrauch und Planung verfügbar'}</p><p className="bw-muted">Verbraucht {formatCurrency(account.usedCents, true)} · Geplant {formatCurrency(account.reservedCents, true)}</p></div>)}</dl>{extraAccounts.length === 0 ? <p className="bw-message" style={{ marginTop: 12 }}>{extraSources.map(source => CLIENT_FUNDING_SOURCE_LABELS[source]).join(' und ')} {extraSources.length === 1 ? 'ist' : 'sind'} ausgewählt. Für den aktuellen Zeitraum ist noch kein Budgetkonto hinterlegt. Ein verfügbarer Betrag lässt sich daraus nicht ableiten.</p> : null}</section> : null}
      {profile.warnings.length ? <section className="bw-warnings" aria-label="Hinweise zur Budgetübersicht">{profile.warnings.filter(warning => !warning.isResolved).map(warning => { const action = warningAction(warning); return <div key={warning.id} className={`bw-message ${warning.severity === 'critical' ? 'bw-message--error' : warning.severity === 'info' ? '' : 'bw-message--warning'} bw-warning-row`}><p>{warning.message}</p>{action && canEdit ? <button className="bw-button" disabled={busy || dirty || Boolean(profileQuery.refreshError)} onClick={() => openModal(action.modal)}>{action.title}</button> : null}</div>; })}</section> : null}
      {canEdit ? <section className="bw-surface bw-admin"><div><h3>Budget verwalten</h3><p className="bw-muted">Beträge und Anspruchsdaten prüfen und gezielt ändern.</p>{dirty ? <p className="bw-muted">Bitte zuerst die Finanzierungsauswahl speichern oder zurücksetzen.</p> : null}</div><div className="bw-admin-actions">{([{ modal: 'correction', label: 'Betrag anpassen', icon: '€', disabled: !profile.budgetAccounts.length }, { modal: 'careGrade', label: profile.careGradeNeedsConfirmation ? 'Anspruch bestätigen' : 'Pflegegrad ändern', icon: '◇' }, { modal: 'conversion', label: profile.careEntitlement?.conversionEnabled ? 'Umwandlung pausieren' : 'Umwandlung aktivieren', icon: '↔' }, { modal: 'externalSachleistung', label: 'Pflegedienstanteil', icon: '≋', disabled: !profile.budgetAccounts.some(account => account.catalogKey.startsWith('umwandlung_')) }, { modal: 'recalc', label: profile.budgetAccounts.length ? 'Neu berechnen' : 'Budgetkonten anlegen', icon: '↻' }, { modal: 'careFund', label: 'Pflegekasse ändern', icon: '+' }, { modal: 'validFrom', label: 'Gültigkeitsdatum', icon: '◷' }] as { modal: Modal; label: string; icon: string; disabled?: boolean }[]).map(action => <button key={action.modal} className="bw-button" disabled={busy || dirty || action.disabled || Boolean(profileQuery.refreshError)} onClick={() => openModal(action.modal)}><span aria-hidden="true">{action.icon}</span><span>{action.label}</span></button>)}</div></section> : null}
      <section className="bw-surface" aria-label="Budgetbewegungen">
        <div className="bw-topline"><div><p className="bw-eyebrow">Verlauf</p><h3>Budgetbewegungen</h3><p className="bw-muted">Neueste Buchungen zuerst. Auch Freigaben und Korrekturen bleiben nachvollziehbar.</p></div><span className="bw-badge">{transactionsQuery.refreshing ? 'Wird aktualisiert' : 'Gespeicherte Buchungen'}</span></div>
        <div className="bw-history-tools"><div className="bw-tabs" role="group" aria-label="Budgetbewegungen filtern">{FILTERS.map(item => <button key={item.key} aria-pressed={filter === item.key} onClick={() => { setFilter(item.key); setPage(0); }}>{item.label}</button>)}</div></div>
        {transactionsQuery.error || transactionsQuery.refreshError ? <div role="alert" className="bw-message bw-message--error">{transactionsQuery.error || transactionsQuery.refreshError}<div className="bw-actions"><button className="bw-button" onClick={() => void transactionsQuery.refresh()}>Verlauf erneut laden</button></div></div> : null}
        {transactionsQuery.loading && !transactionsQuery.data ? <p role="status" className="bw-muted">Budgetbewegungen werden geladen …</p> : !transactionsQuery.error && !visibleTransactions.length ? <div className="bw-empty"><strong>{filter === 'all' ? 'Noch keine Budgetbewegungen' : 'Keine Buchungen in diesem Filter'}</strong><p className="bw-muted">{filter === 'all' ? 'Gespeicherte Zuteilungen, Einsätze und Korrekturen erscheinen hier.' : 'Wählen Sie einen anderen Filter, um weitere Buchungen zu sehen.'}</p></div> : null}
        <ol className="bw-timeline">{visibleTransactions.map(transaction => <li key={transaction.id}><span className="bw-tx-icon" data-kind={transaction.transactionType} aria-hidden="true">{transaction.transactionType === 'reservation' ? '◷' : transaction.transactionType === 'usage' ? '−' : transaction.transactionType === 'allocation' ? '+' : '↔'}</span><div><div className="bw-tx-title">{CLIENT_BUDGET_TRANSACTION_LABELS[transaction.transactionType] || 'Budgetbewegung'}</div><div className="bw-tx-meta"><span>{accountLabel({ label: transaction.accountLabel, catalogKey: transaction.catalogKey ?? '' })}</span><time dateTime={transaction.createdAt}>{dateLabel(transaction.createdAt)}</time>{transaction.lifecycleStatus && LIFECYCLE_LABELS[transaction.lifecycleStatus] ? <span>{LIFECYCLE_LABELS[transaction.lifecycleStatus]}</span> : null}</div>{transaction.note ? <p className="bw-tx-note">{transaction.note}</p> : null}</div><div className="bw-tx-amount">{formatCurrency(transaction.amountCents, true)}{transaction.balanceAfterCents != null ? <small>Stand danach {formatCurrency(transaction.balanceAfterCents, true)}</small> : null}</div></li>)}</ol>
        <div className="bw-pagination"><p className="bw-muted">Seite {page + 1}{visibleTransactions.length ? ` · ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + visibleTransactions.length}` : ''}</p><div className="bw-actions"><button className="bw-button" disabled={page === 0 || transactionsQuery.loading} onClick={() => setPage(value => Math.max(0, value - 1))}>Neuere Buchungen</button><button className="bw-button" disabled={transactions.length <= PAGE_SIZE || transactionsQuery.loading || Boolean(transactionsQuery.error)} onClick={() => setPage(value => value + 1)}>Ältere Buchungen</button></div></div>
      </section>
      <p className="bw-footnote">Planungen verringern den verfügbaren Betrag. Die angezeigten Stunden ergeben sich aus dem hinterlegten Stundensatz. Maßgeblich für den Anspruch bleibt die Abrechnung der Pflegekasse.</p>
      <EditCareGradeModal {...baseModalProps} visible={modal === 'careGrade'} profile={profile} />
      <EditCareFundModal {...baseModalProps} visible={modal === 'careFund'} profile={profile} />
      <EditValidFromModal {...baseModalProps} visible={modal === 'validFrom'} profile={profile} />
      <ConversionToggleModal {...baseModalProps} visible={modal === 'conversion'} profile={profile} />
      <BudgetCorrectionModal {...baseModalProps} visible={modal === 'correction'} accounts={profile.budgetAccounts} />
      <ExternalSachleistungModal {...baseModalProps} visible={modal === 'externalSachleistung'} accounts={profile.budgetAccounts} asOfDate={profile.asOfDate} />
      <BudgetRecalcModal {...baseModalProps} visible={modal === 'recalc'} profile={profile} />
    </> : null}
  </section>;
}
