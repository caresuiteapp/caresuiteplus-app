// Generated native presentation from src/components/clients/ClientPortalAccessPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStyle,NativeSection,NativeSpan,NativeH2,NativeP,NativeSmall,NativeStrong,NativeButton,NativeA,NativeDetails,NativeSummary,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useRef, useState } from 'react';
import { ClientModuleAssignmentPanel } from "../office/ClientModuleAssignmentPanel.native.tsx";
import { PortalRequestsOfficePanel } from '@/components/office/PortalRequestsOfficePanel';
import { PortalUploadsOfficePanel } from "../office/PortalUploadsOfficePanel.native.tsx";
import { portalExperienceCss } from "../office/portalExperienceCss.native.ts";
import { useAuth } from '@/lib/auth/context';
import { fetchClientModuleAssignments, saveClientModuleAssignments } from '@/lib/portal/clientModuleAssignmentService';
import type { PortalModuleKey } from '@/lib/portal/types';
import type { ClientFullDetail, ClientPortalAccess, ClientPortalCredentialsReveal } from '@/types/modules/client';
import { PORTAL_ACCESS_STATUS_LABELS } from '@/types/modules/client';
import { fetchClientPortalAccess, regenerateClientPortalAccessCode, setupClientPortalAccess } from '@/lib/clients/clientPortalAccessService';
import { copyTextToClipboard } from '@/lib/platform/clipboard';
import { AcademyFamilyAccessPanel } from "./AcademyFamilyAccessPanel.native.tsx";
type Props = {
    client: ClientFullDetail;
    tenantId: string;
    isReadOnly?: boolean;
    onRefresh?: () => void;
};
/** Remount on identity changes: credentials and pending results never cross client or company boundaries. */
export function ClientPortalAccessPanel(props: Props) {
    return <NativeWorkspaceStyleScope css={[portalExperienceCss]}>{<ClientPortalAccessContent key={`${props.tenantId}:${props.client.id}`} {...props}/>}</NativeWorkspaceStyleScope>;
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
    const [copyFeedback, setCopyFeedback] = useState<{
        ok: boolean;
        message: string;
    } | null>(null);
    const [revealedCredentials, setRevealedCredentials] = useState<ClientPortalCredentialsReveal | null>(null);
    const [accessOverride, setAccessOverride] = useState<{
        record: ClientPortalAccess;
        basedOn: ClientPortalAccess[];
    } | null>(null);
    const serverAccess = useRef(client.portalAccess);
    serverAccess.current = client.portalAccess;
    // A local receipt fills the gap until the parent supplies a fresh server snapshot.
    // Keep one-time credentials separately, so an ordinary refresh does not erase them.
    const access = accessOverride?.basedOn === client.portalAccess ? accessOverride.record : client.portalAccess.find((entry) => entry.contactId == null && (!entry.accountKind || entry.accountKind === 'self')) ?? null;
    const isActive = access?.portalEnabled === true && access.status === 'aktiv';
    const portalStatus = !access ? 'Noch nicht eingerichtet' : !access.portalEnabled ? PORTAL_ACCESS_STATUS_LABELS.nicht_eingerichtet : PORTAL_ACCESS_STATUS_LABELS[access.status] ?? 'Status nicht verfügbar';
    async function loadModules() {
        if (moduleLock.current)
            return;
        moduleLock.current = true;
        setModulesLoading(true);
        setModulesError(null);
        setModulesMessage('');
        try {
            const result = await fetchClientModuleAssignments(tenantId, client.id);
            if (!mounted.current)
                return;
            if (result.ok)
                setPortalModules(result.data.map((item) => item.moduleKey));
            else
                setModulesError(result.error);
        }
        catch {
            if (mounted.current)
                setModulesError('Die Betreuungsbereiche konnten nicht geladen werden. Bitte versuchen Sie es erneut.');
        }
        finally {
            moduleLock.current = false;
            if (mounted.current)
                setModulesLoading(false);
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
        if (isReadOnly || moduleLock.current || modulesError)
            return;
        moduleLock.current = true;
        setModulesSaving(true);
        setModulesMessage('');
        try {
            const result = await saveClientModuleAssignments(tenantId, client.id, modules, profile?.id ?? null);
            if (!mounted.current)
                return;
            if (result.ok) {
                setPortalModules(result.data.saved);
                setModulesMessage('Betreuungsbereiche gespeichert.');
                onRefresh?.();
            }
            else
                setModulesError(`${result.error} Bitte laden Sie den gespeicherten Stand erneut.`);
        }
        catch {
            if (mounted.current)
                setModulesError('Die Auswahl konnte nicht bestätigt werden. Bitte laden Sie den gespeicherten Stand erneut.');
        }
        finally {
            moduleLock.current = false;
            if (mounted.current)
                setModulesSaving(false);
        }
    }
    async function handleAccessAction(action: 'setup' | 'regenerate') {
        if (isReadOnly || accessLock.current || (action === 'regenerate' && !access))
            return;
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
            if (!mounted.current)
                return;
            if (!result.ok) {
                setAccessError(result.error);
                return;
            }
            if (serverAccess.current === actionSnapshot)
                setAccessOverride({ record: result.data.access, basedOn: actionSnapshot });
            setRevealedCredentials(result.data.credentials);
            setAccessMessage(action === 'setup' ? 'Der Zugang wurde eingerichtet. Sie können die Zugangsdaten jetzt weitergeben.' : 'Der neue Code wurde erstellt. Der bisherige Code ist nicht mehr gültig.');
            const readSnapshot = serverAccess.current;
            const refreshed = await fetchClientPortalAccess(tenantId, client.id);
            if (!mounted.current)
                return;
            const refreshedSelf = refreshed.ok ? refreshed.data.find((entry) => entry.contactId == null && (!entry.accountKind || entry.accountKind === 'self')) : null;
            if (refreshedSelf && serverAccess.current === readSnapshot)
                setAccessOverride({ record: refreshedSelf, basedOn: readSnapshot });
            onRefresh?.();
        }
        catch {
            if (mounted.current)
                setAccessError('Der Vorgang konnte nicht vollständig bestätigt werden. Prüfen Sie den angezeigten Stand, bevor Sie es erneut versuchen.');
        }
        finally {
            accessLock.current = false;
            if (mounted.current)
                setAccessBusy(null);
        }
    }
    async function handleCopy(value: string, label: string) {
        if (accessLock.current)
            return;
        let copied = false;
        try {
            copied = await copyTextToClipboard(value);
        }
        catch { /* Show the same recoverable feedback. */ }
        if (mounted.current)
            setCopyFeedback({ ok: copied, message: copied ? `${label} kopiert.` : `${label}: Kopieren fehlgeschlagen. Markieren und kopieren Sie die Angaben manuell.` });
    }
    const username = revealedCredentials?.username ?? access?.portalUsername;
    return <NativeWorkspaceStyleScope css={[portalExperienceCss, portalExperienceCss]}>{<NativeDiv className="cs-portal">
    <NativeStyle>{portalExperienceCss}</NativeStyle>
    <NativeSection className="cs-portal-section" aria-label="Anmeldung und Zugangsdaten">
      <NativeDiv className="cs-portal-heading"><NativeDiv><NativeSpan className="cs-portal-eyebrow">Persönlicher Zugang</NativeSpan><NativeH2>Anmeldung & Zugangsdaten</NativeH2><NativeP>Richten Sie den Zugang ein und geben Sie die Anmeldedaten an die Person weiter.</NativeP></NativeDiv><NativeSpan className={`cs-portal-pill${isActive ? ' active' : ''}`}>{portalStatus}</NativeSpan></NativeDiv>
      {accessError ? <NativeDiv className="cs-portal-status error" role="alert">{accessError}</NativeDiv> : null}
      {accessBusy ? <NativeDiv className="cs-portal-status" role="status">{accessBusy === 'setup' ? 'Zugang wird eingerichtet…' : 'Neuer Zugangscode wird erstellt…'}</NativeDiv> : null}
      {accessMessage ? <NativeDiv className="cs-portal-status success" role="status">{accessMessage}</NativeDiv> : null}
      <NativeDiv className="cs-portal-credentials">
        {username ? <NativeDiv className="cs-portal-row"><NativeDiv className="cs-portal-credential"><NativeSmall>Benutzername</NativeSmall><NativeStrong>{username}</NativeStrong></NativeDiv><NativeButton className="cs-portal-button" type="button" onClick={() => void handleCopy(username, 'Benutzername')}>Benutzername kopieren</NativeButton></NativeDiv> : <NativeP>Bei der Einrichtung wird der Benutzername aus Vor- und Nachnamen erstellt.</NativeP>}
        {revealedCredentials?.accessCode ? <NativeDiv className="cs-portal-row"><NativeDiv className="cs-portal-credential"><NativeSmall>Persönlicher Zugangscode</NativeSmall><NativeStrong className="cs-portal-code">{revealedCredentials.accessCode}</NativeStrong><NativeP className="cs-portal-help">Nur jetzt sichtbar. Geben Sie den Code zusammen mit dem Benutzernamen weiter.</NativeP></NativeDiv><NativeDiv className="cs-portal-actions"><NativeButton className="cs-portal-button" type="button" onClick={() => void handleCopy(revealedCredentials.accessCode, 'Zugangscode')}>Code kopieren</NativeButton>{username ? <NativeButton className="cs-portal-button" type="button" onClick={() => void handleCopy(`${username}\n${revealedCredentials.accessCode}`, 'Zugangsdaten')}>Beides kopieren</NativeButton> : null}</NativeDiv></NativeDiv> : isActive ? <NativeP>Der gespeicherte Code wird nicht angezeigt. Bei Verlust können Sie einen neuen erstellen.</NativeP> : null}
        {access?.lastLoginAt ? <NativeP>Letzte Anmeldung: {new Date(access.lastLoginAt).toLocaleString('de-DE')}</NativeP> : null}
      </NativeDiv>
      {copyFeedback ? <NativeDiv className={`cs-portal-status ${copyFeedback.ok ? 'success' : 'error'}`} role={copyFeedback.ok ? 'status' : 'alert'}>{copyFeedback.message}</NativeDiv> : null}
      {!isReadOnly ? <NativeDiv className="cs-portal-actions">{!isActive ? <NativeButton type="button" className="cs-portal-button primary" disabled={!!accessBusy} onClick={() => void handleAccessAction('setup')}>Zugang einrichten</NativeButton> : null}{access?.portalUsername ? <NativeButton type="button" className="cs-portal-button" disabled={!!accessBusy} onClick={() => void handleAccessAction('regenerate')}>Neuen Code erstellen</NativeButton> : null}</NativeDiv> : <NativeP>Sie können die Zugangsdaten ansehen. Änderungen sind für Ihren Zugang nicht freigegeben.</NativeP>}
      <NativeP className="cs-portal-help">Ein neuer Code ersetzt den bisherigen. Die Person meldet sich auf der <NativeA href="/auth/portal-code-login" target="_blank" rel="noopener noreferrer">Anmeldeseite des Klientenportals</NativeA> mit Benutzername und Code an.</NativeP>
    </NativeSection>

    <AcademyFamilyAccessPanel tenantId={tenantId} clientId={client.id} contacts={client.contacts ?? []} isReadOnly={isReadOnly} onRefresh={onRefresh}/>
    <NativeDiv>
      <ClientModuleAssignmentPanel selected={portalModules} onChange={(modules) => void handleModulesChange(modules)} loading={modulesLoading} disabled={isReadOnly || modulesLoading || modulesSaving || !!modulesError}/>
      {modulesLoading || modulesSaving ? <NativeDiv className="cs-portal-status" role="status">{modulesLoading ? 'Betreuungsbereiche werden geladen…' : 'Auswahl wird gespeichert…'}</NativeDiv> : null}
      {modulesError ? <NativeDiv className="cs-portal-status error" role="alert">{modulesError}<NativeButton type="button" className="cs-portal-button" disabled={modulesLoading || modulesSaving} onClick={() => void loadModules()}>Erneut laden</NativeButton></NativeDiv> : null}
      {modulesMessage ? <NativeDiv className="cs-portal-status success" role="status">{modulesMessage}</NativeDiv> : null}
    </NativeDiv>
    {isActive ? <NativeDetails className="cs-portal-disclosure"><NativeSummary>Eingegangene Dateien und Anliegen</NativeSummary><NativeDiv><PortalUploadsOfficePanel tenantId={tenantId} clientId={client.id}/><PortalRequestsOfficePanel tenantId={tenantId} clientId={client.id}/></NativeDiv></NativeDetails> : null}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
