#!/usr/bin/env node
// ============================================================================
// PowerFactory Scripter — static MCP server
//
// Purpose (and only purpose): help an AI agent turn a user's plain-language
// study request into a valid PowerFactory Scripter *config JSON*, then hand it
// back with instructions to upload it into the web tool by clicking "↑ JSON".
//
// It is "static": no PowerFactory connection, no network calls, no code
// generation. It ships the schema, a curated field reference, worked sample
// configs, and a validator that mirrors the web tool — everything the agent's
// own model needs to assemble a config the tool will accept on import.
//
// Transport: stdio. Run with `node index.js` (or via npx once published).
// ============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { ENUMS, FIELD_DOCS, TOOL_URL, defaultConfig } from './src/schema.js';
import { referenceBundle, SAMPLE_INDEX } from './src/reference.js';
import { validate } from './src/validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = join(__dirname, 'data', 'samples');
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

// ── shared text ──────────────────────────────────────────────────────────────
function uploadInstructions(fileHint) {
  const where = fileHint ? `Saved to: ${fileHint}\n\n` : '';
  return `${where}NEXT STEP — hand this to the user, do not stop here:

1. Save the JSON above as a file, e.g. "powerfactory_config.json".
2. Open the PowerFactory Scripter: ${TOOL_URL}
3. Click the "↑ JSON" button in the top toolbar and select the saved file.
4. The tool fills every field from the config. The user reviews object names,
   the API path and output directory, then clicks "Generate Code".

The config only needs valid *shapes* — real PowerFactory object names, the API
path and the output directory are the user's to confirm in the tool after upload.`;
}

const WORKFLOW = `PowerFactory Scripter MCP — how to use these tools

Goal: produce ONE config JSON and tell the user to upload it via "↑ JSON" at
${TOOL_URL}. This server never runs PowerFactory and never writes Python; it only
helps you build a valid config and validates it.

Recommended flow:
1. get_schema        — learn the exact config shape, enums and per-field rules.
2. get_field_reference — pick problemType/studyType, and find object classes and
   result variables (e.g. ElmSym.pgini, ElmTerm.m:u, ElmLne c:loading).
3. get_sample        — optional: start from the closest worked example
   (list_samples shows all six).
4. Assemble the config from the user's request, in your own model.
5. validate_config   — fix every error (blocking) and review warnings.
6. create_template   — get the final, normalised JSON + upload instructions,
   then deliver it to the user.

Key rules to remember:
- Every input and output "name" must be a unique Python identifier.
- contingency mode: inputVariables MUST be [] and studyType MUST be steady_state.
- timeseries outputs require studyType dynamic_rms or dynamic_emt.
- optimisation: set optimisation.objectiveOutputName to one of your output names.
- Leave powerfactoryApiPath / username / outputDir as "" — the user fills them in.`;

// ── server ────────────────────────────────────────────────────────────────────
const server = new McpServer(
  { name: 'powerfactory-scripter', version: pkg.version },
  {
    instructions: WORKFLOW,
    capabilities: { tools: {}, resources: {}, prompts: {} },
  },
);

const text = (obj) => ({
  content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }],
});

