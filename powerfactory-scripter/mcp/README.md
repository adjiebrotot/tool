# PowerFactory Scripter — MCP Server

A **static** [Model Context Protocol](https://modelcontextprotocol.io) server whose
**only purpose** is to help an AI agent turn a user's plain-language study request
into a valid **PowerFactory Scripter config JSON**, and then hand it back with
instructions to upload it into the web tool by clicking **↑ JSON**.

- **Tool:** https://tool.adjiebrotots.com/powerfactory-scripter
- **Transport:** stdio
- **"Static"** = no PowerFactory connection, no network calls, no Python
  generation. It ships the schema, a curated field reference, six worked sample
  configs, and a validator that mirrors the web tool — everything the agent's own
  model needs to assemble a config the tool accepts on import.

The deliverable is **always the same**: produce the config JSON, then guide the
user to upload it via **↑ JSON**. The tool does the actual Python generation once
the config is imported.

---

## What it exposes

### Tools

| Tool | Purpose |
|---|---|
| `get_schema` | Full config shape: blank valid config, enum values, per-field docs. **Read first.** |
| `get_field_reference` | Cheat-sheet: problem/study types, metrics, algorithms, common element classes with typical `object_query` / `variable` values, object-query syntax. |
| `list_samples` | Lists the six built-in worked examples (one per mode/study type). |
| `get_sample` | Returns one sample config as a starting point. |
| `validate_config` | Validates a (partial) config with the same rules as the web tool. Returns normalised config + blocking errors + warnings. |
| `create_template` | **Final step.** Validates + normalises, returns the final JSON string + **↑ JSON** upload instructions. Optionally writes the file to `output_path`. |

### Resources

- `powerfactory-scripter://guide` — the workflow, as markdown.
- `powerfactory-scripter://schema` — enums + blank config + field docs.
- `powerfactory-scripter://samples` — index + all six sample configs.

### Prompts

- `create_powerfactory_study` — a guided prompt that takes the user's request and
  walks the model through schema → reference → build → validate → template.

---

## Recommended agent flow

```
get_schema
  → get_field_reference
    → (get_sample — optional, start from the closest example)
      → assemble the config in your model
        → validate_config   (fix every error; review warnings)
          → create_template (returns final JSON + "↑ JSON" upload steps)
```

Key rules the validator enforces:

- Every input/output **name** is a unique Python identifier.
- **contingency** mode: `inputVariables` must be `[]` and `studyType` must be `steady_state`.
- **timeseries** outputs require `studyType` `dynamic_rms` or `dynamic_emt`.
- **optimisation**: `optimisation.objectiveOutputName` must match one output name.
- Leave `powerfactoryApiPath` / `username` / `outputDir` as `""` — the user fills
  them in the tool after upload.

---

## Install & run

```bash
cd powerfactory-scripter/mcp
npm install
npm start        # runs the stdio server
npm test         # validation logic + a real MCP round-trip (22 checks)
```

Requires Node.js ≥ 18.

## Register with an MCP client

Point any MCP-capable client (Claude Desktop, Cursor, Claude Code, etc.) at the
server. Example config block:

```json
{
  "mcpServers": {
    "powerfactory-scripter": {
      "command": "node",
      "args": ["/absolute/path/to/powerfactory-scripter/mcp/index.js"]
    }
  }
}
```

For Claude Code:

```bash
claude mcp add powerfactory-scripter -- node /absolute/path/to/powerfactory-scripter/mcp/index.js
```

---

## Config shape (summary)

The config object matches exactly what the web tool imports on **↑ JSON**. Call
`get_schema` for the authoritative version; the top-level keys are:

```
initialisation   { powerfactoryApiPath, username, outputDir,
                   problemType, studyType, codingStyle, tstop }
inputVariables   [ { name, object_query, variable, lower, upper, step, dtype } ]
outputVariables  [ { id, type, name, object_query, variable, metric,
                     threshold, settle_*, customFn, output_graph, output_raw_csv } ]
optimisation     { sense, objectiveOutputName, algorithm, maxIterations, constraints }
customMode       { scenarioFilePath }
contingencyMode  { elementTypes[], contingencyN, combineTypes }
additionalConfig { iterateStudyCases, iterateOperatingScenarios, useProgressBar,
                   openPowerFactoryWindow, saveIntermediateEnabled, saveIntermediateMinutes }
```

## Files

```
mcp/
├── index.js                 stdio MCP server (tools, resources, prompt)
├── package.json
├── src/
│   ├── schema.js            config shape, enums, defaults, field docs
│   ├── reference.js         curated field reference + sample index
│   └── validate.js          normalisation + validation (mirrors the web tool)
├── data/samples/            the six worked-example configs
└── test/smoke.test.js       validation + MCP round-trip tests
```

## Keeping in sync

The schema and validation mirror `powerfactory-scripter/script.js`
(`readConfig` / `loadConfig` / `validateConfig` / `getLiveWarnings`). If that config
schema changes, update `src/schema.js` and `src/validate.js` to match, and refresh
`data/samples/` from `../samples/json-samples/`.

## Licence

MIT.
