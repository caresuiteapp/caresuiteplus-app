import type { Database } from '@/lib/supabase/database.types';
import type { ClientImportRow } from '@/types/clientImport';
import { buildClientContactWritePayload } from '@/lib/clients/clientContactPayload';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

type ClientStatus = Database['public']['Enums']['client_status'];
type CareLevel = Database['public']['Enums']['care_level'];

export async function insertClientFromCsvRow(
  tenantId: string,
  row: ClientImportRow,
  actorProfileId?: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const extraNotes: string[] = [];
  if (row.entlastungsbetrag_aktiv != null) extraNotes.push(`Entlastungsbetrag: ${row.entlastungsbetrag_aktiv ? 'ja' : 'nein'}`);
  if (row.umwandlungsanspruch_aktiv != null) extraNotes.push(`Umwandlungsanspruch: ${row.umwandlungsanspruch_aktiv ? 'ja' : 'nein'}`);
  if (row.jahresbudget_aktiv != null) extraNotes.push(`Jahresbudget: ${row.jahresbudget_aktiv ? 'ja' : 'nein'}`);
  if (row.besonderheiten) extraNotes.push(`Besonderheiten: ${row.besonderheiten}`);

  const internalNotes = [row.interne_notiz, ...extraNotes].filter(Boolean).join('\n') || null;

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      tenant_id: tenantId,
      client_number: row.kundennummer,
      first_name: row.vorname,
      last_name: row.nachname,
      date_of_birth: row.geburtsdatum,
      street: row.strasse,
      house_number: row.hausnummer,
      postal_code: row.plz,
      city: row.ort,
      phone: row.telefon_1,
      mobile: row.mobil,
      email: row.email,
      care_level: row.pflegegrad as CareLevel,
      status: row.status as ClientStatus,
      insurance_number: row.versichertennummer,
      insurance_name: row.pflegekasse ?? row.krankenkasse ?? row.kostentraeger_name,
      cost_bearer: row.kostentraeger_name,
      allergies: row.allergien,
      pets: row.haustiere,
      mobility_notes: row.mobilitaet,
      diagnoses_notes: row.diagnose_hinweise,
      internal_notes: internalNotes,
      admission_date: row.leistungsbeginn,
      created_by: actorProfileId ?? null,
      updated_by: actorProfileId ?? null,
    })
    .select('id')
    .single();

  if (clientError || !client) {
    return { ok: false, error: toGermanSupabaseError(clientError) };
  }

  const clientId = client.id;

  await fromUnknownTable(supabase, 'client_care_contexts').insert({
    tenant_id: tenantId,
    client_id: clientId,
    context_key: row.leistungsart,
    is_primary: true,
  });

  await fromUnknownTable(supabase, 'client_addresses').insert({
    tenant_id: tenantId,
    client_id: clientId,
    address_type: 'hauptwohnsitz',
    street: [row.strasse, row.hausnummer].filter(Boolean).join(' '),
    zip: row.plz,
    city: row.ort,
    country: 'DE',
    is_primary: true,
  });

  if (row.einsatz_strasse || row.einsatz_ort) {
    await fromUnknownTable(supabase, 'client_addresses').insert({
      tenant_id: tenantId,
      client_id: clientId,
      address_type: 'einsatz',
      street: [row.einsatz_strasse, row.einsatz_hausnummer].filter(Boolean).join(' '),
      zip: row.einsatz_plz,
      city: row.einsatz_ort,
      country: 'DE',
      is_primary: false,
    });
  }

  await fromUnknownTable(supabase, 'client_care_levels').insert({
    tenant_id: tenantId,
    client_id: clientId,
    grade: row.pflegegrad,
    valid_from: row.pflegegrad_seit ?? row.leistungsbeginn ?? row.geburtsdatum,
    care_fund_name: row.pflegekasse ?? row.kostentraeger_name ?? 'Unbekannt',
    care_fund_member_id: row.versichertennummer,
  });

  await fromUnknownTable(supabase, 'client_insurance_profiles').insert({
    tenant_id: tenantId,
    client_id: clientId,
    care_level: row.pflegegrad,
    care_level_valid_from: row.pflegegrad_seit,
    care_fund_name: row.pflegekasse,
    health_insurance: row.krankenkasse,
    insurance_number: row.versichertennummer,
    billing_type: row.abrechnungsart,
    is_primary: true,
  });

  await fromUnknownTable(supabase, 'client_billing_profiles').insert({
    tenant_id: tenantId,
    client_id: clientId,
    billing_type: row.abrechnungsart ?? 'pflegekasse',
    cost_bearer_name: row.kostentraeger_name,
    notes: row.abrechnungsart,
  });

  if (row.notfallkontakt_name || row.notfallkontakt_telefon) {
    await fromUnknownTable(supabase, 'client_contacts').insert(
      buildClientContactWritePayload({
        tenantId,
        clientId,
        name: row.notfallkontakt_name ?? 'Notfallkontakt',
        phone: row.notfallkontakt_telefon ?? '',
        relationship: row.notfallkontakt_beziehung ?? 'notfallkontakt',
        contactType: 'emergency_contact',
      }),
    );
  }

  if (row.betreuer_name || row.betreuer_telefon) {
    await fromUnknownTable(supabase, 'client_contacts').insert(
      buildClientContactWritePayload({
        tenantId,
        clientId,
        name: row.betreuer_name ?? 'Betreuer:in',
        phone: row.betreuer_telefon ?? '',
        relationship: 'betreuer',
        contactType: 'other',
        email: row.betreuer_email,
      }),
    );
  }

  if (row.hausarzt_name || row.hausarzt_telefon) {
    await fromUnknownTable(supabase, 'client_contacts').insert(
      buildClientContactWritePayload({
        tenantId,
        clientId,
        name: row.hausarzt_name ?? 'Hausarzt',
        phone: row.hausarzt_telefon ?? '',
        relationship: 'hausarzt',
        contactType: 'doctor',
      }),
    );
  }

  return { ok: true, id: clientId };
}
