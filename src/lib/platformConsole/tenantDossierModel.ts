export type DossierRow = Record<string, unknown>;
export type DossierScope = 'company' | 'clients' | 'employees' | 'operations';
export type DossierSection = { key: string; label: string; scope: DossierScope; available: boolean; count: number | null; updatedAt: string | null };
export type DossierCounts = { total: number; active: number; deleted: number; complete: number; portalEnabled: number; portalLinked: number };
export type TenantDossier = {
  tenantId: string; checkedAt: string; company: DossierRow; platform: DossierRow;
  branding: DossierRow | null; billing: DossierRow | null; portal: DossierRow | null;
  bank: DossierRow | null; tax: DossierRow | null; register: DossierRow | null;
  counts: { clients: DossierCounts; employees: DossierCounts; accounts: number; adminAccounts: number; loggedInAccounts: number; lastLoginAt: string | null; services: number; pricedServices: number; assignments: number | null; documents: number | null };
  sections: DossierSection[];
};
export type DossierPage = { tenantId: string; section: string; rows: DossierRow[]; total: number | null; offset: number; limit: number; hasMore: boolean; checkedAt: string; available: boolean; statuses?: string[] };
export type SetupStep = { key: string; group: string; label: string; section: string; score: number; applicable: boolean; state: 'complete' | 'partial' | 'open' | 'not_applicable'; evidence: string; missing: string[]; source: string };
export type SetupProgress = { percentage: number; complete: number; partial: number; open: number; applicable: number; steps: SetupStep[]; groups: { label: string; percentage: number; complete: number; total: number }[] };

const filled = (v: unknown) => typeof v === 'string' ? v.trim().length > 0 : v != null;
const first = (...values: unknown[]) => values.find(filled);
export function safeDossierLogo(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const url = value.trim();
  // Only display image URLs. Protocol-relative, credential-bearing and data URLs are excluded.
  if (/^\/(?!\/)/.test(url) && !/[\\\x00-\x20]/.test(url)) return url;
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? url : null; } catch { return null; }
}

