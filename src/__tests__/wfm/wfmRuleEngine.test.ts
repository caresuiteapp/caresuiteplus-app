import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateArbzgRules, resetWfmRuleDemoStore } from '@/lib/wfm/wfmRuleEngine';
import type { WfmTimeEvent, WfmWorkSession } from '@/types/modules/wfm';

const baseSession: WfmWorkSession = {
  id: 'sess-1',
  tenantId: 'tenant-1',
  employeeId: 'emp-1',
  userId: 'user-1',
  workDate: '2026-06-28',
  status: 'office',
  workMode: 'office',
  displayStatus: 'buero',
  startedAt: '2026-06-28T06:00:00.000Z',
  endedAt: null,
  lastEventAt: '2026-06-28T06:00:00.000Z',
  grossMinutes: 660,
  netMinutes: 660,
  pauseMinutes: 0,
  isOnline: true,
};

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  resetWfmRuleDemoStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('wfmRuleEngine', () => {
  it('warnt bei über 10 Stunden', () => {
    const result = evaluateArbzgRules({ session: baseSession, events: [] });
    expect(result.violations.some((v) => v.ruleKey === 'max_daily_hours')).toBe(true);
    expect(result.trafficLight).not.toBe('green');
  });

  it('warnt bei fehlender Pause ab 6 Stunden', () => {
    const session = { ...baseSession, grossMinutes: 370, netMinutes: 370 };
    const result = evaluateArbzgRules({ session, events: [] });
    expect(result.violations.some((v) => v.ruleKey === 'break_requirement_6h')).toBe(true);
  });

  it('warnt bei Ruhezeit unter 11 Stunden', () => {
    const session = { ...baseSession, grossMinutes: 480, netMinutes: 480, startedAt: '2026-06-28T07:00:00.000Z' };
    const result = evaluateArbzgRules({
      session,
      events: [],
      previousDayEndedAt: '2026-06-27T22:00:00.000Z',
    });
    expect(result.violations.some((v) => v.ruleKey === 'min_rest_period')).toBe(true);
  });

  it('grün bei normalem Tag mit Pause', () => {
    const session = {
      ...baseSession,
      grossMinutes: 480,
      netMinutes: 450,
      pauseMinutes: 30,
    };
    const events: WfmTimeEvent[] = [
      {
        id: 'e1',
        tenantId: 't',
        employeeId: 'e',
        userId: 'u',
        eventType: 'pause_start',
        workMode: 'none',
        source: 'portal',
        occurredAt: '2026-06-28T12:00:00.000Z',
        sessionId: 'sess-1',
        note: null,
      },
      {
        id: 'e2',
        tenantId: 't',
        employeeId: 'e',
        userId: 'u',
        eventType: 'pause_end',
        workMode: 'office',
        source: 'portal',
        occurredAt: '2026-06-28T12:30:00.000Z',
        sessionId: 'sess-1',
        note: null,
      },
    ];
    const result = evaluateArbzgRules({ session, events });
    expect(result.trafficLight).toBe('green');
    expect(result.violations.length).toBe(0);
  });
});
