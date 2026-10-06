import { useCallback,useEffect,useRef,useState } from 'react';
import { PlatformConfirmModal } from '@/components/platformConsole/PlatformConfirmModal.web';
import { ConsoleStyle,ConsoleBadge } from '@/components/platformConsole/ConsoleWorkspaceUi.web';
import { platformRoleHasCapability } from '@/lib/platformConsole/platformCapabilities';
import { consoleDate,consoleLabel } from '@/lib/platformConsole/consoleWorkspaceModel';
import { platformName,platformMailIssue } from '@/lib/platformConsole/platformLanguage';
import { listPlatformAccounts,managePlatformAccount,type PlatformAccount } from '@/lib/platformConsole/platformAccountService';
import type { PlatformRoleKey } from '@/types/platformConsole';
import { usePlatformOperation } from '@/hooks/usePlatformOperation.web';

export function TenantAccountsTab({tenantId,role,onDirtyChange}:{
  tenantId:string;role:PlatformRoleKey|null|undefined;onDirtyChange?:(dirty:boolean)=>void;
}) {
  const [accounts,setAccounts]=useState<PlatformAccount[]>([]);
  const [loading,setLoading]=useState(true);
  const [readError,setReadError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [emailAccount,setEmailAccount]=useState<string|null>(null);
  const [newEmail,setNewEmail]=useState('');
  const [authorized,setAuthorized]=useState(false);
  const [confirm,setConfirm]=useState<{account:PlatformAccount;action:'email_change'|'password_recovery'|'welcome_resend';nonce:string;newEmail?:string}|null>(null);
  const operation=usePlatformOperation();
  const revision=useRef(0);
  const canWrite=platformRoleHasCapability(role,'tenants.write');
  const load=useCallback(async()=>{
    const r=++revision.current;setLoading(true);setReadError(null);
    const result=await listPlatformAccounts(tenantId);
    if(r!==revision.current)return;
    if(result.ok)setAccounts(result.data);else {setAccounts([]);setReadError(result.error);}
    setLoading(false);
  },[tenantId]);
  useEffect(()=>{const counter=revision;void load();return()=>{counter.current++;};},[load]);
  useEffect(()=>{onDirtyChange?.(!!newEmail.trim());},[newEmail,onDirtyChange]);
  useEffect(()=>()=>onDirtyChange?.(false),[onDirtyChange]);
  const ask=(account:PlatformAccount,action:'email_change'|'password_recovery'|'welcome_resend')=>{
    operation.clear();setMessage(null);
    setConfirm({account,action,nonce:crypto.randomUUID(),...(action==='email_change'?{newEmail:newEmail.trim().toLowerCase()}: {})});
  };
  const titles={email_change:'Anmelde-E-Mail korrigieren',password_recovery:'Passwortwiederherstellung versenden',welcome_resend:'Willkommensmail erneut versenden'};
  return <div className="cs-console"><ConsoleStyle/>
    <section className="cs-panel"><div className="cs-panel-head"><div><h3>Anmeldung & E-Mails</h3><p>Verwaltungskonten dieses Unternehmens und der Versandstand der Firmenwillkommensmail.</p></div><button className="cs-btn" disabled={loading||operation.busy} onClick={()=>void load()}>Aktualisieren</button></div>
      <div className="cs-panel-body">
        {loading?<p role="status">Benutzerkonten werden geladen…</p>:readError?<p role="alert" className="cs-notice error">{readError}</p>:!accounts.length?<p>Es sind keine Verwaltungskonten hinterlegt. Mitarbeitenden- und Klientendaten finden Sie im freigegebenen Support-Arbeitsbereich.</p>:null}
        {message?<p role="status" className="cs-notice">{message}</p>:null}
        {accounts.map(account=><article className="cs-panel" key={account.id}>
          <div className="cs-panel-head"><h3>{account.display_name||'Verwaltungskonto'}</h3><ConsoleBadge value={account.status} label={consoleLabel(account.status)}/></div>
          <div className="cs-panel-body"><dl className="cs-kv">
            <dt>Rolle</dt><dd>{platformName(account.role_key,'Unternehmensrolle')}</dd>
            <dt>Anmelde-E-Mail</dt><dd>{account.email||'Nicht hinterlegt'}</dd>
            <dt>Benutzername</dt><dd>{account.username||'Nicht hinterlegt'}</dd>
            <dt>Letzte Anmeldung</dt><dd>{consoleDate(account.last_login_at)}</dd>
            {account.role_key==='owner'?<><dt>Willkommensmail</dt><dd>{account.welcome?platformName(account.welcome.state):'Noch kein Versandvorgang'}</dd>
              <dt>Empfänger beim letzten Vorgang</dt><dd>{account.welcome?.recipient_email||'—'}</dd>
              <dt>Letzter Versand</dt><dd>{consoleDate(account.welcome?.sent_at)}</dd></>:null}
          </dl>
          {account.welcome?.last_error_code?<p className="cs-notice">{platformMailIssue(account.welcome.last_error_code)}</p>:null}
          {account.welcome?.recipient_email && account.welcome.recipient_email!==account.email?<p className="cs-notice">Die letzte Willkommensmail war an eine andere Adresse gerichtet. Ein neuer Versand verwendet die aktuelle Anmelde-E-Mail.</p>:null}
          {account.open_operation?<p className="cs-notice" role="status">Für dieses Konto läuft ein Vorgang oder eine Änderung muss geprüft werden. Weitere Kontoaktionen sind bis zur Klärung gesperrt.</p>:null}
          {canWrite&&account.has_login&&account.status==='active'&&!account.open_operation?<>
            <div className="cs-actions">
              <button className="cs-btn" disabled={operation.busy} onClick={()=>ask(account,'password_recovery')}>Passwort wiederherstellen</button>
              {account.role_key==='owner'?<button className="cs-btn" disabled={operation.busy||account.welcome?.state==='sending'} onClick={()=>ask(account,'welcome_resend')}>Willkommensmail erneut versenden</button>:null}
              <button className="cs-btn" disabled={operation.busy} onClick={()=>{setEmailAccount(account.id);setNewEmail('');setAuthorized(false);}}>Anmelde-E-Mail ändern</button>
            </div>
            {emailAccount===account.id?<div className="cs-form-grid"><label className="cs-field wide">Neue Anmelde-E-Mail<input type="email" value={newEmail} disabled={operation.busy} onChange={event=>setNewEmail(event.target.value)} autoComplete="off" maxLength={254}/></label>
              <label className="cs-field wide" style={{display:'flex',flexDirection:'row',gap:12,alignItems:'start'}}><input type="checkbox" style={{width:20,minHeight:20,flexShrink:0}} checked={authorized} disabled={operation.busy} onChange={event=>setAuthorized(event.target.checked)}/>Die berechtigte Person hat diese Korrektur beauftragt; die neue Adresse wurde geprüft.</label>
              <div className="cs-actions wide"><button className="cs-btn primary" disabled={operation.busy||!authorized||!newEmail.trim()||newEmail.trim().toLowerCase()===account.email?.toLowerCase()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())} onClick={()=>ask(account,'email_change')}>Korrektur prüfen</button><button className="cs-btn" disabled={operation.busy} onClick={()=>{setEmailAccount(null);setNewEmail('');}}>Abbrechen</button></div>
              <p className="wide">Die Anmeldeadresse und eine übereinstimmende primäre Kontaktadresse werden berichtigt. Allgemeine Firmen-, Rechnungs- und Supportadressen bearbeiten Sie unter „Stammdaten“.</p>
            </div>:null}
          </>:null}
        </div></article>)}
        <p>„Vom Versanddienst angenommen“ bestätigt den Versandauftrag. Eine Zustellung im Posteingang oder das Lesen der E-Mail lässt sich daraus nicht ableiten.</p>
        {!canWrite?<p>Ihre Rolle hat hier Lesezugriff. Änderungen darf die Plattformverwaltung vornehmen.</p>:null}
      </div>
    </section>
    <PlatformConfirmModal visible={!!confirm} title={confirm?titles[confirm.action]:''} loading={operation.busy} error={operation.error}
      description={confirm?confirm.action==='email_change'?`Bisherige Adresse: ${confirm.account.email}. Neue Adresse: ${confirm.newEmail}. Ein Rücksetz-Link wird an die neue Adresse gesendet; bestehende Anmeldungen werden beim Zurücksetzen des Passworts beendet.`:`Empfänger: ${confirm.account.email}. Bestätigen Sie mit einer Begründung, dass die berechtigte Person diesen Versand angefordert hat.`:''}
      requireTypedConfirmation={confirm?.action==='email_change'?confirm.newEmail:undefined}
      onCancel={()=>{setConfirm(null);operation.clear();}}
      onConfirm={reason=>{if(!confirm)return;const request=confirm;void operation.run(async()=>{
        const result=await managePlatformAccount({nonce:request.nonce,tenantId,tenantUserId:request.account.id,action:request.action,
          newEmail:request.newEmail,reason,authorizationConfirmed:request.action!=='email_change'||authorized});
        if(!result.ok)throw new Error(result.error);
        setMessage(result.data.message);setNewEmail('');setEmailAccount(null);setConfirm(null);await load();
      });}}
    />
  </div>;
}
