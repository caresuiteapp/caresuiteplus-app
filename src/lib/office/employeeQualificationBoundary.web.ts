export type EmployeeQualificationBoundaryWeb = Readonly<{
  capability: 'current_qualification_rows_with_partial_assignment_gate';
  nativeQualificationRows: 'provided';
  qualificationValidityEvaluation: 'provided_client_clock_dependent';
  verificationMetadata: 'provided_partial';
  qualificationDocumentRelation: 'identifier_only';
  activitySpecificQualificationRelation: 'not_provided';
  appendOnlyQualificationHistory: 'not_provided';
  routeSuggestionQualificationGate: 'provided_partial';
  legacyReplacementSuggestionGate: 'static_demo_mapping_without_native_expiry';
  expiredEvidenceCanBeTreatedAsValid: 'forbidden';
  currentStatusImpliesActivityCompetence: 'forbidden';
  completeAutomaticAssignmentRelease: 'not_verifiable';
  sourceQuality: 'declared_personnel_and_route_planning_contracts';
}>;

const BOUNDARY: EmployeeQualificationBoundaryWeb = Object.freeze({
  capability: 'current_qualification_rows_with_partial_assignment_gate',
  nativeQualificationRows: 'provided',
  qualificationValidityEvaluation: 'provided_client_clock_dependent',
  verificationMetadata: 'provided_partial',
  qualificationDocumentRelation: 'identifier_only',
  activitySpecificQualificationRelation: 'not_provided',
  appendOnlyQualificationHistory: 'not_provided',
  routeSuggestionQualificationGate: 'provided_partial',
  legacyReplacementSuggestionGate: 'static_demo_mapping_without_native_expiry',
  expiredEvidenceCanBeTreatedAsValid: 'forbidden',
  currentStatusImpliesActivityCompetence: 'forbidden',
  completeAutomaticAssignmentRelease: 'not_verifiable',
  sourceQuality: 'declared_personnel_and_route_planning_contracts',
});

/**
 * Describes the verified boundary between current qualification rows and an
 * authoritative, activity-specific assignment release. An expired record or
 * a current label must never be promoted to a clinical competence decision.
 */
export function getEmployeeQualificationBoundaryWeb(): EmployeeQualificationBoundaryWeb {
  return BOUNDARY;
}
