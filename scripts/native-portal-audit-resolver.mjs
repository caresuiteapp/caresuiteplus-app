import {existsSync,statSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

/** Match this repository's Android Metro selection, never esbuild's .tsx-first
 * defaults. Package imports are deliberately left to the bundler. */
export function createNativePortalAuditResolver(root=process.cwd()){
  const require=createRequire(import.meta.url),extensions=require(resolve(root,'metro.config.js')).resolver.sourceExts;
  const config=ts.readConfigFile(resolve(root,'tsconfig.json'),file=>readFileSync(file,'utf8')).config;
  const aliases=Object.entries(config.compilerOptions.paths).sort(([a],[b])=>b.replace('*','').length-a.replace('*','').length);
  const file=path=>existsSync(path)&&statSync(path).isFile();
  const choose=base=>{
    if(file(base))return base;
    for(const extension of extensions)for(const suffix of ['.android','.native',''])if(file(base+suffix+'.'+extension))return base+suffix+'.'+extension;
    if(existsSync(base)&&statSync(base).isDirectory()){
      const pkg=resolve(base,'package.json');if(file(pkg)){const spec=JSON.parse(readFileSync(pkg,'utf8'));for(const field of ['react-native','browser','main'])if(typeof spec[field]==='string'){const target=choose(resolve(base,spec[field]));if(target)return target;}}
      for(const extension of extensions)for(const suffix of ['.android','.native',''])if(file(resolve(base,'index'+suffix+'.'+extension)))return resolve(base,'index'+suffix+'.'+extension);
    }
    return null;
  };
  return {extensions,resolve(specifier,importer){
    if(specifier.startsWith('.'))return choose(resolve(dirname(importer),specifier));
    for(const [pattern,targets] of aliases){const star=pattern.indexOf('*');if(star<0?specifier===pattern:specifier.startsWith(pattern.slice(0,star))&&specifier.endsWith(pattern.slice(star+1))){const segment=star<0?'':specifier.slice(star,specifier.length-(pattern.length-star-1));for(const target of targets){const result=choose(resolve(root,target.replace('*',segment)));if(result)return result;}return null;}}
    return null;
  }};
}
