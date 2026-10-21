export type InventoryConsumablesBoundaryWeb = Readonly<{
  capability: 'durable_asset_inventory_only';
  itemIdentity: 'individual_inventory_item';
  quantity: 'not_provided';
  unit: 'not_provided';
  minimumStock: 'not_provided';
  supplierRelation: 'not_provided';
  stockLedger: 'not_provided';
  consumptionEvent: 'not_provided';
  visitRelation: 'not_provided';
  duplicateConsumptionGuard: 'not_verifiable';
  sourceQuality: 'declared_current_web_contract_not_native_original_history';
}>;

const BOUNDARY: InventoryConsumablesBoundaryWeb = Object.freeze({
  capability: 'durable_asset_inventory_only',
  itemIdentity: 'individual_inventory_item',
  quantity: 'not_provided',
  unit: 'not_provided',
  minimumStock: 'not_provided',
  supplierRelation: 'not_provided',
  stockLedger: 'not_provided',
  consumptionEvent: 'not_provided',
  visitRelation: 'not_provided',
  duplicateConsumptionGuard: 'not_verifiable',
  sourceQuality: 'declared_current_web_contract_not_native_original_history',
});

/**
 * Explicit scope boundary for the current Inventory module. It represents
 * individually identified durable assets and employee assignments only.
 * It must never be used as stock, consumption, visit or duplicate-booking evidence.
 */
export function getInventoryConsumablesBoundaryWeb(): InventoryConsumablesBoundaryWeb {
  return BOUNDARY;
}
