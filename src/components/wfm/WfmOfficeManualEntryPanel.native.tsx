// Generated native presentation from src/components/wfm/WfmOfficeManualEntryPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSection,NativeStyle,NativeDiv,NativeH3,NativeP,NativeForm,NativeFieldset,NativeLabel,NativeSpan,NativeSelect,NativeOption,NativeInput,NativeStrong,NativeTextarea,NativeSmall,NativeButton,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useIsFocused, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { createWfmOfficeManualEntry } from "../../lib/wfm/wfmOfficeTimekeepingService.native.ts";
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { confirmAction } from '@/lib/platform/confirmAction';
import type { RoleKey } from '@/types';
import type { WfmEditorState } from "./WfmOfficeTimeHistoryPanel.native.tsx";
import { accountDuration } from "./wfmTimeAccountsModel.native.ts";
import { berlinClockCandidates, berlinWorkDate, manualEntryRequest, resolveBerlinClock, validManualDate, validateManualEntryDraft, type BerlinClockChoice, type ManualEntryDraft } from "./wfmManualEntryDraft.native.ts";
import { wfmTimeAccountsCss } from "./wfmTimeAccountsCss.native.ts";
type Props = {
    tenantId: string;
    actorId: string;
    roleKey: RoleKey | null;
    employees: {
        id: string;
        name: string;
    }[];
    initialDate?: string;
    initialEmployeeId?: string;
    onChanged?: () => Promise<void>;
    onEditorStateChange?: (state: WfmEditorState) => void;
};
export function WfmOfficeManualEntryPanel(props: Props) {
    return <NativeWorkspaceStyleScope css={[wfmTimeAccountsCss, `
    .wta-manual-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.wta-manual-grid .wta-field-wide{grid-column:1/-1}.wta-field textarea{width:100%;min-width:0;min-height:100px;resize:vertical;border:1px solid #bccfe4;border-radius:10px;padding:10px 12px;color:#152b46;background:white;font:inherit;line-height:1.5}.wta-time-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.wta-manual-summary{display:flex;flex-wrap:wrap;gap:12px;padding:12px 14px;border:1px solid #d7e2ef;border-radius:10px;background:#f3f7fc;font-variant-numeric:tabular-nums}.wta-manual-summary span{color:#52657c}.wta-manual-summary strong{color:#152b46;margin-left:5px}.wta-fieldset{border:0;margin:0;padding:0;min-width:0;display:grid;gap:15px}.wta-message[data-tone=success]{background:#edf8f2;border-color:#bddccb;color:#1b6843}@container(max-width:570px){.wta-manual-grid{grid-template-columns:1fr}.wta-time-pair{grid-template-columns:1fr}}
  `]}>{<ManualEntry key={JSON.stringify([props.tenantId, props.actorId, props.roleKey, props.initialDate, props.initialEmployeeId])} {...props}/>}</NativeWorkspaceStyleScope>;
}
function ManualEntry({ tenantId, actorId, roleKey, employees, initialDate, initialEmployeeId, onChanged, onEditorStateChange }: Props) {
    const window = useNativeWorkflowWindow();
    const auth = useAuth();
    const serviceTenantId = useServiceTenantId();
    const { can, roleKey: currentRole } = usePermissions();
    const focused = useIsFocused();
    const navigation = useNavigation();
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id === actorId && tenantId === serviceTenantId && roleKey === currentRole && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('time.tracking.admin.correct'));
    const [initial] = useState<ManualEntryDraft>(() => {
        const date = initialDate && validManualDate(initialDate) ? initialDate : berlinWorkDate();
        return { employeeId: initialEmployeeId ?? employees[0]?.id ?? '', workDate: date, endDate: date, startTime: '08:00', endTime: '16:00', startClock: 'auto', endClock: 'auto', pauseMinutes: '30', workKind: 'buero', reason: '' };
    });
    const [draft, setDraft] = useState<ManualEntryDraft>(initial);
    const [baseline, setBaseline] = useState(JSON.stringify(initial));
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [refreshWarning, setRefreshWarning] = useState('');
    const [busy, setBusy] = useState(false);
    const saving = useRef(false);
    const mounted = useRef(true);
    const notice = useRef<HTMLDivElement>(null);
    const request = useRef<{
        fingerprint: string;
        id: string;
    } | null>(null);
    const callback = useRef(onEditorStateChange);
    callback.current = onEditorStateChange;
    const dirty = JSON.stringify(draft) !== baseline;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; callback.current?.({ dirty: false, busy: false, childOpen: false }); }; }, []);
    useEffect(() => { callback.current?.({ dirty, busy, childOpen: false }); }, [dirty, busy]);
    usePreventRemove(!onEditorStateChange && (dirty || busy), async ({ data }) => { if (!saving.current && (!dirty || await confirmNativeWorkspaceAction('Ungespeicherten Nachtrag verwerfen?')))
        navigation.dispatch(data.action); });
    useEffect(() => {
        if (!dirty && !busy)
            return;
        const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [dirty, busy]);
    useEffect(() => { if (error || success)
        notice.current?.focus({ preventScroll: true }); }, [error, success]);
    const startCandidates = berlinClockCandidates(draft.workDate, draft.startTime);
    const endCandidates = berlinClockCandidates(draft.endDate, draft.endTime);
    const start = resolveBerlinClock(draft.workDate, draft.startTime, draft.startClock);
    const end = resolveBerlinClock(draft.endDate, draft.endTime, draft.endClock);
    const gross = start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 60000) : NaN;
    const pause = /^\d+$/.test(draft.pauseMinutes) ? Number(draft.pauseMinutes) : NaN;
    const durationValid = Number.isFinite(gross) && gross > 0 && Number.isSafeInteger(pause) && pause >= 0 && pause <= gross;
    function change<K extends keyof ManualEntryDraft>(field: K, value: ManualEntryDraft[K]) {
        if (saving.current)
            return;
        setDraft(current => ({ ...current, [field]: value,
            ...(field === 'workDate' ? { endDate: current.endDate === current.workDate ? String(value) : current.endDate, startClock: 'auto' as const, ...(current.endDate === current.workDate ? { endClock: 'auto' as const } : {}) } : {}),
            ...(field === 'startTime' ? { startClock: 'auto' as const } : {}),
            ...(field === 'endDate' || field === 'endTime' ? { endClock: 'auto' as const } : {}),
        }));
        setError('');
        setSuccess('');
        setRefreshWarning('');
    }
    async function reset() {
        if (saving.current || !focused)
            return;
        if (dirty && !await confirmAction({ title: 'Nachtrag zurücksetzen', message: 'Möchten Sie die eingegebenen Änderungen verwerfen?', confirmLabel: 'Zurücksetzen' }))
            return;
        setDraft(initial);
        setBaseline(JSON.stringify(initial));
        setError('');
        setSuccess('');
        setRefreshWarning('');
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving.current || !focused)
            return;
        setError('');
        setSuccess('');
        setRefreshWarning('');
        if (!allowed) {
            setError('Der Verwaltungszugang oder die Berechtigung für Nachträge ist nicht mehr verfügbar.');
            return;
        }
        const validated = validateManualEntryDraft(draft, employees.map(employee => employee.id));
        if (!validated.ok) {
            setError(validated.error);
            return;
        }
        saving.current = true;
        setBusy(true);
        try {
            request.current = manualEntryRequest(request.current, validated.input, () => crypto.randomUUID());
            const result = await withServiceQueryTimeout(createWfmOfficeManualEntry(tenantId, actorId, roleKey, { ...validated.input, entryId: request.current.id }), 'Speichern des Nachtrags');
            if (!mounted.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            request.current = null;
            const next = { ...draft, reason: '' };
            setDraft(next);
            setBaseline(JSON.stringify(next));
            setSuccess(`Nachtrag für ${result.data.employeeName} gespeichert: ${accountDuration(result.data.netMinutes)} am ${draft.workDate.split('-').reverse().join('.')}. Der Eintrag steht zur Prüfung bereit.`);
            try {
                await onChanged?.();
            }
            catch {
                if (mounted.current)
                    setRefreshWarning('Der Nachtrag ist gespeichert. Die Übersicht konnte noch nicht aktualisiert werden; bitte laden Sie sie erneut.');
            }
        }
        catch (cause) {
            if (mounted.current)
                setError(`${cause instanceof Error ? cause.message : 'Der Nachtrag konnte nicht bestätigt werden.'} Prüfen Sie bei unklarem Speicherstatus die Historie oder wiederholen Sie unverändert denselben Nachtrag.`);
        }
        finally {
            saving.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    return <NativeWorkspaceStyleScope css={[wfmTimeAccountsCss, `
    .wta-manual-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.wta-manual-grid .wta-field-wide{grid-column:1/-1}.wta-field textarea{width:100%;min-width:0;min-height:100px;resize:vertical;border:1px solid #bccfe4;border-radius:10px;padding:10px 12px;color:#152b46;background:white;font:inherit;line-height:1.5}.wta-time-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.wta-manual-summary{display:flex;flex-wrap:wrap;gap:12px;padding:12px 14px;border:1px solid #d7e2ef;border-radius:10px;background:#f3f7fc;font-variant-numeric:tabular-nums}.wta-manual-summary span{color:#52657c}.wta-manual-summary strong{color:#152b46;margin-left:5px}.wta-fieldset{border:0;margin:0;padding:0;min-width:0;display:grid;gap:15px}.wta-message[data-tone=success]{background:#edf8f2;border-color:#bddccb;color:#1b6843}@container(max-width:570px){.wta-manual-grid{grid-template-columns:1fr}.wta-time-pair{grid-template-columns:1fr}}
  `, wfmTimeAccountsCss, `
    .wta-manual-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.wta-manual-grid .wta-field-wide{grid-column:1/-1}.wta-field textarea{width:100%;min-width:0;min-height:100px;resize:vertical;border:1px solid #bccfe4;border-radius:10px;padding:10px 12px;color:#152b46;background:white;font:inherit;line-height:1.5}.wta-time-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.wta-manual-summary{display:flex;flex-wrap:wrap;gap:12px;padding:12px 14px;border:1px solid #d7e2ef;border-radius:10px;background:#f3f7fc;font-variant-numeric:tabular-nums}.wta-manual-summary span{color:#52657c}.wta-manual-summary strong{color:#152b46;margin-left:5px}.wta-fieldset{border:0;margin:0;padding:0;min-width:0;display:grid;gap:15px}.wta-message[data-tone=success]{background:#edf8f2;border-color:#bddccb;color:#1b6843}@container(max-width:570px){.wta-manual-grid{grid-template-columns:1fr}.wta-time-pair{grid-template-columns:1fr}}
  `]}>{<NativeSection className="wta wta-stack" data-worktime-manual="20261018"><NativeStyle>{wfmTimeAccountsCss}</NativeStyle><NativeStyle>{`
    .wta-manual-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.wta-manual-grid .wta-field-wide{grid-column:1/-1}.wta-field textarea{width:100%;min-width:0;min-height:100px;resize:vertical;border:1px solid #bccfe4;border-radius:10px;padding:10px 12px;color:#152b46;background:white;font:inherit;line-height:1.5}.wta-time-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.wta-manual-summary{display:flex;flex-wrap:wrap;gap:12px;padding:12px 14px;border:1px solid #d7e2ef;border-radius:10px;background:#f3f7fc;font-variant-numeric:tabular-nums}.wta-manual-summary span{color:#52657c}.wta-manual-summary strong{color:#152b46;margin-left:5px}.wta-fieldset{border:0;margin:0;padding:0;min-width:0;display:grid;gap:15px}.wta-message[data-tone=success]{background:#edf8f2;border-color:#bddccb;color:#1b6843}@container(max-width:570px){.wta-manual-grid{grid-template-columns:1fr}.wta-time-pair{grid-template-columns:1fr}}
  `}</NativeStyle>
    <NativeDiv className="wta-heading"><NativeDiv><NativeH3>Arbeitszeit nachtragen</NativeH3><NativeP>Abgeschlossene Arbeitszeit mit Begründung erfassen. Alle Uhrzeiten gelten für Deutschland (Europe/Berlin).</NativeP></NativeDiv></NativeDiv>
    <NativeForm noValidate onSubmit={event => void submit(event)}>
      <NativeFieldset className="wta-fieldset" disabled={busy || !allowed}>
        <NativeDiv className="wta-manual-grid">
          <NativeLabel className="wta-field"><NativeSpan>Mitarbeitende *</NativeSpan><NativeSelect value={draft.employeeId} required onChange={event => change('employeeId', event.target.value)}><NativeOption value="">Person auswählen</NativeOption>{draft.employeeId && !employees.some(employee => employee.id === draft.employeeId) ? <NativeOption value={draft.employeeId}>Ausgewählte Person nicht verfügbar</NativeOption> : null}{employees.map(employee => <NativeOption key={employee.id} value={employee.id}>{employee.name}</NativeOption>)}</NativeSelect></NativeLabel>
          <NativeLabel className="wta-field"><NativeSpan>Arbeitsart *</NativeSpan><NativeSelect value={draft.workKind} required onChange={event => change('workKind', event.target.value as ManualEntryDraft['workKind'])}><NativeOption value="buero">Büro</NativeOption><NativeOption value="einsatz">Einsatz</NativeOption><NativeOption value="homeoffice">Homeoffice</NativeOption><NativeOption value="fahrt">Fahrzeit</NativeOption><NativeOption value="sonstige">Sonstige Arbeitszeit</NativeOption></NativeSelect></NativeLabel>
          <NativeDiv className="wta-time-pair"><NativeLabel className="wta-field"><NativeSpan>Beginndatum *</NativeSpan><NativeInput type="date" required max={berlinWorkDate()} value={draft.workDate} onChange={event => change('workDate', event.target.value)}/></NativeLabel><NativeLabel className="wta-field"><NativeSpan>Beginn *</NativeSpan><NativeInput type="time" required step={60} value={draft.startTime} onChange={event => change('startTime', event.target.value)}/></NativeLabel>{startCandidates.length > 1 ? <NativeLabel className="wta-field"><NativeSpan>Beginn bei Zeitumstellung *</NativeSpan><NativeSelect value={draft.startClock} onChange={event => change('startClock', event.target.value as BerlinClockChoice)}><NativeOption value="auto">Bitte auswählen</NativeOption><NativeOption value="summer">Sommerzeit (erste Stunde)</NativeOption><NativeOption value="winter">Winterzeit (zweite Stunde)</NativeOption></NativeSelect></NativeLabel> : null}</NativeDiv>
          <NativeDiv className="wta-time-pair"><NativeLabel className="wta-field"><NativeSpan>Enddatum *</NativeSpan><NativeInput type="date" required min={draft.workDate} max={berlinWorkDate()} value={draft.endDate} onChange={event => change('endDate', event.target.value)}/></NativeLabel><NativeLabel className="wta-field"><NativeSpan>Ende *</NativeSpan><NativeInput type="time" required step={60} value={draft.endTime} onChange={event => change('endTime', event.target.value)}/></NativeLabel>{endCandidates.length > 1 ? <NativeLabel className="wta-field"><NativeSpan>Ende bei Zeitumstellung *</NativeSpan><NativeSelect value={draft.endClock} onChange={event => change('endClock', event.target.value as BerlinClockChoice)}><NativeOption value="auto">Bitte auswählen</NativeOption><NativeOption value="summer">Sommerzeit (erste Stunde)</NativeOption><NativeOption value="winter">Winterzeit (zweite Stunde)</NativeOption></NativeSelect></NativeLabel> : null}</NativeDiv>
          <NativeLabel className="wta-field"><NativeSpan>Pause in Minuten *</NativeSpan><NativeInput type="number" required min={0} step={1} inputMode="numeric" value={draft.pauseMinutes} onChange={event => change('pauseMinutes', event.target.value)}/></NativeLabel>
          <NativeDiv className="wta-field"><NativeSpan>Erfasste Dauer</NativeSpan><NativeDiv className="wta-manual-summary"><NativeSpan>Brutto<NativeStrong>{Number.isFinite(gross) && gross > 0 ? accountDuration(gross) : '—'}</NativeStrong></NativeSpan><NativeSpan>Netto<NativeStrong>{durationValid ? accountDuration(gross - pause) : '—'}</NativeStrong></NativeSpan></NativeDiv></NativeDiv>
          <NativeLabel className="wta-field wta-field-wide"><NativeSpan>Begründung *</NativeSpan><NativeTextarea required maxLength={2000} value={draft.reason} onChange={event => change('reason', event.target.value)} placeholder="Warum wird die Zeit nachgetragen? Zum Beispiel: Zeiterfassung beim Einsatz nicht verfügbar."/><NativeSmall className="wta-muted">{draft.reason.length.toLocaleString('de-DE')} / 2.000 Zeichen · Die Begründung wird im Prüfverlauf gespeichert.</NativeSmall></NativeLabel>
        </NativeDiv>
        <NativeDiv className="wta-actions"><NativeButton type="submit" className="wta-button" data-primary="true" disabled={busy || employees.length === 0}>{busy ? 'Wird gespeichert …' : 'Nachtrag speichern'}</NativeButton><NativeButton type="button" className="wta-button" disabled={busy || !dirty} onClick={() => void reset()}>Zurücksetzen</NativeButton><NativeSpan className="wta-footnote">* Pflichtangaben · Nach dem Speichern: offen zur Prüfung.</NativeSpan></NativeDiv>
      </NativeFieldset>
    </NativeForm>
    {!allowed ? <NativeDiv className="wta-message" data-tone="warning">Nachträge sind für diesen Verwaltungszugang nicht freigegeben.</NativeDiv> : null}
    {employees.length === 0 ? <NativeDiv className="wta-message">Es sind keine verfügbaren Mitarbeitenden für einen Nachtrag vorhanden.</NativeDiv> : null}
    {error || success ? <NativeDiv className="wta-message" data-tone={error ? 'error' : 'success'} ref={notice} tabIndex={-1} role={error ? 'alert' : 'status'}>{error || success}</NativeDiv> : null}
    {refreshWarning ? <NativeDiv className="wta-message" data-tone="warning" role="status">{refreshWarning}</NativeDiv> : null}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
