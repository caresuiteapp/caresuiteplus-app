/** Context matching is deliberately limited to route names: never copy record IDs or sensitive query values into help URLs. */
export function contextualHelpArticle(pathname: string): string | undefined {
  const path = pathname.split(/[?#]/, 1)[0];
  if (path === '/hilfe') return undefined;
  if (path.includes('ci-layout')) return 'dokument-logo';
  if (path.includes('document-catalog')) return 'dokument-katalog';
  if (path.includes('/documents/signatures')) return 'dokument-freigabe';
  if (path.includes('/templates/')) return 'dokument-vorlageneinstellungen';
  if (path.includes('/documents')) return 'dokument-fassung';
  if (/\/inventar|\/inventory/.test(path)) return 'inventar';
  if (path.startsWith('/unternehmen')) return 'unternehmen-stammdaten';
  if (/\/clients(?:\/|$)/.test(path)) return 'klienten-akte';
  if (/\/employees(?:\/|$)/.test(path)) return 'personal-anlegen';
  if (/\/kalender|\/calendar/.test(path)) return 'kalender-verfuegbarkeit';
  if (/^\/assist\/(?:assignments|einsaetze)\/[^/]+\/execute$/.test(path)) return 'einsatz-nachbearbeitung';
  if (/\/einsaetze|\/assignments/.test(path)) return 'einsatz-planen';
  if (path.includes('/nachweise')) return 'nachweise-pruefen';
  if (/\/fahrtenbuch|\/fahrten/.test(path)) return 'fahrtenbuch';
  if (path.includes('/time-tracking')) return 'arbeitszeit';
  if (path.includes('/payroll')) return 'gehaltsstatistik';
  if (path.includes('/invoices')) return 'rechnungen';
  if (/\/abrechnungsquellen|\/budgets/.test(path)) return 'budgets';
  if (/\/portals|\/portale/.test(path)) return 'portal-zugaenge';
  if (path.includes('/messages')) return 'nachrichten';
  if (path.includes('/notifications')) return 'benachrichtigungen';
  if (path.startsWith('/settings')) return 'profil-einstellungen';
  if (/^\/(pflege|stationaer|beratung)(\/|$)/.test(path)) return 'pflege-bereiche';
  return undefined;
}
export function helpHref(pathname = '/'): string {
  const article = contextualHelpArticle(pathname);
  return article ? `/hilfe?artikel=${encodeURIComponent(article)}` : '/hilfe';
}
