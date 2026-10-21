export type InventoryProcurementReceiptBoundaryWeb = Readonly<{
  capability: 'durable_asset_register_not_procurement_or_stock';
  demandRecord: 'not_provided';
  purchaseOrder: 'not_provided';
  orderLine: 'not_provided';
  supplierRelation: 'not_provided';
  deliveryRecord: 'not_provided';
  goodsReceiptEvent: 'not_provided';
  orderedQuantity: 'not_provided';
  receivedQuantity: 'not_provided';
  differenceRecord: 'not_provided';
  supplierInvoiceRelation: 'not_provided';
  stockAvailabilityBooking: 'not_provided';
  availabilityFromOrderStatus: 'forbidden';
  actualReceiptProof: 'not_verifiable';
  sourceQuality: 'declared_current_web_contract_not_procurement_ledger';
}>;

const BOUNDARY: InventoryProcurementReceiptBoundaryWeb = Object.freeze({
  capability: 'durable_asset_register_not_procurement_or_stock',
  demandRecord: 'not_provided',
  purchaseOrder: 'not_provided',
  orderLine: 'not_provided',
  supplierRelation: 'not_provided',
  deliveryRecord: 'not_provided',
  goodsReceiptEvent: 'not_provided',
  orderedQuantity: 'not_provided',
  receivedQuantity: 'not_provided',
  differenceRecord: 'not_provided',
  supplierInvoiceRelation: 'not_provided',
  stockAvailabilityBooking: 'not_provided',
  availabilityFromOrderStatus: 'forbidden',
  actualReceiptProof: 'not_verifiable',
  sourceQuality: 'declared_current_web_contract_not_procurement_ledger',
});

/**
 * Explicit boundary for the current inventory contract. It prevents asset
 * creation or an inventory status from being treated as a purchase order,
 * delivery, goods receipt or quantity-changing stock booking.
 */
export function getInventoryProcurementReceiptBoundaryWeb(): InventoryProcurementReceiptBoundaryWeb {
  return BOUNDARY;
}
