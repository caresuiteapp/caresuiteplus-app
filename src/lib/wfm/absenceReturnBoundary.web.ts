export type AbsenceReturnBoundaryWeb = Readonly<{
  capability: 'employee_absence_and_return';
  absenceDecision: 'provided_partial';
  clientPortalReasonDisclosure: 'forbidden';
  clientPortalProjection: 'availability_only';
  clientCalendarVisibility: 'disabled_by_default';
  actualReturnEvidence: 'not_provided';
  deployabilityDecision: 'separate_snapshot_not_linked';
  temporaryRestrictions: 'not_provided';
  appendOnlyDecisionHistory: 'not_enforced';
  deployedDatabaseEvidence: 'not_verified';
}>;

const BOUNDARY: AbsenceReturnBoundaryWeb = Object.freeze({
  capability: 'employee_absence_and_return',
  absenceDecision: 'provided_partial',
  clientPortalReasonDisclosure: 'forbidden',
  clientPortalProjection: 'availability_only',
  clientCalendarVisibility: 'disabled_by_default',
  actualReturnEvidence: 'not_provided',
  deployabilityDecision: 'separate_snapshot_not_linked',
  temporaryRestrictions: 'not_provided',
  appendOnlyDecisionHistory: 'not_enforced',
  deployedDatabaseEvidence: 'not_verified',
});

/** Separates an absence interval from an evidenced return and deployability decision. */
export function getAbsenceReturnBoundaryWeb(): AbsenceReturnBoundaryWeb {
  return BOUNDARY;
}
