# Pinned server-side invoice validation resources

These resources are consumed by `api/_lib/einvoice-validator.mjs`. They are data and executable XSLT rule assets, separate from the application UI. No invoice is sent to a third-party validation service.

## Source and scope

Official KoSIT configuration release:

- <https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v2026-08-31/xrechnung-3.0.2-validator-configuration-2026-08-31.zip>
- Archive SHA-256: `2530cd107c414511c5d0462ec10f886910395abfca820db82e83d70bf01221a8`
- Release/bundle: XRechnung 3.0.2, 2026-08-31. The official archive's internal configuration creation date is 2026-09-02; both dates are preserved, not rewritten.
- EN16931 Schematron 1.3.16 and XRechnung Schematron 2.6.0, including the original `scenarios.xml` severity overrides.
- UBL 2.1 Invoice and CreditNote; UN/CEFACT CII D16B. Full official XSD dependencies are retained.

The two exact supported customization identifiers are:

1. `urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0`: XSD, complete EN16931 rules and complete XRechnung rules.
2. `urn:cen.eu:en16931:2017`: XSD and complete EN16931 rules. This does **not** assert XRechnung compliance.

Other CIUS, XRechnung Extension/CVD, XRechnung 4 previews and Factur-X/ZUGFeRD MINIMUM/BASIC-WL/BASIC/EXTENDED identifiers are unsupported and never released by substituting a different profile. A base-EN16931 CII payload may be validated as structured XML. This does **not** validate its enclosing PDF/A-3 container or establish complete ZUGFeRD conformance.

## Integrity, engines and packaging

`manifest.json` pins every decompressed asset by SHA-256. Its own hash is pinned in the engine and in the trusted archive-report contract. Changing any runtime asset therefore requires an explicit manifest and contract update. The engine verifies both levels before using an asset.

Files ending in `.gz.b64` are base64-encoded gzip, with the original bytes recovered by base64 decoding and gunzip. This text packaging permits reliable repository transport and keeps the deployed bundle small. No rule compiler runs at request time.

Runtime code dependencies are pinned to `libxml2-wasm@0.7.2` and `saxon-js@2.7.0`. XSD execution uses libxml2-WASM; complete Schematron XSLT execution uses SaxonJS SEF. SaxonJS is distributed unmodified under its vendor license. Java is not a production dependency.

The XSD resolver exposes only the pinned in-memory schema closure under `https://schemas.caresuite.invalid/`. It does not register a filesystem or HTTP provider. Input `schemaLocation`, stylesheet instructions, DTD and entity declarations cannot supply validation rules. Source XML is supplied in memory; the official optional XSLT document-URI entry point and caller-provided stylesheet parameters are not used.

The supported input limit is 5 MiB, 50,000 elements and 80 levels of nesting. UTF-8 and UTF-16 with BOM are supported. Rejected encodings, security limits, missing assets, incomplete SVRL and engine failures cannot produce `status: valid`. A validation report hashes the original input bytes, including original encoding. Report scope is always `structured_xml`.

## SaxonJS 2.7 integer compatibility patch

The original KoSIT `xr:checkIBAN` converts the expanded IBAN digit string to `xs:integer` before modulo 97. SaxonJS 2.7's integer modulo calculation loses precision for these large integers. Public XPath evaluation demonstrates:

```text
xs:integer('370400440532013000131489') mod 97 = 65 (SaxonJS 2.7)
xs:decimal('370400440532013000131489') mod 97 = 1  (exact result)
```

For this **one digit-only expression**, each XRechnung XSLT changes the cast from `xs:integer` to `xs:decimal`. Both number types represent the same whole number; decimal modulo yields the same mathematical answer as arbitrary-precision integer modulo. No assertion, severity, field selection or rule is removed or weakened. The engine's executable runtime is not modified. All other official XSLT remains unchanged; official monetary calculations already use decimal arithmetic.

The original full XSLT, adapted full XSLT, two-line patches and compiled SEF are included. `sources/*.original.xsl.gz.b64` are exact bytes from the pinned archive. `sources/xrechnung-*.saxonjs.xsl.gz.b64` contain the compatibility change. The manifest records both hashes and the adaptation version.

The SEFs were compiled with the official `xslt3@2.7.0` compiler:

```sh
node <xslt3-package>/xslt3.js -xsl:<source.xsl> -export:<output.sef.json> -nogo
```

For the two adapted XRechnung sources, the additional compiler option was `-relocate:on`. Recompilation includes a compiler build timestamp, so it produces a new SEF hash; review and repin it instead of editing the compiled artifact.

## Verification

`node scripts/verify-office-einvoice-validator.mjs` runs the actual production XSD and Schematron engines against fictional generated invoices, original KoSIT UBL/CII fixtures, a credit note, invalid totals/contact/date, exact-profile selection, byte hashing, encoding and hostile XML. It checks every pinned asset hash. Warnings and informational messages retain the official scenario severity; for example BR-DE-19 is a warning, not an issuance-blocking official error.

The initial fixtures were independently compared on 2026-10-18 with **KoSIT Validator 1.6.3**, its unmodified Java/Saxon processor, the same official configuration, and no service calls. S/Z/E/AE/O tax cases, an attached proof, UBL credit note and official CII sample passed with matching findings. Valid and invalid IBAN cases were compared to the unmodified Java oracle. The comparison record is in `scripts/fixtures/einvoice/kosit-oracle-results.json`.

Measured on the development environment: about 0.4 seconds cold and 0.07–0.21 seconds warm per small invoice; the complete 35-case test suite took 2.4 seconds and reached 349 MiB peak process RSS with all four stylesheets loaded. These are measurements, not a promise for maximum-size documents. Deployment uses the existing Vercel Node function with its configured memory and duration limits; no Supabase Edge CPU-budget assumption is made.

## Copyright and licenses

- KoSIT configuration and XRechnung XSLT: original Apache-2.0 notices/licenses in `licenses/KoSIT-Apache-2.0.txt` and `licenses/XRechnung-Apache-2.0.txt`. The compatibility adaptation is identified above and in the patch files.
- European Commission EN16931 validation artifacts: EUPL-1.2; full license in `licenses/EN16931-EUPL-1.2.txt`. Corresponding full original XSLT source is included with the compiled assets. Upstream source: <https://github.com/ConnectingEurope/eInvoicing-EN16931>.
- OASIS UBL and UN/CEFACT CII schemas: original copyright and redistribution notices remain embedded in every unmodified schema file.
- Saxonica Ltd SaxonJS: vendor license/copyright/disclaimer in `licenses/SaxonJS-2.7.txt`; runtime redistributed unmodified through its pinned package.
- libxml2-wasm: MIT, full notice in `licenses/libxml2-wasm-MIT.txt`; upstream package retains its own libxml2 notices.

Upstream release source and all relevant full sources/notices remain available with these assets. The validator report is technical evidence about exact structured XML bytes and pinned rules; it is not a legal opinion, a PDF/A certificate or a claim that the surrounding accounting retention process is universally audit-proof.
