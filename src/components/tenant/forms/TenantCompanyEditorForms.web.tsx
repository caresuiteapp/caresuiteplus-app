import { useId, type ReactNode } from 'react';
import { COMPANY_REGISTRATION_CATALOG } from '@/lib/catalogs/companyRegistrationCatalog';
import { COMPANY_CONTACT_FUNCTIONS } from '@/lib/catalogs/companyContactFunctionCatalog';
import { isUnreleasedModuleKey } from '@/lib/modules/constants';
import type { TenantCenterSectionKey, TenantCenterSnapshot, TenantModuleSettings } from '@/types/tenant/tenantCenter';
import { withoutCompanyRow, withPrimaryRow } from './companyEditorModel';

type FieldProps = {
  label: string; value: string; onChange: (value: string) => void;
  error?: string; hint?: string; required?: boolean; multiline?: boolean;
  type?: 'text' | 'email' | 'tel' | 'date'; options?: readonly string[]; wide?: boolean;
  quick?: { label: string; value: string }[]; inputMode?: 'text' | 'numeric' | 'decimal';
};

function Field({ label, value, onChange, error, hint, required, multiline, type = 'text', options, wide, quick, inputMode }: FieldProps) {
  const id = useId();
  const props = { id, value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    'aria-invalid': !!error, 'aria-describedby': error || hint ? `${id}-hint` : undefined, required, autoComplete: 'off', spellCheck: false };
  return <div className={`cs-company-field${wide ? ' cs-company-wide' : ''}`}>
    <label htmlFor={id}>{label}{required ? <span aria-hidden="true"> *</span> : null}</label>
    {multiline ? <textarea {...props} rows={3} /> : <input {...props} type={type} inputMode={inputMode} list={options ? `${id}-choices` : undefined} />}
    {options ? <datalist id={`${id}-choices`}>{options.map(option => <option key={option} value={option} />)}</datalist> : null}
    {error || hint ? <small id={`${id}-hint`} className={error ? 'cs-company-error-text' : ''}>{error ?? hint}</small> : null}
    {quick?.length ? <div className="cs-company-quick" aria-label={`Schnellauswahl für ${label}`}>{quick.map(option =>
      <button type="button" key={`${option.label}-${option.value}`} onClick={() => onChange(option.value)}>{option.label}</button>)}</div> : null}
  </div>;
}

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="cs-company-form-group"><header><h3>{title}</h3>{description ? <p>{description}</p> : null}</header><div className="cs-company-fields">{children}</div></section>;
}

type Props = { section: TenantCenterSectionKey; value: TenantCenterSnapshot; onChange: (value: TenantCenterSnapshot) => void; errors: Record<string, string> };

