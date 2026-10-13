export type BusinessRegistrationReceipt = {
  tenantId: string;
  owner: { id: string; tenantId: string; username: string; roleKey: 'owner'; email: string; displayName: string };
  credentials?: { username: string };
  welcomeEmailQueued?: boolean;
};

/** A completed registration must identify this administration account in one workspace. */
export function isBusinessRegistrationReceipt(value: unknown, adminEmail: string): value is BusinessRegistrationReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const owner = row.owner as Record<string, unknown> | null;
  if (!owner || typeof owner !== 'object' || Array.isArray(owner)) return false;
  if (typeof row.tenantId !== 'string' || !row.tenantId.trim() || owner.tenantId !== row.tenantId || owner.roleKey !== 'owner') return false;
  if (!['id', 'username', 'email', 'displayName'].every(key => typeof owner[key] === 'string' && (owner[key] as string).trim())) return false;
  if ((owner.email as string).trim().toLowerCase() !== adminEmail.trim().toLowerCase()) return false;
  if (row.credentials != null) {
    const credentials = row.credentials as Record<string, unknown>;
    if (typeof credentials !== 'object' || credentials.username !== owner.username) return false;
  }
  return row.welcomeEmailQueued == null || typeof row.welcomeEmailQueued === 'boolean';
}

export const REGISTRATION_UNCONFIRMED_MESSAGE = 'Die Registrierung konnte nicht bestätigt werden. Bitte prüfen Sie zuerst die Anmeldung mit Ihrer E-Mail-Adresse; bei weiterhin fehlendem Zugang wenden Sie sich an den Support.';

export function businessRegistrationFailure(message: string): string {
  return /netzwerk|verbindung|antwortet nicht|zu lange|timeout|timed out|fetch|relay/i.test(message)
    ? REGISTRATION_UNCONFIRMED_MESSAGE : message;
}
