import { InfoBanner } from '@/components/ui';
import {
  MEDICAL_DOCUMENTATION_DISCLAIMER,
  MEDICAL_MDR_RISK_HINT,
  MEDICAL_NO_THERAPY_HINT,
} from '@/types/medical';

type MedicalDocumentationDisclaimerProps = {
  showMdrRisk?: boolean;
  showNoTherapyHint?: boolean;
  compact?: boolean;
};

/** Pflicht-Hinweis: Dokumentationshilfe, keine medizinische Entscheidung. */
export function MedicalDocumentationDisclaimer({
  showMdrRisk = true,
  showNoTherapyHint = false,
  compact = false,
}: MedicalDocumentationDisclaimerProps) {
  const messages = [MEDICAL_DOCUMENTATION_DISCLAIMER];
  if (showNoTherapyHint) {
    messages.push(MEDICAL_NO_THERAPY_HINT);
  }
  if (showMdrRisk) {
    messages.push(MEDICAL_MDR_RISK_HINT);
  }

  return (
    <InfoBanner
      variant="warning"
      title={compact ? 'Dokumentationshilfe' : 'Keine medizinische Entscheidung'}
      message={messages.join(' ')}
    />
  );
}

export { MEDICAL_DOCUMENTATION_DISCLAIMER, MEDICAL_MDR_RISK_HINT };
