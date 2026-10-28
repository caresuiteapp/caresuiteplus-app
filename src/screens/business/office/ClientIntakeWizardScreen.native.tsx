// Generated native presentation from src/screens/business/office/ClientIntakeWizardScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeH2,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter as useRouter } from "../../../hooks/useFlowRouter.ts";
import { ScreenShell } from '@/components/layout';
import { ClientIntakeWizardForm } from "../../../components/office/clientintakewizardform.native.tsx";
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { isUuid } from '@/lib/validation/uuid';
export function ClientIntakeWizardScreen() {
    const router = useRouter();
    const { draftId } = useLocalSearchParams<{
        draftId?: string | string[];
    }>();
    const requestedDraftId = Array.isArray(draftId) ? draftId[0] : draftId;
    const validDraftId = isUuid(requestedDraftId) ? requestedDraftId : undefined;
    const close = useCallback(() => router.back(), [router]);
    const closeRequest = useRef<() => void>(close);
    const setCloseRequest = useCallback((handler: (() => void) | null) => { closeRequest.current = handler ?? close; }, [close]);
    return <ScreenShell title={validDraftId ? 'Aufnahme fortsetzen' : 'Klient:in aufnehmen'} subtitle={validDraftId ? 'Gespeicherte Aufnahme' : 'Neue Klientenakte'} scroll={false} compactHeader onBack={() => closeRequest.current()}><NativeDiv className="ci-page"><SurfaceContrastProvider tone="light">{requestedDraftId && !validDraftId ? <NativeDiv role="alert"><NativeH2>Aufnahme nicht gefunden</NativeH2><NativeP>Der Link enthält keine gültige Aktennummer. Öffnen Sie die Aufnahme erneut aus der Klientenliste.</NativeP></NativeDiv> : <ClientIntakeWizardForm key={validDraftId ?? 'new'} mode="create" clientId={validDraftId} onCancel={close} onCloseRequestChange={setCloseRequest} onCreated={id => router.replace(clientRecordRoute(id) as never)}/>}</SurfaceContrastProvider></NativeDiv></ScreenShell>;
}
