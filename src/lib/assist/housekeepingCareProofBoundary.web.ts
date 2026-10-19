export type HousekeepingCareProofBoundaryWeb = Readonly<{
  capability: 'assist_housekeeping_proof_is_not_care_or_treatment_proof';
  serviceAreaMeaning: 'assist_housekeeping_or_everyday_support_only';
  taskIdentityMeaning: 'assist_task_not_nursing_measure';
  plannedAssignmentMeaning: 'not_actual_execution_proof';
  assistVisitProofMeaning: 'assist_service_evidence_only';
  nursingProofCreation: 'not_authorized_by_housekeeping_classification';
  treatmentProofCreation: 'not_authorized_by_housekeeping_classification';
  proofPromotion: 'forbidden_without_distinct_native_care_execution';
  actualCareExecutionProof: 'not_verifiable_from_assist_record';
  sourceQuality: 'declared_current_web_boundary_not_cross_module_original_history';
}>;

const BOUNDARY: HousekeepingCareProofBoundaryWeb = Object.freeze({
  capability: 'assist_housekeeping_proof_is_not_care_or_treatment_proof',
  serviceAreaMeaning: 'assist_housekeeping_or_everyday_support_only',
  taskIdentityMeaning: 'assist_task_not_nursing_measure',
  plannedAssignmentMeaning: 'not_actual_execution_proof',
  assistVisitProofMeaning: 'assist_service_evidence_only',
  nursingProofCreation: 'not_authorized_by_housekeeping_classification',
  treatmentProofCreation: 'not_authorized_by_housekeeping_classification',
  proofPromotion: 'forbidden_without_distinct_native_care_execution',
  actualCareExecutionProof: 'not_verifiable_from_assist_record',
  sourceQuality: 'declared_current_web_boundary_not_cross_module_original_history',
});

/**
 * Explicit boundary between Assist housekeeping/everyday support evidence and
 * clinical care evidence. A catalog entry, assignment, time, note or Assist
 * proof must never be promoted to nursing or treatment execution.
 */
export function getHousekeepingCareProofBoundaryWeb(): HousekeepingCareProofBoundaryWeb {
  return BOUNDARY;
}
