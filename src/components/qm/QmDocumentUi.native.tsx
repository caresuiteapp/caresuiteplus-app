// Generated native presentation from src/components/qm/QmDocumentUi.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStrong,NativeP,NativeButton,NativeSpan} from '@/components/layout/NativeWorkspaceElements.native';
import type { ReactNode } from 'react';
import { CatalogIcon } from "../catalog/CatalogWorkspace.native.tsx";
import { QM_DOCUMENT_STATUS_LABELS } from "../../lib/qm/qmDocumentWorkspace.native.ts";
export function QmDocumentState({ title, message, error = false, children }: {
    title: string;
    message: string;
    error?: boolean;
    children?: ReactNode;
}) {
    return <NativeDiv className={error ? 'qm-notice' : 'qm-empty'} data-tone={error ? 'error' : undefined} role={error ? 'alert' : 'status'}><NativeDiv><NativeStrong>{title}</NativeStrong><NativeP>{message}</NativeP></NativeDiv>{children ? <NativeDiv className="qm-actions">{children}</NativeDiv> : null}</NativeDiv>;
}
export function QmDocumentRefresh({ busy, refresh }: {
    busy: boolean;
    refresh: () => Promise<unknown>;
}) {
    return <NativeButton type="button" className="qm-button" disabled={busy} onClick={() => void refresh()}><CatalogIcon kind="refresh"/>{busy ? 'Wird aktualisiert …' : 'Aktualisieren'}</NativeButton>;
}
export function QmDocumentBadge({ status }: {
    status: string;
}) {
    return <NativeSpan className="qmd-status" data-status={status}>{QM_DOCUMENT_STATUS_LABELS[status] ?? 'Status ungeklärt'}</NativeSpan>;
}
