import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearBusinessWelcomePending,
  isBusinessWelcomePending,
  markBusinessWelcomePending,
} from '@/lib/auth/businessWelcomeSession';
import { resolveTimeBasedGermanGreeting } from '@/lib/portal/engine/portalHeroCopy';

describe('businessWelcomeSession', () => {
  beforeEach(() => {
    clearBusinessWelcomePending();
  });

  it('starts without pending welcome', () => {
    expect(isBusinessWelcomePending()).toBe(false);
  });

  it('marks pending on each Verwaltung login', () => {
    markBusinessWelcomePending();
    expect(isBusinessWelcomePending()).toBe(true);
  });

  it('clears pending when welcome modal closes', () => {
    markBusinessWelcomePending();
    clearBusinessWelcomePending();
    expect(isBusinessWelcomePending()).toBe(false);
  });

  it('allows pending again on next login', () => {
    markBusinessWelcomePending();
    clearBusinessWelcomePending();
    markBusinessWelcomePending();
    expect(isBusinessWelcomePending()).toBe(true);
  });
});

describe('BusinessWelcomeModal greeting', () => {
  it('uses time-based German greeting', () => {
    expect(resolveTimeBasedGermanGreeting(new Date('2026-06-21T08:00:00'))).toBe('Guten Morgen');
    expect(resolveTimeBasedGermanGreeting(new Date('2026-06-21T14:00:00'))).toBe('Guten Tag');
    expect(resolveTimeBasedGermanGreeting(new Date('2026-06-21T21:00:00'))).toBe('Guten Abend');
  });
});
