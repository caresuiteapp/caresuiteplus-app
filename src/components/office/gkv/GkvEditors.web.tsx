import { useEffect, useState, type ReactNode } from 'react';
import { newLine, parseHundredths, recalculateLine, withLines } from '@/lib/gkvExchange/editor';
import { PRICING_RULES, type PricingRule } from '@/lib/gkvExchange/pricing';
import { cents, type BillingCase, type ExchangeProfile, type ServiceLine } from '@/lib/gkvExchange/model';

export function Field({ label, value, onChange, type = 'text', maxLength, hint }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; maxLength?: number; hint?: string;
}) {
  return <label className="gx-field"><span>{label}</span><input type={type} value={value ?? ''} maxLength={maxLength} onChange={event => onChange(event.target.value)} />{hint && <small>{hint}</small>}</label>;
}
export function Choice({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="gx-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>;
}
export function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const validValue = Number.isSafeInteger(value) && value >= 0 && value <= 999999999999;
  const [text, setText] = useState(validValue ? cents(value) : '');
  useEffect(() => { if (validValue) setText(previous => parseHundredths(previous) === value ? previous : cents(value)); }, [value, validValue]);
  const invalid = !Number.isFinite(parseHundredths(text));
  return <label className="gx-field"><span>{label}</span><input inputMode="decimal" value={text} aria-invalid={invalid} onChange={event => { setText(event.target.value); onChange(parseHundredths(event.target.value)); }} />{invalid && <small>Bitte eine Zahl mit höchstens zwei Nachkommastellen eingeben.</small>}</label>;
}
export const money = (amount: number) => Number.isFinite(amount) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount / 100) : 'Betrag prüfen';

export function ProfileEditor({ value, onChange }: { value: ExchangeProfile; onChange: (value: ExchangeProfile) => void }) {
  const set = <K extends keyof ExchangeProfile>(key: K, next: ExchangeProfile[K]) => onChange({ ...value, [key]: next });
  return <div className="gx-stack"><div className="gx-grid">
    <Field label="Leistungserbringer-IK" value={value.providerIk} maxLength={9} onChange={v => set('providerIk', v)} />
    <Field label="Absender-IK" value={value.senderIk} maxLength={9} onChange={v => set('senderIk', v)} />
    <Field label="Name des Leistungserbringers" value={value.name} maxLength={30} onChange={v => set('name', v)} />
    <Field label="Namenszusatz" value={value.name2 || ''} maxLength={30} onChange={v => set('name2', v)} />
    <Field label="Abrechnungscode" value={value.billingCode} maxLength={2} hint="Zweistelliger Schlüssel aus Ihrem Vertrag." onChange={v => set('billingCode', v)} />
    <Field label="Tarifkennzeichen" value={value.tariffCode} maxLength={5} hint="Fünfstellig, unverändert aus der Vergütungsvereinbarung." onChange={v => set('tariffCode', v)} />
    <Choice label="Kassenart" value={value.fundType} onChange={v => set('fundType', v as ExchangeProfile['fundType'])}>
      <option value="AO">AOK</option><option value="BK">Betriebskrankenkasse</option><option value="BN">BKK – neue Bundesländer</option><option value="EK">Ersatzkasse</option><option value="IK">Innungskrankenkasse</option><option value="LK">Landwirtschaftliche Krankenkasse</option><option value="SE">Knappschaft / See</option>
    </Choice>
    <Choice label="Bundesland für das Empfängerrouting" value={value.stateCode} onChange={v => set('stateCode', v)}>
      {['Schleswig-Holstein','Hamburg','Niedersachsen','Bremen','Nordrhein-Westfalen','Hessen','Rheinland-Pfalz','Baden-Württemberg','Bayern','Saarland','Berlin','Brandenburg','Mecklenburg-Vorpommern','Sachsen','Sachsen-Anhalt','Thüringen'].map((label, i) => <option key={label} value={String(i + 1).padStart(2, '0')}>{label}</option>)}
    </Choice>
    <Choice label="Umsatzsteuerliche Einordnung" value={value.taxExemptionCode} onChange={v => set('taxExemptionCode', v)}>
      <option value="">Noch nicht bestätigt</option><option value="01">Bestätigt: Befreiungsschlüssel 01 (§ 4 Nr. 16 UStG)</option>
    </Choice>
    <Field label="Steuernummer (falls erforderlich)" value={value.taxNumber || ''} maxLength={20} onChange={v => set('taxNumber', v)} />
  </div><label className="gx-check"><input type="checkbox" checked={value.ambulatoryProvider} onChange={e => set('ambulatoryProvider', e.target.checked)} />Ambulanter Pflege- oder Betreuungsdienst / Einzelpflegekraft nach § 77 SGB XI</label>
  <label className="gx-check"><input type="checkbox" checked={value.employeeNumberRequired || value.ambulatoryProvider} disabled={value.ambulatoryProvider} onChange={e => set('employeeNumberRequired', e.target.checked)} />Beschäftigtennummer für jede abgerechnete Leistung erforderlich</label></div>;
}

