import { useCallback, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { ScreenShell } from '@/components/layout';
import { ClientIntakeWizardForm } from '@/components/office/clientintakewizardform.web';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { isUuid } from '@/lib/validation/uuid';

export function ClientIntakeWizardScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId?: string | string[] }>();
  const requestedDraftId = Array.isArray(draftId) ? draftId[0] : draftId;
  const validDraftId = isUuid(requestedDraftId) ? requestedDraftId : undefined;
  const close = useCallback(() => router.back(), [router]);
  const closeRequest = useRef<() => void>(close);
  const setCloseRequest = useCallback((handler: (() => void) | null) => { closeRequest.current = handler ?? close; }, [close]);
  return <ScreenShell title={validDraftId ? 'Aufnahme fortsetzen' : 'Klient:in aufnehmen'} subtitle={validDraftId ? 'Gespeicherte Aufnahme' : 'Neue Klientenakte'} scroll={false} compactHeader onBack={() => closeRequest.current()}><div className="ci-page"><SurfaceContrastProvider tone="light">{requestedDraftId && !validDraftId ? <div role="alert"><h2>Aufnahme nicht gefunden</h2><p>Der Link enthält keine gültige Aktennummer. Öffnen Sie die Aufnahme erneut aus der Klientenliste.</p></div> : <ClientIntakeWizardForm key={validDraftId ?? 'new'} mode="create" clientId={validDraftId} onCancel={close} onCloseRequestChange={setCloseRequest} onCreated={id => router.replace(clientRecordRoute(id) as never)} />}</SurfaceContrastProvider></div></ScreenShell>;
}
