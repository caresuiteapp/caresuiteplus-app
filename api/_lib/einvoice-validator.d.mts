export const MAX_EINVOICE_XML_BYTES: number;
export const XRECHNUNG_PROFILE: string;
export const EN16931_PROFILE: string;
export interface EInvoiceValidationResult {
  schemaVersion: 1;
  status: 'valid' | 'invalid' | 'unsupported' | 'error';
  documentSha256: string;
  syntax: 'ubl_invoice' | 'ubl_credit_note' | 'cii' | null;
  profileId: string;
  standard: 'xrechnung_3.0' | 'en16931' | null;
  source: 'server';
  scope: 'structured_xml';
  engine: { name: string; version: string };
  ruleSet: { name: string; version: string; sha256: string };
  checks: Array<{ kind: 'syntax' | 'xsd' | 'business_rules'; status: 'passed' | 'failed' | 'not_run' }>;
  businessRuleSets: string[];
  findings: Array<{ code: string; severity: 'error' | 'warning' | 'information'; message: string; location?: string }>;
  checkedAt: string;
  durationMs: number;
}
export function validateEInvoiceXml(input: { xml: Uint8Array; expectedProfileId?: string }): Promise<EInvoiceValidationResult>;
