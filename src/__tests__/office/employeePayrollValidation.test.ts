import { describe, expect, it } from 'vitest';
import {
  calculateProRatedVacationDays,
  deriveBankNameFromIban,
  normalizeSocialSecurityNumber,
  normalizeSteuerId,
  sumWorkDayHours,
  validateEmployeeIban,
  validateSocialSecurityNumber,
  validateSteuerId,
} from '@/lib/office/employeePayrollValidation';

describe('employeePayrollValidation', () => {
  it('validiert Steuer-ID mit 11 Ziffern', () => {
    expect(validateSteuerId('12345678901')).toBeNull();
    expect(validateSteuerId('1234567890')).toMatch(/11 Ziffern/);
    expect(normalizeSteuerId('123 456 789 01')).toBe('12345678901');
  });

  it('validiert IBAN formal und per Prüfziffer', () => {
    expect(validateEmployeeIban('DE89370400440532013000')).toBeNull();
    expect(validateEmployeeIban('DE89370400440532013001')).toMatch(/Prüfziffer/);
    expect(validateEmployeeIban('INVALID')).toMatch(/Format/);
  });

  it('validiert Sozialversicherungsnummer', () => {
    expect(validateSocialSecurityNumber('12150565M007')).toBeNull();
    expect(validateSocialSecurityNumber('12 150565 M 007')).toBeNull();
    expect(normalizeSocialSecurityNumber('12 150565 m 007')).toBe('12150565M007');
    expect(validateSocialSecurityNumber('123456789')).toMatch(/Format/);
  });

  it('leitet Banknamen aus DE-IBAN ab', () => {
    expect(deriveBankNameFromIban('DE89370400440532013000')).toBe('Commerzbank');
  });

  it('berechnet anteiligen Urlaubsanspruch im Eintrittsjahr', () => {
    expect(calculateProRatedVacationDays(30, '2026-07-01', 2026)).toBe(15);
    expect(calculateProRatedVacationDays(30, '2025-01-01', 2026)).toBe(30);
  });

  it('summiert Wochenstunden aus Tagesplan', () => {
    expect(sumWorkDayHours({ mon: 8, tue: 8, wed: 8, thu: 8, fri: 7.5, sat: 0, sun: 0 })).toBe(39.5);
  });
});
