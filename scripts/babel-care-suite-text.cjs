/**
 * Apply shared text defaults to app-owned RN imports on every platform.
 * Keep dependency/icon internals and the primitive implementation untouched.
 */
module.exports = function careSuiteTextPlugin({ types: t }) {
  return {
    name: 'care-suite-text-defaults',
    visitor: {
      ImportDeclaration(path, state) {
        if (path.node.source.value !== 'react-native') return;
        const filename = (state.filename || '').replace(/\\/g, '/');
        if (filename.includes('/node_modules/') ||
            !/\/(src|app|app-portal)\//.test(filename) ||
            filename.endsWith('/design/components/CareSuiteText.tsx') ||
            filename.endsWith('/design/installSystemTextDefaults.ts')) return;
        const selected = path.node.specifiers.filter(s => t.isImportSpecifier(s) &&
          ['Text', 'TextInput'].includes(s.imported.name));
        if (!selected.length) return;
        path.node.specifiers = path.node.specifiers.filter(s => !selected.includes(s));
        path.insertAfter(t.importDeclaration(selected.map(s =>
          t.importSpecifier(s.local, t.identifier(s.imported.name === 'Text' ? 'CareSuiteText' : 'CareSuiteTextInput'))),
          t.stringLiteral('@/design/components/CareSuiteText')));
        if (!path.node.specifiers.length) path.remove();
      },
    },
  };
};
