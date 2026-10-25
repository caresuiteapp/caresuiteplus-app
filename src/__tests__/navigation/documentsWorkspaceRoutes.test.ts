import { describe, expect, it } from 'vitest';
import { Platform } from 'react-native';
import { canonicalDocumentsWorkspaceHref, documentsWorkspaceRouteTitle } from '@/lib/navigation/documentsWorkspaceRoutes';
import { buildDesktopApps } from '@/liquid-command/navigation/desktopAppCatalogModel';
import { buildModuleDesktopNavigation, desktopModuleForRoute, normalizeNavigationApp } from '@/liquid-command/navigation/moduleDesktopModel';

const app = (route: string, id = route) => ({ id, route, label: 'Alte Dokumente', description: '', category: 'Verwaltung' as const });

describe('document workspace navigation', () => {
  it('keeps bookmark context while merging only known root aliases', () => {
    expect(canonicalDocumentsWorkspaceHref('/business/templates/?clientId=c-1&tab=records#saved')).toBe('/business/office/document-catalog?clientId=c-1&tab=records#saved');
    expect(canonicalDocumentsWorkspaceHref('/office/documents')).toBe('/business/office/documents');
    expect(canonicalDocumentsWorkspaceHref('/business/templates/message-templates')).toBeNull();
    expect(canonicalDocumentsWorkspaceHref('/business/office/modules/templates')).toBeNull();
    expect(canonicalDocumentsWorkspaceHref('/business/office/modules/documents')).toBeNull();
    expect(canonicalDocumentsWorkspaceHref('/business/office/documents/document-42')).toBeNull();
    expect(canonicalDocumentsWorkspaceHref('/office/documents-old')).toBeNull();
  });

  it('keeps existing widget IDs and presents one app for each document destination', () => {
    const original = app('/business/templates', 'saved-template-widget');
    const apps = buildDesktopApps([original, app('/business/office/document-catalog'), app('/office/documents'), app('/business/office/documents')], 'business_admin');
    const catalogs = apps.filter(item => item.route === '/business/office/document-catalog');
    expect(catalogs).toHaveLength(1);
    expect(catalogs[0]).toMatchObject({ id: 'saved-template-widget', label: 'Dokumentenkatalog' });
    expect(apps.filter(item => item.route === '/business/office/documents')).toHaveLength(1);
    expect(original.route).toBe('/business/templates');
    const menu = buildModuleDesktopNavigation(apps, 'office').flatMap(group => group.items);
    expect(menu.some(item => item.route === '/business/templates/documents-hub')).toBe(true);
  });

  it('shows understandable headings instead of technical route IDs', () => {
    expect(documentsWorkspaceRouteTitle('/business/office/documents/signatures/uuid-123?source=portal')).toBe('Unterschrift prüfen');
    expect(documentsWorkspaceRouteTitle('/business/office/documents/upload')).toBe('Dokument hochladen');
    expect(documentsWorkspaceRouteTitle('/business/office/documents/uuid-456')).toBe('Dokument ansehen');
    expect(documentsWorkspaceRouteTitle('/business/templates/documents-hub')).toBe('Vorlageneinstellungen');
    expect(documentsWorkspaceRouteTitle('/business/templates/template-1/edit')).toBe('Vorlage bearbeiten');
    expect(documentsWorkspaceRouteTitle('/business/office/clients/uuid-789')).toBeNull();
  });

  it('uses the current document workspace on Android', () => {
    const original = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
    Object.defineProperty(Platform, 'OS', { ...original, value: 'android' });
    try {
      expect(normalizeNavigationApp(app('/business/templates')).route).toBe('/business/office/document-catalog');
      expect(normalizeNavigationApp(app('/office/documents')).route).toBe('/business/office/documents');
      expect(desktopModuleForRoute('/business/templates/documents-hub')).toBe('office');
      expect(buildDesktopApps([], 'business_admin').some(item => item.id === 'document-settings')).toBe(true);
    } finally { Object.defineProperty(Platform, 'OS', original); }
  });
});
