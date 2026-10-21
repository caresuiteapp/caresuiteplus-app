import { afterEach, describe, expect, it } from 'vitest';
import {
  activateAcademyDraftScope, clearAcademyDrafts, clearPendingAcademyCommand,
  getPendingAcademyCommand, rememberPendingAcademyCommand, subscribeAcademyDrafts,
} from '@/lib/akademie/workspaceDrafts';
import type { AcademyCommand } from '@/lib/akademie/workspaceModel';

const command = (): AcademyCommand => ({ action: 'submit_quiz', requestId: 'request-a', recordId: 'enrollment-a', expectedRevision: 3, data: { answers: { question: 'option-a' } } });
afterEach(clearAcademyDrafts);

describe('academy pending command isolation', () => {
  it('keeps an immutable request across same-person route changes and rejects replacement', () => {
    activateAcademyDraftScope('tenant:user:account:learner');
    const original = command();
    expect(rememberPendingAcademyCommand('tenant:user:account:learner', original)).toBe(true);
    (original.data.answers as Record<string, string>).question = 'edited';
    activateAcademyDraftScope('tenant:user:account:learner');
    const restored = getPendingAcademyCommand('tenant:user:account:learner')!;
    expect(restored.data.answers).toEqual({ question: 'option-a' });
    expect(rememberPendingAcademyCommand('tenant:user:account:learner', { ...restored, requestId: 'replacement' })).toBe(false);
    restored.data.answers = {};
    expect(getPendingAcademyCommand('tenant:user:account:learner')!.data.answers).toEqual({ question: 'option-a' });
  });

  it('clears pending data on account switch and refuses stale completions or restores', () => {
    activateAcademyDraftScope('account-a');
    rememberPendingAcademyCommand('account-a', command());
    activateAcademyDraftScope('account-b');
    expect(getPendingAcademyCommand('account-a')).toBeNull();
    expect(rememberPendingAcademyCommand('account-a', command())).toBe(false);
    rememberPendingAcademyCommand('account-b', { ...command(), requestId: 'request-b' });
    clearPendingAcademyCommand('account-a');
    expect(getPendingAcademyCommand('account-b')?.requestId).toBe('request-b');
    clearAcademyDrafts();
    expect(getPendingAcademyCommand('account-b')).toBeNull();
  });

  it('notifies a remounted screen when an earlier route receives its acknowledgement', () => {
    activateAcademyDraftScope('same');
    rememberPendingAcademyCommand('same', command());
    const snapshots: (AcademyCommand | null)[] = [];
    const unsubscribe = subscribeAcademyDrafts(() => snapshots.push(getPendingAcademyCommand('same')));
    clearPendingAcademyCommand('same');
    unsubscribe();
    expect(snapshots).toEqual([null]);
  });
});
