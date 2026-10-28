// Generated native presentation from src/lib/office/employeeMasterDataBoundary.web.ts. Update through scripts/port-native-workspaces.mjs.
export type EmployeeMasterDataBoundaryWeb = Readonly<{
    capability: 'current_employee_snapshot_not_complete_personnel_history';
    nativeEmployeeIdentity: 'provided';
    currentEmploymentSnapshot: 'partial';
    contractOriginalHistory: 'not_provided';
    roleOriginalHistory: 'not_provided';
    employmentChangeHistory: 'not_provided';
    exitDateInDetailSnapshot: 'not_provided';
    portalRevocationWorkflow: 'provided_non_atomic';
    externalAccessRevocation: 'prepared_or_provider_dependent';
    historicalAuthorPreservationProof: 'not_verifiable_end_to_end';
    exitImpliesAllAccessRevoked: 'forbidden';
    currentSnapshotImpliesCompletePersonnelFile: 'forbidden';
    sourceQuality: 'declared_current_employee_and_offboarding_contracts';
}>;
const BOUNDARY: EmployeeMasterDataBoundaryWeb = Object.freeze({
    capability: 'current_employee_snapshot_not_complete_personnel_history',
    nativeEmployeeIdentity: 'provided',
    currentEmploymentSnapshot: 'partial',
    contractOriginalHistory: 'not_provided',
    roleOriginalHistory: 'not_provided',
    employmentChangeHistory: 'not_provided',
    exitDateInDetailSnapshot: 'not_provided',
    portalRevocationWorkflow: 'provided_non_atomic',
    externalAccessRevocation: 'prepared_or_provider_dependent',
    historicalAuthorPreservationProof: 'not_verifiable_end_to_end',
    exitImpliesAllAccessRevoked: 'forbidden',
    currentSnapshotImpliesCompletePersonnelFile: 'forbidden',
    sourceQuality: 'declared_current_employee_and_offboarding_contracts',
});
/**
 * Separates the current employee snapshot from a complete personnel and access
 * history. Neither an exit date nor a current inactive status proves that all
 * access was revoked or that every historic author reference was preserved.
 */
export function getEmployeeMasterDataBoundaryWeb(): EmployeeMasterDataBoundaryWeb {
    return BOUNDARY;
}
