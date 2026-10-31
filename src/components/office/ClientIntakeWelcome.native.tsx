// Generated native presentation from src/components/office/ClientIntakeWelcome.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSvg,NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeSection,NativeStyle,NativeFieldset,NativeLegend,NativeP,NativeDiv,NativeLabel,NativeInput,NativeSpan,NativeStrong,NativeUl,NativeLi,NativeH3,NativeAside,NativeI,NativeH4,NativeSmall,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useId, type PointerEvent } from 'react';
import type { useClientIntakeWizard } from "../../hooks/useClientIntakeWizard.ts";
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import { getCatalogOptions, resolveCatalogLabel } from '@/lib/catalogs/systemCatalogService';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { CLIENT_INTAKE_PLANS } from '@/lib/clients/clientIntakePlan';
import { clientIntakeWelcomeCss } from "./clientIntakeWelcomeCss.native.ts";
type ServiceChoiceProps = {
    wizard: ReturnType<typeof useClientIntakeWizard>;
};
type DossierPreviewProps = {
    form: ClientIntakeFormData;
    isEditMode?: boolean;
};
type ServiceExplanation = {
    description: string;
    example: string;
    icon: string;
};
const serviceExplanations: Record<ClientCareContext, ServiceExplanation> = {
    daily_assistance: {
        description: 'Praktische Unterstützung im täglichen Leben.',
        example: 'Haushalt, Einkaufen und Erledigungen',
        icon: 'M3 11 12 3l9 8 M5 10v11h14V10 M9 21v-7h6v7',
    },
    support_care: {
        description: 'Zeit für persönliche Zuwendung und eine vertraute Tagesstruktur.',
        example: 'Gespräche, Beschäftigung und gemeinsame Aktivitäten',
        icon: 'M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 21v-3a6 6 0 0 1 12 0v3 M16 4a3 3 0 0 1 0 6 M18 13a5 5 0 0 1 3 5v3',
    },
    companionship: {
        description: 'Persönliche Begleitung bei Wegen und Unternehmungen.',
        example: 'Arztbesuche, Spaziergänge und Ausflüge',
        icon: 'M7 10c-2-2-3-4-3-5a3 3 0 0 1 6 0c0 1-1 3-3 5Z M17 22c-2-2-3-4-3-5a3 3 0 0 1 6 0c0 1-1 3-3 5Z M7 13v2a3 3 0 0 0 3 3h1 M17 11V9a3 3 0 0 0-3-3h-1',
    },
    ambulatory_care: {
        description: 'Pflegerische Versorgung im eigenen Zuhause.',
        example: 'Persönlicher Pflegebedarf und häusliche Versorgung',
        icon: 'M3 11 12 3l9 8 M5 10v11h14V10 M12 11v6 M9 14h6',
    },
    stationary_care: {
        description: 'Versorgung und Betreuung in einer Pflegeeinrichtung.',
        example: 'Einrichtung, Wohnbereich und persönliche Bedürfnisse',
        icon: 'M4 21V3h16v18 M2 21h20 M8 7h1 M15 7h1 M8 11h1 M15 11h1 M10 21v-6h4v6',
    },
    consulting: {
        description: 'Orientierung bei Fragen zur Versorgung und Unterstützung.',
        example: 'Beratungsanlass und weitere Schritte',
        icon: 'M21 11a8 8 0 0 1-8 8H8l-5 3V7a5 5 0 0 1 5-5h5a8 8 0 0 1 8 9Z M8 8h8 M8 12h5',
    },
    academy_prepared: {
        description: 'Vorbereiteter Bereich für Schulungen.',
        example: 'Die Auswahl aktiviert keine Schulungsfunktionen.',
        icon: 'm2 8 10-5 10 5-10 5Z M6 11v6c4 3 8 3 12 0v-6 M22 8v8',
    },
};
const serviceOptions = getCatalogOptions('leistungsart');
function serviceLabel(value: string) {
    const label = resolveCatalogLabel('leistungsart', value);
    return value === 'academy_prepared' ? label.replace(/\s+vorbereitet$/i, '') : label;
}
function ServiceIcon({ context }: {
    context: ClientCareContext;
}) {
    const path = serviceExplanations[context]?.icon ?? serviceExplanations.daily_assistance.icon;
    return <NativeWorkspaceStyleScope css={[clientIntakeWelcomeCss]}>{<NativeSvg viewBox="0 0 24 24" aria-hidden="true"><NativeSvgPath d={path}/></NativeSvg>}</NativeWorkspaceStyleScope>;
}
export function ClientIntakeServiceChoice({ wizard }: ServiceChoiceProps) {
    const id = useId();
    const { form, errors, toggleCareContext } = wizard;
    const disabled = wizard.loading || wizard.submitting || wizard.discardingDraft;
    const selectedOptions = serviceOptions.filter(option => form.careContexts.includes(option.value as ClientCareContext));
    const descriptionId = `${id}-description`;
    const errorId = `${id}-error`;
    return <NativeWorkspaceStyleScope css={[clientIntakeWelcomeCss, clientIntakeWelcomeCss]}>{<NativeSection className="ci-welcome" aria-label="Leistungsbereiche auswählen">
    <NativeStyle>{clientIntakeWelcomeCss}</NativeStyle>
    <NativeFieldset className="ci-welcome-fieldset" disabled={disabled} aria-describedby={`${descriptionId}${errors.careContexts ? ` ${errorId}` : ''}`} aria-invalid={Boolean(errors.careContexts)}>
      <NativeLegend>Welche Unterstützung wird benötigt?</NativeLegend>
      <NativeP id={descriptionId} className="ci-welcome-intro">Wählen Sie die passenden Leistungen. Mehrere Bereiche sind möglich. Die nächsten Schritte richten sich nach Ihrer Auswahl.</NativeP>
      <NativeDiv className="ci-welcome-grid">
        {serviceOptions.map(option => {
            const context = option.value as ClientCareContext;
            const selected = form.careContexts.includes(context);
            const explanation = serviceExplanations[context];
            const titleId = `${id}-${context}-title`;
            const detailId = `${id}-${context}-detail`;
            return <NativeWorkspaceStyleScope key={context} css={[clientIntakeWelcomeCss]}>{<NativeLabel key={context} className={`ci-welcome-card${selected ? ' is-selected' : ''}${context === 'academy_prepared' ? ' is-prepared' : ''}`}>
            <NativeInput type="checkbox" name="careContexts" value={context} checked={selected} onChange={() => toggleCareContext(context)} aria-labelledby={titleId} aria-describedby={`${detailId}${errors.careContexts ? ` ${errorId}` : ''}`} aria-invalid={Boolean(errors.careContexts)}/>
            <NativeSpan className="ci-welcome-card-top"><NativeSpan className="ci-welcome-icon"><ServiceIcon context={context}/></NativeSpan><NativeSpan className="ci-welcome-check" aria-hidden="true"><NativeSvg viewBox="0 0 20 20"><NativeSvgPath d="m5 10 3 3 7-7"/></NativeSvg></NativeSpan></NativeSpan>
            <NativeSpan className="ci-welcome-card-title" id={titleId}>{serviceLabel(context)}{context === 'academy_prepared' ? <NativeSpan className="ci-welcome-prepared">Vorbereitet</NativeSpan> : null}</NativeSpan>
            <NativeSpan className="ci-welcome-card-description" id={detailId}>{explanation?.description ?? option.label}<NativeSpan className="ci-welcome-example">{explanation?.example}</NativeSpan></NativeSpan>
          </NativeLabel>}</NativeWorkspaceStyleScope>;
        })}
      </NativeDiv>
    </NativeFieldset>
    {errors.careContexts ? <NativeP className="ci-welcome-error" id={errorId} role="alert">{errors.careContexts}</NativeP> : null}
    <NativeDiv className="ci-welcome-selection">
      <NativeDiv className="ci-welcome-selection-heading"><NativeSpan className="ci-welcome-selection-icon" aria-hidden="true"><NativeSvg viewBox="0 0 24 24"><NativeSvgPath d="m5 12 4 4L19 6"/></NativeSvg></NativeSpan><NativeDiv><NativeStrong>Ihre Auswahl</NativeStrong><NativeP role="status">{selectedOptions.length ? `${selectedOptions.length} ${selectedOptions.length === 1 ? 'Leistungsbereich ausgewählt' : 'Leistungsbereiche ausgewählt'}` : 'Wählen Sie mindestens einen Leistungsbereich.'}</NativeP></NativeDiv></NativeDiv>
      {selectedOptions.length ? <NativeUl className="ci-welcome-selected-list">{selectedOptions.map(option => <NativeLi key={option.value}>{serviceLabel(option.value)}{option.value === 'academy_prepared' ? ' · vorbereitet' : ''}</NativeLi>)}</NativeUl> : null}
    </NativeDiv>
    {form.intakeWorkflowVersion === 2 && selectedOptions.length > 0 ? <NativeSection className="ci-plan" aria-label="Benötigte Angaben und Unterlagen"><NativeH3>Für Ihre Auswahl vorbereiten</NativeH3><NativeP>Grunddaten und Datenschutz werden einmal erfasst. Zusätzliche Unterlagen richten sich nach dem konkreten Bedarf.</NativeP>{selectedOptions.map(option => <NativeDiv key={option.value}><NativeStrong>{serviceLabel(option.value)}</NativeStrong><NativeP>{CLIENT_INTAKE_PLANS[option.value as ClientCareContext].details}</NativeP><NativeP>{CLIENT_INTAKE_PLANS[option.value as ClientCareContext].documents}</NativeP></NativeDiv>)}</NativeSection> : null}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
function moveDossier(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        return;
    const surface = event.currentTarget;
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height)
        return;
    const horizontal = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const vertical = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    surface.style.setProperty('--ci-dossier-x', `${7 - vertical * 6}deg`);
    surface.style.setProperty('--ci-dossier-y', `${-15 + horizontal * 10}deg`);
    surface.style.setProperty('--ci-dossier-light', `${25 + horizontal * 40}%`);
}
function resetDossier(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.removeProperty('--ci-dossier-x');
    event.currentTarget.style.removeProperty('--ci-dossier-y');
    event.currentTarget.style.removeProperty('--ci-dossier-light');
}
export function ClientIntakeDossierPreview({ form, isEditMode = false }: DossierPreviewProps) {
    const fullName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ');
    const initials = `${Array.from(form.firstName.trim())[0] ?? ''}${Array.from(form.lastName.trim())[0] ?? ''}`.toLocaleUpperCase('de-DE');
    const city = form.city.trim();
    const selectedContexts = [...new Set(form.careContexts)];
    return <NativeWorkspaceStyleScope css={[clientIntakeWelcomeCss, clientIntakeWelcomeCss]}>{<NativeAside className="ci-dossier" aria-label="Vorschau der Klientenakte">
    <NativeStyle>{clientIntakeWelcomeCss}</NativeStyle>
    <NativeDiv className="ci-dossier-heading"><NativeSpan>Persönliche Klientenakte</NativeSpan><NativeSpan className="ci-dossier-preview-badge">Vorschau</NativeSpan></NativeDiv>
    <NativeDiv className="ci-dossier-stage" aria-hidden="true" onPointerMove={moveDossier} onPointerLeave={resetDossier} onPointerCancel={resetDossier}>
      <NativeDiv className="ci-dossier-halo"/>
      <NativeDiv className="ci-dossier-folder">
        <NativeDiv className="ci-dossier-back"/>
        <NativeDiv className="ci-dossier-paper ci-dossier-paper--back"><NativeI /><NativeI /><NativeI /></NativeDiv>
        <NativeDiv className="ci-dossier-paper"><NativeSpan /><NativeI /><NativeI /><NativeI /></NativeDiv>
        <NativeDiv className="ci-dossier-cover"><NativeSpan className="ci-dossier-binding"/><NativeSpan className="ci-dossier-monogram">{initials || <NativeSvg viewBox="0 0 24 24"><NativeSvgPath d="M8 9a4 4 0 1 0 8 0 4 4 0 0 0-8 0 M4 22v-2a8 8 0 0 1 16 0v2"/></NativeSvg>}</NativeSpan><NativeSpan className="ci-dossier-cover-lines"><NativeI /><NativeI /></NativeSpan></NativeDiv>
      </NativeDiv>
    </NativeDiv>
    <NativeDiv className="ci-dossier-person"><NativeSpan className="ci-dossier-caption">{isEditMode ? 'Akte bearbeiten' : 'Neue Aufnahme'}</NativeSpan><NativeH3>{fullName || 'Name noch offen'}</NativeH3><NativeP><NativeSvg viewBox="0 0 24 24" aria-hidden="true"><NativeSvgPath d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></NativeSvg>{city || 'Ort noch nicht angegeben'}</NativeP></NativeDiv>
    <NativeDiv className="ci-dossier-services"><NativeH4>Gewählte Leistungen</NativeH4>{selectedContexts.length ? <NativeUl>{selectedContexts.map(context => <NativeLi key={context}><NativeSpan className="ci-dossier-service-icon"><ServiceIcon context={context}/></NativeSpan><NativeSpan>{serviceLabel(context)}{context === 'academy_prepared' ? <NativeSmall>Vorbereitet</NativeSmall> : null}</NativeSpan></NativeLi>)}</NativeUl> : <NativeP>Ihre Leistungsbereiche erscheinen nach der Auswahl hier.</NativeP>}</NativeDiv>
    <NativeP className="ci-dossier-footnote">Diese Vorschau zeigt Ihre aktuellen Eingaben.</NativeP>
  </NativeAside>}</NativeWorkspaceStyleScope>;
}
