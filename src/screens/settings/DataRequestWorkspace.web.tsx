import { WebActionIcon } from '@/components/icons/WebActionIcon.web';
import { useId, type ReactNode } from 'react';
import { DATA_REQUEST_WORKSPACE_CSS } from './dataRequestWorkspaceCss.web';

export type DataRequestChoice = 'access' | 'portability' | 'correction' | 'restriction' | 'objection';
export type DataRequestExportFormat = 'json' | 'csv';
export type DataRequestHistoryItem = {
  id: string;
  requestType: string;
  status: string;
  requestNumber: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DataRequestWorkspaceProps = {
  accountLabel: string;
  contactLabel?: string;
  requestType: DataRequestChoice;
  name: string;
  email: string;
  message: string;
  onRequestTypeChange: (value: DataRequestChoice) => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitDisabled?: boolean;
  disabled: boolean;
  unavailableReason?: string | null;
  fieldErrors?: Partial<Record<'name' | 'email' | 'message', string>>;
  submitError?: string | null;
  submitSuccess?: { reference: string; receivedAt: string } | null;
  requests: readonly DataRequestHistoryItem[];
  historyLoading: boolean;
  historyRefreshing: boolean;
  historyLoadingMore: boolean;
  historyError?: string | null;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  exporting: DataRequestExportFormat | null;
  exportDisabled: boolean;
  exportDisabledReason?: string | null;
  exportError?: string | null;
  exportSuccess?: string | null;
  onExport: (format: DataRequestExportFormat) => void;
  onOpenSupport: () => void;
  onRequestDeletion: () => void;
};

type DataRequestIconName = 'request' | 'download' | 'access' | 'portability' | 'correction' | 'restriction' | 'objection' | 'history' | 'check' | 'alert' | 'chevron' | 'refresh' | 'arrow' | 'help' | 'send';

const DATA_REQUEST_ICON_PATHS: Record<DataRequestIconName, ReactNode> = {
  request: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h5" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  access: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  portability: <><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" /></>,
  correction: <><path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z" /><path d="M13 21h8" /></>,
  restriction: <><circle cx="12" cy="12" r="9" /><path d="M9 8v8M15 8v8" /></>,
  objection: <><path d="m9 3-6 6v6l6 6h6l6-6V9l-6-6Z" /><path d="M12 7v6M12 17h.01" /></>,
  history: <><path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7M12 7v5l3 2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5M5.5 8a7 7 0 0 1 12-3L20 8M4 16l2.5 3a7 7 0 0 0 12-3" /></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.2.7-1.7 1.2-1.7 2.7M12 17h.01" /></>,
  send: <><path d="m21 3-6 18-4-8-8-4Zm0 0L11 13" /></>,
};

function DataRequestIcon({ name, className }: { name: DataRequestIconName; className?: string }) {
  return <WebActionIcon className={className}>{DATA_REQUEST_ICON_PATHS[name]}</WebActionIcon>;
}

function Feedback({ error, message, id }: { error?: string | null; message?: string | null; id?: string }) {
  if (error) return <div id={id} className="cs-data-request-feedback cs-data-request-feedback--error" role="alert"><DataRequestIcon name="alert" /><span>{error}</span></div>;
  if (message) return <div id={id} className="cs-data-request-feedback cs-data-request-feedback--success" role="status"><DataRequestIcon name="check" /><span>{message}</span></div>;
  return null;
}

function formatRequestDate(value: string | null | undefined): string {
  if (!value) return 'Nicht verfügbar';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Nicht verfügbar';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(date);
}

const REQUEST_OPTIONS = [
  { value: 'access', title: 'Auskunft', description: 'Erfahren, welche personenbezogenen Daten verarbeitet werden.', icon: 'access', placeholder: 'Zum Beispiel ein Zeitraum oder die Datenbereiche, zu denen Sie Auskunft möchten.' },
  { value: 'portability', title: 'Datenübertragbarkeit', description: 'Geeignete Daten in einem übertragbaren Format anfragen.', icon: 'portability', placeholder: 'Welche Daten möchten Sie übertragen? Falls bekannt, nennen Sie das gewünschte Format.' },
  { value: 'correction', title: 'Berichtigung', description: 'Unrichtige oder unvollständige Angaben korrigieren lassen.', icon: 'correction', placeholder: 'Welche Angabe ist falsch oder unvollständig? Wie lautet die richtige Angabe?' },
  { value: 'restriction', title: 'Einschränkung', description: 'Die Verarbeitung bestimmter Daten einschränken lassen.', icon: 'restriction', placeholder: 'Welche Datenverarbeitung soll eingeschränkt werden und aus welchem Grund?' },
  { value: 'objection', title: 'Widerspruch', description: 'Einer bestimmten Verarbeitung widersprechen.', icon: 'objection', placeholder: 'Welcher Verarbeitung widersprechen Sie? Beschreiben Sie Ihr Anliegen.' },
] as const;

const REQUEST_LABELS: Record<string, string> = {
  access: 'Auskunft',
  export: 'Datenexport',
  correction: 'Berichtigung',
  deletion: 'Löschanfrage',
  restriction: 'Einschränkung',
  objection: 'Widerspruch',
  portability: 'Datenübertragbarkeit',
  consent_withdrawal: 'Widerruf einer Einwilligung',
  other: 'Weitere Datenschutzanfrage',
};

const STATUS_META: Record<string, { label: string; tone: string }> = {
  queued: { label: 'Eingegangen', tone: 'pending' },
  running: { label: 'In Bearbeitung', tone: 'progress' },
  completed: { label: 'Abgeschlossen', tone: 'complete' },
  failed: { label: 'Bearbeitung fehlgeschlagen', tone: 'rejected' },
  cancelled: { label: 'Abgebrochen', tone: 'neutral' },
};


export function DataRequestWorkspace(props: DataRequestWorkspaceProps) {
  const id = useId();
  const fieldErrors = props.fieldErrors ?? {};
  const selectedOption = REQUEST_OPTIONS.find((option) => option.value === props.requestType) ?? REQUEST_OPTIONS[0];
  const formDisabled = props.disabled || props.submitting || props.exporting !== null;
  const historyBusy = props.historyLoading || props.historyRefreshing || props.historyLoadingMore;
  const exportDisabled = props.exportDisabled || props.exporting !== null || props.submitting;
  const successMessage = props.submitSuccess
    ? `Ihre Anfrage wurde gespeichert. Referenz: ${props.submitSuccess.reference}. Eingang: ${formatRequestDate(props.submitSuccess.receivedAt)}.`
    : null;

  return (
    <div className="cs-data-request" data-testid="data-request-workspace">
      <style>{DATA_REQUEST_WORKSPACE_CSS}</style>
      <div className="cs-data-request-grid">
        <section className="cs-data-request-card" aria-labelledby={`${id}-request-heading`}>
          <div className="cs-data-request-heading">
            <span className="cs-data-request-icon-tile"><DataRequestIcon name="request" /></span>
            <div><h2 id={`${id}-request-heading`}>Datenschutzanfrage stellen</h2><p>Wählen Sie Ihr Anliegen und ergänzen Sie die Angaben für die Bearbeitung.</p></div>
          </div>

          <p className="cs-data-request-account"><span>Anfrage für Ihr Konto:</span><strong>{props.accountLabel || 'Ihr angemeldetes Konto'}</strong>{props.contactLabel ? <span>{props.contactLabel}</span> : null}</p>

          {props.unavailableReason ? <div className="cs-data-request-feedback cs-data-request-feedback--notice" role="status"><DataRequestIcon name="alert" /><span>{props.unavailableReason}</span></div> : null}

          <form noValidate onSubmit={(event) => { event.preventDefault(); if (!formDisabled && !props.submitDisabled) props.onSubmit(); }} aria-busy={props.submitting}>
            <fieldset className="cs-data-request-fieldset" disabled={formDisabled}>
              <legend className="cs-data-request-legend">Was möchten Sie anfragen?</legend>
              <div className="cs-data-request-types">
                {REQUEST_OPTIONS.map((option) => (
                  <label key={option.value} className={`cs-data-request-type${props.requestType === option.value ? ' cs-data-request-type--selected' : ''}${formDisabled ? ' cs-data-request-type--disabled' : ''}`} htmlFor={`${id}-type-${option.value}`}>
                    <input id={`${id}-type-${option.value}`} type="radio" name={`${id}-request-type`} value={option.value} checked={props.requestType === option.value} onChange={() => props.onRequestTypeChange(option.value)} />
                    <span className="cs-data-request-type-icon"><DataRequestIcon name={option.icon} /></span>
                    <span className="cs-data-request-type-copy"><strong>{option.title}</strong><span>{option.description}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="cs-data-request-contact-fields">
              <div className="cs-data-request-field">
                <div className="cs-data-request-label-line"><label htmlFor={`${id}-name`}>Name für Rückfragen</label></div>
                <input id={`${id}-name`} name="requesterName" autoComplete="name" maxLength={160} value={props.name} disabled={formDisabled} required onChange={(event) => props.onNameChange(event.currentTarget.value)} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? `${id}-name-error ${id}-contact-help` : `${id}-contact-help`} />
                {fieldErrors.name ? <span id={`${id}-name-error`} className="cs-data-request-field-error">{fieldErrors.name}</span> : null}
              </div>
              <div className="cs-data-request-field">
                <div className="cs-data-request-label-line"><label htmlFor={`${id}-email`}>E-Mail für Rückfragen</label></div>
                <input id={`${id}-email`} name="requesterEmail" type="email" inputMode="email" autoComplete="email" maxLength={254} value={props.email} disabled={formDisabled} required onChange={(event) => props.onEmailChange(event.currentTarget.value)} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? `${id}-email-error ${id}-contact-help` : `${id}-contact-help`} />
                {fieldErrors.email ? <span id={`${id}-email-error`} className="cs-data-request-field-error">{fieldErrors.email}</span> : null}
              </div>
            </div>
            <p id={`${id}-contact-help`} className="cs-data-request-help cs-data-request-contact-help">Name und E-Mail dienen als Antwortkontakt. Ihre Anfrage bleibt dem oben angezeigten Konto zugeordnet.</p>

            <div className="cs-data-request-field">
              <div className="cs-data-request-label-line"><label htmlFor={`${id}-message`}>Details zu Ihrer Anfrage</label><span id={`${id}-message-count`} className="cs-data-request-help">Optional · {props.message.length} / 4.000 Zeichen</span></div>
              <textarea id={`${id}-message`} name="requestDetails" rows={4} maxLength={4000} placeholder={selectedOption.placeholder} value={props.message} disabled={formDisabled} onChange={(event) => props.onMessageChange(event.currentTarget.value)} aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? `${id}-message-error ${id}-message-count` : `${id}-message-count`} />
              {fieldErrors.message ? <span id={`${id}-message-error`} className="cs-data-request-field-error">{fieldErrors.message}</span> : null}
            </div>

            <Feedback message={successMessage} error={props.submitError} />
            <div className="cs-data-request-form-footer">
              <p className="cs-data-request-help">Die Anfrage wird zur Bearbeitung gespeichert. Den aktuellen Status finden Sie unter „Ihre Anfragen“.</p>
              <button type="submit" className="cs-data-request-button cs-data-request-button--primary" disabled={formDisabled || props.submitDisabled}><DataRequestIcon name="send" />{props.submitting ? 'Wird eingereicht…' : 'Anfrage einreichen'}</button>
            </div>
          </form>
        </section>

        <aside className="cs-data-request-aside" aria-label="Kontodownload und weitere Anliegen">
          <section className="cs-data-request-card cs-data-request-card--export" aria-labelledby={`${id}-export-heading`}>
            <div className="cs-data-request-heading">
              <span className="cs-data-request-icon-tile cs-data-request-icon-tile--teal"><DataRequestIcon name="download" /></span>
              <div><h2 id={`${id}-export-heading`}>Kontoangaben herunterladen</h2><p>Ihre aktuellen Konto- und Profilangaben als Datei.</p></div>
            </div>
            <p className="cs-data-request-export-description">Dieser Download enthält die unten aufgeführten Angaben zu Ihrem Konto. Für weitere personenbezogene Daten können Sie eine Datenschutzanfrage stellen.</p>
            <div className="cs-data-request-export-scope">
              <h3>Enthaltene Angaben</h3>
              <ul>
                <li><DataRequestIcon name="check" /><span>Vorname, Nachname und Anzeigename</span></li>
                <li><DataRequestIcon name="check" /><span>E-Mail-Adresse und Telefonnummer</span></li>
                <li><DataRequestIcon name="check" /><span>Erstellungs- und Änderungsdatum des Profils</span></li>
              </ul>
            </div>
            <div className="cs-data-request-export-actions">
              <button type="button" className="cs-data-request-button cs-data-request-button--secondary cs-data-request-button--wide" disabled={exportDisabled} onClick={() => props.onExport('json')} aria-describedby={props.exportDisabledReason ? `${id}-export-unavailable` : `${id}-export-scope`}><DataRequestIcon name="download" />{props.exporting === 'json' ? 'JSON wird erstellt…' : 'Kontoangaben als JSON'}</button>
              <button type="button" className="cs-data-request-button cs-data-request-button--quiet cs-data-request-button--wide" disabled={exportDisabled} onClick={() => props.onExport('csv')} aria-describedby={props.exportDisabledReason ? `${id}-export-unavailable` : `${id}-export-scope`}><DataRequestIcon name="download" />{props.exporting === 'csv' ? 'CSV wird erstellt…' : 'Kontoangaben als CSV'}</button>
            </div>
            {props.exportDisabledReason ? <p id={`${id}-export-unavailable`} className="cs-data-request-help cs-data-request-export-note">{props.exportDisabledReason}</p> : null}
            <Feedback message={props.exportSuccess} error={props.exportError} />
            <p id={`${id}-export-scope`} className="cs-data-request-help cs-data-request-export-note">Begrenzter Kontodownload, keine vollständige Datenauskunft. Fachakten, Dokumente und Anhänge sind nicht enthalten. JSON eignet sich zur Weiterverarbeitung, CSV zum Öffnen in einer Tabellenkalkulation.</p>
          </section>

          <section className="cs-data-request-card" aria-labelledby={`${id}-further-heading`}>
            <div className="cs-data-request-heading">
              <span className="cs-data-request-icon-tile cs-data-request-icon-tile--violet"><DataRequestIcon name="help" /></span>
              <div><h2 id={`${id}-further-heading`}>Weitere Anliegen</h2><p>Unterstützung und Anfragen zu Ihrem Zugang.</p></div>
            </div>
            <div className="cs-data-request-links">
              <button type="button" className="cs-data-request-link" disabled={props.submitting || props.exporting !== null} onClick={props.onOpenSupport} aria-label="Hilfe & Kontakt"><span><strong>Hilfe &amp; Kontakt</strong><span>Bei Fragen zur Einreichung oder Bearbeitung</span></span><DataRequestIcon name="arrow" /></button>
              <button type="button" className="cs-data-request-link cs-data-request-link--danger" disabled={props.submitting || props.exporting !== null} onClick={props.onRequestDeletion} aria-label="Kontolöschung anfragen"><span><strong>Kontolöschung anfragen</strong><span>Eine separate Löschanfrage stellen</span></span><DataRequestIcon name="arrow" /></button>
            </div>
          </section>
        </aside>
      </div>

      <section className="cs-data-request-card cs-data-request-history" aria-labelledby={`${id}-history-heading`} aria-busy={historyBusy}>
        <div className="cs-data-request-history-heading">
          <div className="cs-data-request-heading">
            <span className="cs-data-request-icon-tile"><DataRequestIcon name="history" /></span>
            <div><h2 id={`${id}-history-heading`}>Ihre Anfragen</h2><p>Gespeicherte Anfragen Ihres Kontos, neueste zuerst.</p></div>
          </div>
          <div className="cs-data-request-history-actions">
            <button type="button" className="cs-data-request-button cs-data-request-button--quiet" disabled={historyBusy || props.submitting} onClick={props.onRefresh}><DataRequestIcon name="refresh" />{props.historyRefreshing ? 'Wird aktualisiert…' : 'Aktualisieren'}</button>
          </div>
        </div>

        <Feedback error={props.historyError} />
        {props.historyLoading ? <div className="cs-data-request-empty" role="status"><DataRequestIcon name="history" /><p>Ihre Anfragen werden geladen…</p></div> : props.requests.length === 0 && !props.historyError ? <div className="cs-data-request-empty"><DataRequestIcon name="request" /><h3>Noch keine Anfragen</h3><p>Sobald Sie eine Anfrage eingereicht haben, erscheinen hier der Eingang und der aktuelle Bearbeitungsstatus.</p></div> : null}

        {props.requests.length > 0 ? <div className="cs-data-request-list">
          {props.requests.map((request) => {
            const status = Object.prototype.hasOwnProperty.call(STATUS_META, request.status) ? STATUS_META[request.status] : { label: 'Status nicht verfügbar', tone: 'neutral' };
            const title = Object.prototype.hasOwnProperty.call(REQUEST_LABELS, request.requestType) ? REQUEST_LABELS[request.requestType] : 'Datenschutzanfrage';
            const receivedAt = request.receivedAt || request.createdAt;
            return (
              <details className="cs-data-request-item" key={request.id}>
                <summary>
                  <span className="cs-data-request-item-title"><strong>{title}</strong><span>Eingang: {formatRequestDate(receivedAt)}</span></span>
                  <span className={`cs-data-request-status cs-data-request-status--${status.tone}`}>{status.label}</span>
                  <DataRequestIcon name="chevron" className="cs-data-request-chevron" />
                </summary>
                <div className="cs-data-request-item-body">
                  <dl className="cs-data-request-item-meta">
                    <div><dt>Referenz</dt><dd>{request.requestNumber || request.id}</dd></div>
                    <div><dt>Art der Anfrage</dt><dd>{title}</dd></div>
                    <div><dt>Eingegangen am</dt><dd>{formatRequestDate(receivedAt)}</dd></div>
                    <div><dt>Zuletzt aktualisiert</dt><dd>{formatRequestDate(request.updatedAt)}</dd></div>
                  </dl>
                  {request.status === 'failed' ? <p className="cs-data-request-help cs-data-request-export-note">Die Bearbeitung ist fehlgeschlagen. Ihre Anfrage ist dadurch nicht automatisch erledigt. Bei Fragen zum weiteren Vorgehen wenden Sie sich bitte an den Support.</p> : null}
                </div>
              </details>
            );
          })}
        </div> : null}
        {props.hasMore ? <div className="cs-data-request-history-footer"><button type="button" className="cs-data-request-button cs-data-request-button--secondary" disabled={historyBusy || props.submitting} onClick={props.onLoadMore}>{props.historyLoadingMore ? 'Weitere Anfragen werden geladen…' : 'Weitere Anfragen laden'}</button></div> : null}
        <p className="cs-data-request-help cs-data-request-export-note"><strong>Regelfrist: ein Monat ab Eingang.</strong> Anfragen sind so schnell wie möglich zu beantworten. Eine erforderliche Verlängerung wird innerhalb des ersten Monats mit Begründung mitgeteilt.</p>
      </section>
    </div>
  );
}
