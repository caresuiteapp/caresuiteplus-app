import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { DocumentsWorkspaceShell, DocumentWorkspaceIcon } from '@/components/documents/DocumentsWorkspaceShell.web';
import { CsDocumentSendWizard } from '@/components/office/documentSignatures/CsDocumentSendWizard.web';
import { OfficeSignatureDocumentComposer } from '@/components/office/OfficeSignatureDocumentComposer.web';
import { signatureWorkspaceCss } from '@/components/office/documentSignatures/signatureWorkspaceCss.web';
import { isSignatureOverdue, matchesSignatureSearch, matchesSignatureTab, signatureDate, signatureRows, SIGNER_LABELS, type SignatureWorkspaceTab } from '@/components/office/documentSignatures/signatureWorkspaceModel.web';
import { usePageTab } from '@/hooks/usePageTab';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchCsDocumentRequests, fetchCsDocumentTemplates, sendCsDocumentRequest } from '@/lib/documents/csTemplates';
import { composeOfficeSignatureDocumentForPortal, fetchOfficeSignatureDocuments } from '@/lib/portal/portalDocumentSignatureService';
import { resolveCsDocumentRequestStatusLabel, type CsRecipientScope } from '@/types/documents/csTemplateDatabase';
import { PORTAL_SIGNATURE_STATUS_LABELS, PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS } from '@/types/portal/documentSignatures';

const TABS: { key: SignatureWorkspaceTab; label: string }[] = [{ key: 'open', label: 'Offen' }, { key: 'in_progress', label: 'In Bearbeitung' }, { key: 'completed', label: 'Erledigt' }, { key: 'all', label: 'Alle' }];

export function CsOfficeDocumentSignaturesScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, isReadOnly } = usePermissions();
  const canView = can('office.documents.view');
  const canViewPortal = can('office.documents.signatures.view');
  const canSend = can('documents.create') && !isReadOnly;
  const canCompose = can('office.documents.signatures.manage') && !isReadOnly;
  const [storedTab, setTab] = usePageTab<string>('CsOfficeDocumentSignaturesScreen.tab', 'open');
  const tab: SignatureWorkspaceTab = TABS.some((item) => item.key === storedTab) ? storedTab as SignatureWorkspaceTab : 'open';
  const [search, setSearch] = useState('');
  const [sendMode, setSendMode] = useState<'template' | 'compose' | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sendWorking, setSendWorking] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const requestQuery = useAsyncQuery(() => fetchCsDocumentRequests(tenantId!, profile?.roleKey, 'all'), [tenantId, profile?.roleKey], { enabled: !!tenantId && canView, queryKey: `office-signatures:${tenantId}:${profile?.id}:requests` });
  const portalQuery = useAsyncQuery(() => fetchOfficeSignatureDocuments(tenantId!, profile?.roleKey ?? null), [tenantId, profile?.roleKey], { enabled: !!tenantId && canViewPortal, queryKey: `office-signatures:${tenantId}:${profile?.id}:portal` });
  const templateQuery = useAsyncQuery(() => fetchCsDocumentTemplates(tenantId!, profile?.roleKey), [tenantId, profile?.roleKey, sendMode], { enabled: !!tenantId && canSend && sendMode === 'template', queryKey: `office-signatures:${tenantId}:${profile?.id}:templates` });
  const rows = useMemo(() => signatureRows(canView ? requestQuery.data ?? [] : [], canViewPortal ? portalQuery.data ?? [] : []), [requestQuery.data, portalQuery.data, canView, canViewPortal]);
  const filtered = rows.filter((row) => matchesSignatureTab(row, tab) && matchesSignatureSearch(row, search));
  const loading = (canView && requestQuery.loading) || (canViewPortal && portalQuery.loading);
  const errors = [canView && (requestQuery.error || requestQuery.refreshError), canViewPortal && (portalQuery.error || portalQuery.refreshError)].filter(Boolean);
  const refresh = () => Promise.allSettled([...(canView ? [requestQuery.refresh()] : []), ...(canViewPortal ? [portalQuery.refresh()] : [])]);
  function openSend(mode: 'template' | 'compose') { opener.current = document.activeElement as HTMLElement; setSuccess(null); setSendMode(mode); }
  function closeSend() { setSendMode(null); opener.current?.focus(); }
  useEffect(() => { if (sendMode) closeRef.current?.focus(); }, [sendMode]);
  useEffect(() => { setSendMode(null); setSearch(''); setSuccess(null); }, [tenantId, profile?.id]);
  const send = async (input: { templateKey: string; recipientScope: CsRecipientScope; employeeId?: string; clientId?: string }) => {
    if (!tenantId || !canSend) return { ok: false, error: 'Für den Versand fehlt die Berechtigung.' };
    const result = await sendCsDocumentRequest({ ...input, tenantId, createdBy: profile?.id ?? null }, profile?.roleKey, { name: profile?.displayName, email: profile?.email });
    if (result.ok) { setSuccess('Das Dokument wurde an die ausgewählten Empfänger gesendet.'); setTab('open'); await refresh(); }
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };
  return <DocumentsWorkspaceShell active="signatures" title="Unterschriften" description="Dokumente versenden, ausstehende Unterschriften verfolgen und abgeschlossene Vorgänge ansehen."
    actions={<><button className="dw-button" onClick={() => void refresh()} disabled={loading}><DocumentWorkspaceIcon name="refresh" />Aktualisieren</button>{canCompose || canSend ? <button className="dw-button dw-button--primary" onClick={() => openSend(canCompose ? 'compose' : 'template')}><DocumentWorkspaceIcon name="plus" />Dokument senden</button> : null}</>}
    stats={<>{[{ label: 'Offene Vorgänge', value: rows.filter((row) => matchesSignatureTab(row, 'open')).length }, { label: 'Überfällig', value: rows.filter((row) => isSignatureOverdue(row)).length }, { label: 'Erledigt', value: rows.filter((row) => matchesSignatureTab(row, 'completed')).length }].map((stat) => <div className="dw-metric" key={stat.label}><strong>{loading && !rows.length ? '…' : stat.value}</strong><span>{stat.label}</span></div>)}</>}>
    <style>{signatureWorkspaceCss}</style>
    {!canView && !canViewPortal ? <div className="ds-empty">Sie haben keine Berechtigung, Unterschriftsvorgänge anzusehen.</div> : <>
      {isReadOnly ? <p className="ds-notice">Lesemodus: Sie können vorhandene Dokumente und deren Status ansehen.</p> : null}
      {success ? <p role="status" className="ds-notice ds-notice--success">{success}</p> : null}
      {errors.length ? <div role="alert" className="ds-notice ds-notice--error"><strong>Die Liste konnte nicht vollständig aktualisiert werden.</strong><p>{errors.join(' ')}</p><button className="ds-button" onClick={() => void refresh()}>Erneut laden</button></div> : null}
      <div className="ds-toolbar"><div className="ds-tabs" aria-label="Dokumentstatus">{TABS.map((option) => <button key={option.key} aria-pressed={tab === option.key} onClick={() => setTab(option.key)}>{option.label} <span>{rows.filter((row) => matchesSignatureTab(row, option.key)).length}</span></button>)}</div><input type="search" aria-label="Unterschriftsvorgänge durchsuchen" placeholder="Dokumente durchsuchen" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {loading && !rows.length ? <div className="ds-empty" role="status">Unterschriftsvorgänge werden geladen…</div> : filtered.length ? <div className="ds-list">{filtered.map((row) => {
        const completed = matchesSignatureTab(row, 'completed');
        const overdue = isSignatureOverdue(row);
        const status = row.source === 'portal' ? PORTAL_SIGNATURE_STATUS_LABELS[row.item.status] : resolveCsDocumentRequestStatusLabel(row.item.status);
        const recipient = row.source === 'portal' ? row.item.clientName ?? 'Mitarbeiterportal' : SIGNER_LABELS[row.item.recipientScope];
        return <article key={`${row.source}:${row.item.id}`} className="ds-row"><div><h3>{row.item.title}</h3><p className="ds-muted">{row.source === 'portal' ? PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS[row.item.documentType] : 'Signaturvorlage'} · {recipient} · Erstellt am {signatureDate(row.item.createdAt)}</p><div className="ds-tags"><span className={`ds-tag${completed ? ' ds-tag--success' : ''}`}>{status}</span><span className={`ds-tag${overdue ? ' ds-tag--warning' : ''}`}>{overdue ? 'Überfällig seit ' : row.item.dueDate ? 'Fällig am ' : ''}{signatureDate(row.item.dueDate)}</span>{row.source === 'request' && row.item.pendingSignatureRoles.length ? <span className="ds-tag">Offen: {row.item.pendingSignatureRoles.map((role) => SIGNER_LABELS[role]).join(', ')}</span> : null}{row.source === 'portal' && row.item.nextSignerRole && !completed ? <span className="ds-tag">Nächste Unterschrift: {SIGNER_LABELS[row.item.nextSignerRole]}</span> : null}</div></div><button className="ds-button" onClick={() => router.push(`/business/office/documents/signatures/${row.item.id}${row.source === 'portal' ? '?source=portal' : ''}` as never)}>Dokument ansehen</button></article>;
      })}</div> : !errors.length ? <div className="ds-empty"><h3>{search ? 'Keine passenden Dokumente' : tab === 'completed' ? 'Noch keine abgeschlossenen Vorgänge' : 'Keine Dokumente in dieser Ansicht'}</h3><p>{search ? 'Ändern Sie den Suchbegriff oder wählen Sie einen anderen Status.' : 'Gesendete Dokumente erscheinen hier mit ihrem aktuellen Unterschriftsstatus.'}</p>{search ? <button className="ds-button" onClick={() => setSearch('')}>Suche zurücksetzen</button> : null}</div> : null}
    </>}
    {sendMode ? <div className="ds-overlay" onKeyDown={(event) => {
      if (event.key === 'Escape' && !sendWorking) { event.preventDefault(); closeSend(); }
      if (event.key === 'Tab') { const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')).filter((element) => element.offsetParent !== null); const first = elements[0]; const last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    }}><div className="ds-dialog" role="dialog" aria-modal="true" aria-labelledby="ds-send-title"><div className="ds-dialog-header"><div><h2 id="ds-send-title">Dokument zur Unterschrift senden</h2><p className="ds-muted">Vollständiges Dokument prüfen und gezielt zustellen.</p></div><button ref={closeRef} className="ds-button" aria-label="Versand schließen" disabled={sendWorking} onClick={closeSend}>Schließen</button></div>
      {canCompose && canSend ? <div className="ds-tabs" style={{ marginBottom: 20 }}><button disabled={sendWorking} aria-pressed={sendMode === 'compose'} onClick={() => setSendMode('compose')}>Schreiben / PDF</button><button disabled={sendWorking} aria-pressed={sendMode === 'template'} onClick={() => setSendMode('template')}>Bestehende Signaturvorlage</button></div> : null}
      {sendMode === 'compose' && canCompose ? <OfficeSignatureDocumentComposer onBusyChange={setSendWorking} accentColor="#1769ad" onCancel={closeSend} onSubmit={async (input) => {
        if (!tenantId || !canCompose) return { ok: false, error: 'Für den Versand fehlt die Berechtigung.' };
        const result = await composeOfficeSignatureDocumentForPortal({ ...input, tenantId, creatorName: profile?.displayName ?? 'Verwaltung', creatorProfileId: profile?.id ?? null }, profile?.roleKey ?? null);
        if (result.ok) { closeSend(); setSuccess('Das Dokument wurde an das ausgewählte Mitarbeiterportal gesendet.'); setTab('open'); await refresh(); }
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      }} /> : templateQuery.loading ? <p role="status" className="ds-empty">Signaturvorlagen werden geladen…</p> : templateQuery.error ? <div role="alert" className="ds-notice ds-notice--error">{templateQuery.error}<button className="ds-button" onClick={() => void templateQuery.refresh()}>Erneut laden</button></div> : <CsDocumentSendWizard onBusyChange={setSendWorking} tenantId={tenantId ?? ''} templates={templateQuery.data ?? []} officeUserName={profile?.displayName} onSend={send} onClose={closeSend} />}
    </div></div> : null}
  </DocumentsWorkspaceShell>;
}
