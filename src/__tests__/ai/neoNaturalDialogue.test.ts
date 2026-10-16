import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNeoConversation, type NeoConversationDependencies } from '../../ai/robot/neoConversation.web';
import { neoNavigation } from '../../ai/robot/neoLanguage.web';
import { HELP_ARTICLES } from '../../features/help/helpCatalog';
import { NEO_SUBJECTS, neoClarification } from '../../ai/robot/neoUnderstanding.web';

function setup(overrides: Partial<NeoConversationDependencies> = {}) {
  const deps: NeoConversationDependencies = { canNavigate: () => true, canSearchClients: () => true, searchClients: vi.fn().mockResolvedValue([]), ...overrides };
  const conversation = createNeoConversation(deps);
  return { deps, conversation, ask: (text: string) => conversation.respond(text, new AbortController().signal) };
}
afterEach(() => vi.useRealTimers());

describe('Neo whole sentences with varied word order', () => {
  it.each([
    ['Kannst du den Kalender bitte für mich aufmachen?', 'calendar'],
    ['Mach bitte mal die Rechnungen auf.', 'invoices'],
    ['Ich würde mir gern die Übersicht mit unseren Mitarbeitenden ansehen.', 'employees'],
    ['Könntest du mich zu der Seite bringen, auf der ich die Rechnungen sehen kann?', 'invoices'],
    ['Wo kann ich meine Dokumente finden?', 'documents'],
    ['Zeig mir bitte einmal, wo die Vorlagen sind.', 'catalog'],
  ])('opens the requested page: %s', async (text, key) => {
    expect(neoNavigation(text)?.key).toBe(key);
    expect((await setup().ask(text)).action).toMatchObject({ kind: 'navigate', destination: { key } });
  });
  it.each([
    ['Ich habe gerade einen neuen Mitarbeiter eingestellt und möchte wissen, wie ich ihn bei uns eintragen kann.', 'personal-anlegen'],
    ['Ich möchte einen neuen Kunden aufnehmen. Kannst du mir erklären, wie das geht?', 'klienten-aufnahme'],
    ['Kannst du mir erklären, wie ich eine Rechnung für einen Klienten erstellen kann?', 'abrechnung-vorbereiten'],
    ['Eine Kollegin hat Urlaub und ich möchte das bei uns eintragen.', 'personal-abwesenheit'],
    ['Ich möchte den Urlaub meiner Mitarbeiterin im Kalender eintragen.', 'kalender-verfuegbarkeit'],
    ['Ich weiß nicht, wie ich den Portalzugang für einen Klienten einrichten soll.', 'portal-zugaenge'],
    ['Die Unterschrift vom Klienten fehlt noch, wie kann ich die später nachholen?', 'unterschrift-spaeter'],
    ['Ich habe einen Dienstplan als PDF bekommen und möchte den übernehmen.', 'kalender-import'],
    ['Ich habe mein Passwort vergessen und kann mich nicht mehr anmelden.', 'zugang-wiederherstellen'],
  ])('explains the existing CareSuite workflow: %s', async (text, id) => {
    const { ask, deps } = setup();
    const answer = await ask(text);
    expect(answer.action).toBeUndefined();
    expect(answer.text).toContain(HELP_ARTICLES.find(a => a.id === id)!.title);
    expect(answer.text).toContain('Schritt 1');
    expect(deps.searchClients).not.toHaveBeenCalled();
    expect((await ask('Anleitung öffnen')).action).toMatchObject({ destination: { route: `/hilfe?artikel=${id}` } });
  });
  it.each([
    'Öffne bitte nicht den Kalender.', 'Wenn ich später Zeit habe, möchte ich die Rechnungen öffnen.',
    'Öffne den Kalender und lösche alle Einsätze.', 'Ich habe gestern die Rechnungen angesehen.',
    'Warum zeigen die Rechnungen falsche Summen?', 'Kannst du die Rechnungen an alle Kunden senden?',
  ])('does not turn a negation, condition, problem or write into navigation: %s', async text => {
    expect(neoNavigation(text)).toBeNull();
    const { ask, deps } = setup();
    expect((await ask(text)).action).toBeUndefined();
    expect(deps.searchClients).not.toHaveBeenCalled();
  });
});

