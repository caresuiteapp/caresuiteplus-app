import type { IntakeDocumentTemplate } from './intakeDocumentTypes';

const BASE_STYLE = `<style>
body { font-family: Georgia, serif; line-height: 1.5; color: #1a1a1a; padding: 24px; }
h1 { font-size: 1.25rem; margin-bottom: 16px; }
h2 { font-size: 1rem; margin-top: 20px; }
p { margin: 8px 0; }
.missing { background: #fff3cd; color: #856404; padding: 2px 4px; border-radius: 3px; }
.sig-block { margin-top: 32px; border-top: 1px solid #ccc; padding-top: 16px; }
.sig-img { max-height: 64px; }
</style>`;

function sigBlock(required: { client?: boolean; employee?: boolean; representative?: boolean }): string {
  const parts: string[] = [];
  if (required.client) {
    parts.push('<p><strong>Klient:in / Betreute Person</strong><br/>{{signature.client}}</p>');
  }
  if (required.representative) {
    parts.push('<p><strong>Gesetzliche Vertretung</strong><br/>{{signature.legal_representative}}</p>');
  }
  if (required.employee) {
    parts.push('<p><strong>Mitarbeitende:r (Pflegedienst)</strong><br/>{{signature.employee}}</p>');
  }
  return `<div class="sig-block">${parts.join('')}</div>`;
}

function baseHeader(title: string): string {
  return `${BASE_STYLE}<h1>${title}</h1>
<p><strong>Mandant:</strong> {{tenant.name}}, {{tenant.street}}, {{tenant.zip}} {{tenant.city}}</p>
<p><strong>Klient:in:</strong> {{client.salutation}} {{client.full_name}}, geb. {{client.date_of_birth}}</p>
<p><strong>Adresse:</strong> {{client.street}}, {{client.zip}} {{client.city}}</p>
<p><strong>Datum:</strong> {{document.date}} · <strong>Ort:</strong> {{document.location}}</p>`;
}

function makeTemplate(
  partial: Omit<IntakeDocumentTemplate, 'id' | 'isSystemTemplate' | 'source' | 'isActive'>,
): IntakeDocumentTemplate {
  return {
    ...partial,
    id: `sys-${partial.templateKey}`,
    isSystemTemplate: true,
    isActive: true,
    source: 'system',
  };
}

