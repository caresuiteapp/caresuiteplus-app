import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_ANIMAL_AVATAR_VARIANT_COUNT,
  CLIENT_ANIMAL_PALETTES,
  CLIENT_ANIMAL_SPECIES,
  getClientAnimalAvatarByIndex,
  resolveClientAnimalAvatar,
} from '@/lib/clients/clientAnimalAvatar';

const source = (path: string) => readFileSync(path, 'utf8');

describe('R16 automatische Comic-Tier-Profilbilder', () => {
  it('stellt 200 Tierarten in exakt 10 Farbwelten bereit', () => {
    const signatures = new Set(
      Array.from({ length: CLIENT_ANIMAL_AVATAR_VARIANT_COUNT }, (_, index) => (
        getClientAnimalAvatarByIndex(index).signature
      )),
    );
    expect(CLIENT_ANIMAL_AVATAR_VARIANT_COUNT).toBe(2_000);
    expect(CLIENT_ANIMAL_SPECIES).toHaveLength(200);
    expect(new Set(CLIENT_ANIMAL_SPECIES).size).toBe(200);
    expect(CLIENT_ANIMAL_PALETTES).toHaveLength(10);
    expect(signatures.size).toBe(2_000);
  });

  it('verwendet keine Accessoire-Ebene', () => {
    const generator = source('src/lib/clients/clientAnimalAvatar.ts');
    const component = source('src/components/clients/ClientAnimalAvatar.tsx');
    expect(generator).not.toMatch(/accessor|zubehör/i);
    expect(component).not.toMatch(/accessor|zubehör/i);
  });

  it('ordnet derselben Klienten-ID dauerhaft dieselbe Variante zu', () => {
    expect(resolveClientAnimalAvatar('client-123')).toEqual(resolveClientAnimalAvatar('client-123'));
  });

  it('bleibt offline und sendet keine Klientendaten an externe Avatar-Dienste', () => {
    const component = source('src/components/clients/ClientAnimalAvatar.tsx');
    expect(component).toContain('resolveClientAnimalAvatar(clientId)');
    expect(component).not.toMatch(/dicebear|gravatar|https?:\/\//i);
  });

  it('ist in Assist, Office und Mitarbeitendenportal integriert', () => {
    const targets = [
      'src/liquid-command/screens/AssistClientsWorkspace.tsx',
      'src/components/office/ClientCompactRow.tsx',
      'src/components/office/ClientListCard.tsx',
      'src/components/office/ClientsListTable.tsx',
      'src/components/office/ClientRecordHero.tsx',
      'src/components/portal/EmployeePortalClientRecordsScreen.tsx',
      'src/components/portal/EmployeePortalClientRecordDetailScreen.tsx',
    ];
    for (const target of targets) {
      expect(source(target), target).toContain('ClientAnimalAvatar');
    }
  });
});
