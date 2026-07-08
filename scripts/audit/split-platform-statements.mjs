import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const file = process.argv[2] ?? '0246_platform_console_foundation_live.sql';
const maxChunk = Number(process.argv[3] ?? 12000);

/** Remove leading -- line comments and blank lines. */
function stripLeadingComments(text) {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('--');
    })
    .join('\n')
    .trim();
}

/** Split SQL on semicolons outside dollar-quoted blocks ($$ ... $$). */
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  let inDollar = false;

  while (i < sql.length) {
    if (!inDollar && sql[i] === '$' && sql[i + 1] === '$') {
      inDollar = true;
      current += '$$';
      i += 2;
      continue;
    }

    if (inDollar && sql[i] === '$' && sql[i + 1] === '$') {
      inDollar = false;
      current += '$$';
      i += 2;
      continue;
    }

    if (!inDollar && sql[i] === ';') {
      const trimmed = stripLeadingComments(current);
      if (trimmed) {
        statements.push(`${trimmed};`);
      }
      current = '';
      i += 1;
      while (i < sql.length && (sql[i] === '\n' || sql[i] === '\r' || sql[i] === ' ')) {
        i += 1;
      }
      continue;
    }

    current += sql[i];
    i += 1;
  }

  const tail = stripLeadingComments(current);
  if (tail) {
    statements.push(tail.endsWith(';') ? tail : `${tail};`);
  }

  return statements;
}

const sql = fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8');
const statements = splitSqlStatements(sql);

const batches = [];
let current = '';
for (const stmt of statements) {
  if (current.length + stmt.length + 1 > maxChunk && current.length > 0) {
    batches.push(current);
    current = stmt;
  } else {
    current = current ? `${current}\n${stmt}` : stmt;
  }
}
if (current) batches.push(current);

const outDir = path.join(root, 'scripts/audit/.platform-statement-batches');
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  fs.unlinkSync(path.join(outDir, f));
}
batches.forEach((batch, idx) => {
  fs.writeFileSync(
    path.join(outDir, `${file.replace('.sql', '')}-${String(idx + 1).padStart(2, '0')}.sql`),
    batch,
  );
});

console.log(JSON.stringify({ file, statements: statements.length, batches: batches.length, outDir }));
