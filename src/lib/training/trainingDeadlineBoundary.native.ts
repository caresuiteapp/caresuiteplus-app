// Generated native presentation from src/lib/training/trainingDeadlineBoundary.web.ts. Update through scripts/port-native-workspaces.mjs.
export type TrainingDeadlineBoundaryWeb = Readonly<{
    capability: 'declared_requirements_assignments_records_certificates_and_reminders';
    mandatoryRuleRelation: 'provided_partial';
    employeeAssignmentDueAt: 'provided';
    participationAndCompletionTimes: 'provided_partial';
    proofOriginal: 'identifier_only';
    validityAndExpiry: 'provided_partial';
    reminderAcknowledgementCompletesRequirement: 'forbidden';
    assignmentCompletionProvesParticipation: 'forbidden';
    appendOnlyRequirementHistory: 'not_enforced';
    exactValidityDerivation: 'not_provided';
    livePersistence: 'prepared_only';
}>;
const BOUNDARY: TrainingDeadlineBoundaryWeb = Object.freeze({
    capability: 'declared_requirements_assignments_records_certificates_and_reminders',
    mandatoryRuleRelation: 'provided_partial',
    employeeAssignmentDueAt: 'provided',
    participationAndCompletionTimes: 'provided_partial',
    proofOriginal: 'identifier_only',
    validityAndExpiry: 'provided_partial',
    reminderAcknowledgementCompletesRequirement: 'forbidden',
    assignmentCompletionProvesParticipation: 'forbidden',
    appendOnlyRequirementHistory: 'not_enforced',
    exactValidityDerivation: 'not_provided',
    livePersistence: 'prepared_only',
});
/**
 * States which native fields exist without promoting assignments, reminders or
 * calculated dates into proof that a mandatory training was actually fulfilled.
 */
export function getTrainingDeadlineBoundaryWeb(): TrainingDeadlineBoundaryWeb {
    return BOUNDARY;
}