export function CaseEditor({ value, index, onChange, onRemove, onReload }: { value: BillingCase; index: number; onChange: (value: BillingCase) => void; onRemove: () => void; onReload?: () => void }) {
  const set = <K extends keyof BillingCase>(key: K, next: BillingCase[K]) => onChange({ ...value, [key]: next });
  const changeLine = (index: number, line: ServiceLine) => onChange(withLines(value, value.lines.map((previous, i) => i === index ? recalculateLine(line) : previous)));
  return <details className="gx-case" open={index === 0}>
    <summary>Fall {index + 1} · {value.invoiceNumber || 'Rechnung noch offen'} <span className="gx-case-count">{value.lastName ? `· ${value.firstName} ${value.lastName}` : '· Person ergänzen'} · {money(value.grossCents)}</span></summary>
    <div className="gx-stack">
      {value.sourceInvoiceId && <p className="gx-subtle">Rechnungspositionen wurden übernommen. Ergänzen Sie die vertraglichen GKV-Schlüssel. Beim Export werden Rechnung, Positionen, zugehörige Leistungen und ausgewählte Originalnachweise erneut geprüft. {value.sourceProofs?.length || 0} Nachweisreferenzen sind verknüpft.</p>}
      {value.sourceInvoiceId && onReload && <div className="gx-actions"><button type="button" onClick={onReload}>Quellrechnung erneut übernehmen</button></div>}
      <div className="gx-grid">
        <Field label="Rechnungsnummer" value={value.invoiceNumber} maxLength={14} onChange={v => set('invoiceNumber', v)} />
        <Field label="Rechnungsdatum" value={value.invoiceDate} type="date" onChange={v => set('invoiceDate', v)} />
        <Field label="Belegnummer" value={value.documentNumber} maxLength={10} onChange={v => set('documentNumber', v)} />
        <Field label="Abrechnungsmonat" value={value.month} type="month" onChange={v => set('month', v)} />
        <Field label="Versichertennummer" value={value.insuranceNumber} maxLength={12} onChange={v => set('insuranceNumber', v)} />
        <Field label="Nachname" value={value.lastName} maxLength={45} onChange={v => set('lastName', v)} />
        <Field label="Vorname" value={value.firstName} maxLength={45} onChange={v => set('firstName', v)} />
        <Field label="Geburtsdatum" value={value.birthDate} type="date" onChange={v => set('birthDate', v)} />
        <Choice label="Pflegegrad" value={value.careGrade} onChange={v => set('careGrade', v)}><option value="">Auswählen</option>{[1,2,3,4,5].map(grade => <option key={grade}>{grade}</option>)}</Choice>
        <Field label="Straße" value={value.street || ''} maxLength={46} onChange={v => set('street', v)} />
        <Field label="Hausnummer" value={value.houseNumber || ''} maxLength={9} onChange={v => set('houseNumber', v)} />
        <Field label="Postleitzahl" value={value.postalCode || ''} maxLength={10} onChange={v => set('postalCode', v)} />
        <Field label="Ort" value={value.city || ''} maxLength={40} onChange={v => set('city', v)} />
      </div>
      <div><h3>Leistungspositionen</h3>{value.lines.map((line, lineIndex) => <LineEditor key={`${lineIndex}:${line.sourceId || ''}`} value={line} index={lineIndex} onChange={next => changeLine(lineIndex, next)} onRemove={() => onChange(withLines(value, value.lines.filter((_, i) => i !== lineIndex)))} />)}
        <button type="button" style={{ marginTop: 12 }} onClick={() => onChange(withLines(value, [...value.lines, newLine()]))} disabled={value.lines.length >= 1000}>Leistung hinzufügen</button>
      </div>
      <div className="gx-grid"><MoneyField label="Eigenanteil / Zuzahlung (€)" value={value.coPaymentCents} onChange={v => set('coPaymentCents', v)} /><MoneyField label="Beihilfe (€)" value={value.aidCents} onChange={v => set('aidCents', v)} /></div>
      <label className="gx-check"><input type="checkbox" checked={value.proofConfirmed} onChange={e => set('proofConfirmed', e.target.checked)} />Leistungsnachweis und erforderliche Unterschriften liegen vor und stimmen mit den erfassten Leistungen überein.</label>
      <div className="gx-total"><span>Brutto {money(value.grossCents)} · Kassenanteil {money(value.grossCents - value.coPaymentCents - value.aidCents)}</span><button type="button" className="gx-danger" onClick={onRemove}>Fall entfernen</button></div>
    </div>
  </details>;
}

