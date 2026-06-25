import type { DocumentCatalogEntry, BuiltDocumentCatalogTemplate, DocumentLayoutFamily } from './types';
import {
  PREMIUM_DOCUMENT_CSS,
  clientMetaBlock,
  signatureBlock,
  wrapPremiumDocument,
} from './layoutBlocks';

function manualTable(fields: Array<{ fieldKey: string; label: string }>): string {
  const rows = fields
    .map(
      (f) =>
        `<tr><td>${f.label}</td><td class="cs-field-manual">{{manual.${f.fieldKey}}}</td></tr>`,
    )
    .join('');
  return `<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function checklistRows(fields: Array<{ fieldKey: string; label: string }>): string {
  return (fields.length > 0 ? fields : [{ fieldKey: 'punkt', label: 'Prüfpunkt' }])
    .map((f) => `<tr><td>☐ ${f.label}</td><td class="cs-field-manual">{{manual.${f.fieldKey}}}</td></tr>`)
    .join('');
}

const LAYOUT_FAMILY_BUILDERS: Record<DocumentLayoutFamily, (entry: DocumentCatalogEntry) => string> = {
  contract: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      subtitle: 'Vertragsdokument',
      layoutKind: 'din5008',
      bodyHtml: `${clientMetaBlock()}
<h2>Vertragsgegenstand</h2>
<p class="cs-field-manual">{{manual.vertragsgegenstand}}</p>
<h2>Laufzeit & Kündigung</h2>
<p><strong>Beginn:</strong> <span class="cs-field-manual">{{manual.leistungsbeginn}}</span></p>
<p><strong>Ende:</strong> <span class="cs-field-manual">{{manual.leistungsende}}</span></p>
${signatureBlock()}`,
    }),
  service_proof: () =>
    wrapPremiumDocument({
      title: 'Leistungsnachweis',
      subtitle: 'Abrechnungsfähiger Einsatznachweis',
      bodyHtml: `${clientMetaBlock()}
<table class="cs-block-table">
<thead><tr><th>Datum</th><th>Leistung</th><th>Zeit</th><th>Mitarbeitende:r</th></tr></thead>
<tbody>
<tr><td>{{assignment.date}}</td><td>{{assignment.type}}</td><td>{{assignment.duration}}</td><td>{{employee.full_name}}</td></tr>
</tbody>
</table>
<p><strong>Bemerkung:</strong> <span class="cs-field-manual">{{manual.bemerkung}}</span></p>
${signatureBlock()}`,
    }),
  invoice: () =>
    wrapPremiumDocument({
      title: 'Rechnung {{invoice.number}}',
      subtitle: 'Abrechnungsbeleg',
      layoutKind: 'din5008',
      bodyHtml: `<div class="cs-block-info">
<p>Rechnungsdatum: {{invoice.date}}</p>
<p>Fällig: {{invoice.due_date}}</p>
<p>Empfänger: {{recipient.full_name}}</p>
</div>
<table class="cs-block-table"><thead><tr><th>Position</th><th>Betrag</th></tr></thead>
<tbody><tr><td>Leistung</td><td>{{invoice.gross_total}}</td></tr></tbody></table>
<p>{{invoice.tax_notice}}</p>
<p>Bank: {{company.bank_name}} · IBAN: {{company.iban}}</p>`,
    }),
  dunning: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      subtitle: 'Zahlungserinnerung / Mahnung',
      layoutKind: 'din5008',
      bodyHtml: `<div class="cs-block-info">
<p>Rechnung: {{invoice.number}} · Fällig seit: {{invoice.due_date}}</p>
<p>Offener Betrag: {{invoice.gross_total}}</p>
</div>
<p>Sehr geehrte Damen und Herren,</p>
<p class="cs-field-manual">{{manual.mahnungstext}}</p>
<p>Bitte begleichen Sie den offenen Betrag umgehend.</p>`,
    }),
  client_master: () =>
    wrapPremiumDocument({
      title: 'Stammblatt',
      subtitle: 'Zentrale Klient:innen-Stammdaten',
      bodyHtml: `${clientMetaBlock()}
<h2>Besonderheiten & Zugang</h2>
<p class="cs-field-manual">{{manual.besonderheiten}}</p>
<p><strong>Notfallkontakt:</strong> {{client.emergency_contact_name}} · {{client.emergency_contact_phone}}</p>
${signatureBlock()}`,
    }),
  employee_form: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      subtitle: 'Personalformular',
      bodyHtml: `<dl class="cs-doc-meta">
<dt>Mitarbeitende:r</dt><dd>{{employee.full_name}}</dd>
<dt>Personalnummer</dt><dd>{{employee.staff_number}}</dd>
<dt>Standort</dt><dd>{{employee.location}}</dd>
</dl>
${manualTable(entry.manualFields ?? [{ fieldKey: 'eintrag', label: 'Eintrag' }])}
<p><strong>Handzeichen:</strong> {{employee.handzeichen}}</p>`,
    }),
  shift_plan: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      subtitle: 'Dienstplan',
      bodyHtml: `<p><strong>Zeitraum:</strong> <span class="cs-field-manual">{{manual.zeitraum}}</span></p>
<table class="cs-block-table">
<thead><tr><th>Datum</th><th>Schicht</th><th>Mitarbeitende:r</th><th>Qualifikation</th></tr></thead>
<tbody><tr><td class="cs-field-manual">{{manual.datum}}</td><td class="cs-field-manual">{{manual.schicht}}</td><td>{{employee.full_name}}</td><td class="cs-field-manual">{{manual.qualifikation}}</td></tr></tbody>
</table>`,
    }),
  tour_plan: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      subtitle: 'Tourenplan',
      bodyHtml: `<p><strong>Tour:</strong> <span class="cs-field-manual">{{manual.tour_name}}</span> · <strong>Datum:</strong> {{assignment.date}}</p>
<table class="cs-block-table">
<thead><tr><th>Reihenfolge</th><th>Klient:in</th><th>Adresse</th><th>Zeitfenster</th></tr></thead>
<tbody><tr><td>1</td><td>{{client.full_name}}</td><td>{{client.street}}, {{client.zip}} {{client.city}}</td><td class="cs-field-manual">{{manual.zeitfenster}}</td></tr></tbody>
</table>
<p><strong>Fahrzeug:</strong> <span class="cs-field-manual">{{manual.fahrzeug}}</span></p>`,
    }),
  care_clinical: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      subtitle: 'Pflegedokumentation',
      bodyHtml: `${clientMetaBlock()}
<h2>Verlauf & Befund</h2>
${manualTable(entry.manualFields ?? [{ fieldKey: 'eintrag', label: 'Eintrag' }])}
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>`,
    }),
  consultation: () =>
    wrapPremiumDocument({
      title: 'Beratungsprotokoll',
      subtitle: 'Beratungsgespräch',
      layoutKind: 'din5008',
      bodyHtml: `${clientMetaBlock()}
<h2>Beratungsinhalt</h2>
<p class="cs-field-manual">{{manual.inhalt}}</p>
<h2>Empfehlungen</h2>
<p class="cs-field-manual">{{manual.empfehlungen}}</p>
${signatureBlock()}`,
    }),
  academy_certificate: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      subtitle: 'Teilnahmebestätigung / Zertifikat',
      bodyHtml: `<div class="cs-block-info" style="text-align:center;padding:24px;">
<h2 style="font-size:16pt;">{{manual.teilnehmer_name}}</h2>
<p>hat erfolgreich an folgender Qualifizierung teilgenommen:</p>
<p><strong>{{manual.kurs_name}}</strong></p>
<p>Datum: {{document.created_at}} · Dauer: <span class="cs-field-manual">{{manual.dauer}}</span></p>
</div>
<p style="text-align:center;">{{company.legal_name}}</p>`,
    }),
  vehicle_log: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      subtitle: 'Fahrzeugprotokoll',
      bodyHtml: `<dl class="cs-doc-meta">
<dt>Fahrzeug</dt><dd class="cs-field-manual">{{manual.fahrzeug}}</dd>
<dt>Kilometerstand</dt><dd class="cs-field-manual">{{manual.km_stand}}</dd>
<dt>Fahrer:in</dt><dd>{{employee.full_name}}</dd>
</dl>
${manualTable(entry.manualFields ?? [{ fieldKey: 'strecke', label: 'Strecke / Zweck' }])}`,
    }),
  assist_visit: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      subtitle: 'Assist-Einsatzdokument',
      bodyHtml: `${clientMetaBlock()}
<p><strong>Einsatz:</strong> {{assignment.subject}} · {{assignment.date}}</p>
<p><strong>Zeit:</strong> {{assignment.start_time}} – {{assignment.end_time}} ({{assignment.duration}})</p>
<h2>Dokumentation</h2>
<p class="cs-field-manual">{{manual.dokumentation}}</p>
<p><strong>Aufgaben:</strong> <span class="cs-field-manual">{{manual.aufgaben}}</span></p>
${signatureBlock()}`,
    }),
  incident: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      subtitle: 'Vorfall / Ereignisprotokoll',
      bodyHtml: `${clientMetaBlock()}
<p><strong>Zeitpunkt:</strong> <span class="cs-field-manual">{{manual.zeitpunkt}}</span></p>
<p><strong>Ort:</strong> <span class="cs-field-manual">{{manual.ort}}</span></p>
<h2>Schilderung</h2>
<p class="cs-field-manual">{{manual.schilderung}}</p>
<h2>Maßnahmen</h2>
<p class="cs-field-manual">{{manual.massnahmen}}</p>
<p><strong>Protokollführende:r:</strong> {{employee.full_name}}</p>`,
    }),
  checklist: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      subtitle: 'Checkliste',
      bodyHtml: `${clientMetaBlock()}
<table class="cs-block-table">
<thead><tr><th>Punkt</th><th>Status / Anmerkung</th></tr></thead>
<tbody>${checklistRows(entry.manualFields ?? [{ fieldKey: 'notiz', label: 'Eintrag' }])}</tbody>
</table>`,
    }),
  generic_form: (entry) =>
    wrapPremiumDocument({
      title: entry.name,
      bodyHtml: `${clientMetaBlock()}
${manualTable(entry.manualFields ?? [{ fieldKey: 'notiz', label: 'Eintrag' }])}
${entry.templateKey.includes('vertrag') || entry.templateKey.includes('abtretung') ? signatureBlock() : ''}`,
    }),
};

/** Legacy builderKey overrides — kept for named catalog entries. */
const BUILDER_KEY_OVERRIDES: Partial<Record<string, (entry: DocumentCatalogEntry) => string>> = {
  stammblatt: LAYOUT_FAMILY_BUILDERS.client_master,
  leistungsnachweis: LAYOUT_FAMILY_BUILDERS.service_proof,
  pflegeprotokoll: LAYOUT_FAMILY_BUILDERS.care_clinical,
  beratungsprotokoll: LAYOUT_FAMILY_BUILDERS.consultation,
  rechnung: LAYOUT_FAMILY_BUILDERS.invoice,
};

function resolveBuilder(entry: DocumentCatalogEntry): (entry: DocumentCatalogEntry) => string {
  return (
    BUILDER_KEY_OVERRIDES[entry.builderKey] ??
    LAYOUT_FAMILY_BUILDERS[entry.layoutFamily] ??
    LAYOUT_FAMILY_BUILDERS.generic_form
  );
}

export function buildCatalogTemplate(entry: DocumentCatalogEntry): BuiltDocumentCatalogTemplate {
  const layoutFamily = entry.layoutFamily ?? 'generic_form';
  const builder = resolveBuilder({ ...entry, layoutFamily });
  return {
    ...entry,
    layoutFamily,
    description: `${entry.name} — CareSuite+ Systemvorlage`,
    cssTemplate: PREMIUM_DOCUMENT_CSS,
    htmlTemplate: builder({ ...entry, layoutFamily }),
  };
}

export function buildAllCatalogTemplates(entries: DocumentCatalogEntry[]): BuiltDocumentCatalogTemplate[] {
  return entries.map(buildCatalogTemplate);
}
