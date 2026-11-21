import { assertNeoScope, neoScopeKey, type NeoScope, type NeoSegment } from './neoDomain';

export type NeoSpeakerRole = 'client' | 'caregiver' | 'relative' | 'doctor' | 'other' | 'unknown';
export type NeoSessionMode = 'off' | 'ambient' | 'dialogue';
export type NeoSessionEvidence = {
  id: string; text: string; speakerId: string; role: NeoSpeakerRole; speaker: string;
  startedAt: number; endedAt: number;
};
export type NeoSessionInput = {
  id: string; text: string; startedAt: number; endedAt: number;
  /** An acoustic cluster ID is not an identity or a professional role. */
  speakerId?: string; source?: 'human' | 'assistant'; echo?: boolean;
  /** Imported or manually pasted evidence cannot activate the live command channel. */
  addressable?: boolean;
};
export type NeoWorkKind = 'documentation' | 'task' | 'appointment' | 'visit_change' | 'reminder' | 'question';
export type NeoWorkStatus = 'queued' | 'preparing' | 'needs_clarification' | 'ready' | 'confirmed' | 'executing' | 'done' | 'failed' | 'cancelled' | 'uncertain';
export type NeoWorkItem = {
  id: string; kind: NeoWorkKind; title: string; sourceIds: string[]; missing: string[];
  status: NeoWorkStatus; payload?: unknown; result?: unknown;
};
export type NeoWorkToken = { generation: number; scopeKey: string; workId: string; attempt: number };
export type NeoClarification = { id: string; kind: 'speaker' | 'missing'; question: string; sourceIds: string[]; workId?: string; resolved: boolean };
export type NeoSessionOptions = { dialogueMs?: number; maxPending?: number; maxRunning?: number; maxEvidence?: number; maxCharacters?: number };
export type NeoSessionReceipt = {
  accepted: boolean; reason?: 'off' | 'duplicate' | 'echo' | 'invalid' | 'capacity' | 'backpressure';
  wake: boolean; command?: { text: string; sourceId: string }; evidence?: NeoSessionEvidence;
};
const roles: NeoSpeakerRole[] = ['client', 'caregiver', 'relative', 'doctor', 'other', 'unknown'];
const pending = (item: NeoWorkItem) => item.status === 'queued' || item.status === 'preparing';
const copy = <T,>(value: T): T => structuredClone(value);
const bounded = (value: number | undefined, fallback: number, maximum: number) => Number.isInteger(value) && value! > 0 ? Math.min(value!, maximum) : fallback;

/** Lexical fallback on an ASR transcript. This is not an acoustic wake-word model. */
export function stripNeoWake(text: string): string | null {
  const starts = [0];
  // A chunk can contain a completed observation and an addressed request.
  // Numeric punctuation, ellipses, commas and colons do not open a new address.
  for (const boundary of text.matchAll(/[\p{L})\]][.!?]+\s+/gu)) {
    const punctuation = boundary[0].trim().slice(1);
    const prefix = text.slice(0, boundary.index! + 1), word = /\p{L}+$/u.exec(prefix)?.[0] ?? '';
    if (punctuation.includes('..') || word.length === 1 || /^(?:dr|hr|fr|bzw|ggf|ca|inkl|sog|etc|usw|prof)$/iu.test(word)) continue;
    starts.push(boundary.index! + boundary[0].length);
  }
  for (const start of starts) {
    // A name inside quoted/reported speech remains evidence, not an instruction.
    const closers: string[] = [];
    for (let index = 0; index < start; index++) {
      const character = text[index];
      if ((character === "'" || character === '’') && /\p{L}/u.test(text[index - 1] ?? '') && /\p{L}/u.test(text[index + 1] ?? '')) continue;
      if (character === closers.at(-1)) { closers.pop(); continue; }
      const closing = ({ '„': '“', '“': '”', '«': '»', '»': '«', '‚': '‘', '‘': '’', '"': '"', "'": "'" } as Record<string, string>)[character];
      if (closing) closers.push(closing);
    }
    if (closers.length) continue;
    const match = /^\s*(?:(?:hey|hallo|bitte)[\s,]+)?neo(?=$|[\s,:;.!?])(?:[\s,:;.!?]*)/iu.exec(text.slice(start));
    if (!match) continue;
    const rest = text.slice(start + match[0].length).trim();
    if (/^(?:sagte|meinte|behauptete|erklärte|wurde|sollte damals)\b/iu.test(rest)) continue;
    return rest;
  }
  return null;
}
export const detectNeoWake = (text: string): boolean => stripNeoWake(text) !== null;
export function toNeoSegment(evidence: NeoSessionEvidence): NeoSegment {
  return { id: evidence.id, text: evidence.text, startedAt: evidence.startedAt, endedAt: evidence.endedAt,
    speaker: evidence.speaker, role: evidence.role === 'client' ? 'person' : evidence.role === 'relative' ? 'relative' : evidence.role === 'caregiver' || evidence.role === 'doctor' ? 'professional' : 'unknown' };
}

