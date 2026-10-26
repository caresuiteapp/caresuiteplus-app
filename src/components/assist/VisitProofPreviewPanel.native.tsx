// Generated native presentation from src/components/assist/VisitProofPreviewPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {__nativeWorkspaceStyleSheets as __nativeWorkspaceImportedStyles0} from "./AssignmentDetailStyles.native.tsx";
import {__nativeWorkspaceStyleSheets as __nativeWorkspaceImportedStyles1} from "./AssignmentsWorkspaceShell.native.tsx";
import {NativeSection,NativeHeader,NativeH3,NativeP,NativeDiv,NativeSpan,NativeDl,NativeDt,NativeDd,NativeH4,NativeUl,NativeLi,NativeSmall,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { AssignmentDetailStyles } from "./AssignmentDetailStyles.native.tsx";
import { SignatureDisplay } from '@/components/signatures';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import type { VisitProofPreview } from '@/lib/assist/visitProofPreviewService';
import type { VisitTimesSummary } from '@/features/assistWorkflow/calculateVisitTimes';
import { AssignmentsWorkspaceStyles } from "./AssignmentsWorkspaceShell.native.tsx";
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
    return <NativeWorkspaceStyleScope css={[...__nativeWorkspaceImportedStyles1["AssignmentsWorkspaceStyles"], ...__nativeWorkspaceImportedStyles0["AssignmentDetailStyles"]]}>{<SurfaceContrastProvider tone="light"><AssignmentsWorkspaceStyles /><AssignmentDetailStyles /><NativeSection className="aw-panel ad-card"><NativeHeader><NativeH3>Leistungsnachweis</NativeH3><NativeP>{preview.serviceName}</NativeP></NativeHeader>{loading ? <NativeP role="status">Nachweisvorschau wird geladen…</NativeP> : <>
 {pendingChanges > 0 ? <NativeP className="aw-alert" data-tone="warning">{pendingChanges} Aufgabenänderung(en) sind vorgemerkt. Diese Vorschau enthält ungespeicherte Änderungen.</NativeP> : null}
 {!preview.readyForExport ? <NativeP className="aw-alert" data-tone="warning">{preview.incompleteHint}</NativeP> : null}
 <NativeDiv className="ad-proof-sheet"><NativeDiv className="ad-eyebrow">Leistungsnachweis · Vorschau</NativeDiv><NativeH3>{preview.title}</NativeH3><NativeDiv className="ad-badges"><NativeSpan className="ad-badge" data-tone={pendingChanges || !preview.readyForExport ? 'warning' : undefined}>{pendingChanges ? 'Ungespeicherte Vorschau' : preview.readyForExport ? 'Prüfbereit' : 'Noch unvollständig'}</NativeSpan></NativeDiv>
 <NativeDl className="ad-rows">{fields.map(f => <NativeDiv className="ad-row" key={f.label}><NativeDt>{f.label}{f.required ? ' *' : ''}</NativeDt><NativeDd>{f.value}{f.missing ? ' · fehlt' : ''}</NativeDd></NativeDiv>)}</NativeDl>
 <NativeH4>Aufgaben</NativeH4>{preview.tasks.length ? <NativeUl className="ad-task-summary">{preview.tasks.map(t => <NativeLi key={t.id}><NativeSpan>{t.title}</NativeSpan><NativeSmall>{t.statusLabel}</NativeSmall></NativeLi>)}</NativeUl> : <NativeP className="ad-muted">Keine Aufgaben hinterlegt.</NativeP>}
 {preview.documentationNote ? <><NativeH4>Dokumentation</NativeH4><NativeP className="ad-note">{preview.documentationNote}</NativeP></> : null}
 <SignatureDisplay key={`${preview.visitId}:${preview.signatureImageUrl ?? preview.signature?.dataUrl ?? ''}`} label="Unterschrift Klient:in" signatureImageUrl={preview.signatureImageUrl ?? preview.signature?.dataUrl} signatureDataUrl={preview.signature?.dataUrl} signerName={preview.signature?.signerName} signedAt={preview.signature?.signedAt} signatureType={preview.signature?.signerRole}/>
 </NativeDiv></>}</NativeSection></SurfaceContrastProvider>}</NativeWorkspaceStyleScope>;
}
