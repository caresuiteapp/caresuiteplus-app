import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { clearTvLoginReturn, rememberTvLoginReturn } from '@/lib/auth/tvDeviceLoginReturn.web';
import { TV_LOGIN_ROLES, decideTvLogin, inspectTvLogin, isTvUserCode, type TvLoginInspection } from '@/lib/auth/tvDeviceLogin.web';
import { tvDeviceLoginStyles } from './tvDeviceLoginStyles.web';

const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Die Geräteanfrage ist nicht erreichbar. Bitte erneut versuchen.';

export function PhoneDeviceApproval() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = typeof params.code === 'string' ? params.code : '';
  const router = useRouter();
  const { authReady, isAuthenticated, portalSession, profile, user, signOut } = useAuth();
  const [request, setRequest] = useState<TvLoginInspection | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [matched, setMatched] = useState(false);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(Date.now());
  const decisionController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setRequest(null); setError(''); setMatched(false);
    if (!isTvUserCode(code)) { setError('Dieser QR-Link ist ungültig. Bitte den aktuellen QR-Code am TV erneut scannen.'); return; }
    void inspectTvLogin(code, controller.signal).then((result) => {
      if (!controller.signal.aborted) setRequest(result);
    }).catch((cause) => { if (!controller.signal.aborted) setError(message(cause)); });
    return () => controller.abort();
  }, [code, reload]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); decisionController.current?.abort(); };
  }, []);

  const role = TV_LOGIN_ROLES.find((entry) => entry.role === request?.role);
  const expired = Boolean(request && Date.parse(request.expiresAt) <= now);
  const complete = request?.status === 'approved' || request?.status === 'consumed';
  const rejected = request?.status === 'denied' || request?.status === 'cancelled';
  const unavailable = expired || request?.status === 'expired' || request?.status === 'failed' || rejected;
  const roleMatches = Boolean(request && isAuthenticated && (
    request.role === 'administration' ? !portalSession && !['employee_portal', 'client_portal', 'family_portal'].includes(profile?.roleKey ?? user?.roleKey ?? '')
      : portalSession?.loginType === (request.role === 'employee' ? 'employee_portal' : 'client_portal')
  ));
  const accountLabel = portalSession?.displayName || profile?.displayName || user?.displayName || user?.email || 'Ihr angemeldetes Konto';

  const login = async (changeAccount = false) => {
    if (!request || !role || busy) return;
    setBusy(true); setError('');
    try {
      // A role change is an explicit user action; no silent account switching.
      if (isAuthenticated && (!roleMatches || changeAccount)) await signOut();
      if (!rememberTvLoginReturn(code, request.role, request.expiresAt)) {
        setError('Ihr Browser kann den Rückweg nicht speichern. Melden Sie sich zuerst über die normale Anmeldung an und scannen Sie den TV-Code anschließend erneut.');
        return;
      }
      router.push(role.loginPath as never);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  };
  const decide = async (decision: 'approve' | 'deny') => {
    if (!request || busy || !isAuthenticated || expired || request.status !== 'pending' || (decision === 'approve' && (!matched || !roleMatches))) return;
    setBusy(true); setError('');
    const controller = new AbortController();
    decisionController.current = controller;
    try {
      await decideTvLogin(code, request.verificationCode, decision, portalSession?.sessionToken, controller.signal);
      if (controller.signal.aborted) return;
      clearTvLoginReturn();
      setRequest({ ...request, status: decision === 'approve' ? 'approved' : 'denied' });
    } catch (cause) {
      if (!controller.signal.aborted) setError(message(cause));
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };

  return <main className="cs-device-login cs-phone-device">
    <style>{tvDeviceLoginStyles}</style>
    <div className="cs-phone-device-inner">
      <a href="/" className="cs-phone-device-brand" aria-label="Zur CareSuite-Startseite" onClick={clearTvLoginReturn}>CareSuite <span>HealthOS</span></a>
      <section className="cs-phone-device-card" aria-labelledby="device-approval-title">
        <span className="cs-device-kicker">TV mit dem Handy verbinden</span>
        <h1 id="device-approval-title">{complete ? 'TV-Zugang freigegeben.' : unavailable ? 'Diese Anfrage ist beendet.' : 'Diesen Bildschirm anmelden?'}</h1>
        {request && role ? <>
          {complete ? <div className="cs-device-status" role="status">Ihr TV erhält eine eigene Sitzung für {role.title}. Sie bleiben auf diesem Handy angemeldet. Falls der TV keine Verbindung herstellt, erstellen Sie dort einen neuen QR-Code.</div> : unavailable ? <div className="cs-device-status" role="status">{rejected ? 'Der TV wurde mit dieser Anfrage nicht angemeldet.' : 'Der QR-Code ist abgelaufen oder nicht mehr verwendbar.'} Erstellen Sie bei Bedarf einen neuen QR-Code am TV.</div> : <>
            <p>Sie geben einen weiteren Bildschirm für den Bereich <strong style={{ color: '#f1f8ff' }}>{role.title}</strong> frei. Personen vor diesem Bildschirm können danach auf Ihr Konto zugreifen.</p>
            <div className="cs-phone-device-code"><span className="cs-device-code-label">Steht diese Nummer auch auf Ihrem TV?</span><div className="cs-device-code">{request.verificationCode.slice(0, 3)} {request.verificationCode.slice(3)}</div><p className="cs-phone-device-hint">Nur fortfahren, wenn Sie die Anmeldung selbst am TV gestartet haben.</p></div>
            {!authReady ? <div className="cs-device-status" role="status">Ihre Handy-Sitzung wird geprüft …</div> : !isAuthenticated || !roleMatches ? <>
              <p>{isAuthenticated ? 'Auf diesem Handy ist eine andere Zugangsart angemeldet. Wechseln Sie zum passenden Konto, um diesen TV freizugeben.' : `Melden Sie sich auf diesem Handy mit Ihrem Zugang für ${role.title} an. Anschließend bestätigen Sie den TV hier ausdrücklich.`}</p>
              <div className="cs-device-actions"><button type="button" className="cs-device-button primary" disabled={busy} onClick={() => void login()}>{busy ? 'Anmeldung wird geöffnet …' : isAuthenticated ? 'Konto wechseln und anmelden' : `Als ${role.title} anmelden`}</button></div>
            </> : <>
              <div className="cs-phone-device-account"><span className="cs-device-kicker">Angemeldet als</span><p className="cs-phone-device-account-name">{accountLabel}</p><p className="cs-phone-device-account-role">{role.title}</p><button type="button" className="cs-device-button quiet cs-phone-device-switch" disabled={busy} onClick={() => void login(true)}>Mit anderem Konto anmelden</button></div>
              {portalSession?.mustChangePassword ? <div className="cs-device-status cs-device-error">Legen Sie zuerst Ihr persönliches Passwort fest.<div className="cs-device-actions"><button type="button" className="cs-device-button" onClick={() => {
                rememberTvLoginReturn(code, request.role, request.expiresAt);
                router.push('/auth/employee-first-login' as never);
              }}>Persönliches Passwort festlegen</button></div></div> : <>
                <label className="cs-phone-device-check"><input type="checkbox" checked={matched} disabled={busy} onChange={(event) => setMatched(event.target.checked)} /><span>Die Kontrollnummer stimmt überein. Ich habe Zugriff auf diesen TV und möchte ihn mit meinem Konto anmelden.</span></label>
                <div className="cs-device-actions"><button type="button" className="cs-device-button primary" disabled={busy || !matched} onClick={() => void decide('approve')}>{busy ? 'Wird verarbeitet …' : 'TV jetzt freigeben'}</button><button type="button" className="cs-device-button quiet" disabled={busy} onClick={() => void decide('deny')}>Ablehnen</button></div>
              </>}
            </>}
            <p className="cs-device-note">Die Freigabe läuft nach fünf Minuten ab. Melden Sie sich am TV nach der Nutzung wieder ab. Geben Sie keinen Bildschirm frei, den Sie nicht selbst verwenden.</p>
          </>}
        </> : !error && <div className="cs-device-status" role="status">Geräteanfrage wird geprüft …</div>}
        {error && <div role="alert" className="cs-device-status cs-device-error" style={{ marginTop: 20 }}>{error}</div>}
        {error && !busy && isTvUserCode(code) && <div className="cs-device-actions"><button type="button" className="cs-device-button" onClick={() => setReload((value) => value + 1)}>Anfrage erneut prüfen</button></div>}
        <a className="cs-device-link cs-phone-device-close" href="/" onClick={clearTvLoginReturn}>Zur CareSuite-Startseite</a>
      </section>
    </div>
  </main>;
}
export default PhoneDeviceApproval;
