import { createEInvoiceValidationHandler } from '../_lib/einvoice-validation-handler';

// Native dynamic imports keep the validator's asynchronous WASM initialization
// outside the CommonJS startup graph and preserve its module-relative assets.
export default createEInvoiceValidationHandler({ fetch: globalThis.fetch,
  validate: async input => (await import('../_lib/einvoice-validator.mjs')).validateEInvoiceXml(input),
  extractPdfXml: async original => (await import('../_lib/einvoice-pdf-extract.mjs')).extractEInvoicePdfXml(original),
  env: { EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY } });
