// Generated native presentation from src/components/office/clientintakemodal.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeStyle,NativeHeader,NativeSpan,NativeH1,NativeButton,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { ClientIntakeWizardForm } from "./clientintakewizardform.native.tsx";
import { clientIntakeExperienceCss } from "./clientIntakeExperienceCss.native.ts";
import type { ClientIntakeModalProps } from './clientintakemodal.tsx';
export type { ClientIntakeModalProps } from './clientintakemodal.tsx';
export function ClientIntakeModal(props: ClientIntakeModalProps) {
    if (!props.visible || typeof document === 'undefined')
        return null;
    return <NativeWorkspaceStyleScope css={[clientIntakeExperienceCss]}>{<IntakeDialog {...props}/>}</NativeWorkspaceStyleScope>;
}
function IntakeDialog({ onClose, mode = 'create', clientId, onCreated, onUpdated }: ClientIntakeModalProps) {
    const titleId = useId();
    const [opener] = useState(() => document.activeElement as HTMLElement | null);
    const dialog = useRef<HTMLDivElement>(null);
    const closeRequest = useRef<() => void>(onClose);
    const setCloseRequest = useCallback((handler: (() => void) | null) => { closeRequest.current = handler ?? onClose; }, [onClose]);
    useEffect(() => { dialog.current?.focus(); }, []);
    return <NativeWorkspaceStyleScope css={[clientIntakeExperienceCss, clientIntakeExperienceCss]}>{<NativeDiv className="ci-modal-overlay"><NativeStyle>{clientIntakeExperienceCss}</NativeStyle><NativeDiv className="ci-modal" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={event => {
            if (event.defaultPrevented)
                return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeRequest.current();
            }
            if (event.key !== 'Tab')
                return;
            const elements = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') ?? [])].filter(element => !element.closest('[inert]') && element.getClientRects().length > 0);
            const first = elements[0];
            const last = elements.at(-1);
            if (!first) {
                event.preventDefault();
                dialog.current?.focus();
                return;
            }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
                event.preventDefault();
                last?.focus();
            }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
                event.preventDefault();
                first.focus();
            }
        }}><NativeHeader className="ci-modal-header"><NativeSpan aria-hidden="true">▤</NativeSpan><NativeH1 id={titleId}>{mode === 'edit' ? 'Klientenakte bearbeiten' : 'Klient:in aufnehmen'}</NativeH1><NativeButton className="ci-modal-close" type="button" aria-label="Aufnahme schließen" onClick={() => closeRequest.current()}>×</NativeButton></NativeHeader><SurfaceContrastProvider tone="light"><ClientIntakeWizardForm mode={mode} clientId={clientId} onCancel={onClose} onCloseRequestChange={setCloseRequest} onCreated={id => { onCreated?.(id); onClose(); }} onUpdated={id => { onUpdated?.(id); onClose(); }} showHero={false}/></SurfaceContrastProvider></NativeDiv></NativeDiv>}</NativeWorkspaceStyleScope>;
}