function loadSample(name) {
  const clean = name.replace(/\.json$/i, '').replace(/[^a-z0-9-]/gi, '');
  const file = join(SAMPLES_DIR, `${clean}.json`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

// ── tools ─────────────────────────────────────────────────────────────────────
server.registerTool('get_schema', {
  title: 'Get config schema',
  description:
    'Return the full PowerFactory Scripter config schema: a blank valid config, the allowed enum values, and per-field documentation. Read this first to learn the exact shape the "↑ JSON" import expects.',
  inputSchema: {},
}, async () => text({
  toolUrl: TOOL_URL,
  workflow: 'get_schema -> get_field_reference -> (get_sample) -> build -> validate_config -> create_template',
  enums: ENUMS,
  blankConfig: defaultConfig(),
  fieldDocs: FIELD_DOCS,
}));

server.registerTool('get_field_reference', {
  title: 'Get field reference',
  description:
    'Return a curated cheat-sheet for filling fields correctly: problem types, study types, timeseries metrics, optimisation algorithms, common PowerFactory element classes with typical input/output variables, object-query syntax, and the recognised class lists. Use it to choose modes and pick object_query / variable values.',
  inputSchema: {},
}, async () => text(referenceBundle()));

server.registerTool('list_samples', {
  title: 'List sample configs',
  description:
    'List the built-in worked-example configs (one per study type / mode). Use get_sample to fetch one as a starting point.',
  inputSchema: {},
}, async () => text({ samples: SAMPLE_INDEX }));

server.registerTool('get_sample', {
  title: 'Get a sample config',
  description:
    'Return one worked-example config JSON by name (see list_samples). A good, valid starting point to adapt to the user\'s request.',
  inputSchema: {
    name: z.string().describe('Sample name, e.g. "sample-04-n1-line-contingency" (with or without .json).'),
  },
}, async ({ name }) => {
  try {
    return text({ name, config: loadSample(name) });
  } catch {
    return { isError: true, ...text(`Unknown sample "${name}". Call list_samples for valid names.`) };
  }
});

server.registerTool('validate_config', {
  title: 'Validate a config',
  description:
    'Validate a (possibly partial) config object against the same rules the web tool enforces. Returns the normalised config, blocking errors (must be empty to import cleanly), and non-blocking warnings. Call this before create_template.',
  inputSchema: {
    config: z.object({}).passthrough().describe('The config object you assembled (full or partial).'),
  },
}, async ({ config }) => {
  const { config: normalised, errors, warnings, ok } = validate(config);
  return text({ ok, errors, warnings, normalisedConfig: normalised });
});

server.registerTool('create_template', {
  title: 'Create the final template',
  description:
    'THE FINAL STEP. Validate + normalise the config and return the final config JSON string plus upload instructions for the user ("↑ JSON" at the tool). Optionally writes the JSON to output_path. If there are blocking errors it returns them instead — fix them and call again.',
  inputSchema: {
    config: z.object({}).passthrough().describe('The finished config object.'),
    output_path: z.string().optional().describe('Optional absolute/relative path to write the .json file to (e.g. "./powerfactory_config.json").'),
  },
}, async ({ config, output_path }) => {
  const { config: normalised, errors, warnings, ok } = validate(config);
  if (!ok) {
    return { isError: true, ...text({
      status: 'invalid',
      message: 'Config has blocking errors — fix these and call create_template again.',
      errors, warnings,
    }) };
  }
  const json = JSON.stringify(normalised, null, 2);
  let written = null;
  if (output_path) {
    try {
      const p = resolve(output_path);
      writeFileSync(p, json + '\n', 'utf8');
      written = p;
    } catch (e) {
      return { isError: true, ...text(`Could not write to "${output_path}": ${e.message}. The JSON is still valid — return it to the user to save manually.`) };
    }
  }
  return text({
    status: 'ready',
    warnings,
    configJson: json,
    instructions: uploadInstructions(written),
  });
});

// ── resources ───────────────────────────────────────────────────────────────
server.registerResource('guide', 'powerfactory-scripter://guide',
  { title: 'Workflow guide', description: 'How to use this MCP to build a config JSON.', mimeType: 'text/markdown' },
  async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: WORKFLOW }] }),
);

server.registerResource('schema', 'powerfactory-scripter://schema',
  { title: 'Config schema', description: 'Enums, blank config and field docs.', mimeType: 'application/json' },
  async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json',
    text: JSON.stringify({ enums: ENUMS, blankConfig: defaultConfig(), fieldDocs: FIELD_DOCS }, null, 2) }] }),
);

server.registerResource('samples', 'powerfactory-scripter://samples',
  { title: 'Sample configs', description: 'Index + full worked-example configs.', mimeType: 'application/json' },
  async (uri) => {
    const files = readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.json')).sort();
    const samples = files.map(f => ({ name: f.replace(/\.json$/, ''), config: JSON.parse(readFileSync(join(SAMPLES_DIR, f), 'utf8')) }));
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ index: SAMPLE_INDEX, samples }, null, 2) }] };
  },
);

// ── prompt ────────────────────────────────────────────────────────────────────
server.registerPrompt('create_powerfactory_study', {
  title: 'Create a PowerFactory study config',
  description: 'Guided prompt: turn a plain-language study request into a config JSON the user can upload via "↑ JSON".',
  argsSchema: { request: z.string().describe("The user's study description in their own words.") },
}, async ({ request }) => ({
  messages: [{
    role: 'user',
    content: { type: 'text', text:
`You are helping build a PowerFactory Scripter config JSON that the user will upload into ${TOOL_URL} by clicking "↑ JSON". You do not write Python and you do not connect to PowerFactory — you only produce the config.

Do this:
1. Call get_schema, then get_field_reference. Optionally get_sample for the closest example.
2. Translate the user's request below into a config object (choose problemType, studyType, inputVariables, outputVariables, and any mode-specific section).
3. Call validate_config and resolve every error.
4. Call create_template and give the user the final JSON plus the "↑ JSON" upload steps.

Leave powerfactoryApiPath, username and outputDir as "" — the user sets those in the tool. Use best-guess object names from the request; the user corrects them after upload.

User's request:
${request}` },
  }],
}));

// ── boot ────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe for logs; stdout is the JSON-RPC channel.
  console.error(`powerfactory-scripter MCP v${pkg.version} ready (stdio).`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
