import { fetchValidVisitSignature } from '@/lib/assist/assistExecutionPersistenceService';
import { withWorkflowTimeout } from '@/features/assistWorkflow/internal/withWorkflowTimeout';

export type VisitSignatureConfirmation =
  | { state: 'confirmed' }
  | { state: 'missing'; message: string }
  | { state: 'writing' }
  | { state: 'unavailable'; message: string };

export const SIGNATURE_NOT_STORED_MESSAGE =
  'Auf dem Server ist keine gültige Unterschrift gespeichert. Bitte die Unterschrift erneut speichern oder neu erfassen.';

const UNAVAILABLE_MESSAGE =
  'Der Speicherstatus konnte nicht geprüft werden. Bitte die Verbindung prüfen und den Status erneut abrufen.';

/** A local pending flag is not evidence of either a saved or an active signature. */
export async function readVisitSignatureConfirmation(input: {
  tenantId: string;
  visitId: string;
  isWritePending: () => boolean;
}): Promise<VisitSignatureConfirmation> {
  if (!input.tenantId || !input.visitId) {
    return { state: 'unavailable', message: UNAVAILABLE_MESSAGE };
  }
  // A prior valid signature must not confirm a replacement still being uploaded.
  if (input.isWritePending()) return { state: 'writing' };
  try {
    const result = await withWorkflowTimeout(
      fetchValidVisitSignature(input.tenantId, input.visitId),
      6_000,
      'signatureConfirmationRead',
    );
    // The write may have started while the read was in flight.
    if (input.isWritePending()) return { state: 'writing' };
    if (!result.ok || result.tableMissing) {
      return { state: 'unavailable', message: UNAVAILABLE_MESSAGE };
    }
    if (!result.data) return { state: 'missing', message: SIGNATURE_NOT_STORED_MESSAGE };
    const signature = result.data;
    if (
      signature.tenantId !== input.tenantId || signature.visitId !== input.visitId ||
      !signature.isValid || !signature.storagePath || !signature.signatureHash
    ) {
      return { state: 'unavailable', message: UNAVAILABLE_MESSAGE };
    }
    return { state: 'confirmed' };
  } catch {
    return input.isWritePending()
      ? { state: 'writing' }
      : { state: 'unavailable', message: UNAVAILABLE_MESSAGE };
  }
}
