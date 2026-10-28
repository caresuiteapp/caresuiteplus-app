// Generated native presentation from src/screens/platformConsole/TenantAccountsTab.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeSection,NativeH3,NativeP,NativeButton,NativeLabel,NativeInput,NativeArticle,NativeDl,NativeDt,NativeDd} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlatformConfirmModal } from "../../components/platformConsole/PlatformConfirmModal.native.tsx";
import { ConsoleStyle, ConsoleBadge } from "../../components/platformConsole/ConsoleWorkspaceUi.native.tsx";
import { platformRoleHasCapability } from "../../lib/platformConsole/platformCapabilities.native.ts";
import { consoleDate, consoleLabel } from "../../lib/platformConsole/consoleWorkspaceModel.native.ts";
import { platformName, platformMailIssue } from "../../lib/platformConsole/platformLanguage.native.ts";
import { listPlatformAccounts, managePlatformAccount, type PlatformAccount } from '@/lib/platformConsole/platformAccountService';
import type { PlatformRoleKey } from '@/types/platformConsole';
import { usePlatformOperation } from "../../hooks/usePlatformOperation.native.ts";
import { managePlatformAccountAccess } from '@/lib/platformConsole/platformAccessService';
import { ACCOUNT_ACCESS_ACTIONS, accountAccessActions, accountAccessConfirmation, accountAccessDescription, type PlatformAccountAccessAction } from '@/lib/platformConsole/platformAccessLifecycle';
export function TenantAccountsTab({ tenantId, role, companyStatus = 'active', onDirtyChange }: {
    tenantId: string;
    role: PlatformRoleKey | null | undefined;
    companyStatus?: string;
    onDirtyChange?: (dirty: boolean) => void;
}) {
    const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [readError, setReadError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [emailAccount, setEmailAccount] = useState<string | null>(null);
    const [newEmail, setNewEmail] = useState('');
    const [authorized, setAuthorized] = useState(false);
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [accessConfirm, setAccessConfirm] = useState<{
        account: PlatformAccount;
        action: PlatformAccountAccessAction;
        tenantId: string;
    } | null>(null);
    const [confirm, setConfirm] = useState<{
        account: PlatformAccount;
        action: 'email_change' | 'password_recovery' | 'welcome_resend';
        nonce: string;
        newEmail?: string;
    } | null>(null);
    const operation = usePlatformOperation();
    const clearOperation = operation.clear;
    const revision = useRef(0);
    const canWrite = platformRoleHasCapability(role, 'tenants.write');
    const canManageAccess = platformRoleHasCapability(role, 'tenants.suspend');
    const currentTenant = useRef(tenantId);
    currentTenant.current = tenantId;
    const load = useCallback(async () => {
        const r = ++revision.current;
        setLoading(true);
        setReadError(null);
        const result = await listPlatformAccounts(tenantId, includeDeleted);
        if (r !== revision.current)
            return;
        if (result.ok)
            setAccounts(result.data);
        else {
            setAccounts([]);
            setReadError(result.error);
        }
        setLoading(false);
    }, [tenantId, includeDeleted]);
    useEffect(() => { setConfirm(null); setAccessConfirm(null); setMessage(null); setEmailAccount(null); setNewEmail(''); setAuthorized(false); setIncludeDeleted(false); clearOperation(); }, [tenantId, clearOperation]);
    useEffect(() => { const counter = revision; void load(); return () => { counter.current++; }; }, [load]);
    useEffect(() => { onDirtyChange?.(!!newEmail.trim()); }, [newEmail, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
    const ask = (account: PlatformAccount, action: 'email_change' | 'password_recovery' | 'welcome_resend') => {
        operation.clear();
        setMessage(null);
        setConfirm({ account, action, nonce: crypto.randomUUID(), ...(action === 'email_change' ? { newEmail: newEmail.trim().toLowerCase() } : {}) });
    };
    const titles = { email_change: 'Anmelde-E-Mail korrigieren', password_recovery: 'Passwortwiederherstellung versenden', welcome_resend: 'Willkommensmail erneut versenden' };
    return <NativeDiv className="cs-console"><ConsoleStyle />
    <NativeSection className="cs-panel"><NativeDiv className="cs-panel-head"><NativeDiv><NativeH3>Anmeldung & E-Mails</NativeH3><NativeP>Verwaltungskonten dieses Unternehmens und der Versandstand der Firmenwillkommensmail.</NativeP></NativeDiv><NativeButton className="cs-btn" disabled={loading || operation.busy} onClick={() => void load()}>Aktualisieren</NativeButton></NativeDiv>
      <NativeDiv className="cs-panel-body">
        <NativeLabel className="cs-field" style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center' }}><NativeInput type="checkbox" aria-label="Gelöschte Konten anzeigen" style={{ width: 20, minHeight: 20, flexShrink: 0 }} checked={includeDeleted} disabled={loading || operation.busy} onChange={event => setIncludeDeleted(event.target.checked)}/>Gelöschte Konten anzeigen</NativeLabel>
        {companyStatus !== 'active' ? <NativeP className="cs-notice">Das Unternehmen ist nicht aktiv. Seine Zugänge haben derzeit keinen Zugriff auf die Unternehmensdaten. {companyStatus === 'deleted_soft' ? 'Stellen Sie zuerst die Unternehmensakte wieder her.' : 'Einzelne Konten können Sie hier weiter verwalten.'}</NativeP> : null}
        {loading ? <NativeP role="status">Benutzerkonten werden geladen…</NativeP> : readError ? <NativeP role="alert" className="cs-notice error">{readError}</NativeP> : !accounts.length ? <NativeP>Es sind keine Verwaltungskonten hinterlegt. Mitarbeitenden- und Klientendaten finden Sie im freigegebenen Support-Arbeitsbereich.</NativeP> : null}
        {message ? <NativeP role="status" className="cs-notice">{message}</NativeP> : null}
        {accounts.map(account => <NativeArticle className="cs-panel" key={account.id}>
          <NativeDiv className="cs-panel-head"><NativeH3>{account.display_name || 'Verwaltungskonto'}</NativeH3><ConsoleBadge value={account.access_state === 'deleted' ? 'deleted' : account.access_state === 'inactive' ? 'inactive' : account.status} label={account.access_state === 'inactive' ? 'Deaktiviert' : account.access_state === 'deleted' ? 'Gelöscht' : consoleLabel(account.status)}/></NativeDiv>
          <NativeDiv className="cs-panel-body"><NativeDl className="cs-kv">
            <NativeDt>Rolle</NativeDt><NativeDd>{platformName(account.role_key, 'Unternehmensrolle')}</NativeDd>
            <NativeDt>Anmelde-E-Mail</NativeDt><NativeDd>{account.email || 'Nicht hinterlegt'}</NativeDd>
            <NativeDt>Benutzername</NativeDt><NativeDd>{account.username || 'Nicht hinterlegt'}</NativeDd>
            <NativeDt>Letzte Anmeldung</NativeDt><NativeDd>{consoleDate(account.last_login_at)}</NativeDd>
            {account.role_key === 'owner' ? <><NativeDt>Willkommensmail</NativeDt><NativeDd>{account.welcome ? platformName(account.welcome.state) : 'Noch kein Versandvorgang'}</NativeDd>
              <NativeDt>Empfänger beim letzten Vorgang</NativeDt><NativeDd>{account.welcome?.recipient_email || '—'}</NativeDd>
              <NativeDt>Letzter Versand</NativeDt><NativeDd>{consoleDate(account.welcome?.sent_at)}</NativeDd></> : null}
          </NativeDl>
          {account.welcome?.last_error_code ? <NativeP className="cs-notice">{platformMailIssue(account.welcome.last_error_code)}</NativeP> : null}
          {account.welcome?.recipient_email && account.welcome.recipient_email !== account.email ? <NativeP className="cs-notice">Die letzte Willkommensmail war an eine andere Adresse gerichtet. Ein neuer Versand verwendet die aktuelle Anmelde-E-Mail.</NativeP> : null}
          {account.open_operation ? <NativeP className="cs-notice" role="status">Für dieses Konto läuft ein Vorgang oder eine Änderung muss geprüft werden. Weitere Kontoaktionen sind bis zur Klärung gesperrt.</NativeP> : null}
          {canWrite && companyStatus === 'active' && account.has_login && account.status === 'active' && !account.open_operation && (!account.access_state || account.access_state === 'active') ? <>
            <NativeDiv className="cs-actions">
              <NativeButton className="cs-btn" disabled={operation.busy} onClick={() => ask(account, 'password_recovery')}>Passwort wiederherstellen</NativeButton>
              {account.role_key === 'owner' ? <NativeButton className="cs-btn" disabled={operation.busy || account.welcome?.state === 'sending'} onClick={() => ask(account, 'welcome_resend')}>Willkommensmail erneut versenden</NativeButton> : null}
              <NativeButton className="cs-btn" disabled={operation.busy} onClick={() => { setEmailAccount(account.id); setNewEmail(''); setAuthorized(false); }}>Anmelde-E-Mail ändern</NativeButton>
            </NativeDiv>
            {emailAccount === account.id ? <NativeDiv className="cs-form-grid"><NativeLabel className="cs-field wide">Neue Anmelde-E-Mail<NativeInput type="email" value={newEmail} disabled={operation.busy} onChange={event => setNewEmail(event.target.value)} autoComplete="off" maxLength={254}/></NativeLabel>
              <NativeLabel className="cs-field wide" style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'start' }}><NativeInput type="checkbox" aria-label="E-Mail-Korrektur beauftragt und geprüft" style={{ width: 20, minHeight: 20, flexShrink: 0 }} checked={authorized} disabled={operation.busy} onChange={event => setAuthorized(event.target.checked)}/>Die berechtigte Person hat diese Korrektur beauftragt; die neue Adresse wurde geprüft.</NativeLabel>
              <NativeDiv className="cs-actions wide"><NativeButton className="cs-btn primary" disabled={operation.busy || !authorized || !newEmail.trim() || newEmail.trim().toLowerCase() === account.email?.toLowerCase() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())} onClick={() => ask(account, 'email_change')}>Korrektur prüfen</NativeButton><NativeButton className="cs-btn" disabled={operation.busy} onClick={() => { setEmailAccount(null); setNewEmail(''); }}>Abbrechen</NativeButton></NativeDiv>
              <NativeP className="wide">Die Anmeldeadresse und eine übereinstimmende primäre Kontaktadresse werden berichtigt. Allgemeine Firmen-, Rechnungs- und Supportadressen bearbeiten Sie unter „Stammdaten“.</NativeP>
            </NativeDiv> : null}
          </> : null}
          {canManageAccess && companyStatus !== 'deleted_soft' && !account.open_operation ? <NativeDiv className="cs-actions" style={{ marginTop: 14 }}>
            {accountAccessActions(account.access_state ?? 'active', account.status).map(action => <NativeButton key={action} className={`cs-btn ${action === 'delete' || action === 'deactivate' ? 'danger' : ''}`} disabled={operation.busy} onClick={() => { operation.clear(); setMessage(null); setConfirm(null); setAccessConfirm({ account, action, tenantId }); }}>{ACCOUNT_ACCESS_ACTIONS[action]}</NativeButton>)}
          </NativeDiv> : null}
        </NativeDiv></NativeArticle>)}
        <NativeP>„Vom Versanddienst angenommen“ bestätigt den Versandauftrag. Eine Zustellung im Posteingang oder das Lesen der E-Mail lässt sich daraus nicht ableiten.</NativeP>
        {!canWrite ? <NativeP>Ihre Rolle hat hier Lesezugriff. Änderungen darf die Plattformverwaltung vornehmen.</NativeP> : null}
      </NativeDiv>
    </NativeSection>
    <PlatformConfirmModal visible={!!confirm} title={confirm ? titles[confirm.action] : ''} loading={operation.busy} error={operation.error} description={confirm ? confirm.action === 'email_change' ? `Bisherige Adresse: ${confirm.account.email}. Neue Adresse: ${confirm.newEmail}. Ein Rücksetz-Link wird an die neue Adresse gesendet; bestehende Anmeldungen werden beim Zurücksetzen des Passworts beendet.` : `Empfänger: ${confirm.account.email}. Bestätigen Sie mit einer Begründung, dass die berechtigte Person diesen Versand angefordert hat.` : ''} requireTypedConfirmation={confirm?.action === 'email_change' ? confirm.newEmail : undefined} onCancel={() => { setConfirm(null); operation.clear(); }} onConfirm={reason => {
            if (!confirm)
                return;
            const request = confirm;
            void operation.run(async () => {
                const requestTenant = tenantId;
                const result = await managePlatformAccount({ nonce: request.nonce, tenantId, tenantUserId: request.account.id, action: request.action,
                    newEmail: request.newEmail, reason, authorizationConfirmed: request.action !== 'email_change' || authorized });
                if (currentTenant.current !== requestTenant)
                    return;
                if (!result.ok)
                    throw new Error(result.error);
                setMessage(result.data.message);
                setNewEmail('');
                setEmailAccount(null);
                setConfirm(null);
                await load();
            });
        }}/>
    <PlatformConfirmModal visible={!!accessConfirm} title={accessConfirm ? ACCOUNT_ACCESS_ACTIONS[accessConfirm.action] : ''} loading={operation.busy} error={operation.error} danger={accessConfirm?.action === 'delete' || accessConfirm?.action === 'deactivate'} description={accessConfirm ? accountAccessDescription(accessConfirm.action, accessConfirm.account.display_name || accessConfirm.account.email || 'Verwaltungskonto') : ''} requireTypedConfirmation={accessConfirm ? accountAccessConfirmation(accessConfirm.action, accessConfirm.account.display_name || accessConfirm.account.email || 'Verwaltungskonto') : undefined} onCancel={() => { setAccessConfirm(null); operation.clear(); }} onConfirm={reason => {
            if (!accessConfirm)
                return;
            const request = accessConfirm;
            void operation.run(async () => {
                const result = await managePlatformAccountAccess({ tenantId: request.tenantId, tenantUserId: request.account.id, action: request.action, reason,
                    expectedStatus: request.account.status, expectedUpdatedAt: request.account.updated_at ?? '',
                    confirmation: accountAccessConfirmation(request.action, request.account.display_name || request.account.email || 'Verwaltungskonto') });
                if (currentTenant.current !== request.tenantId)
                    return;
                if (!result.ok)
                    throw new Error(result.error);
                setMessage(result.data.message);
                setAccessConfirm(null);
                setNewEmail('');
                setEmailAccount(null);
                await load();
            });
        }}/>
  </NativeDiv>;
}
