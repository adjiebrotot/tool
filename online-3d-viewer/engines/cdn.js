/* Where the libraries an engine needs are fetched from, pinned by version.
   three.js itself is mapped in index.html's import map ("three" and
   "three/addons/"); these are the extra files some engines load at run time
   (WebAssembly decoders, a CAD kernel). Each is downloaded only when a file of
   that format is opened, then kept by the browser and the service worker. */

export const THREE_VERSION = '0.186.1';
export const THREE_BASE = 'https://cdn.jsdelivr.net/npm/three@' + THREE_VERSION + '/';

// glTF: Draco geometry, KTX2 / Basis textures.
export const DRACO_PATH = THREE_BASE + 'examples/jsm/libs/draco/';
export const BASIS_PATH = THREE_BASE + 'examples/jsm/libs/basis/';

// STEP, IGES and BREP: OpenCascade compiled to WebAssembly (about 7.6 MB, 2 MB compressed).
export const OCCT_BASE = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/';

// Rhino 3DM: rhino3dm compiled to WebAssembly.
export const RHINO_BASE = 'https://cdn.jsdelivr.net/npm/rhino3dm@8.32.1/';
