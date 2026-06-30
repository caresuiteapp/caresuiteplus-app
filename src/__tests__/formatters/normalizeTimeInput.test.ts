import { describe, expect, it } from 'vitest';
import { isNormalizedTimeInput, normalizeTimeInput } from '@/lib/formatters/normalizeTimeInput';

describe('normalizeTimeInput', () => {
  it('formats 4-digit compact input', () => {
    expect(normalizeTimeInput('1530')).toBe('15:30');
    expect(normalizeTimeInput('0930')).toBe('09:30');
    expect(normalizeTimeInput('0000')).toBe('00:00');
    expect(normalizeTimeInput('2359')).toBe('23:59');
  });

  it('formats 3-digit compact input', () => {
    expect(normalizeTimeInput('930')).toBe('09:30');
    expect(normalizeTimeInput('830')).toBe('08:30');
  });

  it('keeps valid HH:MM input', () => {
    expect(normalizeTimeInput('12:30')).toBe('12:30');
    expect(normalizeTimeInput('09:00')).toBe('09:00');
  });

  it('pads single-digit hours in colon format', () => {
    expect(normalizeTimeInput('9:30')).toBe('09:30');
  });

  it('converts dot separator to colon', () => {
    expect(normalizeTimeInput('12.30')).toBe('12:30');
    expect(normalizeTimeInput('9.05')).toBe('09:05');
  });

  it('returns invalid input unchanged', () => {
    expect(normalizeTimeInput('25:00')).toBe('25:00');
    expect(normalizeTimeInput('12:60')).toBe('12:60');
    expect(normalizeTimeInput('2460')).toBe('2460');
    expect(normalizeTimeInput('abc')).toBe('abc');
    expect(normalizeTimeInput('12')).toBe('12');
  });

  it('handles empty input', () => {
    expect(normalizeTimeInput('')).toBe('');
    expect(normalizeTimeInput('   ')).toBe('');
  });
});

describe('isNormalizedTimeInput', () => {
  it('accepts valid normalized times', () => {
    expect(isNormalizedTimeInput('15:30')).toBe(true);
    expect(isNormalizedTimeInput('09:00')).toBe(true);
  });

  it('rejects non-normalized or invalid times', () => {
    expect(isNormalizedTimeInput('9:30')).toBe(false);
    expect(isNormalizedTimeInput('1530')).toBe(false);
    expect(isNormalizedTimeInput('25:00')).toBe(false);
  });
});
