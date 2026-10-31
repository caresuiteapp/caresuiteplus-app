// Generated native presentation from src/components/office/messages/MessageAttachments.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeURL as URL} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeButton,NativeSpan,NativeSmall,NativeImg,NativeAudio,NativeVideo,NativeA} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useRef, useState } from 'react';
import { bytesLabel } from "../../../lib/office/messageWorkspace.native.ts";
import { verifyMessageAttachment, type MessagingActor } from "../../../lib/office/messageWorkspaceService.native.ts";
import { resolveMessageAttachmentUrl, type MessageAttachment } from '@/lib/office/messageattachmentservice';
import { MessageIcon, MessageNotice } from "./MessagePrimitives.native.tsx";
export function MessageFile({ actor, threadId, attachment }: {
    actor: MessagingActor;
    threadId: string;
    attachment: MessageAttachment;
}) {
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const playbackUrl = useRef('');
    const alive = useRef(true);
    const flight = useRef(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; if (playbackUrl.current.startsWith('blob:'))
        URL.revokeObjectURL(playbackUrl.current); }; }, []);
    async function open() {
        if (flight.current)
            return;
        flight.current = true;
        setBusy(true);
        setError('');
        try {
            const allowed = await verifyMessageAttachment(actor, threadId, attachment);
            if (!allowed.ok) {
                if (alive.current)
                    setError(allowed.error);
                return;
            }
            const result = await resolveMessageAttachmentUrl(actor.tenantId, allowed.data);
            if (!alive.current) {
                if (result.ok && result.data.startsWith('blob:'))
                    URL.revokeObjectURL(result.data);
                return;
            }
            if (!result.ok) {
                setError(result.error);
                return;
            }
            if (playbackUrl.current.startsWith('blob:'))
                URL.revokeObjectURL(playbackUrl.current);
            playbackUrl.current = result.data;
            setUrl(result.data);
        }
        catch {
            if (alive.current)
                setError('Der Anhang konnte nicht geöffnet werden.');
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    const mime = attachment.mimeType ?? '';
    return <NativeDiv className="mw-file"><NativeButton type="button" className="mw-file-heading" disabled={busy} onClick={() => void open()} aria-label={`${attachment.fileName} öffnen`}><MessageIcon name={mime.startsWith('audio/') ? 'mic' : 'file'}/><NativeSpan>{attachment.fileName}<NativeSmall>{bytesLabel(attachment.fileSizeBytes)}{busy ? ' · Wird geladen …' : url ? ' · Erneut laden' : ' · Öffnen'}</NativeSmall></NativeSpan><MessageIcon name="download"/></NativeButton>
    {error && <MessageNotice error>{error}</MessageNotice>}
    {url && <>{mime.startsWith('image/') ? <NativeImg src={url} alt={attachment.fileName}/> : mime.startsWith('audio/') ? <NativeAudio src={url} controls preload="metadata" aria-label={attachment.fileName}/> : mime.startsWith('video/') ? <NativeVideo src={url} controls preload="metadata" aria-label={attachment.fileName}/> : null}<NativeA className="mw-button" href={url} download={attachment.fileName} target="_blank" rel="noopener noreferrer"><MessageIcon name="download"/>{mime === 'application/pdf' ? 'PDF öffnen / herunterladen' : 'Datei herunterladen'}</NativeA></>}
  </NativeDiv>;
}
