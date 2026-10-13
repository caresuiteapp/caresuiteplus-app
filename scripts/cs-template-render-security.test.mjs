import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const normalizer = moduleUrl(stripTypeScriptTypes(await readFile(new URL('../src/lib/documents/csTemplates/csDocumentContextNormalize.ts', import.meta.url), 'utf8')));
const source = stripTypeScriptTypes(await readFile(new URL('../src/lib/documents/csTemplates/csTemplateRenderService.ts', import.meta.url), 'utf8')).replace("'./csDocumentContextNormalize'", JSON.stringify(normalizer));
const { renderCsTemplateHtml, injectSignatureIntoHtml } = await import(moduleUrl(source));
const context = value => ({ tenant: {}, document: {}, client: { full_name: value } });
test('context HTML becomes literal text, including quotes and ampersands', () => {
 assert.equal(renderCsTemplateHtml('<p>{{client.full_name}}</p>', context('<img src=x onerror=alert(1)> & "x"')), '<p>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;x&quot;</p>');
});
test('whitespace, repeated tokens and inserted token text use one pass', () => {
 assert.equal(renderCsTemplateHtml('{{  client.full_name  }} / {{client.full_name}}', context('{{tenant.legal_name}}')), '{{tenant.legal_name}} / {{tenant.legal_name}}');
});
test('optional empty text cannot insert markup', () => {
 assert.equal(renderCsTemplateHtml('{{client.full_name}}', context(''), { emptyOptionalPlaceholder: '<b>missing</b>' }), '&lt;b&gt;missing&lt;/b&gt;');
});
test('signer names cannot insert markup or replacement dollar tokens', () => {
 const output = injectSignatureIntoHtml('<span data-signature-anchor="client">[SIGNATURE:client]</span>', 'client', 'data:image/png;base64,abc', '<img> $& $1', '2026-10-13T00:00:00Z');
 assert.ok(output.includes('&lt;img&gt; $&amp; $1'));
 assert.equal((output.match(/<span/g) ?? []).length, 1);
});
test('anchor metacharacters match only the literal intended anchor', () => {
 const html = '<span data-signature-anchor="axb">[SIGNATURE:client]</span><span data-signature-anchor="a.b">[SIGNATURE:client]</span>';
 const output = injectSignatureIntoHtml(html, 'a.b', 'data:image/png;base64,abc', 'Name', '2026-10-13T00:00:00Z');
 assert.ok(output.startsWith('<span data-signature-anchor="axb">[SIGNATURE:client]</span>'));
 assert.equal((output.match(/<img/g) ?? []).length, 1);
});
test('active image formats and injected URLs are rejected', () => {
 for (const image of ['javascript:alert(1)', 'data:image/svg+xml;base64,abc', 'data:image/png;base64,abc" onerror="alert(1)']) {
  assert.throws(() => injectSignatureIntoHtml('', 'client', image, 'Name', '2026-10-13T00:00:00Z'));
 }
});
test('fallback signature anchors are escaped', () => {
 const output = injectSignatureIntoHtml('', 'client" onmouseover="x', 'data:image/png;base64,abc', 'Name', '2026-10-13T00:00:00Z');
 assert.ok(output.includes('data-signature-anchor="client&quot; onmouseover=&quot;x"'));
});