function LineEditor({ value, index, onChange, onRemove }: { value: ServiceLine; index: number; onChange: (value: ServiceLine) => void; onRemove: () => void }) {
  const set = <K extends keyof ServiceLine>(key: K, next: ServiceLine[K]) => {
    const line = { ...value, [key]: next };
    if ((key === 'pointValue' || key === 'points') && !line.pointValue && !line.points) line.pricingRule = undefined;
    if (key === 'code' && line.remuneration === '06' && line.code !== '04') { line.pricingRule = undefined; line.distanceKm = ''; line.duration = '00'; }
    onChange(line);
  };
  const time = value.remuneration === '02';
  const distance = value.remuneration === '06' && value.code === '04';
  const points = value.remuneration === '01';
  const changeRemuneration = (remuneration: string) => onChange({ ...value, remuneration, pricingRule: undefined, pointValue: '', points: '', distanceKm: '', duration: '00', code: '' });
  return <section className="gx-line" aria-label={`Leistung ${index + 1}`}><div className="gx-card-title"><h3>Leistung {index + 1}</h3><button type="button" aria-label={`Leistung ${index + 1} entfernen`} className="gx-danger" onClick={onRemove}>Entfernen</button></div>
    {value.sourceDescription && <p className="gx-subtle">Rechnungsposition: {value.sourceDescription}</p>}
    <div className="gx-grid">
      <Field label="Tag im Monat (TT)" value={value.day} maxLength={2} onChange={v => set('day', v)} />
      <Field label="Tatsächlicher Beginn (HHMM)" value={value.startTime || ''} maxLength={4} onChange={v => set('startTime', v)} />
      <Choice label="Vergütungsart" value={value.remuneration} onChange={changeRemuneration}><option value="">Auswählen</option><option value="01">01 · Leistungskomplex</option><option value="02">02 · Zeitvergütung</option><option value="06">06 · Wegegebühr</option><option value="07">07 · Entlastungsleistung</option><option value="08">08 · Beratungspauschale</option><option value="99">99 · Ohne Vertragspreisregelung</option></Choice>
      <Choice label="Qualifikationsschlüssel" value={value.qualification} onChange={v => set('qualification', v)}><option value="">Auswählen</option>{['0','1','2','3','4','8'].map(code => <option key={code} value={code}>{code === '0' ? '0 · Nicht abhängig' : `Schlüssel ${code}`}</option>)}</Choice>
      <Field label="Vertraglicher Leistungsschlüssel" value={value.code} maxLength={10} onChange={v => set('code', v)} />
      <MoneyField label={time ? 'Preis je verschlüsselter Zeiteinheit (€)' : distance ? 'Preis je Kilometer (€)' : 'Einzelpreis (€)'} value={value.unitPriceCents} onChange={v => set('unitPriceCents', v)} />
      <MoneyField label={time || distance ? 'Anzahl gleicher Leistungen (nicht Minuten / km)' : 'Anzahl / Menge'} value={value.quantityHundredths} onChange={v => set('quantityHundredths', v)} />
      {!distance && <Field label={time ? 'Tatsächliche Dauer je Leistung (Minuten)' : 'Dauer (00)'} value={value.duration} maxLength={4} onChange={v => set('duration', v)} />}
      {distance && <Field label="Tatsächlich gefahrene Kilometer" value={value.distanceKm || ''} maxLength={7} hint={`Gemeldete ganze Kilometer: ${value.duration}`} onChange={v => set('distanceKm', v)} />}
      {points && <><Field label="Punktwert (€; optional)" value={value.pointValue || ''} maxLength={7} hint="Bis fünf Nachkommastellen, laut Vergütungsvereinbarung." onChange={v => set('pointValue', v)} /><Field label="Punktzahl (optional)" value={value.points || ''} maxLength={4} onChange={v => set('points', v)} /></>}
      {(time || distance || value.pointValue || value.points) && <><Choice label="Vertraglich vereinbarte Berechnung" value={value.pricingRule || ''} onChange={v => set('pricingRule', v ? v as PricingRule : undefined)}><option value="">Auswählen und Vertrag prüfen</option>{Object.entries(PRICING_RULES).filter(([key]) => time ? key.startsWith('time_') : distance ? key === 'kilometres_rounded' : key === 'points_unit').map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Choice><Field label="Vertrag / Vergütungsvereinbarung mit Gültigkeit" value={value.contractReference || ''} maxLength={200} onChange={v => set('contractReference', v)} /></>}
      <Field label="Beschäftigtennummer" value={value.employeeNumber || ''} maxLength={9} onChange={v => set('employeeNumber', v)} />
      <Field label="Zweite Beschäftigtennummer" value={value.secondEmployeeNumber || ''} maxLength={9} onChange={v => set('secondEmployeeNumber', v)} />
    </div><div className="gx-total"><small>Schlüssel und Vergütung müssen der Vereinbarung mit der Pflegekasse entsprechen.</small><span className="gx-money">{money(value.totalCents)}</span></div>
  </section>;
}
