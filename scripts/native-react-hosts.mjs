import ts from 'typescript';
import {resolve} from 'node:path';

function importedReactValue(node,checker,kind){
  return (checker.getSymbolAtLocation(node)?.declarations??[]).some(declaration=>{
    const clause=ts.isImportSpecifier(declaration)?declaration.parent.parent:ts.isNamespaceImport(declaration)?declaration.parent:ts.isImportClause(declaration)?declaration:null;
    if(!clause||clause.isTypeOnly||declaration.isTypeOnly||!ts.isImportDeclaration(clause.parent)||clause.parent.moduleSpecifier.text!=='react')return false;
    return kind==='factory'?ts.isImportSpecifier(declaration)&&(declaration.propertyName??declaration.name).text==='createElement':ts.isNamespaceImport(declaration)||ts.isImportClause(declaration);
  });
}

/** Only React's imported factory creates a host; DOM export strings and local
 * helpers with the same spelling must not be mistaken for rendered elements. */
export function reactHostReference(node,checker){
  if(!ts.isCallExpression(node)||!node.arguments.length)return null;
  const callee=node.expression;
  const factory=ts.isIdentifier(callee)&&importedReactValue(callee,checker,'factory')
    ||(ts.isPropertyAccessExpression(callee)&&callee.name.text==='createElement'||ts.isElementAccessExpression(callee)&&ts.isStringLiteralLike(callee.argumentExpression)&&callee.argumentExpression.text==='createElement')&&ts.isIdentifier(callee.expression)&&importedReactValue(callee.expression,checker,'namespace');
  return factory?node.arguments[0]:null;
}

export function reactHostTag(node,checker){
  const reference=reactHostReference(node,checker);
  return reference&&ts.isStringLiteralLike(reference)?reference.text:null;
}

/** Bind by TypeScript symbol so identically named parameters and data values
 * cannot be confused with the local component selected for a JSX/factory call. */
export function dynamicReactHostBindings(source,checker){
  const bindings=new Map();
  const values=(expression,seen=new Set())=>{
    if(!expression)return [];
    if(ts.isParenthesizedExpression(expression)||ts.isAsExpression(expression)||ts.isTypeAssertionExpression(expression)||ts.isNonNullExpression(expression)||ts.isSatisfiesExpression(expression))return values(expression.expression,seen);
    if(ts.isStringLiteralLike(expression))return /^[a-z]/.test(expression.text)?[{tag:expression.text,node:expression}]:[];
    if(ts.isConditionalExpression(expression))return [...values(expression.whenTrue,seen),...values(expression.whenFalse,seen)];
    if(ts.isBinaryExpression(expression)&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.AmpersandAmpersandToken].includes(expression.operatorToken.kind))return [...values(expression.left,seen),...values(expression.right,seen)];
    if(ts.isIdentifier(expression)){
      const symbol=checker.getSymbolAtLocation(expression);
      if(!symbol||seen.has(symbol))return [];
      const next=new Set(seen);next.add(symbol);
      return (symbol.declarations??[]).filter(declaration=>ts.isVariableDeclaration(declaration)&&declaration.getSourceFile()===source).flatMap(declaration=>values(declaration.initializer,next));
    }
    return [];
  };
  const visit=node=>{
    const reference=(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&ts.isIdentifier(node.tagName)&&! /^[a-z]/.test(node.tagName.text)?node.tagName:reactHostReference(node,checker);
    if(reference&&ts.isIdentifier(reference)){
      const symbol=checker.getSymbolAtLocation(reference),declaration=symbol?.declarations?.find(declaration=>ts.isVariableDeclaration(declaration)&&ts.isIdentifier(declaration.name)&&declaration.initializer&&declaration.getSourceFile()===source);
      if(declaration&&!bindings.has(symbol)){
        const candidates=values(declaration.initializer),unique=[...new Map(candidates.map(value=>[value.tag,value])).values()];
        if(unique.length)bindings.set(symbol,{symbol,declaration,values:unique});
      }
    }
    ts.forEachChild(node,visit);
  };
  visit(source);return [...bindings.values()];
}

export function findNativeReactHosts(sources){
  const files=new Map([...sources].filter(([file])=>/\.native\.tsx?$/.test(file)).map(([file,source])=>[resolve(file),{file,source}]));
  const options={noLib:true,noResolve:true,target:ts.ScriptTarget.Latest,jsx:ts.JsxEmit.Preserve};
  const host={
    getSourceFile:(file,version)=>{const row=files.get(resolve(file));return row?ts.createSourceFile(file,row.source+'\nexport {};\n',version,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS):undefined;},
    getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>process.cwd(),getDirectories:()=>[],
    fileExists:file=>files.has(resolve(file)),readFile:file=>files.get(resolve(file))?.source,getCanonicalFileName:file=>file,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n',
  };
  const program=ts.createProgram([...files.keys()],options,host),checker=program.getTypeChecker(),findings=[];
  for(const source of program.getSourceFiles()){
    const visit=node=>{
      const tag=(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&ts.isIdentifier(node.tagName)?node.tagName.text:reactHostTag(node,checker);
      if(tag&&/^[a-z]/.test(tag)){
        const at=source.getLineAndCharacterOfPosition(node.getStart(source));
        findings.push({file:files.get(resolve(source.fileName)).file,line:at.line+1,column:at.character+1,tag});
      }
      ts.forEachChild(node,visit);
    };
    visit(source);
    for(const binding of dynamicReactHostBindings(source,checker))for(const value of binding.values){
      const at=source.getLineAndCharacterOfPosition(value.node.getStart(source));
      findings.push({file:files.get(resolve(source.fileName)).file,line:at.line+1,column:at.character+1,tag:value.tag});
    }
  }
  return findings;
}

export function assertNativeReactHosts(sources){
  const findings=findNativeReactHosts(sources);
  if(findings.length)throw Error('Unsupported React host in generated native source:\n'+findings.map(row=>`${row.file}:${row.line}:${row.column} <${row.tag}>`).join('\n'));
}