describe('Neo missing information across turns', () => {
  it.each(['Rechnungen', 'Personal', 'Kalender'])('asks what to do when only a broad topic is given: %s', async text => {
    const answer = await setup().ask(text);
    expect(answer.action).toBeUndefined(); expect(answer.text).toContain('?'); expect(answer.suggestions!.length).toBeGreaterThan(1);
  });
  it.each(['eine Rechnung', 'Ich brauche Hilfe mit einer Rechnung.', 'Ich möchte etwas mit einer Rechnung machen.'])('clarifies an incomplete invoice request: %s', async text => {
    const { ask } = setup();
    const question = await ask(text);
    expect(question.action).toBeUndefined(); expect(question.text).toContain('Rechnung'); expect(question.text).toContain('?');
    expect((await ask('Ich möchte eine neue erstellen.')).text).toContain('Die Abrechnung vorbereiten');
  });
  it('accepts a direct page choice after the invoice question', async () => {
    const { ask } = setup(); await ask('Eine Rechnung');
    expect((await ask('Nur die Übersicht.')).action).toMatchObject({ destination: { key: 'invoices' } });
  });
  it.each([
    ['Urlaub', 'Eintragen', 'personal-abwesenheit'],
    ['Urlaub', 'Im Kalender', 'kalender-verfuegbarkeit'],
    ['Unterschrift', 'Später', 'unterschrift-spaeter'],
    ['Ich möchte etwas anlegen', 'Klient', 'klienten-aufnahme'],
    ['Neu', 'Klient', 'klienten-aufnahme'],
    ['Eintragen', 'Urlaub', 'personal-abwesenheit'],
    ['Ich möchte etwas bearbeiten', 'Rechnung', 'rechnungen'],
  ])('keeps the missing task or topic: %s → %s', async (first, second, id) => {
    const { ask } = setup(); const question = await ask(first);
    expect(question.action).toBeUndefined(); expect(question.text).toContain('?');
    expect((await ask(second)).text).toContain(HELP_ARTICLES.find(a => a.id === id)!.title);
  });
  it('keeps an explicit open request when the answer is a singular topic', async () => {
    const { ask } = setup(); expect((await ask('Öffnen')).text).toContain('Welche Seite');
    expect((await ask('Rechnung')).action).toMatchObject({ destination: { key: 'invoices' } });
  });
  it('asks which topic to open in a compound request', async () => {
    const { ask } = setup();
    const question = await ask('Öffne den Kalender und die Rechnungen.');
    expect(question.action).toBeUndefined(); expect(question.text).toContain('mehrere Themen');
    expect((await ask('Das zweite')).action).toMatchObject({ destination: { key: 'invoices' } });
  });
  it('does not select an option on yes or an invalid number and repeats the actual question', async () => {
    const { ask } = setup(); const first = await ask('Urlaub');
    expect((await ask('Ja')).text).toContain('Welche Möglichkeit');
    expect((await ask('Nummer fünf')).action).toBeUndefined();
    expect((await ask('Wie bitte?')).text).toContain('Kalender');
    expect((await ask('Noch nicht sicher')).suggestions).toEqual(first.suggestions);
    expect((await ask('Nummer zwei')).text).toContain('Verfügbarkeiten und Abwesenheiten im Kalender pflegen');
  });
  it('accepts natural corrections and an unrelated new task', async () => {
    const { ask } = setup(); await ask('Eine Rechnung');
    expect((await ask('Nein, ich meine Urlaub.')).text).toContain('beim Personal');
    expect((await ask('Öffne die Dokumente')).action).toMatchObject({ destination: { key: 'documents' } });
    expect((await ask('Eintragen')).text).toContain('Was möchtest du');
  });
  it('remembers the clarification across a time question and thanks', async () => {
    const { ask } = setup(); await ask('Urlaub'); await ask('Wie spät ist es?'); await ask('Danke');
    expect((await ask('Im Kalender')).text).toContain('Verfügbarkeiten und Abwesenheiten im Kalender pflegen');
  });
  it('clears the pending operation on reset and expiry', async () => {
    vi.useFakeTimers(); const { ask, conversation } = setup();
    await ask('Anlegen'); conversation.reset();
    expect((await ask('Klient')).text).toContain('Möchtest du');
    await ask('Anlegen'); vi.advanceTimersByTime(301000);
    expect((await ask('Klient')).text).toContain('Möchtest du');
  });
  it('rechecks access before navigation chosen in a clarification', async () => {
    let allowed = true; const { ask } = setup({ canNavigate: () => allowed });
    await ask('Eine Rechnung'); allowed = false;
    const response = await ask('Öffnen'); expect(response.action).toBeUndefined(); expect(response.text).toContain('Rechte');
  });
  it('refuses client selection before search if permission is missing', async () => {
    const { ask, deps } = setup({ canSearchClients: () => false });
    await ask('Klient'); const response = await ask('Eine Akte suchen');
    expect(response.action).toBeUndefined(); expect(response.text).toContain('Rechte'); expect(deps.searchClients).not.toHaveBeenCalled();
  });
  it.each(['Nicht die Rechnungen', 'Wenn die Rechnung fertig ist', 'Ich habe gestern eine Rechnung bekommen'])('does not apply a pending open operation to an unrelated or negated statement: %s', async text => {
    const { ask } = setup(); await ask('Öffnen');
    expect((await ask(text)).action).toBeUndefined();
  });
  it('lets a new explicit task replace the pending choice of a page', async () => {
    const { ask } = setup(); await ask('Öffne Kalender und Rechnungen');
    const answer = await ask('Wie erstelle ich eine Rechnung?');
    expect(answer.action).toBeUndefined(); expect(answer.text).toContain('Die Abrechnung vorbereiten');
  });
});

