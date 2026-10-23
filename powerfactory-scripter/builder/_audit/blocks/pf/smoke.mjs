import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const B = path.resolve(HERE, '..', '..', '..');
const imp = (r) => import(pathToFileURL(path.join(B, r)).href);
// Only the block files these tests use (not index.js), so another category's file being edited
// at the same time cannot stop them; the order is index.js's.
for (const f of ['start', 'flow', 'values', 'model', 'study', 'advanced']) await imp(`js/blocks/${f}.js`);
const { generate } = await imp('js/core/codegen.js');
const { RUNTIME_FILES } = await imp('js/core/runtime-loader.js');
const runtime = {};
for (const f of RUNTIME_FILES) { const p = path.join(B, 'runtime', f); if (fs.existsSync(p)) runtime[f] = fs.readFileSync(p, 'utf8'); }
const wf = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const r = generate(wf, { runtime });
console.log(r.problems.map(p => `[${p.level}] ${p.msg}`).join('\n'));
const code = r.code;
const a = code.indexOf('def main():'), b = code.indexOf('# ==== HELPERS');
console.log(code.slice(a, b));
if (process.argv[3]) fs.writeFileSync(process.argv[3], code);
