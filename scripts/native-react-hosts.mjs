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
export function reactHostTag(node,checker){
  if(!ts.isCallExpression(node)||!node.arguments.length||!ts.isStringLiteralLike(node.arguments[0]))return null;
  const callee=node.expression;
  const factory=ts.isIdentifier(callee)&&importedReactValue(callee,checker,'factory')
    ||(ts.isPropertyAccessExpression(callee)&&callee.name.text==='createElement'||ts.isElementAccessExpression(callee)&&ts.isStringLiteralLike(callee.argumentExpression)&&callee.argumentExpression.text==='createElement')&&ts.isIdentifier(callee.expression)&&importedReactValue(callee.expression,checker,'namespace');
  return factory?node.arguments[0].text:null;
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
  }
  return findings;
}

export function assertNativeReactHosts(sources){
  const findings=findNativeReactHosts(sources);
  if(findings.length)throw Error('Unsupported React host in generated native source:\n'+findings.map(row=>`${row.file}:${row.line}:${row.column} <${row.tag}>`).join('\n'));
}
