import ts from 'typescript';

export function unparenthesized(node){
  while(node&&ts.isParenthesizedExpression(node))node=node.expression;
  return node;
}

export function workspaceStyleExpressions(node){
  node=unparenthesized(node);
  return node&&ts.isJsxElement(node)&&node.openingElement.tagName.getText()==='style'
    ?node.children.filter(ts.isJsxExpression).flatMap(child=>child.expression?[child.expression]:[]):[];
}

/** A pure exported CSS emitter needs to supply the surrounding native tree,
 * because a null-rendering child cannot style its siblings or parent. Only
 * module-bound CSS is exported; component-local/prop-dependent values stay in
 * their original render scope. */
export function workspaceStyleEmitters(ast,checker,importedStyles=new Map()){
  const result=new Map();
  for(const statement of ast.statements){
    if(!ts.isFunctionDeclaration(statement)||!statement.name||statement.parameters.length||!statement.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword))continue;
    const body=statement.body?.statements.filter(node=>!ts.isEmptyStatement(node));
    if(body?.length!==1||!ts.isReturnStatement(body[0]))continue;
    const moduleBound=expression=>ts.isStringLiteralLike(expression)||expression.kind===ts.SyntaxKind.RegularExpressionLiteral||ts.isIdentifier(expression)&&(checker.getSymbolAtLocation(expression)?.declarations??[]).some(declaration=>ts.isImportSpecifier(declaration)||ts.isVariableDeclaration(declaration)&&ts.isVariableDeclarationList(declaration.parent)&&ts.isVariableStatement(declaration.parent.parent)&&ts.isSourceFile(declaration.parent.parent.parent))||ts.isCallExpression(expression)&&ts.isPropertyAccessExpression(expression.expression)&&expression.expression.name.text==='replace'&&moduleBound(expression.expression.expression)&&expression.arguments.every(moduleBound);
    const collect=node=>{
      node=unparenthesized(node);
      if(!node)return null;
      if(ts.isJsxText(node)&&!node.text.trim()||ts.isJsxExpression(node)&&!node.expression)return [];
      if(ts.isJsxFragment(node)){
        const children=node.children.map(collect);
        return children.every(child=>child!==null)?children.flat():null;
      }
      const expressions=workspaceStyleExpressions(node);
      if(expressions.length&&expressions.every(moduleBound))return expressions;
      if(ts.isJsxSelfClosingElement(node)&&!node.attributes.properties.length){
        const sheet=importedStyles.get(node.tagName.getText(ast));
        if(sheet)return [ts.factory.createSpreadElement(ts.factory.createElementAccessExpression(ts.factory.createIdentifier(sheet.alias),ts.factory.createStringLiteral(sheet.exported)))];
      }
      return null;
    };
    const expressions=collect(body[0].expression);
    if(expressions?.length)result.set(statement.name.text,expressions);
  }
  return result;
}
