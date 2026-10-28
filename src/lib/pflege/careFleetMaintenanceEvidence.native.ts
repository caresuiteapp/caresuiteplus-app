// Generated native presentation from src/lib/pflege/careFleetMaintenanceEvidence.web.ts. Update through scripts/port-native-workspaces.mjs.
export type CareFleetMaintenanceEvidence = Readonly<{
    tourVehicleReference: 'schema_only_unbound';
    inventoryVehicleCategory: 'provided';
    inventoryCurrentStatus: 'provided';
    maintenanceLedger: 'not_provided';
    maintenanceDueAt: 'not_provided';
    inspectionResult: 'not_provided';
    outOfServiceInterval: 'not_provided';
    replacementVehicleRelation: 'not_provided';
    tourReleaseAvailabilityGuard: 'not_provided';
    currentStatusMayStandForMaintenanceHistory: false;
    labelMayStandForAvailability: false;
    missingEvidence: readonly string[];
}>;
const MISSING_EVIDENCE = Object.freeze([
    'versionierte Wartungs-, Prüf- und Fristenhistorie des nativen Fahrzeugs',
    'Außerbetriebnahme und Verfügbarkeitszeitraum mit verantwortlicher Entscheidung',
    'Ersatzfahrzeugrelation mit Eignungs- und Konfliktprüfung',
    'atomare Sperre nicht verfügbarer Fahrzeuge vor Tourfreigabe',
]);
const EVIDENCE: CareFleetMaintenanceEvidence = Object.freeze({
    tourVehicleReference: 'schema_only_unbound',
    inventoryVehicleCategory: 'provided',
    inventoryCurrentStatus: 'provided',
    maintenanceLedger: 'not_provided',
    maintenanceDueAt: 'not_provided',
    inspectionResult: 'not_provided',
    outOfServiceInterval: 'not_provided',
    replacementVehicleRelation: 'not_provided',
    tourReleaseAvailabilityGuard: 'not_provided',
    currentStatusMayStandForMaintenanceHistory: false,
    labelMayStandForAvailability: false,
    missingEvidence: MISSING_EVIDENCE,
});
/** Static Web/Desktop boundary for fleet maintenance and tour release. */
export function getCareFleetMaintenanceEvidence(): CareFleetMaintenanceEvidence {
    return EVIDENCE;
}
