// Reading a case table (CSV or Excel) in the reader's own browser, so the page knows the
// columns a "Read table from file" block will give the run.
//
// Nothing here uploads anything: the file the reader attaches is read with FileReader, parsed
// here, and travels only inside their own workflow (the saved .json and the study package).
//
// The rules below are the same ones runtime/base.py read_table follows, so the column names the
// page offers are the names the script writes: the header row names the columns, a repeated name
// becomes "Name (2)", a row with no value at all is left out, an unnamed column with no value is
// dropped, and "columns" layout turns the grid on its side first. Numbers become numbers (with
// decimal_comma, "1,5" is 1.5); everything else stays text.
//
// Plain ES module, no DOM (the File -> bytes step is the caller's).

import { readZip } from './zip.js';

const dec = new TextDecoder('utf-8');

// ---------------------------------------------------------------------------------------------
// Values

// "" -> null, a number -> Number, anything else -> the text as it is.
export function cellValue(v, decimalComma) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v).trim();
  if (!t) return null;
  let n = t.replace(/[\s ]/g, '');
  if (decimalComma) n = n.replace(/\./g, '').replace(',', '.');
  if (/^[+-]?0\d+$/.test(n)) return t;      // a code such as 007 stays text
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(n)) return Number(n);
  return t;
}

// ---------------------------------------------------------------------------------------------
// CSV

// The separator a CSV uses: the one of , ; and tab that appears most often outside quotes on the
// first non-empty line (Excel in a decimal-comma locale writes ";").
export function guessSeparator(text) {
  const line = String(text).split(/\r\n|\n|\r/).find(l => l.trim()) || '';
  let best = ',', bestN = 0;
  for (const sep of [',', ';', '\t', '|']) {
    let n = 0, q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') q = !q;
      else if (!q && c === sep) n++;
    }
    if (n > bestN) { best = sep; bestN = n; }
  }
  return best;
}

// A CSV (or TSV) as a grid of raw cell texts. Quotes follow RFC 4180 ("" inside a quoted cell).
export function parseCsvGrid(text, sep) {
  const src = String(text).replace(/^﻿/, '');
  const s = sep || guessSeparator(src);
  const grid = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { q = true; continue; }
    if (c === s) { row.push(cell); cell = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); grid.push(row); row = []; cell = '';
      continue;
    }
    cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); grid.push(row); }
  return grid;
}

// ---------------------------------------------------------------------------------------------
// Excel (.xlsx / .xlsm): the parts of the format a case table uses

const unescapeXml = (s) => String(s).replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// The text of an <si> or <is> element: every <t> in it, joined (rich text is several runs).
function textOf(xml) {
  let out = '';
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(xml))) out += unescapeXml(m[1] === undefined ? '' : m[1]);
  return out;
}

function sharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1] === undefined ? '' : textOf(m[1]));
  return out;
}

// "C" -> 3 (1-based), from a cell reference such as "BC12".
export function colNumber(ref) {
  let n = 0;
  for (const ch of String(ref)) {
    const c = ch.toUpperCase().charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n;
}

// The sheets of a workbook, in the order Excel shows them: [{ name, path }].
function sheetsOf(files) {
  const wb = files.get('xl/workbook.xml');
  if (!wb) throw new Error('this file is not an Excel workbook (no xl/workbook.xml in it)');
  const wbXml = dec.decode(wb);
  const relsRaw = files.get('xl/_rels/workbook.xml.rels');
  const rels = new Map();
  if (relsRaw) {
    const re = /<Relationship\b[^>]*>/g;
    let m;
    while ((m = re.exec(dec.decode(relsRaw)))) {
      const id = (/\bId="([^"]*)"/.exec(m[0]) || [])[1];
      let target = (/\bTarget="([^"]*)"/.exec(m[0]) || [])[1];
      if (!id || !target) continue;
      target = unescapeXml(target).replace(/^\/?xl\//, '').replace(/^\//, '');
      rels.set(id, 'xl/' + target);
    }
  }
  const out = [];
  const re = /<sheet\b[^>]*\/?>/g;
  let m, k = 0;
  while ((m = re.exec(wbXml))) {
    k++;
    const name = unescapeXml((/\bname="([^"]*)"/.exec(m[0]) || [])[1] || `Sheet${k}`);
    const rid = (/\br:id="([^"]*)"/.exec(m[0]) || /\bid="([^"]*)"/.exec(m[0]) || [])[1];
    const path = (rid && rels.get(rid)) || `xl/worksheets/sheet${k}.xml`;
    out.push({ name, path: files.has(path) ? path : `xl/worksheets/sheet${k}.xml` });
  }
  return out;
}

