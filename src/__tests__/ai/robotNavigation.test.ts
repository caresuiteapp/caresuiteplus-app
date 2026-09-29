import { createReplyPicker, ROBOT_REPLIES } from '../../ai/robot/robotReplies';
import { describe, expect, it, vi } from 'vitest';
import { matchVoiceClients, parseVoiceCommand } from '../../ai/robot/voiceCommands';
import { loadLocalRobotVoice } from '../../ai/robot/robotVoice.web';
import { ROBOT_AUDIO_TEXT } from '../../ai/robot/robotAudioBank.web';

describe('robot navigation commands', () => {
  it.each([
    ['Kalender öffnen', 'calendar'], ['Öffne bitte die Klientenakte', 'clients'],
    ['Gehe zum Kalender', 'calendar'], ['Kannst du bitte die Rechnungen öffnen', 'invoices'],
    ['Zur Startseite', 'home'], ['Öffne Nachrichten', 'messages'],
    ['Einsätze öffnen', 'assignments'], ['Leistungsnachweise öffnen', 'evidence'],
  ])('recognizes %s', (text, key) => {
    const command = parseVoiceCommand(text);
    expect(command.kind === 'navigate' && command.destination.key).toBe(key);
  });
  it.each(['Öffne nicht die Akte von Müller', 'Lösche die Klientenakte', 'Öffne Kalender und Rechnungen', 'Öffne https://example.com'])('rejects ambiguous or unsupported commands: %s', text => {
    expect(parseVoiceCommand(text).kind).toBe('unknown');
  });
  it('extracts a full name and optional title', () => {
    expect(parseVoiceCommand('Hey CareSuite, öffne die Akte von Frau Anna Müller')).toEqual({kind:'client',name:'Anna Müller'});
  });
  it('preserves ambiguous names and accepts transliterated umlauts', () => {
    const clients=[{id:'a',firstName:'Anna',lastName:'Müller'},{id:'b',firstName:'Paul',lastName:'Müller'}];
    expect(matchVoiceClients('Mueller',clients)).toHaveLength(2);
    expect(matchVoiceClients('Anna Müller',clients)).toEqual([clients[0]]);
    expect(matchVoiceClients('Ann',clients)).toEqual([]);
  });
});

describe('bundled robot voice', () => {
  it('ships matching audio for every reply and loads it without a network request', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    try {
      const phrases = Object.entries(ROBOT_REPLIES).flatMap(([key, texts]) => texts.map((text, index) => [`${key}:${index}`, text]));
      expect(Object.keys(ROBOT_AUDIO_TEXT)).toHaveLength(phrases.length);
      for (const [id, text] of phrases) {
        expect(ROBOT_AUDIO_TEXT[id]).toBe(text);
        const audio = await loadLocalRobotVoice(id, new AbortController().signal);
        expect(audio.byteLength).toBeGreaterThan(1000);
      }
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
  it('does not reuse buffers detached by the browser audio decoder', async () => {
    const signal = new AbortController().signal;
    const first = await loadLocalRobotVoice('calendar:0', signal);
    const originalLength = first.byteLength;
    structuredClone(first, { transfer: [first] });
    expect(first.byteLength).toBe(0);
    expect((await loadLocalRobotVoice('calendar:0', signal)).byteLength).toBe(originalLength);
  });
  it('rejects canceled playback and unknown replies', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(loadLocalRobotVoice('calendar:0', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await expect(loadLocalRobotVoice('user-supplied-text', new AbortController().signal)).rejects.toThrow('unknown-reply');
    await expect(loadLocalRobotVoice('constructor', new AbortController().signal)).rejects.toThrow('unknown-reply');
  });
});


describe('robot replies', () => {
  it('does not repeat the previous response even across destinations', () => {
    const pick = createReplyPicker(() => 0.5);
    const first = pick('calendar');
    expect(pick('invoices').text).not.toBe(first.text);
    expect(pick('invoices').id.startsWith('invoices:')).toBe(true);
  });
  it('only returns fixed phrases without interpolating personal data', () => {
    const pick = createReplyPicker();
    for (const key of Object.keys(ROBOT_REPLIES) as Array<keyof typeof ROBOT_REPLIES>) {
      const reply = pick(key);
      expect((ROBOT_REPLIES[key] as readonly string[]).includes(reply.text)).toBe(true);
    }
  });
});
