import type { IntakeDocumentTemplate } from './intakeDocumentTypes';

function sigBlock(required: { client?: boolean; employee?: boolean; representative?: boolean }): string {
  const fields: string[] = [];
  if (required.client) {
    fields.push(`<div class="sig-field"><div class="sig-line">{{signature.client}}</div><div class="sig-label">Klient:in / zu betreuende Person</div></div>`);
  }
  if (required.representative) {
    fields.push(`<div class="sig-field"><div class="sig-line">{{signature.legal_representative}}</div><div class="sig-label">Gesetzliche Vertretung / Bevollmächtigte:r</div></div>`);
  }
  if (required.employee) {
    fields.push(`<div class="sig-field"><div class="sig-line">{{signature.employee}}</div><div class="sig-label">Mitarbeitende:r (Leistungserbringer)</div></div>`);
  }
  return `<div class="document-signature-block"><p class="document-paragraph"><strong>Ort, Datum:</strong> {{document.location}}, {{document.date}}</p><div class="sig-row">${fields.join('')}</div></div>`;
}

function docHeader(title: string, subtitle?: string): string {
  return `<div class="document-header"><h1>${title}</h1>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}</div>`;
}

function partiesBlock(): string {
  return `<div class="document-parties"><table>
<tr><td class="label">Leistungserbringer:</td><td><strong>{{tenant.name}}</strong><br/>{{tenant.street}}<br/>{{tenant.zip}} {{tenant.city}}</td></tr>
<tr><td class="label">Klient:in:</td><td><strong>{{client.salutation}} {{client.full_name}}</strong><br/>geb. am {{client.date_of_birth}}<br/>{{client.street}}<br/>{{client.zip}} {{client.city}}</td></tr>
<tr><td class="label">Pflegegrad:</td><td>{{care.level}}</td></tr>
<tr><td class="label">Kostenträger:</td><td>{{cost_carrier.primary_name}} · Pflegekasse: {{cost_carrier.care_fund_name}}</td></tr>
</table></div>`;
}

