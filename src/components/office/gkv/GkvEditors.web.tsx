import { useEffect, useState, type ReactNode } from 'react';
import { newLine, parseHundredths, recalculateLine, withLines } from '@/lib/gkvExchange/editor';
import { calculateBasePrice, PRICING_RULES, type PricingRule } from '@/lib/gkvExchange/pricing';
import { CARE_RATE_CODES, carePeriod, daysInMonth } from '@/lib/gkvExchange/care';
import { ADJUSTMENT_CALCULATIONS, ADJUSTMENT_CODES, ADJUSTMENT_RULE, ADJUSTMENT_TARIFFS, calculateAdjustments, type Adjustment } from '@/lib/gkvExchange/adjustments';
import { cents, type BillingCase, type ExchangeProfile, type ServiceLine } from '@/lib/gkvExchange/model';
import { AID_SUPPLY_CODES, aidAmounts, emptyAid, isSpecialService, type AidDetails } from '@/lib/gkvExchange/special';

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
      <option value="AO">AOK</option><option value="BK">Betriebskrankenkasse</option><option value="BN">Bundesknappschaft</option><option value="EK">Ersatzkasse</option><option value="IK">Innungskrankenkasse</option><option value="LK">Landwirtschaftliche Krankenkasse</option><option value="SE">Seekasse</option>
    </Choice>
    <Choice label="Bundesland für das Empfängerrouting" value={value.stateCode} onChange={v => set('stateCode', v)}>
      {['Schleswig-Holstein','Hamburg','Niedersachsen','Bremen','Nordrhein-Westfalen','Hessen','Rheinland-Pfalz','Baden-Württemberg','Bayern','Saarland','Berlin','Brandenburg','Mecklenburg-Vorpommern','Sachsen','Sachsen-Anhalt','Thüringen'].map((label, i) => <option key={label} value={String(i + 1).padStart(2, '0')}>{label}</option>)}
    </Choice>
    <Choice label="Umsatzsteuerliche Einordnung" value={value.taxTreatment === 'taxable' ? 'taxable' : value.taxExemptionCode} onChange={v => onChange({ ...value, taxTreatment: v === 'taxable' ? 'taxable' : 'exempt', taxExemptionCode: v === 'taxable' ? '' : v })}>
      <option value="">Noch nicht bestätigt</option><option value="01">Bestätigt: Befreiungsschlüssel 01 (§ 4 Nr. 16 UStG)</option>
      <option value="taxable">Steuerpflichtige Pflegehilfsmittel (Steuersatz je Position)</option>
    </Choice>
    <Field label="Steuernummer (falls erforderlich)" value={value.taxNumber || ''} maxLength={20} onChange={v => set('taxNumber', v)} />
  </div><label className="gx-check"><input type="checkbox" checked={value.ambulatoryProvider} onChange={e => set('ambulatoryProvider', e.target.checked)} />Ambulanter Pflege- oder Betreuungsdienst / Einzelpflegekraft nach § 77 SGB XI</label>
  <label className="gx-check"><input type="checkbox" checked={value.employeeNumberRequired || value.ambulatoryProvider} disabled={value.ambulatoryProvider} onChange={e => set('employeeNumberRequired', e.target.checked)} />Beschäftigtennummer für jede abgerechnete Leistung erforderlich</label></div>;
}

