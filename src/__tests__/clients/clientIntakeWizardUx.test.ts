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
    expect(hero).toContain('Datenspeicherung aktiv');
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
    expect(form).toContain('Entwurf geladen');
  });

  it('schützt Schlüsselnummer und Tresor-Code vor Browser-Passwortmanagern', () => {
    const form = readSrc('components/office/clientintakewizardform.tsx');
    const input = readSrc('components/ui/PremiumInput.tsx');

    expect(form).toContain('nativeID="client-intake-key-number"');
    expect(form).toContain('nativeID="client-intake-key-safe-code"');
    expect(form.match(/sensitiveBusinessValue/g)).toHaveLength(2);
    expect(form).toContain("secureTextEntry={Platform.OS !== 'web'}");
    expect(input).toContain("autoComplete: 'off'");
    expect(input).toContain("'data-1p-ignore': 'true'");
    expect(input).toContain("'data-lpignore': 'true'");
    expect(input).toContain("WebkitTextSecurity: 'disc'");
  });

  it('Neuaufnahme erhebt Pflegegrad im immer sichtbaren Abrechnungsschritt', () => {
    const form = readSrc('components/office/clientintakewizardform.tsx');
    const costBearerSection = form.slice(
      form.indexOf("if (section === 'kostentraeger')"),
      form.indexOf("if (section === 'angehoerige')"),
    );

    expect(costBearerSection).toContain('catalogKey="care_level"');
    expect(costBearerSection).toContain('label="Pflegegrad *"');
    expect(costBearerSection).toContain("updateField('careLevel', v)");
    expect(costBearerSection).toContain('care_level_status');
    expect(costBearerSection).toContain('Pflegegrad gültig ab');
  });

  it('finalisiert unterschriebene Dokumente nach Änderungen ihrer Stammdaten erneut', () => {
    const panel = readSrc('components/inputs/CareIntakeDocumentsStepPanel.tsx');
    const hook = readSrc('hooks/useClientIntakeWizard.ts');

    expect(panel).toContain('}, [templates, form, tenantMeta, onChange]);');
    expect(panel).toContain('Klienten-Unterschrift ist gespeichert.');
    expect(panel).toContain('Noch fehlende Angaben:');
    expect(hook).toContain("key.startsWith('intake')");
  });
});
