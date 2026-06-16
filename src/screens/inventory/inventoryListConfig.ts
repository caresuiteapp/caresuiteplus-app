export type InventoryListVariant =
  | 'items'
  | 'assignments'
  | 'categories'
  | 'locations'
  | 'damage'
  | 'returns'
  | 'protocols'
  | 'audit'
  | 'employees'
  | 'mdm'
  | 'offboarding'
  | 'barcode'
  | 'settings';

export type InventoryListScreenProps = {
  variant: InventoryListVariant;
};