/** This measures recorded basic configuration. It never claims that a person completed an action. */
export function buildTenantSetup(d: TenantDossier): SetupProgress {
  const steps: SetupStep[] = [];
  const add = (key: string, group: string, label: string, section: string, checks: [string, boolean][], source: string, evidence?: string, applicable = true) => {
    const satisfied = checks.filter(([, ok]) => ok).length;
    const score = applicable && checks.length ? satisfied / checks.length : 0;
    steps.push({ key, group, label, section, score, applicable,
      state: !applicable ? 'not_applicable' : score === 1 ? 'complete' : score > 0 ? 'partial' : 'open',
      evidence: !applicable ? 'Für diese Rechtsform nicht in der Grundprüfung enthalten.' : evidence ?? `${satisfied} von ${checks.length} Angaben vorhanden.`,
      missing: applicable ? checks.filter(([, ok]) => !ok).map(([name]) => name) : [], source });
  };
  const c = d.company, p = d.platform;
  add('identity', 'Unternehmen', 'Firmenprofil', 'tenants', [
    ['Firmenname', filled(c.name)], ['Rechtsform', filled(first(c.legal_form, c.legal_form_key))], ['Branche', filled(first(c.industry, c.industry_key))],
  ], 'Unternehmensstammdaten');
  add('address', 'Unternehmen', 'Geschäftsanschrift', 'tenants', [['Straße', filled(c.street)], ['Postleitzahl', filled(c.postal_code)], ['Ort', filled(c.city)], ['Land', filled(c.country)]], 'Unternehmensstammdaten');
  add('contact', 'Unternehmen', 'Kontakt und Vertretung', 'tenants', [
    ['E-Mail', filled(first(c.email, p.primary_contact_email))], ['Telefon', filled(first(c.phone, p.primary_contact_phone))], ['Ansprechperson / Vertretung', filled(first(c.representative_name, p.primary_contact_name))],
  ], 'Unternehmensstammdaten und Plattformakte');
  add('logo', 'Unternehmen', 'Firmenlogo', 'tenant_branding', [['Logo-Adresse', !!safeDossierLogo(d.branding?.logo_url)]], 'Gespeicherte Unternehmensgestaltung', safeDossierLogo(d.branding?.logo_url) ? 'Eine darstellbare Logo-Adresse ist hinterlegt. Die Bilddatei wird bei der Anzeige geladen.' : 'Es ist keine darstellbare Logo-Adresse hinterlegt.');
  add('tax', 'Unternehmen', 'Steuerangaben', 'tenant_tax_profiles', [['Steuernummer oder USt-IdNr.', filled(first(c.tax_number, c.vat_id))]], 'Unternehmensstammdaten');
  const legal = String(first(c.legal_form_key, c.legal_form) ?? '').toLowerCase();
  const needsRegister = /gmbh|\bug\b|(^|_)ug($|_)|haftungsbeschränkt|\bag\b|ohg|\bkg\b|e\.?\s?v\.?|e\.?\s?k\.?|genossenschaft|gbr_eingetragen|egbr/.test(legal);
  // Empty legal forms remain open, so missing classification cannot improve the percentage.
  add('register', 'Unternehmen', 'Registerangaben', 'tenant_register_profiles', [['Registergericht', filled(c.register_court)], ['Registernummer', filled(c.register_number)]], 'Unternehmensstammdaten', undefined, !legal || needsRegister);
  add('bank', 'Abrechnung & Leistungen', 'Bankverbindung', 'tenant_bank_accounts', [
    ['Kontoinhaber', filled(first(d.bank?.account_holder, d.billing?.account_holder))], ['IBAN', filled(first(d.bank?.iban, d.billing?.iban))],
  ], 'Bankkonten und Abrechnungseinstellungen');
  add('billing', 'Abrechnung & Leistungen', 'Eigene Abrechnung', 'tenant_billing_settings', [
    ['Rechnungspräfix', filled(d.billing?.invoice_prefix)], ['Zahlungsziel', d.billing?.payment_terms_days != null && Number(d.billing.payment_terms_days) >= 0],
  ], 'Abrechnungseinstellungen des Unternehmens');
  add('catalog', 'Abrechnung & Leistungen', 'Leistungen und Preise', 'tenant_service_catalog', [['Leistungskatalog', d.counts.services > 0], ['Aktueller Leistungspreis', d.counts.pricedServices > 0]], 'Aktive Leistungen und aktuell gültige Preise', `${d.counts.services} aktive Leistungen · ${d.counts.pricedServices} mit aktuellem Preis.`);
  add('admin', 'Zugänge', 'Verwaltungskonto', 'tenant_users', [['Aktives Verwaltungskonto mit Anmeldezuordnung', d.counts.adminAccounts > 0]], 'Unternehmenskonten', `${d.counts.adminAccounts} aktive Verwaltungskonten mit Anmeldezuordnung.`);
  add('login', 'Zugänge', 'Erste Anmeldung', 'tenant_users', [['Protokollierter Anmeldezeitpunkt', d.counts.loggedInAccounts > 0]], 'Gespeicherte Anmeldezeitpunkte', d.counts.lastLoginAt ? 'Eine Anmeldung ist mit Datum hinterlegt.' : 'Noch kein Anmeldezeitpunkt hinterlegt.');
  for (const [key, label, counts] of [['employees', 'Mitarbeitende', d.counts.employees], ['clients', 'Klient:innen', d.counts.clients]] as const) {
    add(`${key}-created`, label, `${label} angelegt`, key, [[`Mindestens ein nicht gelöschter Datensatz`, counts.total > 0]], 'Gespeicherte Personenstammdaten', `${counts.total} vorhandene Datensätze · ${counts.active} aktiv · ${counts.deleted} gelöscht.`);
    const score = counts.total ? counts.complete / counts.total : 0;
    steps.push({ key: `${key}-complete`, group: label, label: 'Grundangaben vollständig', section: key, score, applicable: true,
      state: score === 1 ? 'complete' : score > 0 ? 'partial' : 'open', evidence: `${counts.complete} von ${counts.total} Datensätzen erfüllen die Grundprüfung.`,
      missing: score === 1 ? [] : [key === 'clients' ? 'Vorname, Nachname, Straße, Postleitzahl und Ort je Person' : 'Vorname, Nachname, Kontaktweg, Beschäftigungsart und Eintrittsdatum je Person'], source: 'Prüfung aller nicht gelöschten Personenstammdaten' });
    if (counts.portalEnabled > 0 && key === 'employees') {
      const ratio = counts.portalLinked / counts.portalEnabled;
      steps.push({ key: 'employee-portals', group: label, label: 'Aktivierte Portale zugeordnet', section: 'tenant_users', score: ratio, applicable: true,
        state: ratio === 1 ? 'complete' : ratio > 0 ? 'partial' : 'open', evidence: `${counts.portalLinked} von ${counts.portalEnabled} aktivierten Portalen mit Kontozuordnung.`,
        missing: ratio === 1 ? [] : ['Kontozuordnung für aktivierte Mitarbeitendenportale'], source: 'Mitarbeitendenstammdaten und Unternehmenskonten' });
    }
  }
  const applicable = steps.filter(s => s.applicable);
  const percentage = applicable.length ? Math.round(100 * applicable.reduce((sum, s) => sum + s.score, 0) / applicable.length) : 0;
  const groups = [...new Set(steps.map(s => s.group))].map(label => {
    const selected = applicable.filter(s => s.group === label);
    return { label, percentage: selected.length ? Math.round(100 * selected.reduce((sum, s) => sum + s.score, 0) / selected.length) : 0, complete: selected.filter(s => s.state === 'complete').length, total: selected.length };
  });
  return { percentage, applicable: applicable.length, complete: applicable.filter(s => s.state === 'complete').length, partial: applicable.filter(s => s.state === 'partial').length, open: applicable.filter(s => s.state === 'open').length, steps, groups };
}

