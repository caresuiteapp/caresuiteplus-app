// Generated native presentation from src/components/office/ClientBudgetVisualCards.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgCircle,NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeArticle,NativeDiv,NativeSpan,NativeH4,NativeButton,NativeStrong,NativeSmall,NativeP,NativeDl,NativeDt,NativeDd,NativeFooter,NativeDetails,NativeSummary,NativeStyle,NativeSection,NativeH3,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import { useId, useState } from 'react';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import type { ClientBudgetVisualModel } from "../../lib/assist/clientBudgetVisuals.native.ts";
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { clientBudgetVisualCardsCss } from "./clientBudgetVisualCardsCss.native.ts";
function money(value: number) {
    return formatCurrency(value, true);
}
function hours(value: number | null) {
    return value == null ? 'Keine Stundenprognose' : `${Math.max(0, value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Std.`;
}
function status(model: ClientBudgetVisualModel) {
    if (model.bookingState === 'loading')
        return { text: 'Wird geladen', kind: 'loading' };
    if (model.bookingState === 'not_eligible')
        return { text: 'Nicht verfügbar', kind: 'not_eligible' };
    if (model.bookingState === 'preview')
        return { text: 'Nicht gebucht', kind: 'preview' };
    if (!model.enabled)
        return { text: 'Aktivierung offen', kind: 'pending' };
    return { text: 'Gebucht', kind: 'booked' };
}
function InfoIcon() {
    return <NativeWorkspaceStyleScope css={[clientBudgetVisualCardsCss]}>{<WebActionIcon><NativeSvgCircle cx="12" cy="12" r="9"/><NativeSvgPath d="M12 11v6"/><NativeSvgCircle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none"/></WebActionIcon>}</NativeWorkspaceStyleScope>;
}
function BudgetVisualCard({ model }: {
    model: ClientBudgetVisualModel;
}) {
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
    return <NativeWorkspaceStyleScope css={[clientBudgetVisualCardsCss]}>{(<>
      <NativeArticle className={`cbv-card cbv-card--${model.id}`} aria-labelledby={headingId} aria-busy={pending || undefined}>
        <NativeDiv className="cbv-card-top">
          <NativeDiv className="cbv-card-title"><NativeSpan className="cbv-legal">{model.legalLabel}</NativeSpan><NativeH4 id={headingId}>{model.title}</NativeH4></NativeDiv>
          <NativeButton type="button" className="cbv-info-button" aria-label={`${model.title} erklären`} onClick={() => setShowInfo(true)}><InfoIcon /></NativeButton>
        </NativeDiv>
        <NativeDiv className="cbv-status-row"><NativeSpan className={`cbv-badge cbv-badge--${badge.kind}`}>{badge.text}</NativeSpan><NativeSpan className="cbv-status">{model.statusLabel}</NativeSpan></NativeDiv>
        {showAmounts ? <>
          <NativeDiv className={`cbv-balance${deficit ? ' cbv-balance--deficit' : ''}`}>
            <NativeDiv><NativeSpan className="cbv-balance-label">{deficit ? 'Budget nach Planung' : preview ? 'Mögliches Budget nach Planung' : 'Verfügbar nach Planung'}</NativeSpan><NativeStrong className="cbv-amount">{money(model.availableCents)}</NativeStrong></NativeDiv>
            <NativeDiv className="cbv-hours"><NativeStrong>{hours(model.availableHours)}</NativeStrong><NativeSmall>{model.hourlyRateCents != null && model.hourlyRateCents > 0 ? `bei ${money(model.hourlyRateCents)} / Std.` : 'Kein eindeutiger Stundensatz verfügbar.'}</NativeSmall></NativeDiv>
          </NativeDiv>
          {deficit ? <NativeP className="cbv-warning" role="status">Verbrauch und Planung überschreiten das Budget um {money(Math.abs(model.availableCents))}.</NativeP> : null}
          <NativeDiv className="cbv-track" role="img" aria-label={`${model.title}: Gesamt ${money(total)}, verbraucht ${money(model.usedCents)}, geplant ${money(model.reservedCents)}, verfügbar ${money(model.availableCents)}`}>
            <NativeSpan className="cbv-used" style={{ width: proportion(used) }}/><NativeSpan className="cbv-reserved" style={{ width: proportion(reserved) }}/><NativeSpan className="cbv-available" style={{ width: proportion(available) }}/>
          </NativeDiv>
          <NativeDl className="cbv-breakdown"><NativeDiv><NativeDt><NativeSpan className="cbv-dot cbv-used" aria-hidden="true"/>Verbraucht</NativeDt><NativeDd>{money(model.usedCents)}</NativeDd></NativeDiv><NativeDiv><NativeDt><NativeSpan className="cbv-dot cbv-reserved" aria-hidden="true"/>Geplant</NativeDt><NativeDd>{money(model.reservedCents)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Gesamtbudget</NativeDt><NativeDd>{money(model.totalCents)}</NativeDd></NativeDiv></NativeDl>
          {preview ? <NativeP className="cbv-preview-notice">Unverbindliche Vorschau. Diese Leistung ist noch nicht vereinbart und steht nicht als gebuchtes Budget zur Verfügung.</NativeP> : null}
          {model.id === 'umwandlung' && model.remainingCareAllowanceCents != null ? <NativeDiv className="cbv-allowance"><NativeSpan>Pflegegeldprognose<NativeSmall>Nach erfasstem Verbrauch, ohne geplante Einsätze</NativeSmall></NativeSpan><NativeStrong>{money(model.remainingCareAllowanceCents)}</NativeStrong></NativeDiv> : null}
          <NativeFooter className="cbv-footer"><NativeP>{model.periodLabel}</NativeP><NativeP>{model.expiryLabel}</NativeP></NativeFooter>
        </> : <NativeDiv className="cbv-state" role="status"><NativeStrong>{pending ? 'Persönliches Budget wird geladen' : ineligible ? 'Voraussetzungen noch nicht erfüllt' : 'Kein verfügbares Budget bestätigt'}</NativeStrong><NativeP>{pending ? 'Beträge erscheinen, sobald die Budgetdaten vorliegen.' : model.statusLabel}</NativeP></NativeDiv>}
      </NativeArticle>
      <AppGlassModal surfaceScope="personal" visible={showInfo} title={model.title} subtitle={model.legalLabel} onClose={() => setShowInfo(false)} footerActions={[{ title: 'Schließen', variant: 'primary', onPress: () => setShowInfo(false) }]}>
        <NativeDiv className="cbv-info">
          {!pending ? model.explanation.map((paragraph, index) => <NativeP key={`${index}-${paragraph}`}>{paragraph}</NativeP>) : null}
          {showAmounts ? <NativeDl><NativeDiv><NativeDt>{preview ? 'Mögliches Gesamtbudget' : 'Gesamtbudget'}</NativeDt><NativeDd>{money(model.totalCents)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Verfügbar nach Planung</NativeDt><NativeDd>{money(model.availableCents)}</NativeDd></NativeDiv></NativeDl> : <NativeP>{pending ? 'Persönliche Budgetdaten werden noch geladen.' : model.statusLabel}</NativeP>}
        </NativeDiv>
      </AppGlassModal>
    </>)}</NativeWorkspaceStyleScope>;
}
function Opportunity({ model }: {
    model: ClientBudgetVisualModel;
}) {
    const showPotential = model.bookingState === 'preview' && model.balanceKnown !== false;
    return <NativeWorkspaceStyleScope css={[clientBudgetVisualCardsCss]}>{<NativeDetails className="cbv-opportunity">
    <NativeSummary>
      <NativeSpan className="cbv-opportunity-title"><NativeStrong>{model.title}</NativeStrong><NativeSmall>{model.legalLabel} · {status(model).text}</NativeSmall></NativeSpan>
      {showPotential ? <NativeSpan className="cbv-opportunity-value"><NativeStrong>{money(model.totalCents)}</NativeStrong><NativeSmall>mögliches Gesamtbudget</NativeSmall></NativeSpan> : null}
      <WebActionIcon className="cbv-chevron"><NativeSvgPath d="m6 9 6 6 6-6"/></WebActionIcon>
    </NativeSummary>
    <NativeDiv className="cbv-opportunity-body"><BudgetVisualCard model={model}/></NativeDiv>
  </NativeDetails>}</NativeWorkspaceStyleScope>;
}
export function ClientBudgetVisualCards({ models }: {
    models: ClientBudgetVisualModel[];
}) {
    const booked = models.filter((model) => model.bookingState === 'booked');
    const opportunities = models.filter((model) => model.bookingState === 'preview' || model.bookingState === 'not_eligible');
    const pending = models.filter((model) => model.bookingState === 'loading');
    return <NativeWorkspaceStyleScope css={[clientBudgetVisualCardsCss, clientBudgetVisualCardsCss]}>{<NativeDiv className="cbv" data-budget-visuals="web-v2">
    <NativeStyle>{clientBudgetVisualCardsCss}</NativeStyle>
    {models.length === 0 ? <NativeDiv className="cbv-empty" role="status"><NativeStrong>Budgetdaten derzeit nicht verfügbar</NativeStrong><NativeP>Sobald die Budgetdaten vorliegen, werden sie hier angezeigt.</NativeP></NativeDiv> : null}
    {booked.length > 0 ? <NativeSection className="cbv-section" aria-label="Gebuchte Leistungen"><NativeDiv className="cbv-heading"><NativeH3>Gebuchte Leistungen <NativeSpan className="cbv-count">{booked.length}</NativeSpan></NativeH3><NativeP>Verbrauch und Planung im Überblick</NativeP></NativeDiv><NativeDiv className="cbv-grid">{booked.map((model) => <BudgetVisualCard key={model.id} model={model}/>)}</NativeDiv></NativeSection> : null}
    {pending.length > 0 ? <NativeSection className="cbv-section" aria-label="Budgetdaten werden geladen"><NativeDiv className="cbv-grid">{pending.map((model) => <BudgetVisualCard key={model.id} model={model}/>)}</NativeDiv></NativeSection> : null}
    {opportunities.length > 0 ? <NativeSection className="cbv-section" aria-label="Noch nicht gebuchte Leistungen"><NativeDiv className="cbv-heading"><NativeH3>Weitere Leistungen</NativeH3><NativeP>Voraussetzungen und mögliche Budgets ansehen</NativeP></NativeDiv><NativeDiv className="cbv-opportunities">{opportunities.map((model) => <Opportunity key={model.id} model={model}/>)}</NativeDiv></NativeSection> : null}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
