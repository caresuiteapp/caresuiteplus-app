// Generated native presentation from src/screens/office/CsOfficeDocumentSignaturesScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeButton,NativeDiv,NativeStrong,NativeSpan,NativeStyle,NativeP,NativeInput,NativeArticle,NativeH3,NativeH2,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { DocumentsWorkspaceShell, DocumentWorkspaceIcon } from "../../components/documents/DocumentsWorkspaceShell.native.tsx";
import { CsDocumentSendWizard } from "../../components/office/documentSignatures/CsDocumentSendWizard.native.tsx";
import { OfficeSignatureDocumentComposer } from "../../components/office/OfficeSignatureDocumentComposer.native.tsx";
import { signatureWorkspaceCss } from "../../components/office/documentSignatures/signatureWorkspaceCss.native.ts";
import { isSignatureOverdue, matchesSignatureSearch, matchesSignatureTab, signatureDate, signatureRows, SIGNER_LABELS, type SignatureWorkspaceTab } from "../../components/office/documentSignatures/signatureWorkspaceModel.native.ts";
import { usePageTab } from "../../hooks/usePageTab.native.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchCsDocumentRequests, fetchCsDocumentTemplates, sendCsDocumentRequest } from '@/lib/documents/csTemplates';
import { composeOfficeSignatureDocumentForPortal, fetchOfficeSignatureDocuments } from '@/lib/portal/portalDocumentSignatureService';
import { resolveCsDocumentRequestStatusLabel, type CsRecipientScope } from '@/types/documents/csTemplateDatabase';
import { PORTAL_SIGNATURE_STATUS_LABELS, PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS } from '@/types/portal/documentSignatures';
const TABS: {
    key: SignatureWorkspaceTab;
    label: string;
}[] = [{ key: 'open', label: 'Offen' }, { key: 'in_progress', label: 'In Bearbeitung' }, { key: 'completed', label: 'Erledigt' }, { key: 'all', label: 'Alle' }];
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
    useEffect(() => { if (sendMode)
        closeRef.current?.focus(); }, [sendMode]);
    useEffect(() => { setSendMode(null); setSearch(''); setSuccess(null); }, [tenantId, profile?.id]);
    const send = async (input: {
        templateKey: string;
        recipientScope: CsRecipientScope;
        employeeId?: string;
        clientId?: string;
    }) => {
        if (!tenantId || !canSend)
            return { ok: false, error: 'Für den Versand fehlt die Berechtigung.' };
        const result = await sendCsDocumentRequest({ ...input, tenantId, createdBy: profile?.id ?? null }, profile?.roleKey, { name: profile?.displayName, email: profile?.email });
        if (result.ok) {
            setSuccess('Das Dokument wurde an die ausgewählten Empfänger gesendet.');
            setTab('open');
            await refresh();
        }
        return result.ok ? { ok: true } : { ok: false, error: result.error };
    };
    return <NativeWorkspaceStyleScope css={[signatureWorkspaceCss, signatureWorkspaceCss]}>{<DocumentsWorkspaceShell active="signatures" title="Unterschriften" description="Dokumente versenden, ausstehende Unterschriften verfolgen und abgeschlossene Vorgänge ansehen." actions={<><NativeButton className="dw-button" onClick={() => void refresh()} disabled={loading}><DocumentWorkspaceIcon name="refresh"/>Aktualisieren</NativeButton>{canCompose || canSend ? <NativeButton className="dw-button dw-button--primary" onClick={() => openSend(canCompose ? 'compose' : 'template')}><DocumentWorkspaceIcon name="plus"/>Dokument senden</NativeButton> : null}</>} stats={<>{[{ label: 'Offene Vorgänge', value: rows.filter((row) => matchesSignatureTab(row, 'open')).length }, { label: 'Überfällig', value: rows.filter((row) => isSignatureOverdue(row)).length }, { label: 'Erledigt', value: rows.filter((row) => matchesSignatureTab(row, 'completed')).length }].map((stat) => <NativeDiv className="dw-metric" key={stat.label}><NativeStrong>{loading && !rows.length ? '…' : stat.value}</NativeStrong><NativeSpan>{stat.label}</NativeSpan></NativeDiv>)}</>}>
    <NativeStyle>{signatureWorkspaceCss}</NativeStyle>
    {!canView && !canViewPortal ? <NativeDiv className="ds-empty">Sie haben keine Berechtigung, Unterschriftsvorgänge anzusehen.</NativeDiv> : <>
      {isReadOnly ? <NativeP className="ds-notice">Lesemodus: Sie können vorhandene Dokumente und deren Status ansehen.</NativeP> : null}
      {success ? <NativeP role="status" className="ds-notice ds-notice--success">{success}</NativeP> : null}
      {errors.length ? <NativeDiv role="alert" className="ds-notice ds-notice--error"><NativeStrong>Die Liste konnte nicht vollständig aktualisiert werden.</NativeStrong><NativeP>{errors.join(' ')}</NativeP><NativeButton className="ds-button" onClick={() => void refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
      <NativeDiv className="ds-toolbar"><NativeDiv className="ds-tabs" aria-label="Dokumentstatus">{TABS.map((option) => <NativeButton key={option.key} aria-pressed={tab === option.key} onClick={() => setTab(option.key)}>{option.label} <NativeSpan>{rows.filter((row) => matchesSignatureTab(row, option.key)).length}</NativeSpan></NativeButton>)}</NativeDiv><NativeInput type="search" aria-label="Unterschriftsvorgänge durchsuchen" placeholder="Dokumente durchsuchen" value={search} onChange={(event) => setSearch(event.target.value)}/></NativeDiv>
      {loading && !rows.length ? <NativeDiv className="ds-empty" role="status">Unterschriftsvorgänge werden geladen…</NativeDiv> : filtered.length ? <NativeDiv className="ds-list">{filtered.map((row) => {
                    const completed = matchesSignatureTab(row, 'completed');
                    const overdue = isSignatureOverdue(row);
                    const status = row.source === 'portal' ? PORTAL_SIGNATURE_STATUS_LABELS[row.item.status] : resolveCsDocumentRequestStatusLabel(row.item.status);
                    const recipient = row.source === 'portal' ? row.item.clientName ?? 'Mitarbeiterportal' : SIGNER_LABELS[row.item.recipientScope];
                    return <NativeWorkspaceStyleScope css={[signatureWorkspaceCss]}>{<NativeArticle key={`${row.source}:${row.item.id}`} className="ds-row"><NativeDiv><NativeH3>{row.item.title}</NativeH3><NativeP className="ds-muted">{row.source === 'portal' ? PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS[row.item.documentType] : 'Signaturvorlage'} · {recipient} · Erstellt am {signatureDate(row.item.createdAt)}</NativeP><NativeDiv className="ds-tags"><NativeSpan className={`ds-tag${completed ? ' ds-tag--success' : ''}`}>{status}</NativeSpan><NativeSpan className={`ds-tag${overdue ? ' ds-tag--warning' : ''}`}>{overdue ? 'Überfällig seit ' : row.item.dueDate ? 'Fällig am ' : ''}{signatureDate(row.item.dueDate)}</NativeSpan>{row.source === 'request' && row.item.pendingSignatureRoles.length ? <NativeSpan className="ds-tag">Offen: {row.item.pendingSignatureRoles.map((role) => SIGNER_LABELS[role]).join(', ')}</NativeSpan> : null}{row.source === 'portal' && row.item.nextSignerRole && !completed ? <NativeSpan className="ds-tag">Nächste Unterschrift: {SIGNER_LABELS[row.item.nextSignerRole]}</NativeSpan> : null}</NativeDiv></NativeDiv><NativeButton className="ds-button" onClick={() => router.push(`/business/office/documents/signatures/${row.item.id}${row.source === 'portal' ? '?source=portal' : ''}` as never)}>Dokument ansehen</NativeButton></NativeArticle>}</NativeWorkspaceStyleScope>;
                })}</NativeDiv> : !errors.length ? <NativeDiv className="ds-empty"><NativeH3>{search ? 'Keine passenden Dokumente' : tab === 'completed' ? 'Noch keine abgeschlossenen Vorgänge' : 'Keine Dokumente in dieser Ansicht'}</NativeH3><NativeP>{search ? 'Ändern Sie den Suchbegriff oder wählen Sie einen anderen Status.' : 'Gesendete Dokumente erscheinen hier mit ihrem aktuellen Unterschriftsstatus.'}</NativeP>{search ? <NativeButton className="ds-button" onClick={() => setSearch('')}>Suche zurücksetzen</NativeButton> : null}</NativeDiv> : null}
    </>}
    {sendMode ? <NativeDiv className="ds-overlay" onKeyDown={(event) => {
                if (event.key === 'Escape' && !sendWorking) {
                    event.preventDefault();
                    closeSend();
                }
                if (event.key === 'Tab') {
                    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')).filter((element) => element.offsetParent !== null);
                    const first = elements[0];
                    const last = elements[elements.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last?.focus();
                    }
                    else if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault();
                        first?.focus();
                    }
                }
            }}><NativeDiv className="ds-dialog" role="dialog" aria-modal="true" aria-labelledby="ds-send-title"><NativeDiv className="ds-dialog-header"><NativeDiv><NativeH2 id="ds-send-title">Dokument zur Unterschrift senden</NativeH2><NativeP className="ds-muted">Vollständiges Dokument prüfen und gezielt zustellen.</NativeP></NativeDiv><NativeButton ref={closeRef} className="ds-button" aria-label="Versand schließen" disabled={sendWorking} onClick={closeSend}>Schließen</NativeButton></NativeDiv>
      {canCompose && canSend ? <NativeDiv className="ds-tabs" style={{ marginBottom: 20 }}><NativeButton disabled={sendWorking} aria-pressed={sendMode === 'compose'} onClick={() => setSendMode('compose')}>Schreiben / PDF</NativeButton><NativeButton disabled={sendWorking} aria-pressed={sendMode === 'template'} onClick={() => setSendMode('template')}>Bestehende Signaturvorlage</NativeButton></NativeDiv> : null}
      {sendMode === 'compose' && canCompose ? <OfficeSignatureDocumentComposer onBusyChange={setSendWorking} accentColor="#1769ad" onCancel={closeSend} onSubmit={async (input) => {
                    if (!tenantId || !canCompose)
                        return { ok: false, error: 'Für den Versand fehlt die Berechtigung.' };
                    const result = await composeOfficeSignatureDocumentForPortal({ ...input, tenantId, creatorName: profile?.displayName ?? 'Verwaltung', creatorProfileId: profile?.id ?? null }, profile?.roleKey ?? null);
                    if (result.ok) {
                        closeSend();
                        setSuccess('Das Dokument wurde an das ausgewählte Mitarbeiterportal gesendet.');
                        setTab('open');
                        await refresh();
                    }
                    return result.ok ? { ok: true } : { ok: false, error: result.error };
                }}/> : templateQuery.loading ? <NativeP role="status" className="ds-empty">Signaturvorlagen werden geladen…</NativeP> : templateQuery.error ? <NativeDiv role="alert" className="ds-notice ds-notice--error">{templateQuery.error}<NativeButton className="ds-button" onClick={() => void templateQuery.refresh()}>Erneut laden</NativeButton></NativeDiv> : <CsDocumentSendWizard onBusyChange={setSendWorking} tenantId={tenantId ?? ''} templates={templateQuery.data ?? []} officeUserName={profile?.displayName} onSend={send} onClose={closeSend}/>}
    </NativeDiv></NativeDiv> : null}
  </DocumentsWorkspaceShell>}</NativeWorkspaceStyleScope>;
}
