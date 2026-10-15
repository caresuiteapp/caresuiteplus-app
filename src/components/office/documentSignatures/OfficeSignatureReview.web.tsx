import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { DocumentsWorkspaceShell } from '@/components/documents/DocumentsWorkspaceShell.web';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchOfficeSignatureReview } from '@/lib/portal/officeSignatureReviewService.web';
import { PORTAL_SIGNATURE_STATUS_LABELS } from '@/types/portal/documentSignatures';
import { signatureWorkspaceCss } from './signatureWorkspaceCss.web';
import { signatureDate, SIGNER_LABELS } from './signatureWorkspaceModel.web';

export function OfficeSignatureReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useFlowRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const allowed = can('office.documents.signatures.view');
  const query = useAsyncQuery(() => fetchOfficeSignatureReview(tenantId!, id, profile?.roleKey, profile), [tenantId, id, profile?.roleKey, profile?.employeeId], { enabled: !!tenantId && !!id && allowed, queryKey: `office-signature-review:${tenantId}:${profile?.id}:${id}` });
  const data = allowed ? query.data : null;
  return <DocumentsWorkspaceShell active="signatures" title={data?.document.title ?? 'Unterschriftsdokument'} description={data ? PORTAL_SIGNATURE_STATUS_LABELS[data.document.status] : 'Dokument und Verlauf ansehen'} back={{ label: 'Zurück zu Unterschriften', onClick: () => router.back() }} actions={allowed ? <button className="dw-button" disabled={query.loading} onClick={() => void query.refresh()}>Aktualisieren</button> : undefined}>
    <style>{signatureWorkspaceCss}</style>
    {!allowed ? <div className="ds-empty">Sie haben keine Berechtigung für dieses Dokument.</div> : query.loading && !data ? <div className="ds-empty" role="status">Dokument wird geladen…</div> : query.error || !data ? <div role="alert" className="ds-notice ds-notice--error">{query.error ?? 'Das Dokument ist nicht verfügbar.'}<button className="ds-button" onClick={() => void query.refresh()}>Erneut laden</button></div> : <div className="ds-form">
      {query.refreshError ? <div role="alert" className="ds-notice ds-notice--error">Der aktuelle Status konnte nicht geladen werden. {query.refreshError}</div> : null}
      <dl className="ds-review"><div><dt>Status</dt><dd>{PORTAL_SIGNATURE_STATUS_LABELS[data.document.status]}</dd></div><div><dt>Fälligkeit</dt><dd>{signatureDate(data.document.dueDate)}</dd></div><div><dt>Versendet von</dt><dd>{data.document.creatorName || 'Verwaltung'}</dd></div></dl>
      <p className="ds-notice">Zustellung an: {data.employeeName ?? 'zugeordnetes Mitarbeiterportal'}{data.document.clientName ? ` · Klient:in: ${data.document.clientName}` : ''}</p>
      <section><h3>Unterschriften</h3>{data.document.signatureFields.map((field) => <div className="ds-tags" key={field.id}><span className="ds-tag">{field.label}</span><span className={`ds-tag${(field.role === 'employee' ? data.document.employeeSigned : data.document.clientSigned) ? ' ds-tag--success' : ' ds-tag--warning'}`}>{(field.role === 'employee' ? data.document.employeeSigned : data.document.clientSigned) ? 'Gespeichert' : 'Ausstehend'}</span></div>)}{!data.document.signatureFields.length ? <p className="ds-muted">{data.document.employeeSigned ? 'Mitarbeiter-Unterschrift gespeichert. ' : ''}{data.document.clientSigned ? 'Klienten-Unterschrift gespeichert.' : ''}{!data.document.employeeSigned && !data.document.clientSigned ? 'Noch keine Unterschrift gespeichert.' : ''}</p> : null}{data.document.captures.map((capture) => <p className="ds-muted" key={capture.id}>{SIGNER_LABELS[capture.signerRole]}: {capture.signerName} · {new Date(capture.signedAt).toLocaleString('de-DE')}</p>)}</section>
      <section><h3>Dokumentinhalt</h3>{data.fileError ? <div className="ds-notice ds-notice--error">{data.fileError}<button className="ds-button" onClick={() => void query.refresh()}>PDF erneut laden</button></div> : null}{data.pdfUrl ? <><iframe title={`PDF: ${data.document.title}`} src={data.pdfUrl} className="ds-pdf" />{data.document.allowDownload ? <a href={data.pdfUrl} target="_blank" rel="noopener noreferrer" className="ds-button">PDF öffnen</a> : null}</> : null}{data.document.previewHtml ? <DocumentHtmlPreview title={data.document.title} previewHtml={data.document.previewHtml} /> : !data.pdfUrl ? <p className="ds-muted">Für dieses Dokument liegt keine Vorschau vor.</p> : null}</section>
      <section><h3>Verlauf</h3>{data.document.auditTrail.length ? data.document.auditTrail.map((event) => <div key={event.id}><strong>{event.summary}</strong><p className="ds-muted">{new Date(event.createdAt).toLocaleString('de-DE')}{event.actorName ? ` · ${event.actorName}` : ''}</p></div>) : <p className="ds-muted">Es liegen noch keine Verlaufseinträge vor.</p>}</section>
    </div>}
  </DocumentsWorkspaceShell>;
}
