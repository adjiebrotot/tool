// Writes the IFC fixtures as IFC text, entity by entity from the IFC schema
// (no IFC library), and adds their cases to fixtures/cases.json:
//
//   ifc/box.ifc          IFC4, millimetres: the 30 × 20 × 10 box as an IfcWall,
//                        an extruded rectangle, red (an IfcSurfaceStyle).
//   ifc/box.ifczip       the same file inside a zip.
//   ifc/feet.ifc         IFC2X3, feet (an IfcConversionBasedUnit): a 30 × 20 × 10
//                        IfcSlab placed by a chain of local placements.
//   ifc/far.ifc          IFC4, metres: the box at site coordinates (500 km east,
//                        9,000 km north), which must keep its exact size.
//   ifc/opening.ifc      IFC4, mm: the box with a 10 × 10 opening through it
//                        (IfcOpeningElement, IfcRelVoidsElement), cut by web-ifc.
//   ifc/box-named.stp    box.ifc named .stp: opened as IFC, with a note.
//   ifc/part-named.ifc   a STEP schema file named .ifc: opened as STEP.
//   ifc/empty.ifc        a project with no elements (refused).
//   ifc/box.ifcxml.ifc   ifcXML (refused).
//
//   node make-ifc.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEPS, ensureDeps } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'fixtures');
const OUT = path.join(FIX, 'ifc');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
ensureDeps();
const fflate = await import(pathToFileURL(path.join(DEPS, 'node_modules/three/examples/jsm/libs/fflate.module.js')).href);

// A 22-character IFC GlobalId (base 64 alphabet), unique within a file.
const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
let gidSeq = 0;
const gid = () => { let n = ++gidSeq, s = ''; for (let i = 0; i < 22; i++) { s = ALPHA[n % 64] + s; n = Math.floor(n / 64); } return "'" + s + "'"; };
const num = v => (Number.isInteger(v) ? v + '.' : String(v));
const pt = p => 'IFCCARTESIANPOINT((' + p.map(num).join(',') + '))';
const dir = d => 'IFCDIRECTION((' + d.map(num).join(',') + '))';

/** An IFC file: entities written by `body(e)`, where e(text) adds one and returns its #id. */
function ifc(schema, name, body) {
  const lines = [];
  const e = text => { lines.push('#' + (lines.length + 1) + '=' + text + ';'); return '#' + lines.length; };
  body(e);
  return 'ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((\'ViewDefinition [CoordinationView]\'),\'2;1\');\n'
    + 'FILE_NAME(\'' + name + '\',\'2026-11-20T00:00:00\',(\'\'),(\'\'),\'make-ifc.mjs\',\'make-ifc.mjs\',\'\');\n'
    + 'FILE_SCHEMA((\'' + schema + '\'));\nENDSEC;\nDATA;\n' + lines.join('\n') + '\nENDSEC;\nEND-ISO-10303-21;\n';
}

/** Project → site → building → storey, with a length unit; returns the storey, its placement and the body context. */
function spatial(e, schema, unit, sitePlace = [0, 0, 0]) {
  const origin = e(pt([0, 0, 0]));
  const axis = e('IFCAXIS2PLACEMENT3D(' + origin + ',$,$)');
  const ctx = e("IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05," + axis + ',$)');
  const body = e("IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*," + ctx + ',$,.MODEL_VIEW.,$)');
  const units = e('IFCUNITASSIGNMENT((' + [unit(e), e('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)')].join(',') + '))');
  const project = e('IFCPROJECT(' + gid() + ",$,'Test project',$,$,$,$,(" + ctx + '),' + units + ')');
  const sitePl = e('IFCLOCALPLACEMENT($,' + e('IFCAXIS2PLACEMENT3D(' + e(pt(sitePlace)) + ',$,$)') + ')');
  const site = e('IFCSITE(' + gid() + ",$,'Site',$,$," + sitePl + ',$,$,.ELEMENT.,$,$,$,$,$)');
  const bldPl = e('IFCLOCALPLACEMENT(' + sitePl + ',' + axis + ')');
  const bld = e('IFCBUILDING(' + gid() + ",$,'Building',$,$," + bldPl + ',$,$,.ELEMENT.,$,$,$)');
  const stPl = e('IFCLOCALPLACEMENT(' + bldPl + ',' + axis + ')');
  const storey = e('IFCBUILDINGSTOREY(' + gid() + ",$,'Ground floor',$,$," + stPl + ',$,$,.ELEMENT.,0.)');
  e('IFCRELAGGREGATES(' + gid() + ',$,$,$,' + project + ',(' + site + '))');
  e('IFCRELAGGREGATES(' + gid() + ',$,$,$,' + site + ',(' + bld + '))');
  e('IFCRELAGGREGATES(' + gid() + ',$,$,$,' + bld + ',(' + storey + '))');
  return { storey, stPl, body, axis, origin };
}

