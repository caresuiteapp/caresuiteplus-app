import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/liquid-command/screens/AccessScreens.tsx'),
  'utf8',
);

function employeePasswordField(): string {
  const start = source.indexOf('label="Passwort oder Einmalpasswort"');
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, start + 500);
}

describe('Mitarbeitenden-Login Kennwortfeld', () => {
  it('deaktiviert mobile Großschreibung und Autokorrektur', () => {
    const field = employeePasswordField();
    expect(field).toContain('autoCapitalize="none"');
    expect(field).toContain('autoCorrect={false}');
  });

  it('kennzeichnet das Feld als bestehendes Passwort und erlaubt direkte Anmeldung', () => {
    const field = employeePasswordField();
    expect(field).toContain('autoComplete="current-password"');
    expect(field).toContain('textContentType="password"');
    expect(field).toContain('returnKeyType="go"');
    expect(field).toContain('onSubmitEditing={() => void submit()}');
  });
});

