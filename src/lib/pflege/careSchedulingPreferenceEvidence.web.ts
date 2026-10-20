export type CareSchedulingPreferenceEvidence = Readonly<{
  preferenceRecord: 'provided';
  agreedWindowRelation: 'not_provided';
  effectiveVersion: 'not_provided';
  referenceTeamRelation: 'not_provided';
  priority: 'not_provided';
  tourStopPreferenceRelation: 'not_provided';
  deviationReason: 'not_provided';
  existingScheduleMayProveAgreement: false;
  employeeNameMayProveReferenceCare: false;
  automaticRelease: false;
  missingEvidence: readonly string[];
}>;

const MISSING_EVIDENCE = Object.freeze([
  'historisch vereinbartes Zeitfenster mit Quelle, Gültigkeit und Version',
  'natives Bezugsteam mit priorisierter und vertretbarer Zuständigkeit',
  'Bindung von Wunsch und Vereinbarung an den konkreten Tourstopp',
  'sichtbare begründete Abweichung vor Übernahme in den Plan',
]);

const EVIDENCE: CareSchedulingPreferenceEvidence = Object.freeze({
  preferenceRecord: 'provided',
  agreedWindowRelation: 'not_provided',
  effectiveVersion: 'not_provided',
  referenceTeamRelation: 'not_provided',
  priority: 'not_provided',
  tourStopPreferenceRelation: 'not_provided',
  deviationReason: 'not_provided',
  existingScheduleMayProveAgreement: false,
  employeeNameMayProveReferenceCare: false,
  automaticRelease: false,
  missingEvidence: MISSING_EVIDENCE,
});

/** Static Web/Desktop boundary: stored wishes are neither agreements nor reference-care promises. */
export function getCareSchedulingPreferenceEvidence(): CareSchedulingPreferenceEvidence {
  return EVIDENCE;
}
