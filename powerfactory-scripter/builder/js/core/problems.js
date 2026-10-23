// The Problems catalogue (DESIGN 6.7, U17): every message the generator and the loader show
// about a workflow is built here, so the wording stays the same everywhere.
//
// Pattern: what is wrong, why in one clause, what to do. Blocks are named by their display
// name (label or title); ports by their label. Never "path", "scope", "region" or "DAG".
// Levels: 'error' (stops the downloaded script before it connects), 'warning', 'todo' (a field
// to fill in: neutral while building, counted with the errors at download).
// A problem may carry `fix: { label, op }`; ops the UI can carry out:
//   { op: 'select', nodeId }                 select and centre the block
//   { op: 'removeEdge', edgeId }             remove one wire
//   { op: 'moveToDone', edgeId, loopId }     move this wire's start to "After all passes" of the loop
//   { op: 'addStart' }                       add a Start block
//
// Plain ES module, no DOM. Every function returns { level, msg, nodeId?, edgeId?, fix? }.

const q = (s) => String(s);
const portName = (p) => (p && (p.label || p.id)) || 'a value';

export const P = {
  // ---- Workflow shape
  noStart: () => ({ level: 'error', msg: 'This workflow has no Start block. Every workflow begins at Start: add one.', fix: { label: 'Add Start', op: { op: 'addStart' } } }),
  twoStarts: (n, keepId) => ({ level: 'error', msg: `There are ${n} Start blocks. A workflow has exactly one Start: delete the extra ones (the first one is used).`, nodeId: keepId }),
  notReached: (name, id) => ({ level: 'warning', msg: `${q(name)} is not connected to Start, so it does not run. Wire it after a step that runs, or delete it.`, nodeId: id }),
  pureUnused: (name, id) => ({ level: 'warning', msg: `${q(name)} is not used: wire one of its outputs into a step.`, nodeId: id }),
  cycle: (names, id) => ({ level: 'error', msg: `These steps go round in a circle: ${names.join(', ')}. Use a loop block to repeat.`, nodeId: id }),
  wireBack: (loop, id, edgeId) => ({ level: 'error', msg: `No need to wire back to ${q(loop)}: when the Each pass route ends, the next pass starts. Remove the wire.`, nodeId: id, edgeId, fix: edgeId ? { label: 'Remove the wire', op: { op: 'removeEdge', edgeId } } : undefined }),
  pureCycle: (names, id) => ({ level: 'error', msg: `These calculations use each other's results in a circle: ${names.join(', ')}. Remove one of the wires.`, nodeId: id }),
  insideAndAfter: (block, loop, id, edgeId, loopId) => ({ level: 'error', msg: `${q(block)} is wired both inside ${q(loop)} and after it. A block runs on every pass or once after the loop: remove one wire.`, nodeId: id, edgeId, fix: edgeId ? { label: 'Remove the wire', op: { op: 'removeEdge', edgeId } } : undefined }),
  insideAndOutside: (block, loop, id, edgeId) => ({ level: 'error', msg: `${q(block)} is wired both inside ${q(loop)} and from outside it. A block runs on every pass of a loop or outside it, not both: remove one wire.`, nodeId: id, edgeId, fix: edgeId ? { label: 'Remove the wire', op: { op: 'removeEdge', edgeId } } : undefined }),
  tooDeep: (block, id) => ({ level: 'error', msg: `${q(block)} is the 7th loop inside another loop. Python allows 6 levels here: move part of the work into a loop after this one.`, nodeId: id }),
  tooTangled: () => ({ level: 'error', msg: 'This workflow is too tangled to write out (over 20 000 lines of Python). Join the branches with fewer crossing wires.' }),

  // ---- Wires
  missingBlock: (type, id) => ({ level: 'error', msg: `This block ("${q(type)}") is missing from this version of the Builder. Its settings and wires are kept, but it does not run.`, nodeId: id }),
  portGone: (block, port, id, edgeId) => ({ level: 'error', msg: `A wire on ${q(block)} uses a port it no longer has ("${q(port)}"). Remove the wire and connect it again.`, nodeId: id, edgeId, fix: { label: 'Remove the wire', op: { op: 'removeEdge', edgeId } } }),
  wrongWire: (from, fromPort, to, toPort, why, id, edgeId) => ({ level: 'error', msg: `The wire from ${q(from)} (${portName(fromPort)}) to ${q(to)} (${portName(toPort)}) does not fit: ${why} Remove it.`, nodeId: id, edgeId, fix: { label: 'Remove the wire', op: { op: 'removeEdge', edgeId } } }),
  twoIntoInput: (block, port, id, edgeId) => ({ level: 'warning', msg: `Two wires go into ${portName(port)} of ${q(block)}. An input takes one wire, so only the first is used: remove the other.`, nodeId: id, edgeId, fix: { label: 'Remove the wire', op: { op: 'removeEdge', edgeId } } }),
  twoFromFlowOut: (block, port, id, edgeId) => ({ level: 'warning', msg: `Two wires leave ${port && port.label ? port.label + ' of ' : ''}${q(block)}. A step leads to one next step, so only the first is used: remove the other.`, nodeId: id, edgeId, fix: { label: 'Remove the wire', op: { op: 'removeEdge', edgeId } } }),
  happyUnwired: (block, happy, fail, id) => ({ level: 'warning', msg: `${happy} of ${q(block)} is not wired while ${fail} is. Wire the step that should run when it is ${happy.toLowerCase()}.`, nodeId: id }),

  // ---- Values on the route
  notYet: (consumer, port, producer, step, id, edgeId) => ({ level: 'error', msg: `${q(consumer)} needs ${portName(port)}, but ${q(producer)} has not run yet on this route. Connect ${q(step)} after ${q(producer)}.`, nodeId: id, edgeId }),
  onlyInLoop: (consumer, port, producer, loop, id, edgeId) => ({ level: 'error', msg: `${q(consumer)} uses ${portName(port)} from ${q(producer)}, which only exists on each pass of ${q(loop)}. Connect it on the Each pass route of ${q(loop)}, or keep the value with Remember a value.`, nodeId: id, edgeId }),
  insideSearch: (consumer, port, producer, search, id, edgeId) => ({ level: 'error', msg: `${q(consumer)} needs ${portName(port)} from ${q(producer)}, but values made inside the tries of ${q(search)} are not available after it. Use the After the search outputs of ${q(search)}, Report this try or Remember a value.`, nodeId: id, edgeId }),
  bodyEndOutside: (loop, port, id) => ({ level: 'error', msg: `${q(loop)} checks ${portName(port)} at the end of each pass, but that value is not made on every pass. Make it on the Each pass route of ${q(loop)} (not on a side branch) or before the loop.`, nodeId: id }),
  bodyEndOnSkip: (loop, id) => ({ level: 'warning', msg: `When a pass of ${q(loop)} ends early, its condition cannot be checked (the value is made later in the pass), so the loop goes on to the next pass.`, nodeId: id }),
  resultsAfterWrite: (reader, writer, id) => ({ level: 'error', msg: `${q(reader)} reads results after ${q(writer)} changed the model. Move it before ${q(writer)}, or run the calculation again first.`, nodeId: id }),
  resultsAfterWriteInLoop: (reader, writer, loop, id) => ({ level: 'error', msg: `${q(reader)} reads results at the start of each pass of ${q(loop)}, but ${q(writer)} changed the model on the pass before. Run a calculation before ${q(reader)} in the pass.`, nodeId: id }),
  monitorUnavailable: (consumer, port, run, id) => ({ level: 'error', msg: `${q(consumer)} needs ${portName(port)} recorded during ${q(run)}, but it is not known yet when the simulation runs. Pick the element on ${q(consumer)}, or loop over the elements with For each element after the simulation.`, nodeId: id }),

  // ---- Structure blocks
  terminalOutside: (block, id) => ({ level: 'error', msg: `${q(block)} only works inside a loop. Connect it on the Each pass route of a loop.`, nodeId: id }),
  withinOnly: (block, what, id) => ({ level: 'error', msg: what === 'callback'
    ? `${q(block)} only works inside Optimise or Find limit. Connect it on the Each try route of a search.`
    : `${q(block)} only works inside a loop. Connect it on the Each pass route of a loop.`, nodeId: id }),
  inLoopWritesFiles: (block, loop, id, edgeId, loopId) => ({ level: 'warning', msg: `${q(block)} runs on every pass of ${q(loop)} and writes a file each time. To save once, connect it to After all passes of ${q(loop)}.`, nodeId: id, edgeId, fix: edgeId ? { label: 'Move it to After all passes', op: { op: 'moveToDone', edgeId, loopId } } : undefined }),

  // ---- To do
  fillIn: (block, setting, id) => ({ level: 'todo', msg: `Fill in ${q(setting)} on ${q(block)}.`, nodeId: id }),
  connectInput: (block, port, id) => ({ level: 'todo', msg: `Connect a value to ${portName(port)} of ${q(block)}.`, nodeId: id }),
  chooseElement: (block, port, id) => ({ level: 'todo', msg: `Choose the element for ${portName(port)} on ${q(block)}.`, nodeId: id }),

  // ---- Runtime and internal
  helperMissing: (name) => ({ level: 'error', msg: `Helper ${q(name)} is missing from the runtime, so the script would stop when it gets there. Update the Builder (or its runtime files).` }),
  runtimeProblem: (msg) => ({ level: 'warning', msg: q(msg) }),
  internal: (block, msg, id) => ({ level: 'error', msg: `The Builder could not write ${q(block)} (${q(msg)}). Change its settings, or report this.`, nodeId: id }),
  noOutput: (block, port, id) => ({ level: 'error', msg: `${q(block)} did not give a value for ${portName(port)}. Change its settings, or report this.`, nodeId: id }),
};

// The words for where an unwired flow output goes (U3): shown as the canvas caption and used in
// the guard comments. `branch` is true for an output that leaves the usual route (a branch's).
export function endWords(structure, label, branch) {
  if (!structure) return 'ends the workflow';
  if (structure === 'callback') return `ends this try of ${label}`;
  return branch ? `skips to the next pass of ${label}` : `goes on to the next pass of ${label}`;
}
