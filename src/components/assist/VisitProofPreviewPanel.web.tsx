import { AssignmentDetailStyles } from '@/components/assist/AssignmentDetailStyles.web';
import { SignatureDisplay } from '@/components/signatures';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import type { VisitProofPreview } from '@/lib/assist/visitProofPreviewService';
import type { VisitTimesSummary } from '@/features/assistWorkflow/calculateVisitTimes';
import { AssignmentsWorkspaceStyles } from '@/components/assist/AssignmentsWorkspaceShell.web';
type Props = {
    preview: VisitProofPreview & {
        visitTimes?: VisitTimesSummary | null;
        signatureImageUrl?: string | null;
    };
    loading?: boolean;
    pendingChanges?: number;
};
export function VisitProofPreviewPanel({ preview, loading, pendingChanges = 0 }: Props) {
    const fields = preview.fields.filter(f => f.label !== 'Unterschrift' && f.label !== 'Dokumentation');
    return <SurfaceContrastProvider tone="light"><AssignmentsWorkspaceStyles /><AssignmentDetailStyles /><section className="aw-panel ad-card"><header><h3>Leistungsnachweis</h3><p>{preview.serviceName}</p></header>{loading ? <p role="status">Nachweisvorschau wird geladen…</p> : <>
 {pendingChanges > 0 ? <p className="aw-alert" data-tone="warning">{pendingChanges} Aufgabenänderung(en) sind vorgemerkt. Diese Vorschau enthält ungespeicherte Änderungen.</p> : null}
 {!preview.readyForExport ? <p className="aw-alert" data-tone="warning">{preview.incompleteHint}</p> : null}
 <div className="ad-proof-sheet"><div className="ad-eyebrow">Leistungsnachweis · Vorschau</div><h3>{preview.title}</h3><div className="ad-badges"><span className="ad-badge" data-tone={pendingChanges || !preview.readyForExport ? 'warning' : undefined}>{pendingChanges ? 'Ungespeicherte Vorschau' : preview.readyForExport ? 'Prüfbereit' : 'Noch unvollständig'}</span></div>
 <dl className="ad-rows">{fields.map(f => <div className="ad-row" key={f.label}><dt>{f.label}{f.required ? ' *' : ''}</dt><dd>{f.value}{f.missing ? ' · fehlt' : ''}</dd></div>)}</dl>
 <h4>Aufgaben</h4>{preview.tasks.length ? <ul className="ad-task-summary">{preview.tasks.map(t => <li key={t.id}><span>{t.title}</span><small>{t.statusLabel}</small></li>)}</ul> : <p className="ad-muted">Keine Aufgaben hinterlegt.</p>}
 {preview.documentationNote ? <><h4>Dokumentation</h4><p className="ad-note">{preview.documentationNote}</p></> : null}
 <SignatureDisplay key={`${preview.visitId}:${preview.signatureImageUrl ?? preview.signature?.dataUrl ?? ''}`} label="Unterschrift Klient:in" signatureImageUrl={preview.signatureImageUrl ?? preview.signature?.dataUrl} signatureDataUrl={preview.signature?.dataUrl} signerName={preview.signature?.signerName} signedAt={preview.signature?.signedAt} signatureType={preview.signature?.signerRole}/>
 </div></>}</section></SurfaceContrastProvider>;
}
