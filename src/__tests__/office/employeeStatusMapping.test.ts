import { describe, expect, it } from 'vitest';
import {
  mapCatalogStatusToDbStatus,
  mapDbStatusToCatalogStatus,
} from '@/lib/office/employeeStatusMapping';

describe('employeeStatusMapping', () => {
  it('maps German catalog keys to live employee_status enum', () => {
    expect(mapCatalogStatusToDbStatus('aktiv')).toBe('active');
    expect(mapCatalogStatusToDbStatus('entwurf')).toBe('draft');
    expect(mapCatalogStatusToDbStatus('krank')).toBe('sick');
    expect(mapCatalogStatusToDbStatus('urlaub')).toBe('vacation');
    expect(mapCatalogStatusToDbStatus('gesperrt')).toBe('blocked');
    expect(mapCatalogStatusToDbStatus('ausgeschieden')).toBe('terminated');
    expect(mapCatalogStatusToDbStatus('archiviert')).toBe('inactive');
  });

  it('passes through existing DB enum values', () => {
    expect(mapCatalogStatusToDbStatus('active')).toBe('active');
    expect(mapCatalogStatusToDbStatus('draft')).toBe('draft');
  });

  it('defaults unknown catalog keys to active', () => {
    expect(mapCatalogStatusToDbStatus(undefined)).toBe('active');
    expect(mapCatalogStatusToDbStatus('')).toBe('active');
    expect(mapCatalogStatusToDbStatus('unknown_key')).toBe('active');
  });

  it('maps DB enum back to catalog keys for UI', () => {
    expect(mapDbStatusToCatalogStatus('active')).toBe('aktiv');
    expect(mapDbStatusToCatalogStatus('draft')).toBe('entwurf');
    expect(mapDbStatusToCatalogStatus('sick')).toBe('krank');
    expect(mapDbStatusToCatalogStatus('vacation')).toBe('urlaub');
    expect(mapDbStatusToCatalogStatus('terminated')).toBe('ausgeschieden');
    expect(mapDbStatusToCatalogStatus('blocked')).toBe('gesperrt');
    expect(mapDbStatusToCatalogStatus('inactive')).toBe('archiviert');
  });
});
