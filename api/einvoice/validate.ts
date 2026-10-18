import { validateEInvoiceXml } from '../_lib/einvoice-validator.mjs';
import { createEInvoiceValidationHandler } from '../_lib/einvoice-validation-handler';
import { extractEInvoicePdfXml } from '../_lib/einvoice-pdf-extract.mjs';

export default createEInvoiceValidationHandler({ fetch: globalThis.fetch, validate: validateEInvoiceXml, extractPdfXml: extractEInvoicePdfXml,
  env: { EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY } });
