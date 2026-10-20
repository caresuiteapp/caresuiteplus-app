export const DOCUMENT_CATALOG_ROUTE = '/business/office/document-catalog';
export const DOCUMENT_LIBRARY_ROUTE = '/business/office/documents';
export const DOCUMENT_SIGNATURES_ROUTE = '/business/office/documents/signatures';
export const DOCUMENT_SETTINGS_ROUTE = '/business/templates/documents-hub';

/** Web navigation keeps old bookmarks useful without retaining duplicate apps. */
export function canonicalDocumentsWorkspaceHref(href: string): string | null {
  const [pathAndQuery, hash] = href.split('#', 2);
  const [rawPath, query] = pathAndQuery.split('?', 2);
  const path = rawPath.replace(/\/$/, '');
  const routes: Record<string, string> = {
    '/business/templates': DOCUMENT_CATALOG_ROUTE,
    '/business/office/templates': DOCUMENT_CATALOG_ROUTE,
    '/office/document-catalog': DOCUMENT_CATALOG_ROUTE,
    '/office/documents': DOCUMENT_LIBRARY_ROUTE,
    '/business/documents': DOCUMENT_LIBRARY_ROUTE,
    '/office/documents-signatures': DOCUMENT_SIGNATURES_ROUTE,
  };
  const target = routes[path];
  return target ? `${target}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}` : null;
}

export function documentsWorkspaceRouteTitle(pathname: string): string | null {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/$/, '');
  if (path === DOCUMENT_CATALOG_ROUTE || path === '/office/document-catalog') return 'Dokumentenkatalog';
  if (path === DOCUMENT_LIBRARY_ROUTE || path === '/office/documents') return 'Dokumentenablage';
  if (path === DOCUMENT_SIGNATURES_ROUTE || path === '/office/documents-signatures') return 'Unterschriften';
  if (path.startsWith(`${DOCUMENT_SIGNATURES_ROUTE}/`)) return 'Unterschrift prüfen';
  if (path === `${DOCUMENT_LIBRARY_ROUTE}/categories`) return 'Auswahlwerte';
  if (/^\/(?:business\/)?office\/documents\/upload$/.test(path)) return 'Dokument hochladen';
  if (/^\/(?:business\/)?office\/documents\/[^/]+$/.test(path)) return 'Dokument ansehen';
  const templates: Record<string, string> = {
    '/business/office/modules/templates': 'Vorlagenzuordnung',
    '/business/office/modules/documents': 'Dokumentzuordnung',
    '/business/templates': 'Dokumentenkatalog',
    '/business/office/templates': 'Dokumentenkatalog',
    '/business/templates/documents-hub': 'Vorlageneinstellungen',
    '/business/templates/document-templates-html': 'Bestehende Dokumentvorlagen',
    '/business/templates/text-blocks': 'Textbausteine',
    '/business/templates/message-templates': 'Nachrichtenvorlagen',
    '/business/templates/tenant': 'Eigene Vorlagen',
    '/business/templates/ci-layout': 'Briefkopf und Layout',
    '/business/templates/placeholders': 'Datenfelder',
    '/business/templates/settings': 'Vorlageneinstellungen',
    '/business/templates/catalogs': 'Auswahlwerte',
    '/business/templates/categories': 'Kategorien',
    '/business/templates/create': 'Vorlage anlegen',
    '/business/templates/document-inbox': 'Dokumentenablage',
  };
  if (templates[path]) return templates[path];
  if (/^\/business\/templates\/(?:document-editor\/)?[^/]+\/edit$/.test(path)) return 'Vorlage bearbeiten';
  if (/^\/business\/templates\/(?:document-editor\/)?[^/]+$/.test(path)) return 'Vorlage ansehen';
  return null;
}
