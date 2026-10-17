import { useId, useState } from 'react';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import type { ClientBudgetVisualModel } from '@/lib/assist/clientBudgetVisuals.web';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { clientBudgetVisualCardsCss } from './clientBudgetVisualCardsCss.web';

function money(value: number) {
  return formatCurrency(value, true);
}

function hours(value: number | null) {
  return value == null ? 'Keine Stundenprognose' : `${Math.max(0, value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Std.`;
}

function status(model: ClientBudgetVisualModel) {
  if (model.bookingState === 'loading') return { text: 'Wird geladen', kind: 'loading' };
  if (model.bookingState === 'not_eligible') return { text: 'Nicht verfügbar', kind: 'not_eligible' };
  if (model.bookingState === 'preview') return { text: 'Nicht gebucht', kind: 'preview' };
  if (!model.enabled) return { text: 'Aktivierung offen', kind: 'pending' };
  return { text: 'Gebucht', kind: 'booked' };
}

function InfoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none" /></svg>;
}

function BudgetVisualCard({ model }: { model: ClientBudgetVisualModel }) {
  const [showInfo, setShowInfo] = useState(false);
  const headingId = useId();
  const badge = status(model);
  const pending = model.bookingState === 'loading';
  const ineligible = model.bookingState === 'not_eligible';
  const showAmounts = !pending && !ineligible && model.balanceKnown !== false;
  const preview = model.bookingState === 'preview';
  const deficit = model.availableCents < 0;
  // Exact cents drive the proportions. Rounded display percentages can sum to 99/101.
  // If commitments exceed the budget, the segments remain bounded and the deficit stays visible.
  const total = Math.max(0, model.totalCents);
  const used = Math.max(0, model.usedCents);
  const reserved = Math.max(0, model.reservedCents);
  const available = Math.max(0, model.availableCents);
  const denominator = Math.max(total, used + reserved + available);
  const proportion = (value: number) => denominator > 0 ? `${value / denominator * 100}%` : '0%';

  return (
    <>
      <article className={`cbv-card cbv-card--${model.id}`} aria-labelledby={headingId} aria-busy={pending || undefined}>
        <div className="cbv-card-top">
          <div className="cbv-card-title"><span className="cbv-legal">{model.legalLabel}</span><h4 id={headingId}>{model.title}</h4></div>
          <button type="button" className="cbv-info-button" aria-label={`${model.title} erklären`} onClick={() => setShowInfo(true)}><InfoIcon /></button>
        </div>
        <div className="cbv-status-row"><span className={`cbv-badge cbv-badge--${badge.kind}`}>{badge.text}</span><span className="cbv-status">{model.statusLabel}</span></div>
        {showAmounts ? <>
          <div className={`cbv-balance${deficit ? ' cbv-balance--deficit' : ''}`}>
            <div><span className="cbv-balance-label">{deficit ? 'Budget nach Planung' : preview ? 'Mögliches Budget nach Planung' : 'Verfügbar nach Planung'}</span><strong className="cbv-amount">{money(model.availableCents)}</strong></div>
            <div className="cbv-hours"><strong>{hours(model.availableHours)}</strong><small>{model.hourlyRateCents != null && model.hourlyRateCents > 0 ? `bei ${money(model.hourlyRateCents)} / Std.` : 'Kein eindeutiger Stundensatz verfügbar.'}</small></div>
          </div>
          {deficit ? <p className="cbv-warning" role="status">Verbrauch und Planung überschreiten das Budget um {money(Math.abs(model.availableCents))}.</p> : null}
          <div className="cbv-track" role="img" aria-label={`${model.title}: Gesamt ${money(total)}, verbraucht ${money(model.usedCents)}, geplant ${money(model.reservedCents)}, verfügbar ${money(model.availableCents)}`}>
            <span className="cbv-used" style={{ width: proportion(used) }} /><span className="cbv-reserved" style={{ width: proportion(reserved) }} /><span className="cbv-available" style={{ width: proportion(available) }} />
          </div>
          <dl className="cbv-breakdown"><div><dt><span className="cbv-dot cbv-used" aria-hidden="true" />Verbraucht</dt><dd>{money(model.usedCents)}</dd></div><div><dt><span className="cbv-dot cbv-reserved" aria-hidden="true" />Geplant</dt><dd>{money(model.reservedCents)}</dd></div><div><dt>Gesamtbudget</dt><dd>{money(model.totalCents)}</dd></div></dl>
          {preview ? <p className="cbv-preview-notice">Unverbindliche Vorschau. Diese Leistung ist noch nicht vereinbart und steht nicht als gebuchtes Budget zur Verfügung.</p> : null}
          {model.id === 'umwandlung' && model.remainingCareAllowanceCents != null ? <div className="cbv-allowance"><span>Pflegegeldprognose<small>Nach erfasstem Verbrauch, ohne geplante Einsätze</small></span><strong>{money(model.remainingCareAllowanceCents)}</strong></div> : null}
          <footer className="cbv-footer"><p>{model.periodLabel}</p><p>{model.expiryLabel}</p></footer>
        </> : <div className="cbv-state" role="status"><strong>{pending ? 'Persönliches Budget wird geladen' : ineligible ? 'Voraussetzungen noch nicht erfüllt' : 'Kein verfügbares Budget bestätigt'}</strong><p>{pending ? 'Beträge erscheinen, sobald die Budgetdaten vorliegen.' : model.statusLabel}</p></div>}
      </article>
      <AppGlassModal surfaceScope="personal" visible={showInfo} title={model.title} subtitle={model.legalLabel} onClose={() => setShowInfo(false)} footerActions={[{ title: 'Schließen', variant: 'primary', onPress: () => setShowInfo(false) }]}>
        <div className="cbv-info">
          {!pending ? model.explanation.map((paragraph, index) => <p key={`${index}-${paragraph}`}>{paragraph}</p>) : null}
          {showAmounts ? <dl><div><dt>{preview ? 'Mögliches Gesamtbudget' : 'Gesamtbudget'}</dt><dd>{money(model.totalCents)}</dd></div><div><dt>Verfügbar nach Planung</dt><dd>{money(model.availableCents)}</dd></div></dl> : <p>{pending ? 'Persönliche Budgetdaten werden noch geladen.' : model.statusLabel}</p>}
        </div>
      </AppGlassModal>
    </>
  );
}

