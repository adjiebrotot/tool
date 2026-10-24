// The study package: what the Download button hands back.
//
// A workflow is not only its script. A case table the reader attached is part of the study, and
// so is the workflow itself, which Open reads back. The package is one .zip holding all three,
// laid out so it runs as it is:
//
//   <name>.py          the script
//   <name>.json        the workflow, to open again in the Builder
//   <data files>       every attached file, beside the script, under the name the script reads
//   README.txt         how to run it, and what is in it
//
// The data files sit in the root rather than in a folder because read_table looks for a plain
// name next to the script: unzip anywhere and the script finds its table.

import { makeZip, base64ToBytes, hasDeflate } from '../core/zip.js';
import { serialize } from '../core/workflow.js';
import { fileNameFor } from '../core/codegen.js';
import { filesOf } from './ops.js';

export const zipNameFor = (wf) => fileNameFor(wf).replace(/\.py$/, '') + '.zip';

// The attached files of a workflow, under names that do not collide: [{ name, bytes, nodeId }].
export function packagedFiles(wf) {
  const out = [], used = new Set();
  for (const [nodeId, f] of Object.entries(filesOf(wf))) {
    let name = String(f.name || 'data.csv').split(/[\\/]/).pop() || 'data.csv';
    if (used.has(name.toLowerCase())) {
      const dot = name.lastIndexOf('.');
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '';
      let k = 2;
      while (used.has((stem + ' (' + k + ')' + ext).toLowerCase())) k++;
      name = stem + ' (' + k + ')' + ext;
    }
    used.add(name.toLowerCase());
    out.push({ name, bytes: base64ToBytes(f.b64), nodeId });
  }
  return out;
}

function readme(wf, pyName, jsonName, data, problems) {
  const L = [];
  L.push(`${wf.name || 'PowerFactory workflow'} - study package`);
  L.push('='.repeat(Math.min(72, (wf.name || 'PowerFactory workflow').length + 16)));
  L.push('');
  L.push('Made with the PowerFactory Workflow Builder:');
  L.push('  https://tool.adjiebrotots.com/powerfactory-scripter/builder/');
  L.push('');
  L.push('What is in here');
  L.push('---------------');
  L.push(`  ${pyName}  the script: run it with the Python that comes with PowerFactory`);
  L.push(`  ${jsonName}  the workflow itself: open it again with the Builder's Open button`);
  for (const d of data) L.push(`  ${d.name}  a data file the script reads`);
  L.push('  README.txt  this file');
  L.push('');
  L.push('How to run it');
  L.push('-------------');
  L.push('  1. Unpack this folder somewhere. Keep the files together: the script looks for its');
  L.push('     data files next to itself.');
  L.push('  2. Close the PowerFactory window (the script starts its own engine), or run the');
  L.push('     script from inside PowerFactory instead.');
  L.push('  3. From this folder:');
  L.push('');
  L.push(`         "C:\\Program Files\\DIgSILENT\\PowerFactory 2024\\Python\\3.12\\python.exe" "${pyName}"`);
  L.push('');
  L.push('     (or any Python 3.12 that can import the powerfactory module).');
  L.push('  4. The run writes its results, graphs and log into a folder it makes beside itself.');
  L.push('');
  L.push('Settings');
  L.push('--------');
  L.push('  The SETTINGS block at the top of the script holds the values marked with a pin in');
  L.push('  the Builder. Change them there and run again; everything else is written from the');
  L.push('  workflow. Open the .json (or the .py itself) in the Builder to change the workflow.');
  if (problems && problems.length) {
    L.push('');
    L.push('Before it will run');
    L.push('------------------');
    L.push('  The Builder found things to fix, so the script stops before it connects to');
    L.push('  PowerFactory. Open the workflow in the Builder and look at Problems:');
    for (const p of problems.slice(0, 12)) L.push('    - ' + p.msg);
    if (problems.length > 12) L.push(`    - ... and ${problems.length - 12} more`);
  }
  L.push('');
  return L.join('\r\n');
}

// Build the package. gen = the generator's result (code + problems), wf = the workflow with its
// view. Returns { blob, name, files: [names], note } — `note` is what to tell the reader.
export async function buildPackage(wf, gen, blocking) {
  const pyName = fileNameFor(wf);
  const jsonName = pyName.replace(/\.py$/, '') + '.json';
  const data = packagedFiles(wf);
  const obj = serialize(wf);
  const entries = [
    { name: pyName, text: gen.code },
    { name: jsonName, text: JSON.stringify(obj, null, 2) + '\n' },
    ...data.map(d => ({ name: d.name, bytes: d.bytes })),
    { name: 'README.txt', text: readme(wf, pyName, jsonName, data, blocking) },
  ];
  const blob = await makeZip(entries);
  return {
    blob, name: zipNameFor(wf), files: entries.map(e => e.name),
    note: data.length
      ? `Downloaded ${zipNameFor(wf)}: the script, the workflow and ${data.length === 1 ? 'the data file' : data.length + ' data files'}.`
      : `Downloaded ${zipNameFor(wf)}: the script and the workflow.`,
    packed: hasDeflate,
  };
}
