/* ============================================================
   RANDOM PICKER — odds audit (slot machine + dice)

   Pure-Node replay of the outcome logic taken verbatim out of
   ../script.js (no copy of the rules lives here), run many times to
   check the odds the tool claims on screen.

   Slot machine:
     - about SLOT_WIN_CHANCE of pulls pay out
     - when a pull pays, every line is equally likely to win
     - a pull that does not pay NEVER shows three of a kind, so the
       payline always looks like a loss (duplicate lines included)
     - lists with fewer than two distinct labels always pay, because no
       losing payline could be told apart from a winning one

   Dice:
     - every face comes up 1/6 of the time, whatever the list length
     - face f picks choice f; faces past the end of the list pick nobody
     - so the no-win rate is exactly (6 - n) / 6

   Run: node odds.mjs
   ============================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'script.js'), 'utf8');

// Everything between shuffledIndices() and initSlotReels() is the payout
// logic: the constants, nameGroups(), pickFrom() and planSlotPull().
const START = 'function shuffledIndices(n)';
const END = 'function initSlotReels()';
const a = src.indexOf(START), b = src.indexOf(END, a);
if (a < 0 || b < 0) throw new Error('slot payout block not found in script.js — markers moved?');
const block = src.slice(a, b);

// `choices` is a module-level binding in script.js; give the block one it can read.
const slot = new Function(`
  let choices = [];
  ${block}
  return {
    pull(list) { choices = list; return planSlotPull(); },
    SLOT_WIN_CHANCE, SLOT_NEAR_MISS_SHARE, SLOT_LAST_REEL_ODD
  };`)();

const PULLS = 200000;
let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
}
const pct = x => (x * 100).toFixed(2) + '%';

function replay(list) {
  const stats = { wins: 0, nearMiss: 0, allDiff: 0, looksLikeWin: 0, oddOnLast: 0, outOfRange: 0, winCounts: new Array(list.length).fill(0) };
  for (let i = 0; i < PULLS; i++) {
    const plan = slot.pull(list);
    const idxs = plan.win ? [plan.index] : plan.combo;
    if (idxs.some(i => !Number.isInteger(i) || i < 0 || i >= list.length)) stats.outOfRange++;
    if (plan.win) { stats.wins++; stats.winCounts[plan.index]++; continue; }
    const names = plan.combo.map(i => list[i]);
    const distinct = new Set(names).size;
    if (distinct === 1) stats.looksLikeWin++;
    else if (distinct === 2) { stats.nearMiss++; if (names[0] === names[1]) stats.oddOnLast++; }
    else stats.allDiff++;
  }
  stats.losses = PULLS - stats.wins;
  return stats;
}

function audit(name, list, opts = {}) {
  console.log(`\n${name}  [${list.join(', ')}]`);
  const s = replay(list);
  const winRate = s.wins / PULLS;
  const distinctLabels = new Set(list).size;

  check('every index the planner returns is a real line', s.outOfRange === 0, `${s.outOfRange} out of range`);
  check('no losing pull shows three of a kind', s.looksLikeWin === 0, `${s.looksLikeWin} losses would read as a win`);

  if (opts.alwaysPays) {
    check('list with one distinct label always pays', s.wins === PULLS, `paid ${pct(winRate)}`);
  } else {
    check(`payout rate is ~${pct(slot.SLOT_WIN_CHANCE)}`, Math.abs(winRate - slot.SLOT_WIN_CHANCE) < 0.01, pct(winRate));
    const nearShare = s.nearMiss / s.losses;
    const expectNear = distinctLabels < 3 ? 1 : slot.SLOT_NEAR_MISS_SHARE;
    check(`two-of-a-kind near misses are ~${pct(expectNear)} of losses`, Math.abs(nearShare - expectNear) < 0.02, pct(nearShare));
    const lastShare = s.oddOnLast / s.nearMiss;
    check(`near misses break on the last reel ~${pct(slot.SLOT_LAST_REEL_ODD)} of the time`, Math.abs(lastShare - slot.SLOT_LAST_REEL_ODD) < 0.02, pct(lastShare));
    if (distinctLabels >= 3) check('some losses show three different symbols', s.allDiff > 0, `${s.allDiff} of ${s.losses}`);
  }

  // Winning line stays uniform: the payout roll must not bias who wins.
  const expected = s.wins / list.length;
  const worst = Math.max(...s.winCounts.map(c => Math.abs(c - expected) / expected));
  check('winner is uniform across lines', worst < 0.03, 'worst line off expectation by ' + pct(worst));
}

console.log(`SLOT MACHINE — ${PULLS.toLocaleString('en-US')} pulls per list, SLOT_WIN_CHANCE = ${slot.SLOT_WIN_CHANCE}`);
audit('Typical list', ['Pizza', 'Sushi', 'Tacos', 'Burgers', 'Salad']);
audit('Two choices', ['Yes', 'No']);
audit('Duplicate line', ['Ana', 'Ana', 'Bo']);
audit('Longer list', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
audit('One label only', ['Solo', 'Solo'], { alwaysPays: true });

// ── DICE ────────────────────────────────────────────────────────────────
// rollDice() is wrapped around three.js, so only its outcome lines are lifted:
// the face roll down to the three.js guard. `choices` and `n` are the two
// bindings that block reads from its scope.
const D_START = 'const face = 1 + Math.floor(Math.random() * 6)';
const D_END = 'if (!three)';
const da = src.indexOf(D_START), db = src.indexOf(D_END, da);
if (da < 0 || db < 0) throw new Error('dice outcome block not found in script.js — markers moved?');
const roll = new Function('choices', 'n', `
  ${src.slice(da, db)}
  return result;`);

function auditDice(list) {
  const n = Math.min(list.length, 6);
  console.log(`\nDice with ${n} choice(s)  [${list.join(', ')}]`);
  const faceCounts = new Array(7).fill(0);
  let noWin = 0, misMapped = 0;
  for (let i = 0; i < PULLS; i++) {
    const r = roll(list, n);
    const face = r.noWin ? r.face : r.index + 1;
    faceCounts[face]++;
    if (r.noWin) { noWin++; if (r.face <= n) misMapped++; }
    else if (r.name !== list[r.index] || r.index >= n) misMapped++;
  }
  const worstFace = Math.max(...faceCounts.slice(1).map(c => Math.abs(c - PULLS / 6) / (PULLS / 6)));
  check('every face comes up ~1 in 6', worstFace < 0.03, 'worst face off expectation by ' + pct(worstFace));
  check('face f picks choice f, and only faces past the list pick nobody', misMapped === 0, `${misMapped} bad rolls`);
  const expectNoWin = (6 - n) / 6;
  check(`no-win rate is ${pct(expectNoWin)}`, Math.abs(noWin / PULLS - expectNoWin) < 0.01, pct(noWin / PULLS));
}

console.log(`\n\nDICE — ${PULLS.toLocaleString('en-US')} rolls per list, an honest d6`);
auditDice(['Yes', 'No']);
auditDice(['A', 'B', 'C', 'D']);
auditDice(['A', 'B', 'C', 'D', 'E', 'F']);

console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' check(s) FAILED.'}`);
process.exit(failures === 0 ? 0 : 1);
