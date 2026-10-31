// Generated native presentation from src/lib/assist/doubleStaffingBoundary.web.ts. Update through scripts/port-native-workspaces.mjs.
export type DoubleStaffingBoundaryWeb = Readonly<{
    capability: 'single_employee_assignment_with_overlap_and_replacement_checks';
    plannedInterval: 'provided';
    primaryEmployeeRelation: 'provided_single';
    secondEmployeeRelation: 'not_provided';
    doubleStaffingReason: 'not_provided';
    independentSuitabilityForBothPeople: 'not_provided';
    atomicReservationOfBothPeople: 'not_provided';
    appendOnlyStaffingHistory: 'not_provided';
    twoNamesImplyDoubleStaffing: 'forbidden';
    completeDoubleStaffingReservation: 'not_verifiable';
    sourceQuality: 'declared_assignment_route_and_visit_contracts';
}>;
const BOUNDARY: DoubleStaffingBoundaryWeb = Object.freeze({
    capability: 'single_employee_assignment_with_overlap_and_replacement_checks',
    plannedInterval: 'provided',
    primaryEmployeeRelation: 'provided_single',
    secondEmployeeRelation: 'not_provided',
    doubleStaffingReason: 'not_provided',
    independentSuitabilityForBothPeople: 'not_provided',
    atomicReservationOfBothPeople: 'not_provided',
    appendOnlyStaffingHistory: 'not_provided',
    twoNamesImplyDoubleStaffing: 'forbidden',
    completeDoubleStaffingReservation: 'not_verifiable',
    sourceQuality: 'declared_assignment_route_and_visit_contracts',
});
/** Describes the verified boundary for reserving two suitable people on one interval. */
export function getDoubleStaffingBoundaryWeb(): DoubleStaffingBoundaryWeb {
    return BOUNDARY;
}
