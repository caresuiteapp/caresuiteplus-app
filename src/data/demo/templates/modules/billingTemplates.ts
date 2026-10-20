import { batchTpl, seriesTpl } from '../helpers';

const INVOICE = batchTpl('tpl-bill-inv', 'billing', 'invoice_text', [
  { title: 'Rechnungskopf Standard', content: 'Rechnung Nr. {{invoiceNumber}} gemäß §14 UStG — Leistungszeitraum {{period}}.', categoryKey: 'invoice' },
  { title: 'Rechnung SGB XI', content: 'Abrechnung SGB XI Leistungen für {{clientName}} — {{month}}.', categoryKey: 'invoice' },
  { title: 'Rechnung privat', content: 'Private Leistungsabrechnung {{clientName}} — Betrag {{amount}} €.', categoryKey: 'invoice' },
  { title: 'Rechnung Entlastungsleistung', content: 'Entlastungsleistungen nach §45b SGB XI — {{clientName}}.', categoryKey: 'invoice' },
  { title: 'Rechnung Verhinderungspflege', content: 'Verhinderungspflege {{clientName}} — Zeitraum {{period}}.', categoryKey: 'invoice' },
  { title: 'Gutschrift', content: 'Gutschrift Nr. {{creditNumber}} über {{amount}} € an {{clientName}}.', categoryKey: 'invoice' },
]);

const POSITIONS = seriesTpl(
  'tpl-bill-pos',
  'billing',
  'documentation_text',
  'positions',
  ['Grundpflege', 'Hauswirtschaft', 'Betreuung', 'Behandlungspflege', 'Fahrtkosten', 'Material', 'Zuschlag Wochenende', 'Zuschlag Feiertag'],
  (title) => `Position ${title}: {{serviceName}} — {{amount}} €, {{clientName}}.`,
);

const DUNNING = batchTpl('tpl-bill-dun', 'billing', 'dunning_text', [
  { title: 'Mahnung Stufe 1', content: 'Freundliche Erinnerung: Rechnung {{invoiceNumber}} über {{amount}} € ist fällig seit {{dueDate}}.', categoryKey: 'dunning' },
  { title: 'Mahnung Stufe 2', content: 'Zweite Mahnung: Bitte begleichen Sie {{amount}} € bis {{dueDate}}.', categoryKey: 'dunning' },
  { title: 'Mahnung Stufe 3', content: 'Letzte Mahnung vor weiteren Schritten — Rechnung {{invoiceNumber}}.', categoryKey: 'dunning' },
  { title: 'Mahnung Kostenträger', content: 'Mahnung an {{careFundName}} — Rechnung {{invoiceNumber}}.', categoryKey: 'dunning' },
]);

const PAYMENT_STATUS = seriesTpl(
  'tpl-bill-pay',
  'billing',
  'dropdown_value',
  'payment_status',
  ['Offen', 'Teilbezahlt', 'Bezahlt', 'Überfällig', 'Storniert', 'In Klärung'],
  (title) => title.toLowerCase().replace(/\s/g, '_'),
);

export const BILLING_TEMPLATES = [...INVOICE, ...POSITIONS, ...DUNNING, ...PAYMENT_STATUS];
