// @xyflow/react's browser build reads its JSX runtime from globalThis.jsxRuntime, which React's
// own browser build does not provide. In the automatic runtime the call is jsx(type, props, key)
// with the children inside props, and React.createElement(type, props) keeps props.children as
// given and lifts key and ref out of the config, so this is all it needs. Load after React and
// ReactDOM, before xyflow-react.umd.js (which captures the global when it loads).
if (window.React) window.jsxRuntime = (function () {
  function jsx(t, p, k) { return React.createElement(t, k === undefined ? p : Object.assign({}, p, { key: k })); }
  return { jsx: jsx, jsxs: jsx, Fragment: React.Fragment };
})();
