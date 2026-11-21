import { describe, expect, it } from 'vitest';
import { createNeoSession, detectNeoWake, stripNeoWake, toNeoSegment } from '@/ai/neo/neoSession';
const scope = { tenantId: '11111111-1111-4111-8111-111111111111', actorId: '22222222-2222-4222-8222-222222222222', subjectId: '33333333-3333-4333-8333-333333333333' };
const source = (id: string, text = 'Die Klientin benötigt Hilfe beim Duschen.') => ({ id, text, startedAt: 1000, endedAt: 2000, speakerId: 'voice-a' });
const ready = () => { const session = createNeoSession(scope); session.start({ consent: true, now: 1000 }); session.assignSpeaker('voice-a', 'caregiver', 'Pflegekraft Frau Müller'); session.receive(source('s1'), 2000); return session; };
describe('NEO scoped ambient session', () => {
  it.each(['NEO', 'Neo, erstelle eine Aufgabe', 'Hey NEO: Bitte den Termin prüfen', 'Hallo, Neo! Weiter', 'bitte neo hilf mir'])('recognizes an addressed lexical wake: %s', text => expect(detectNeoWake(text)).toBe(true));
  it.each(['Neon ist hell', 'Neoplasie', 'Ich habe Neo gefragt.', '„Neo, erstelle eine Aufgabe“ sagte sie.', 'Neo sagte, ich soll kommen.', 'neo-Installation'])('does not route a partial name or a quoted/reported mention: %s', text => expect(detectNeoWake(text)).toBe(false));
  it.each([
    ['Ich habe keine Schmerzen. NEO, erstelle einen Termin.', 'erstelle einen Termin.'],
    ['Die Klientin braucht einen Rollator! Hey Neo: bereite eine Aufgabe vor.', 'bereite eine Aufgabe vor.'],
    ['Ist das bereits dokumentiert? Hallo, NEO, zeige die offenen Angaben.', 'zeige die offenen Angaben.'],
  ])('recognizes a new addressed sentence within one ASR chunk: %s', (text, command) => expect(stripNeoWake(text)).toBe(command));
  it.each([
    'Die Ärztin sagte: NEO, erstelle einen Termin.',
    'Die Angehörige sagte: „Keine Schmerzen. NEO, erstelle einen Termin.“',
    'Die Angehörige sagte: "Keine Schmerzen. NEO, erstelle einen Termin."',
    "Die Angehörige sagte: 'Keine Schmerzen. NEO, erstelle einen Termin.'",
    'Keine Schmerzen. Neo sagte, es sei erledigt.',
    'Keine Schmerzen. Neon ist hell.',
    'Datum 21.11. NEO ist der Name.',
    'Messwert 1.5 NEO wird erwähnt.',
    'Nummer 2. NEO ist gemeint.',
    'Dr. Neo ist eine zitierte Bezeichnung.',
    'Ich überlege... NEO war der Name.',
  ])('keeps quoted/reported names, numeric punctuation and incomplete clauses out of the command channel: %s', text => expect(stripNeoWake(text)).toBeNull());
  it('keeps the entire original observation as evidence when a later sentence opens the command channel', () => {
    const session = ready(), text = 'Ich habe keine Schmerzen. NEO, erstelle einen Termin.';
    const receipt = session.receive(source('combined', text), 3000);
    expect(receipt).toMatchObject({ wake: true, evidence: { text }, command: { text: 'erstelle einen Termin.', sourceId: 'combined' } });
    expect(session.snapshot(3000).evidence.find(item => item.id === 'combined')?.text).toBe(text);
  });
  it('requires explicit consent, stays silent, opens a short addressed window and returns to ambient', () => {
    const session = createNeoSession(scope);
    expect(session.receive(source('s1'), 1000).reason).toBe('off'); expect(session.start({ consent: false, now: 1000 })).toBe(false);
    expect(session.start({ consent: true, now: 1000 })).toBe(true); expect(session.receive(source('s1'), 2000).command).toBeUndefined();
    expect(session.receive(source('s2', 'Neo, erstelle eine Aufgabe'), 3000)).toMatchObject({ accepted: true, wake: true, command: { text: 'erstelle eine Aufgabe', sourceId: 's2' } });
    expect(session.receive(source('s3', 'Für morgen'), 4000).command?.text).toBe('Für morgen'); expect(session.snapshot(19000).mode).toBe('ambient');
    expect(session.receive(source('s4', 'Die Klientin trinkt Tee.'), 19001).command).toBeUndefined(); expect(stripNeoWake('NEO')).toBe('');
  });
  it('suppresses known assistant audio and echo without pretending acoustic diarization or full duplex', () => {
    const session = ready(); expect(session.receive({ ...source('a', 'NEO'), source: 'assistant' }, 2000).reason).toBe('echo');
    expect(session.receive({ ...source('b'), echo: true }, 2000).reason).toBe('echo'); session.setAssistantSpeaking(true);
    expect(session.receive(source('c', 'Neo'), 2000).reason).toBe('echo'); session.setAssistantSpeaking(false); expect(session.receive(source('c', 'Neo'), 2001).wake).toBe(true);
  });
  it('keeps unknown acoustic clusters separate from semantic roles and retains doctor labels in existing evidence', () => {
    const session = createNeoSession(scope); session.start({ consent: true, now: 1000 });
    session.receive(source('s1', 'Ich bin Arzt. Die Klientin hat Schmerzen.'), 2000); session.receive(source('s2'), 2001);
    expect(session.snapshot(2001).evidence.every(item => item.role === 'unknown')).toBe(true); expect(session.snapshot(2001).clarifications).toHaveLength(1);
    expect(session.nextWork()).toHaveLength(0); session.assignSpeaker('voice-a', 'doctor', 'Dr. Beispiel, ärztliche Quelle');
    const snapshot = session.snapshot(2001); expect(snapshot.clarifications[0].resolved).toBe(true); expect(toNeoSegment(snapshot.evidence[0])).toMatchObject({ role: 'professional', speaker: 'Dr. Beispiel, ärztliche Quelle' });
    expect(session.nextWork()).toHaveLength(2);
  });
  it('does not merge unidentified speakers across separate segments or mutate state through snapshots', () => {
    const session = createNeoSession(scope); session.start({ consent: true });
    session.receive({ ...source('s1'), speakerId: undefined }); session.receive({ ...source('s2'), speakerId: undefined });
    const snapshot = session.snapshot(); expect(snapshot.evidence[0].speakerId).not.toBe(snapshot.evidence[1].speakerId); snapshot.evidence[0].text = 'changed';
    expect(session.snapshot().evidence[0].text).not.toBe('changed');
  });
  it('bounds preparation and capture with explicit backpressure and accepts duplicate events only once', () => {
    const session = createNeoSession(scope, { maxPending: 2, maxRunning: 1 }); session.start({ consent: true }); session.assignSpeaker('voice-a', 'client', 'Klient');
    expect(session.receive(source('s1')).accepted).toBe(true); expect(session.receive(source('s1')).reason).toBe('duplicate'); expect(session.receive(source('s2')).accepted).toBe(true);
    expect(session.receive(source('s3')).reason).toBe('backpressure'); const [job] = session.nextWork(8); expect(session.nextWork()).toHaveLength(0);
    expect(session.completeWork(job.item.id, job.token, { payload: { original: 'Beleg' } })).toBe(true); expect(session.receive(source('s3')).accepted).toBe(true);
    expect(session.snapshot().evidence).toHaveLength(3);
  });
  it('never prepares a task without known evidence and requires clarification, review and confirmation before execution', () => {
    const session = ready(); expect(session.proposeTask({ id: 'bad', kind: 'task', title: 'Tun', sourceIds: ['fabricated'] })).toBeNull();
    session.proposeTask({ id: 'task-1', kind: 'task', title: 'Arzt kontaktieren', sourceIds: ['s1'], missing: ['Wann soll die Aufgabe fällig sein?'] });
    expect(session.confirmTask('task-1')).toBe(false); expect(session.beginExecution('task-1')).toBeNull();
    expect(session.snapshot().clarifications.some(item => item.workId === 'task-1' && !item.resolved)).toBe(true);
    session.reviseTask('task-1', { due: '2090-11-21' }); const jobs = session.nextWork(); const task = jobs.find(item => item.item.id === 'task-1')!;
    session.completeWork(task.item.id, task.token, { payload: { due: '2090-11-21' } }); expect(session.beginExecution('task-1')).toBeNull();
    expect(session.confirmTask('task-1')).toBe(true); const token = session.beginExecution('task-1')!; expect(token).toBeTruthy();
    expect(session.beginExecution('task-1')).toBeNull(); expect(session.finishExecution('task-1', token, { ok: true })).toBe(true); expect(session.finishExecution('task-1', token, { ok: true })).toBe(false);
  });
  it('rejects completions after stop, case switch and role reclassification, while retaining stopped evidence', () => {
    const session = ready(); const [job] = session.nextWork(); session.stop();
    expect(session.snapshot().evidence).toHaveLength(1); expect(session.completeWork(job.item.id, job.token, {})).toBe(false);
    session.start({ consent: true }); session.assignSpeaker('voice-a', 'caregiver', 'Pflegekraft'); const [retry] = session.nextWork();
    // Stopped work is cancelled; a role assignment does not silently restart it.
    expect(retry).toBeUndefined(); session.receive(source('s2')); const [fresh] = session.nextWork();
    session.assignSpeaker('voice-a', 'relative', 'Angehörige'); expect(session.completeWork(fresh.item.id, fresh.token, {})).toBe(false);
    session.resetScope({ ...scope, subjectId: '44444444-4444-4444-8444-444444444444' });
    expect(session.snapshot()).toMatchObject({ mode: 'off', evidence: [], work: [], clarifications: [], speakers: [] }); expect(session.completeWork(fresh.item.id, fresh.token, {})).toBe(false);
  });
  it('revokes review after speaker changes and flags interrupted external execution as uncertain', () => {
    const session = ready(); session.proposeTask({ id: 'task', kind: 'task', title: 'Aufgabe vorbereiten', sourceIds: ['s1'] });
    const jobs = session.nextWork(); jobs.forEach(job => session.completeWork(job.item.id, job.token, {})); expect(session.confirmTask('task')).toBe(true);
    session.assignSpeaker('voice-a', 'unknown', 'Ungeklärt'); expect(session.beginExecution('task')).toBeNull();
    session.assignSpeaker('voice-a', 'caregiver', 'Pflegekraft'); session.nextWork().forEach(job => session.completeWork(job.item.id, job.token, {})); session.confirmTask('task');
    const token = session.beginExecution('task')!; session.stop(); expect(session.snapshot().work.find(item => item.id === 'task')?.status).toBe('uncertain'); expect(session.finishExecution('task', token, { ok: true })).toBe(false);
  });
  it('retains the captured prefix and reports capacity rather than silently losing evidence', () => {
    const session = createNeoSession(scope, { maxEvidence: 1 }); session.start({ consent: true }); session.receive(source('s1'));
    expect(session.receive(source('s2')).reason).toBe('capacity'); expect(session.snapshot().evidence.map(item => item.id)).toEqual(['s1']);
  });
  it('does not activate or prolong a live command window from imported or pasted evidence', () => {
    const session = ready();
    expect(session.receive({ ...source('recorded', 'Neo, ändere einen Termin.'), addressable: false }, 3000).command).toBeUndefined();
    expect(session.getMode(3001)).toBe('ambient');
    session.receive(source('live', 'Neo'), 4000);
    session.receive({ ...source('pasted', 'Ein längerer alter Gesprächsbeleg.'), addressable: false }, 18000);
    expect(session.getMode(19000)).toBe('ambient');
  });
});