/** An extruded rectangle w × d from (x0, y0, z0), h tall. */
function extrusion(e, [x0, y0, z0], w, d, h) {
  const prof = e('IFCRECTANGLEPROFILEDEF(.AREA.,$,' + e('IFCAXIS2PLACEMENT2D(' + e('IFCCARTESIANPOINT((' + num(w / 2) + ',' + num(d / 2) + '))') + ',$)') + ',' + num(w) + ',' + num(d) + ')');
  return e('IFCEXTRUDEDAREASOLID(' + prof + ',' + e('IFCAXIS2PLACEMENT3D(' + e(pt([x0, y0, z0])) + ',$,$)') + ',' + e(dir([0, 0, 1])) + ',' + num(h) + ')');
}

function style(e, item, rgb) {
  const colour = e("IFCCOLOURRGB($," + rgb.map(num).join(',') + ')');
  const shading = e('IFCSURFACESTYLESHADING(' + colour + ',0.)');
  const st = e("IFCSURFACESTYLE('Red',.BOTH.,(" + shading + '))');
  e('IFCSTYLEDITEM(' + item + ',(' + st + '),$)');
}

/** An element (IfcWall, IfcSlab …) holding one extruded box, placed under the storey. */
function element(e, s, cls, solid, attrs, { offset = [0, 0, 0] } = {}) {
  const shape = e('IFCPRODUCTDEFINITIONSHAPE($,$,(' + e("IFCSHAPEREPRESENTATION(" + s.body + ",'Body','SweptSolid',(" + solid + '))') + '))');
  const pl = e('IFCLOCALPLACEMENT(' + s.stPl + ',' + e('IFCAXIS2PLACEMENT3D(' + e(pt(offset)) + ',$,$)') + ')');
  const el = e(cls + '(' + gid() + ",$,'Box',$,$," + pl + ',' + shape + ',$' + attrs + ')');
  e('IFCRELCONTAINEDINSPATIALSTRUCTURE(' + gid() + ',$,$,$,(' + el + '),' + s.storey + ')');
  return { el, pl };
}

const mm = e => e('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)');
const metre = e => e('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)');
const feet = e => {
  const m = e('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)');
  const dims = e('IFCDIMENSIONALEXPONENTS(1,0,0,0,0,0,0)');
  const f = e('IFCMEASUREWITHUNIT(IFCLENGTHMEASURE(0.3048),' + m + ')');
  return e("IFCCONVERSIONBASEDUNIT(" + dims + ",.LENGTHUNIT.,'FOOT'," + f + ')');
};
const RED = [0.8, 0.1, 0.1];
const cases = [];
const write = (rel, data) => { fs.writeFileSync(path.join(FIX, rel), data); return rel; };
const add = (name, files, expect) => cases.push({ name, files, expect });
const BOX = { up: 'z', triangles: 12, vertices: 8, parts: 1, size: [30, 20, 10] };

