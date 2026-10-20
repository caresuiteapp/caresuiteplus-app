import type { Database } from '@/lib/supabase/database.types';
import type { EmployeeImportRow } from '@/types/employeeImport';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

type EmployeeStatus = Database['public']['Enums']['employee_status'];
type EmploymentType = Database['public']['Enums']['employee_employment_type'];

export async function insertEmployeeFromCsvRow(
  tenantId: string,
  row: EmployeeImportRow,
  actorProfileId?: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const notesParts = [row.interne_notiz];
  if (row.einsatzbereiche) notesParts.push(`Einsatzbereiche: ${row.einsatzbereiche}`);
  if (row.stundenlohn != null) notesParts.push(`Stundenlohn (Import): ${row.stundenlohn}`);
  if (row.steuer_id) notesParts.push(`Steuer-ID (Import): ${row.steuer_id}`);
  if (row.iban) notesParts.push(`IBAN (Import): ${row.iban}`);

  const { data, error } = await supabase
    .from('employees')
    .insert({
      tenant_id: tenantId,
      employee_number: row.personalnummer,
      first_name: row.vorname,
      last_name: row.nachname,
      date_of_birth: row.geburtsdatum,
      email: row.email,
      phone: row.telefon,
      mobile: row.mobil,
      street: row.strasse,
      house_number: row.hausnummer,
      postal_code: row.plz,
      city: row.ort,
      role_title: row.rolle,
      employment_type: row.beschaeftigungsart as EmploymentType,
      entry_date: row.eintrittsdatum,
      exit_date: row.austrittsdatum,
      weekly_hours: row.wochenstunden,
      status: row.status as EmployeeStatus,
      emergency_contact_name: row.notfallkontakt_name,
      emergency_contact_phone: row.notfallkontakt_telefon,
      qualification: row.qualifikation,
      qualification_notes: row.lg1_lg2_vorhanden != null ? (row.lg1_lg2_vorhanden ? 'LG1/LG2 vorhanden' : 'LG1/LG2 nicht vorhanden') : null,
      has_police_clearance: row.fuehrungszeugnis_vorhanden,
      police_clearance_date: row.fuehrungszeugnis_datum,
      has_first_aid_certificate: row.erste_hilfe_datum ? true : null,
      first_aid_valid_until: row.erste_hilfe_datum,
      has_driver_license: row.fuehrerschein_vorhanden,
      internal_notes: notesParts.filter(Boolean).join('\n') || null,
      created_by: actorProfileId ?? null,
      updated_by: actorProfileId ?? null,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, id: data.id };
}
