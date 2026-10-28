// Generated native presentation from src/lib/pflege/careTourPublicationEvidence.web.ts. Update through scripts/port-native-workspaces.mjs.
export type CareTourPublicationEvidence = Readonly<{
    publishedStatus: 'provided';
    currentPlanVersion: 'not_provided';
    publishedSnapshot: 'not_provided';
    addressedRecipients: 'not_provided';
    deliveryReceipts: 'not_provided';
    personalAcknowledgement: 'not_provided';
    changeNotice: 'not_provided';
    statusMayStandForReceipt: false;
    aggregateConfirmationMayStandForPersonalReceipt: false;
    missingEvidence: readonly string[];
}>;
const MISSING_EVIDENCE = Object.freeze([
    'unveränderliche veröffentlichte Planfassung mit eindeutiger Versionskennung',
    'adressierte Empfänger mit Zustellkanal, Versuch, Ergebnis und Zeitpunkt',
    'persönliche Kenntnisnahme genau der aktuellen Planfassung',
    'adressierte Änderungsmitteilung mit Bezug auf alte und neue Fassung',
]);
const EVIDENCE: CareTourPublicationEvidence = Object.freeze({
    publishedStatus: 'provided',
    currentPlanVersion: 'not_provided',
    publishedSnapshot: 'not_provided',
    addressedRecipients: 'not_provided',
    deliveryReceipts: 'not_provided',
    personalAcknowledgement: 'not_provided',
    changeNotice: 'not_provided',
    statusMayStandForReceipt: false,
    aggregateConfirmationMayStandForPersonalReceipt: false,
    missingEvidence: MISSING_EVIDENCE,
});
/** Static Web/Desktop boundary for publication and personal receipt evidence. */
export function getCareTourPublicationEvidence(): CareTourPublicationEvidence {
    return EVIDENCE;
}
