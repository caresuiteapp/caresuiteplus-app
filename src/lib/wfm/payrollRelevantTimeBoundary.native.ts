// Generated native presentation from src/lib/wfm/payrollRelevantTimeBoundary.web.ts. Update through scripts/port-native-workspaces.mjs.
export type PayrollRelevantTimeBoundaryWeb = Readonly<{
    capability: 'payroll_relevant_time_export';
    reviewedWorkTime: 'provided_partial';
    plannedTimeAsPayrollFact: 'forbidden';
    travelTimeCoverage: 'not_complete';
    standbyTimeCoverage: 'not_complete';
    surchargeCoverage: 'not_provided';
    approvedOnlyExport: 'required';
    sourceTrace: 'review_and_reference_snapshot';
    correctionChain: 'provided_partial';
    legacySessionExport: 'forbidden';
    microsecondOriginals: 'not_preserved';
    deployedDatabaseEvidence: 'not_verified';
}>;
const BOUNDARY: PayrollRelevantTimeBoundaryWeb = Object.freeze({
    capability: 'payroll_relevant_time_export',
    reviewedWorkTime: 'provided_partial',
    plannedTimeAsPayrollFact: 'forbidden',
    travelTimeCoverage: 'not_complete',
    standbyTimeCoverage: 'not_complete',
    surchargeCoverage: 'not_provided',
    approvedOnlyExport: 'required',
    sourceTrace: 'review_and_reference_snapshot',
    correctionChain: 'provided_partial',
    legacySessionExport: 'forbidden',
    microsecondOriginals: 'not_preserved',
    deployedDatabaseEvidence: 'not_verified',
});
/** Documents which reviewed WFM facts may and may not be treated as payroll facts. */
export function getPayrollRelevantTimeBoundaryWeb(): PayrollRelevantTimeBoundaryWeb {
    return BOUNDARY;
}
