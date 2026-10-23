// Attaching a data file to a block (Read table from file).
//
// Nothing leaves the reader's computer: the file is read with FileReader, decoded by
// core/tabledata.js in the page, and kept inside their own workflow (`wf.files`, base64) so a
// saved .json and the study package both carry it. A generated .py never does.
//
// The decoded structure (sheet names, column names, how many rows) goes into the block's `file`
// setting, which is small enough for the mini cache and for the .py's PFB1 line; it is what the
// page uses to offer the table's columns wherever a column name is typed.

import { bytesToBase64, base64ToBytes } from '../core/zip.js';
import { describeFile, isExcelName } from '../core/tabledata.js';

// Above this a file is still attached, but the mini cache is told to leave the files out, so a
// big workbook never pushes the reader's workflow out of their browser's storage.
export const CACHE_LIMIT = 1_500_000;
// A file larger than this is not attached at all: the reader keeps it next to the script and
// types its name, as before.
export const MAX_FILE = 8_000_000;

export const fileBytes = (f) => (f && typeof f.b64 === 'string' ? base64ToBytes(f.b64) : null);

// How big the attached files are together, as base64 (what the cache would have to hold).
export function attachedSize(wf) {
  let n = 0;
  for (const f of Object.values((wf && wf.files) || {})) if (f && typeof f.b64 === 'string') n += f.b64.length;
  return n;
}

export function readBytes(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('the browser could not read this file'));
    r.onload = () => resolve(new Uint8Array(r.result));
    r.readAsArrayBuffer(file);
  });
}

// What the decode depends on: a change to any of these re-reads the file.
export const decodeSig = (opts) => [opts.sheet || '', opts.layout || 'rows', String(opts.header || 1), opts.decimalComma ? '1' : '0'].join('|');

// Read `bytes` with `opts` and give the setting value for the `file` setting. `sig` records the
// options it was read with, so a later change to one of them reads the file again.
// Throws an Error whose message is a sentence ("… could not be read: <this>").
export async function describe(name, bytes, opts) {
  const d = await describeFile(name, bytes, opts);
  return {
    name: String(name), size: bytes.length,
    sheet: d.sheet || '', sheets: d.sheets || [],
    cols: d.columns, rows: d.count, sig: decodeSig(opts),
  };
}

export const toB64 = bytesToBase64;
export const looksExcel = isExcelName;

// A CSV template with the columns a reader is about to use and two rows of dummy values, so
// nobody has to attach real study data to try the block out.
export function templateCsv(cols) {
  const names = (Array.isArray(cols) && cols.length ? cols : ['Case', 'Generator', 'P (MW)', 'Q (Mvar)']).slice(0, 40);
  const cell = (nm, k) => {
    const n = String(nm).toLowerCase();
    if (/\b(mw|p\b|power)/.test(n)) return String(50 * (k + 1));
    if (/\b(mvar|q\b)/.test(n)) return String(10 * k);
    if (/\b(kv|voltage|u\b)/.test(n)) return k ? '1.02' : '1.00';
    if (/\b(%|loading|pct)/.test(n)) return String(60 + 10 * k);
    if (/(name|case|scenario|element|bus|line|gen)/.test(n)) return `Example ${k + 1}`;
    return String(k + 1);
  };
  const esc = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  const lines = [names.map(esc).join(',')];
  for (let k = 0; k < 2; k++) lines.push(names.map(nm => esc(cell(nm, k))).join(','));
  return lines.join('\r\n') + '\r\n';
}