export const INTAKE_DOCUMENT_SYSTEM_TEMPLATES: IntakeDocumentTemplate[] = [
  makeTemplate({
    templateKey: 'privacy_consent_default',
    title: 'Datenschutz-Einwilligung',
    documentType: 'privacy_consent',
    serviceType: null,
    version: 1,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Einwilligung zur Verarbeitung personenbezogener Daten (DSGVO)')}
<h2>1. Verantwortliche Stelle</h2>
<p>{{tenant.name}} ist verantwortliche Stelle im Sinne der Datenschutz-Grundverordnung (DSGVO) für die Verarbeitung Ihrer personenbezogenen Daten im Rahmen der vereinbarten Pflege-, Betreuungs- und Beratungsleistungen.</p>
<h2>2. Zweck der Datenverarbeitung</h2>
<p>Die Verarbeitung erfolgt zur Planung, Durchführung und Abrechnung der Leistungen, zur Erfüllung gesetzlicher Dokumentations- und Aufbewahrungspflichten (insb. SGB XI, SGB V), zur Kommunikation mit Kostenträgern sowie zur Gewährleistung der Versorgungssicherheit.</p>
<h2>3. Kategorien personenbezogener Daten</h2>
<p>Stammdaten, Kontaktdaten, Versicherungs- und Pflegegraddaten, Leistungs- und Einsatzdaten, Pflegedokumentation, Abrechnungsdaten sowie – soweit erforderlich – Gesundheitsdaten.</p>
<h2>4. Empfänger</h2>
<p>Empfänger können sein: Pflegekasse {{cost_carrier.care_fund_name}}, Krankenkasse {{cost_carrier.health_insurance_name}}, behandelnde Ärzt:innen, andere Leistungserbringer sowie IT-Dienstleister im Rahmen von Auftragsverarbeitungsverträgen.</p>
<h2>5. Speicherdauer</h2>
<p>Die Speicherung erfolgt gemäß gesetzlichen Aufbewahrungsfristen, in der Regel mindestens 10 Jahre nach Beendigung der Leistungserbringung.</p>
<h2>6. Betroffenenrechte</h2>
<p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Widerspruch sowie Beschwerde bei einer Aufsichtsbehörde. Einwilligungen können jederzeit mit Wirkung für die Zukunft widerrufen werden.</p>
<h2>7. Einwilligungserklärung</h2>
<p>Ich willige ein, dass {{tenant.name}} meine personenbezogenen Daten – einschließlich Gesundheitsdaten, soweit für die Leistungserbringung erforderlich – zu den genannten Zwecken verarbeitet.</p>
${sigBlock({ client: true })}
<p>Ort, Datum: {{document.location}}, {{document.date}}</p>`,
    plainTextContent: 'Einwilligung zur Verarbeitung personenbezogener Daten gemäß DSGVO.',
    placeholderSchema: {
      'tenant.name': { label: 'Mandantenname', required: true },
      'client.full_name': { label: 'Name Klient:in', required: true },
      'client.date_of_birth': { label: 'Geburtsdatum', required: true },
      'document.date': { label: 'Datum', required: true },
      'document.location': { label: 'Ort', required: true },
    },
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),
  makeTemplate({
    templateKey: 'assignment_declaration_care_health_insurance',
    title: 'Abtretungserklärung / Direktabrechnung',
    documentType: 'assignment_declaration',
    serviceType: null,
    version: 1,
    isRequired: false,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Abtretungserklärung und Erteilung eines Zahlungsauftrags')}
<p>Ich, {{client.full_name}}, trete hiermit meine Ansprüche auf Erstattung von Pflege- und Betreuungsleistungen gegenüber der Pflegekasse {{cost_carrier.care_fund_name}} (IK: {{cost_carrier.care_fund_ik}}) an {{tenant.name}} ab.</p>
<p>Ich bevollmächtige {{tenant.name}}, Rechnungen direkt bei meiner Pflegekasse einzureichen. Meine Versichertennummer: {{client.insurance_number}}. Pflegegrad: {{care.level}}.</p>
<p>Diese Erklärung gilt für Leistungen ab {{contract.service_start}} im Rahmen der vereinbarten Abrechnungsart {{billing.types}}.</p>
${sigBlock({ client: true })}
<p>Ort, Datum: {{document.location}}, {{document.date}}</p>`,
    plainTextContent: 'Abtretungserklärung für Direktabrechnung mit der Pflegekasse.',
    placeholderSchema: {
      'client.full_name': { label: 'Name Klient:in', required: true },
      'cost_carrier.care_fund_name': { label: 'Pflegekasse', required: true },
      'client.insurance_number': { label: 'Versichertennummer', required: true },
      'care.level': { label: 'Pflegegrad', required: true },
    },
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),
  makeTemplate({
    templateKey: 'client_contract_assist',
    title: 'Kundenvertrag Alltagsbegleitung / Betreuung',
    documentType: 'client_contract',
    serviceType: 'assist',
    version: 1,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Versorgungsvertrag — Alltagsbegleitung und Betreuung')}
<h2>§ 1 Vertragsgegenstand</h2>
<p>{{tenant.name}} erbringt für {{client.full_name}} Leistungen der Alltagsbegleitung, haushaltsnahe Unterstützung und Betreuung nach individueller Vereinbarung.</p>
<h2>§ 2 Leistungsbeginn</h2>
<p>Der Leistungsbeginn ist der {{contract.service_start}}. Der Stundensatz beträgt {{billing.hourly_rate}} EUR (netto zzgl. USt, sofern anwendbar).</p>
<h2>§ 3 Abrechnung</h2>
<p>Abrechnung erfolgt über {{billing.types}}. Kostenträger: {{cost_carrier.primary_name}}.</p>
<h2>§ 4 Pflichten der Klient:in</h2>
<p>Die Klient:in stellt den Zugang zur Wohnung sicher und teilt relevante Gesundheits- und Versorgungsinformationen mit.</p>
<h2>§ 5 Kündigung</h2>
<p>Der Vertrag kann von beiden Seiten mit einer Frist von 4 Wochen zum Monatsende gekündigt werden.</p>
${sigBlock({ client: true, employee: true })}
<p>Ort, Datum: {{document.location}}, {{document.date}}</p>`,
    plainTextContent: 'Versorgungsvertrag Alltagsbegleitung und Betreuung.',
    placeholderSchema: {
      'tenant.name': { label: 'Mandantenname', required: true },
      'client.full_name': { label: 'Name Klient:in', required: true },
      'contract.service_start': { label: 'Leistungsbeginn', required: true },
    },
    signatureSlots: [
      { role: 'client', placeholder: '{{signature.client}}', required: true },
      { role: 'employee', placeholder: '{{signature.employee}}', required: true },
    ],
  }),
  makeTemplate({
    templateKey: 'client_contract_ambulatory_care',
    title: 'Kundenvertrag Ambulante Pflege',
    documentType: 'client_contract',
    serviceType: 'ambulatory_care',
    version: 1,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Versorgungsvertrag — Ambulante Pflege (SGB XI)')}
<h2>§ 1 Leistungsumfang</h2>
<p>Ambulante Pflegeleistungen gemäß Pflegegrad {{care.level}} für {{client.full_name}}. Pflegekasse: {{cost_carrier.care_fund_name}}.</p>
<h2>§ 2 Leistungsbeginn und Einsatzplanung</h2>
<p>Leistungsbeginn: {{contract.service_start}}. Einsätze werden nach Bedarf und Vereinbarung geplant.</p>
<h2>§ 3 Dokumentation und Qualität</h2>
<p>Leistungen werden dokumentationspflichtig erfasst. Der Pflegedienst weist qualifiziertes Personal ein.</p>
<h2>§ 4 Abrechnung</h2>
<p>Abrechnung über {{billing.types}} direkt mit der Pflegekasse, sofern eine Abtretung vorliegt.</p>
${sigBlock({ client: true, employee: true })}`,
    plainTextContent: 'Versorgungsvertrag ambulante Pflege.',
    placeholderSchema: {
      'client.full_name': { label: 'Name Klient:in', required: true },
      'care.level': { label: 'Pflegegrad', required: true },
      'cost_carrier.care_fund_name': { label: 'Pflegekasse', required: true },
    },
    signatureSlots: [
      { role: 'client', placeholder: '{{signature.client}}', required: true },
      { role: 'employee', placeholder: '{{signature.employee}}', required: true },
    ],
  }),
  makeTemplate({
    templateKey: 'client_contract_stationary_care',
    title: 'Kundenvertrag Stationäre Pflege',
    documentType: 'client_contract',
    serviceType: 'stationary_care',
    version: 1,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Versorgungsvertrag — Stationäre Pflege')}
<h2>§ 1 Unterbringung</h2>
<p>{{client.full_name}} wird in der Einrichtung {{facility.name}}, Wohnbereich {{facility.care_area}}, Zimmer {{facility.room_number}} betreut.</p>
<h2>§ 2 Leistungen</h2>
<p>Stationäre Pflege- und Betreuungsleistungen entsprechend Pflegegrad {{care.level}}.</p>
<h2>§ 3 Entgelt und Kostenträger</h2>
<p>Abrechnung über {{billing.types}}. Pflegekasse: {{cost_carrier.care_fund_name}}.</p>
${sigBlock({ client: true, employee: true })}`,
    plainTextContent: 'Versorgungsvertrag stationäre Pflege.',
    placeholderSchema: {
      'client.full_name': { label: 'Name Klient:in', required: true },
      'facility.name': { label: 'Einrichtung', required: true },
      'care.level': { label: 'Pflegegrad', required: true },
    },
    signatureSlots: [
      { role: 'client', placeholder: '{{signature.client}}', required: true },
      { role: 'employee', placeholder: '{{signature.employee}}', required: true },
    ],
  }),
  makeTemplate({
    templateKey: 'client_contract_care_consulting',
    title: 'Kundenvertrag Pflegeberatung',
    documentType: 'client_contract',
    serviceType: 'care_consulting',
    version: 1,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Beratungsvereinbarung — Pflegeberatung nach § 7a SGB XI')}
<h2>§ 1 Beratungsanlass</h2>
<p>Beratung für {{client.full_name}}. Anlass: {{consulting.reason}}. Art: {{consulting.type}}.</p>
<h2>§ 2 Umfang</h2>
<p>Individuelle Pflegeberatung, Hilfestellung bei Antragsstellung und Versorgungsplanung.</p>
<h2>§ 3 Vergütung</h2>
<p>Abrechnung über {{billing.types}} mit der Pflegekasse {{cost_carrier.care_fund_name}}, sofern anspruchsberechtigt.</p>
${sigBlock({ client: true, employee: true })}`,
    plainTextContent: 'Beratungsvereinbarung Pflegeberatung.',
    placeholderSchema: {
      'client.full_name': { label: 'Name Klient:in', required: true },
      'consulting.reason': { label: 'Beratungsanlass', required: true },
    },
    signatureSlots: [
      { role: 'client', placeholder: '{{signature.client}}', required: true },
      { role: 'employee', placeholder: '{{signature.employee}}', required: true },
    ],
  }),
  makeTemplate({
    templateKey: 'client_contract_day_care',
    title: 'Kundenvertrag Tagespflege',
    documentType: 'client_contract',
    serviceType: 'day_care',
    version: 1,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Versorgungsvertrag — Tagespflege')}
<p>Tagespflegeleistungen für {{client.full_name}} gemäß Pflegegrad {{care.level}} bei {{tenant.name}}.</p>
<p>Leistungsbeginn: {{contract.service_start}}. Abrechnung: {{billing.types}}.</p>
${sigBlock({ client: true, employee: true })}`,
    plainTextContent: 'Versorgungsvertrag Tagespflege.',
    placeholderSchema: {
      'client.full_name': { label: 'Name Klient:in', required: true },
      'care.level': { label: 'Pflegegrad', required: true },
    },
    signatureSlots: [
      { role: 'client', placeholder: '{{signature.client}}', required: true },
      { role: 'employee', placeholder: '{{signature.employee}}', required: true },
    ],
  }),
  makeTemplate({
    templateKey: 'client_contract_relief_services',
    title: 'Kundenvertrag Entlastungsleistungen',
    documentType: 'client_contract',
    serviceType: 'relief_services',
    version: 1,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Versorgungsvertrag — Entlastungsleistungen (§ 45b SGB XI)')}
<p>Entlastungsleistungen für {{client.full_name}}, Pflegegrad {{care.level}}. Leistungsbeginn: {{contract.service_start}}.</p>
${sigBlock({ client: true, employee: true })}`,
    plainTextContent: 'Versorgungsvertrag Entlastungsleistungen.',
    placeholderSchema: {
      'client.full_name': { label: 'Name Klient:in', required: true },
      'care.level': { label: 'Pflegegrad', required: true },
    },
    signatureSlots: [
      { role: 'client', placeholder: '{{signature.client}}', required: true },
      { role: 'employee', placeholder: '{{signature.employee}}', required: true },
    ],
  }),
  makeTemplate({
    templateKey: 'confidentiality_release_default',
    title: 'Schweigepflichtentbindung',
    documentType: 'additional_consent',
    serviceType: null,
    version: 1,
    isRequired: false,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Schweigepflichtentbindungserklärung')}
<p>Ich entbinde {{tenant.name}} von der ärztlichen Schweigepflicht gegenüber: {{consulting.family_doctor}} sowie weiteren behandelnden Ärzt:innen, soweit dies für die Versorgungsplanung erforderlich ist.</p>
${sigBlock({ client: true })}`,
    plainTextContent: 'Schweigepflichtentbindung.',
    placeholderSchema: { 'client.full_name': { label: 'Name Klient:in', required: true } },
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),
  makeTemplate({
    templateKey: 'communication_consent_default',
    title: 'Kommunikationseinwilligung',
    documentType: 'additional_consent',
    serviceType: null,
    version: 1,
    isRequired: false,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Einwilligung zur Kommunikation')}
<p>Ich willige ein, dass {{tenant.name}} mich per Telefon ({{client.phone}}), E-Mail ({{client.email}}) oder Portal-Nachricht über Termine, Leistungsänderungen und organisatorische Hinweise kontaktieren darf.</p>
${sigBlock({ client: true })}`,
    plainTextContent: 'Einwilligung zur Kommunikation.',
    placeholderSchema: { 'client.full_name': { label: 'Name Klient:in', required: true } },
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),
  makeTemplate({
    templateKey: 'photo_media_consent_default',
    title: 'Foto- und Medien-Einwilligung',
    documentType: 'additional_consent',
    serviceType: null,
    version: 1,
    isRequired: false,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Einwilligung zur Foto- und Medienerfassung')}
<p>Ich willige ein, dass im Rahmen der Versorgung dokumentationsrelevante Fotos (z. B. Wundverlauf, Hilfsmittelanpassung) erstellt und im geschützten Dokumentensystem gespeichert werden.</p>
${sigBlock({ client: true })}`,
    plainTextContent: 'Einwilligung Foto- und Medienerfassung.',
    placeholderSchema: { 'client.full_name': { label: 'Name Klient:in', required: true } },
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),
  makeTemplate({
    templateKey: 'emergency_contact_consent_default',
    title: 'Einwilligung Notfallkontakt',
    documentType: 'additional_consent',
    serviceType: null,
    version: 1,
    isRequired: false,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${baseHeader('Einwilligung zur Kontaktaufnahme im Notfall')}
<p>Im Notfall darf {{tenant.name}} folgende Person kontaktieren: {{emergency.name}} (Tel. {{emergency.phone}}).</p>
${sigBlock({ client: true })}`,
    plainTextContent: 'Einwilligung Notfallkontakt.',
    placeholderSchema: {
      'emergency.name': { label: 'Notfallkontakt', required: true },
      'emergency.phone': { label: 'Notfall-Telefon', required: true },
    },
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),
];

export function getSystemIntakeTemplateByKey(templateKey: string): IntakeDocumentTemplate | undefined {
  return INTAKE_DOCUMENT_SYSTEM_TEMPLATES.find((t) => t.templateKey === templateKey);
}
