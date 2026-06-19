import { composeUserFullName } from '@/lib/auth/userdisplayname';
import { demoClients } from '@/data/demo/clients';
import { formatSalutation } from '@/lib/formatters/unitFormatters';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type ClientNameFields = {
  firstName?: string | null;
  lastName?: string | null;
  salutation?: string | null;
};

/** Capitalize a single name part when stored lowercase (e.g. ellen → Ellen). */
export function capitalizeNamePart(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^[A-ZÄÖÜÁÉÍÓÚÀÈÌÒÙ]/.test(trimmed)) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Legal/display name for client portal greeting — Vor- und Nachname, optional Herr/Frau. */
export function formatClientPortalDisplayName(fields: ClientNameFields): string | null {
  const first = fields.firstName?.trim() ? capitalizeNamePart(fields.firstName) : '';
  const last = fields.lastName?.trim() ? capitalizeNamePart(fields.lastName) : '';
  const fullName = composeUserFullName(first || null, last || null);
  if (!fullName) return null;

  const salutation = formatSalutation(fields.salutation);
  if (salutation === 'Herr' || salutation === 'Frau') {
    return `${salutation} ${fullName}`;
  }

  return fullName;
}

/** Detect generated portal usernames (e.g. ellen.zacharias) — not suitable for greetings. */
export function isPortalUsernameLabel(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes(' ')) return false;
  return /^[a-z0-9._-]+\.[a-z0-9._-]+$/i.test(trimmed) && trimmed === trimmed.toLowerCase();
}

function resolveDemoClientDisplayName(clientId: string): string | null {
  const client = demoClients.find((entry) => entry.id === clientId);
  if (!client) return null;
  return formatClientPortalDisplayName({
    firstName: client.firstName,
    lastName: client.lastName,
  });
}

/** Live read of linked client record — RLS must allow portal actor to read own client row. */
export async function fetchClientPortalDisplayName(
  tenantId: string,
  clientId: string,
): Promise<string | null> {
  if (!tenantId.trim() || !clientId.trim()) return null;

  if (getServiceMode() !== 'supabase') {
    return resolveDemoClientDisplayName(clientId);
  }

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await fromUnknownTable(supabase, 'clients')
    .select('first_name, last_name, salutation')
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[clientPortalDisplayName] clients:', error.message);
    }
    return null;
  }

  if (!data) return null;

  const row = data as {
    first_name?: string | null;
    last_name?: string | null;
    salutation?: string | null;
  };

  return formatClientPortalDisplayName({
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    salutation: row.salutation ?? null,
  });
}