export function TenantCompanyEditorForms({ section, value, onChange, errors }: Props) {
  function patch<K extends keyof TenantCenterSnapshot>(key: K, next: Partial<TenantCenterSnapshot[K]>) {
    onChange({ ...value, [key]: { ...value[key] as object, ...next as object } });
  }
  const company = value.company;
  if (section === 'company') return <>
    <Group title="Name & Einordnung" description="Der rechtliche Name wird für die eindeutige Zuordnung Ihres Unternehmens verwendet.">
      <Field label="Firmenname" value={company.name} onChange={name => patch('company', { name })} required error={errors.name} />
      <Field label="Rechtlicher Name" value={company.legalName} onChange={legalName => patch('company', { legalName })} quick={company.name ? [{ label: 'Firmennamen übernehmen', value: company.name }] : undefined} />
      <Field label="Rechtsform" value={company.legalForm} onChange={legalForm => patch('company', { legalForm })} options={COMPANY_REGISTRATION_CATALOG.legal_form.map(row => row.label)} hint="Vorschlag auswählen oder eigene Angabe eintragen." />
      <Field label="Branche / Einrichtungstyp" value={company.industry} onChange={industry => patch('company', { industry })} options={COMPANY_REGISTRATION_CATALOG.industry.map(row => row.label)} />
    </Group>
    <Group title="Geschäftsanschrift">
      <Field label="Straße" value={company.street} onChange={street => patch('company', { street })} />
      <Field label="Hausnummer" value={company.houseNumber} onChange={houseNumber => patch('company', { houseNumber })} />
      <Field label="Postleitzahl" value={company.zip} onChange={zip => patch('company', { zip })} />
      <Field label="Ort" value={company.city} onChange={city => patch('company', { city })} />
      <Field label="Land" value={company.country} onChange={country => patch('company', { country })} options={['Deutschland', 'Österreich', 'Schweiz']} />
    </Group>
    <Group title="Allgemeine Erreichbarkeit">
      <Field label="Telefon" type="tel" value={company.phone} onChange={phone => patch('company', { phone })} />
      <Field label="Fax" type="tel" value={company.fax} onChange={fax => patch('company', { fax })} />
      <Field label="E-Mail" type="email" value={company.email} onChange={email => patch('company', { email })} error={errors.email} />
      <Field label="Website" value={company.website} onChange={website => patch('company', { website })} />
      <Field label="Interne Notizen" value={company.notes} onChange={notes => patch('company', { notes })} multiline wide />
    </Group>
  </>;
  if (section === 'legal') return <>
    <Group title="Betriebliche Absicherung">
      <Field label="Art der Haftpflichtversicherung" value={value.legal.liabilityInsurance} onChange={liabilityInsurance => patch('legal', { liabilityInsurance })} options={['Betriebshaftpflicht', 'Berufshaftpflicht', 'Betriebs- und Berufshaftpflicht']} />
      <Field label="Versicherer" value={value.legal.liabilityInsurer} onChange={liabilityInsurer => patch('legal', { liabilityInsurer })} />
      <Field label="Versicherungsnummer" value={value.legal.liabilityPolicyNumber} onChange={liabilityPolicyNumber => patch('legal', { liabilityPolicyNumber })} />
    </Group>
    <Group title="Mitgliedschaften">
      <Field label="Kammerzugehörigkeit" value={value.legal.chamberMembership} onChange={chamberMembership => patch('legal', { chamberMembership })} />
      <Field label="Berufsverband" value={value.legal.professionalAssociation} onChange={professionalAssociation => patch('legal', { professionalAssociation })} />
      <Field label="Anmerkungen" value={value.legal.legalNotes} onChange={legalNotes => patch('legal', { legalNotes })} multiline wide />
    </Group>
  </>;
  if (section === 'tax') return <>
    <Group title="Steuerliche Zuordnung">
      <Field label="Steuernummer" value={value.tax.taxNumber} onChange={taxNumber => patch('tax', { taxNumber })} />
      <Field label="Umsatzsteuer-ID" value={value.tax.vatId} onChange={vatId => patch('tax', { vatId })} error={errors.vatId} hint="Falls vorhanden. Deutsche Umsatzsteuer-ID mit DE und 9 Ziffern." />
      <Field label="Finanzamt" value={value.tax.taxOffice} onChange={taxOffice => patch('tax', { taxOffice })} />
    </Group>
    <Group title="Hinterlegte Steuerregelung">
      <div className="cs-company-field"><label htmlFor="company-tax-scheme">Steuerregelung</label><select id="company-tax-scheme" value={value.tax.taxScheme} onChange={event => patch('tax', { taxScheme: event.target.value as TenantCenterSnapshot['tax']['taxScheme'], kleinunternehmer: event.target.value === 'kleinunternehmer' })}>
        <option value="standard">Regelbesteuerung</option><option value="kleinunternehmer">Kleinunternehmerregelung</option><option value="exempt">Steuerbefreiung</option>
      </select></div>
      <label className="cs-company-toggle"><input type="checkbox" checked={value.tax.reverseCharge} onChange={event => patch('tax', { reverseCharge: event.target.checked })} /><span>Reverse-Charge-Verfahren hinterlegen</span></label>
      <Field label="Steuerhinweise" value={value.tax.taxNotes} onChange={taxNotes => patch('tax', { taxNotes })} multiline wide />
    </Group>
  </>;
  if (section === 'register') return <>
    <Group title="Registereintrag">
      <Field label="Registergericht" value={value.register.registerCourt} onChange={registerCourt => patch('register', { registerCourt })} />
      <Field label="Registernummer" value={value.register.registerNumber} onChange={registerNumber => patch('register', { registerNumber })} />
      <Field label="Registerart" value={value.register.registerType} onChange={registerType => patch('register', { registerType })} options={['HRB', 'HRA', 'Gesellschaftsregister', 'Vereinsregister', 'Genossenschaftsregister', 'Partnerschaftsregister']} />
      <Field label="Registerdatum" type="date" value={value.register.registerDate} onChange={registerDate => patch('register', { registerDate })} error={errors.registerDate} />
      <Field label="Stammkapital" value={value.register.shareCapital} onChange={shareCapital => patch('register', { shareCapital })} />
    </Group>
    <Group title="Zulassung & Aufsicht">
      <Field label="Institutionskennzeichen (IK)" value={value.register.ikNumber} onChange={ikNumber => patch('register', { ikNumber })} />
      <Field label="Aufsichtsbehörde" value={value.register.supervisoryAuthority} onChange={supervisoryAuthority => patch('register', { supervisoryAuthority })} />
      <Field label="Anmerkungen" value={value.register.registerNotes} onChange={registerNotes => patch('register', { registerNotes })} multiline wide />
    </Group>
  </>;
  if (section === 'contact') return <>
    <Group title="Kontaktwege" description="Allgemeine E-Mail und Telefon sind dieselben Angaben wie in den Unternehmensdaten.">
      <Field label="E-Mail für Abrechnung" type="email" value={value.contact.billingEmail} onChange={billingEmail => patch('contact', { billingEmail })} error={errors.billingEmail} quick={company.email ? [{ label: 'Unternehmens-E-Mail übernehmen', value: company.email }] : undefined} />
      <Field label="Allgemeine E-Mail" type="email" value={value.contact.supportEmail} onChange={supportEmail => patch('contact', { supportEmail })} error={errors.supportEmail} />
      <Field label="Allgemeines Telefon" type="tel" value={value.contact.supportPhone} onChange={supportPhone => patch('contact', { supportPhone })} />
    </Group>
    <div className="cs-company-list-head"><p>Ansprechpersonen für Rückfragen und die Zusammenarbeit.</p><button type="button" onClick={() => patch('contact', { contactPersons: [...value.contact.contactPersons, { firstName: '', lastName: '', role: '', email: '', phone: '', isPrimary: value.contact.contactPersons.length === 0 }] })}>+ Ansprechperson hinzufügen</button></div>
    {value.contact.contactPersons.map((row, index) => {
      const update = (next: Partial<typeof row>) => patch('contact', { contactPersons: value.contact.contactPersons.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item) });
      return <Group key={row.id ?? index} title={[row.firstName, row.lastName].filter(Boolean).join(' ') || `Ansprechperson ${index + 1}`}>
        <Field label="Vorname" value={row.firstName} onChange={firstName => update({ firstName })} error={errors[`contact.${index}.firstName`]} />
        <Field label="Nachname" value={row.lastName} onChange={lastName => update({ lastName })} />
        <Field label="Funktion" value={row.role} onChange={role => update({ role })} options={COMPANY_CONTACT_FUNCTIONS.map(item => item.label)} />
        <Field label="E-Mail" type="email" value={row.email} onChange={email => update({ email })} error={errors[`contact.${index}.email`]} />
        <Field label="Telefon" type="tel" value={row.phone} onChange={phone => update({ phone })} />
        <div className="cs-company-row-actions cs-company-wide"><label className="cs-company-toggle"><input type="radio" name="company-primary-contact" checked={row.isPrimary} onChange={() => patch('contact', { contactPersons: withPrimaryRow(value.contact.contactPersons, index) })} />Hauptkontakt</label><button className="cs-company-remove" type="button" onClick={() => patch('contact', { contactPersons: withoutCompanyRow(value.contact.contactPersons, index) })}>Ansprechperson entfernen</button></div>
      </Group>;
    })}
  </>;
  if (section === 'representatives') return <>
    <div className="cs-company-list-head"><p>Geschäftsführung und vertretungsberechtigte Personen.</p><button type="button" onClick={() => onChange({ ...value, representatives: [...value.representatives, { salutation: '', firstName: '', lastName: '', position: '', email: '', phone: '', isPrimary: value.representatives.length === 0, sortOrder: value.representatives.length }] })}>+ Person hinzufügen</button></div>
    {!value.representatives.length ? <p className="cs-company-empty">Noch keine Vertretung hinterlegt. Fügen Sie die erste Person hinzu.</p> : null}
    {value.representatives.map((row, index) => {
      const update = (next: Partial<typeof row>) => onChange({ ...value, representatives: value.representatives.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item) });
      return <Group key={row.id ?? index} title={[row.firstName, row.lastName].filter(Boolean).join(' ') || `Person ${index + 1}`}>
        <Field label="Anrede" value={row.salutation} onChange={salutation => update({ salutation })} options={['Frau', 'Herr', 'Keine Angabe']} />
        <Field label="Funktion" value={row.position} onChange={position => update({ position })} options={COMPANY_CONTACT_FUNCTIONS.map(item => item.label)} />
        <Field label="Vorname" value={row.firstName} onChange={firstName => update({ firstName })} error={errors[`representatives.${index}.firstName`]} />
        <Field label="Nachname" value={row.lastName} onChange={lastName => update({ lastName })} />
        <Field label="E-Mail" type="email" value={row.email} onChange={email => update({ email })} error={errors[`representatives.${index}.email`]} />
        <Field label="Telefon" type="tel" value={row.phone} onChange={phone => update({ phone })} />
        <div className="cs-company-row-actions cs-company-wide"><label className="cs-company-toggle"><input type="radio" name="company-primary-representative" checked={row.isPrimary} onChange={() => onChange({ ...value, representatives: withPrimaryRow(value.representatives, index) })} />Hauptvertretung</label><button className="cs-company-remove" type="button" onClick={() => onChange({ ...value, representatives: withoutCompanyRow(value.representatives, index) })}>Person entfernen</button></div>
      </Group>;
    })}
  </>;
  if (section === 'bank') return <>
    <div className="cs-company-list-head"><p>Konten für Ihr Unternehmen. Genau ein Konto kann als Hauptkonto markiert werden.</p><button type="button" onClick={() => onChange({ ...value, bankAccounts: [...value.bankAccounts, { label: '', accountHolder: '', bankName: '', iban: '', bic: '', isPrimary: value.bankAccounts.length === 0, sortOrder: value.bankAccounts.length }] })}>+ Konto hinzufügen</button></div>
    {!value.bankAccounts.length ? <p className="cs-company-empty">Noch keine Bankverbindung hinterlegt.</p> : null}
    {value.bankAccounts.map((row, index) => {
      const update = (next: Partial<typeof row>) => onChange({ ...value, bankAccounts: value.bankAccounts.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item) });
      return <Group key={row.id ?? index} title={row.label || `Bankverbindung ${index + 1}`}>
        <Field label="Bezeichnung" value={row.label} onChange={label => update({ label })} options={['Geschäftskonto', 'Abrechnungskonto', 'Rücklagenkonto']} />
        <Field label="Kontoinhaber" required error={errors[`bank.${index}.accountHolder`]} value={row.accountHolder} onChange={accountHolder => update({ accountHolder })} quick={company.legalName || company.name ? [{ label: 'Unternehmensnamen übernehmen', value: company.legalName || company.name }] : undefined} />
        <Field label="Bank" value={row.bankName} onChange={bankName => update({ bankName })} />
        <Field label="BIC" value={row.bic} onChange={bic => update({ bic })} error={errors[`bank.${index}.bic`]} />
        <Field label="IBAN" value={row.iban} onChange={iban => update({ iban })} error={errors[`bank.${index}.iban`]} wide required />
        <div className="cs-company-row-actions cs-company-wide"><label className="cs-company-toggle"><input type="radio" name="company-primary-account" checked={row.isPrimary} onChange={() => onChange({ ...value, bankAccounts: withPrimaryRow(value.bankAccounts, index) })} />Hauptkonto</label><button className="cs-company-remove" type="button" onClick={() => onChange({ ...value, bankAccounts: withoutCompanyRow(value.bankAccounts, index) })}>Konto entfernen</button></div>
      </Group>;
    })}
  </>;
  if (section === 'payment') return <>
    <Group title="Zahlungsfristen">
      <Field label="Zahlungsziel in Tagen" value={value.payment.paymentTermsDays} onChange={paymentTermsDays => patch('payment', { paymentTermsDays })} inputMode="numeric" error={errors.paymentTermsDays} quick={['7', '14', '30'].map(days => ({ label: `${days} Tage`, value: days }))} />
      <Field label="Mahnfrist in Tagen" value={value.payment.dunningAfterDays} onChange={dunningAfterDays => patch('payment', { dunningAfterDays })} inputMode="numeric" error={errors.dunningAfterDays} quick={['7', '14', '30'].map(days => ({ label: `${days} Tage`, value: days }))} />
      <Field label="Mahngebühr in Euro" value={value.payment.dunningFee} onChange={dunningFee => patch('payment', { dunningFee })} inputMode="decimal" error={errors.dunningFee} />
    </Group>
    <Group title="Rechnungstexte">
      <Field label="Rechnungspräfix" value={value.payment.invoicePrefix} onChange={invoicePrefix => patch('payment', { invoicePrefix })} hint="Vorsatz für Rechnungsnummern, sofern im Abrechnungsablauf verwendet." />
      <Field label="Fußzeile der Rechnung" value={value.payment.invoiceFooterText} onChange={invoiceFooterText => patch('payment', { invoiceFooterText })} multiline wide />
      <Field label="Rechnungshinweise" value={value.payment.invoiceNotes} onChange={invoiceNotes => patch('payment', { invoiceNotes })} multiline wide />
    </Group>
  </>;
  if (section === 'modules') {
    const rows: { key: keyof TenantModuleSettings; module: string; title: string; detail: string }[] = [
      { key: 'assistEnabled', module: 'assist', title: 'Alltagsbegleitung', detail: 'Leistungsbereich Assist' },
      { key: 'pflegeEnabled', module: 'pflege', title: 'Ambulante Pflege', detail: 'Noch nicht zur Nutzung freigegeben' },
      { key: 'stationaerEnabled', module: 'stationaer', title: 'Stationäre Pflege', detail: 'Noch nicht zur Nutzung freigegeben' },
      { key: 'beratungEnabled', module: 'beratung', title: 'Beratung', detail: 'Noch nicht zur Nutzung freigegeben' },
    ];
    return <Group title="Leistungsbereiche des Unternehmens" description="Office bleibt als zentrale Verwaltung verfügbar. Bestehende Zugriffsrechte gelten weiterhin."><div className="cs-company-wide cs-company-module-list">{rows.map(row => <label className="cs-company-module" key={row.key}>
      <span><strong>{row.title}</strong><small>{row.detail}</small></span><input type="checkbox" aria-label={row.title} checked={isUnreleasedModuleKey(row.module) ? false : value.modules[row.key]} disabled={isUnreleasedModuleKey(row.module)} onChange={event => patch('modules', { [row.key]: event.target.checked })} />
    </label>)}</div></Group>;
  }
  return null;
}

