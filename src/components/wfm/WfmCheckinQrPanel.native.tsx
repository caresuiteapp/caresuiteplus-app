// Generated native presentation from src/components/wfm/WfmCheckinQrPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeNavigator as navigator} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSection,NativeDiv,NativeH3,NativeButton,NativeP,NativeForm,NativeLabel,NativeSpan,NativeInput,NativeArticle,NativeStrong} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { createWfmCheckinToken, listWfmCheckinTokens } from '@/lib/wfm/wfmCheckinService';
import { WfmWebNotice } from "./WfmSecondaryWorkspace.native.tsx";
export function WfmCheckinQrPanel({ tenantId, userId }: {
    tenantId: string;
    userId: string;
}) {
    const { roleKey, can } = usePermissions();
    const canManage = can('time.settings.manage');
    const [location, setLocation] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const scope = `${tenantId}:${userId}:${roleKey}:${canManage}`;
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const query = useAsyncQuery(useCallback(() => listWfmCheckinTokens(tenantId, roleKey), [tenantId, roleKey]), [tenantId, roleKey], { enabled: !!tenantId && !!userId && canManage, queryKey: scope });
    const create = async () => {
        if (lock.current || !canManage || !tenantId || !userId)
            return;
        if (!location.trim()) {
            setError('Bitte eine Standortbezeichnung eingeben.');
            return;
        }
        const requestedScope = scope;
        lock.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            const result = await createWfmCheckinToken(tenantId, userId, roleKey, { locationLabel: location.trim(), expiresInDays: 365 });
            if (scopeRef.current !== requestedScope)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            query.setData(previous => [result.data, ...(previous ?? [])]);
            setLocation('');
            setMessage('Büro-Check-in-Code gespeichert.');
        }
        catch (cause) {
            if (scopeRef.current === requestedScope)
                setError(cause instanceof Error ? cause.message : 'Code konnte nicht erstellt werden.');
        }
        finally {
            if (scopeRef.current === requestedScope) {
                lock.current = false;
                setBusy(false);
            }
        }
    };
    const copy = async (code: string) => { try {
        await navigator.clipboard.writeText(code);
        setMessage('Code kopiert.');
    }
    catch {
        setError('Kopieren ist nicht verfügbar. Bitte den angezeigten Code markieren und kopieren.');
    } };
    if (!canManage)
        return null;
    return <NativeSection className="wts-panel"><NativeDiv className="wts-row-head"><NativeH3>Büro-Check-in-Codes</NativeH3><NativeButton onClick={() => void query.refresh()} disabled={busy || query.refreshing}>Aktualisieren</NativeButton></NativeDiv>
    <NativeP>Mitarbeitende geben den achtstelligen Code bei der eigenen Zeiterfassung ein.</NativeP>
    <NativeForm onSubmit={e => { e.preventDefault(); void create(); }} className="wts-actions"><NativeLabel className="wts-field" style={{ flex: 1 }}><NativeSpan>Standort</NativeSpan><NativeInput value={location} onChange={e => setLocation(e.target.value)} placeholder="z. B. Empfang" maxLength={120} disabled={busy} required/></NativeLabel><NativeButton className="wts-primary" disabled={busy || query.loading || !!query.error || !!query.refreshError}>{busy ? 'Wird erstellt…' : 'Code erstellen'}</NativeButton></NativeForm>
    {query.loading && <WfmWebNotice>Check-in-Codes werden geladen…</WfmWebNotice>}
    {(query.error || query.refreshError) && <WfmWebNotice tone="error">{query.error || query.refreshError}</WfmWebNotice>}
    {!query.loading && !query.error && !(query.data ?? []).length && <NativeDiv className="wts-empty">Noch keine aktiven Check-in-Codes.</NativeDiv>}
    {(query.data ?? []).map(token => { const expired = !!token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now(); return <NativeArticle className="wts-row" key={token.id}><NativeDiv className="wts-row-head"><NativeDiv><NativeStrong>{token.locationLabel}</NativeStrong><NativeDiv className="wts-code">{token.tokenCode}</NativeDiv><NativeP>{expired ? 'Abgelaufen' : token.expiresAt ? `Gültig bis ${new Date(token.expiresAt).toLocaleDateString('de-DE')}` : 'Ohne Ablaufdatum'}</NativeP></NativeDiv><NativeButton onClick={() => void copy(token.tokenCode)} disabled={expired}>Code kopieren</NativeButton></NativeDiv></NativeArticle>; })}
    {error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}
  </NativeSection>;
}
