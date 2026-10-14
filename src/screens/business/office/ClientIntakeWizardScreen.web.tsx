import { useCallback, useRef } from 'react';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { ScreenShell } from '@/components/layout';
import { ClientIntakeWizardForm } from '@/components/office/clientintakewizardform.web';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';

export function ClientIntakeWizardScreen() {
  const router = useRouter();
  const close = useCallback(() => router.back(), [router]);
  const closeRequest = useRef<() => void>(close);
  const setCloseRequest = useCallback((handler: (() => void) | null) => { closeRequest.current = handler ?? close; }, [close]);
  return <ScreenShell title="Klient:in aufnehmen" subtitle="Neue Klientenakte" scroll={false} compactHeader onBack={() => closeRequest.current()}><div className="ci-page"><SurfaceContrastProvider tone="light"><ClientIntakeWizardForm onCancel={close} onCloseRequestChange={setCloseRequest} onCreated={id => router.replace(clientRecordRoute(id) as never)} /></SurfaceContrastProvider></div></ScreenShell>;
}
