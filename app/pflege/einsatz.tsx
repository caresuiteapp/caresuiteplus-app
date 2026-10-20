import { ScreenShell } from '@/components/layout';
import { InfoBanner } from '@/components/ui';

export default function CareVisitWorkspaceFallback() {
  return (
    <ScreenShell title="Pflegeeinsatz">
      <InfoBanner variant="info" message="Die erweiterte Pflegeeinsatzbearbeitung steht derzeit in der Web-Version zur Verfügung." />
    </ScreenShell>
  );
}
