// Generated native presentation from src/components/auth/PhoneDeviceApproval.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeMain,NativeStyle,NativeDiv,NativeA,NativeSpan,NativeSection,NativeH1,NativeP,NativeStrong,NativeButton,NativeLabel,NativeInput,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { clearTvLoginReturn, rememberTvLoginReturn } from "../../lib/auth/tvDeviceLoginReturn.ts";
import { TV_LOGIN_ROLES, decideTvLogin, inspectTvLogin, isTvUserCode, type TvLoginInspection } from "../../lib/auth/tvDeviceLogin.native.ts";
import { tvDeviceLoginStyles } from "./tvDeviceLoginStyles.native.ts";
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Die Geräteanfrage ist nicht erreichbar. Bitte erneut versuchen.';
export function PhoneDeviceApproval() {
    const params = useLocalSearchParams<{
        code?: string | string[];
    }>();
    const code = typeof params.code === 'string' ? params.code : '';
    const router = useRouter();
    const { authReady, isAuthenticated, portalSession, profile, user, signOut } = useAuth();
    const [request, setRequest] = useState<TvLoginInspection | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const decisionScope = JSON.stringify([code, isAuthenticated, portalSession?.tenantId, portalSession?.accountId, portalSession?.sessionToken, portalSession?.roleKey, portalSession?.mustChangePassword, profile?.id, profile?.roleKey, user?.id, user?.roleKey]);
    const scopeRef = useRef(decisionScope);
    scopeRef.current = decisionScope;
    const [matchedScope, setMatchedScope] = useState<string | null>(null);
    const matched = matchedScope === decisionScope;
    const setMatched = (value: boolean) => setMatchedScope(value ? decisionScope : null);
    const [reload, setReload] = useState(0);
    const [now, setNow] = useState(Date.now());
    const decisionController = useRef<AbortController | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        setRequest(null);
        setError('');
        setMatched(false);
        if (!isTvUserCode(code)) {
            setError('Dieser QR-Link ist ungültig. Bitte den aktuellen QR-Code am TV erneut scannen.');
            return;
        }
        void inspectTvLogin(code, controller.signal).then((result) => {
            if (!controller.signal.aborted)
                setRequest(result);
        }).catch((cause) => { if (!controller.signal.aborted)
            setError(message(cause)); });
        return () => controller.abort();
    }, [code, reload]);
    useEffect(() => {
        setBusy(false);
        setMatchedScope(null);
        return () => { decisionController.current?.abort(); decisionController.current = null; };
    }, [decisionScope]);
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => { clearInterval(timer); decisionController.current?.abort(); };
    }, []);
    const role = TV_LOGIN_ROLES.find((entry) => entry.role === request?.role);
    const expired = Boolean(request && Date.parse(request.expiresAt) <= now);
    const complete = request?.status === 'approved' || request?.status === 'consumed';
    const rejected = request?.status === 'denied' || request?.status === 'cancelled';
    const unavailable = expired || request?.status === 'expired' || request?.status === 'failed' || rejected;
    const roleMatches = Boolean(request && isAuthenticated && (request.role === 'administration' ? !portalSession && !['employee_portal', 'client_portal', 'family_portal'].includes(profile?.roleKey ?? user?.roleKey ?? '')
        : portalSession?.loginType === (request.role === 'employee' ? 'employee_portal' : 'client_portal')));
    const accountLabel = portalSession?.displayName || profile?.displayName || user?.displayName || user?.email || 'Ihr angemeldetes Konto';
    const login = async (changeAccount = false) => {
        if (!request || !role || busy)
            return;
        setBusy(true);
        setError('');
        try {
            // A role change is an explicit user action; no silent account switching.
            if (isAuthenticated && (!roleMatches || changeAccount))
                await signOut();
            if (!rememberTvLoginReturn(code, request.role, request.expiresAt)) {
                setError('Ihr Browser kann den Rückweg nicht speichern. Melden Sie sich zuerst über die normale Anmeldung an und scannen Sie den TV-Code anschließend erneut.');
                return;
            }
            router.push(role.loginPath as never);
        }
        catch (cause) {
            setError(message(cause));
        }
        finally {
            setBusy(false);
        }
    };
    const decide = async (decision: 'approve' | 'deny') => {
        if (!request || busy || decisionController.current || !authReady || !isAuthenticated || expired || request.status !== 'pending' || (decision === 'approve' && (!matched || !roleMatches || portalSession?.mustChangePassword)))
            return;
        setBusy(true);
        setError('');
        const controller = new AbortController();
        decisionController.current = controller;
        try {
            await decideTvLogin(code, request.verificationCode, decision, portalSession?.sessionToken, controller.signal);
            if (controller.signal.aborted || scopeRef.current !== decisionScope)
                return;
            clearTvLoginReturn();
            setRequest({ ...request, status: decision === 'approve' ? 'approved' : 'denied' });
        }
        catch (cause) {
            if (!controller.signal.aborted && scopeRef.current === decisionScope)
                setError(message(cause));
        }
        finally {
            if (decisionController.current === controller)
                decisionController.current = null;
            if (!controller.signal.aborted && scopeRef.current === decisionScope)
                setBusy(false);
        }
    };
    return <NativeWorkspaceStyleScope css={[tvDeviceLoginStyles, tvDeviceLoginStyles]}>{<NativeMain className="cs-device-login cs-phone-device">
    <NativeStyle>{tvDeviceLoginStyles}</NativeStyle>
    <NativeDiv className="cs-phone-device-inner">
      <NativeA href="/" className="cs-phone-device-brand" aria-label="Zur CareSuite-Startseite" onClick={clearTvLoginReturn}>CareSuite <NativeSpan>HealthOS</NativeSpan></NativeA>
      <NativeSection className="cs-phone-device-card" aria-labelledby="device-approval-title">
        <NativeSpan className="cs-device-kicker">TV mit dem Handy verbinden</NativeSpan>
        <NativeH1 id="device-approval-title">{complete ? 'TV-Zugang freigegeben.' : unavailable ? 'Diese Anfrage ist beendet.' : 'Diesen Bildschirm anmelden?'}</NativeH1>
        {request && role ? <>
          {complete ? <NativeDiv className="cs-device-status" role="status">Ihr TV erhält eine eigene Sitzung für {role.title}. Sie bleiben auf diesem Handy angemeldet. Falls der TV keine Verbindung herstellt, erstellen Sie dort einen neuen QR-Code.</NativeDiv> : unavailable ? <NativeDiv className="cs-device-status" role="status">{rejected ? 'Der TV wurde mit dieser Anfrage nicht angemeldet.' : 'Der QR-Code ist abgelaufen oder nicht mehr verwendbar.'} Erstellen Sie bei Bedarf einen neuen QR-Code am TV.</NativeDiv> : <>
            <NativeP>Sie geben einen weiteren Bildschirm für den Bereich <NativeStrong style={{ color: '#f1f8ff' }}>{role.title}</NativeStrong> frei. Personen vor diesem Bildschirm können danach auf Ihr Konto zugreifen.</NativeP>
            <NativeDiv className="cs-phone-device-code"><NativeSpan className="cs-device-code-label">Steht diese Nummer auch auf Ihrem TV?</NativeSpan><NativeDiv className="cs-device-code">{request.verificationCode.slice(0, 3)} {request.verificationCode.slice(3)}</NativeDiv><NativeP className="cs-phone-device-hint">Nur fortfahren, wenn Sie die Anmeldung selbst am TV gestartet haben.</NativeP></NativeDiv>
            {!authReady ? <NativeDiv className="cs-device-status" role="status">Ihre Handy-Sitzung wird geprüft …</NativeDiv> : !isAuthenticated || !roleMatches ? <>
              <NativeP>{isAuthenticated ? 'Auf diesem Handy ist eine andere Zugangsart angemeldet. Wechseln Sie zum passenden Konto, um diesen TV freizugeben.' : `Melden Sie sich auf diesem Handy mit Ihrem Zugang für ${role.title} an. Anschließend bestätigen Sie den TV hier ausdrücklich.`}</NativeP>
              <NativeDiv className="cs-device-actions"><NativeButton type="button" className="cs-device-button primary" disabled={busy} onClick={() => void login()}>{busy ? 'Anmeldung wird geöffnet …' : isAuthenticated ? 'Konto wechseln und anmelden' : `Als ${role.title} anmelden`}</NativeButton></NativeDiv>
            </> : <>
              <NativeDiv className="cs-phone-device-account"><NativeSpan className="cs-device-kicker">Angemeldet als</NativeSpan><NativeP className="cs-phone-device-account-name">{accountLabel}</NativeP><NativeP className="cs-phone-device-account-role">{role.title}</NativeP><NativeButton type="button" className="cs-device-button quiet cs-phone-device-switch" disabled={busy} onClick={() => void login(true)}>Mit anderem Konto anmelden</NativeButton></NativeDiv>
              {portalSession?.mustChangePassword ? <NativeDiv className="cs-device-status cs-device-error">Legen Sie zuerst Ihr persönliches Passwort fest.<NativeDiv className="cs-device-actions"><NativeButton type="button" className="cs-device-button" onClick={() => {
                            rememberTvLoginReturn(code, request.role, request.expiresAt);
                            router.push('/auth/employee-first-login' as never);
                        }}>Persönliches Passwort festlegen</NativeButton></NativeDiv></NativeDiv> : <>
                <NativeLabel className="cs-phone-device-check"><NativeInput type="checkbox" checked={matched} disabled={busy} onChange={(event) => setMatched(event.target.checked)}/><NativeSpan>Die Kontrollnummer stimmt überein. Ich habe Zugriff auf diesen TV und möchte ihn mit meinem Konto anmelden.</NativeSpan></NativeLabel>
                <NativeDiv className="cs-device-actions"><NativeButton type="button" className="cs-device-button primary" disabled={busy || !matched} onClick={() => void decide('approve')}>{busy ? 'Wird verarbeitet …' : 'TV jetzt freigeben'}</NativeButton><NativeButton type="button" className="cs-device-button quiet" disabled={busy} onClick={() => void decide('deny')}>Ablehnen</NativeButton></NativeDiv>
              </>}
            </>}
            <NativeP className="cs-device-note">Die Freigabe läuft nach fünf Minuten ab. Melden Sie sich am TV nach der Nutzung wieder ab. Geben Sie keinen Bildschirm frei, den Sie nicht selbst verwenden.</NativeP>
          </>}
        </> : !error && <NativeDiv className="cs-device-status" role="status">Geräteanfrage wird geprüft …</NativeDiv>}
        {error && <NativeDiv role="alert" className="cs-device-status cs-device-error" style={{ marginTop: 20 }}>{error}</NativeDiv>}
        {error && !busy && isTvUserCode(code) && <NativeDiv className="cs-device-actions"><NativeButton type="button" className="cs-device-button" onClick={() => setReload((value) => value + 1)}>Anfrage erneut prüfen</NativeButton></NativeDiv>}
        <NativeA className="cs-device-link cs-phone-device-close" href="/" onClick={clearTvLoginReturn}>Zur CareSuite-Startseite</NativeA>
      </NativeSection>
    </NativeDiv>
  </NativeMain>}</NativeWorkspaceStyleScope>;
}
export default PhoneDeviceApproval;
