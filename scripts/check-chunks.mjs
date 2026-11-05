// Fails the build when a chunk could wait on itself at start-up.
//
// With RUN's embedded libraries every chunk that uses React or three starts with a top-level
// await, and the SDK initialises with one too. A chunk with a top-level await that lazily
// imports a chunk which (directly or through others) imports it back never finishes: the
// game stays blank on RUN with no error (v1.29-v1.32, from experimentalMinChunkSize). The
// local preview and the bundled build don't show it, so this check reads dist/ instead.
//
//   node scripts/check-chunks.mjs [dist]

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseAst } from 'rollup/parseAst';

const dist = process.argv[2] ?? 'dist';
const dir = join(dist, 'assets');
if (!existsSync(dir)) {
  console.error(`check-chunks: no ${dir} (build first)`);
  process.exit(1);
}

const chunks = new Map();
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.js') || file.startsWith('_rundot_bootstrap')) continue;
  const ast = parseAst(readFileSync(join(dir, file), 'utf8'));
  const statics = new Set();
  const dynamics = new Set();
  let topAwait = false;
  const local = (spec) => (typeof spec === 'string' && spec.startsWith('./') ? basename(spec) : null);
  const walk = (node, inFunction) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'AwaitExpression' && !inFunction) topAwait = true;
    if (node.type === 'ImportExpression' && node.source?.type === 'Literal') {
      const d = local(node.source.value);
      if (d) dynamics.add(d);
    }
    const fn = inFunction || /Function/.test(node.type);
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (Array.isArray(value)) value.forEach((child) => walk(child, fn));
      else if (value && typeof value.type === 'string') walk(value, fn);
    }
  };
  for (const stmt of ast.body) {
    if (
      (stmt.type === 'ImportDeclaration' ||
        stmt.type === 'ExportNamedDeclaration' ||
        stmt.type === 'ExportAllDeclaration') &&
      stmt.source
    ) {
      const s = local(stmt.source.value);
      if (s) statics.add(s);
    }
    walk(stmt, false);
  }
  chunks.set(file, { statics, dynamics, topAwait });
}

/** Every chunk `from` loads before it runs (its static imports, all the way down). */
function staticClosure(from) {
  const seen = new Set();
  const stack = [from];
  while (stack.length) {
    const c = stack.pop();
    for (const d of chunks.get(c)?.statics ?? []) {
      if (!seen.has(d)) {
        seen.add(d);
        stack.push(d);
      }
    }
  }
  return seen;
}

const problems = [];
for (const [file, c] of chunks) {
  if (!c.topAwait) continue;
  for (const lazy of c.dynamics) {
    if (lazy === file || staticClosure(lazy).has(file))
      problems.push(`${file} awaits at the top level and lazily imports ${lazy}, which imports ${file} back`);
  }
}

if (problems.length) {
  console.error('check-chunks: a start-up deadlock on RUN (the game would stay blank):');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`check-chunks: ${chunks.size} chunks, no start-up deadlock`);
