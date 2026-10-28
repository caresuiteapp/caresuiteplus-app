// Generated native presentation from src/lib/inventory/inventoryKeyAccessBoundary.web.ts. Update through scripts/port-native-workspaces.mjs.
export type InventoryKeyAccessBoundaryWeb = Readonly<{
    capability: 'key_and_access_inventory_signal_only';
    lossReportMeaning: 'incident_signal_not_responsible_handling_proof';
    resolvedAtMeaning: 'timestamp_without_resolution_actor_or_action';
    assignmentMeaning: 'assignment_not_complete_handover_history';
    returnRecordMeaning: 'physical_return_not_access_revocation';
    accessAccountRefMeaning: 'opaque_reference_not_secret_material';
    secretMaterialExposure: 'forbidden';
    responsibleHandlingProof: 'not_verifiable';
    accessRevocationProof: 'not_verifiable';
    sourceQuality: 'current_inventory_snapshot_not_complete_original_history';
}>;
const BOUNDARY: InventoryKeyAccessBoundaryWeb = Object.freeze({
    capability: 'key_and_access_inventory_signal_only',
    lossReportMeaning: 'incident_signal_not_responsible_handling_proof',
    resolvedAtMeaning: 'timestamp_without_resolution_actor_or_action',
    assignmentMeaning: 'assignment_not_complete_handover_history',
    returnRecordMeaning: 'physical_return_not_access_revocation',
    accessAccountRefMeaning: 'opaque_reference_not_secret_material',
    secretMaterialExposure: 'forbidden',
    responsibleHandlingProof: 'not_verifiable',
    accessRevocationProof: 'not_verifiable',
    sourceQuality: 'current_inventory_snapshot_not_complete_original_history',
});
/**
 * Explicit boundary for keys and account references in the current inventory model.
 * It must not be used as evidence of responsible loss handling, access revocation,
 * a complete handover/return history, or as a container for secret credentials.
 */
export function getInventoryKeyAccessBoundaryWeb(): InventoryKeyAccessBoundaryWeb {
    return BOUNDARY;
}
