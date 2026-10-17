/* Capacity Expansion Planner: the optimisation, off the main thread.

   A module worker: it loads cx-core.js (the same file the page and the audit
   use) and the PSA.js optimiser the ED/UC Simulator ships, which fetches the
   HiGHS solver beside it on the first run. The page posts { id, model, opts }
   and gets back { id, res } or { id, error }. */
import './cx-core.js';

var CX = self.CX;
var engineP = null;
function engine(){
  if(!engineP){
    engineP = import('../ed-uc-simulator/engine/psa-opt.min.js');
    engineP.catch(function(){ engineP = null; });
  }
  return engineP;
}

self.onmessage = function(e){
  var d = e.data || {};
  engine().then(function(psa){
    if(d.init){ self.postMessage({ id: d.id, ready: true }); return; }
    return CX.solve(psa, CX.load(d.model), d.opts).then(function(res){
      self.postMessage({ id: d.id, res: res });
    });
  }).catch(function(err){
    self.postMessage({ id: d.id, error: String(err && err.message || err) });
  });
};
