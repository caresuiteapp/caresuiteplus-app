import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { DocumentsWorkspaceShell, DocumentWorkspaceIcon } from '@/components/documents/DocumentsWorkspaceShell.web';
import { officeDocumentWorkspaceCss, documentSize } from '@/components/office/officeDocumentWorkspace.web';
import { loadOfficeUploadClients, uploadOfficeDocument, OFFICE_UPLOAD_MAX_BYTES } from '@/lib/office/officeDocumentsService.web';
import { CLIENT_DOCUMENT_CATEGORY_LABELS } from '@/types/modules/client/clientDocuments';

export function OfficeDocumentUploadScreen() {
  const router=useRouter(); const {profile}=useAuth();const tenantId=useServiceTenantId();const {can}=usePermissions();
  const [clients,setClients]=useState<{id:string;name:string}[]>([]);const [clientsLoading,setClientsLoading]=useState(true);const [clientsError,setClientsError]=useState<string|null>(null);const [reload,setReload]=useState(0);
  const [clientId,setClientId]=useState('');const [title,setTitle]=useState('');const [category,setCategory]=useState('');const [file,setFile]=useState<File|null>(null);
  const [working,setWorking]=useState(false);const [error,setError]=useState<string|null>(null);const [done,setDone]=useState<string|null>(null);const requestId=useRef<string|null>(null);const active=useRef(true);const uploadLock=useRef<symbol|null>(null);
  const canUpload=can('office.documents.view')&&can('office.clients.edit');
  const scopeKey=`${tenantId??''}:${profile?.id??''}`;const currentScope=useRef({key:scopeKey,generation:0});if(currentScope.current.key!==scopeKey)currentScope.current={key:scopeKey,generation:currentScope.current.generation+1};
  useEffect(()=>{setFile(null);setTitle('');setCategory('');setDone(null);setError(null);setWorking(false);requestId.current=null;uploadLock.current=null;},[scopeKey]);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{let current=true;setClients([]);setClientsError(null);setClientId('');setClientsLoading(true);if(!tenantId||!canUpload){setClientsLoading(false);return;}void loadOfficeUploadClients(tenantId,profile?.roleKey,profile).then(result=>{if(!current)return;if(result.ok)setClients(result.data);else setClientsError(result.error);setClientsLoading(false);}).catch(()=>{if(current){setClientsError('Die Klientenakten konnten nicht geladen werden.');setClientsLoading(false);}});return()=>{current=false;};},[tenantId,profile,canUpload,reload]);
  async function submit(event:FormEvent) {
    event.preventDefault();if(!tenantId||!file||!canUpload||working||uploadLock.current!==null)return;const operationScope=currentScope.current.generation;const operationToken=Symbol('upload');uploadLock.current=operationToken;setWorking(true);setError(null);
    try {
      const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Die Datei konnte nicht gelesen werden.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]??'');reader.readAsDataURL(file);});
      if(!active.current||currentScope.current.generation!==operationScope)return;
      requestId.current??=crypto.randomUUID();
      const result=await uploadOfficeDocument(tenantId,{clientId,title,category,filename:file.name,mimeType:file.type||'application/octet-stream',sizeBytes:file.size,contentBase64:base64,requestId:requestId.current},profile?.roleKey,profile);
      if(!active.current||currentScope.current.generation!==operationScope)return;if(result.ok)setDone(result.data.id);else setError(result.error);
    }catch{if(active.current&&currentScope.current.generation===operationScope)setError('Die Datei konnte nicht verarbeitet werden. Bitte erneut auswählen.');}finally{if(uploadLock.current===operationToken)uploadLock.current=null;if(active.current&&currentScope.current.generation===operationScope)setWorking(false);}
  }
  const navigate=(href:string)=>{if(!working&&uploadLock.current===null)router.push(href as never);};
  const back=()=>navigate('/business/office/documents');
  return <DocumentsWorkspaceShell active="library" title="In Klientenakte hochladen" description="Eine vorhandene Datei mit Titel und Kategorie der richtigen Akte zuordnen." back={{label:'Zur Ablage',onClick:back}} beforeNavigate={()=>!working&&uploadLock.current===null}>
    <style>{officeDocumentWorkspaceCss}</style>
    {!canUpload?<div className="dw-empty">Zum Hochladen benötigen Sie die Berechtigung zum Bearbeiten von Klientenakten.</div>:done?<section className="dw-panel"><div className="dw-alert" data-tone="success" role="status">Das Dokument wurde gespeichert und der gewählten Klientenakte zugeordnet.</div><div className="dw-library-actions"><button type="button" className="dw-button dw-button--primary" onClick={()=>router.push(`/business/office/documents/${done}` as never)}>Dokument öffnen</button><button type="button" className="dw-button" onClick={()=>{setDone(null);setFile(null);setTitle('');setCategory('');requestId.current=null;}}>Weitere Datei hochladen</button><button type="button" className="dw-button dw-button--quiet" onClick={back}>Zur Ablage</button></div></section>:<section className="dw-panel">
      <form className="dw-doc-form" onSubmit={event=>void submit(event)} aria-busy={working}>
        <div className="dw-doc-drop dw-span"><DocumentWorkspaceIcon name="upload" size={36}/><div><strong>{file?file.name:'Datei auswählen'}</strong><p className="dw-muted">{file?documentSize(file.size):'Einzelne Datei bis 20 MB. PDF und Bilder können direkt angezeigt werden.'}</p><input key={scopeKey} type="file" aria-label="Datei zum Hochladen auswählen" disabled={working} onChange={event=>{const next=event.target.files?.[0]??null;setError(null);requestId.current=null;if(next&&(!next.size||next.size>OFFICE_UPLOAD_MAX_BYTES)){setError('Bitte eine nicht leere Datei mit höchstens 20 MB auswählen.');setFile(null);event.target.value='';return;}setFile(next);if(next)setTitle(next.name.replace(/\.[^.]+$/,''));}}/></div></div>
        <label className="dw-field dw-span"><span className="dw-label">Dokumenttitel</span><input className="dw-input" value={title} onChange={event=>{setTitle(event.target.value);requestId.current=null;}} maxLength={180} required disabled={working} placeholder="Zum Beispiel: Ärztliche Verordnung Oktober"/></label>
        <label className="dw-field"><span className="dw-label">Klientenakte</span><select className="dw-select" value={clientId} onChange={event=>{setClientId(event.target.value);requestId.current=null;}} required disabled={working||clientsLoading}><option value="">{clientsLoading?'Akten werden geladen…':'Person auswählen'}</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label className="dw-field"><span className="dw-label">Kategorie</span><select className="dw-select" value={category} onChange={event=>{setCategory(event.target.value);requestId.current=null;}} required disabled={working}><option value="">Kategorie auswählen</option>{Object.entries(CLIENT_DOCUMENT_CATEGORY_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        {clientsError?<div className="dw-alert dw-span" data-tone="danger" role="alert">{clientsError}<button type="button" className="dw-button" onClick={()=>setReload(value=>value+1)}>Erneut laden</button></div>:!clientsLoading&&clients.length===0?<p className="dw-muted dw-span">Es sind keine zugänglichen Klientenakten vorhanden. Legen Sie zuerst die zugehörige Akte an.</p>:null}
        <p className="dw-muted dw-span">Die Datei wird zunächst intern gespeichert. Eine Freigabe für das Klientenportal erfolgt über die Klientenakte.</p>
        {error?<div className="dw-alert dw-span" data-tone="danger" role="alert">{error}</div>:null}
        <div className="dw-library-actions dw-span"><button type="submit" className="dw-button dw-button--primary" disabled={working||!file||!clientId||!category||!title.trim()||!tenantId}>{working?'Dokument wird gespeichert…':'In Akte speichern'}</button><button type="button" className="dw-button" onClick={back} disabled={working}>Abbrechen</button></div>
      </form>
    </section>}
    <section className="dw-panel"><h2>Andere Unterlagen</h2><p className="dw-muted">Unternehmensdokumente erstellen und speichern Sie im zentralen Katalog. Vorhandene Mitarbeiterdateien gehören in die jeweilige Personalakte.</p><div className="dw-library-actions"><button type="button" className="dw-button" disabled={working} onClick={()=>navigate('/business/office/document-catalog?tab=records')}>Katalogdokumente</button>{can('office.employees.view')?<button type="button" className="dw-button" disabled={working} onClick={()=>navigate('/business/office/employees')}>Personalakten</button>:null}</div></section>
  </DocumentsWorkspaceShell>;
}