const boxText = ifc('IFC4', 'box.ifc', e => {
  const s = spatial(e, 'IFC4', mm);
  const solid = extrusion(e, [0, 0, 0], 30, 20, 10);
  style(e, solid, RED);
  element(e, s, 'IFCWALL', solid, ',.STANDARD.');
});
add('ifc4-wall-box-mm', [write('ifc/box.ifc', boxText)], { formats: ['IFC'], units: 'mm', ...BOX, colour: RED, noWarnings: true });
add('ifc-zip', [write('ifc/box.ifczip', Buffer.from(fflate.zipSync({ 'box.ifc': fflate.strToU8(boxText) })))], { formats: ['IFC'], units: 'mm', ...BOX, colour: RED });
add('ifc-named-stp', [write('ifc/box-named.stp', boxText)], { formats: ['IFC'], units: 'mm', ...BOX, warning: { re: 'holds IFC' } });

// IFC2X3 in feet; the slab sits 5 ft up its storey, through two placements.
add('ifc2x3-slab-feet', [write('ifc/feet.ifc', ifc('IFC2X3', 'feet.ifc', e => {
  const s = spatial(e, 'IFC2X3', feet);
  const solid = extrusion(e, [0, 0, 0], 30, 20, 10);
  element(e, s, 'IFCSLAB', solid, ',.FLOOR.', { offset: [2, 3, 5] });
}))], { formats: ['IFC'], units: 'ft', ...BOX });

// Site coordinates in metres: float32 alone would round the box away.
add('ifc-far-from-origin', [write('ifc/far.ifc', ifc('IFC4', 'far.ifc', e => {
  const s = spatial(e, 'IFC4', metre, [500000, 9000000, 120]);
  element(e, s, 'IFCWALL', extrusion(e, [0, 0, 0], 30, 20, 10), ',.STANDARD.');
}))], { formats: ['IFC'], units: 'm', ...BOX, tol: 1e-6 });

// A 10 × 10 opening straight through the box's 10-tall height, in its middle.
add('ifc-opening-cut', [write('ifc/opening.ifc', ifc('IFC4', 'opening.ifc', e => {
  const s = spatial(e, 'IFC4', mm);
  const { el, pl } = element(e, s, 'IFCWALL', extrusion(e, [0, 0, 0], 30, 20, 10), ',.STANDARD.');
  const cut = extrusion(e, [10, 5, -1], 10, 10, 12);
  const shape = e('IFCPRODUCTDEFINITIONSHAPE($,$,(' + e("IFCSHAPEREPRESENTATION(" + s.body + ",'Body','SweptSolid',(" + cut + '))') + '))');
  const op = e('IFCOPENINGELEMENT(' + gid() + ",$,'Hole',$,$," + e('IFCLOCALPLACEMENT(' + pl + ',' + s.axis + ')') + ',' + shape + ',$,.OPENING.)');
  e('IFCRELVOIDSELEMENT(' + gid() + ',$,$,$,' + el + ',' + op + ')');
}))], { formats: ['IFC'], units: 'mm', up: 'z', parts: 1, vertices: 16, minTriangles: 24, size: [30, 20, 10] });

// A STEP part named .ifc: its schema says STEP, so it opens as STEP.
{
  const step = fs.readFileSync(path.join(FIX, 'step/box.stp'));
  add('step-named-ifc', [write('ifc/part-named.ifc', step)], { formats: ['STEP'], units: 'mm', ...BOX, warning: { re: 'holds STEP' } });
}
add('ifc-no-elements', [write('ifc/empty.ifc', ifc('IFC4', 'empty.ifc', e => { spatial(e, 'IFC4', mm); }))], { error: { re: 'no elements' } });
add('ifc-xml', [write('ifc/box.ifcxml.ifc', '<?xml version="1.0" encoding="UTF-8"?>\n<ifcXML xmlns="http://www.buildingsmart-tech.org/ifcXML/IFC4/final"></ifcXML>\n' + ' '.repeat(80))], { error: { re: 'XML' } });

// Into cases.json: replace this script's earlier cases, keep every other.
const file = path.join(FIX, 'cases.json');
const all = JSON.parse(fs.readFileSync(file, 'utf8')).filter(c => !cases.some(n => n.name === c.name));
fs.writeFileSync(file, JSON.stringify([...all, ...cases], null, 1));
console.log('wrote ' + cases.length + ' IFC cases in ' + OUT);
