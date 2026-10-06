import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const flag = process.argv.indexOf('--output');
const output = resolve(flag < 0 ? resolve(root,'docs/previews/registration-welcome') : process.argv[flag+1]);
const source = readFileSync(resolve(root,'supabase/functions/_shared/registrationWelcomeEmail.ts'),'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const assetSource = readFileSync(resolve(root,'supabase/functions/_shared/registrationWelcomeAssets.ts'),'utf8');
const assetCompiled = ts.transpileModule(assetSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const assets = { exports:{} };
vm.runInNewContext(assetCompiled,assets,{timeout:1000});
const context = { exports:{}, URL, AbortSignal, require: name => {
  if(name !== './registrationWelcomeAssets.ts') throw new Error(`Unexpected preview import: ${name}`);
  return assets.exports;
} };
vm.runInNewContext(compiled,context,{timeout:1000});
const details={companyName:'Beispielunternehmen GmbH',recipientName:'Kevin Reinhardt',recipientEmail:'verwaltung@beispielunternehmen.de',username:'admin.beispiel'};
const content=context.exports.buildRegistrationWelcomeEmail(details,undefined,'preview');
mkdirSync(output,{recursive:true});
writeFileSync(resolve(output,'CareSuite_Willkommensmail_Vorschau.html'),content.html);
// A long-data case is useful for checking wrapping in narrow email clients.
const long=context.exports.buildRegistrationWelcomeEmail({...details,companyName:'Ambulante Pflege, Alltagsbegleitung und Betreuung für Menschen und Familien – Beispielorganisation mit einem sehr langen Unternehmensnamen GmbH',recipientName:'Alexandra-Christiane Beispielname-Mustermann',recipientEmail:'verwaltung.und.organisationsleitung@beispielunternehmen-mit-langer-domain.de'},undefined,'preview');
writeFileSync(resolve(output,'CareSuite_Willkommensmail_Langtext.html'),long.html);
const recoverySource=readFileSync(resolve(root,'supabase/functions/_shared/businessRecoveryEmail.ts'),'utf8');
const recoveryCompiled=ts.transpileModule(recoverySource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const recoveryContext={exports:{},require:context.require};
vm.runInNewContext(recoveryCompiled,recoveryContext,{timeout:1000});
const recovery=recoveryContext.exports.buildBusinessRecoveryEmail(details.recipientName,'https://www.caresuiteplus.app/auth/reset-password#token_hash=BEISPIEL_KEIN_GUELTIGER_LINK&type=recovery',{appUrl:'https://www.caresuiteplus.app'},'preview');
writeFileSync(resolve(output,'CareSuite_Passwortmail_Vorschau.html'),recovery.html);
console.log(JSON.stringify({output,htmlBytes:Buffer.byteLength(content.html),samples:true}));
