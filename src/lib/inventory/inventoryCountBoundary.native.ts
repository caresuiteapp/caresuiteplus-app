// Generated native presentation from src/lib/inventory/inventoryCountBoundary.web.ts. Update through scripts/port-native-workspaces.mjs.
export type InventoryCountBoundaryWeb = Readonly<{
    capability: 'asset_location_register_not_physical_inventory_count';
    assetLocation: 'provided_for_individual_asset';
    warehouseQuantity: 'not_provided';
    expectedQuantity: 'not_provided';
    countedQuantity: 'not_provided';
    countEvent: 'not_provided';
    countLine: 'not_provided';
    varianceRecord: 'not_provided';
    approvalRecord: 'not_provided';
    correctionBooking: 'not_provided';
    appendOnlyCorrectionHistory: 'not_provided';
    silentQuantityOverwrite: 'forbidden';
    physicalCountProof: 'not_verifiable';
    sourceQuality: 'declared_current_asset_location_contract_not_stock_count';
}>;
const BOUNDARY: InventoryCountBoundaryWeb = Object.freeze({
    capability: 'asset_location_register_not_physical_inventory_count',
    assetLocation: 'provided_for_individual_asset',
    warehouseQuantity: 'not_provided',
    expectedQuantity: 'not_provided',
    countedQuantity: 'not_provided',
    countEvent: 'not_provided',
    countLine: 'not_provided',
    varianceRecord: 'not_provided',
    approvalRecord: 'not_provided',
    correctionBooking: 'not_provided',
    appendOnlyCorrectionHistory: 'not_provided',
    silentQuantityOverwrite: 'forbidden',
    physicalCountProof: 'not_verifiable',
    sourceQuality: 'declared_current_asset_location_contract_not_stock_count',
});
/**
 * Declares that an asset location and the current asset list are not a stock
 * count. No quantity, variance, approval or correction may be inferred.
 */
export function getInventoryCountBoundaryWeb(): InventoryCountBoundaryWeb {
    return BOUNDARY;
}
