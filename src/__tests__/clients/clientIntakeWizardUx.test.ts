import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const srcRoot = path.join(__dirname, '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

describe('Client intake wizard UX fixes', () => {
  it('FormScreenHero zeigt Live-Mandant statt Demo-KPIs', () => {
    const hero = readSrc('components/forms/FormScreenHero.tsx');
    expect(hero).toContain('useTenantDisplayName');
    expect(hero).toContain("getServiceMode() === 'supabase'");
    expect(hero).toContain('Live-Speicherung');
    expect(hero).toContain('Mandantengebunden');
  });

  it('Neuaufnahme-Wizard nutzt kundenfreundliche Hero-Texte', () => {
    const screen = readSrc('screens/business/office/ClientIntakeWizardScreen.tsx');
    expect(screen).toContain('Klient:in aufnehmen');
    expect(screen).not.toContain('Kontextbasierte Aufnahme');
    expect(screen).toContain('Leistungsart wählen');
  });

  it('CareDateInput erlaubt lokale Eingabe während der Tippvorgang', () => {
    const input = readSrc('components/inputs/CareDateInput.tsx');
    expect(input).toContain('useState');
    expect(input).toContain('setDraft');
    expect(input).toContain('onBlur');
    expect(input).toContain("type: 'date'");
    expect(input).toContain('showPicker');
  });

  it('Neuaufnahme-Wizard persistiert Entwürfe lokal', () => {
    const hook = readSrc('hooks/useClientIntakeWizard.ts');
    const storage = readSrc('lib/clients/clientIntakeDraftStorage.ts');
    const form = readSrc('components/office/clientintakewizardform.tsx');

    expect(storage).toContain('caresuite:client-intake-draft');
    expect(hook).toContain('loadClientIntakeDraft');
    expect(hook).toContain('saveClientIntakeDraft');
    expect(hook).toContain('clearClientIntakeDraft');
    expect(hook).toContain('discardDraft');
    expect(hook).toContain('saveDraft');
    expect(hook).toContain('Entwurf gespeichert');
    expect(form).toContain('Als Entwurf speichern');
    expect(form).toContain('Neu beginnen');
    expect(form).toContain('Entwurf wiederhergestellt');
  });
});
