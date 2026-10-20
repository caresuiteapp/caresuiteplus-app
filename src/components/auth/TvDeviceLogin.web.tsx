import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import qrcode from 'qrcode-generator';
import { useAuth } from '@/lib/auth/context';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';
import { getSupabaseClient } from '@/lib/supabase/client';
import { clearTvDeviceSession, isTvDeviceSession, markTvDeviceSession } from '@/lib/supabase/authSignOutScope';
import { revokePortalSession } from '@/lib/auth/portalSessionSecurityService';
import { completePortalLogin } from '@/lib/auth/portalLoginFlow';
import { signInWithPortalSupabaseTokens } from '@/lib/auth/portalSupabaseAuth';
import {
  TV_LOGIN_ROLES, cancelTvLogin, consumeTvLogin, createTvLogin, pollTvLogin, tvConfirmationUrl,
  type TvLoginChallenge, type TvLoginRole, type TvLoginStatus, type TvLoginSession,
} from '@/lib/auth/tvDeviceLogin.web';
import { tvDeviceLoginStyles } from './tvDeviceLoginStyles.web';

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Die QR-Anmeldung ist gerade nicht erreichbar. Bitte erneut versuchen.';
const terminalMessages: Partial<Record<TvLoginStatus, string>> = {
  expired: 'Dieser QR-Code ist abgelaufen. Bitte einen neuen Code erstellen.',
  denied: 'Die Anmeldung wurde auf dem Handy abgelehnt.',
  cancelled: 'Diese Geräteanmeldung wurde abgebrochen.',
  failed: 'Die Geräteanmeldung konnte nicht abgeschlossen werden. Bitte einen neuen Code erstellen.',
  consumed: 'Dieser Code wurde bereits verwendet. Bitte einen neuen Code erstellen.',
};

