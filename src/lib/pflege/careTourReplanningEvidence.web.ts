export type CareTourReplanningEvidence = Readonly<{
  expectedStatusGuard: 'provided';
  cancellationReason: 'provided';
  startedStopOriginalTimes: 'partially_provided';
  nativeReplanOperation: 'not_provided';
  replacementRelation: 'not_provided';
  scheduleVersion: 'not_provided';
  recipientNotificationEvidence: 'not_provided';
  startedVisitMayBeOverwritten: false;
  silentAutomaticReplan: false;
  missingEvidence: readonly string[];
}>;

const MISSING_EVIDENCE = Object.freeze([
  'atomare Umplanung mit alter und neuer Tour-/Stoppfassung',
  'Ausfall- und Vertretungsrelation mit geprüfter Ersatzperson',
  'Schutz begonnener Besuche und vollständige Mikrosekundenhistorie',
  'adressierte Benachrichtigung samt Zustell- oder Fehlernachweis',
]);

const EVIDENCE: CareTourReplanningEvidence = Object.freeze({
  expectedStatusGuard: 'provided',
  cancellationReason: 'provided',
  startedStopOriginalTimes: 'partially_provided',
  nativeReplanOperation: 'not_provided',
  replacementRelation: 'not_provided',
  scheduleVersion: 'not_provided',
  recipientNotificationEvidence: 'not_provided',
  startedVisitMayBeOverwritten: false,
  silentAutomaticReplan: false,
  missingEvidence: MISSING_EVIDENCE,
});

/** Static Web/Desktop boundary for the currently available status-only tour workflow. */
export function getCareTourReplanningEvidence(): CareTourReplanningEvidence {
  return EVIDENCE;
}
