import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import { readFileSync } from 'node:fs';
import path from 'node:path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearDesktopListViewPreference,
  loadDesktopListViewPreference,
  saveDesktopListViewPreference,
} from '@/lib/preferences/desktopListViewPreference';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Desktop list view preference persistence (Sprint 38)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadDesktopListViewPreference liefert Default bei leerem Storage', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    await expect(loadDesktopListViewPreference('office.clients')).resolves.toBe('table');
  });

  it('saveDesktopListViewPreference persistiert Modus', async () => {
    await saveDesktopListViewPreference('office.clients', 'cards');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'caresuite:desktop-list-view:office.clients',
      'cards',
    );
  });

  it('loadDesktopListViewPreference liest gespeicherten Modus', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue('cards');
    await expect(loadDesktopListViewPreference('office.employees', 'table')).resolves.toBe('cards');
  });

  it('clearDesktopListViewPreference entfernt Eintrag', async () => {
    await clearDesktopListViewPreference('office.clients');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      'caresuite:desktop-list-view:office.clients',
    );
  });

  it('ClientsListView nutzt useDesktopListViewPreference', () => {
    const source = readSrc('src/components/office/ClientsListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'office.clients'");
    expect(source).not.toMatch(/useState<'cards' \| 'table'>/);
  });

  it('EmployeesListView nutzt useDesktopListViewPreference', () => {
    const source = readSrc('src/components/office/EmployeesListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'office.employees'");
    expect(source).not.toMatch(/useState<'cards' \| 'table'>/);
  });

  it('useDesktopListViewPreference lädt und speichert AsyncStorage', () => {
    const source = readSrc('src/hooks/useDesktopListViewPreference.ts');
    expect(source).toContain('loadDesktopListViewPreference');
    expect(source).toContain('saveDesktopListViewPreference');
    expect(source).toContain('ready');
  });

  it('ExecutionsListView nutzt useDesktopListViewPreference', () => {
    const source = readSrc('src/components/assist/ExecutionsListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'assist.executions'");
    expect(source).not.toMatch(/useState<'cards' \| 'table'>/);
  });

  it('TripsListView nutzt useDesktopListViewPreference', () => {
    const source = readSrc('src/components/assist/TripsListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'assist.trips'");
    expect(source).not.toMatch(/useState<'cards' \| 'table'>/);
  });

  it('ResidentsListView nutzt useDesktopListViewPreference', () => {
    const source = readSrc('src/components/stationaer/ResidentsListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'stationaer.residents'");
    expect(source).not.toMatch(/useState<'cards' \| 'table'>/);
  });

  it('CoursesListView nutzt useDesktopListViewPreference', () => {
    const source = readSrc('src/components/akademie/CoursesListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'akademie.courses'");
    expect(source).not.toMatch(/useState<'cards' \| 'table'>/);
  });

  it('CasesListView nutzt useDesktopListViewPreference (Sprint 92)', () => {
    const source = readSrc('src/components/beratung/CasesListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'beratung.cases'");
  });

  it('AssignmentsListView nutzt useDesktopListViewPreference (Sprint 92)', () => {
    const source = readSrc('src/components/assist/AssignmentsListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'assist.assignments.v2'");
  });

  it('DocumentsListView nutzt useDesktopListViewPreference (Sprint 95)', () => {
    const source = readSrc('src/components/office/DocumentsListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'office.documents'");
  });

  it('InvoicesListView nutzt useDesktopListViewPreference (Sprint 95)', () => {
    const source = readSrc('src/components/office/InvoicesListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'office.invoices'");
  });

  it('AppointmentsListView nutzt useDesktopListViewPreference (Sprint 95)', () => {
    const source = readSrc('src/components/office/AppointmentsListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'office.appointments'");
  });
});
