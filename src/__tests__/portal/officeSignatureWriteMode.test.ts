import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildEmployeeSignatureFieldBlock,
  insertSignatureFieldIntoHtml,
  parseSignatureFieldsFromHtml,
  wrapSignatureDocumentPreviewHtml,
} from '@/lib/portal/portalSignatureFieldParser';

describe('office write mode signature fields', () => {
  it('wraps preview html with signature field styles', () => {
    const html = wrapSignatureDocumentPreviewHtml(
      `<p>Vertrag</p>${buildEmployeeSignatureFieldBlock()}`,
    );
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('.portal-signature-field');
    expect(html).toContain('data-signature-field-id="employee_signature"');
  });

  it('parses signature fields after insert into write document', () => {
    const base = '<h1>Titel</h1><p>Inhalt</p>';
    const html = insertSignatureFieldIntoHtml(base, 'employee');
    const fields = parseSignatureFieldsFromHtml(html);
    expect(fields).toHaveLength(1);
    expect(fields[0]?.role).toBe('employee');
  });
});

describe('OfficeSignatureDocumentComposer write-mode guards', () => {
  it('applies template html from built.html not built.data', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/office/OfficeSignatureDocumentComposer.tsx'),
      'utf8',
    );
    expect(source).toContain('setHtmlContent(built.html)');
    expect(source).not.toMatch(/setHtmlContent\(built\.data\)/);
  });

  it('resets write content when switching to Schreiben tab', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/office/OfficeSignatureDocumentComposer.tsx'),
      'utf8',
    );
    expect(source).toContain("next === 'office_write'");
    expect(source).toContain('DEFAULT_WRITE_HTML');
    expect(source).toContain('sourceTabRef.current');
  });

  it('exposes Schreiben compose mode in office signatures screen', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/screens/office/CsOfficeDocumentSignaturesScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('OfficeSignatureDocumentComposer');
    expect(source).toContain('Schreiben / PDF');
  });
});
