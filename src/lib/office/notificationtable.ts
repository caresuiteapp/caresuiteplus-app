/** Glocken-Benachrichtigungen — getrennt von der Legacy-Tabelle `notifications` (Enum-Schema). */
export const OFFICE_NOTIFICATIONS_TABLE = 'office_notifications';

export const OFFICE_NOTIFICATIONS_SCHEMA_ERROR =
  'Benachrichtigungs-Glocke: Supabase-Tabelle office_notifications fehlt. Migration 0095_office_notifications_table anwenden.';
