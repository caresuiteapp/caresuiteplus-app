import type { IcdCodeEntry } from '@/types/medical';

/** Demo-ICD-10-GM Stichprobe — nur Demo-Modus, keine Produktiv-Kataloge. */
export const DEMO_ICD10_CODES: IcdCodeEntry[] = [
  {
    id: 'icd-demo-j18',
    code: 'J18.9',
    title: 'Pneumonie, nicht näher bezeichnet',
    chapter: 'X',
    blockCode: 'J18',
    isTerminal: true,
  },
  {
    id: 'icd-demo-i10',
    code: 'I10',
    title: 'Essentielle Hypertonie',
    chapter: 'IX',
    blockCode: 'I10-I15',
    isTerminal: true,
  },
  {
    id: 'icd-demo-e11',
    code: 'E11.9',
    title: 'Diabetes mellitus Typ 2 ohne Komplikationen',
    chapter: 'IV',
    blockCode: 'E11',
    isTerminal: true,
  },
  {
    id: 'icd-demo-m54',
    code: 'M54.5',
    title: 'Kreuzschmerz',
    chapter: 'XIII',
    blockCode: 'M54',
    isTerminal: true,
  },
  {
    id: 'icd-demo-f32',
    code: 'F32.9',
    title: 'Depressive Episode, nicht näher bezeichnet',
    chapter: 'V',
    blockCode: 'F32',
    isTerminal: true,
  },
  {
    id: 'icd-demo-z74',
    code: 'Z74.0',
    title: 'Eingeschränkte Mobilität',
    chapter: 'XXI',
    blockCode: 'Z74',
    isTerminal: true,
  },
];

export function searchDemoIcdCodes(query: string): IcdCodeEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return DEMO_ICD10_CODES;

  return DEMO_ICD10_CODES.filter(
    (entry) =>
      entry.code.toLowerCase().includes(normalized) ||
      entry.title.toLowerCase().includes(normalized),
  );
}