function TvRolePairing({ role, onBusyChange }: { role: TvLoginRole; onBusyChange: (busy: boolean) => void }) {
  const router = useRouter();
  const { authReady, isAuthenticated, portalSession, profile, user, signInPortalSession, signInWithSupabaseSession, signOut } = useAuth();
  const [challenge, setChallenge] = useState<TvLoginChallenge | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<TvLoginStatus>('pending');
  const [generation, setGeneration] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [connecting, setConnecting] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const installSession = useRef({ signInPortalSession, signInWithSupabaseSession, signOut, router });
  installSession.current = { signInPortalSession, signInWithSupabaseSession, signOut, router };
  const info = TV_LOGIN_ROLES.find((item) => item.role === role)!;

  useEffect(() => {
    if (!pendingTarget || !authReady || !isAuthenticated) return;
    const roleKey = profile?.roleKey ?? user?.roleKey;
    const matches = role === 'administration'
      ? !portalSession && !['employee_portal', 'client_portal', 'family_portal'].includes(roleKey ?? '')
      : portalSession?.loginType === (role === 'employee' ? 'employee_portal' : 'client_portal');
    if (matches) router.replace(pendingTarget as never);
  }, [authReady, isAuthenticated, pendingTarget, portalSession, profile?.roleKey, role, router, user?.roleKey]);

  useEffect(() => {
    let stopped = false;
    let sessionConsumed = false;
    let current: TvLoginChallenge | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    setChallenge(null); setError(''); setStatus('pending'); setConnecting(false); setPendingTarget(null); onBusyChange(false); setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = async () => {
      if (stopped || !current) return;
      if (Date.parse(current.expiresAt) <= Date.now()) { setStatus('expired'); return; }
      let issuedGrant: TvLoginSession | null = null;
      let installationAttempted = false;
      let markedNewSession = false;
      try {
        const result = await pollTvLogin(current, controller.signal);
        if (stopped) return;
        if (result.role !== role) throw new Error('Die angefragte Zugangsart stimmt nicht überein. Bitte neu starten.');
        setStatus(result.status);
        if (result.status === 'approved') {
          setConnecting(true); onBusyChange(true);
          // A challenge is consumed once only. Lost responses require a fresh challenge.
          sessionConsumed = true;
          const credentials = await consumeTvLogin(current, controller.signal);
          issuedGrant = credentials;
          if (stopped) throw new Error('Die TV-Anmeldung wurde abgebrochen.');
          if (credentials.role !== role || credentials.status !== 'consumed' || !credentials.supabaseAccessToken || !credentials.supabaseRefreshToken) throw new Error('Die sichere TV-Sitzung ist unvollständig. Bitte erneut verbinden.');
          if (!markTvDeviceSession(credentials.supabaseAccessToken)) throw new Error('Die TV-Sitzung konnte nicht eindeutig geschützt werden. Bitte einen neuen QR-Code erstellen.');
          markedNewSession = true;
          const auth = installSession.current;
          let target = '/';
          if (role === 'administration') {
            if (credentials.portalSession) throw new Error('Die Zugangsart der Sitzung stimmt nicht überein.');
            installationAttempted = true;
            const session = await signInWithPortalSupabaseTokens({ accessToken: credentials.supabaseAccessToken, refreshToken: credentials.supabaseRefreshToken });
            if (!session.ok) throw new Error(session.error);
            if (stopped) throw new Error('Die TV-Anmeldung wurde abgebrochen.');
            await auth.signInWithSupabaseSession(session.data);
          } else {
            const portal = credentials.portalSession;
            if (!portal || portal.loginType !== (role === 'employee' ? 'employee_portal' : 'client_portal') || portal.mustChangePassword) throw new Error('Die Portal-Sitzung ist noch nicht vollständig freigegeben. Bitte zuerst die Anmeldung auf dem Handy abschließen.');
            installationAttempted = true;
            const completed = await completePortalLogin(portal, credentials);
            if (!completed.ok) throw new Error(completed.error);
            if (stopped) throw new Error('Die TV-Anmeldung wurde abgebrochen.');
            await auth.signInPortalSession(completed.data.portalSession);
            target = role === 'employee' ? '/portal/employee' : '/portal/client';
          }
          if (stopped) throw new Error('Die TV-Anmeldung wurde abgebrochen.');
          setPendingTarget(target);
          return;
        }
        if (result.status === 'pending') pollTimer = setTimeout(() => void poll(), 2500);
      } catch (cause) {
        // Revoke only this freshly issued portal credential; never the phone's session.
        if (issuedGrant?.portalSession?.sessionToken) {
          await revokePortalSession(issuedGrant.portalSession.sessionToken).catch(() => undefined);
        }
        if (installationAttempted) {
          try {
            const currentSession = await getSupabaseClient()?.auth.getSession();
            if (currentSession?.error) throw currentSession.error;
            if (currentSession?.data.session && isTvDeviceSession(currentSession.data.session.access_token)) {
              await installSession.current.signOut();
              const afterCleanup = await getSupabaseClient()?.auth.getSession();
              if (afterCleanup?.error) throw afterCleanup.error;
              if (!afterCleanup?.data.session || !isTvDeviceSession(afterCleanup.data.session.access_token)) clearTvDeviceSession();
            } else {
              clearTvDeviceSession();
            }
          } catch {
            // Keep the scoped marker if cleanup is offline, so subsequent sign-out
            // remains TV-local. Do not fall back to revoking unrelated sessions.
          }
        } else if (markedNewSession) {
          clearTvDeviceSession();
        }
        if (!stopped) { setError(errorText(cause)); setConnecting(false); onBusyChange(false); }
      }
    };
    void createTvLogin(role, controller.signal).then((created) => {
      if (stopped) { void cancelTvLogin(created).catch(() => undefined); return; }
      current = created; setChallenge(created); setNow(Date.now());
      pollTimer = setTimeout(() => void poll(), 1800);
    }).catch((cause) => { if (!stopped) setError(errorText(cause)); });
    return () => {
      stopped = true; controller.abort(); clearInterval(clock); clearTimeout(pollTimer);
      if (current && !sessionConsumed) void cancelTvLogin(current).catch(() => undefined);
    };
  }, [generation, onBusyChange, role]);

  const remaining = challenge ? Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - now) / 1000)) : 0;
  const expired = Boolean(challenge && remaining === 0);
  const active = Boolean(challenge && !error && !expired && status === 'pending');
  const qrData = useMemo(() => {
    if (!challenge || typeof window === 'undefined') return null;
    const qr = qrcode(0, 'M');
    qr.addData(tvConfirmationUrl(challenge.userCode, window.location.origin)); qr.make();
    return qr.createDataURL(7, 28);
  }, [challenge]);
  const statusMessage = error || (connecting ? 'Bestätigt. Die sichere TV-Sitzung wird geöffnet …' : expired ? terminalMessages.expired : terminalMessages[status]) || 'Wartet auf Ihre Freigabe auf dem Handy.';

  return <div className="cs-device-stage">
    <div className="cs-device-qr-wrap">
      <div className="cs-device-qr">
        {active && qrData ? <img src={qrData} alt={`QR-Code für die Anmeldung als ${info.title}`} /> : <div className="cs-device-qr-empty">{connecting ? 'Verbindung wird hergestellt …' : error || expired || status !== 'pending' ? 'Neuen QR-Code erstellen' : 'Sicherer QR-Code wird erstellt …'}</div>}
      </div>
      {challenge && <><span className="cs-device-code-label">Kontrollnummer vergleichen</span><strong className="cs-device-code">{challenge.verificationCode.slice(0, 3)} {challenge.verificationCode.slice(3)}</strong></>}
      {active && <div className="cs-device-timer">Gültig für {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} Minuten<progress aria-label="Verbleibende Gültigkeit des QR-Codes" max={300} value={remaining} /></div>}
    </div>
    <div>
      <span className="cs-device-kicker">{info.title} · TV-Zugang</span>
      <h3 style={{ fontSize: '1.6em', marginTop: 10, lineHeight: 1.2 }}>Auf dem Handy anmelden.<br />Auf dem TV weiterarbeiten.</h3>
      <ol className="cs-device-steps">
        <li className="cs-device-step"><span className="cs-device-step-number">1</span><div><strong>QR-Code mit der Kamera scannen</strong><p>Der Link öffnet die Gerätefreigabe im Browser Ihres Handys.</p></div></li>
        <li className="cs-device-step"><span className="cs-device-step-number">2</span><div><strong>Mit dem passenden Zugang anmelden</strong><p>Verwenden Sie Ihren Zugang für {info.title}. Ihr Passwort bleibt auf dem Handy.</p></div></li>
        <li className="cs-device-step"><span className="cs-device-step-number">3</span><div><strong>Nummer vergleichen und TV freigeben</strong><p>Bestätigen Sie nur, wenn beide Geräte dieselbe Kontrollnummer anzeigen.</p></div></li>
      </ol>
      <div role={error ? 'alert' : 'status'} aria-live="polite" className={`cs-device-status${error || terminalMessages[status] || expired ? ' cs-device-error' : ''}`}>{statusMessage}</div>
      <div className="cs-device-actions"><button type="button" className="cs-device-button" disabled={connecting} onClick={() => setGeneration((value) => value + 1)}>Neuen QR-Code erstellen</button></div>
      <p className="cs-device-note">Nur auf einem vertrauenswürdigen Bildschirm anmelden. Der QR-Code gilt einmalig und höchstens fünf Minuten. Melden Sie sich nach der Nutzung am TV wieder ab.</p>
    </div>
  </div>;
}

