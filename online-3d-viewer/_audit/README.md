# Online 3D Viewer: audit

```
node run.mjs            # every format and variant (fixtures) + the page itself
node run.mjs --real     # also real-world models, against independent readers
ONLY=step node run.mjs  # only the cases whose name contains "step"
```

The harness drives the real page in headless Chromium (WebGL through
SwiftShader). The page's CDN libraries (three.js, OpenCascade, rhino3dm) are
served from pinned local copies of the same versions (`serve.mjs` installs
them once into a cache folder outside the repo), so a run tests exactly what
the page pins and works offline after the first run.

## 1. Fixtures (`fixtures/`, written by `make-fixtures.mjs`)

Every format gets the same known shape, written byte by byte from the format's
own specification rather than by the library the viewer reads it with: a box
30 × 20 × 10 along the file's X, Y and Z, with 8 corners and 12 triangles. So
what the viewer must report is known exactly, and each case checks it:
format, up axis, unit, triangles, distinct vertices, parts, size, materials,
textures that really decoded, vertex colours, animations, warnings, and that
the model puts pixels on the screen (a render of the empty stage against a
render with the model).

| Format | Variants covered |
| --- | --- |
| STL | ASCII, ASCII with CRLF, binary whose header starts with "solid", binary colour (VisCAM), two solids, zero normals, cut short (warns, shows what is there), trailing bytes, upper-case name |
| OBJ | MTL + texture in a sub-folder, MTL missing (warns), texture missing (warns), negative indices + vertex colours + CRLF, faces + lines + points in one object |
| PLY | ASCII, binary little-endian, binary big-endian (all with vertex colours), point cloud, a PLY with no extension |
| OFF | OFF, counts on the header line with face colours, COFF vertex colours, cut short (refused) |
| 3MF | millimetre, inch, not a zip (refused) |
| AMF | plain XML, zipped in inches (converted to mm) |
| glTF | embedded buffer, separate .bin + texture with a space in its name, .bin missing (refused, names the file), texture missing (warns), GLB with its texture inside, GLB named .stl (opened as glTF, warns), GLB cut short (refused), KTX2 texture, animation, Draco, Meshopt, glTF 1.0 (refused), broken JSON (refused) |
| FBX | 7.4 ASCII, 7.4 binary (unit from UnitScaleFactor), FBX 6.1 (refused, says why) |
| COLLADA | millimetres + Z up (read in metres, Y up), not COLLADA (refused) |
| 3DS | box with a material, cut short (ends in a clear state) |
| VRML | box beside a Background sky (the sky does not set the size), VRML 1.0 (refused) |
| USD | USDA and USDZ, Z up in millimetres (read in metres, Y up) |
| STEP | AP214 B-rep box with a colour (colour, unit and exact triangles checked), STEP-XML (refused), garbage (refused) |
| IGES | six B-spline surfaces, not IGES (refused) |
| Rhino 3DM | mesh + line + point in millimetres (written with rhino3dm), not 3DM (refused) |
| Zip | an OBJ with its MTL and texture in a folder inside a .zip, with macOS junk entries |
| Other | empty file, random bytes, a text file, an MTL alone, two models at once, a model beside a stray file, a 179,000-triangle STL (opens in seconds) |

## 2. The page

The drop screen first; a bad file explained on it; the workspace and info
card; the Up switch (a Z-up box stands 10 tall, flipped to Y up 20 tall) and
the model sitting centred on the grid; Edges (exactly the box's 12 edges),
Wireframe and Grid; a drag turns the view and ⟳ puts it back exactly; ⬇ PNG
(a PNG named after the model, at twice the screen's pixels); the night theme
repainting the stage; a real drop of OBJ + MTL + PNG; a folder (paths like
`textures/x.png`); a bad file over an open model (the model stays, a note
explains, ✕ closes it); the ruler (a distance and two areas, each click 5 px
off a corner so snapping must land it exactly: 30 with ΔX 30, the top face 600
with perimeter 100 closed by Enter, the front face 300 closed on its first
corner; a drag places nothing; Up flipped keeps them; Undo, Esc, the bin; a new
model starts empty); the display switches remembered after a reload; the
sample model and its animation, paused by ❚❚; and a phone width with no
sideways scroll.

The last run: 407 checks passed, 0 failed.

## 3. Real-world models (`--real`)

three.js's own sample models (pinned to the r186 tag) and the CAx-IF /
OpenCascade test parts shipped in the occt-import-js package: STL, OBJ with
textures, PLY, 3MF, AMF, glTF (Draco, KTX2, Meshopt, skins, morphs,
animation), FBX, COLLADA, 3DS, VRML, USDZ, 3DM, STEP assemblies, IGES and
BREP. Companion files (a glTF's .bin and images, an OBJ's MTL and maps,
COLLADA images) are found by reading the main file. These have no hand-written
answer, so each is compared with a reader that shares no code with the
viewer's engine:

- **Assimp** (assimpjs) for the mesh and scene formats: the viewer's triangle
  count must equal Assimp's, mesh by mesh use.
- **The counts a glTF file states** (each triangle primitive's index count,
  once per node that places it), which hold for Draco, Meshopt and KTX2 files
  that Assimp cannot open.
- **OpenCascade run directly in Node** for STEP, IGES and BREP, with the same
  settings: the viewer's triangle count must equal it, which checks the
  worker, the transfer and the build of the three.js meshes. Unit conversion
  is checked on cubes saved in inches and metres (both read 1000 mm), and an
  AP214 assembly whose parts live in other .stp files is refused by name.

The last run: 103 checks passed, 0 failed. Assimp could not read 7 of the
files (truck.3mf, rook.amf, three Draco / KTX2 glTFs, facecap.glb and
abb_irb52_7_120.dae); the glTFs among them are covered by their own counts.
