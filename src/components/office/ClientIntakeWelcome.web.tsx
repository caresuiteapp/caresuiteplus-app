import { useId, type PointerEvent } from 'react';
import type { useClientIntakeWizard } from '@/hooks/useClientIntakeWizard';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import { getCatalogOptions, resolveCatalogLabel } from '@/lib/catalogs/systemCatalogService';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { CLIENT_INTAKE_PLANS } from '@/lib/clients/clientIntakePlan';
import { clientIntakeWelcomeCss } from './clientIntakeWelcomeCss.web';

type ServiceChoiceProps = { wizard: ReturnType<typeof useClientIntakeWizard> };
type DossierPreviewProps = { form: ClientIntakeFormData; isEditMode?: boolean };
type ServiceExplanation = { description: string; example: string; icon: string };

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

function ServiceIcon({ context }: { context: ClientCareContext }) {
  const path = serviceExplanations[context]?.icon ?? serviceExplanations.daily_assistance.icon;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

export function ClientIntakeServiceChoice({ wizard }: ServiceChoiceProps) {
  const id = useId();
  const { form, errors, toggleCareContext } = wizard;
  const disabled = wizard.loading || wizard.submitting || wizard.discardingDraft;
  const selectedOptions = serviceOptions.filter(option => form.careContexts.includes(option.value as ClientCareContext));
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  return <section className="ci-welcome" aria-label="Leistungsbereiche auswählen">
    <style>{clientIntakeWelcomeCss}</style>
    <fieldset className="ci-welcome-fieldset" disabled={disabled} aria-describedby={`${descriptionId}${errors.careContexts ? ` ${errorId}` : ''}`} aria-invalid={Boolean(errors.careContexts)}>
      <legend>Welche Unterstützung wird benötigt?</legend>
      <p id={descriptionId} className="ci-welcome-intro">Wählen Sie die passenden Leistungen. Mehrere Bereiche sind möglich. Die nächsten Schritte richten sich nach Ihrer Auswahl.</p>
      <div className="ci-welcome-grid">
        {serviceOptions.map(option => {
          const context = option.value as ClientCareContext;
          const selected = form.careContexts.includes(context);
          const explanation = serviceExplanations[context];
          const titleId = `${id}-${context}-title`;
          const detailId = `${id}-${context}-detail`;
          return <label key={context} className={`ci-welcome-card${selected ? ' is-selected' : ''}${context === 'academy_prepared' ? ' is-prepared' : ''}`}>
            <input type="checkbox" name="careContexts" value={context} checked={selected} onChange={() => toggleCareContext(context)} aria-labelledby={titleId} aria-describedby={`${detailId}${errors.careContexts ? ` ${errorId}` : ''}`} aria-invalid={Boolean(errors.careContexts)} />
            <span className="ci-welcome-card-top"><span className="ci-welcome-icon"><ServiceIcon context={context} /></span><span className="ci-welcome-check" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m5 10 3 3 7-7" /></svg></span></span>
            <span className="ci-welcome-card-title" id={titleId}>{serviceLabel(context)}{context === 'academy_prepared' ? <span className="ci-welcome-prepared">Vorbereitet</span> : null}</span>
            <span className="ci-welcome-card-description" id={detailId}>{explanation?.description ?? option.label}<span className="ci-welcome-example">{explanation?.example}</span></span>
          </label>;
        })}
      </div>
    </fieldset>
    {errors.careContexts ? <p className="ci-welcome-error" id={errorId} role="alert">{errors.careContexts}</p> : null}
    <div className="ci-welcome-selection">
      <div className="ci-welcome-selection-heading"><span className="ci-welcome-selection-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg></span><div><strong>Ihre Auswahl</strong><p role="status">{selectedOptions.length ? `${selectedOptions.length} ${selectedOptions.length === 1 ? 'Leistungsbereich ausgewählt' : 'Leistungsbereiche ausgewählt'}` : 'Wählen Sie mindestens einen Leistungsbereich.'}</p></div></div>
      {selectedOptions.length ? <ul className="ci-welcome-selected-list">{selectedOptions.map(option => <li key={option.value}>{serviceLabel(option.value)}{option.value === 'academy_prepared' ? ' · vorbereitet' : ''}</li>)}</ul> : null}
    </div>
    {form.intakeWorkflowVersion === 2 && selectedOptions.length > 0 ? <section className="ci-plan" aria-label="Benötigte Angaben und Unterlagen"><h3>Für Ihre Auswahl vorbereiten</h3><p>Grunddaten und Datenschutz werden einmal erfasst. Zusätzliche Unterlagen richten sich nach dem konkreten Bedarf.</p>{selectedOptions.map(option => <div key={option.value}><strong>{serviceLabel(option.value)}</strong><p>{CLIENT_INTAKE_PLANS[option.value as ClientCareContext].details}</p><p>{CLIENT_INTAKE_PLANS[option.value as ClientCareContext].documents}</p></div>)}</section> : null}
  </section>;
}

function moveDossier(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== 'mouse' || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const surface = event.currentTarget;
  const rect = surface.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
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
  return <aside className="ci-dossier" aria-label="Vorschau der Klientenakte">
    <style>{clientIntakeWelcomeCss}</style>
    <div className="ci-dossier-heading"><span>Persönliche Klientenakte</span><span className="ci-dossier-preview-badge">Vorschau</span></div>
    <div className="ci-dossier-stage" aria-hidden="true" onPointerMove={moveDossier} onPointerLeave={resetDossier} onPointerCancel={resetDossier}>
      <div className="ci-dossier-halo" />
      <div className="ci-dossier-folder">
        <div className="ci-dossier-back" />
        <div className="ci-dossier-paper ci-dossier-paper--back"><i /><i /><i /></div>
        <div className="ci-dossier-paper"><span /><i /><i /><i /></div>
        <div className="ci-dossier-cover"><span className="ci-dossier-binding" /><span className="ci-dossier-monogram">{initials || <svg viewBox="0 0 24 24"><path d="M8 9a4 4 0 1 0 8 0 4 4 0 0 0-8 0 M4 22v-2a8 8 0 0 1 16 0v2" /></svg>}</span><span className="ci-dossier-cover-lines"><i /><i /></span></div>
      </div>
    </div>
    <div className="ci-dossier-person"><span className="ci-dossier-caption">{isEditMode ? 'Akte bearbeiten' : 'Neue Aufnahme'}</span><h3>{fullName || 'Name noch offen'}</h3><p><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>{city || 'Ort noch nicht angegeben'}</p></div>
    <div className="ci-dossier-services"><h4>Gewählte Leistungen</h4>{selectedContexts.length ? <ul>{selectedContexts.map(context => <li key={context}><span className="ci-dossier-service-icon"><ServiceIcon context={context} /></span><span>{serviceLabel(context)}{context === 'academy_prepared' ? <small>Vorbereitet</small> : null}</span></li>)}</ul> : <p>Ihre Leistungsbereiche erscheinen nach der Auswahl hier.</p>}</div>
    <p className="ci-dossier-footnote">Diese Vorschau zeigt Ihre aktuellen Eingaben.</p>
  </aside>;
}
