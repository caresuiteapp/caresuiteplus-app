import { describe, expect, it } from 'vitest';
import {
  buildClientSignatureFieldBlock,
  buildEmployeeSignatureFieldBlock,
  inferSignatureRequirementFromFields,
  insertSignatureFieldIntoHtml,
  parseSignatureFieldsFromHtml,
} from '@/lib/portal/portalSignatureFieldParser';

describe('portalSignatureFieldParser', () => {
  it('parses explicit signature field markers from html', () => {
    const html = `${buildEmployeeSignatureFieldBlock()}\n${buildClientSignatureFieldBlock()}`;
    const fields = parseSignatureFieldsFromHtml(html);
    expect(fields).toHaveLength(2);
    expect(fields[0]?.role).toBe('employee');
    expect(fields[1]?.role).toBe('client');
  });

  it('inserts signature blocks into existing html', () => {
    const html = insertSignatureFieldIntoHtml('<p>Vertrag</p>', 'employee');
    expect(html).toContain('data-signer-role="employee"');
    expect(parseSignatureFieldsFromHtml(html)).toHaveLength(1);
  });

  it('infers both_sequential when employee and client fields exist', () => {
    const fields = parseSignatureFieldsFromHtml(
      `${buildEmployeeSignatureFieldBlock()}${buildClientSignatureFieldBlock()}`,
    );
    expect(inferSignatureRequirementFromFields(fields)).toBe('both_sequential');
  });

  it('defaults to employee requirement for employee-only fields', () => {
    const fields = parseSignatureFieldsFromHtml(buildEmployeeSignatureFieldBlock());
    expect(inferSignatureRequirementFromFields(fields)).toBe('employee');
  });
});
