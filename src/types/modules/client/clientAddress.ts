import type { TenantScopedEntity } from '../../core/base';

export type ClientAddressType = 'hauptwohnsitz' | 'pflegeheim' | 'ferien' | 'rechnung' | 'sonstige';

export const CLIENT_ADDRESS_TYPE_LABELS: Record<ClientAddressType, string> = {
  hauptwohnsitz: 'Hauptwohnsitz',
  pflegeheim: 'Pflegeheim',
  ferien: 'Ferienadresse',
  rechnung: 'Rechnungsadresse',
  sonstige: 'Sonstige',
};

export type ClientAddress = TenantScopedEntity & {
  clientId: string;
  addressType: ClientAddressType;
  street: string;
  zip: string;
  city: string;
  country: string;
  isPrimary: boolean;
  accessNotes: string | null;
  floor: string | null;
  /** Domain-Feld → DB `client_addresses.apartment_number` */
  apartmentNumber: string | null;
  doorCode: string | null;
};
