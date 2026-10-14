import { useEffect, useRef, useState } from 'react';
import { ClientModuleAssignmentPanel } from '@/components/office/ClientModuleAssignmentPanel.web';
import { PortalRequestsOfficePanel } from '@/components/office/PortalRequestsOfficePanel';
import { PortalUploadsOfficePanel } from '@/components/office/PortalUploadsOfficePanel';
import { portalExperienceCss } from '@/components/office/portalExperienceCss.web';
import { useAuth } from '@/lib/auth/context';
import { fetchClientModuleAssignments, saveClientModuleAssignments } from '@/lib/portal/clientModuleAssignmentService';
import type { PortalModuleKey } from '@/lib/portal/types';
import type { ClientFullDetail, ClientPortalAccess, ClientPortalCredentialsReveal } from '@/types/modules/client';
import { PORTAL_ACCESS_STATUS_LABELS } from '@/types/modules/client';
import { fetchClientPortalAccess, regenerateClientPortalAccessCode, setupClientPortalAccess } from '@/lib/clients/clientPortalAccessService';
import { copyTextToClipboard } from '@/lib/platform/clipboard';

type Props = { client: ClientFullDetail; tenantId: string; isReadOnly?: boolean; onRefresh?: () => void };

/** Remount on identity changes: credentials and pending results never cross client or company boundaries. */
export function ClientPortalAccessPanel(props: Props) {
  return <ClientPortalAccessContent key={`${props.tenantId}:${props.client.id}`} {...props} />;
}