export function dossierPersonCompleteness(row: DossierRow, kind: 'clients' | 'employees') {
  const checks: [string, boolean][] = [['Vorname', filled(row.first_name)], ['Nachname', filled(row.last_name)]];
  if (kind === 'clients') checks.push(['Straße', filled(row.street)], ['Postleitzahl', filled(row.postal_code)], ['Ort', filled(row.city)]);
  else checks.push(['Kontaktweg', filled(first(row.email, row.phone, row.mobile))], ['Beschäftigungsart', filled(row.employment_type)], ['Eintrittsdatum', filled(row.entry_date)]);
  return { percentage: Math.round(100 * checks.filter(([, ok]) => ok).length / checks.length), missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
}

export function dossierRowName(row: DossierRow, fallback = 'Datensatz'): string {
  return String(first(row.full_name, row.display_name, [row.first_name, row.last_name].filter(filled).join(' '), row.name, row.title, row.label, row.subject, row.employee_number, row.client_number, row.code, row.id) ?? fallback);
}

const FIELD_LABELS: Record<string, string> = {
  id:'Datensatz-ID', tenant_id:'Unternehmens-ID', client_id:'Klient:innen-ID', employee_id:'Mitarbeitenden-ID', name:'Name', legal_name:'Rechtlicher Name', legal_form:'Rechtsform', legal_form_key:'Rechtsform', industry:'Branche', industry_key:'Branche', slug:'Unternehmenskürzel',
  first_name:'Vorname', last_name:'Nachname', full_name:'Vollständiger Name', display_name:'Anzeigename', salutation:'Anrede', academic_title:'Titel', date_of_birth:'Geburtsdatum', gender:'Geschlecht', nationality:'Staatsangehörigkeit',
  email:'E-Mail', phone:'Telefon', mobile:'Mobiltelefon', fax:'Fax', website:'Webseite', street:'Straße', house_number:'Hausnummer', postal_code:'Postleitzahl', zip:'Postleitzahl', city:'Ort', country:'Land', floor:'Etage', apartment_number:'Wohnungsnummer', doorbell_name:'Klingelname', address_supplement:'Adresszusatz',
  client_number:'Klientennummer', employee_number:'Personalnummer', status:'Status', care_level:'Pflegegrad', insurance_name:'Versicherung', insurance_number:'Versicherungsnummer', cost_bearer:'Kostenträger', billing_party:'Rechnungsempfänger',
  emergency_notes:'Notfallhinweise', emergency_contact_name:'Notfallkontakt', emergency_contact_phone:'Telefon des Notfallkontakts', allergies:'Allergien', diagnoses_notes:'Diagnosen und Hinweise', mobility_notes:'Mobilität', pets:'Haustiere', access_notes:'Zugangshinweise', key_management_notes:'Schlüsselverwaltung', internal_notes:'Interne Hinweise', visible_notes_for_employee:'Hinweise für Mitarbeitende', special_notes:'Besondere Hinweise', preferred_contact:'Bevorzugter Kontaktweg',
  admission_date:'Aufnahmedatum', discharge_date:'Austrittsdatum', service_start:'Leistungsbeginn', housing_form:'Wohnform', employment_type:'Beschäftigungsart', role_title:'Tätigkeit', qualification:'Qualifikation', qualification_notes:'Qualifikationshinweise', weekly_hours:'Wochenstunden', entry_date:'Eintrittsdatum', exit_date:'Austrittsdatum', department:'Abteilung', cost_center:'Kostenstelle',
  portal_enabled:'Portal aktiviert', profile_id:'Profilzuordnung', auth_user_id:'Anmeldezuordnung', username:'Benutzername', role_key:'Rolle', last_login_at:'Letzte Anmeldung', first_login_completed:'Erste Anmeldung abgeschlossen', archived_at:'Archiviert am', deleted_at:'Gelöscht am', created_at:'Angelegt am', updated_at:'Geändert am', created_by:'Angelegt von (ID)', updated_by:'Geändert von (ID)',
  ik_number:'IK-Nummer', tax_number:'Steuernummer', vat_id:'USt-IdNr.', tax_office:'Finanzamt', tax_scheme:'Steuermodell', kleinunternehmer:'Kleinunternehmerregelung', reverse_charge:'Reverse Charge', register_court:'Registergericht', register_number:'Registernummer', supervisory_authority:'Aufsichtsbehörde', representative_name:'Vertretung', representative_position:'Position der Vertretung', register_type:'Registerart', register_date:'Eintragungsdatum', share_capital:'Stammkapital',
  iban:'IBAN', bic:'BIC', bank_name:'Bank', account_holder:'Kontoinhaber', is_primary:'Hauptzuordnung', label:'Bezeichnung', invoice_prefix:'Rechnungspräfix', payment_terms_days:'Zahlungsziel (Tage)', default_hourly_rate:'Standard-Stundensatz', dunning_after_days:'Mahnung nach (Tagen)', dunning_fee:'Mahngebühr', invoice_footer_text:'Rechnungsfußzeile', invoice_notes:'Rechnungshinweise', billing_email:'Abrechnungs-E-Mail', primary_contact_name:'Ansprechperson', primary_contact_email:'E-Mail der Ansprechperson', primary_contact_phone:'Telefon der Ansprechperson', support_email:'Support-E-Mail',
  logo_url:'Logo-Adresse', favicon_url:'Favicon-Adresse', avatar_url:'Profilbild-Adresse', app_name:'Anwendungsname', font_family:'Schriftfamilie', light_primary_color:'Primärfarbe (hell)', light_accent_color:'Akzentfarbe (hell)',
  is_active:'Aktiv', is_default:'Standard', sort_order:'Reihenfolge', notes:'Hinweise', description:'Beschreibung', service_key:'Leistungsschlüssel', price_net:'Nettopreis', default_price_net:'Standard-Nettopreis', unit:'Einheit', valid_from:'Gültig ab', valid_to:'Gültig bis', tax_rate:'Steuersatz', tax_mode:'Steuermodell', product_key:'Funktionsbereich', module_key:'Funktionsbereich',
  has_driver_license:'Führerschein vorhanden', driver_license_class:'Führerscheinklasse', has_police_clearance:'Führungszeugnis vorhanden', police_clearance_date:'Führungszeugnis vom', police_clearance_valid_until:'Führungszeugnis gültig bis', has_first_aid_certificate:'Erste-Hilfe-Nachweis vorhanden', first_aid_valid_until:'Erste-Hilfe-Nachweis gültig bis', must_keep_mileage_log:'Fahrtenbuch erforderlich', mileage_log_required_from:'Fahrtenbuch ab', allowed_products:'Zugelassene Funktionsbereiche',
  liability_insurance:'Haftpflicht', liability_insurer:'Haftpflichtversicherer', liability_policy_number:'Versicherungsnummer', chamber_membership:'Kammerzugehörigkeit', professional_association:'Berufsverband', legal_notes:'Rechtliche Hinweise', tax_notes:'Steuerliche Hinweise', register_notes:'Registerhinweise',
};
export function dossierFieldLabel(key: string): string { return FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase()); }
export function isDossierSecretKey(key: string): boolean { return /password|passwort|secret|token|credential|api.?key|private.?key|code.?hash|recovery|lease|signature_data|signature_base64/i.test(key) || /^(access_code|portal_code|code_plain|encrypted_password|authorization|cookie)$/i.test(key); }
export function visibleDossierFields(row: DossierRow): [string, unknown][] { return Object.entries(row).filter(([key]) => !isDossierSecretKey(key)); }
export function dossierChangedFields(before: unknown, after: unknown): { key: string; before: unknown; after: unknown }[] {
  const a = before && typeof before === 'object' && !Array.isArray(before) ? before as DossierRow : {};
  const b = after && typeof after === 'object' && !Array.isArray(after) ? after as DossierRow : {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => !isDossierSecretKey(key) && JSON.stringify(a[key]) !== JSON.stringify(b[key])).map(key => ({ key, before: a[key], after: b[key] }));
}
