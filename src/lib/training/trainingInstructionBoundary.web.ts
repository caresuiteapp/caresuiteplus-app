export type TrainingInstructionBoundaryWeb = Readonly<{
  capability: 'course_and_employee_training_records_with_partial_deployment_gate';
  topicAndParticipantRelation: 'provided';
  participationAndResultTimes: 'provided_partial';
  verifierMetadata: 'provided_partial';
  proofDocumentRelation: 'identifier_only';
  deviceAndVersionRelation: 'not_provided';
  participantConfirmation: 'not_provided';
  appendOnlyInstructionHistory: 'not_enforced';
  separateCompetenceAssessment: 'not_provided';
  participationImpliesCompetence: 'forbidden';
  trainingCompletionReleasesConcreteActivity: 'not_verifiable';
  sourceQuality: 'declared_training_contract_and_prepared_schema';
}>;

const BOUNDARY: TrainingInstructionBoundaryWeb = Object.freeze({
  capability: 'course_and_employee_training_records_with_partial_deployment_gate',
  topicAndParticipantRelation: 'provided',
  participationAndResultTimes: 'provided_partial',
  verifierMetadata: 'provided_partial',
  proofDocumentRelation: 'identifier_only',
  deviceAndVersionRelation: 'not_provided',
  participantConfirmation: 'not_provided',
  appendOnlyInstructionHistory: 'not_enforced',
  separateCompetenceAssessment: 'not_provided',
  participationImpliesCompetence: 'forbidden',
  trainingCompletionReleasesConcreteActivity: 'not_verifiable',
  sourceQuality: 'declared_training_contract_and_prepared_schema',
});

/**
 * States the evidence boundary between a training/briefing record and a
 * separate, person- and activity-specific competence decision.
 */
export function getTrainingInstructionBoundaryWeb(): TrainingInstructionBoundaryWeb {
  return BOUNDARY;
}
