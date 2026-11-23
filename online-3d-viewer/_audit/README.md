# Online 3D Viewer: audit

```
node run.mjs            # every format and variant (fixtures) + the page itself
node run.mjs --real     # also real-world models, against independent readers
ONLY=step node run.mjs  # only the cases whose name contains "step"
```

The harness drives the real page in headless Chromium (WebGL through
SwiftShader). The page's CDN libraries (three.js, OpenCascade, rhino3dm, cadkit, web-ifc) are
served from pinned local copies of the same versions (`serve.mjs` installs
them once into a cache folder outside the repo), so a run tests exactly what
the page pins and works offline after the first run.

## 1. Fixtures (`fixtures/`, written by `make-fixtures.mjs`; DGN by `make-dgn.mjs`; IFC by `make-ifc.mjs`)

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
| STEP | AP214 B-rep box with a colour (colour, unit and exact triangles checked), one part's two solids on two layers in two colours (the Levels list: names, one with an accented letter written as `\X2\`, part counts and colours), STEP-XML (refused), garbage (refused) |
| IGES | six B-spline surfaces, not IGES (refused) |
| Rhino 3DM | mesh + line + point in millimetres (written with rhino3dm), not 3DM (refused) |
| DGN | MicroStation V7, written byte by byte by `make-dgn.mjs` and read back by GDAL's own DGN driver as a cross-check: a 3D box of 12 lines plus a circle in millimetres (the file's colour table, its levels 5 and 7 in the Levels list, a text label noted, a deleted line ignored), a 2D plan in metres with a moved global origin (a shape, an arc, a cell holding a line string); MicroStation V8, GDAL's own test file (read by cadkit in a worker; its extents −1.958 to 6, −1 to 7, 0 to 8 m match GDAL's ODA-based reference reading, 4 text labels noted); an OLE file that is not a DGN (refused), not DGN (refused) |
| IFC | written entity by entity by `make-ifc.mjs` (no IFC library) and read by web-ifc in a worker: IFC4 wall in millimetres (an extruded rectangle, its red surface style), the same zipped as .ifczip, the same named .stp (opened as IFC by its FILE_SCHEMA, warns), IFC2X3 slab in feet through a chain of placements, a wall at site coordinates 9,000 km from the origin (exact size kept), a wall with an opening cut through it (16 vertices), a STEP part named .ifc (opened as STEP, warns), a project with no elements (refused), ifcXML (refused) |
| Zip | an OBJ with its MTL and texture in a folder inside a .zip, with macOS junk entries |
| Other | empty file, random bytes, a text file, an MTL alone, two models at once, a model beside a stray file, a 179,000-triangle STL (opens in seconds) |

## 2. The page

The drop screen first; a bad file explained on it; the workspace and info
card; the Up switch (a Z-up box stands 10 tall, flipped to Y up 20 tall) and
the model sitting centred on the grid; Edges (exactly the box's 12 edges),
Wireframe and Grid; a drag turns the view and ⟳ puts it back exactly; Download › PNG
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

Then the ruler's snapping, on a plate 60 × 40 × 10 written as an STL in the
run (a round hole of radius 8, a square hole and a slot cut through it), each
pick a few pixels off its target: the round hole's centre tagged ⌀ 16, a slot
end's centre tagged R 3, the square hole's centre, an edge's midpoint, a
corner, a point along an edge (on the edge), a point on the round edge (on the
circle, not its chord), a flat face's centre, the perpendicular foot from the
last point to an edge and to a face, Shift placing on the bare surface, and a
corner hidden behind the plate never taken; hovering shows the centre marker
and Shift drops it; hole centre to edge midpoint measures 25. On the STEP box,
whose edges come from its CAD faces: a corner, a midpoint, the top face's
centre, and the triangle diagonal inside a face snapping to nothing.

The last run (fixtures, page and converter): 585 checks passed, 0 failed.

## 2b. The converter

Download saves the open model as STEP, STL or GLB; each file is read back by
something other than the exporter. STEP goes through OpenCascade in Node: an
STL box comes back 30 × 20 × 10 with area 2200 as one solid of 6 faces (the
coplanar triangles merged); a plate with a square hole keeps its top and
bottom as single faces with a hole loop and reads back whole (area 2400); a box
missing two triangles is saved as an open surface model; a STEP part keeps its
colour round trip. STL and GLB are parsed in the harness: 12 triangles, a
Y-up OBJ stood on Z (and as the reader turned it with Up), a 3MF in inches
saved in millimetres (762 × 508 × 254), glTF's Y up on the GLB's root node,
the DGN box as 7 coloured polylines in STEP and as lines in GLB (with STL
greyed out and the reason given), the layers part with one level unticked saving only
the other box as STL (and saying so), Only, None (saving then explains there is nothing shown) and All, the DGN V8 sample's STEP on GDAL's extents in
millimetres, and the animated sample's GLB keeping its
animation and 14 parts while the model on screen stays in view. IFC: a slab in feet
saves its STL in millimetres (9144 × 6096 × 3048); a wall with an opening reads back in
OpenCascade at area 2400; a wall at site coordinates keeps its place and size in STEP
(STL's 32-bit floats would round it).

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