function metaLine(): string {
  return `<p class="document-meta">Aufnahmedatum: {{intake.date}} · Aufnahmeort: {{intake.location}} · Leistungsart: {{service.type}}</p>`;
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

const COMMON_PLACEHOLDERS = {
  'tenant.name': { label: 'Mandantenname', required: true },
  'tenant.street': { label: 'Mandantenstraße', required: false },
  'tenant.zip': { label: 'Mandanten-PLZ', required: false },
  'tenant.city': { label: 'Mandantenort', required: false },
  'client.full_name': { label: 'Name Klient:in', required: true },
  'client.date_of_birth': { label: 'Geburtsdatum', required: true },
  'client.street': { label: 'Klientenadresse', required: false },
  'client.zip': { label: 'Klienten-PLZ', required: false },
  'client.city': { label: 'Klientenort', required: false },
  'document.date': { label: 'Datum', required: true },
  'document.location': { label: 'Ort', required: true },
  'intake.date': { label: 'Aufnahmedatum', required: false },
  'intake.location': { label: 'Aufnahmeort', required: false },
  'service.type': { label: 'Leistungsart', required: false },
  'care.level': { label: 'Pflegegrad', required: false },
};

export const INTAKE_DOCUMENT_SYSTEM_TEMPLATES: IntakeDocumentTemplate[] = [
  makeTemplate({
    templateKey: 'privacy_consent_default',
    title: 'Datenschutz-Einwilligung',
    documentType: 'privacy_consent',
    serviceType: null,
    version: 2,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Einwilligung zur Verarbeitung personenbezogener Daten', 'gemäß Art. 6 Abs. 1 lit. a, Art. 7 und Art. 9 Abs. 2 lit. a DSGVO')}
${partiesBlock()}
${metaLine()}
<div class="document-section"><h2>§ 1 Verantwortliche Stelle und Datenschutzkontakt</h2>
<p class="document-paragraph">Verantwortliche Stelle im Sinne der Datenschutz-Grundverordnung (DSGVO) und des Bundesdatenschutzgesetzes (BDSG) ist:</p>
<p class="document-paragraph"><strong>{{tenant.name}}</strong>, {{tenant.street}}, {{tenant.zip}} {{tenant.city}} (nachfolgend „Leistungserbringer").</p>
<p class="document-paragraph">Bei Fragen zum Datenschutz, zur Ausübung Ihrer Betroffenenrechte oder bei Beschwerden wenden Sie sich bitte an den Datenschutzbeauftragten bzw. die Geschäftsleitung des Leistungserbringers.</p></div>
<div class="document-section"><h2>§ 2 Zwecke der Datenverarbeitung</h2>
<p class="document-paragraph">Die Verarbeitung Ihrer personenbezogenen Daten erfolgt zu folgenden Zwecken:</p>
<ol class="document-paragraph">
<li>Planung, Organisation, Durchführung und Nachweis der vereinbarten Pflege-, Betreuungs- und Beratungsleistungen;</li>
<li>Erfüllung gesetzlicher Dokumentations-, Aufbewahrungs- und Nachweispflichten (insbesondere SGB V, SGB XI, SGB XII, HeimG);</li>
<li>Abrechnung der Leistungen gegenüber Pflegekassen, Krankenkassen, Sozialhilfeträgern und Selbstzahlern;</li>
<li>Kommunikation mit Ihnen, Angehörigen, behandelnden Ärzt:innen, Therapeut:innen und anderen Leistungserbringern;</li>
<li>Qualitätssicherung, interne Organisation, Mitarbeiterplanung und Einsatzsteuerung;</li>
<li>Erfüllung gesetzlicher Melde- und Auskunftspflichten gegenüber Behörden und Kostenträgern.</li>
</ol></div>
<div class="document-section"><h2>§ 3 Rechtsgrundlagen</h2>
<p class="document-paragraph">Die Verarbeitung stützt sich auf folgende Rechtsgrundlagen:</p>
<ul class="document-paragraph">
<li><strong>Art. 6 Abs. 1 lit. a DSGVO</strong> — Einwilligung (z. B. für besondere Kommunikationswege, Medien);</li>
<li><strong>Art. 6 Abs. 1 lit. b DSGVO</strong> — Vertragserfüllung und vorvertragliche Maßnahmen;</li>
<li><strong>Art. 6 Abs. 1 lit. c DSGVO</strong> — Erfüllung rechtlicher Verpflichtungen;</li>
<li><strong>Art. 9 Abs. 2 lit. a DSGVO</strong> — ausdrückliche Einwilligung in die Verarbeitung besonderer Kategorien personenbezogener Daten (Gesundheitsdaten);</li>
<li><strong>Art. 9 Abs. 2 lit. h DSGVO</strong> — Gesundheitsversorgung und Sozialversicherung, soweit anwendbar.</li>
</ul></div>
<div class="document-section"><h2>§ 4 Kategorien personenbezogener Daten</h2>
<p class="document-paragraph">Es werden insbesondere folgende Datenkategorien verarbeitet:</p>
<ul class="document-paragraph">
<li><strong>Stammdaten:</strong> Name, Anschrift, Geburtsdatum, Versichertennummer, Pflegegrad, Kontaktdaten;</li>
<li><strong>Gesundheitsdaten:</strong> Diagnosen, Medikation, Pflegebedarf, Vitalwerte, Wunddokumentation, ärztliche Verordnungen;</li>
<li><strong>Leistungs- und Einsatzdaten:</strong> Einsatzplanung, Leistungsnachweise, Tourenprotokolle, Pflegedokumentation;</li>
<li><strong>Abrechnungsdaten:</strong> Leistungsarten, Abrechnungszeiträume, Kostenträger, IK-Nummern, Rechnungsdaten;</li>
<li><strong>Kommunikationsdaten:</strong> Telefon, E-Mail, Portalnachrichten, Einwilligungen zu Kontaktwegen;</li>
<li><strong>Vertrags- und Einwilligungsdaten:</strong> Verträge, Abtretungserklärungen, Einwilligungen, Unterschriften.</li>
</ul></div>
<div class="document-section"><h2>§ 5 Empfänger und Kategorien von Empfängern</h2>
<p class="document-paragraph">Empfänger Ihrer Daten können sein:</p>
<ul class="document-paragraph">
<li>Pflegekasse: {{cost_carrier.care_fund_name}} (IK: {{cost_carrier.care_fund_ik}});</li>
<li>Krankenkasse: {{cost_carrier.health_insurance_name}};</li>
<li>Behandelnde Ärzt:innen, Therapeut:innen, Apotheken und andere Leistungserbringer im Versorgungsnetzwerk;</li>
<li>Mitarbeitende des Leistungserbringers, die zur Leistungserbringung befugt sind;</li>
<li>IT-Dienstleister und Softwareanbieter im Rahmen von Auftragsverarbeitungsverträgen gemäß Art. 28 DSGVO;</li>
<li>Behörden und Kostenträger, soweit gesetzliche Pflichten bestehen.</li>
</ul></div>
<div class="document-section"><h2>§ 6 Speicherdauer und Löschung</h2>
<p class="document-paragraph">Personenbezogene Daten werden nur so lange gespeichert, wie es für die genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen. Für Pflege- und Abrechnungsunterlagen gelten in der Regel Aufbewahrungsfristen von mindestens 10 Jahren nach Beendigung der Leistungserbringung bzw. gemäß steuer- und handelsrechtlichen Vorgaben.</p></div>
<div class="document-section"><h2>§ 7 Betroffenenrechte</h2>
<p class="document-paragraph">Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO), Datenübertragbarkeit (Art. 20 DSGVO) und Widerspruch (Art. 21 DSGVO). Sie haben ferner das Recht, eine erteilte Einwilligung jederzeit mit Wirkung für die Zukunft zu widerrufen, ohne dass die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung berührt wird.</p>
<p class="document-paragraph">Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.</p></div>
<div class="document-section"><h2>§ 8 Freiwilligkeit und Widerruf</h2>
<p class="document-paragraph">Die Erteilung dieser Einwilligung ist freiwillig. Ohne Einwilligung können Leistungen nur insoweit erbracht werden, als eine Verarbeitung auf anderen Rechtsgrundlagen (z. B. Vertrag, gesetzliche Pflicht) gestützt werden kann. Ein Widerruf ist schriftlich oder in Textform möglich.</p></div>
<div class="document-section"><h2>§ 9 Einwilligungserklärung</h2>
<p class="document-paragraph">Ich, {{client.full_name}}, willige hiermit ausdrücklich ein, dass der Leistungserbringer {{tenant.name}} meine personenbezogenen Daten — einschließlich Gesundheitsdaten im Sinne von Art. 9 DSGVO, soweit für die Leistungserbringung, Dokumentation, Qualitätssicherung und Abrechnung erforderlich — zu den unter § 2 genannten Zwecken verarbeitet und an die unter § 5 genannten Empfänger übermittelt.</p>
<p class="document-paragraph">Mir ist bekannt, dass ich diese Einwilligung jederzeit widerrufen kann.</p></div>
${sigBlock({ client: true })}
<p class="document-footer-note">Systemvorlage — vom Mandanten prüfbar. Keine automatische Rechtsberatung.</p>`,
    plainTextContent: 'Umfassende Einwilligung zur Verarbeitung personenbezogener Daten gemäß DSGVO inkl. Gesundheitsdaten.',
    placeholderSchema: {
      ...COMMON_PLACEHOLDERS,
      'cost_carrier.care_fund_name': { label: 'Pflegekasse', required: false },
      'cost_carrier.care_fund_ik': { label: 'Pflegekassen-IK', required: false },
      'cost_carrier.health_insurance_name': { label: 'Krankenkasse', required: false },
    },
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),

  makeTemplate({
    templateKey: 'assignment_declaration_care_health_insurance',
    title: 'Abtretungserklärung / Direktabrechnung',
    documentType: 'assignment_declaration',
    serviceType: null,
    version: 2,
    isRequired: false,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Abtretungserklärung und Erteilung eines Zahlungsauftrags', 'zur Direktabrechnung mit der Pflegekasse gemäß § 13 Abs. 3 SGB XI i. V. m. § 13 SGB V')}
${partiesBlock()}
<div class="document-section"><h2>§ 1 Erklärung zur Anspruchsabtretung</h2>
<p class="document-paragraph">Ich, {{client.salutation}} {{client.full_name}}, geboren am {{client.date_of_birth}}, wohnhaft {{client.street}}, {{client.zip}} {{client.city}}, trete hiermit unwiderruflich — bis auf weiteres und unter Vorbehalt des Widerrufs gemäß § 7 — sämtliche Ansprüche auf Erstattung von Pflege- und Betreuungsleistungen, die mir gegenüber der Pflegekasse <strong>{{cost_carrier.care_fund_name}}</strong> (Institutionskennzeichen: {{cost_carrier.care_fund_ik}}) zustehen, an den Leistungserbringer <strong>{{tenant.name}}</strong> ab.</p></div>
<div class="document-section"><h2>§ 2 Umfang der abgetretenen Ansprüche</h2>
<p class="document-paragraph">Die Abtretung umfasst insbesondere Ansprüche auf:</p>
<ul class="document-paragraph">
<li>Pflegesachleistungen gemäß SGB XI entsprechend Pflegegrad {{care.level}};</li>
<li>Entlastungsbetrag gemäß § 45b SGB XI;</li>
<li>Verhinderungspflege gemäß § 39 SGB XI, soweit in Anspruch genommen;</li>
<li>Umwandlungsansprüche gemäß § 45a SGB XI, soweit vereinbart und genehmigt;</li>
<li>Weitere erstattungsfähige Leistungen im Rahmen der vereinbarten Abrechnungsart: {{billing.types}}.</li>
</ul>
<p class="document-paragraph">Abgetreten werden ausschließlich Ansprüche für tatsächlich erbrachte und ordnungsgemäß dokumentierte Leistungen ab Leistungsbeginn {{contract.service_start}}.</p></div>
<div class="document-section"><h2>§ 3 Zahlungsauftrag / Direktabrechnung</h2>
<p class="document-paragraph">Ich bevollmächtige {{tenant.name}}, Rechnungen und Abrechnungsdatensätze unmittelbar bei meiner Pflegekasse einzureichen und Zahlungen an sich zu leiten. Meine Versichertennummer lautet: {{client.insurance_number}}.</p>
<p class="document-paragraph">Ich verpflichte mich, den Leistungserbringer unverzüglich über Änderungen des Pflegegrades, des Kostenträgers oder der Versicherungsverhältnisse zu informieren.</p></div>
<div class="document-section"><h2>§ 4 Leistungsnachweise und Budgetrahmen</h2>
<p class="document-paragraph">Die Abrechnung erfolgt auf Grundlage ordnungsgemäßer Leistungsnachweise. Der Leistungserbringer weist mich darauf hin, dass Leistungen nur im Rahmen der bewilligten Budgets und Leistungsansprüche abgerechnet werden können. Nicht gedeckte Kosten (Eigenanteile, Zusatzleistungen, nicht erstattungsfähige Leistungen) sind von mir als Selbstzahler zu tragen.</p></div>
<div class="document-section"><h2>§ 5 Nicht gedeckte Kosten</h2>
<p class="document-paragraph">Kosten, die nicht oder nicht vollständig von der Pflegekasse übernommen werden, werden mir gesondert in Rechnung gestellt. Der Stundensatz für Selbstzahlerleistungen beträgt, soweit vereinbart: {{billing.hourly_rate}} EUR.</p></div>
<div class="document-section"><h2>§ 6 Widerruf</h2>
<p class="document-paragraph">Diese Abtretungserklärung kann jederzeit schriftlich widerrufen werden. Der Widerruf wird erst wirksam, wenn er dem Leistungserbringer zugegangen ist. Bis zum Wirksamwerden des Widerrufs erbrachte Leistungen bleiben von der Abtretung erfasst.</p></div>
<div class="document-section"><h2>§ 7 Bestätigung</h2>
<p class="document-paragraph">Ich bestätige, dass mir der Inhalt dieser Erklärung erläutert wurde und ich die Rechtsfolgen der Anspruchsabtretung verstanden habe.</p></div>
${sigBlock({ client: true })}`,
    plainTextContent: 'Abtretungserklärung und Zahlungsauftrag zur Direktabrechnung mit der Pflegekasse.',
    placeholderSchema: {
      ...COMMON_PLACEHOLDERS,
      'cost_carrier.care_fund_name': { label: 'Pflegekasse', required: true },
      'cost_carrier.care_fund_ik': { label: 'Pflegekassen-IK', required: false },
      'client.insurance_number': { label: 'Versichertennummer', required: true },
      'care.level': { label: 'Pflegegrad', required: true },
      'contract.service_start': { label: 'Leistungsbeginn', required: true },
      'billing.types': { label: 'Abrechnungsart', required: false },
      'billing.hourly_rate': { label: 'Stundensatz', required: false },
    },
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),

  makeTemplate({
    templateKey: 'client_contract_assist',
    title: 'Kundenvertrag Alltagsbegleitung / Betreuung',
    documentType: 'client_contract',
    serviceType: 'assist',
    version: 2,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Versorgungsvertrag — Alltagsbegleitung und Betreuung', 'Individuelle Unterstützung im Alltag')}
${partiesBlock()}
<div class="document-section"><h2>§ 1 Vertragsparteien und Vertragsgegenstand</h2>
<p class="document-paragraph">Zwischen dem Leistungserbringer {{tenant.name}} (Auftragnehmer) und {{client.full_name}} (Auftraggeber:in / zu betreuende Person) wird folgender Versorgungsvertrag über Alltagsbegleitung, haushaltsnahe Unterstützung und soziale Betreuung geschlossen.</p></div>
<div class="document-section"><h2>§ 2 Leistungsumfang</h2>
<p class="document-paragraph">Der Leistungsumfang umfasst — nach individueller Bedarfserhebung — insbesondere:</p>
<ul class="document-paragraph">
<li>Begleitung bei Terminen, Einkäufen und Behördengängen;</li>
<li>Unterstützung bei der Tagesstrukturierung und Aktivitätsförderung;</li>
<li>Haushaltsnahe Hilfe (keine haushaltswirtschaftliche Vollversorgung im Sinne der Pflegeversicherung);</li>
<li>Gesprächsbegleitung, Anleitung und Motivation im Alltag;</li>
<li>Dokumentation der erbrachten Leistungen gemäß vereinbartem Leistungsnachweis.</li>
</ul>
<p class="document-paragraph">Medizinische, pflegerische Behandlungsmaßnahmen sind ausdrücklich nicht Bestandteil dieses Vertrages, sofern nicht gesondert vereinbart.</p></div>
<div class="document-section"><h2>§ 3 Leistungsbeginn und Einsatzort</h2>
<p class="document-paragraph">Der Leistungsbeginn ist der {{contract.service_start}}. Die Leistungen werden überwiegend in der Wohnung der Klient:in bzw. am vereinbarten Einsatzort erbracht.</p></div>
<div class="document-section"><h2>§ 4 Mitwirkungspflichten der Klient:in</h2>
<p class="document-paragraph">Die Klient:in stellt den Zugang zur Wohnung sicher, erteilt relevante Auskünfte zu Gesundheits- und Versorgungsbedarf und informiert den Leistungserbringer über Terminänderungen, Krankenhausaufenthalte und sonstige relevante Ereignisse unverzüglich.</p></div>
<div class="document-section"><h2>§ 5 Termine, Absagen und Vertretung</h2>
<p class="document-paragraph">Termine werden im gegenseitigen Einvernehmen vereinbart. Absagen sind mindestens 24 Stunden vor dem Termin mitzuteilen, sofern keine kürzere Frist aus billigen Gründen ausreichend ist. Bei kurzfristiger Absage können Ausfallpauschalen berechnet werden, soweit vertraglich vereinbart.</p></div>
<div class="document-section"><h2>§ 6 Dokumentation</h2>
<p class="document-paragraph">Der Leistungserbringer dokumentiert die erbrachten Leistungen in seinem Dokumentationssystem. Die Klient:in erhält auf Wunsch Auskunft über dokumentierte Leistungen.</p></div>
<div class="document-section"><h2>§ 7 Datenschutz und Schweigepflicht</h2>
<p class="document-paragraph">Die Verarbeitung personenbezogener Daten erfolgt gemäß der gesonderten Datenschutz-Einwilligung und den gesetzlichen Vorgaben. Mitarbeitende unterliegen der gesetzlichen Schweigepflicht (§ 203 StGB).</p></div>
<div class="document-section"><h2>§ 8 Abrechnung und Kostenträger</h2>
<p class="document-paragraph">Abrechnung erfolgt über {{billing.types}}. Kostenträger: {{cost_carrier.primary_name}}. Stundensatz: {{billing.hourly_rate}} EUR (netto zzgl. gesetzlicher Umsatzsteuer, sofern anwendbar). Zahlungsziel: 14 Tage nach Rechnungsstellung, sofern keine Direktabrechnung mit Kostenträger vereinbart ist.</p></div>
<div class="document-section"><h2>§ 9 Haftung und Leistungsgrenzen</h2>
<p class="document-paragraph">Der Leistungserbringer haftet für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie bei Vorsatz und grober Fahrlässigkeit unbeschränkt. Im Übrigen ist die Haftung auf vorhersehbare, vertragstypische Schäden begrenzt. Höhere Gewalt und unverschuldete Verhinderung befreien vorübergehend von der Leistungspflicht.</p></div>
<div class="document-section"><h2>§ 10 Notfall</h2>
<p class="document-paragraph">In Notfällen verständigt der Leistungserbringer die Rettungsdienste und — sofern vorhanden — die benannte Notfallkontaktperson: {{emergency.name}} (Tel. {{emergency.phone}}).</p></div>
<div class="document-section"><h2>§ 11 Kündigung</h2>
<p class="document-paragraph">Der Vertrag kann von beiden Seiten mit einer Frist von 4 Wochen zum Monatsende gekündigt werden. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.</p></div>
<div class="document-section"><h2>§ 12 Schlussbestimmungen</h2>
<p class="document-paragraph">Änderungen und Ergänzungen bedürfen der Schriftform. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Regelungen unberührt. Es gilt deutsches Recht.</p></div>
${sigBlock({ client: true, employee: true })}`,
    plainTextContent: 'Versorgungsvertrag Alltagsbegleitung und Betreuung mit Leistungsumfang, Abrechnung und Kündigung.',
    placeholderSchema: {
      ...COMMON_PLACEHOLDERS,
      'contract.service_start': { label: 'Leistungsbeginn', required: true },
      'billing.types': { label: 'Abrechnungsart', required: false },
      'billing.hourly_rate': { label: 'Stundensatz', required: false },
      'cost_carrier.primary_name': { label: 'Kostenträger', required: false },
      'emergency.name': { label: 'Notfallkontakt', required: false },
      'emergency.phone': { label: 'Notfall-Telefon', required: false },
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
    version: 2,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Versorgungsvertrag — Ambulante Pflege', 'gemäß SGB XI')}
${partiesBlock()}
<div class="document-section"><h2>§ 1 Vertragsparteien und Vertragsgegenstand</h2>
<p class="document-paragraph">Zwischen {{tenant.name}} als zugelassenem Pflegedienst und {{client.full_name}} wird ein Versorgungsvertrag über ambulante Pflegeleistungen gemäß Sozialgesetzbuch XI geschlossen.</p></div>
<div class="document-section"><h2>§ 2 Leistungsumfang und Pflegegrad</h2>
<p class="document-paragraph">Der Leistungsumfang richtet sich nach dem festgestellten Pflegegrad {{care.level}}, dem individuellen Pflegebedarf, dem Pflegeplan und den Leistungskomplexen der Pflegeversicherung. Pflegekasse: {{cost_carrier.care_fund_name}}.</p>
<p class="document-paragraph">Erbracht werden können insbesondere: Grundpflege, behandlungspflegerische Maßnahmen (soweit verordnet), hauswirtschaftliche Versorgung im Rahmen der Ansprüche, Betreuungsleistungen und Anleitung pflegender Angehöriger.</p></div>
<div class="document-section"><h2>§ 3 Leistungsbeginn und Einsatzplanung</h2>
<p class="document-paragraph">Leistungsbeginn: {{contract.service_start}}. Einsätze werden nach Bedarf, ärztlicher Verordnung und Vereinbarung geplant. Änderungen des Pflegebedarfs werden durch regelmäßige Pflegevisiten und Anpassung des Pflegeplans berücksichtigt.</p></div>
<div class="document-section"><h2>§ 4 Mitwirkung und Zugang</h2>
<p class="document-paragraph">Die Klient:in gewährt Zugang zur Wohnung, stellt erforderliche Hilfsmittel bereit und informiert über relevante gesundheitliche Veränderungen, Krankenhausaufenthalte und Medikationsänderungen.</p></div>
<div class="document-section"><h2>§ 5 Termine, Absagen und Vertretung</h2>
<p class="document-paragraph">Fixierte Einsatzzeiten werden vereinbart. Bei Absagen gelten die Regelungen des Pflegevertragsrechts und der Betriebsabläufe des Pflegedienstes. Vertretungen werden durch qualifiziertes Personal sichergestellt, soweit möglich.</p></div>
<div class="document-section"><h2>§ 6 Dokumentation und Qualität</h2>
<p class="document-paragraph">Alle Pflegeleistungen werden dokumentationspflichtig im Pflegedokumentationssystem erfasst. Der Pflegedienst weist qualifiziertes, regelmäßig fortgebildetes Personal ein und unterliegt den Anforderungen des SGB XI und der MDK-Prüfungen.</p></div>
<div class="document-section"><h2>§ 7 Datenschutz und Schweigepflicht</h2>
<p class="document-paragraph">Die Verarbeitung personenbezogener und Gesundheitsdaten erfolgt gemäß DSGVO und der Datenschutz-Einwilligung. Alle Mitarbeitenden unterliegen der Schweigepflicht nach § 203 StGB.</p></div>
<div class="document-section"><h2>§ 8 Abrechnung und Kostenträger</h2>
<p class="document-paragraph">Abrechnung über {{billing.types}} mit der Pflegekasse {{cost_carrier.care_fund_name}}, sofern eine wirksame Abtretungserklärung vorliegt. Eigenanteile und nicht erstattungsfähige Leistungen trägt die Klient:in als Selbstzahler.</p></div>
<div class="document-section"><h2>§ 9 Haftung und Leistungsgrenzen</h2>
<p class="document-paragraph">Es gelten die gesetzlichen Haftungsregelungen. Der Pflegedienst haftet nicht für Schäden, die durch unzureichende Mitwirkung, unterlassene Information oder höhere Gewalt entstehen. Notfallmedizinische Versorgung obliegt dem Rettungsdienst.</p></div>
<div class="document-section"><h2>§ 10 Notfall</h2>
<p class="document-paragraph">Im Notfall wird der Rettungsdienst (112) verständigt und die Notfallkontaktperson {{emergency.name}} ({{emergency.phone}}) informiert.</p></div>
<div class="document-section"><h2>§ 11 Kündigung</h2>
<p class="document-paragraph">Kündigungsfrist: 4 Wochen zum Monatsende, sofern nicht gesetzliche Sonderregelungen greifen. Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt.</p></div>
<div class="document-section"><h2>§ 12 Schlussbestimmungen</h2>
<p class="document-paragraph">Schriftform für Änderungen. Es gilt deutsches Recht. Gerichtsstand am Sitz des Pflegedienstes, soweit zulässig.</p></div>
${sigBlock({ client: true, employee: true })}`,
    plainTextContent: 'Versorgungsvertrag ambulante Pflege gemäß SGB XI mit Pflegegrad, Dokumentation und Abrechnung.',
    placeholderSchema: {
      ...COMMON_PLACEHOLDERS,
      'care.level': { label: 'Pflegegrad', required: true },
      'cost_carrier.care_fund_name': { label: 'Pflegekasse', required: true },
      'contract.service_start': { label: 'Leistungsbeginn', required: true },
      'billing.types': { label: 'Abrechnungsart', required: false },
      'emergency.name': { label: 'Notfallkontakt', required: false },
      'emergency.phone': { label: 'Notfall-Telefon', required: false },
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
    version: 2,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Versorgungsvertrag — Stationäre Pflege / Vollstationäre Versorgung', 'gemäß HeimG und SGB XI')}
${partiesBlock()}
<div class="document-section"><h2>§ 1 Vertragsparteien und Vertragsgegenstand</h2>
<p class="document-paragraph">Zwischen {{tenant.name}} als Träger der Einrichtung und {{client.full_name}} wird ein Versorgungsvertrag über stationäre Pflege und Unterbringung geschlossen.</p></div>
<div class="document-section"><h2>§ 2 Unterbringung</h2>
<p class="document-paragraph">{{client.full_name}} wird in der Einrichtung <strong>{{facility.name}}</strong>, Wohnbereich {{facility.care_area}}, Zimmer-Nr. {{facility.room_number}} untergebracht. Der Einzug erfolgt am {{contract.service_start}}.</p></div>
<div class="document-section"><h2>§ 3 Leistungsumfang</h2>
<p class="document-paragraph">Erbracht werden stationäre Pflege- und Betreuungsleistungen entsprechend Pflegegrad {{care.level}}, der Heimvereinbarung und dem individuellen Pflegeplan, einschließlich Grundpflege, Behandlungspflege (soweit verordnet), sozialer Betreuung, Verpflegung und Unterkunft gemäß Leistungsvereinbarung.</p></div>
<div class="document-section"><h2>§ 4 Mitwirkung und Mitbringen</h2>
<p class="document-paragraph">Die Klient:in bringt persönliche Gegenstände, Kleidung und — soweit erforderlich — Hilfsmittel mit. Medizinische und pflegerelevante Informationen sind vollständig mitzuteilen.</p></div>
<div class="document-section"><h2>§ 5 Dokumentation und Qualität</h2>
<p class="document-paragraph">Die Einrichtung dokumentiert alle Pflegeleistungen gemäß Heimgesetz und SGB XI. Qualitätsmanagement und regelmäßige Fortbildungen sind gewährleistet.</p></div>
<div class="document-section"><h2>§ 6 Datenschutz und Schweigepflicht</h2>
<p class="document-paragraph">Datenverarbeitung gemäß DSGVO und gesonderter Einwilligung. Alle Mitarbeitenden unterliegen der Schweigepflicht nach § 203 StGB.</p></div>
<div class="document-section"><h2>§ 7 Entgelt, Abrechnung und Kostenträger</h2>
<p class="document-paragraph">Abrechnung über {{billing.types}}. Pflegekasse: {{cost_carrier.care_fund_name}}. Investitionskosten, Unterkunft und Verpflegung sowie Eigenanteile werden gemäß Heimvereinbarung und gesetzlichen Regelungen berechnet.</p></div>
<div class="document-section"><h2>§ 8 Haftung</h2>
<p class="document-paragraph">Es gelten die gesetzlichen Haftungsvorschriften des Bürgerlichen Gesetzbuches und des Heimgesetzes. Haftung für leichte Fahrlässigkeit ist — außer bei Verletzung wesentlicher Vertragspflichten — ausgeschlossen, soweit gesetzlich zulässig.</p></div>
<div class="document-section"><h2>§ 9 Notfall</h2>
<p class="document-paragraph">Notfallkontakt: {{emergency.name}}, Tel. {{emergency.phone}}. Medizinische Notfälle werden über die Einrichtungsorganisation und den Rettungsdienst abgewickelt.</p></div>
<div class="document-section"><h2>§ 10 Kündigung und Vertragsende</h2>
<p class="document-paragraph">Kündigungsfristen gemäß Heimrecht und individueller Heimvereinbarung. Bei Vertragsende ist die Wohnung innerhalb der vereinbarten Frist zu räumen.</p></div>
<div class="document-section"><h2>§ 11 Schlussbestimmungen</h2>
<p class="document-paragraph">Neben diesem Vertrag gelten die Heimvereinbarung, die Hausordnung und die gesetzlichen Bestimmungen. Änderungen bedürfen der Schriftform.</p></div>
${sigBlock({ client: true, employee: true })}`,
    plainTextContent: 'Versorgungsvertrag stationäre Pflege mit Unterbringung, Leistungsumfang und Abrechnung.',
    placeholderSchema: {
      ...COMMON_PLACEHOLDERS,
      'facility.name': { label: 'Einrichtung', required: true },
      'facility.care_area': { label: 'Wohnbereich', required: false },
      'facility.room_number': { label: 'Zimmernummer', required: false },
      'care.level': { label: 'Pflegegrad', required: true },
      'contract.service_start': { label: 'Einzugsdatum', required: true },
      'cost_carrier.care_fund_name': { label: 'Pflegekasse', required: false },
      'billing.types': { label: 'Abrechnungsart', required: false },
      'emergency.name': { label: 'Notfallkontakt', required: false },
      'emergency.phone': { label: 'Notfall-Telefon', required: false },
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
    version: 2,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Beratungsvereinbarung — Pflegeberatung nach § 7a SGB XI', 'Individuelle Beratung und Versorgungsplanung')}
${partiesBlock()}
<div class="document-section"><h2>§ 1 Vertragsgegenstand</h2>
<p class="document-paragraph">Der Leistungserbringer {{tenant.name}} erbringt für {{client.full_name}} Pflegeberatung nach § 7a SGB XI. Beratungsanlass: {{consulting.reason}}. Beratungsart: {{consulting.type}}.</p></div>
<div class="document-section"><h2>§ 2 Leistungsumfang</h2>
<p class="document-paragraph">Die Beratung umfasst insbesondere: Ermittlung des Pflegebedarfs, Information über Leistungsansprüche der Pflegeversicherung, Hilfestellung bei Antragsstellung, Entwicklung eines Versorgungsplans, Beratung pflegender Angehöriger sowie Nachbetreuung im vereinbarten Umfang.</p></div>
<div class="document-section"><h2>§ 3 Leistungsbeginn und Durchführung</h2>
<p class="document-paragraph">Beratungsbeginn: {{contract.service_start}}. Die Beratung erfolgt in der Regel in der Häuslichkeit der Klient:in, telefonisch oder in den Räumen des Leistungserbringers — nach Vereinbarung.</p></div>
<div class="document-section"><h2>§ 4 Mitwirkung</h2>
<p class="document-paragraph">Die Klient:in stellt alle für die Beratung erforderlichen Unterlagen (Pflegebescheid, Arztberichte, Anträge) zur Verfügung und erteilt vollständige Auskünfte zum Pflege- und Versorgungsbedarf.</p></div>
<div class="document-section"><h2>§ 5 Dokumentation</h2>
<p class="document-paragraph">Beratungsgespräche und Ergebnisse werden gemäß § 7a SGB XI dokumentiert. Ein schriftlicher Beratungsnachweis wird erstellt, soweit gesetzlich vorgesehen.</p></div>
<div class="document-section"><h2>§ 6 Datenschutz und Schweigepflicht</h2>
<p class="document-paragraph">Verarbeitung personenbezogener und Gesundheitsdaten gemäß DSGVO. Schweigepflicht nach § 203 StGB.</p></div>
<div class="document-section"><h2>§ 7 Vergütung und Abrechnung</h2>
<p class="document-paragraph">Abrechnung über {{billing.types}} mit der Pflegekasse {{cost_carrier.care_fund_name}}, sofern ein Anspruch auf Pflegeberatung nach § 7a SGB XI besteht. Andernfalls erfolgt die Abrechnung als Selbstzahlerleistung.</p></div>
<div class="document-section"><h2>§ 8 Haftung</h2>
<p class="document-paragraph">Der Leistungserbringer haftet für Schäden aus vorsätzlichem oder grob fahrlässigem Verhalten. Die Beratung ersetzt keine medizinische Diagnose oder Therapie.</p></div>
<div class="document-section"><h2>§ 9 Kündigung</h2>
<p class="document-paragraph">Beide Parteien können den Vertrag mit einer Frist von 2 Wochen kündigen. Bereits erbrachte Beratungsleistungen werden abgerechnet.</p></div>
<div class="document-section"><h2>§ 10 Schlussbestimmungen</h2>
<p class="document-paragraph">Änderungen bedürfen der Schriftform. Es gilt deutsches Recht.</p></div>
${sigBlock({ client: true, employee: true })}`,
    plainTextContent: 'Beratungsvereinbarung Pflegeberatung nach § 7a SGB XI.',
    placeholderSchema: {
      ...COMMON_PLACEHOLDERS,
      'consulting.reason': { label: 'Beratungsanlass', required: true },
      'consulting.type': { label: 'Beratungsart', required: false },
      'contract.service_start': { label: 'Beratungsbeginn', required: true },
      'cost_carrier.care_fund_name': { label: 'Pflegekasse', required: false },
      'billing.types': { label: 'Abrechnungsart', required: false },
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
    version: 2,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Versorgungsvertrag — Tagespflege', 'gemäß § 41 SGB XI')}
${partiesBlock()}
<div class="document-section"><h2>§ 1 Vertragsgegenstand</h2>
<p class="document-paragraph">Zwischen {{tenant.name}} und {{client.full_name}} wird ein Vertrag über teilstationäre Tagespflege gemäß § 41 SGB XI geschlossen.</p></div>
<div class="document-section"><h2>§ 2 Leistungsumfang</h2>
<p class="document-paragraph">Tagespflegeleistungen für Pflegegrad {{care.level}} einschließlich Grundpflege, Behandlungspflege (soweit verordnet), sozialer Betreuung, Aktivierung und Verpflegung während des Tagespflegeaufenthalts.</p></div>
<div class="document-section"><h2>§ 3 Leistungszeiten und Beförderung</h2>
<p class="document-paragraph">Leistungsbeginn: {{contract.service_start}}. Die Tagespflegezeiten werden individuell vereinbart. Beförderung zur Tagespflegeeinrichtung ist — soweit nicht gesondert vereinbart — nicht Bestandteil dieses Vertrages.</p></div>
<div class="document-section"><h2>§ 4 Mitwirkung</h2>
<p class="document-paragraph">Die Klient:in wird pünktlich gebracht und abgeholt bzw. nutzt vereinbarte Fahrdienste. Medizinische Veränderungen sind mitzuteilen.</p></div>
<div class="document-section"><h2>§ 5 Dokumentation</h2>
<p class="document-paragraph">Tagespflegeleistungen werden täglich dokumentiert. Auf Wunsch erfolgt Rücksprache mit Angehörigen oder ambulantem Pflegedienst.</p></div>
<div class="document-section"><h2>§ 6 Datenschutz und Schweigepflicht</h2>
<p class="document-paragraph">DSGVO-konforme Datenverarbeitung. Schweigepflicht nach § 203 StGB.</p></div>
<div class="document-section"><h2>§ 7 Abrechnung</h2>
<p class="document-paragraph">Abrechnung über {{billing.types}} mit {{cost_carrier.care_fund_name}}. Zuzahlungen und Eigenanteile trägt die Klient:in.</p></div>
<div class="document-section"><h2>§ 8 Haftung und Notfall</h2>
<p class="document-paragraph">Haftung gemäß gesetzlichen Vorschriften. Notfallkontakt: {{emergency.name}} ({{emergency.phone}}).</p></div>
<div class="document-section"><h2>§ 9 Kündigung</h2>
<p class="document-paragraph">Kündigungsfrist: 4 Wochen zum Monatsende.</p></div>
<div class="document-section"><h2>§ 10 Schlussbestimmungen</h2>
<p class="document-paragraph">Schriftform für Änderungen. Deutsches Recht.</p></div>
${sigBlock({ client: true, employee: true })}`,
    plainTextContent: 'Versorgungsvertrag Tagespflege gemäß § 41 SGB XI.',
    placeholderSchema: {
      ...COMMON_PLACEHOLDERS,
      'care.level': { label: 'Pflegegrad', required: true },
      'contract.service_start': { label: 'Leistungsbeginn', required: true },
      'billing.types': { label: 'Abrechnungsart', required: false },
      'cost_carrier.care_fund_name': { label: 'Pflegekasse', required: false },
      'emergency.name': { label: 'Notfallkontakt', required: false },
      'emergency.phone': { label: 'Notfall-Telefon', required: false },
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
    version: 2,
    isRequired: true,
    requiresClientSignature: true,
    requiresEmployeeSignature: true,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Versorgungsvertrag — Entlastungsleistungen', 'gemäß § 45b SGB XI')}
${partiesBlock()}
<div class="document-section"><h2>§ 1 Vertragsgegenstand</h2>
<p class="document-paragraph">Vertrag über Entlastungsleistungen gemäß § 45b SGB XI zwischen {{tenant.name}} und {{client.full_name}} (Pflegegrad {{care.level}}).</p></div>
<div class="document-section"><h2>§ 2 Leistungsumfang</h2>
<p class="document-paragraph">Erbringung von Leistungen zur Entlastung pflegender Angehöriger, insbesondere: Betreuungsleistungen, Unterstützung im Alltag, Anleitung und entlastende Tätigkeiten im Sinne des § 45b SGB XI — im vereinbarten monatlichen Budgetrahmen.</p></div>
<div class="document-section"><h2>§ 3 Leistungsbeginn</h2>
<p class="document-paragraph">Leistungsbeginn: {{contract.service_start}}. Der monatliche Entlastungsbetrag richtet sich nach dem gesetzlichen Anspruch für Pflegegrad {{care.level}}.</p></div>
<div class="document-section"><h2>§ 4 Mitwirkung und Abrechnungsgrenzen</h2>
<p class="document-paragraph">Leistungen werden nur im Rahmen des verfügbaren Entlastungsbudgets erbracht und abgerechnet. Nicht genutztes Budget verfällt am Monatsende, soweit gesetzlich vorgesehen.</p></div>
<div class="document-section"><h2>§ 5 Dokumentation</h2>
<p class="document-paragraph">Leistungsnachweise werden monatlich geführt und der Pflegekasse vorgelegt.</p></div>
<div class="document-section"><h2>§ 6 Datenschutz</h2>
<p class="document-paragraph">Verarbeitung gemäß DSGVO und Datenschutz-Einwilligung.</p></div>
<div class="document-section"><h2>§ 7 Abrechnung</h2>
<p class="document-paragraph">Abrechnung über {{billing.types}} mit {{cost_carrier.care_fund_name}} bei Vorliegen einer Abtretungserklärung.</p></div>
<div class="document-section"><h2>§ 8 Kündigung</h2>
<p class="document-paragraph">Kündigungsfrist: 4 Wochen zum Monatsende.</p></div>
<div class="document-section"><h2>§ 9 Schlussbestimmungen</h2>
<p class="document-paragraph">Schriftform für Änderungen. Deutsches Recht.</p></div>
${sigBlock({ client: true, employee: true })}`,
    plainTextContent: 'Versorgungsvertrag Entlastungsleistungen gemäß § 45b SGB XI.',
    placeholderSchema: {
      ...COMMON_PLACEHOLDERS,
      'care.level': { label: 'Pflegegrad', required: true },
      'contract.service_start': { label: 'Leistungsbeginn', required: true },
      'billing.types': { label: 'Abrechnungsart', required: false },
      'cost_carrier.care_fund_name': { label: 'Pflegekasse', required: false },
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
    version: 2,
    isRequired: false,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Schweigepflichtentbindungserklärung', 'Entbindung von der ärztlichen Schweigepflicht — § 203 StGB')}
${partiesBlock()}
<div class="document-section"><h2>§ 1 Zweck</h2>
<p class="document-paragraph">Zur Sicherstellung einer ganzheitlichen Versorgungsplanung ist es erforderlich, dass behandelnde Ärzt:innen und der Leistungserbringer {{tenant.name}} relevante Gesundheitsinformationen austauschen dürfen.</p></div>
<div class="document-section"><h2>§ 2 Umfang der Entbindung</h2>
<p class="document-paragraph">Ich, {{client.full_name}}, entbinde hiermit meine behandelnden Ärzt:innen — insbesondere {{consulting.family_doctor}} — von der ärztlichen Schweigepflicht (§ 203 Abs. 1 Nr. 1 StGB) gegenüber dem Leistungserbringer {{tenant.name}} und dessen befugtem Personal.</p>
<p class="document-paragraph">Der Informationsaustausch umfasst Diagnosen, Medikation, Therapieempfehlungen, Pflegebedarf und verordnete Maßnahmen, soweit dies für die Planung und Durchführung der vereinbarten Leistungen erforderlich ist.</p></div>
<div class="document-section"><h2>§ 3 Dauer und Widerruf</h2>
<p class="document-paragraph">Diese Entbindung gilt bis auf schriftlichen Widerruf. Der Widerruf ist jederzeit möglich und wird mit Zugang beim Leistungserbringer wirksam.</p></div>
<div class="document-section"><h2>§ 4 Bestätigung</h2>
<p class="document-paragraph">Mir ist bekannt, dass die Entbindung freiwillig ist und ich ohne Entbindung Leistungen nur im Rahmen der mir mitgeteilten Informationen erhalten kann.</p></div>
${sigBlock({ client: true })}`,
    plainTextContent: 'Schweigepflichtentbindung gegenüber dem Leistungserbringer im Kontext von § 203 StGB.',
    placeholderSchema: {
      ...COMMON_PLACEHOLDERS,
      'consulting.family_doctor': { label: 'Hausarzt/Hausärztin', required: false },
    },
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),

  makeTemplate({
    templateKey: 'communication_consent_default',
    title: 'Kommunikationseinwilligung',
    documentType: 'additional_consent',
    serviceType: null,
    version: 2,
    isRequired: false,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Einwilligung zur elektronischen Kommunikation', 'E-Mail, SMS, Telefon und Messenger-Dienste')}
${partiesBlock()}
<div class="document-section"><h2>§ 1 Zweck und Kanäle</h2>
<p class="document-paragraph">Ich willige ein, dass {{tenant.name}} mich über folgende Kanäle zu organisatorischen und versorgungsrelevanten Mitteilungen kontaktieren darf:</p>
<ul class="document-paragraph">
<li>Telefon: {{client.phone}}</li>
<li>E-Mail: {{client.email}}</li>
<li>SMS/WhatsApp (sofern angegeben): {{client.phone}}</li>
<li>Portal-Nachrichten über das CareSuite-Klientenportal</li>
</ul></div>
<div class="document-section"><h2>§ 2 Inhalt der Kommunikation</h2>
<p class="document-paragraph">Mitteilungen betreffen Terminvereinbarungen, Einsatzänderungen, Leistungsinformationen, Rechnungsfragen und organisatorische Hinweise — keine medizinischen Notfalldiagnostics per unsicherem Kanal.</p></div>
<div class="document-section"><h2>§ 3 Dauer und Widerruf</h2>
<p class="document-paragraph">Die Einwilligung gilt bis auf Widerruf. Sie kann jederzeit schriftlich oder in Textform widerrufen werden.</p></div>
${sigBlock({ client: true })}`,
    plainTextContent: 'Einwilligung zur Kommunikation per E-Mail, SMS, Telefon und Portal.',
    placeholderSchema: {
      ...COMMON_PLACEHOLDERS,
      'client.phone': { label: 'Telefon', required: false },
      'client.email': { label: 'E-Mail', required: false },
    },
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),

  makeTemplate({
    templateKey: 'photo_media_consent_default',
    title: 'Foto- und Medien-Einwilligung',
    documentType: 'additional_consent',
    serviceType: null,
    version: 2,
    isRequired: false,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Einwilligung zur Foto- und Medienerfassung', 'Dokumentationszweck im geschützten System')}
${partiesBlock()}
<div class="document-section"><h2>§ 1 Zweck</h2>
<p class="document-paragraph">Im Rahmen der Versorgung können dokumentationsrelevante Fotos und Medien erforderlich sein (z. B. Wundverlauf, Hilfsmittelanpassung, Wohnsituation).</p></div>
<div class="document-section"><h2>§ 2 Umfang</h2>
<p class="document-paragraph">Ich willige ein, dass {{tenant.name}} solche Aufnahmen erstellt, im geschützten Dokumentensystem speichert und ausschließlich zu Versorgungs- und Dokumentationszwecken verwendet — nicht zu Werbezwecken.</p></div>
<div class="document-section"><h2>§ 3 Speicherdauer und Widerruf</h2>
<p class="document-paragraph">Speicherung gemäß gesetzlicher Aufbewahrungsfristen. Widerruf jederzeit möglich; bereits gespeicherte Medien werden nach Widerruf nicht mehr verwendet, soweit gesetzliche Aufbewahrungspflichten dem nicht entgegenstehen.</p></div>
${sigBlock({ client: true })}`,
    plainTextContent: 'Einwilligung zur Foto- und Medienerfassung zu Dokumentationszwecken.',
    placeholderSchema: COMMON_PLACEHOLDERS,
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),

  makeTemplate({
    templateKey: 'emergency_contact_consent_default',
    title: 'Einwilligung Notfallkontakt',
    documentType: 'additional_consent',
    serviceType: null,
    version: 2,
    isRequired: false,
    requiresClientSignature: true,
    requiresEmployeeSignature: false,
    requiresRepresentativeSignature: false,
    allowsCustomTemplate: true,
    htmlContent: `${docHeader('Einwilligung zur Kontaktaufnahme im Notfall', 'Benannte Notfallkontaktperson')}
${partiesBlock()}
<div class="document-section"><h2>§ 1 Einwilligung</h2>
<p class="document-paragraph">Im Notfall oder bei akuten Versorgungskrisen darf {{tenant.name}} unverzüglich folgende Person kontaktieren und über meinen Gesundheits- bzw. Versorgungszustand informieren:</p>
<p class="document-paragraph"><strong>{{emergency.name}}</strong><br/>Telefon: {{emergency.phone}}</p></div>
<div class="document-section"><h2>§ 2 Umfang der Information</h2>
<p class="document-paragraph">Übermittelt werden nur Informationen, die für die Notfallversorgung oder unmittelbare Entscheidungen erforderlich sind.</p></div>
<div class="document-section"><h2>§ 3 Widerruf</h2>
<p class="document-paragraph">Diese Einwilligung kann jederzeit widerrufen werden. Änderungen der Notfallkontaktperson teile ich dem Leistungserbringer unverzüglich mit.</p></div>
${sigBlock({ client: true })}`,
    plainTextContent: 'Einwilligung zur Kontaktaufnahme mit der Notfallkontaktperson.',
    placeholderSchema: {
      ...COMMON_PLACEHOLDERS,
      'emergency.name': { label: 'Notfallkontakt', required: true },
      'emergency.phone': { label: 'Notfall-Telefon', required: true },
    },
    signatureSlots: [{ role: 'client', placeholder: '{{signature.client}}', required: true }],
  }),
];

export function getSystemIntakeTemplateByKey(templateKey: string): IntakeDocumentTemplate | undefined {
  return INTAKE_DOCUMENT_SYSTEM_TEMPLATES.find((t) => t.templateKey === templateKey);
}
