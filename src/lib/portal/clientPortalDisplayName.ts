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
  gender?: string | null;
};

function salutationFromGender(gender: string | null | undefined): string | null {
  const key = gender?.trim().toLowerCase();
  if (key === 'female' || key === 'f' || key === 'w' || key === 'weiblich' || key === 'frau') {
    return 'frau';
  }
  if (key === 'male' || key === 'm' || key === 'maennlich' || key === 'männlich' || key === 'herr') {
    return 'herr';
  }
  return null;
}

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

  const salutation = formatSalutation(fields.salutation ?? salutationFromGender(fields.gender));
  if (salutation === 'Herr' || salutation === 'Frau') {
    return `${salutation} ${fullName}`;
  }

  return fullName;
}

function isSinglePortalUsernameToken(value: string): boolean {
  return /^[a-z0-9._-]+\.[a-z0-9._-]+$/i.test(value) && value === value.toLowerCase();
}

/** Detect generated portal usernames (e.g. ellen.zacharias) — not suitable for greetings. */
export function isPortalUsernameLabel(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return isSinglePortalUsernameToken(parts[0]);
  }

  if (parts.length === 2 && parts[0] === parts[1]) {
    return isSinglePortalUsernameToken(parts[0]);
  }

  return false;
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
    .select('first_name, last_name, gender')
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
    gender?: string | null;
  };

  return formatClientPortalDisplayName({
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    gender: row.gender ?? null,
  });
}
