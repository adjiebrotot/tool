# Vendored libraries (canvas of the Workflow Builder)

Kept here, same origin, rather than loaded from a CDN: the site's headless checks serve every
off-site script as an empty file (React is not one of the globals they stub), scenario-check
blocks off-site requests outright, and an engineer's office network may block the CDNs. The files
are the unmodified published builds; replace them only together with a test run of the builder.

| File | Version | Source | SHA-256 |
|---|---|---|---|
| react.production.min.js | react 18.3.1 | https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js | d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd |
| react-dom.production.min.js | react-dom 18.3.1 | https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js | 35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d |
| xyflow-react.umd.js | @xyflow/react 12.12.0 | https://cdn.jsdelivr.net/npm/@xyflow/react@12.12.0/dist/umd/index.js | c418896c3d0cc63498e724df7ed9698532c58523c04d30ebcd3ff7fa0bf3ecff |
| xyflow-base.css | @xyflow/react 12.12.0 | https://cdn.jsdelivr.net/npm/@xyflow/react@12.12.0/dist/base.css | 4171d20d683eae89681eb1fe7c3bf52d8d326103b28078484d26e2f370d81778 |
| jsx-shim.js | (ours) | the 3-line `window.jsxRuntime` the xyflow build expects | |

Load order: react, react-dom, jsx-shim, xyflow-react. Licences: LICENSES.txt (all MIT, d3 parts ISC).
