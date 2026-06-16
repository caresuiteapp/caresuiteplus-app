import type { ConnectCategoryKey, ConnectConnectorStatus } from '@/types/connect/gateway';
import { BaseConnectAdapter } from './BaseConnectAdapter';

function preparedAdapter(
  providerKey: string,
  category: ConnectCategoryKey,
  status: ConnectConnectorStatus,
  allowedActions: readonly string[],
): BaseConnectAdapter {
  return new (class extends BaseConnectAdapter {
    providerKey = providerKey;
    category = category;
    defaultStatus = status;
    allowedActions = allowedActions;
  })();
}

/** Vorbereitete Adapter — alle Mock, keine externen API-Aufrufe. */
export const PREPARED_CONNECT_ADAPTERS: BaseConnectAdapter[] = [
  preparedAdapter('datev', 'accounting', 'coming_soon', ['test_connection', 'accounting_export']),
  preparedAdapter('lexware_office', 'accounting', 'coming_soon', ['test_connection', 'accounting_export']),
  preparedAdapter('sevdesk', 'accounting', 'coming_soon', ['test_connection', 'accounting_export']),
  preparedAdapter('fastbill', 'accounting', 'coming_soon', ['test_connection', 'accounting_export']),
  preparedAdapter('agenda', 'accounting', 'coming_soon', ['test_connection', 'accounting_export']),
  preparedAdapter('steuerberater_export', 'accounting', 'coming_soon', ['test_connection', 'accounting_export', 'steuerberater_package']),
  preparedAdapter('gobd_archiv', 'accounting', 'coming_soon', ['test_connection', 'archive_document']),
  preparedAdapter('stripe', 'payments', 'coming_soon', ['test_connection', 'payment_collection', 'create_payment_link']),
  preparedAdapter('mollie', 'payments', 'coming_soon', ['test_connection', 'payment_collection', 'create_payment_link']),
  preparedAdapter('gocardless', 'payments', 'coming_soon', ['test_connection', 'payment_collection', 'sepa_mandate']),
  preparedAdapter('paypal', 'payments', 'coming_soon', ['test_connection', 'payment_collection', 'create_payment_link']),
  preparedAdapter('kim', 'ti_kim', 'beta', ['test_connection', 'kim_send', 'kim_receive']),
  preparedAdapter('google_maps', 'maps', 'coming_soon', ['test_connection', 'route_optimization', 'geocode', 'validate_address']),
  preparedAdapter('here_maps', 'maps', 'coming_soon', ['test_connection', 'route_optimization', 'geocode']),
  preparedAdapter('mapbox', 'maps', 'coming_soon', ['test_connection', 'route_optimization', 'geocode']),
  preparedAdapter('osm_nominatim', 'maps', 'coming_soon', ['test_connection', 'geocode']),
  preparedAdapter('tomtom', 'maps', 'coming_soon', ['test_connection', 'route_optimization']),
  preparedAdapter('generic_geocoder', 'maps', 'coming_soon', ['test_connection', 'geocode']),
  preparedAdapter('docusign', 'documents', 'coming_soon', ['test_connection', 'document_signature']),
  preparedAdapter('icd10_gm', 'medical_catalogs', 'beta', ['test_connection', 'catalog_lookup']),
  preparedAdapter('personio', 'hr_payroll', 'coming_soon', ['test_connection', 'employee_sync']),
  preparedAdapter('moodle', 'academy', 'coming_soon', ['test_connection', 'course_sync']),
  preparedAdapter('gkv', 'billing', 'coming_soon', ['test_connection', 'gkv_dta_export']),
  preparedAdapter('sendgrid', 'communication', 'coming_soon', ['test_connection', 'email_delivery']),
  preparedAdapter('mailjet', 'communication', 'coming_soon', ['test_connection', 'email_delivery']),
  preparedAdapter('brevo', 'communication', 'coming_soon', ['test_connection', 'email_delivery']),
  preparedAdapter('twilio', 'communication', 'coming_soon', ['test_connection', 'sms_delivery', 'whatsapp_delivery']),
  preparedAdapter('messagebird', 'communication', 'coming_soon', ['test_connection', 'sms_delivery', 'whatsapp_delivery']),
  preparedAdapter('firebase_fcm', 'communication', 'coming_soon', ['test_connection', 'push_delivery']),
  preparedAdapter('apple_apns', 'communication', 'coming_soon', ['test_connection', 'push_delivery']),
  preparedAdapter('sip_generic', 'communication', 'coming_soon', ['test_connection', 'phone_log', 'video_call_link']),
  preparedAdapter('marketplace_partner', 'marketplace', 'coming_soon', ['test_connection', 'partner_referral']),
];

export function listPreparedProviderKeys(): string[] {
  return PREPARED_CONNECT_ADAPTERS.map((a) => a.providerKey);
}
