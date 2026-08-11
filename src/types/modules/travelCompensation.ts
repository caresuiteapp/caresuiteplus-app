export type TravelRouteType =
  | 'home_to_office'
  | 'office_to_home'
  | 'home_to_client'
  | 'client_to_home'
  | 'office_to_client'
  | 'client_to_office'
  | 'client_to_client'
  | 'with_client'
  | 'other_business'
  | 'private_non_business';

export type TravelPolicyPreset =
  | 'all_business'
  | 'office_roundtrip'
  | 'home_roundtrip'
  | 'between_clients_only'
  | 'with_client_only'
  | 'to_and_with_clients'
  | 'custom';

export type TravelCompensationPolicy = {
  preset: TravelPolicyPreset;
  logbookRouteTypes: TravelRouteType[];
  payrollRouteTypes: TravelRouteType[];
  workTimeRouteTypes: TravelRouteType[];
  clientBillingRouteTypes: TravelRouteType[];
};
export const TRAVEL_ROUTE_TYPE_LABELS: Record<TravelRouteType, string> = {
  home_to_office: 'Zuhause → Büro',
  office_to_home: 'Büro → Zuhause',
  home_to_client: 'Zuhause → Klient:in',
  client_to_home: 'Klient:in → Zuhause',
  office_to_client: 'Büro → Klient:in',
  client_to_office: 'Klient:in → Büro',
  client_to_client: 'Zwischen Klient:innen',
  with_client: 'Fahrt mit Klient:in',
  other_business: 'Sonstige Dienstfahrt',
  private_non_business: 'Privat / nicht dienstlich',
};

export const TRAVEL_POLICY_PRESET_LABELS: Record<TravelPolicyPreset, string> = {
  all_business: 'Alle dienstlichen Fahrten',
  office_roundtrip: 'Büro bis Büro',
  home_roundtrip: 'Zuhause bis Zuhause',
  between_clients_only: 'Nur zwischen Klient:innen',
  with_client_only: 'Nur mit Klient:innen',
  to_and_with_clients: 'Zu und mit Klient:innen',
  custom: 'Individuell',
};
