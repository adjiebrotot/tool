// Egg Price audit: replays the egg maths independently of eggmath.js's own
// integration and checks the pack arithmetic. Run: node eggprice/_audit/run.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
new Function(readFileSync(join(here, '..', 'eggmath.js'), 'utf8'))();
const M = globalThis.EggMath;
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); };
const close = (a, b, rel) => Math.abs(a - b) <= rel * Math.abs(b);

// 1. Volume of the unit egg by Simpson's rule on π·y², a different method
//    from the engine's frusta.
{
  const n = 200000, h = 1 / n; let s = 0;
  for (let i = 0; i <= n; i++) {
    const x = -0.5 + i * h, y = M.profile(x, 1);
    s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * y * y;
  }
  const V = Math.PI * s * h / 3;
  check('unit volume matches Simpson', close(M.UNIT.cV, V, 1e-5), `${M.UNIT.cV.toFixed(6)} vs ${V.toFixed(6)}`);
}
// 2. Surface area: the shape sits close to a prolate spheroid of the same
//    L and B, whose area has a closed form. The shift makes it a bit smaller.
{
  const a = 0.5, b = M.SHAPE.breadth / 2, e = Math.sqrt(1 - (b * b) / (a * a));
  const S = 2 * Math.PI * b * b * (1 + (a / (b * e)) * Math.asin(e));
  const V = 4 / 3 * Math.PI * a * b * b;
  check('unit area within 2% of spheroid', close(M.UNIT.cS, S, 0.02), `${M.UNIT.cS.toFixed(4)} vs ${S.toFixed(4)}`);
  check('unit volume within 2% of spheroid', close(M.UNIT.cV, V, 0.02), `${M.UNIT.cV.toFixed(4)} vs ${V.toFixed(4)}`);
}
// 3. Egg of 50 g: volume, dimensions and shell by hand.
{
  const e = M.egg(50);
  const V = 50 / M.RHO_EGG, L = Math.cbrt(V / M.UNIT.cV), S = M.UNIT.cS * L * L;
  const shell = S * M.T_SHELL * M.RHO_SHELL;
  check('50 g egg volume', close(e.V, V, 1e-12));
  check('50 g egg length', close(e.L, L, 1e-12), `${(e.L * 10).toFixed(1)} mm`);
  check('50 g egg shell', close(e.shell, shell, 1e-12), `${shell.toFixed(2)} g`);
  check('shell share in the real 9-12% range', e.shellShare > 0.09 && e.shellShare < 0.12, (e.shellShare * 100).toFixed(2) + '%');
  check('content + shell = whole egg', close(e.content + e.shell, 50, 1e-12));
}
// 4. Shell share scales as W^(-1/3): a bigger egg carries less shell per gram.
{
  const a = M.egg(40), b = M.egg(80);
  check('shell share ∝ W^(-1/3)', close(b.shellShare / a.shellShare, Math.pow(2, -1 / 3), 1e-9));
}
// 5. Default packs: the pack arithmetic.
const DEF = [['Medium', 12, 500, 4.9], ['Large', 12, 600, 6], ['Extra Large', 12, 700, 7.2], ['Jumbo', 12, 800, 8.05]];
for (const [n, eggs, grams, price] of DEF) {
  const p = M.pack({ eggs, grams, price });
  check(`${n}: gross $/g`, close(p.grossPerG, price / grams, 1e-12));
  check(`${n}: shell $ + egg $ = price`, close(p.shellCost + p.contentCost, price, 1e-12));
  check(`${n}: net $/g = price / egg grams`, close(p.netPerG, price / (grams - eggs * p.egg.shell), 1e-12),
    `$${p.netPerG.toFixed(5)}/g, shell $${p.shellCost.toFixed(2)}`);
}
// 6. Bad input is refused, not computed.
for (const r of [{ eggs: 0, grams: 600, price: 6 }, { eggs: 12, grams: -1, price: 6 }, { eggs: 12, grams: 600, price: NaN }, { eggs: 'x', grams: 600, price: 6 }])
  check(`rejects ${JSON.stringify(r)}`, M.pack(r) === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