function Opportunity({ model }: { model: ClientBudgetVisualModel }) {
  const showPotential = model.bookingState === 'preview' && model.balanceKnown !== false;
  return <details className="cbv-opportunity">
    <summary>
      <span className="cbv-opportunity-title"><strong>{model.title}</strong><small>{model.legalLabel} · {status(model).text}</small></span>
      {showPotential ? <span className="cbv-opportunity-value"><strong>{money(model.totalCents)}</strong><small>mögliches Gesamtbudget</small></span> : null}
      <svg className="cbv-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </summary>
    <div className="cbv-opportunity-body"><BudgetVisualCard model={model} /></div>
  </details>;
}

export function ClientBudgetVisualCards({ models }: { models: ClientBudgetVisualModel[] }) {
  const booked = models.filter((model) => model.bookingState === 'booked');
  const opportunities = models.filter((model) => model.bookingState === 'preview' || model.bookingState === 'not_eligible');
  const pending = models.filter((model) => model.bookingState === 'loading');
  return <div className="cbv" data-budget-visuals="web-v2">
    <style>{clientBudgetVisualCardsCss}</style>
    {models.length === 0 ? <div className="cbv-empty" role="status"><strong>Budgetdaten derzeit nicht verfügbar</strong><p>Sobald die Budgetdaten vorliegen, werden sie hier angezeigt.</p></div> : null}
    {booked.length > 0 ? <section className="cbv-section" aria-label="Gebuchte Leistungen"><div className="cbv-heading"><h3>Gebuchte Leistungen <span className="cbv-count">{booked.length}</span></h3><p>Verbrauch und Planung im Überblick</p></div><div className="cbv-grid">{booked.map((model) => <BudgetVisualCard key={model.id} model={model} />)}</div></section> : null}
    {pending.length > 0 ? <section className="cbv-section" aria-label="Budgetdaten werden geladen"><div className="cbv-grid">{pending.map((model) => <BudgetVisualCard key={model.id} model={model} />)}</div></section> : null}
    {opportunities.length > 0 ? <section className="cbv-section" aria-label="Noch nicht gebuchte Leistungen"><div className="cbv-heading"><h3>Weitere Leistungen</h3><p>Voraussetzungen und mögliche Budgets ansehen</p></div><div className="cbv-opportunities">{opportunities.map((model) => <Opportunity key={model.id} model={model} />)}</div></section> : null}
  </div>;
}
