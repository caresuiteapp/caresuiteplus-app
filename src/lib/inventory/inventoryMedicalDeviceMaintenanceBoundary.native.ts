// Generated native presentation from src/lib/inventory/inventoryMedicalDeviceMaintenanceBoundary.web.ts. Update through scripts/port-native-workspaces.mjs.
export type InventoryMedicalDeviceMaintenanceBoundaryWeb = Readonly<{
    capability: 'no_medical_device_maintenance_or_release_contract';
    medicalDeviceClassification: 'not_provided';
    maintenanceEvent: 'not_provided';
    maintenanceHistory: 'not_provided';
    maintenanceDueAt: 'not_provided';
    inspectionOrCalibration: 'not_provided';
    instructionRecord: 'not_provided';
    instructionQualification: 'not_provided';
    releaseDecision: 'not_provided';
    plannedUseRelation: 'not_provided';
    unapprovedUseObjection: 'not_verifiable';
    inventoryStatusMeaning: 'current_asset_state_not_maintenance_evidence';
    serialManufacturerModelMeaning: 'durable_asset_identification_only';
    mdmProfileMeaning: 'device_management_not_medical_device_release';
    sourceQuality: 'declared_current_web_contract_not_native_original_history';
}>;
const BOUNDARY: InventoryMedicalDeviceMaintenanceBoundaryWeb = Object.freeze({
    capability: 'no_medical_device_maintenance_or_release_contract',
    medicalDeviceClassification: 'not_provided',
    maintenanceEvent: 'not_provided',
    maintenanceHistory: 'not_provided',
    maintenanceDueAt: 'not_provided',
    inspectionOrCalibration: 'not_provided',
    instructionRecord: 'not_provided',
    instructionQualification: 'not_provided',
    releaseDecision: 'not_provided',
    plannedUseRelation: 'not_provided',
    unapprovedUseObjection: 'not_verifiable',
    inventoryStatusMeaning: 'current_asset_state_not_maintenance_evidence',
    serialManufacturerModelMeaning: 'durable_asset_identification_only',
    mdmProfileMeaning: 'device_management_not_medical_device_release',
    sourceQuality: 'declared_current_web_contract_not_native_original_history',
});
/**
 * Explicit boundary for regulated-device maintenance, instruction and release.
 * Asset state, identity fields, warranty data, MDM enrolment and generic audit
 * metadata must not be promoted to maintenance, instruction or use approval.
 */
export function getInventoryMedicalDeviceMaintenanceBoundaryWeb(): InventoryMedicalDeviceMaintenanceBoundaryWeb {
    return BOUNDARY;
}