export function CaseEditor({ value, index, onChange, onRemove, onReload, serviceType = '' }: { value: BillingCase; index: number; onChange: (value: BillingCase) => void; onRemove: () => void; onReload?: () => void; serviceType?: string }) {
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
      {(isSpecialService(serviceType) || value.agreement) && <AgreementEditor value={value} onChange={onChange} />}
      {!isSpecialService(serviceType) && value.agreement && <button type="button" onClick={() => onChange({ ...value, agreement: undefined })}>Bewilligungsprofil der vorherigen Leistungsart entfernen</button>}
      <div><h3>Leistungspositionen</h3>{value.lines.map((line, lineIndex) => <LineEditor key={`${lineIndex}:${line.sourceId || ''}`} value={line} month={value.month} serviceType={serviceType} index={lineIndex} onChange={next => changeLine(lineIndex, next)} onRemove={() => onChange(withLines(value, value.lines.filter((_, i) => i !== lineIndex)))} />)}
        <button type="button" style={{ marginTop: 12 }} onClick={() => onChange(withLines(value, [...value.lines, newLine()]))} disabled={value.lines.length >= 1000}>Leistung hinzufügen</button>
      </div>
      <div className="gx-grid"><MoneyField label="Eigenanteil / Zuzahlung (€)" value={value.coPaymentCents} onChange={v => set('coPaymentCents', v)} /><MoneyField label="Beihilfe (€)" value={value.aidCents} onChange={v => set('aidCents', v)} /></div>
      {serviceType === '06' && <button type="button" onClick={() => set('coPaymentCents', value.lines.reduce((sum,l) => sum + (l.aid?.coPaymentCents || 0),0))}>Zuzahlungen aus den Hilfsmittelpositionen übernehmen</button>}
      <label className="gx-check"><input type="checkbox" checked={value.proofConfirmed} onChange={e => set('proofConfirmed', e.target.checked)} />Leistungsnachweis und erforderliche Unterschriften liegen vor und stimmen mit den erfassten Leistungen überein.</label>
      <div className="gx-total"><span>Brutto {money(value.grossCents)} · Kassenanteil {money(value.grossCents - value.coPaymentCents - value.aidCents)}</span><button type="button" className="gx-danger" onClick={onRemove}>Fall entfernen</button></div>
    </div>
  </details>;
}

