// Generated native presentation from src/lib/pflege/careTourAssignmentEvidence.web.ts. Update through scripts/port-native-workspaces.mjs.
export type CareTourAssignmentEvidence = Readonly<{
    singleEmployeeRelation: 'provided';
    activeEmployeeGuard: 'prepared';
    visitSpecificQualificationRelation: 'not_provided';
    doubleStaffingRelation: 'not_provided';
    atomicReservationOfBothPeople: 'not_provided';
    travelDurationRelation: 'not_provided';
    capacityRelation: 'not_provided';
    accessRequirementRelation: 'not_provided';
    distanceOptimization: 'not_present_in_care_tour_path';
    distanceMayProveSuitability: false;
    automaticAssignmentRelease: false;
    missingEvidence: readonly string[];
}>;
const MISSING_EVIDENCE = Object.freeze([
    'tätigkeits- und zeitpunktbezogene Qualifikationsanforderung je Besuch',
    'Anlass und atomare Reservierung zweier geeigneter Personen für Doppelbesetzung',
    'Fahrtzeit, Kapazität und Zugangsvoraussetzungen als gebundene Planungsfakten',
    'versionierte Zuordnungsentscheidung mit vollständiger Originalhistorie',
]);
const EVIDENCE: CareTourAssignmentEvidence = Object.freeze({
    singleEmployeeRelation: 'provided',
    activeEmployeeGuard: 'prepared',
    visitSpecificQualificationRelation: 'not_provided',
    doubleStaffingRelation: 'not_provided',
    atomicReservationOfBothPeople: 'not_provided',
    travelDurationRelation: 'not_provided',
    capacityRelation: 'not_provided',
    accessRequirementRelation: 'not_provided',
    distanceOptimization: 'not_present_in_care_tour_path',
    distanceMayProveSuitability: false,
    automaticAssignmentRelease: false,
    missingEvidence: MISSING_EVIDENCE,
});
/** Static boundary of the Web/Desktop care-tour assignment contract.
 * It never upgrades an employee label or a short route into suitability. */
export function getCareTourAssignmentEvidence(): CareTourAssignmentEvidence {
    return EVIDENCE;
}
