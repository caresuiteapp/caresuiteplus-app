// Generated native presentation from src/screens/settings/DataRequestScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeStyle,NativeDiv,NativeP,NativeButton,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SettingsScreenFrame } from '@/components/settings/settingsscreenframe';
import { useDataRequestUnsavedChanges } from "../../hooks/useDataRequestUnsavedChanges.native.ts";
import { useAuth, type AuthContextValue } from '@/lib/auth/context';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';
import { createDataRequestIdempotencyKey, downloadDataRequestAccountExport, fetchOwnAccountExport, listOwnDataRequests, submitOwnDataRequest, validateDataRequestWorkspaceDraft, type DataRequestWorkspaceItem, type DataRequestWorkspaceScope, type DataRequestWorkspaceType, } from "../../lib/privacy/dataRequestWorkspaceService.native.ts";
import type { AuthUser, Profile } from '@/types';
import { DataRequestWorkspace } from "./DataRequestWorkspace.native.tsx";
type Draft = {
    requestType: DataRequestWorkspaceType;
    requesterName: string;
    requesterEmail: string;
    message: string;
};
type Operation = 'submit' | 'json' | 'csv';
type HistoryMode = 'initial' | 'refresh' | 'more';
type Receipt = {
    reference: string;
    receivedAt: string;
};
const CONTROLLER_CSS = `
  .cs-data-request-controller-state { width: calc(100% - 32px); max-width: 680px; box-sizing: border-box; padding: 28px; margin: 28px auto; border: 1px solid #dce6f2; border-radius: 24px; background: #fff; box-shadow: 0 5px 20px rgba(21,51,88,.05); color: #17334f; font-size: calc(15px * var(--app-font-scale,1)); line-height: 1.5; overflow-wrap: anywhere; }
  .cs-data-request-controller-state p { margin: 0; }
  .cs-data-request-controller-state button { min-height: 44px; margin-top: 18px; padding: 10px 16px; border: 1px solid #c6d9f0; border-radius: 12px; background: #f3f8ff; color: #155fae; font: inherit; font-weight: 650; cursor: pointer; }
  .cs-data-request-controller-state button:focus-visible { outline: 3px solid #1477d6; outline-offset: 3px; }
  .cs-data-request-controller-state button:disabled { opacity: .55; cursor: not-allowed; }
`;
function contactEmail(profile: Profile, user: AuthUser): string {
    return [profile.email, user.email].find((value) => Boolean(value?.trim()) && !value!.toLowerCase().endsWith('@caresuite-portal.local'))?.trim() ?? '';
}
function initialDraft(profile: Profile, user: AuthUser): Draft {
    return {
        requestType: 'access',
        requesterName: [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
            profile.displayName?.trim() || user.displayName?.trim() || '',
        requesterEmail: contactEmail(profile, user),
        message: '',
    };
}
function sameDraft(left: Draft, right: Draft): boolean {
    return left.requestType === right.requestType && left.requesterName === right.requesterName &&
        left.requesterEmail === right.requesterEmail && left.message === right.message;
}
function uniqueRequests(items: readonly DataRequestWorkspaceItem[]): DataRequestWorkspaceItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        if (seen.has(item.id))
            return false;
        seen.add(item.id);
        return true;
    });
}
function sessionUnavailable(auth: AuthContextValue, profile: Profile, user: AuthUser): string | null {
    if (isDemoMode())
        return 'Im Demo-Modus werden keine Anfragen eingereicht und keine Kontodaten heruntergeladen.';
    if (!isSupabaseConfigured())
        return 'Die Online-Verbindung ist derzeit nicht eingerichtet. Bitte wenden Sie sich an den Support.';
    if (auth.isLoading || !auth.authReady)
        return 'Ihre Sitzung wird geprüft…';
    if (!auth.isAuthenticated || auth.authMode !== 'supabase' || auth.session?.user.id !== user.id ||
        !auth.session.accessToken)
        return 'Für diesen Bereich ist eine bestätigte Sitzung Ihres Kontos erforderlich. Bitte melden Sie sich erneut an.';
    if (!profile.tenantId)
        return 'Ihrem Konto ist derzeit kein Unternehmen zugeordnet. Bitte wenden Sie sich an den Support.';
    return null;
}
function DataRequestEditor({ auth, profile, user }: {
    auth: AuthContextValue;
    profile: Profile;
    user: AuthUser;
}) {
    const router = useRouter();
    const [form, setForm] = useState(() => {
        const draft = initialDraft(profile, user);
        return { baseline: draft, draft };
    });
    const [operation, setOperation] = useState<Operation | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState<Receipt | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);
    const [exportSuccess, setExportSuccess] = useState<string | null>(null);
    const [requests, setRequests] = useState<DataRequestWorkspaceItem[]>([]);
    const [historyMode, setHistoryMode] = useState<HistoryMode | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [nextOffset, setNextOffset] = useState<number | null>(null);
    const [backendUnavailable, setBackendUnavailable] = useState<string | null>(null);
    const alive = useRef(true);
    const operationRef = useRef<{
        kind: Operation;
    } | null>(null);
    const historyRef = useRef<{
        mode: HistoryMode;
    } | null>(null);
    const idempotency = useRef<{
        key: string;
        draft: string;
    } | null>(null);
    const unavailableReason = sessionUnavailable(auth, profile, user);
    const latest = useRef({ auth, profile, user, form, nextOffset, unavailableReason, backendUnavailable });
    latest.current = { auth, profile, user, form, nextOffset, unavailableReason, backendUnavailable };
    const { confirmLeave } = useDataRequestUnsavedChanges(!sameDraft(form.draft, form.baseline) || idempotency.current !== null, operation !== null);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; operationRef.current = null; historyRef.current = null; };
    }, []);
    // Update only untouched response-contact fields after a background profile refresh.
    useEffect(() => {
        if (idempotency.current || operationRef.current)
            return;
        const incoming = initialDraft(profile, user);
        setForm((previous) => ({
            baseline: { ...previous.baseline, requesterName: incoming.requesterName, requesterEmail: incoming.requesterEmail },
            draft: {
                ...previous.draft,
                requesterName: previous.draft.requesterName === previous.baseline.requesterName ? incoming.requesterName : previous.draft.requesterName,
                requesterEmail: previous.draft.requesterEmail === previous.baseline.requesterEmail ? incoming.requesterEmail : previous.draft.requesterEmail,
            },
        }));
    }, [profile.firstName, profile.lastName, profile.displayName, profile.email, user.displayName, user.email]);
    function scope(): DataRequestWorkspaceScope {
        const current = latest.current;
        return { authUserId: current.user.id, profileId: current.profile.id, tenantId: current.profile.tenantId ?? '' };
    }
    function applyAvailabilityError(result: {
        code?: string;
        error: string;
    }) {
        if (result.code === 'unavailable')
            setBackendUnavailable(result.error);
    }
    function currentOperation(token: {
        kind: Operation;
    }): boolean {
        return alive.current && operationRef.current === token && latest.current.unavailableReason === null;
    }
    function begin(kind: Operation) {
        if (!alive.current || operationRef.current || latest.current.unavailableReason || latest.current.backendUnavailable)
            return null;
        const token = { kind };
        operationRef.current = token;
        setOperation(kind);
        return token;
    }
    function finish(token: {
        kind: Operation;
    }) {
        if (!alive.current || operationRef.current !== token)
            return;
        operationRef.current = null;
        setOperation(null);
    }
    async function loadHistory(mode: HistoryMode, force = false) {
        if (!alive.current || latest.current.unavailableReason || (historyRef.current && !force))
            return;
        const offset = mode === 'more' ? latest.current.nextOffset : 0;
        if (offset === null)
            return;
        const token = { mode };
        historyRef.current = token;
        setHistoryMode(mode);
        setHistoryError(null);
        const current = () => alive.current && historyRef.current === token && latest.current.unavailableReason === null;
        try {
            const result = await listOwnDataRequests(scope(), { offset, limit: 20 });
            if (!current())
                return;
            if (!result.ok) {
                applyAvailabilityError(result);
                setHistoryError(result.error);
                return;
            }
            setBackendUnavailable(null);
            setRequests((previous) => uniqueRequests(mode === 'more' ? [...previous, ...result.data.items] : result.data.items));
            setNextOffset(result.data.hasMore ? result.data.nextOffset : null);
        }
        catch {
            if (current())
                setHistoryError('Ihre Anfragen konnten nicht geladen werden. Bitte versuchen Sie es erneut.');
        }
        finally {
            if (alive.current && historyRef.current === token) {
                historyRef.current = null;
                setHistoryMode(null);
            }
        }
    }
    useEffect(() => {
        if (unavailableReason) {
            historyRef.current = null;
            setHistoryMode(null);
            return;
        }
        void loadHistory('initial', true);
        // The identity is isolated by the editor key; availability changes resume the same account.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unavailableReason]);
    function changeDraft<Key extends keyof Draft>(key: Key, value: Draft[Key]) {
        if (operationRef.current || latest.current.unavailableReason || latest.current.backendUnavailable)
            return;
        // Retain the last attempt until submit compares the normalized payload.
        // Cosmetic edits must not turn an ambiguous retry into a duplicate request.
        setForm((previous) => ({ ...previous, draft: { ...previous.draft, [key]: value } }));
        setSubmitError(null);
        setSubmitSuccess(null);
    }
    async function submit() {
        if (operationRef.current || latest.current.unavailableReason || latest.current.backendUnavailable)
            return;
        // Keep a successful receipt visible until the user starts another draft.
        if (submitSuccess && sameDraft(latest.current.form.draft, latest.current.form.baseline))
            return;
        const validated = validateDataRequestWorkspaceDraft(latest.current.form.draft);
        if (!validated.ok) {
            setSubmitError(validated.error);
            setSubmitSuccess(null);
            return;
        }
        const fingerprint = JSON.stringify(validated.data);
        if (!idempotency.current || idempotency.current.draft !== fingerprint) {
            const generated = createDataRequestIdempotencyKey();
            if (!generated.ok) {
                setSubmitError(generated.error);
                return;
            }
            idempotency.current = { key: generated.data, draft: fingerprint };
        }
        const token = begin('submit');
        if (!token)
            return;
        setSubmitError(null);
        setSubmitSuccess(null);
        try {
            const result = await submitOwnDataRequest(scope(), { ...validated.data, idempotencyKey: idempotency.current.key });
            if (!currentOperation(token))
                return;
            if (!result.ok) {
                applyAvailabilityError(result);
                setSubmitError(result.error);
                return;
            }
            const request = result.data.request;
            setSubmitSuccess({ reference: request.requestNumber ?? request.id, receivedAt: request.receivedAt ?? request.createdAt });
            const clean: Draft = { ...validated.data, requestType: 'access', message: '' };
            setForm({ baseline: clean, draft: clean });
            idempotency.current = null;
            setRequests((previous) => uniqueRequests([request, ...previous]));
            // A list started before this write must not replace the confirmed receipt.
            void loadHistory('refresh', true);
        }
        catch {
            if (currentOperation(token))
                setSubmitError('Der Eingang Ihrer Anfrage konnte nicht bestätigt werden. Ihr Entwurf bleibt erhalten. Bitte versuchen Sie es erneut.');
        }
        finally {
            finish(token);
        }
    }
    async function exportAccount(format: 'json' | 'csv') {
        const token = begin(format);
        if (!token)
            return;
        setExportError(null);
        setExportSuccess(null);
        try {
            const result = await fetchOwnAccountExport(scope());
            if (!currentOperation(token))
                return;
            if (!result.ok) {
                applyAvailabilityError(result);
                setExportError(result.error);
                return;
            }
            const downloaded = await downloadDataRequestAccountExport(result.data, format);
            if (!currentOperation(token))
                return;
            if (!downloaded.ok) {
                setExportError(downloaded.error);
                return;
            }
            setExportSuccess('Der Download von ' + downloaded.data.fileName + ' wurde gestartet.');
        }
        catch {
            if (currentOperation(token))
                setExportError('Die Kontodaten konnten nicht heruntergeladen werden. Bitte versuchen Sie es erneut.');
        }
        finally {
            finish(token);
        }
    }
    async function navigate(path: '/support' | '/settings/account-deletion') {
        if (operationRef.current || !await confirmLeave())
            return;
        router.push(path as never);
    }
    const blocked = unavailableReason ?? backendUnavailable;
    const busy = operation !== null;
    return <NativeWorkspaceStyleScope css={[CONTROLLER_CSS]}>{<DataRequestWorkspace accountLabel={initialDraft(profile, user).requesterName || 'Ihr Konto'} contactLabel={contactEmail(profile, user) || undefined} requestType={form.draft.requestType} name={form.draft.requesterName} email={form.draft.requesterEmail} message={form.draft.message} onRequestTypeChange={(value) => changeDraft('requestType', value)} onNameChange={(value) => changeDraft('requesterName', value)} onEmailChange={(value) => changeDraft('requesterEmail', value)} onMessageChange={(value) => changeDraft('message', value)} onSubmit={() => { void submit(); }} submitting={operation === 'submit'} disabled={busy || Boolean(blocked)} submitDisabled={submitSuccess !== null && sameDraft(form.draft, form.baseline)} unavailableReason={blocked} submitError={submitError} submitSuccess={submitSuccess} requests={requests} historyLoading={historyMode === 'initial'} historyRefreshing={historyMode === 'refresh'} historyLoadingMore={historyMode === 'more'} historyError={historyError ?? unavailableReason} hasMore={nextOffset !== null} onRefresh={() => { void loadHistory('refresh'); }} onLoadMore={() => { void loadHistory('more'); }} exporting={operation === 'json' || operation === 'csv' ? operation : null} exportDisabled={busy || Boolean(blocked)} exportDisabledReason={blocked} exportError={exportError} exportSuccess={exportSuccess} onExport={(format) => { void exportAccount(format); }} onOpenSupport={async () => await navigate('/support')} onRequestDeletion={async () => await navigate('/settings/account-deletion')}/>}</NativeWorkspaceStyleScope>;
}
export function DataRequestScreen({ embeddedInModal = false }: {
    embeddedInModal?: boolean;
} = {}) {
    const auth = useAuth();
    const [retrying, setRetrying] = useState(false);
    const [retryError, setRetryError] = useState<string | null>(null);
    const identity = [auth.authMode, auth.user?.id, auth.profile?.tenantId, auth.profile?.id].join(':');
    const identityRef = useRef(identity);
    identityRef.current = identity;
    const retryRef = useRef<object | null>(null);
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { retryRef.current = null; setRetrying(false); setRetryError(null); }, [identity]);
    async function retry() {
        if (retryRef.current)
            return;
        const token = {};
        const attemptedIdentity = identityRef.current;
        const current = () => alive.current && retryRef.current === token && identityRef.current === attemptedIdentity;
        retryRef.current = token;
        setRetrying(true);
        setRetryError(null);
        try {
            await auth.retryProfileBootstrap();
        }
        catch {
            if (current())
                setRetryError('Ihr Profil konnte nicht geladen werden. Bitte versuchen Sie es erneut.');
        }
        finally {
            if (current()) {
                retryRef.current = null;
                setRetrying(false);
            }
        }
    }
    const loading = auth.isLoading || !auth.authReady || retrying;
    return <NativeWorkspaceStyleScope css={[CONTROLLER_CSS, CONTROLLER_CSS]}>{<SettingsScreenFrame title="Datenauskunft & Export" subtitle="Kontodaten herunterladen, eine Auskunft anfordern und den Bearbeitungsstand verfolgen." embeddedInModal={embeddedInModal} showSideNavigation>
    <NativeStyle>{CONTROLLER_CSS}</NativeStyle>
    {auth.profile && auth.user ? <DataRequestEditor key={identity} auth={auth} profile={auth.profile} user={auth.user}/> :
            <NativeDiv className="cs-data-request-controller-state">
        {loading ? <NativeP role="status">Ihr Konto wird geladen…</NativeP> : <>
          <NativeP role="alert">{retryError ?? auth.profileBootstrapError ?? 'Ihr Konto konnte nicht geladen werden.'}</NativeP>
          <NativeButton type="button" onClick={() => { void retry(); }} disabled={retrying}>Konto erneut laden</NativeButton>
        </>}
      </NativeDiv>}
  </SettingsScreenFrame>}</NativeWorkspaceStyleScope>;
}
