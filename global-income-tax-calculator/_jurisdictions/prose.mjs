// Prints a content file's prose as plain Markdown, for the language checkers
// (the blog's bahasa-indonesia cek.py reads a post-shaped file):
//   node global-income-tax-calculator/_jurisdictions/prose.mjs <slug> <lang> > /path/out.md
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const [slug, lang] = process.argv.slice(2);
const c = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'content', `${slug}.${lang}.json`), 'utf8'));
const md = s => String(s || '').replace(/<a [^>]*>(.*?)<\/a>/g, '$1').replace(/<\/?(strong|b)>/g, '**').replace(/<\/?em>/g, '*').replace(/<li>/g, '\n- ').replace(/<\/p>\s*<p>/g, '\n\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
const out = ['---', `title: "${md(c.title)}"`, `description: "${md(c.description)}"`, '---', '', `# ${md(c.h1)}`, '', md(c.lede), ''];
const law = c.law || {};
out.push(md(law.intro), '');
for(const b of law.blocks || []){ out.push(`### ${md(b.h3)}`, '', md(b.html), ''); if(b.table) for(const r of b.table.rows) out.push('- ' + r.map(md).join(', ')); out.push(''); }
for(const e of c.examples || []) out.push(`### ${md(e.title)}`, '', md(e.intro), '', md(e.after), '');
out.push(md(c.strategyIntro), '');
for(const s of c.strategies || []) out.push(`### ${md(s.h3)}`, '', md(s.html), '');
for(const l of c.limits || []) out.push('- ' + md(l));
out.push('');
for(const f of c.faq || []) out.push(`### ${md(f.q)}`, '', md(f.a), '');
for(const [k, v] of Object.entries(c.lineLabels || {})) out.push('- ' + v);
console.log(out.join('\n').replace(/\n{3,}/g, '\n\n'));
