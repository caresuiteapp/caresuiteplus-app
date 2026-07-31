import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Assist Einsatzliste – Öffnen', () => {
  it('führt direkt zur Bearbeitung statt zur Detailkopie', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/assist/AssignmentsListView.tsx'),
      'utf8',
    );
    expect(source).toContain('router.push(`/assist/assignments/${id}/edit` as never)');
    expect(source).not.toContain('router.push(`/assist/assignments/${id}` as never);');
  });
});