function LineEditor({ value, month, index, onChange, onRemove, serviceType }: { value: ServiceLine; month: string; index: number; onChange: (value: ServiceLine) => void; onRemove: () => void; serviceType: string }) {
  const set = <K extends keyof ServiceLine>(key: K, next: ServiceLine[K]) => {
    const line = { ...value, [key]: next };
    if ((key === 'pointValue' || key === 'points') && !line.pointValue && !line.points) line.pricingRule = undefined;
    if (key === 'code' && line.remuneration === '06' && line.code !== '04') { line.pricingRule = undefined; line.distanceKm = ''; line.duration = '00'; }
    if (key === 'duration' && line.pricingRule === 'care_daily') {
      const period = carePeriod(line);
      if (period) { line.day = String(period.first).padStart(2, '0'); line.quantityHundredths = (period.last - period.first + 1) * 100; }
    }
    onChange(line);
  };
  const time = value.remuneration === '02';
  const distance = value.remuneration === '06' && value.code === '04';
  const points = value.remuneration === '01';
  const partialCare = value.remuneration === '03', fullCare = value.remuneration === '04';
  const aid = value.remuneration === '05';
  const specialMonthly = ['08','12','14'].includes(serviceType) && value.remuneration === '99';
  const changeRemuneration = (remuneration: string) => onChange({ ...value, remuneration, pricingRule: undefined, pointValue: '', points: '', distanceKm: '', duration: '00', code: '', careEndsNextDay: false,
    aid: remuneration === '05' ? value.aid || emptyAid() : undefined,
    ...(remuneration === '04' ? { startTime: '' } : {}), ...(value.day === '99' ? { day: '' } : {}) });
  const changePricing = (rule: string) => {
    const line = { ...value, pricingRule: rule ? rule as PricingRule : undefined };
    if (rule === 'care_monthly') Object.assign(line, { day: '99', duration: `01${daysInMonth(month)}`, quantityHundredths: 100, startTime: '' });
    if (rule === 'care_attendance') line.quantityHundredths = 100;
    if (rule === 'special_monthly') Object.assign(line, { day:'99',duration:'00',quantityHundredths:100,startTime:'' });
    if (!rule && value.pricingRule === 'special_monthly') line.day = '';
    if (rule === 'care_daily') { const period = carePeriod(line); if (period) Object.assign(line, { day: String(period.first).padStart(2, '0'), quantityHundredths: (period.last - period.first + 1) * 100 }); }
    onChange(line);
  };
  return <section className="gx-line" aria-label={`Leistung ${index + 1}`}><div className="gx-card-title"><h3>Leistung {index + 1}</h3><button type="button" aria-label={`Leistung ${index + 1} entfernen`} className="gx-danger" onClick={onRemove}>Entfernen</button></div>
    {value.sourceDescription && <p className="gx-subtle">Rechnungsposition: {value.sourceDescription}</p>}
    <div className="gx-grid">
      <Field label={fullCare || specialMonthly ? 'Erster Leistungstag / 99 bei fester Monatspauschale' : 'Tag im Monat (TT)'} value={value.day} maxLength={2} onChange={v => set('day', v)} />
      {!fullCare && <Field label="Tatsächlicher Beginn (HHMM)" value={value.startTime || ''} maxLength={4} onChange={v => set('startTime', v)} />}
      <Choice label="Vergütungsart" value={value.remuneration} onChange={changeRemuneration}><option value="">Auswählen</option><option value="01">01 · Leistungskomplex</option><option value="02">02 · Zeitvergütung</option><option value="03">03 · Tages-/Nachtpflege-Pflegesatz</option><option value="04">04 · Vollstationärer Pflegesatz / Kurzzeitpflege</option><option value="05">05 · Pflegehilfsmittel</option><option value="06">06 · Wegegebühr</option><option value="07">07 · Entlastungsleistung</option><option value="08">08 · Beratungspauschale</option><option value="99">99 · Ohne Vertragspreisregelung</option></Choice>
      <Choice label="Qualifikationsschlüssel" value={value.qualification} onChange={v => set('qualification', v)}><option value="">Auswählen</option>{['0','1','2','3','4','8'].map(code => <option key={code} value={code}>{code === '0' ? '0 · Nicht abhängig' : `Schlüssel ${code}`}</option>)}</Choice>
      {partialCare || fullCare ? <Choice label="Vertraglicher Pflegesatz" value={value.code} onChange={v => set('code', v)}><option value="">Auswählen</option>{Object.entries(CARE_RATE_CODES).filter(([key]) => partialCare ? key !== '02' : key !== '01').map(([key,label]) => <option key={key} value={key}>{key} · {label}</option>)}</Choice>
        : <Field label="Vertraglicher Leistungsschlüssel" value={value.code} maxLength={10} onChange={v => set('code', v)} />}
      <MoneyField label={time ? 'Preis je verschlüsselter Zeiteinheit (€)' : distance ? 'Preis je Kilometer (€)' : aid ? value.aid?.vatTreatment === 'included' ? 'Vertraglicher Bruttopreis je Stück (€)' : value.aid?.vatTreatment === 'add' ? 'Vertraglicher Nettopreis je Stück (€)' : 'Vertraglicher Einzelpreis je Stück (€)' : 'Einzelpreis (€)'} value={value.unitPriceCents} onChange={v => set('unitPriceCents', v)} />
      <MoneyField label={time || distance ? 'Anzahl gleicher Leistungen (nicht Minuten / km)' : 'Anzahl / Menge'} value={value.quantityHundredths} onChange={v => set('quantityHundredths', v)} />
      {!distance && <Field label={time ? 'Tatsächliche Dauer je Leistung (Minuten)' : partialCare ? 'Tatsächliches Ende (HHMM)' : fullCare ? 'Von-/Bis-Tag (TTTT)' : 'Dauer (00)'} value={value.duration} maxLength={4} hint={fullCare ? 'Beispiel 0107: 1. bis einschließlich 7. Tag; Tagesanzahl wird bei bestätigter Tagesregel übernommen.' : undefined} onChange={v => set('duration', v)} />}
      {distance && <Field label="Tatsächlich gefahrene Kilometer" value={value.distanceKm || ''} maxLength={7} hint={`Gemeldete ganze Kilometer: ${value.duration}`} onChange={v => set('distanceKm', v)} />}
      {points && <><Field label="Punktwert (€; optional)" value={value.pointValue || ''} maxLength={7} hint="Bis fünf Nachkommastellen, laut Vergütungsvereinbarung." onChange={v => set('pointValue', v)} /><Field label="Punktzahl (optional)" value={value.points || ''} maxLength={4} onChange={v => set('points', v)} /></>}
      {(time || distance || partialCare || fullCare || value.pointValue || value.points) && <><Choice label="Vertraglich vereinbarte Berechnung" value={value.pricingRule || ''} onChange={changePricing}><option value="">Auswählen und Vertrag prüfen</option>{Object.entries(PRICING_RULES).filter(([key]) => time ? key.startsWith('time_') : distance ? key === 'kilometres_rounded' : partialCare ? key === 'care_attendance' : fullCare ? ['care_daily','care_monthly'].includes(key) : key === 'points_unit').map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Choice><Field label="Vertrag / Vergütungsvereinbarung mit Gültigkeit" value={value.contractReference || ''} maxLength={200} onChange={v => set('contractReference', v)} /></>}
      <Field label="Beschäftigtennummer" value={value.employeeNumber || ''} maxLength={9} onChange={v => set('employeeNumber', v)} />
      <Field label="Zweite Beschäftigtennummer" value={value.secondEmployeeNumber || ''} maxLength={9} onChange={v => set('secondEmployeeNumber', v)} />
      {specialMonthly && <Choice label="Abrechnungsgrundlage der Sonderleistung" value={value.pricingRule || ''} onChange={changePricing}><option value="">Einzelbetrag am tatsächlichen Leistungstag</option><option value="special_monthly">Bewilligte feste Pauschale für den vollständigen Monat</option></Choice>}
      {(aid || isSpecialService(serviceType) && !(time || points && value.pointValue)) && <Field label="Vertrag / Preis- und Rundungsvereinbarung" value={value.contractReference || ''} maxLength={200} onChange={v => set('contractReference',v)} />}
    </div>{partialCare && <label className="gx-check"><input type="checkbox" checked={value.careEndsNextDay || false} onChange={e => set('careEndsNextDay', e.target.checked)} />Nachtpflege endet am Folgetag; Beginn und Ende sind tatsächliche Zeiten.</label>}
    {aid && <AidEditor value={value} onChange={onChange} />}
    {(partialCare || fullCare) && <p className="gx-subtle">Pflegesätze für Halbtag oder Abwesenheit unverändert aus dem Vertrag übernehmen. Es erfolgt keine automatische Halbierung oder Kürzung. Unterbringung, Verpflegung, Investitionskosten und stationäre Zuschläge sind in diesem Grundprofil noch nicht enthalten.</p>}
    <AdjustmentsEditor value={value} onChange={onChange} /><div className="gx-total"><small>Schlüssel und Vergütung müssen der Vereinbarung mit der Pflegekasse entsprechen.</small><span className="gx-money">{money(value.totalCents)}</span></div>
  </section>;
}

function AgreementEditor({value,onChange}:{value:BillingCase;onChange:(value:BillingCase)=>void}) {
  const a=value.agreement || {reference:'',from:'',until:'',exchangeReference:'',limitCents:0};
  const set=<K extends keyof typeof a>(key:K,next:typeof a[K])=>onChange({...value,agreement:{...a,[key]:next}});
  return <section className="gx-line"><h3>Bewilligung und Abrechnungsvereinbarung</h3><p className="gx-subtle">Angaben aus dem Bescheid beziehungsweise Vertrag übernehmen. Der Höchstbetrag gilt für diesen Fall und Leistungsmonat. Die Eingabe ersetzt keine Prüfung des Leistungsanspruchs.</p><div className="gx-grid">
    <Field label="Bewilligung / Vertragsreferenz" value={a.reference} maxLength={200} onChange={v=>set('reference',v)} />
    <Field label="Gültig ab" value={a.from} type="date" onChange={v=>set('from',v)} />
    <Field label="Gültig bis" value={a.until} type="date" onChange={v=>set('until',v)} />
    <Field label="Vereinbarung zum elektronischen Datenaustausch" value={a.exchangeReference} maxLength={200} onChange={v=>set('exchangeReference',v)} />
    <MoneyField label="Bestätigter Kassenhöchstbetrag für diesen Fall (€)" value={a.limitCents} onChange={v=>set('limitCents',v)} />
  </div></section>;
}

function AidEditor({value,onChange}:{value:ServiceLine;onChange:(value:ServiceLine)=>void}) {
  const a=value.aid || emptyAid();const set=<K extends keyof AidDetails>(key:K,next:AidDetails[K])=>onChange({...value,aid:{...a,[key]:next}});
  let amounts:ReturnType<typeof aidAmounts>|null=null;try{amounts=aidAmounts(value);}catch{}
  return <section className="gx-line"><h3>Lieferung des Pflegehilfsmittels</h3><div className="gx-grid">
    <Choice label="Hilfsmittelart" value={a.kind} onChange={v=>set('kind',v)}><option value="">Auswählen</option><option value="technical">Technisches Pflegehilfsmittel</option><option value="consumable">Zum Verbrauch bestimmtes Pflegehilfsmittel</option></Choice>
    <Choice label="Steuerbehandlung des Einzelpreises" value={a.vatTreatment} onChange={v=>onChange({...value,aid:{...a,vatTreatment:v,vatCode:v==='exempt'?'':a.vatCode}})}><option value="">Auswählen</option><option value="exempt">Steuerbefreit laut Abrechnungsprofil</option><option value="add">Netto: Umsatzsteuer hinzurechnen</option><option value="included">Vereinbarter Preis enthält Umsatzsteuer</option></Choice>
    {a.vatTreatment && a.vatTreatment!=='exempt' && <Choice label="Zutreffender Umsatzsteuersatz" value={a.vatCode} onChange={v=>set('vatCode',v)}><option value="">Steuerliche Einordnung prüfen</option><option value="1">19 %</option><option value="2">7 %</option></Choice>}
    <Choice label="Lieferkennzeichen" value={a.supplyCode} onChange={v=>set('supplyCode',v)}><option value="">Keine Angabe / auswählen</option>{Object.entries(AID_SUPPLY_CODES).map(([k,v])=><option key={k} value={k}>{k} · {v}</option>)}</Choice>
    <Field label="Genehmigungskennzeichen der Pflegekasse" value={a.approvalReference} maxLength={15} onChange={v=>set('approvalReference',v)} />
    <Field label="Genehmigungsdatum" value={a.approvalDate} type="date" onChange={v=>set('approvalDate',v)} />
    <Field label="Bezeichnung ohne vollständige Positionsnummer" value={a.description} maxLength={30} hint="Nur bei einer zweistelligen Produktgruppe, solange noch keine vollständige Nummer vergeben ist." onChange={v=>set('description',v)} />
    <Field label="Vertragliche Produktbesonderheit" value={a.productCode} maxLength={10} onChange={v=>set('productCode',v)} />
    <Field label="Inventarnummer der Pflegekasse" value={a.inventoryNumber} maxLength={20} onChange={v=>set('inventoryNumber',v)} />
    <MoneyField label="Zuzahlung für diese Position (€)" value={a.coPaymentCents} onChange={v=>set('coPaymentCents',v)} />
  </div><label className="gx-check"><input type="checkbox" checked={a.productCodeRequired} onChange={e=>set('productCodeRequired',e.target.checked)} />Liefervertrag verlangt eine Produktbesonderheit.</label>
  <label className="gx-check"><input type="checkbox" checked={a.inventoryRequired} onChange={e=>set('inventoryRequired',e.target.checked)} />Wiedereinsatzfähiges Hilfsmittel: Inventarnummer laut Vertrag erforderlich.</label>
  <p className="gx-subtle">Ganze Liefermengen. Steuer wird je Einzelpreis auf Cent gerundet, danach mit der Menge multipliziert. Zuzahlungen aus dem Bescheid übernehmen; es erfolgt keine automatische Festsetzung.</p>
  {amounts && <p>Netto {money(amounts.netCents)} · Umsatzsteuer {money(amounts.vatCents)} · Brutto {money(amounts.totalCents)}</p>}</section>;
}

function AdjustmentsEditor({ value, onChange }: { value: ServiceLine; onChange: (value: ServiceLine) => void }) {
  const entries = value.adjustments || [];
  const setEntries = (adjustments: Adjustment[]) => onChange({ ...value, adjustments, adjustmentRule: adjustments.length ? value.adjustmentRule : undefined });
  let preview: { base: number; deltas: number[] } | null = null;
  let problem = '';
  try { const base = calculateBasePrice(value).totalCents; preview = { base, deltas: calculateAdjustments(value, base).map(a => a.signedCents) }; }
  catch (error) { problem = error instanceof Error ? error.message : 'Berechnungsgrundlage prüfen.'; }
  return <details className="gx-adjustments" open={entries.length > 0}>
    <summary>Vertragliche Zuschläge und Abzüge {entries.length > 0 && `· ${entries.length}`}</summary>
    <div className="gx-stack" style={{ marginTop: 14 }}>
      <p className="gx-subtle">Für einzeln ausgewiesene Pauschalen oder Leistungskomplexe mit Menge 1. Prozentuale und feste Beträge beziehen sich jeweils auf denselben Basisbetrag; jeder Zu- oder Abschlag wird kaufmännisch auf Cent gerundet. Zeit-, Kilometer-, Monats- und verkettete Ersatzwertberechnungen sind hier noch nicht verfügbar.</p>
      {entries.length > 0 && <Choice label="Vertragliche Zuschlagsberechnung" value={value.adjustmentRule || ''} onChange={adjustmentRule => onChange({ ...value, adjustmentRule })}><option value="">Vertrag prüfen und auswählen</option><option value={ADJUSTMENT_RULE}>Unveränderter Basisbetrag; jeden Zu-/Abschlag einzeln auf Cent runden</option></Choice>}
      {entries.map((entry, index) => {
        const set = (key: keyof Adjustment, next: string) => setEntries(entries.map((a, i) => i === index ? { ...a, [key]: next } : a));
        return <section className="gx-adjustment" key={index} aria-label={`Zu- oder Abschlag ${index + 1}`}>
          <div className="gx-card-title"><h4>Zu- oder Abschlag {index + 1}</h4><button type="button" className="gx-danger" aria-label={`Zu- oder Abschlag ${index + 1} entfernen`} onClick={() => setEntries(entries.filter((_, i) => i !== index))}>Entfernen</button></div>
          <div className="gx-grid">
            <Choice label="Tarifbereich des Zuschlags" value={entry.tariff} onChange={v => set('tariff', v)}><option value="">Auswählen</option>{Object.entries(ADJUSTMENT_TARIFFS).map(([key, label]) => <option key={key} value={key}>{key} · {label}</option>)}</Choice>
            <Choice label="Zuschlagsart" value={entry.kind} onChange={v => set('kind', v)}><option value="">Auswählen</option><option value="1">1 · Ambulant</option></Choice>
            <Choice label="Grund des Zu- oder Abschlags" value={entry.code} onChange={v => set('code', v)}><option value="">Auswählen</option>{Object.entries(ADJUSTMENT_CODES).map(([key, label]) => <option key={key} value={key}>{key} · {label}</option>)}</Choice>
            <Field label="Beschreibung des Zuschlags" value={entry.text} maxLength={50} hint="Bei Schlüssel 00 erforderlich." onChange={v => set('text', v)} />
            <Choice label="Zuschlagszuordnung" value={entry.allocation} onChange={v => set('allocation', v)}><option value="">Auswählen</option><option value="1">1 · Leistung</option><option value="2">2 · Wegegebühr</option></Choice>
            <Choice label="Berechnungsart des Zuschlags" value={entry.calculation} onChange={v => set('calculation', v)}><option value="">Auswählen</option>{Object.entries(ADJUSTMENT_CALCULATIONS).map(([key, label]) => <option key={key} value={key}>{key} · {label}</option>)}</Choice>
            <Choice label="Zuschlag oder Abzug" value={entry.direction} onChange={v => set('direction', v)}><option value="">Auswählen</option><option value="1">Zuschlag (+)</option><option value="0">Abzug (−)</option></Choice>
            <Field label={entry.calculation === '11' ? 'Zuschlagswert (%)' : 'Zuschlagswert (€)'} value={entry.value} maxLength={10} hint="Bis fünf Nachkommastellen." onChange={v => set('value', v)} />
            <Field label="Vertragsgrundlage des Zuschlags" value={entry.contractReference} maxLength={200} hint="Vertragsstelle und Gültigkeitszeitraum." onChange={v => set('contractReference', v)} />
          </div>
          {preview && <p className="gx-money">{preview.deltas[index] >= 0 ? '+' : '−'} {money(Math.abs(preview.deltas[index]))}</p>}
        </section>;
      })}
      {entries.length > 0 && (preview ? <p className="gx-subtle">Basisbetrag {money(preview.base)} · einschließlich Zu- und Abschlägen {money(value.totalCents)}</p> : <p role="status" className="gx-subtle">{problem}</p>)}
      <button type="button" disabled={entries.length >= 20 || ['03','04','05'].includes(value.remuneration) || value.pricingRule === 'special_monthly'} onClick={() => setEntries([...entries, { tariff: '', kind: '', code: '', text: '', allocation: '', calculation: '', direction: '', value: '', contractReference: '' }])}>Zu- oder Abschlag hinzufügen</button>
    </div>
  </details>;
}
