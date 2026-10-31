// Generated native presentation from src/lib/office/occupationalSafetyPortalBoundary.web.ts. Update through scripts/port-native-workspaces.mjs.
export type OccupationalSafetyPortalBoundaryWeb = Readonly<{
    capability: 'employee_occupational_safety_and_workload_records';
    hazardRecord: 'not_provided';
    measureRecord: 'not_provided';
    incidentReport: 'not_provided';
    responsibleOffice: 'not_provided';
    trainingEvidence: 'provided_partial';
    clientPortalApplicationAccess: 'forbidden';
    clientPortalProjectionSource: 'client_scoped_allowlist';
    clientPortalDatabaseIsolation: 'not_enforced';
    appendOnlyHistory: 'not_enforced';
    sourceQuality: 'prepared_training_schema_and_application_guards';
}>;
const BOUNDARY: OccupationalSafetyPortalBoundaryWeb = Object.freeze({
    capability: 'employee_occupational_safety_and_workload_records',
    hazardRecord: 'not_provided',
    measureRecord: 'not_provided',
    incidentReport: 'not_provided',
    responsibleOffice: 'not_provided',
    trainingEvidence: 'provided_partial',
    clientPortalApplicationAccess: 'forbidden',
    clientPortalProjectionSource: 'client_scoped_allowlist',
    clientPortalDatabaseIsolation: 'not_enforced',
    appendOnlyHistory: 'not_enforced',
    sourceQuality: 'prepared_training_schema_and_application_guards',
});
/** Separates personnel safety evidence from the client portal projection. */
export function getOccupationalSafetyPortalBoundaryWeb(): OccupationalSafetyPortalBoundaryWeb {
    return BOUNDARY;
}
