export type InventoryBatchTraceabilityBoundaryWeb = Readonly<{
  capability: 'no_batch_or_expiry_traceability';
  batchIdentity: 'not_provided';
  expiryDate: 'not_provided';
  stockPosition: 'not_provided';
  quarantineEvent: 'not_provided';
  disposalEvent: 'not_provided';
  recallEvent: 'not_provided';
  careExecutionRelation: 'not_provided';
  applicationEvidence: 'not_provided';
  recallImpactSearch: 'not_verifiable';
  purchaseDateMeaning: 'durable_asset_acquisition_only';
  warrantyMeaning: 'durable_asset_warranty_only';
  locationMeaning: 'durable_asset_location_only';
  genericAuditMeaning: 'not_a_structured_batch_ledger';
  sourceQuality: 'declared_current_web_contract_not_native_original_history';
}>;

const BOUNDARY: InventoryBatchTraceabilityBoundaryWeb = Object.freeze({
  capability: 'no_batch_or_expiry_traceability',
  batchIdentity: 'not_provided',
  expiryDate: 'not_provided',
  stockPosition: 'not_provided',
  quarantineEvent: 'not_provided',
  disposalEvent: 'not_provided',
  recallEvent: 'not_provided',
  careExecutionRelation: 'not_provided',
  applicationEvidence: 'not_provided',
  recallImpactSearch: 'not_verifiable',
  purchaseDateMeaning: 'durable_asset_acquisition_only',
  warrantyMeaning: 'durable_asset_warranty_only',
  locationMeaning: 'durable_asset_location_only',
  genericAuditMeaning: 'not_a_structured_batch_ledger',
  sourceQuality: 'declared_current_web_contract_not_native_original_history',
});

/**
 * Explicit boundary for batch and expiry traceability. Purchase, warranty,
 * asset location, generic audit metadata or wound-material free text must not
 * be promoted to batch, expiry, recall, disposal or application evidence.
 */
export function getInventoryBatchTraceabilityBoundaryWeb(): InventoryBatchTraceabilityBoundaryWeb {
  return BOUNDARY;
}