/** In-memory session routing only. It records no audio, infers no identity and performs no writes. */
export function createNeoSession(initialScope: NeoScope, options: NeoSessionOptions = {}) {
  assertNeoScope(initialScope);
  let scope = copy(initialScope), key = neoScopeKey(scope), generation = 0;
  let mode: NeoSessionMode = 'off', deadline = 0, assistantSpeaking = false;
  let evidence: NeoSessionEvidence[] = [], work: NeoWorkItem[] = [], questions: NeoClarification[] = [];
  const speakers = new Map<string, { role: NeoSpeakerRole; label: string }>();
  const attempts = new Map<string, number>();
  const dialogueMs = bounded(options.dialogueMs, 15000, 120000), maxPending = bounded(options.maxPending, 24, 200);
  const maxRunning = bounded(options.maxRunning, 3, 8), maxEvidence = bounded(options.maxEvidence, 200, 200);
  const maxCharacters = bounded(options.maxCharacters, 60000, 60000);
  const tick = (now: number) => { if (mode === 'dialogue' && now >= deadline) mode = 'ambient'; };
  const validNow = (now: number) => Number.isFinite(now) && now >= 0;
  const sourceMissing = (ids: string[]) => [...new Set(ids.map(id => evidence.find(item => item.id === id)!).filter(item => item.role === 'unknown' || item.role === 'other').map(item => `speaker:${item.speakerId}`))];
  function askForWork(item: NeoWorkItem) {
    for (const field of item.missing.filter(field => !field.startsWith('speaker:'))) {
      const id = `missing:${item.id}:${field}`;
      if (!questions.some(question => question.id === id)) questions.push({ id, kind: 'missing', question: field, sourceIds: [...item.sourceIds], workId: item.id, resolved: false });
    }
  }
  function snapshot(now = Date.now()) {
    if (validNow(now)) tick(now);
    return copy({ scope, scopeKey: key, generation, mode, assistantSpeaking, evidence, work, clarifications: questions,
      speakers: [...speakers].map(([speakerId, value]) => ({ speakerId, ...value })), queued: work.filter(pending).length });
  }
  function stop() {
    generation++; mode = 'off'; deadline = 0; assistantSpeaking = false;
    work = work.map(item => pending(item) ? { ...item, status: 'cancelled' } : item.status === 'executing' ? { ...item, status: 'uncertain' } : item.status === 'confirmed' ? { ...item, status: 'ready' } : item);
  }
  function start({ consent, now = Date.now() }: { consent: boolean; now?: number }) {
    if (!consent || !validNow(now)) return false;
    if (mode !== 'off') return true;
    generation++; mode = 'ambient'; deadline = 0; assistantSpeaking = false;
    return true;
  }
  function resetScope(next: NeoScope) {
    assertNeoScope(next); stop(); scope = copy(next); key = neoScopeKey(scope);
    evidence = []; work = []; questions = []; speakers.clear(); attempts.clear();
  }
  function proposeTask(input: { id: string; kind: NeoWorkKind; title: string; sourceIds: string[]; missing?: string[]; payload?: unknown }): NeoWorkItem | null {
    if (mode === 'off' || typeof input.id !== 'string' || !input.id.trim() || input.id.length > 150 || !input.title.trim() || input.title.length > 500
      || !['documentation', 'task', 'appointment', 'visit_change', 'reminder', 'question'].includes(input.kind)
      || !Array.isArray(input.sourceIds) || !input.sourceIds.length || input.sourceIds.length > 200 || input.sourceIds.some(id => !evidence.some(item => item.id === id))
      || input.missing?.some(field => typeof field !== 'string' || !field.trim() || field.length > 250) || (input.missing?.length ?? 0) > 20) return null;
    const existing = work.find(item => item.id === input.id);
    if (existing) return copy(existing);
    if (work.filter(pending).length >= maxPending || work.length >= 400) return null;
    const missing = [...new Set([...(input.missing ?? []), ...sourceMissing(input.sourceIds)])];
    const item: NeoWorkItem = { ...copy(input), sourceIds: [...new Set(input.sourceIds)], missing, status: missing.length ? 'needs_clarification' : 'queued' };
    work.push(item); askForWork(item); return copy(item);
  }
  function receive(input: NeoSessionInput, now = Date.now()): NeoSessionReceipt {
    const reject = (reason: NonNullable<NeoSessionReceipt['reason']>): NeoSessionReceipt => ({ accepted: false, reason, wake: false });
    if (mode === 'off') return reject('off');
    if (!validNow(now) || typeof input.id !== 'string' || !input.id.trim() || input.id.length > 150 || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 6000
      || !validNow(input.startedAt) || !validNow(input.endedAt) || input.endedAt < input.startedAt || input.speakerId !== undefined && (typeof input.speakerId !== 'string' || !input.speakerId.trim() || input.speakerId.length > 100)) return reject('invalid');
    if (input.source === 'assistant' || input.echo || assistantSpeaking) return reject('echo');
    if (evidence.some(item => item.id === input.id)) return reject('duplicate');
    if (evidence.length >= maxEvidence || evidence.reduce((sum, item) => sum + item.text.length, 0) + input.text.length > maxCharacters) return reject('capacity');
    if (work.filter(pending).length >= maxPending) return reject('backpressure');
    tick(now);
    // Without an acoustic speaker ID each segment remains independently unassigned.
    const speakerId = input.speakerId ?? `segment:${input.id}`, speaker = speakers.get(speakerId);
    const item: NeoSessionEvidence = { id: input.id, text: input.text.trim(), speakerId, role: speaker?.role ?? 'unknown', speaker: speaker?.label ?? 'Sprecher ungeklärt', startedAt: input.startedAt, endedAt: input.endedAt };
    evidence.push(item);
    if (item.role === 'unknown' || item.role === 'other') {
      const id = `speaker:${speakerId}`, question = questions.find(value => value.id === id);
      if (question) { question.sourceIds.push(item.id); question.resolved = false; }
      else questions.push({ id, kind: 'speaker', question: 'Wer hat diese Aussage gemacht? Bitte Person und Rolle bestätigen.', sourceIds: [item.id], resolved: false });
    }
    proposeTask({ id: `documentation:${item.id}`, kind: 'documentation', title: 'Aussage für den Dokumentationsentwurf zuordnen', sourceIds: [item.id] });
    const addressed = input.addressable === false ? null : stripNeoWake(item.text), wake = addressed !== null;
    if (wake) { mode = 'dialogue'; deadline = now + dialogueMs; }
    const commandText = input.addressable === false ? '' : wake ? addressed! : mode === 'dialogue' ? item.text : '';
    if (commandText) deadline = now + dialogueMs;
    return { accepted: true, wake, evidence: copy(item), ...(commandText ? { command: { text: commandText, sourceId: item.id } } : {}) };
  }
  function assignSpeaker(speakerId: string, role: NeoSpeakerRole, label: string) {
    if (!roles.includes(role) || typeof speakerId !== 'string' || !speakerId.trim() || speakerId.length > 100 || !label.trim() || label.length > 100) return false;
    speakers.set(speakerId, { role, label: label.trim() });
    evidence = evidence.map(item => item.speakerId === speakerId ? { ...item, role, speaker: label.trim() } : item);
    const unresolved = role === 'unknown' || role === 'other';
    questions = questions.map(question => question.id === `speaker:${speakerId}` ? { ...question, resolved: !unresolved } : question);
    // A source reclassification revokes a previous confirmation. Executing writes become uncertain.
    work = work.map(item => {
      if (!item.sourceIds.some(id => evidence.find(source => source.id === id)?.speakerId === speakerId) || ['done', 'failed', 'cancelled'].includes(item.status)) return item;
      const missing = [...item.missing.filter(value => !value.startsWith('speaker:')), ...sourceMissing(item.sourceIds)];
      if (item.status === 'executing') return { ...item, missing, status: 'uncertain' };
      return { ...item, missing, status: missing.length ? 'needs_clarification' : 'queued' };
    });
    return true;
  }
  function tokenFor(id: string): NeoWorkToken {
    const attempt = (attempts.get(id) ?? 0) + 1; attempts.set(id, attempt);
    return { generation, scopeKey: key, workId: id, attempt };
  }
  const validToken = (id: string, token: NeoWorkToken) => token.workId === id && token.generation === generation && token.scopeKey === key && token.attempt === attempts.get(id);
  function nextWork(limit = maxRunning): { item: NeoWorkItem; token: NeoWorkToken }[] {
    if (mode === 'off') return [];
    const free = Math.max(0, maxRunning - work.filter(item => item.status === 'preparing' || item.status === 'executing').length);
    return work.filter(item => item.status === 'queued').slice(0, Math.min(bounded(limit, maxRunning, maxRunning), free)).map(item => {
      item.status = 'preparing'; return { item: copy(item), token: tokenFor(item.id) };
    });
  }
  function completeWork(id: string, token: NeoWorkToken, result: { payload?: unknown; missing?: string[]; error?: string }) {
    const item = work.find(value => value.id === id);
    if (!item || item.status !== 'preparing' || !validToken(id, token) || (result.missing?.length ?? 0) > 20 || result.missing?.some(field => typeof field !== 'string' || !field.trim() || field.length > 250)) return false;
    item.missing = [...new Set([...(result.missing ?? []), ...sourceMissing(item.sourceIds)])];
    item.result = copy(result.payload); item.status = result.error ? 'failed' : item.missing.length ? 'needs_clarification' : 'ready';
    askForWork(item); return true;
  }
  function reviseTask(id: string, payload: unknown, missing: string[] = []) {
    const item = work.find(value => value.id === id);
    if (!item || !['ready', 'confirmed', 'needs_clarification', 'failed'].includes(item.status) || missing.length > 20 || missing.some(field => typeof field !== 'string' || !field.trim() || field.length > 250)) return false;
    item.payload = copy(payload); item.missing = [...new Set([...missing, ...sourceMissing(item.sourceIds)])]; item.status = item.missing.length ? 'needs_clarification' : 'queued';
    questions = questions.map(question => question.workId === id ? { ...question, resolved: !item.missing.includes(question.question) } : question); askForWork(item); return true;
  }
  function confirmTask(id: string) {
    const item = work.find(value => value.id === id);
    if (!item || item.status !== 'ready' || item.missing.length || sourceMissing(item.sourceIds).length) return false;
    item.status = 'confirmed'; return true;
  }
  function beginExecution(id: string) {
    const item = work.find(value => value.id === id);
    if (mode === 'off' || !item || item.status !== 'confirmed' || item.kind === 'documentation' || item.kind === 'question'
      || work.filter(value => value.status === 'preparing' || value.status === 'executing').length >= maxRunning) return null;
    item.status = 'executing'; return tokenFor(id);
  }
  function finishExecution(id: string, token: NeoWorkToken, result: { ok: boolean; uncertain?: boolean; payload?: unknown }) {
    const item = work.find(value => value.id === id);
    if (!item || item.status !== 'executing' || !validToken(id, token)) return false;
    item.status = result.ok ? 'done' : result.uncertain ? 'uncertain' : 'failed'; item.result = copy(result.payload); return true;
  }
  return { start, stop, resetScope, receive, snapshot, assignSpeaker, proposeTask, nextWork, completeWork, reviseTask, confirmTask, beginExecution, finishExecution,
    getMode(now = Date.now()) { if (validNow(now)) tick(now); return mode; },
    setAssistantSpeaking(value: boolean) { assistantSpeaking = value; } };
}
export type NeoSession = ReturnType<typeof createNeoSession>;
