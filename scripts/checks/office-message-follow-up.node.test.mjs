import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planOfficeMessageOpen,
  projectOfficeMessageFollowUp,
} from '../../src/lib/office/messageFollowUpState.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const time = (n) => `2026-10-14T10:00:0${n}.12345${n}Z`;
const message = (n, senderType, overrides = {}) => ({
  id: id(100 + n), tenantId: id(1), threadId: id(2), body: `Original ${n}`,
  senderType, senderProfileId: senderType === 'office_profile' ? id(9) : null,
  senderClientId: senderType === 'client_portal' ? id(3) : null,
  senderEmployeeId: senderType === 'employee_portal' ? id(4) : null,
  senderDisplayName: 'Originalperson', isInternalNote: false, isSystemMessage: false,
  sentAt: time(n), readAt: null, status: 'sent', createdAt: time(n), updatedAt: time(n),
  ...overrides,
});
const thread = (messages, overrides = {}) => ({
  id: id(2), tenantId: id(1), threadType: 'client_office', status: 'received', priority: 'normal',
  subject: 'Originalanfrage', categoryId: null, categoryLabel: null, clientId: id(3), clientName: null,
  employeeId: null, employeeName: null, participantName: null, assignedToUserId: null,
  assignedToUserName: null, assignedAt: null, closedAt: null, closedByUserId: null,
  participantProfileIds: [], lastMessageAt: messages.at(-1)?.sentAt ?? null,
  lastMessagePreview: null, unreadCount: 1, archivedAt: null, createdAt: time(0), updatedAt: time(0),
  messages, canReply: true, isClosed: false, ...overrides,
});

test('opening and reading a received inquiry never starts or completes its task', () => {
  const input = thread([message(1, 'client_portal', { readAt: time(2), status: 'read' })]);
  const plan = planOfficeMessageOpen(input);
  const state = projectOfficeMessageFollowUp(input);
  assert.deepEqual(plan, { markMessagesRead: true, workflowStatusUpdate: null });
  assert.equal(state.workflowStatus, 'received');
  assert.equal(state.readReceiptCount, 1);
  assert.equal(state.taskCompletion, 'not_determined');
  assert.deepEqual(state.openFollowUps, ['assign_owner', 'contact_recipient']);
});

test('actual contact attempt and actual reply remain separate open facts', () => {
  const input = thread([
    message(1, 'client_portal'),
    message(2, 'office_profile', { readAt: time(3), status: 'read' }),
    message(4, 'client_portal'),
  ], { status: 'in_progress', assignedToUserId: id(9), unreadCount: 0 });
  const state = projectOfficeMessageFollowUp(input);
  assert.equal(state.inquiry?.id, id(101));
  assert.deepEqual(state.contactAttempts.map((item) => item.id), [id(102)]);
  assert.deepEqual(state.responses.map((item) => item.id), [id(104)]);
  assert.deepEqual(state.openFollowUps, ['process_response']);
  assert.equal(state.taskCompletion, 'not_determined');
  assert.equal(planOfficeMessageOpen(input).workflowStatusUpdate, null);
});

test('a read contact without reply stays awaiting response and not completed', () => {
  const state = projectOfficeMessageFollowUp(thread([
    message(1, 'client_portal'),
    message(2, 'office_profile', { readAt: time(3), status: 'read' }),
  ], { status: 'waiting_for_reply', assignedToUserId: id(9), unreadCount: 0 }));
  assert.deepEqual(state.openFollowUps, ['await_response']);
  assert.equal(state.communicationClosure, 'open');
  assert.equal(state.taskCompletion, 'not_determined');
});

test('only explicit bound closure confirms communication closure, never task completion', () => {
  const closed = projectOfficeMessageFollowUp(thread([
    message(1, 'client_portal'), message(2, 'office_profile'), message(3, 'client_portal'),
  ], { status: 'closed', closedAt: time(4), closedByUserId: id(9), unreadCount: 0, isClosed: true }));
  assert.equal(closed.communicationClosure, 'confirmed');
  assert.deepEqual(closed.openFollowUps, []);
  assert.equal(closed.taskCompletion, 'not_determined');

  const incomplete = projectOfficeMessageFollowUp(thread([message(1, 'client_portal')], {
    status: 'closed', unreadCount: 0, isClosed: true,
  }));
  assert.equal(incomplete.communicationClosure, 'unconfirmed');
  assert.deepEqual(incomplete.openFollowUps, ['confirm_communication_closure']);
});

test('foreign, duplicate and temporally impossible originals fail closed', () => {
  const foreign = message(1, 'client_portal', { tenantId: id(99) });
  assert.throws(() => projectOfficeMessageFollowUp(thread([foreign])), /Mandanten/);
  const duplicate = message(1, 'client_portal');
  assert.throws(() => projectOfficeMessageFollowUp(thread([duplicate, { ...duplicate }])), /doppelte/);
  const impossible = message(1, 'client_portal', { readAt: time(0), status: 'read' });
  assert.throws(() => projectOfficeMessageFollowUp(thread([impossible])), /Lesebeleg/);
  const microsecondEarlier = message(1, 'client_portal', {
    sentAt: '2026-10-14T10:00:01.123456Z',
    readAt: '2026-10-14T10:00:01.123455Z',
    status: 'read',
  });
  assert.throws(() => projectOfficeMessageFollowUp(thread([microsecondEarlier])), /Lesebeleg/);
  assert.throws(
    () => projectOfficeMessageFollowUp(thread([message(2, 'client_portal'), message(1, 'office_profile')])),
    /chronologisch/,
  );
});

test('projection is immutable and preserves original message timestamps and bodies', () => {
  const source = thread([message(1, 'client_portal'), message(2, 'office_profile')]);
  const before = structuredClone(source);
  const state = projectOfficeMessageFollowUp(source);
  assert.deepEqual(source, before);
  assert.equal(state.contactAttempts[0].sentAt, time(2));
  assert.equal(state.contactAttempts[0].body, 'Original 2');
  assert.throws(() => { state.contactAttempts.push(message(4, 'office_profile')); });
  assert.throws(() => { state.contactAttempts[0].body = 'changed'; });
});