export function TvDeviceLogin({ onExit }: { onExit: () => void }) {
  const router = useRouter();
  const { authReady, isAuthenticated, portalSession, profile, user, session } = useAuth();
  const [initialAuth, setInitialAuth] = useState<'checking' | 'existing' | 'pairing'>('checking');
  const [role, setRole] = useState<TvLoginRole>('administration');
  const [busy, setBusy] = useState(false);
  const container = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!authReady) return;
    // Decide once before creating a challenge. Later sign-in events belong to
    // the pairing flow and must not unmount it during session installation.
    setInitialAuth((current) => current === 'checking' ? (isAuthenticated ? 'existing' : 'pairing') : current);
  }, [authReady, isAuthenticated]);
  useEffect(() => {
    container.current?.querySelector<HTMLButtonElement>('.cs-device-role[aria-pressed=true], [data-tv-existing-session]')?.focus({ preventScroll: true });
  }, [initialAuth]);
  const existingTarget = resolveAuthSessionTarget({ portalSession, profile, user, session });
  return <section ref={container} className="cs-device-login cs-tv-device" aria-label="Anmeldung am TV mit dem Handy" onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); if (!busy) onExit(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const index = controls.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    controls[(index + direction + controls.length) % controls.length]?.focus();
  }}>
    <style>{tvDeviceLoginStyles}</style>
    <header className="cs-device-heading"><div><span className="cs-device-kicker">CareSuite HealthOS · TV</span><h2>Ihr Handy ist der Schlüssel.</h2><p>Wählen Sie den Zugang, den Sie auf diesem Bildschirm öffnen möchten.</p></div><button className="cs-device-button quiet" type="button" disabled={busy} onClick={onExit}>Zur normalen Anmeldung</button></header>
    {initialAuth === 'pairing' ? <><div className="cs-device-roles" role="group" aria-label="Zugangsart auswählen">{TV_LOGIN_ROLES.map((item) => <button className="cs-device-role" type="button" key={item.role} aria-pressed={role === item.role} disabled={busy} onClick={() => setRole(item.role)}><strong>{item.title}</strong><span>{item.description}</span></button>)}</div>
    <TvRolePairing key={role} role={role} onBusyChange={setBusy} /></> : <div className="cs-device-stage" style={{ display: 'block' }}>
      {initialAuth === 'checking' ? <p role="status">Vorhandene Sitzung wird geprüft …</p> : <>
        <h3 style={{ fontSize: '1.45em', marginBottom: 14 }}>In diesem Browser sind Sie bereits angemeldet.</h3>
        <p>Sie können mit Ihrer bestehenden Sitzung weiterarbeiten. Für einen anderen Zugang melden Sie sich zuerst über die reguläre Abmeldung Ihres Kontos ab.</p>
        <div className="cs-device-actions"><button data-tv-existing-session type="button" className="cs-device-button primary" onClick={() => router.replace(existingTarget.homePath as never)}>Mit bestehender Sitzung fortfahren</button><button type="button" className="cs-device-button quiet" onClick={onExit}>Zurück</button></div>
      </>}
    </div>}
  </section>;
}
export default TvDeviceLogin;
