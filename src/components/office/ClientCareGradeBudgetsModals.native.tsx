// Generated native presentation from src/components/office/ClientCareGradeBudgetsModals.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto,nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeLabel,NativeSpan,NativeSmall,NativeTextarea,NativeDiv,NativeStyle,NativeDialog,NativeHeader,NativeH2,NativeP,NativeButton,NativeForm,NativeFieldset,NativeFooter,NativeInput,NativeSelect,NativeOption,NativeStrong,NativeArticle,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { applyBudgetRecalculation, bookBudgetCorrection, changeClientCareGrade, deactivateClientBudgetAccount, previewBudgetRecalculationFromCatalog, setClientConversionEnabled, updateCareEntitlementValidFrom, updateClientCareFund, updateClientBudgetAccount, type BudgetRecalcDiff, } from "../../lib/assist/budgetWorkspaceMutations.native.ts";
import { CARE_GRADE_OPTIONS } from '@/lib/assist/clientCareGradeBudgetsViewModel';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import type { ClientAssistBillingProfile, ClientBudgetAccount, ClientCareGrade } from '@/types/assist/clientAssistBilling';
import { budgetModalCss } from "./budgetModalCss.native.ts";
import { budgetModalReasonError, budgetModalToday, isBudgetModalDate, parseBudgetModalAmount } from "./budgetModalModel.native.ts";
type ModalBaseProps = {
    visible: boolean;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
    isReadOnly: boolean;
};
type ProfileProps = ModalBaseProps & {
    clientId: string;
    profile: ClientAssistBillingProfile;
};
type MutationResult = {
    ok: true;
    data?: unknown;
} | {
    ok: false;
    error: string;
    uncertain?: boolean;
};
type FormProps = Omit<ModalBaseProps, 'visible'> & {
    title: string;
    subtitle?: string;
    action?: string;
    danger?: boolean;
    dirty: boolean;
    blocked?: boolean;
    conflict?: boolean;
    submit: (operationId: string) => Promise<MutationResult>;
    receipt?: (data: unknown) => boolean;
    successMessage: string;
    children: ReactNode;
};
const hasId = (data: unknown): boolean => Boolean(data && typeof data === 'object' && 'id' in data && typeof data.id === 'string' && data.id);
function Field({ label, hint, error, children }: {
    label: string;
    hint?: string;
    error?: string;
    children: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[budgetModalCss]}>{<NativeLabel className="cbm-field"><NativeSpan>{label}</NativeSpan>{children}{hint && <NativeSmall>{hint}</NativeSmall>}{error && <NativeSmall className="cbm-field-error" role="alert">{error}</NativeSmall>}</NativeLabel>}</NativeWorkspaceStyleScope>;
}
function Reason({ value, onChange, error, label = 'Begründung' }: {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    label?: string;
}) {
    return <NativeWorkspaceStyleScope css={[budgetModalCss]}>{<Field label={label} error={error} hint="Pflichtangabe. Der Anlass wird im Änderungsverlauf gespeichert."><NativeTextarea aria-label={label} aria-invalid={Boolean(error)} value={value} onChange={event => onChange(event.target.value)} maxLength={2000} placeholder="Anlass und Grundlage dieser Änderung"/></Field>}</NativeWorkspaceStyleScope>;
}
function Banner({ children, variant = 'info' }: {
    children: ReactNode;
    variant?: 'info' | 'warning' | 'error' | 'success';
}) {
    return <NativeWorkspaceStyleScope css={[budgetModalCss]}>{<NativeDiv className={`cbm-banner cbm-banner--${variant}`}>{children}</NativeDiv>}</NativeWorkspaceStyleScope>;
}
function BudgetForm({ title, subtitle, action = 'Speichern', danger, dirty, blocked, conflict, isReadOnly, onClose, onSaved, submit, receipt = hasId, successMessage, children }: FormProps) {
    const dialog = useRef<HTMLDialogElement>(null);
    const headingId = useId();
    const descriptionId = useId();
    const formId = useId();
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadError, setReloadError] = useState(false);
    const locked = useRef(false);
    const pendingSubmit = useRef<{
        id: string;
        submit: (operationId: string) => Promise<MutationResult>;
    } | null>(null);
    const alive = useRef(true);
    const tenantId = useServiceTenantId();
    const confirmLeave = useUnsavedWebChanges(dirty && !success, saving || uncertain);
    useEffect(() => {
        alive.current = true;
        const node = dialog.current;
        node?.showModal();
        node?.querySelector<HTMLElement>('.cbm-fields input, .cbm-fields select, .cbm-fields textarea, .cbm-fields button')?.focus();
        return () => {
            alive.current = false;
            if (node?.open)
                node.close();
        };
    }, []);
    async function close() {
        if (!locked.current && !uncertain && await confirmLeave())
            onClose();
    }
    async function refresh() {
        if (locked.current)
            return;
        locked.current = true;
        setSaving(true);
        try {
            await onSaved();
            if (alive.current) {
                setReloadError(false);
            }
        }
        catch {
            if (alive.current)
                setReloadError(true);
        }
        finally {
            locked.current = false;
            if (alive.current)
                setSaving(false);
        }
    }
    async function save(reconcile = false) {
        if (locked.current || success || (!reconcile && (isReadOnly || blocked || conflict || uncertain)))
            return;
        if (!tenantId) {
            setError('Die Unternehmenszuordnung fehlt. Bitte die Ansicht neu laden.');
            return;
        }
        if (!reconcile || !pendingSubmit.current) {
            const id = crypto?.randomUUID?.();
            if (!id) {
                setError('Die sichere Auftragskennung fehlt. Bitte die Seite neu laden.');
                return;
            }
            pendingSubmit.current = { id, submit };
        }
        locked.current = true;
        setSaving(true);
        setError(null);
        try {
            const result = await pendingSubmit.current.submit(pendingSubmit.current.id);
            if (!alive.current)
                return;
            if (!result.ok) {
                setError(result.error);
                setUncertain(Boolean(result.uncertain));
                if (!result.uncertain)
                    pendingSubmit.current = null;
                return;
            }
            if (!receipt(result.data)) {
                setUncertain(true);
                setError('Die Speicherung wurde nicht vollständig bestätigt. Bitte den Speicherstand prüfen. Dabei wird derselbe Vorgang abgeglichen und keine zweite Buchung angelegt.');
                return;
            }
            setUncertain(false);
            setSuccess(true);
            try {
                await onSaved();
            }
            catch {
                if (alive.current)
                    setReloadError(true);
            }
        }
        catch {
            if (alive.current) {
                setUncertain(true);
                setError('Die Verbindung wurde unterbrochen. Ob die Änderung gespeichert wurde, ist noch unklar. Bitte den Speicherstand prüfen, um denselben Vorgang sicher abzugleichen.');
            }
        }
        finally {
            locked.current = false;
            if (alive.current)
                setSaving(false);
        }
    }
    if (typeof document === 'undefined')
        return null;
    return <NativeWorkspaceStyleScope css={[budgetModalCss, budgetModalCss]}>{<><NativeStyle>{budgetModalCss}</NativeStyle><NativeDialog ref={dialog} className="cbm-dialog" aria-labelledby={headingId} aria-describedby={subtitle ? descriptionId : undefined} onCancel={event => { event.preventDefault(); void close(); }}>
    <NativeDiv className="cbm-shell"><NativeHeader className="cbm-header"><NativeDiv><NativeSpan className="cbm-eyebrow">BUDGETS · ÄNDERUNG</NativeSpan><NativeH2 id={headingId}>{title}</NativeH2>{subtitle && <NativeP id={descriptionId}>{subtitle}</NativeP>}</NativeDiv><NativeButton className="cbm-close" type="button" aria-label="Dialog schließen" disabled={saving || uncertain} onClick={() => void close()}>×</NativeButton></NativeHeader>
      <NativeDiv className="cbm-body"><NativeForm id={formId} className="cbm-form" noValidate aria-busy={saving} onSubmit={event => { event.preventDefault(); void save(); }}>
        {conflict && !success && !uncertain && <NativeDiv role="alert"><Banner variant="warning">Diese Angaben wurden zwischenzeitlich geändert. Ihre Eingaben bleiben erhalten. Bitte den Dialog schließen und mit dem aktuellen Stand erneut öffnen.</Banner></NativeDiv>}
        {isReadOnly && <Banner>Sie können diese Angaben ansehen. Für Änderungen fehlt die Berechtigung.</Banner>}
        <NativeFieldset className="cbm-fields" disabled={saving || success || uncertain || isReadOnly}>{children}</NativeFieldset>
        {error && <NativeDiv role="alert"><Banner variant="error">{error}</Banner></NativeDiv>}
        {success && <NativeDiv role="status"><Banner variant="success">{successMessage}</Banner></NativeDiv>}
        {reloadError && <NativeDiv role="alert"><Banner variant="warning">{success ? 'Die Änderung ist gespeichert, die Übersicht konnte jedoch noch nicht aktualisiert werden.' : 'Die Übersicht konnte nicht geladen werden. Bitte prüfen Sie den Speicherstand vor einer erneuten Änderung.'}</Banner></NativeDiv>}
        {uncertain && <NativeDiv><NativeButton type="button" className="cbm-button cbm-retry" disabled={saving} onClick={() => void save(true)}>Speicherstand prüfen</NativeButton></NativeDiv>}{reloadError && <NativeDiv><NativeButton type="button" className="cbm-button cbm-retry" disabled={saving} onClick={() => void refresh()}>Übersicht aktualisieren</NativeButton></NativeDiv>}
      </NativeForm></NativeDiv>
      <NativeFooter className="cbm-footer"><NativeSpan className="cbm-footer-note" aria-live="polite">{saving ? 'Bitte warten, der Vorgang wird abgeschlossen …' : success ? 'Änderung gespeichert' : uncertain ? 'Speicherstand zuerst prüfen' : dirty ? 'Ungespeicherte Eingaben' : 'Änderungen werden erst beim Bestätigen gespeichert.'}</NativeSpan><NativeDiv className="cbm-actions"><NativeButton className="cbm-button" type="button" disabled={saving || uncertain} onClick={() => void close()}>{success ? 'Fertig' : 'Abbrechen'}</NativeButton>{!success && <NativeButton className={`cbm-button ${danger ? 'cbm-button--danger' : 'cbm-button--primary'}`} type="submit" form={formId} disabled={saving || isReadOnly || Boolean(blocked) || Boolean(conflict) || uncertain || !tenantId}>{saving ? 'Wird gespeichert …' : action}</NativeButton>}</NativeDiv></NativeFooter>
    </NativeDiv>
  </NativeDialog></>}</NativeWorkspaceStyleScope>;
}
function careFingerprint(profile: ClientAssistBillingProfile['careEntitlement']): string {
    return JSON.stringify(profile ? [profile.id, profile.careGrade, profile.validFrom, profile.validUntil, profile.conversionEnabled, profile.careFundName, profile.careFundMemberId] : null);
}
/** Each opening mounts a fresh draft. Profile polling cannot overwrite an open form. */
export function EditCareGradeModal(props: ProfileProps) { return props.visible ? <CareGradeForm key={props.clientId} {...props}/> : null; }
function CareGradeForm(props: ProfileProps) {
    const [opening] = useState(props.profile.careEntitlement);
    const conflict = careFingerprint(opening) !== careFingerprint(props.profile.careEntitlement);
    const tenantId = useServiceTenantId();
    const [initial] = useState(() => ({ careGrade: props.profile.careGrade ?? 'kein', effectiveFrom: budgetModalToday(), reason: '' }));
    const [draft, setDraft] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});
    const patch = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
    async function submit(operationId: string): Promise<MutationResult> {
        const next = { effectiveFrom: !isBudgetModalDate(draft.effectiveFrom) || draft.effectiveFrom > budgetModalToday() ? 'Bitte ein gültiges Datum bis heute wählen.' : undefined, reason: budgetModalReasonError(draft.reason) };
        setErrors(next);
        if (Object.values(next).some(Boolean))
            return { ok: false, error: 'Bitte die markierten Angaben prüfen.' };
        return changeClientCareGrade(tenantId!, props.clientId, { newCareGrade: draft.careGrade as ClientCareGrade, effectiveFrom: draft.effectiveFrom, reason: draft.reason.trim() }, operationId, opening);
    }
    return <NativeWorkspaceStyleScope css={[budgetModalCss]}>{<BudgetForm {...props} conflict={conflict} title="Pflegegrad bearbeiten" subtitle="Pflegegrad und Beginn des Anspruchs dokumentieren. Bestehende Budgetbewegungen bleiben erhalten." dirty={JSON.stringify(draft) !== JSON.stringify(initial)} submit={submit} successMessage={`Die Angabe „${formatCareLevel(draft.careGrade as ClientCareGrade)}“ wurde gespeichert.`}>
    <NativeDiv><NativeP className="cbm-field-title">Pflegegrad</NativeP><NativeDiv className="cbm-choice-list" role="group" aria-label="Pflegegrad">{CARE_GRADE_OPTIONS.map(option => <NativeButton className="cbm-choice" type="button" key={option.key} aria-pressed={draft.careGrade === option.key} onClick={() => patch('careGrade', option.key)}>{option.label}</NativeButton>)}</NativeDiv></NativeDiv>
    <Field label="Gültig ab" error={errors.effectiveFrom}><NativeInput type="date" max={budgetModalToday()} aria-label="Gültig ab" value={draft.effectiveFrom} aria-invalid={Boolean(errors.effectiveFrom)} onChange={event => patch('effectiveFrom', event.target.value)}/></Field>
    <Reason value={draft.reason} onChange={value => patch('reason', value)} error={errors.reason}/>
  </BudgetForm>}</NativeWorkspaceStyleScope>;
}
export function EditCareFundModal(props: ProfileProps) { return props.visible ? <CareFundForm key={props.clientId} {...props}/> : null; }
function CareFundForm(props: ProfileProps) {
    const [opening] = useState(props.profile.careEntitlement);
    const conflict = careFingerprint(opening) !== careFingerprint(props.profile.careEntitlement);
    const tenantId = useServiceTenantId();
    const [initial] = useState(() => ({ name: props.profile.careEntitlement?.careFundName ?? '', memberId: props.profile.careEntitlement?.careFundMemberId ?? '', reason: '' }));
    const [draft, setDraft] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});
    const patch = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
    async function submit(operationId: string): Promise<MutationResult> {
        const next = { name: !draft.name.trim() ? 'Bitte die Pflegekasse angeben.' : undefined, reason: budgetModalReasonError(draft.reason) };
        setErrors(next);
        if (Object.values(next).some(Boolean))
            return { ok: false, error: 'Bitte die markierten Angaben prüfen.' };
        if (draft.name.trim() === initial.name && draft.memberId.trim() === initial.memberId)
            return { ok: false, error: 'Pflegekasse und Versichertennummer sind unverändert.' };
        return updateClientCareFund(tenantId!, props.clientId, { careFundName: draft.name.trim(), careFundMemberId: draft.memberId.trim(), reason: draft.reason.trim() }, operationId, opening);
    }
    return <NativeWorkspaceStyleScope css={[budgetModalCss]}>{<BudgetForm {...props} conflict={conflict} title="Pflegekasse bearbeiten" subtitle="Die Versichertennummer gehört zur hier eingetragenen Pflegekasse." dirty={JSON.stringify(draft) !== JSON.stringify(initial)} submit={submit} successMessage="Pflegekasse und Versichertennummer wurden gespeichert." blocked={!props.profile.careEntitlement}>
    {!props.profile.careEntitlement && <Banner variant="warning">Bitte zuerst den Pflegegrad und den Anspruch hinterlegen.</Banner>}
    <Field label="Pflegekasse" error={errors.name}><NativeInput autoComplete="off" aria-label="Pflegekasse" aria-invalid={Boolean(errors.name)} value={draft.name} maxLength={240} onChange={event => patch('name', event.target.value)}/></Field>
    <Field label="Versichertennummer"><NativeInput autoComplete="off" aria-label="Versichertennummer" value={draft.memberId} maxLength={100} onChange={event => patch('memberId', event.target.value)}/></Field>
    <Reason value={draft.reason} onChange={value => patch('reason', value)} error={errors.reason}/>
  </BudgetForm>}</NativeWorkspaceStyleScope>;
}
export function EditValidFromModal(props: ProfileProps) { return props.visible ? <ValidFromForm key={props.clientId} {...props}/> : null; }
function ValidFromForm(props: ProfileProps) {
    const [opening] = useState(props.profile.careEntitlement);
    const conflict = careFingerprint(opening) !== careFingerprint(props.profile.careEntitlement);
    const tenantId = useServiceTenantId();
    const [initial] = useState(() => props.profile.careEntitlement?.validFrom ?? budgetModalToday());
    const [validFrom, setValidFrom] = useState(initial);
    const [reason, setReason] = useState('');
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});
    async function submit(operationId: string): Promise<MutationResult> {
        const next = { date: !isBudgetModalDate(validFrom) || validFrom > budgetModalToday() ? 'Bitte ein gültiges Datum bis heute wählen.' : undefined, reason: budgetModalReasonError(reason) };
        setErrors(next);
        if (Object.values(next).some(Boolean))
            return { ok: false, error: 'Bitte die markierten Angaben prüfen.' };
        if (validFrom === initial)
            return { ok: false, error: 'Das Gültigkeitsdatum ist unverändert.' };
        return updateCareEntitlementValidFrom(tenantId!, props.clientId, { validFrom, reason: reason.trim() }, operationId, opening);
    }
    return <NativeWorkspaceStyleScope css={[budgetModalCss]}>{<BudgetForm {...props} conflict={conflict} title="Bescheiddatum bearbeiten" subtitle="Beginn des bestehenden Pflegegrad-Anspruchs korrigieren." dirty={validFrom !== initial || Boolean(reason)} submit={submit} successMessage="Das Gültigkeitsdatum wurde gespeichert." blocked={!props.profile.careEntitlement}>
    {!props.profile.careEntitlement && <Banner variant="warning">Es ist noch kein Pflegegrad-Anspruch hinterlegt.</Banner>}
    <Field label="Gültig ab" error={errors.date}><NativeInput type="date" max={budgetModalToday()} aria-label="Gültig ab" aria-invalid={Boolean(errors.date)} value={validFrom} onChange={event => setValidFrom(event.target.value)}/></Field>
    <Reason value={reason} onChange={setReason} error={errors.reason}/>
  </BudgetForm>}</NativeWorkspaceStyleScope>;
}
export function ConversionToggleModal(props: ProfileProps) { return props.visible ? <ConversionForm key={props.clientId} {...props}/> : null; }
function ConversionForm(props: ProfileProps) {
    const [opening] = useState(props.profile.careEntitlement);
    const conflict = careFingerprint(opening) !== careFingerprint(props.profile.careEntitlement);
    const tenantId = useServiceTenantId();
    const [target] = useState(() => !props.profile.careEntitlement?.conversionEnabled);
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState<string>();
    const eligible = !target || props.profile.conversionEligible;
    async function submit(operationId: string): Promise<MutationResult> {
        const error = budgetModalReasonError(reason);
        setReasonError(error);
        if (error)
            return { ok: false, error };
        return setClientConversionEnabled(tenantId!, props.clientId, target, reason.trim(), operationId, opening);
    }
    return <NativeWorkspaceStyleScope css={[budgetModalCss]}>{<BudgetForm {...props} conflict={conflict} title={`Umwandlung § 45a ${target ? 'aktivieren' : 'deaktivieren'}`} subtitle="Bestehende Budgetbewegungen bleiben erhalten." action={target ? 'Umwandlung aktivieren' : 'Umwandlung deaktivieren'} dirty={Boolean(reason)} submit={submit} successMessage={`Die Umwandlung wurde ${target ? 'aktiviert' : 'deaktiviert'}.`} blocked={!eligible || !props.profile.careEntitlement}>
    <Banner variant={eligible ? 'info' : 'warning'}>{!eligible ? 'Für den hinterlegten Pflegegrad ist die Umwandlung nicht verfügbar.' : target ? 'Neue Abrechnungen können das Umwandlungsbudget nutzen. Die verfügbaren Beträge richten sich nach dem hinterlegten Budgetkatalog.' : 'Neue Reservierungen und Verbräuche aus dem Umwandlungsbudget werden gesperrt. Bereits gebuchte Beträge bleiben im Verlauf erhalten.'}</Banner>
    {!props.profile.careEntitlement && <Banner variant="warning">Bitte zuerst einen Pflegegrad-Anspruch hinterlegen.</Banner>}
    <Reason value={reason} onChange={setReason} error={reasonError}/>
  </BudgetForm>}</NativeWorkspaceStyleScope>;
}
type CorrectionProps = ModalBaseProps & {
    clientId: string;
    accounts: ClientBudgetAccount[];
    preselectedAccountId?: string | null;
};
export function BudgetCorrectionModal(props: CorrectionProps) { return props.visible ? <CorrectionForm key={props.clientId} {...props}/> : null; }
function accountLabel(account: ClientBudgetAccount): string { return `${account.label ?? account.catalogKey} · ${formatDate(account.periodStart)} – ${formatDate(account.periodEnd)}`; }
function CorrectionForm(props: CorrectionProps) {
    const tenantId = useServiceTenantId();
    const accounts = props.accounts.filter(account => account.clientId === props.clientId && account.status === 'active' && account.isEnabled !== false && !account.locked);
    const [initial] = useState(() => ({ accountId: accounts.some(account => account.id === props.preselectedAccountId) ? props.preselectedAccountId! : accounts.length === 1 ? accounts[0].id : '', amount: '', date: budgetModalToday(), reason: '' }));
    const [draft, setDraft] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});
    const patch = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
    const cents = parseBudgetModalAmount(draft.amount);
    const selected = accounts.find(account => account.id === draft.accountId);
    async function submit(operationId: string): Promise<MutationResult> {
        const next = { account: !selected ? 'Bitte ein verfügbares Budgetkonto auswählen.' : undefined, amount: cents == null || cents === 0 ? 'Bitte einen Betrag mit höchstens zwei Nachkommastellen eingeben. 0,00 € ist keine Korrektur.' : undefined, date: !isBudgetModalDate(draft.date) || draft.date > budgetModalToday() ? 'Bitte ein gültiges Datum bis heute wählen.' : selected && (draft.date < selected.periodStart || draft.date > selected.periodEnd) ? 'Das Datum muss im Zeitraum des gewählten Kontos liegen.' : undefined, reason: budgetModalReasonError(draft.reason) };
        setErrors(next);
        if (Object.values(next).some(Boolean))
            return { ok: false, error: 'Bitte die markierten Angaben prüfen.' };
        return bookBudgetCorrection(tenantId!, props.clientId, { budgetAccountId: draft.accountId, amountCents: cents!, effectiveDate: draft.date, reason: draft.reason.trim() }, operationId);
    }
    return <NativeWorkspaceStyleScope css={[budgetModalCss]}>{<BudgetForm {...props} title="Budget korrigieren" subtitle="Eine Korrektur ändert den zugeteilten Betrag und bleibt im Budgetverlauf nachvollziehbar." action="Korrektur buchen" dirty={JSON.stringify(draft) !== JSON.stringify(initial)} submit={submit} successMessage="Die Budgetkorrektur wurde gebucht." blocked={!accounts.length} receipt={data => Boolean(data && typeof data === 'object' && 'transactionId' in data && data.transactionId)}>
    {!accounts.length ? <Banner variant="warning">Es gibt kein aktives, freigegebenes Budgetkonto für eine Korrektur.</Banner> : <Field label="Budgetkonto" error={errors.account}><NativeSelect aria-label="Budgetkonto" value={draft.accountId} aria-invalid={Boolean(errors.account)} onChange={event => patch('accountId', event.target.value)}><NativeOption value="">Budgetkonto auswählen</NativeOption>{accounts.map(account => <NativeOption key={account.id} value={account.id}>{accountLabel(account)}</NativeOption>)}</NativeSelect></Field>}
    <NativeDiv className="cbm-grid"><Field label="Korrekturbetrag (€)" error={errors.amount} hint="Positiv erhöht, negativ verringert das Budget."><NativeInput aria-label="Korrekturbetrag (€)" inputMode="decimal" value={draft.amount} aria-invalid={Boolean(errors.amount)} onChange={event => patch('amount', event.target.value)} placeholder="z. B. 50,00 oder -25,00" maxLength={20}/></Field><Field label="Wirksamkeitsdatum" error={errors.date}><NativeInput aria-label="Wirksamkeitsdatum" type="date" value={draft.date} aria-invalid={Boolean(errors.date)} min={selected?.periodStart} max={selected && selected.periodEnd < budgetModalToday() ? selected.periodEnd : budgetModalToday()} onChange={event => patch('date', event.target.value)}/></Field></NativeDiv>
    {selected && cents != null && cents !== 0 && <NativeDiv className="cbm-summary"><NativeSpan>Zugeteilter Betrag nach Korrektur</NativeSpan><NativeStrong>{formatCurrency(selected.allocatedCents + cents, true)}</NativeStrong></NativeDiv>}
    <Reason value={draft.reason} onChange={value => patch('reason', value)} error={errors.reason}/>
  </BudgetForm>}</NativeWorkspaceStyleScope>;
}
type ExternalProps = ModalBaseProps & {
    accounts: ClientBudgetAccount[];
    asOfDate?: string;
};
export function ExternalSachleistungModal(props: ExternalProps) { return props.visible ? <ExternalForm {...props}/> : null; }
function ExternalForm(props: ExternalProps) {
    const tenantId = useServiceTenantId();
    const [asOf] = useState(() => props.asOfDate ?? budgetModalToday());
    const accounts = props.accounts.filter(account => account.catalogKey.startsWith('umwandlung_') && account.status === 'active' && account.isEnabled !== false && !account.locked && account.periodStart <= asOf && account.periodEnd >= asOf);
    const [accountId, setAccountId] = useState(() => accounts.length === 1 ? accounts[0].id : '');
    const [opening, setOpening] = useState<ClientBudgetAccount | undefined>(() => accounts.length === 1 ? accounts[0] : undefined);
    const [amount, setAmount] = useState(() => accounts.length === 1 ? String((accounts[0].externalSachleistungCents ?? 0) / 100).replace('.', ',') : '');
    const [initialAmount, setInitialAmount] = useState(amount);
    const [reason, setReason] = useState('');
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});
    const account = accounts.find(item => item.id === accountId);
    const conflict = Boolean(opening && (!account || (account.externalSachleistungCents ?? 0) !== (opening.externalSachleistungCents ?? 0)));
    async function submit(operationId: string): Promise<MutationResult> {
        const cents = parseBudgetModalAmount(amount);
        const next = { account: !account ? 'Bitte ein Budgetkonto auswählen.' : undefined, amount: cents == null || cents < 0 ? 'Bitte einen Betrag ab 0,00 € mit höchstens zwei Nachkommastellen eingeben.' : undefined, reason: budgetModalReasonError(reason) };
        setErrors(next);
        if (Object.values(next).some(Boolean))
            return { ok: false, error: 'Bitte die markierten Angaben prüfen.' };
        if (cents === (account!.externalSachleistungCents ?? 0))
            return { ok: false, error: 'Der eingetragene Betrag ist unverändert.' };
        return updateClientBudgetAccount(tenantId!, account!.clientId, account!.id, { externalSachleistungCents: cents!, auditReason: reason.trim() }, operationId, opening);
    }
    return <NativeWorkspaceStyleScope css={[budgetModalCss]}>{<BudgetForm {...props} conflict={conflict} title="Pflegedienstanteil eintragen" subtitle={`Pflegesachleistungen anderer Anbieter für den Zeitraum zum ${formatDate(asOf)}.`} action="Betrag übernehmen" dirty={amount !== initialAmount || Boolean(reason)} submit={submit} successMessage="Der Pflegedienstanteil wurde gespeichert." blocked={!accounts.length}>
    <Banner>Der Gesamtbetrag aus Leistungen anderer Anbieter fließt in die Pflegegeldprognose ein. Tragen Sie den bekannten Betrag für den ausgewählten Kontomonat ein.</Banner>
    {!accounts.length ? <Banner variant="warning">Für diesen Zeitraum ist kein aktives Umwandlungskonto vorhanden.</Banner> : <Field label="Kontomonat" error={errors.account}><NativeSelect aria-label="Kontomonat" value={accountId} aria-invalid={Boolean(errors.account)} onChange={event => { setAccountId(event.target.value); const selected = accounts.find(item => item.id === event.target.value); setOpening(selected); const value = selected ? String((selected.externalSachleistungCents ?? 0) / 100).replace('.', ',') : ''; setAmount(value); setInitialAmount(value); }}><NativeOption value="">Kontomonat auswählen</NativeOption>{accounts.map(item => <NativeOption key={item.id} value={item.id}>{accountLabel(item)}</NativeOption>)}</NativeSelect></Field>}
    <Field label="Pflegesachleistung anderer Anbieter (€)" error={errors.amount}><NativeInput aria-label="Pflegesachleistung anderer Anbieter (€)" inputMode="decimal" value={amount} aria-invalid={Boolean(errors.amount)} onChange={event => setAmount(event.target.value)} maxLength={20}/></Field>
    <Reason value={reason} onChange={setReason} error={errors.reason} label="Quelle / Begründung"/>
  </BudgetForm>}</NativeWorkspaceStyleScope>;
}
export function BudgetRecalcModal(props: ProfileProps) { return props.visible ? <RecalcForm key={props.clientId} {...props}/> : null; }
function RecalcForm(props: ProfileProps) {
    const tenantId = useServiceTenantId();
    const [initial] = useState(props.profile);
    const [diffs, setDiffs] = useState<BudgetRecalcDiff[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState<string>();
    useEffect(() => {
        let alive = true;
        setLoading(true);
        setLoadError(null);
        setDiffs([]);
        if (!tenantId) {
            setLoading(false);
            setLoadError('Die Unternehmenszuordnung fehlt.');
            return;
        }
        void previewBudgetRecalculationFromCatalog(tenantId, props.clientId, initial.budgetYear, initial.careGrade, initial.conversionEligible, initial.careEntitlement, initial.asOfDate).then(result => {
            if (!alive)
                return;
            if (result.ok)
                setDiffs(result.data);
            else
                setLoadError(result.error);
        }).catch(() => {
            if (alive)
                setLoadError('Die Budgetvorschau konnte nicht geladen werden. Bitte erneut versuchen.');
        }).finally(() => {
            if (alive)
                setLoading(false);
        });
        return () => { alive = false; };
    }, [tenantId, props.clientId, initial, retry]);
    const applicable = diffs.filter(diff => !diff.skipped && (diff.deltaCents !== 0 || diff.create));
    async function submit(operationId: string): Promise<MutationResult> {
        const error = budgetModalReasonError(reason);
        setReasonError(error);
        if (error)
            return { ok: false, error };
        if (loading || loadError || !applicable.length)
            return { ok: false, error: 'Bitte zuerst eine aktuelle Budgetvorschau laden.' };
        return applyBudgetRecalculation(tenantId!, props.clientId, diffs, reason.trim(), operationId);
    }
    return <NativeWorkspaceStyleScope css={[budgetModalCss]}>{<BudgetForm {...props} title="Budgets mit Katalog abgleichen" subtitle={`Vorschau für ${initial.budgetYear}. Individuell vereinbarte Beträge werden nicht überschrieben.`} action="Änderungen übernehmen" dirty={Boolean(reason)} submit={submit} successMessage={`${applicable.length} ${applicable.length === 1 ? 'Budgetkonto wurde' : 'Budgetkonten wurden'} aktualisiert.`} blocked={loading || Boolean(loadError) || !applicable.length} receipt={data => Boolean(data && typeof data === 'object' && 'updated' in data && data.updated === applicable.length && applicable.length > 0)}>
    {loading && <NativeDiv role="status"><Banner>Budgetkonten und Katalog werden geprüft …</Banner></NativeDiv>}
    {loadError && <NativeDiv role="alert"><Banner variant="error">{loadError}</Banner><NativeButton className="cbm-button cbm-retry" type="button" onClick={() => setRetry(value => value + 1)}>Vorschau erneut laden</NativeButton></NativeDiv>}
    {!loading && !loadError && !diffs.length && <Banner>Es wurden keine abgleichbaren Budgetkonten gefunden.</Banner>}
    {!loading && !loadError && diffs.length > 0 && <><NativeDiv className="cbm-summary"><NativeSpan>{applicable.length ? `${applicable.length} ${applicable.length === 1 ? 'Konto mit Änderung' : 'Konten mit Änderungen'}` : 'Alle Konten sind auf dem aktuellen Stand'}</NativeSpan><NativeStrong>{formatCurrency(applicable.reduce((sum, diff) => sum + diff.deltaCents, 0), true)}</NativeStrong></NativeDiv><NativeDiv className="cbm-recalc-list">{diffs.map(diff => <NativeArticle className="cbm-recalc-row" key={diff.accountId}><NativeDiv className="cbm-recalc-title"><NativeSpan>{diff.label}</NativeSpan><NativeSpan className={`cbm-badge${diff.skipped ? ' cbm-badge--neutral' : ''}`}>{diff.skipped ? 'Unverändert' : diff.create ? 'Neues Konto' : 'Wird angepasst'}</NativeSpan></NativeDiv>{diff.periodStart && <NativeP className="cbm-note">{formatDate(diff.periodStart)}{diff.periodEnd ? ` bis ${formatDate(diff.periodEnd)}` : ''}</NativeP>}<NativeDiv className="cbm-recalc-numbers"><NativeDiv><NativeSmall>Bisher zugeteilt</NativeSmall><NativeStrong>{formatCurrency(diff.currentAllocatedCents, true)}</NativeStrong></NativeDiv><NativeDiv><NativeSmall>Laut Katalog</NativeSmall><NativeStrong>{formatCurrency(diff.catalogAmountCents, true)}</NativeStrong></NativeDiv><NativeDiv><NativeSmall>Änderung</NativeSmall><NativeStrong>{formatCurrency(diff.deltaCents, true)}</NativeStrong></NativeDiv></NativeDiv>{diff.skipReason && <NativeP className="cbm-note">{diff.skipReason}</NativeP>}</NativeArticle>)}</NativeDiv></>}
    <Reason value={reason} onChange={setReason} error={reasonError}/>
  </BudgetForm>}</NativeWorkspaceStyleScope>;
}
type DeactivateProps = ModalBaseProps & {
    clientId: string;
    account: ClientBudgetAccount | null;
};
export function BudgetDeactivateModal(props: DeactivateProps) { return props.visible && props.account ? <DeactivateForm key={props.account.id} {...props} account={props.account}/> : null; }
function DeactivateForm(props: DeactivateProps & {
    account: ClientBudgetAccount;
}) {
    const tenantId = useServiceTenantId();
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState<string>();
    async function submit(operationId: string): Promise<MutationResult> {
        const error = budgetModalReasonError(reason);
        setReasonError(error);
        if (error)
            return { ok: false, error };
        return deactivateClientBudgetAccount(tenantId!, props.clientId, props.account.id, reason.trim(), operationId);
    }
    return <NativeWorkspaceStyleScope css={[budgetModalCss]}>{<BudgetForm {...props} title="Budgetkonto deaktivieren" subtitle={accountLabel(props.account)} action="Konto deaktivieren" danger dirty={Boolean(reason)} submit={submit} successMessage="Das Budgetkonto wurde deaktiviert." blocked={!props.account.isEnabled || props.account.clientId !== props.clientId}>
    <Banner variant="warning">Das Konto steht anschließend nicht mehr für neue Buchungen zur Verfügung. Historische Budgetbewegungen bleiben erhalten.</Banner>
    <Reason value={reason} onChange={setReason} error={reasonError}/>
  </BudgetForm>}</NativeWorkspaceStyleScope>;
}
