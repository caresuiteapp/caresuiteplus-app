import { InfoBanner } from '@/components/ui';
import type { ConnectProviderCompliance } from '@/lib/connect/connectPresentation';

type ConnectPrivacyWarningProps = {
  compliance: ConnectProviderCompliance;
  compact?: boolean;
};

export function ConnectPrivacyWarning({ compliance, compact }: ConnectPrivacyWarningProps) {
  if (!compliance.mayTransferHealthData && !compliance.requiresAvv) {
    return null;
  }

  const lines: string[] = [];
  if (compliance.mayTransferHealthData) {
    lines.push('Gesundheitsdaten können betroffen sein.');
  }
  if (compliance.requiresAvv) {
    lines.push('AVV (Auftragsverarbeitungsvertrag) erforderlich.');
  }
  lines.push('Rechtsgrundlage und Rollenrechte prüfen.');
  lines.push('Audit-Protokollierung ist vorbereitet.');
  if (compliance.mayTransferHealthData) {
    lines.push('Einwilligung erforderlich, falls vorgesehen.');
  }

  return (
    <InfoBanner
      variant="warning"
      title={compact ? 'Datenschutz' : 'Datenschutz-Hinweis'}
      message={lines.join(' ')}
    />
  );
}
