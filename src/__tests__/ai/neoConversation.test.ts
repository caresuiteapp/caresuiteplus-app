import { describe, expect, it, vi } from 'vitest';
import { createNeoConversation, type NeoConversationDependencies } from '../../ai/robot/neoConversation.web';
import { findNeoHelp, neoNavigation, neoSmallTalk } from '../../ai/robot/neoLanguage.web';
import { HELP_ARTICLES } from '../../features/help/helpCatalog';

function setup(overrides: Partial<NeoConversationDependencies> = {}) {
  const deps: NeoConversationDependencies = { canNavigate: () => true, canSearchClients: () => true, canGoBack: () => false, searchClients: vi.fn().mockResolvedValue([]), getProfileName: () => 'Kevin', ...overrides };
  const conversation = createNeoConversation(deps);
  return { deps, conversation, ask: (text: string) => conversation.respond(text, new AbortController().signal) };
}
describe('Neo natural requests and catalogue grounding', () => {
  it.each([
    ['Neo, könntest du mir bitte mal den Kalender zeigen?', 'calendar'],
    ['Ich möchte gerne zum Kalender', 'calendar'],
    ['Bring mich bitte zu den Rechnungen', 'invoices'],
    ['Wo finde ich die Dokumente?', 'documents'],
    ['Ich brauche die Personalübersicht', 'employees'],
    ['Zeig mir bitte die Vorlagen', 'catalog'],
    ['Öffne den Dokumentenkatalog', 'catalog'],
    ['Zum Desktop bitte', 'home'],
    ['Ich will die Firmendaten sehen', 'company'],
    ['Gehe zum Fahrtenbuch', 'logbook'],
  ])('understands navigation: %s', (text, key) => expect(neoNavigation(text)?.key).toBe(key));
  it.each(['Öffne nicht den Kalender', 'Lösche die Rechnungen', 'Öffne Kalender und Rechnungen', 'Zeig die Klienten und sende Daten', 'Öffne https://example.com', 'Ich möchte Rechnungen bezahlen'])('does not execute unsupported or ambiguous instructions: %s', text => expect(neoNavigation(text)).toBeNull());
  it.each([
    ['Kannst du mir bitte die Uhrzeit sagen?', 'time'], ['Wie spät ist es jetzt?', 'time'],
    ['Hörst du mich?', 'greeting'], ['Was kann ich dich fragen?', 'help'],
    ['Kannst du mir helfen?', 'help'], ['Kannst du mich hören?', 'greeting'], ['Kannst du dich unterhalten?', 'capabilities'], ['Danke für deine Hilfe', 'thanks'], ['Gespräch beenden', 'goodbye'],
  ])('understands conversation: %s', (text, intent) => expect(neoSmallTalk(text)).toBe(intent));
  it.each([
    ['Wie lege ich einen neuen Klienten an?', 'klienten-aufnahme'],
    ['Wie richte ich Portalzugänge ein?', 'portal-zugaenge'],
    ['Wie lade ich mein Firmenlogo hoch?', 'dokument-logo'],
    ['Wie hole ich eine fehlende Unterschrift später ein?', 'unterschrift-spaeter'],
    ['Dienstplan aus PDF übernehmen', 'kalender-import'],
    ['Wie erfasse ich Urlaub?', 'personal-abwesenheit'],
    ['Dokumentenkatalog', 'dokument-katalog'],
    ['Speichern funktioniert nicht', 'speichern-fehler'],
  ])('finds the existing guide for %s', (text, id) => expect(findNeoHelp(text).slice(0, 3).map(h => h.article.id)).toContain(id));
  it('retrieves every management guide by its actual title', () => {
    for (const article of HELP_ARTICLES.filter(a => a.audiences.includes('verwaltung'))) {
      expect(findNeoHelp(article.title).slice(0, 3).map(h => h.article.id), article.title).toContain(article.id);
    }
  });
  it('does not pretend to answer arbitrary general knowledge or execute writes', async () => {
    const { ask } = setup();
    expect((await ask('Wie viele Monde hat Jupiter?')).action).toBeUndefined();
    expect((await ask('Wie viele Monde hat Jupiter?')).text).toContain('CareSuite');
    const write = await ask('Lösche alle Daten');
    expect(write.action).toBeUndefined(); expect(write.text).toContain('selbst');
  });
});
describe('Neo multi-turn context', () => {
  it('continues a guide with steps, an example, repetition and opening', async () => {
    const { ask } = setup();
    let first = await ask('Eine Klientenakte anlegen');
    if (first.text.includes('Welche brauchst du')) first = await ask('Nummer 1');
    expect(first.text).toContain('Schritt 1');
    const next = await ask('Weiter'); expect(next.text).toContain('Schritt 2');
    const example = await ask('Gib mir ein Beispiel'); expect(example.text).toContain('Beispiel mit erfundenen Angaben');
    expect((await ask('Schritt wiederholen')).text).toContain('Schritt 2');
    expect((await ask('Einen Schritt zurück')).text).toContain('Schritt 1');
    expect((await ask('Öffne das')).action).toMatchObject({ kind: 'navigate', destination: { route: '/hilfe?artikel=klienten-aufnahme' } });
  });
  it('understands short affirmative, repeat and negative replies without stripping their meaning', async () => {
    const { ask } = setup();
    await ask('Eine Klientenakte anlegen');
    const second = await ask('Gerne'); expect(second.text).toContain('Schritt 2');
    expect((await ask('Wie bitte?')).text).toBe(second.text);
    expect((await ask('Noch mal bitte')).text).toBe(second.text);
    expect((await ask('Doch nicht')).text).toContain('stattdessen');
    expect((await ask('Neo')).text).not.toContain('keiner CareSuite');
  });
  it('keeps guide context across thanks and responds to a new topic', async () => {
    const { ask } = setup(); await ask('Eine Klientenakte anlegen');
    expect((await ask('Danke')).suggestions).toContain('Weiter');
    expect((await ask('Ja')).text).toContain('Schritt 2');
    expect((await ask('Kalender öffnen')).action).toMatchObject({ destination: { key: 'calendar' } });
  });
  it.each(['Ich möchte die Akte von Anna Müller öffnen', 'Kannst du mir bitte die Klientenakte von Frau Anna Müller anzeigen?', 'Suche den Kunden Anna Müller', 'Neo, ich brauche die Akte von Anna Müller'])('understands natural client requests: %s', async text => {
    const { ask, deps } = setup({ searchClients: vi.fn().mockResolvedValue([{ id: 'a', firstName: 'Anna', lastName: 'Müller' }]) });
    expect((await ask(text)).action).toEqual({ kind: 'client', id: 'a' });
    expect(deps.searchClients).toHaveBeenCalledWith('Anna Müller');
  });
  it('asks for the missing name and uses the direct reply', async () => {
    const { ask, deps } = setup({ searchClients: vi.fn().mockResolvedValue([{ id: 'one', firstName: 'Anna', lastName: 'Müller' }]) });
    expect((await ask('Suche eine Akte')).text).toContain('welcher Person');
    expect((await ask('Anna Müller')).action).toEqual({ kind: 'client', id: 'one' });
    expect(deps.searchClients).toHaveBeenCalledWith('Anna Müller');
  });
  it('resolves multiple matches by number, first name or city', async () => {
    for (const answer of ['die zweite', 'Nummer zwei', 'Paul', 'aus Dortmund']) {
      const { ask } = setup({ searchClients: vi.fn().mockResolvedValue([{ id: 'a', firstName: 'Anna', lastName: 'Müller', city: 'Herne' }, { id: 'b', firstName: 'Paul', lastName: 'Müller', city: 'Dortmund' }]) });
      expect((await ask('Akte von Müller')).text).toContain('Welche Person');
      expect((await ask(answer)).action, answer).toEqual({ kind: 'client', id: 'b' });
    }
  });
  it('does not choose for an ambiguous yes or number outside the selection', async () => {
    const { ask } = setup({ searchClients: vi.fn().mockResolvedValue([{ id: 'a', firstName: 'Anna', lastName: 'Müller' }, { id: 'b', firstName: 'Paul', lastName: 'Müller' }]) });
    await ask('Akte von Müller');
    expect((await ask('Ja')).action).toBeUndefined();
    expect((await ask('Nummer 5')).action).toBeUndefined();
    expect((await ask('Nummer 2')).action).toEqual({ kind: 'client', id: 'b' });
  });
  it('rechecks access after a search and before selecting a person', async () => {
    let allowed = true;
    const { ask } = setup({ canSearchClients: () => allowed, searchClients: async () => { allowed = false; return [{ id: 'a', firstName: 'Anna', lastName: 'Müller' }]; } });
    const answer = await ask('Akte von Müller'); expect(answer.action).toBeUndefined(); expect(answer.text).toContain('Rechte');
  });
  it('never repeats an action when asked to repeat an answer', async () => {
    const { ask } = setup(); expect((await ask('Kalender öffnen')).action).toBeDefined();
    const repeat = await ask('Noch einmal'); expect(repeat.text).toContain('Kalender'); expect(repeat.action).toBeUndefined();
  });
  it('recognizes a change from name clarification to a help topic', async () => {
    const { ask, deps } = setup(); await ask('Suche eine Akte');
    const response = await ask('Personal anlegen');
    expect(deps.searchClients).not.toHaveBeenCalled(); expect(response.text).toMatch(/Schritt 1|Anleitungen/);
  });
  it('does not turn a new unrelated question into a client name', async () => {
    const { ask, deps } = setup(); await ask('Suche eine Akte'); await ask('Wie spät ist es?');
    expect(deps.searchClients).not.toHaveBeenCalled();
  });
  it('drops context after closing/resetting and checks cancellation of a late search', async () => {
    const { conversation, ask } = setup(); await ask('Eine Klientenakte anlegen'); conversation.reset();
    expect((await ask('Ja')).text).toContain('Worauf');
    const abort = new AbortController(); abort.abort();
    await expect(conversation.respond('Kalender öffnen', abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
