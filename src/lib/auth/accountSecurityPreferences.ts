export const notificationEvents = {
  assignment: 'Neue, geänderte oder abgesagte Einsätze', reminder: 'Bevorstehende oder noch nicht gestartete Einsätze',
  message: 'Neue Nachrichten', signature: 'Dokumente und Nachweise zur Unterschrift',
  proof: 'Eingegangene Unterschriften und freigegebene Nachweise', announcement: 'Office-Mitteilungen und wichtige Hinweise', update: 'Tatsächlich veröffentlichte App-Updates',
} as const;
export type NotificationEvent = keyof typeof notificationEvents;
export type PersonalNotificationPreferences = Record<NotificationEvent, boolean>;
export const defaultNotificationPreferences: PersonalNotificationPreferences = { assignment: true, reminder: true, message: true, signature: true, proof: true, announcement: true, update: true };