describe('Neo natural follow-ups', () => {
  it.each(['Könntest du für mich bitte einmal die Akte von Anna Müller raussuchen?', 'Ich würde gerne die Akte von Anna Müller ansehen.', 'Hey Care Suite, öffne die Akte von Frau Anna Müller.'])('extracts only the person name from a natural request: %s', async text => {
    const { ask, deps } = setup({ searchClients: vi.fn().mockResolvedValue([{ id: 'anna', firstName: 'Anna', lastName: 'Müller' }]) });
    expect((await ask(text)).action).toEqual({ kind: 'client', id: 'anna' });
    expect(deps.searchClients).toHaveBeenCalledExactlyOnceWith('Anna Müller');
  });
  it('asks for the name after a topic and accepts a whole sentence as the reply', async () => {
    const { ask, deps } = setup({ searchClients: vi.fn().mockResolvedValue([{ id: 'anna', firstName: 'Anna', lastName: 'Müller' }]) });
    await ask('Klient'); expect((await ask('Eine Akte suchen')).text).toContain('welcher Person');
    expect((await ask('Die Klientin heißt Anna Müller.')).action).toEqual({ kind: 'client', id: 'anna' });
    expect(deps.searchClients).toHaveBeenCalledExactlyOnceWith('Anna Müller');
  });
  it.each(['Klientenakte anlegen', 'Klientenakte bearbeiten', 'Ich möchte Urlaub eintragen', 'Ich weiß noch nicht'])('never searches a task or uncertainty as a person name: %s', async text => {
    const { ask, deps } = setup(); await ask('Suche eine Akte'); await ask(text);
    expect(deps.searchClients).not.toHaveBeenCalled();
  });
  it.each(['Neumann', 'Träger'])('does not mistake a surname for a task: %s', async name => {
    const { ask, deps } = setup(); await ask('Suche eine Akte'); await ask(name);
    expect(deps.searchClients).toHaveBeenCalledExactlyOnceWith(name);
  });
  it('continues an explanation using natural replies and keeps it after a problem', async () => {
    const { ask } = setup(); await ask('Eine Klientenakte anlegen');
    expect((await ask('Das habe ich gemacht.')).text).toContain('Schritt 2');
    expect((await ask('Kannst du mir dazu ein Beispiel geben?')).text).toContain('Beispiel mit erfundenen Angaben');
    const issue = await ask('Das funktioniert nicht.'); expect(issue.text).toContain('Pflichtfelder');
    expect((await ask('Schritt wiederholen')).text).toContain('Schritt 2');
    expect((await ask('Wie geht es weiter?')).text).toContain('Schritt 3');
  });
  it('keeps every offered article grounded in the current catalogue', () => {
    const ids = new Set(HELP_ARTICLES.filter(a => a.audiences.includes('verwaltung')).map(a => a.id));
    for (const subject of NEO_SUBJECTS) {
      for (const id of [subject.guide, subject.createGuide, subject.editGuide].filter(Boolean)) expect(ids.has(id!), subject.key).toBe(true);
      for (const option of neoClarification(subject).options) if (option.answer.kind === 'guide') expect(ids.has(option.answer.id), option.label).toBe(true);
    }
  });
});
