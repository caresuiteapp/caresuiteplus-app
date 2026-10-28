import ts from 'typescript';
import {resolve} from 'node:path';

const browserGlobals=new Set(['CSS','ResizeObserver','MutationObserver','DOMParser']);
const nativeGlobalRoots=new Set(['globalThis','global','window']);
const candidate=/\b(?:CSS|ResizeObserver|MutationObserver|DOMParser)\b/;

function runtimePosition(node){
  for(let parent=node.parent;parent;parent=parent.parent){
    if(parent.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.DeclareKeyword))return false;
    if(ts.isImportDeclaration(parent)||ts.isExportDeclaration(parent)||ts.isInterfaceDeclaration(parent)||ts.isTypeAliasDeclaration(parent))return false;
    if(ts.isTypeNode(parent)){
      // Class `extends` executes its base expression; `implements`, interface
      // inheritance, annotations and type queries do not read a runtime value.
      if(ts.isExpressionWithTypeArguments(parent)&&parent.expression.pos<=node.pos&&node.end<=parent.expression.end&&parent.parent.token===ts.SyntaxKind.ExtendsKeyword&&ts.isClassLike(parent.parent.parent))continue;
      return false;
    }
  }
  return true;
}

function declaredAtRuntime(symbol){
  if(!symbol)return false;
  if(symbol.flags&ts.SymbolFlags.Alias)return (symbol.declarations??[]).some(declaration=>{
    if(ts.isImportSpecifier(declaration))return !declaration.isTypeOnly&&!declaration.parent.parent.isTypeOnly;
    if(ts.isImportClause(declaration))return !declaration.isTypeOnly;
    if(ts.isNamespaceImport(declaration))return !declaration.parent.isTypeOnly;
    if(ts.isImportEqualsDeclaration(declaration))return !declaration.isTypeOnly;
    return false;
  });
  if(!(symbol.flags&ts.SymbolFlags.Value))return false;
  return (symbol.declarations??[]).some(declaration=>{
    for(let node=declaration;node;node=node.parent){
      if(node.getSourceFile().isDeclarationFile||node.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.DeclareKeyword))return false;
    }
    return true;
  });
}

function nameOnly(node){
  const parent=node.parent;
  return (ts.isPropertyAccessExpression(parent)&&parent.name===node)
    ||((ts.isPropertyAssignment(parent)||ts.isPropertyDeclaration(parent)||ts.isMethodDeclaration(parent)||ts.isGetAccessorDeclaration(parent)||ts.isSetAccessorDeclaration(parent)||ts.isJsxAttribute(parent))&&parent.name===node)
    ||(ts.isLabeledStatement(parent)&&parent.label===node)
    ||((ts.isBreakStatement(parent)||ts.isContinueStatement(parent))&&parent.label===node);
}

/** Inspect produced native sources without loading imports or browser typings.
 * @param {Iterable<[string,string]>} sources path/content pairs (the generator's desired Map).
 * @returns {{file:string,line:number,column:number,name:string}[]}
 */
export function findNativeRuntimeGlobals(sources){
  const entries=[...sources].filter(([file,source])=>/\.native\.tsx?$/.test(file)&&candidate.test(source));
  if(!entries.length)return [];
  const files=new Map(entries.map(([file,source])=>[resolve(file),{file,source}]));
  const options={noLib:true,noResolve:true,skipLibCheck:true,target:ts.ScriptTarget.Latest,jsx:ts.JsxEmit.Preserve};
  const host={
    // Every produced file is its own module. Appending a marker for analysis
    // also prevents a small script fixture's local CSS constant from supplying
    // a false global binding to another file; original line positions stay put.
    getSourceFile:(file,version)=>{const row=files.get(resolve(file));return row?ts.createSourceFile(file,row.source+'\nexport {};\n',version,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS):undefined;},
    getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>process.cwd(),
    getDirectories:()=>[],fileExists:file=>files.has(resolve(file)),readFile:file=>files.get(resolve(file))?.source,
    getCanonicalFileName:file=>file,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n',
  };
  const program=ts.createProgram([...files.keys()],options,host),checker=program.getTypeChecker(),findings=[];
  for(const source of program.getSourceFiles()){
    const file=files.get(resolve(source.fileName)).file,seen=new Set();
    const report=(node,name)=>{const position=node.getStart(source);if(seen.has(position))return;seen.add(position);const at=source.getLineAndCharacterOfPosition(position);findings.push({file,line:at.line+1,column:at.character+1,name});};
    const visit=node=>{
      if(runtimePosition(node)){
        if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)){
          const root=node.expression,name=ts.isPropertyAccessExpression(node)?node.name.text:ts.isStringLiteralLike(node.argumentExpression)?node.argumentExpression.text:undefined;
          if(ts.isIdentifier(root)&&nativeGlobalRoots.has(root.text)&&browserGlobals.has(name))report(node,root.text+'.'+name);
        }
        if(ts.isVariableDeclaration(node)&&ts.isObjectBindingPattern(node.name)&&node.initializer&&ts.isIdentifier(node.initializer)&&nativeGlobalRoots.has(node.initializer.text)){
          for(const binding of node.name.elements){const name=binding.propertyName??binding.name;if((ts.isIdentifier(name)||ts.isStringLiteralLike(name))&&browserGlobals.has(name.text))report(binding,node.initializer.text+'.'+name.text);}
        }
        if(ts.isIdentifier(node)&&browserGlobals.has(node.text)&&!nameOnly(node)&&!declaredAtRuntime(checker.getSymbolAtLocation(node)))report(node,node.text);
      }
      ts.forEachChild(node,visit);
    };
    visit(source);
  }
  return findings;
}

/** Fail before writing any output; never select a previous native UI fallback.
 * @param {Iterable<[string,string]>} sources
 */
export function assertNativeRuntimeGlobals(sources){
  const findings=findNativeRuntimeGlobals(sources);
  if(findings.length)throw Error('Unsupported browser runtime global in generated native source:\n'+findings.map(item=>`${item.file}:${item.line}:${item.column} ${item.name}`).join('\n'));
}
