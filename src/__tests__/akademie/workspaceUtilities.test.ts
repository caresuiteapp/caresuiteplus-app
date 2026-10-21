import { describe, expect, it } from 'vitest';
import { academySafeResourceUrl, type AcademyCertificate } from '@/lib/akademie/workspaceModel';
import { ACADEMY_TEMPLATES, createAcademyTemplate } from '@/lib/akademie/workspaceTemplates';
import { createAcademyCertificatePdf } from '@/lib/akademie/certificatePdf';

describe('Academy learning resources and templates', () => {
  it('accepts only intentional HTTPS resources without embedded credentials', () => {
    expect(academySafeResourceUrl('https://example.org/material.pdf')).toBe('https://example.org/material.pdf');
    for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'http://example.org', 'https://name:secret@example.org/file']) {
      expect(academySafeResourceUrl(url)).toBeNull();
    }
  });
  it('creates independent authoring drafts for all audiences without sharing lesson or answer IDs', () => {
    expect(new Set(ACADEMY_TEMPLATES.flatMap(item => item.audiences))).toEqual(new Set(['employee', 'client', 'family']));
    const one = createAcademyTemplate('workshop');
    const two = createAcademyTemplate('workshop');
    expect(one.lessons[0].id).not.toBe(two.lessons[0].id);
    const question = one.lessons.find(lesson => lesson.kind === 'quiz')!.questions![0];
    expect(question.options.some(option => option.id === question.correctOptionId)).toBe(true);
    expect(question.id).not.toBe(two.lessons.find(lesson => lesson.kind === 'quiz')!.questions![0].id);
    one.audiences.pop();
    expect(two.audiences).toHaveLength(3);
  });
});

const certificate: AcademyCertificate = {
  id: 'a3692f61-ab26-460e-9fd7-3f69d854ec41', enrollmentId: 'enrollment-one', number: 'AK-2026-0001',
  courseTitle: 'Zusammenarbeit, Absprachen und nächste Schritte', participantName: 'Jörg Müller-Özdemir',
  audience: 'family', issuedAt: '2026-10-21T10:30:00Z', validUntil: null, revokedAt: null, revokedReason: null,
  issuerName: 'Anne Beispiel', organizationName: 'Einrichtung mit persönlicher Begleitung', versionNumber: 3, estimatedMinutes: 25,
};
describe('Personal academy completion PDF', () => {
  it('produces a real PDF with embedded font and keeps a typical certificate to one page', async () => {
    const pdf = await createAcademyCertificatePdf(certificate);
    const output = pdf.output();
    expect(output.startsWith('%PDF')).toBe(true);
    expect(output).toContain('/FontFile2');
    expect(pdf.getNumberOfPages()).toBe(1);
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(10000);
  });
  it('handles long values and revocation without clipping into the footer', async () => {
    const pdf = await createAcademyCertificatePdf({ ...certificate,
      participantName: 'Langer persönlicher Name '.repeat(14), courseTitle: 'Ausführlicher Schulungstitel '.repeat(30),
      organizationName: 'Einrichtung '.repeat(30), revokedAt: '2026-10-22T12:00:00Z',
      revokedReason: 'Ausstellung nach erneuter Prüfung zurückgenommen. '.repeat(30),
    });
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    expect(pdf.output().startsWith('%PDF')).toBe(true);
  });
  it('rejects an incomplete or undated receipt', async () => {
    await expect(createAcademyCertificatePdf({ ...certificate, issuedAt: '' })).rejects.toThrow('unvollständig');
    await expect(createAcademyCertificatePdf({ ...certificate, issuedAt: 'wrong-date' })).rejects.toThrow('ungültig');
  });
});