function ClientPortalAccessContent({ client, tenantId, isReadOnly = false, onRefresh }: Props) {
  const { profile } = useAuth();
  const mounted = useRef(true);
  const moduleLock = useRef(false);
  const accessLock = useRef(false);
  const [portalModules, setPortalModules] = useState<PortalModuleKey[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [modulesSaving, setModulesSaving] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [modulesMessage, setModulesMessage] = useState('');
  const [accessBusy, setAccessBusy] = useState<'setup' | 'regenerate' | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [revealedCredentials, setRevealedCredentials] = useState<ClientPortalCredentialsReveal | null>(null);
  const [accessOverride, setAccessOverride] = useState<{ record: ClientPortalAccess; basedOn: ClientPortalAccess[] } | null>(null);
  const serverAccess = useRef(client.portalAccess);
  serverAccess.current = client.portalAccess;
  // A local receipt fills the gap until the parent supplies a fresh server snapshot.
  // Keep one-time credentials separately, so an ordinary refresh does not erase them.
  const access = accessOverride?.basedOn === client.portalAccess ? accessOverride.record : client.portalAccess[0] ?? null;
  const isActive = access?.portalEnabled === true && access.status === 'aktiv';
  const portalStatus = !access ? 'Noch nicht eingerichtet' : !access.portalEnabled ? PORTAL_ACCESS_STATUS_LABELS.nicht_eingerichtet : PORTAL_ACCESS_STATUS_LABELS[access.status] ?? 'Status nicht verfügbar';

  async function loadModules() {
    if (moduleLock.current) return;
    moduleLock.current = true;
    setModulesLoading(true);
    setModulesError(null);
    setModulesMessage('');
    try {
      const result = await fetchClientModuleAssignments(tenantId, client.id);
      if (!mounted.current) return;
      if (result.ok) setPortalModules(result.data.map((item) => item.moduleKey));
      else setModulesError(result.error);
    } catch {
      if (mounted.current) setModulesError('Die Betreuungsbereiche konnten nicht geladen werden. Bitte versuchen Sie es erneut.');
    } finally {
      moduleLock.current = false;
      if (mounted.current) setModulesLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void loadModules();
    return () => { mounted.current = false; };
    // The keyed parent remounts this component for every tenant/client change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleModulesChange(modules: PortalModuleKey[]) {
    if (isReadOnly || moduleLock.current || modulesError) return;
    moduleLock.current = true;
    setModulesSaving(true);
    setModulesMessage('');
    try {
      const result = await saveClientModuleAssignments(tenantId, client.id, modules, profile?.id ?? null);
      if (!mounted.current) return;
      if (result.ok) {
        setPortalModules(result.data.saved);
        setModulesMessage('Betreuungsbereiche gespeichert.');
        onRefresh?.();
      } else setModulesError(`${result.error} Bitte laden Sie den gespeicherten Stand erneut.`);
    } catch {
      if (mounted.current) setModulesError('Die Auswahl konnte nicht bestätigt werden. Bitte laden Sie den gespeicherten Stand erneut.');
    } finally {
      moduleLock.current = false;
      if (mounted.current) setModulesSaving(false);
    }
  }

  async function handleAccessAction(action: 'setup' | 'regenerate') {
    if (isReadOnly || accessLock.current || (action === 'regenerate' && !access)) return;
    accessLock.current = true;
    setAccessBusy(action);
    setAccessError(null);
    setAccessMessage('');
    setCopyFeedback(null);
    setRevealedCredentials(null);
    const actionSnapshot = serverAccess.current;
    try {
      const result = action === 'setup'
        ? await setupClientPortalAccess({ tenantId, clientId: client.id, firstName: client.firstName, lastName: client.lastName, actorRoleKey: profile?.roleKey })
        : await regenerateClientPortalAccessCode({ tenantId, clientId: client.id, accessId: access!.id, actorRoleKey: profile?.roleKey });
      if (!mounted.current) return;
      if (!result.ok) { setAccessError(result.error); return; }
      if (serverAccess.current === actionSnapshot) setAccessOverride({ record: result.data.access, basedOn: actionSnapshot });
      setRevealedCredentials(result.data.credentials);
      setAccessMessage(action === 'setup' ? 'Der Zugang wurde eingerichtet. Sie können die Zugangsdaten jetzt weitergeben.' : 'Der neue Code wurde erstellt. Der bisherige Code ist nicht mehr gültig.');
      const readSnapshot = serverAccess.current;
      const refreshed = await fetchClientPortalAccess(tenantId, client.id);
      if (!mounted.current) return;
      if (refreshed.ok && refreshed.data[0] && serverAccess.current === readSnapshot) setAccessOverride({ record: refreshed.data[0], basedOn: readSnapshot });
      onRefresh?.();
    } catch {
      if (mounted.current) setAccessError('Der Vorgang konnte nicht vollständig bestätigt werden. Prüfen Sie den angezeigten Stand, bevor Sie es erneut versuchen.');
    } finally {
      accessLock.current = false;
      if (mounted.current) setAccessBusy(null);
    }
  }

  async function handleCopy(value: string, label: string) {
    if (accessLock.current) return;
    let copied = false;
    try { copied = await copyTextToClipboard(value); } catch { /* Show the same recoverable feedback. */ }
    if (mounted.current) setCopyFeedback({ ok: copied, message: copied ? `${label} kopiert.` : `${label}: Kopieren fehlgeschlagen. Markieren und kopieren Sie die Angaben manuell.` });
  }

  const username = revealedCredentials?.username ?? access?.portalUsername;
  return <div className="cs-portal">
    <style>{portalExperienceCss}</style>
    <section className="cs-portal-section" aria-label="Anmeldung und Zugangsdaten">
      <div className="cs-portal-heading"><div><span className="cs-portal-eyebrow">Persönlicher Zugang</span><h2>Anmeldung & Zugangsdaten</h2><p>Richten Sie den Zugang ein und geben Sie die Anmeldedaten an die Person weiter.</p></div><span className={`cs-portal-pill${isActive ? ' active' : ''}`}>{portalStatus}</span></div>
      {accessError ? <div className="cs-portal-status error" role="alert">{accessError}</div> : null}
      {accessBusy ? <div className="cs-portal-status" role="status">{accessBusy === 'setup' ? 'Zugang wird eingerichtet…' : 'Neuer Zugangscode wird erstellt…'}</div> : null}
      {accessMessage ? <div className="cs-portal-status success" role="status">{accessMessage}</div> : null}
      <div className="cs-portal-credentials">
        {username ? <div className="cs-portal-row"><div className="cs-portal-credential"><small>Benutzername</small><strong>{username}</strong></div><button className="cs-portal-button" type="button" onClick={() => void handleCopy(username, 'Benutzername')}>Benutzername kopieren</button></div> : <p>Bei der Einrichtung wird der Benutzername aus Vor- und Nachnamen erstellt.</p>}
        {revealedCredentials?.accessCode ? <div className="cs-portal-row"><div className="cs-portal-credential"><small>Persönlicher Zugangscode</small><strong className="cs-portal-code">{revealedCredentials.accessCode}</strong><p className="cs-portal-help">Nur jetzt sichtbar. Geben Sie den Code zusammen mit dem Benutzernamen weiter.</p></div><div className="cs-portal-actions"><button className="cs-portal-button" type="button" onClick={() => void handleCopy(revealedCredentials.accessCode, 'Zugangscode')}>Code kopieren</button>{username ? <button className="cs-portal-button" type="button" onClick={() => void handleCopy(`${username}\n${revealedCredentials.accessCode}`, 'Zugangsdaten')}>Beides kopieren</button> : null}</div></div> : isActive ? <p>Der gespeicherte Code wird nicht angezeigt. Bei Verlust können Sie einen neuen erstellen.</p> : null}
        {access?.lastLoginAt ? <p>Letzte Anmeldung: {new Date(access.lastLoginAt).toLocaleString('de-DE')}</p> : null}
      </div>
      {copyFeedback ? <div className={`cs-portal-status ${copyFeedback.ok ? 'success' : 'error'}`} role={copyFeedback.ok ? 'status' : 'alert'}>{copyFeedback.message}</div> : null}
      {!isReadOnly ? <div className="cs-portal-actions">{!isActive ? <button type="button" className="cs-portal-button primary" disabled={!!accessBusy} onClick={() => void handleAccessAction('setup')}>Zugang einrichten</button> : null}{access?.portalUsername ? <button type="button" className="cs-portal-button" disabled={!!accessBusy} onClick={() => void handleAccessAction('regenerate')}>Neuen Code erstellen</button> : null}</div> : <p>Sie können die Zugangsdaten ansehen. Änderungen sind für Ihren Zugang nicht freigegeben.</p>}
      <p className="cs-portal-help">Ein neuer Code ersetzt den bisherigen. Die Person meldet sich auf der <a href="/auth/portal-code-login" target="_blank" rel="noopener noreferrer">Anmeldeseite des Klientenportals</a> mit Benutzername und Code an.</p>
    </section>

    <div>
      <ClientModuleAssignmentPanel selected={portalModules} onChange={(modules) => void handleModulesChange(modules)} loading={modulesLoading} disabled={isReadOnly || modulesLoading || modulesSaving || !!modulesError} />
      {modulesLoading || modulesSaving ? <div className="cs-portal-status" role="status">{modulesLoading ? 'Betreuungsbereiche werden geladen…' : 'Auswahl wird gespeichert…'}</div> : null}
      {modulesError ? <div className="cs-portal-status error" role="alert">{modulesError}<button type="button" className="cs-portal-button" disabled={modulesLoading || modulesSaving} onClick={() => void loadModules()}>Erneut laden</button></div> : null}
      {modulesMessage ? <div className="cs-portal-status success" role="status">{modulesMessage}</div> : null}
    </div>
    {isActive ? <details className="cs-portal-disclosure"><summary>Eingegangene Dateien und Anliegen</summary><div><PortalUploadsOfficePanel tenantId={tenantId} clientId={client.id} /><PortalRequestsOfficePanel tenantId={tenantId} clientId={client.id} /></div></details> : null}
  </div>;
}
