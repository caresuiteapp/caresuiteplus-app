// Generated native presentation from src/components/office/documentSignatures/OfficeSignatureReview.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeStyle,NativeDiv,NativeDl,NativeDt,NativeDd,NativeP,NativeSection,NativeH3,NativeSpan,NativeIframe,NativeA,NativeStrong,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter } from "../../../hooks/useFlowRouter.ts";
import { DocumentsWorkspaceShell } from "../../documents/DocumentsWorkspaceShell.native.tsx";
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchOfficeSignatureReview } from "../../../lib/portal/officeSignatureReviewService.native.ts";
import { PORTAL_SIGNATURE_STATUS_LABELS } from '@/types/portal/documentSignatures';
import { signatureWorkspaceCss } from "./signatureWorkspaceCss.native.ts";
import { signatureDate, SIGNER_LABELS } from "./signatureWorkspaceModel.native.ts";
export function OfficeSignatureReview() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>();
    const router = useFlowRouter();
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can } = usePermissions();
    const allowed = can('office.documents.signatures.view');
    const query = useAsyncQuery(() => fetchOfficeSignatureReview(tenantId!, id, profile?.roleKey, profile), [tenantId, id, profile?.roleKey, profile?.employeeId], { enabled: !!tenantId && !!id && allowed, queryKey: `office-signature-review:${tenantId}:${profile?.id}:${id}` });
    const data = allowed ? query.data : null;
    return <NativeWorkspaceStyleScope css={[signatureWorkspaceCss, signatureWorkspaceCss]}>{<DocumentsWorkspaceShell active="signatures" title={data?.document.title ?? 'Unterschriftsdokument'} description={data ? PORTAL_SIGNATURE_STATUS_LABELS[data.document.status] : 'Dokument und Verlauf ansehen'} back={{ label: 'Zurück zu Unterschriften', onClick: () => router.back() }} actions={allowed ? <NativeButton className="dw-button" disabled={query.loading} onClick={() => void query.refresh()}>Aktualisieren</NativeButton> : undefined}>
    <NativeStyle>{signatureWorkspaceCss}</NativeStyle>
    {!allowed ? <NativeDiv className="ds-empty">Sie haben keine Berechtigung für dieses Dokument.</NativeDiv> : query.loading && !data ? <NativeDiv className="ds-empty" role="status">Dokument wird geladen…</NativeDiv> : query.error || !data ? <NativeDiv role="alert" className="ds-notice ds-notice--error">{query.error ?? 'Das Dokument ist nicht verfügbar.'}<NativeButton className="ds-button" onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : <NativeDiv className="ds-form">
      {query.refreshError ? <NativeDiv role="alert" className="ds-notice ds-notice--error">Der aktuelle Status konnte nicht geladen werden. {query.refreshError}</NativeDiv> : null}
      <NativeDl className="ds-review"><NativeDiv><NativeDt>Status</NativeDt><NativeDd>{PORTAL_SIGNATURE_STATUS_LABELS[data.document.status]}</NativeDd></NativeDiv><NativeDiv><NativeDt>Fälligkeit</NativeDt><NativeDd>{signatureDate(data.document.dueDate)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Versendet von</NativeDt><NativeDd>{data.document.creatorName || 'Verwaltung'}</NativeDd></NativeDiv></NativeDl>
      <NativeP className="ds-notice">Zustellung an: {data.employeeName ?? 'zugeordnetes Mitarbeiterportal'}{data.document.clientName ? ` · Klient:in: ${data.document.clientName}` : ''}</NativeP>
      <NativeSection><NativeH3>Unterschriften</NativeH3>{data.document.signatureFields.map((field) => <NativeDiv className="ds-tags" key={field.id}><NativeSpan className="ds-tag">{field.label}</NativeSpan><NativeSpan className={`ds-tag${(field.role === 'employee' ? data.document.employeeSigned : data.document.clientSigned) ? ' ds-tag--success' : ' ds-tag--warning'}`}>{(field.role === 'employee' ? data.document.employeeSigned : data.document.clientSigned) ? 'Gespeichert' : 'Ausstehend'}</NativeSpan></NativeDiv>)}{!data.document.signatureFields.length ? <NativeP className="ds-muted">{data.document.employeeSigned ? 'Mitarbeiter-Unterschrift gespeichert. ' : ''}{data.document.clientSigned ? 'Klienten-Unterschrift gespeichert.' : ''}{!data.document.employeeSigned && !data.document.clientSigned ? 'Noch keine Unterschrift gespeichert.' : ''}</NativeP> : null}{data.document.captures.map((capture) => <NativeP className="ds-muted" key={capture.id}>{SIGNER_LABELS[capture.signerRole]}: {capture.signerName} · {new Date(capture.signedAt).toLocaleString('de-DE')}</NativeP>)}</NativeSection>
      <NativeSection><NativeH3>Dokumentinhalt</NativeH3>{data.fileError ? <NativeDiv className="ds-notice ds-notice--error">{data.fileError}<NativeButton className="ds-button" onClick={() => void query.refresh()}>PDF erneut laden</NativeButton></NativeDiv> : null}{data.pdfUrl ? <><NativeIframe title={`PDF: ${data.document.title}`} src={data.pdfUrl} className="ds-pdf"/>{data.document.allowDownload ? <NativeA href={data.pdfUrl} target="_blank" rel="noopener noreferrer" className="ds-button">PDF öffnen</NativeA> : null}</> : null}{data.document.previewHtml ? <DocumentHtmlPreview title={data.document.title} previewHtml={data.document.previewHtml}/> : !data.pdfUrl ? <NativeP className="ds-muted">Für dieses Dokument liegt keine Vorschau vor.</NativeP> : null}</NativeSection>
      <NativeSection><NativeH3>Verlauf</NativeH3>{data.document.auditTrail.length ? data.document.auditTrail.map((event) => <NativeDiv key={event.id}><NativeStrong>{event.summary}</NativeStrong><NativeP className="ds-muted">{new Date(event.createdAt).toLocaleString('de-DE')}{event.actorName ? ` · ${event.actorName}` : ''}</NativeP></NativeDiv>) : <NativeP className="ds-muted">Es liegen noch keine Verlaufseinträge vor.</NativeP>}</NativeSection>
    </NativeDiv>}
  </DocumentsWorkspaceShell>}</NativeWorkspaceStyleScope>;
}