// One worksheet as a grid of values (numbers stay numbers, text stays text, empty cells null).
function gridOf(xml, strings) {
  const grid = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const rowAt = Number((/\br="(\d+)"/.exec(rm[0]) || [])[1] || 0);
    const body = rm[1] === undefined ? '' : rm[1];
    const row = [];
    const cellRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(body))) {
      const attrs = cm[1] || '';
      const inner = cm[2] === undefined ? '' : cm[2];
      const ref = (/\br="([A-Za-z]+)\d*"/.exec(attrs) || [])[1];
      const at = ref ? colNumber(ref) : row.length + 1;
      const type = (/\bt="([^"]*)"/.exec(attrs) || [])[1] || 'n';
      let v = null;
      if (type === 'inlineStr') v = textOf(inner);
      else {
        const vm = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
        const raw = vm ? unescapeXml(vm[1]) : '';
        if (type === 's') v = strings[Number(raw)] === undefined ? '' : strings[Number(raw)];
        else if (type === 'str' || type === 'e') v = raw;
        else if (type === 'b') v = raw === '1' ? 'TRUE' : 'FALSE';
        else if (raw === '') v = null;
        else { const n = Number(raw); v = Number.isFinite(n) ? n : raw; }
      }
      while (row.length < at - 1) row.push(null);
      row[at - 1] = v;
    }
    if (rowAt > 0) { while (grid.length < rowAt - 1) grid.push([]); grid[rowAt - 1] = row; }
    else grid.push(row);
  }
  return grid;
}

// Every sheet name of an .xlsx, and one sheet as a grid.
// Returns { sheets: [names], grid, sheet } — `sheet` is the one that was read.
export async function parseXlsx(bytes, wanted) {
  const files = await readZip(bytes);
  const sheets = sheetsOf(files);
  if (!sheets.length) throw new Error('this workbook has no sheets');
  const want = String(wanted || '').trim();
  const pick = (want && sheets.find(s => s.name === want))
    || (want && sheets.find(s => s.name.toLowerCase() === want.toLowerCase()))
    || sheets[0];
  if (want && pick.name.toLowerCase() !== want.toLowerCase()) {
    throw new Error(`this workbook has no sheet called "${want}" (it has ${sheets.map(s => '"' + s.name + '"').join(', ')})`);
  }
  const raw = files.get(pick.path);
  if (!raw) throw new Error(`the sheet "${pick.name}" is not in this file`);
  const ss = files.get('xl/sharedStrings.xml');
  const grid = gridOf(dec.decode(raw), sharedStrings(ss ? dec.decode(ss) : ''));
  return { sheets: sheets.map(s => s.name), grid, sheet: pick.name };
}

// ---------------------------------------------------------------------------------------------
// Grid -> table (the same shaping as read_table)

// opts: { layout: 'rows' | 'columns', header: 1-based, decimalComma }.
// Returns { columns: [names], rows: [{ name: value }], count }.
export function tableFromGrid(grid0, opts = {}) {
  let grid = (grid0 || []).map(r => (Array.isArray(r) ? r : []));
  if (String(opts.layout || 'rows') === 'columns') {
    const width = grid.reduce((n, r) => Math.max(n, r.length), 0);
    grid = Array.from({ length: width }, (_, k) => grid.map(r => (k < r.length ? r[k] : null)));
  }
  const h = Math.max(1, Math.round(Number(opts.header) || 1));
  if (grid.length < h) throw new Error(`there is no ${opts.layout === 'columns' ? 'column' : 'row'} ${h} with the names in this file`);
  const names = [], seen = new Map();
  (grid[h - 1] || []).forEach((v, k) => {
    let nm = v === null || v === undefined ? '' : String(v).trim();
    nm = nm || `Column ${k + 1}`;
    const c = seen.get(nm) || 0;
    seen.set(nm, c + 1);
    names.push(c ? `${nm} (${c + 1})` : nm);
  });
  const rows = [];
  for (const raw of grid.slice(h)) {
    const vals = raw.map(v => cellValue(v, !!opts.decimalComma));
    if (vals.every(v => v === null)) continue;
    for (let k = names.length; k < vals.length; k++) names.push(`Column ${k + 1}`);
    const row = {};
    names.forEach((nm, k) => { row[nm] = k < vals.length ? vals[k] : null; });
    rows.push(row);
  }
  const keep = names.filter(nm => !/^Column \d+$/.test(nm) || rows.some(r => r[nm] !== null && r[nm] !== undefined));
  return { columns: keep, rows: rows.map(r => Object.fromEntries(keep.map(nm => [nm, r[nm] === undefined ? null : r[nm]]))), count: rows.length };
}

// ---------------------------------------------------------------------------------------------
// The one call the page makes

export const isExcelName = (name) => /\.xls[xm]$/i.test(String(name || ''));
export const isOldExcelName = (name) => /\.xls$/i.test(String(name || ''));

// Read an attached file into { sheets, columns, rows, count, sheet }. `bytes` is a Uint8Array.
// Throws an Error whose message is already a sentence for the reader.
export async function describeFile(name, bytes, opts = {}) {
  if (isOldExcelName(name)) throw new Error('this is an old .xls file. Save it as .xlsx (or .csv) in Excel and attach that.');
  let grid, sheets = [], sheet = '';
  if (isExcelName(name)) {
    const r = await parseXlsx(bytes, opts.sheet);
    grid = r.grid; sheets = r.sheets; sheet = r.sheet;
  } else {
    grid = parseCsvGrid(dec.decode(bytes));
  }
  const t = tableFromGrid(grid, opts);
  return { sheets, sheet, columns: t.columns, rows: t.rows, count: t.count };
}
