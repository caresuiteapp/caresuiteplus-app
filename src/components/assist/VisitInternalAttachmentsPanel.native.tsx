// Generated native presentation from src/components/assist/VisitInternalAttachmentsPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeHeader,NativeH3,NativeP,NativeDiv,NativeArticle,NativeImg,NativeStrong,NativeSpan,NativeButton,NativeA,NativeIframe} from '@/components/layout/NativeWorkspaceElements.native';
import { AssignmentDetailStyles } from "./AssignmentDetailStyles.native.tsx";
import { useEffect, useMemo, useRef, useState } from 'react';
import { PlatformModal } from '@/components/layout/platform';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { parseVisitInternalAttachments, resolveVisitInternalAttachmentUrl, visitInternalAttachmentPreviewMode, type VisitInternalAttachment } from '@/lib/assist/visitInternalAttachmentService';
import { AssignmentsWorkspaceStyles } from "./AssignmentsWorkspaceShell.native.tsx";
type State = {
    url: string | null;
    loading: boolean;
    error: string | null;
};
export function VisitInternalAttachmentsPanel({ storagePaths }: {
    storagePaths: string[];
}) { const tenant = useServiceTenantId(); const { profile } = useAuth(); return <Attachments key={`${tenant}:${profile?.id}:${profile?.roleKey}:${JSON.stringify(storagePaths)}`} storagePaths={storagePaths}/>; }
function Attachments({ storagePaths }: {
    storagePaths: string[];
}) {
    const items = useMemo(() => parseVisitInternalAttachments(Array.from(new Set(storagePaths))), [storagePaths]);
    const [states, setStates] = useState<Record<string, State>>({});
    const [preview, setPreview] = useState<{
        item: VisitInternalAttachment;
        url: string;
    } | null>(null);
    const alive = useRef(true);
    const inFlight = useRef(new Set<string>());
    const load = async (item: VisitInternalAttachment) => {
        if (inFlight.current.has(item.storagePath))
            return;
        inFlight.current.add(item.storagePath);
        setStates(s => ({ ...s, [item.storagePath]: { url: null, loading: true, error: null } }));
        try {
            const url = await resolveVisitInternalAttachmentUrl(item.storagePath);
            if (!alive.current)
                return;
            const safe = url && /^https:\/\//i.test(url) ? url : null;
            setStates(s => ({ ...s, [item.storagePath]: { url: safe, loading: false, error: safe ? null : 'Anhang konnte nicht geladen werden.' } }));
        }
        catch {
            if (alive.current)
                setStates(s => ({ ...s, [item.storagePath]: { url: null, loading: false, error: 'Anhang konnte nicht geladen werden.' } }));
        }
        finally {
            inFlight.current.delete(item.storagePath);
        }
    };
    useEffect(() => {
        alive.current = true;
        for (const item of items)
            void load(item);
        return () => { alive.current = false; };
    }, [items]);
    if (!items.length)
        return null;
    return <NativeSection className="aw-panel ad-card"><AssignmentsWorkspaceStyles /><AssignmentDetailStyles /><NativeHeader><NativeH3>Interne Anhänge</NativeH3><NativeP>{items.length} {items.length === 1 ? 'Datei' : 'Dateien'} · Nur für die Verwaltung, nicht im Klient:innenportal</NativeP></NativeHeader><NativeDiv className="ad-attachment-grid">{items.map(item => { const state = states[item.storagePath]; const mode = visitInternalAttachmentPreviewMode(item.mimeType); return <NativeArticle className="ad-attachment" key={item.storagePath}>{state?.url && mode === 'image' ? <NativeImg src={state.url} alt={item.fileName} loading="lazy" onError={() => setStates(s => ({ ...s, [item.storagePath]: { url: null, loading: false, error: 'Bild konnte nicht geladen werden.' } }))}/> : null}<NativeStrong>{item.fileName}</NativeStrong>{state?.loading ? <NativeSpan className="ad-muted" role="status">Wird geladen…</NativeSpan> : state?.error ? <><NativeSpan className="aw-hint" role="alert">{state.error}</NativeSpan><NativeButton className="aw-button" onClick={() => void load(item)}>Erneut laden</NativeButton></> : state?.url ? mode === 'download' ? <NativeA className="aw-button" href={state.url} target="_blank" rel="noopener noreferrer">Datei öffnen</NativeA> : <NativeButton className="aw-button" onClick={() => setPreview({ item, url: state.url! })}>Vorschau öffnen</NativeButton> : null}</NativeArticle>; })}</NativeDiv><PlatformModal visible={!!preview} title={preview?.item.fileName ?? 'Anhang'} onClose={() => setPreview(null)} surfaceScope="company" maxWidth={960}>{preview ? <NativeDiv style={{ display: 'grid', gap: 12, width: '100%' }}>{visitInternalAttachmentPreviewMode(preview.item.mimeType) === 'image' ? <NativeImg src={preview.url} alt={preview.item.fileName} style={{ width: '100%', maxHeight: '68vh', objectFit: 'contain' }}/> : <NativeIframe src={preview.url} title={preview.item.fileName} style={{ width: '100%', height: '65vh', border: 0, borderRadius: 12 }}/>}<NativeA className="aw-button" href={preview.url} target="_blank" rel="noopener noreferrer">In neuem Tab öffnen</NativeA></NativeDiv> : null}</PlatformModal></NativeSection>;
}