export const COMPANY_EDITOR_CSS = `
.cs-company-editor{--ce-text:#f4f8ff;--ce-muted:#aabed6;--ce-line:rgba(137,186,232,.2);font-family:inherit;color:var(--ce-text);min-width:0;color-scheme:dark}
.cs-company-editor *{box-sizing:border-box}.cs-company-editor fieldset{margin:0;padding:0;border:0;min-width:0}.cs-company-editor fieldset:disabled{opacity:.72}
.cs-company-form-group{background:linear-gradient(145deg,rgba(24,47,77,.92),rgba(7,22,42,.94));border:1px solid var(--ce-line);border-radius:20px;padding:22px;margin:0 0 16px;min-width:0}
.cs-company-form-group header{margin-bottom:20px}.cs-company-form-group h3{font-size:16px;line-height:1.4;margin:0;font-weight:750;letter-spacing:-.15px}.cs-company-form-group p,.cs-company-form-hint{font-size:13px;line-height:1.55;color:var(--ce-muted);margin:7px 0 0}
.cs-company-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 18px}.cs-company-wide{grid-column:1/-1}.cs-company-field{min-width:0;display:flex;flex-direction:column;gap:7px}.cs-company-field label{font-size:13px;font-weight:650;color:#e1edff;line-height:1.45}.cs-company-field input,.cs-company-field textarea,.cs-company-field select{width:100%;min-width:0;min-height:44px;border:1px solid rgba(140,181,222,.3);border-radius:11px;background:rgba(3,14,30,.76);color:var(--ce-text);font:inherit;font-size:14px;line-height:1.5;padding:11px 12px;outline:none}.cs-company-field textarea{resize:vertical;min-height:96px}.cs-company-field input:focus,.cs-company-field textarea:focus,.cs-company-field select:focus{border-color:#5cc4ff;box-shadow:0 0 0 3px rgba(70,163,255,.16)}.cs-company-field [aria-invalid=true]{border-color:#ff8e9f}.cs-company-field small{font-size:12px;line-height:1.5;color:var(--ce-muted)}.cs-company-field small.cs-company-error-text{color:#ffbcc6}
.cs-company-editor button{font:inherit;cursor:pointer;border:1px solid rgba(126,190,242,.3);border-radius:10px;background:rgba(53,116,177,.15);color:#cbeaff;padding:9px 12px;font-size:13px;line-height:1.4;transition:background .16s,border-color .16s}.cs-company-editor button:hover{background:rgba(53,136,212,.28);border-color:rgba(126,190,242,.6)}.cs-company-editor button:focus-visible{outline:2px solid #67cfff;outline-offset:3px}.cs-company-editor button:disabled{opacity:.45;cursor:default}.cs-company-editor .cs-company-primary{background:#1769cc;border-color:#4b9aec;color:#fff;font-weight:700}.cs-company-editor .cs-company-remove{color:#ffbdc7;background:rgba(145,45,65,.1);border-color:rgba(240,111,135,.25)}
.cs-company-quick{display:flex;flex-wrap:wrap;gap:6px;margin-top:1px}.cs-company-quick button{padding:4px 9px;font-size:11px;border-radius:7px}.cs-company-toggle{display:flex;align-items:center;gap:10px;line-height:1.5;font-size:13px;min-height:44px}.cs-company-toggle input,.cs-company-module input{width:18px;height:18px;flex-shrink:0;accent-color:#3e9aff;cursor:pointer}.cs-company-module input:disabled{cursor:not-allowed}.cs-company-row-actions,.cs-company-list-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.cs-company-list-head{margin-bottom:16px}.cs-company-list-head p{margin:0;color:var(--ce-muted);font-size:13px;line-height:1.5;flex:1;min-width:190px}.cs-company-empty{padding:26px;border:1px dashed var(--ce-line);border-radius:16px;color:var(--ce-muted);font-size:14px;line-height:1.6}.cs-company-person{display:flex;flex-direction:column;gap:5px;padding:12px 0;border-bottom:1px solid var(--ce-line);font-size:13px}.cs-company-person span{color:var(--ce-muted);overflow-wrap:anywhere}.cs-company-module-list{display:grid;gap:8px}.cs-company-module{display:flex;gap:20px;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--ce-line)}.cs-company-module span{display:flex;flex-direction:column;gap:5px}.cs-company-module strong{font-size:14px}.cs-company-module small{color:var(--ce-muted);font-size:12px}
.cs-company-editor-status{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--ce-muted);line-height:1.5}.cs-company-editor-status p{margin:0}.cs-company-editor-status strong{color:#d9ecff;font-weight:600}.cs-company-editor-actions{display:flex;flex-wrap:wrap;gap:9px;justify-content:flex-end}.cs-company-save-error{padding:12px 14px;border:1px solid rgba(248,113,113,.4);background:rgba(91,18,37,.4);color:#ffd1d7;font-size:13px;line-height:1.5;border-radius:12px;margin-bottom:14px}.cs-company-discard{padding:13px;border:1px solid rgba(255,199,93,.35);border-radius:12px;background:rgba(115,76,20,.15);margin-bottom:12px}.cs-company-discard p{color:#ffdfa4;margin:0 0 10px;font-size:13px;line-height:1.5}.cs-company-audit{display:grid;gap:14px}.cs-company-audit article{padding:15px;border:1px solid var(--ce-line);border-radius:14px}.cs-company-audit time{display:block;color:var(--ce-muted);font-size:12px;margin-top:5px}.cs-company-audit p{line-height:1.5;font-size:13px;color:var(--ce-muted);margin-bottom:0}
@media(max-width:620px){.cs-company-fields{grid-template-columns:minmax(0,1fr);gap:16px}.cs-company-form-group{padding:16px;border-radius:15px}.cs-company-editor-actions{width:100%}.cs-company-editor-actions>button{flex:1}.cs-company-editor-status{align-items:flex-start}}
@media(prefers-reduced-motion:reduce){.cs-company-editor button{transition:none}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
