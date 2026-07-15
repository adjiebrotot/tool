// Smoke tests: core validation logic + a real MCP stdio round-trip.
// Run: npm test   (from powerfactory-scripter/mcp)
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

import { validate, normalizeConfig } from '../src/validate.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(__dirname, '..', 'data', 'samples');

let pass = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log(`  ✓ ${name}`);
  pass++;
}

// 1. Every shipped sample validates cleanly ----------------------------------
console.log('validation logic:');
for (const f of readdirSync(SAMPLES).filter(f => f.endsWith('.json'))) {
  const cfg = JSON.parse(readFileSync(join(SAMPLES, f), 'utf8'));
  const { errors } = validate(cfg);
  ok(`${f} has no blocking errors`, errors.length === 0);
}

// 2. Normalisation fills defaults + assigns output ids ------------------------
const partial = {
  initialisation: { problemType: 'brute_force', studyType: 'steady_state' },
  inputVariables: [{ name: 'p', object_query: 'G1.ElmSym', variable: 'pgini', lower: 1, upper: 3, step: 1 }],
  outputVariables: [{ type: 'attribute', name: 'v', object_query: 'Bus.ElmTerm', variable: 'm:u' }],
};
const norm = normalizeConfig(partial);
ok('output id auto-assigned', norm.outputVariables[0].id === 'ov-0');
ok('numeric range coerced to string', norm.inputVariables[0].lower === '1');
ok('int dtype inferred', norm.inputVariables[0].dtype === 'int');
ok('additionalConfig defaults present', norm.additionalConfig.useProgressBar === true);
ok('partial config validates', validate(partial).ok === true);

// 3. Rule violations are caught ----------------------------------------------
const badContin = validate({
  initialisation: { problemType: 'contingency', studyType: 'dynamic_rms' },
  inputVariables: [{ name: 'x', object_query: 'G.ElmSym', variable: 'pgini' }],
  outputVariables: [{ type: 'attribute', name: 'v', object_query: 'B.ElmTerm', variable: 'm:u' }],
  contingencyMode: { elementTypes: [{ query: '' }] },
});
ok('contingency w/ inputs+dynamic+no-query is rejected', badContin.errors.length >= 3);

const badOpt = validate({
  initialisation: { problemType: 'optimisation', studyType: 'steady_state' },
  inputVariables: [{ name: 'p', object_query: 'G.ElmSym', variable: 'pgini' }],
  outputVariables: [{ type: 'attribute', name: 'loss', object_query: 'B.ElmTerm', variable: 'm:u' }],
  optimisation: { sense: 'minimise', objectiveOutputName: 'nope', algorithm: 'scipy_lbfgsb' },
});
ok('optimisation w/ bad objective name is rejected', badOpt.errors.some(e => /Objective output/.test(e)));

const dupNames = validate({
  initialisation: { problemType: 'brute_force', studyType: 'steady_state' },
  inputVariables: [{ name: 'x', object_query: 'G.ElmSym', variable: 'pgini' }],
  outputVariables: [{ type: 'attribute', name: 'x', object_query: 'B.ElmTerm', variable: 'm:u' }],
});
ok('input/output name collision is rejected', dupNames.errors.some(e => /both an input/.test(e)));

// 4. Real MCP round-trip over stdio ------------------------------------------
console.log('mcp round-trip:');
const client = new Client({ name: 'smoke', version: '1.0.0' });
const transport = new StdioClientTransport({ command: 'node', args: [join(__dirname, '..', 'index.js')] });
await client.connect(transport);

const tools = (await client.listTools()).tools.map(t => t.name).sort();
ok('all six tools registered', ['create_template', 'get_field_reference', 'get_sample', 'get_schema', 'list_samples', 'validate_config'].every(t => tools.includes(t)));

const schemaRes = await client.callTool({ name: 'get_schema', arguments: {} });
ok('get_schema returns enums', JSON.parse(schemaRes.content[0].text).enums.problemType.length === 4);

const created = await client.callTool({ name: 'create_template', arguments: { config: partial } });
const payload = JSON.parse(created.content[0].text);
ok('create_template returns ready status', payload.status === 'ready');
ok('create_template embeds upload instructions', /↑ JSON/.test(payload.instructions));
ok('create_template returns valid JSON', JSON.parse(payload.configJson).outputVariables[0].id === 'ov-0');

const badCreate = await client.callTool({ name: 'create_template', arguments: { config: { initialisation: { problemType: 'brute_force', studyType: 'steady_state' }, inputVariables: [], outputVariables: [] } } });
ok('create_template flags invalid config as error', badCreate.isError === true);

const resources = (await client.listResources()).resources.map(r => r.uri).sort();
ok('resources registered', resources.includes('powerfactory-scripter://schema'));

const prompts = (await client.listPrompts()).prompts.map(p => p.name);
ok('prompt registered', prompts.includes('create_powerfactory_study'));

await client.close();

console.log(`\n${pass} checks passed.`);
