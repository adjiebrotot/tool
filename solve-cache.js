/* Solved results kept, so a plan solved once opens solved.

   The optimiser tools (Capacity Expansion Planner, ED/UC Simulator) re-solve
   with HiGHS on every load. A result depends only on the tool's solve key
   (the plan and its options, exactly) and on the solver code, so it can be
   kept and read back instead:

   - presolved/index.json, beside the tool, names the solver revision (a hash
     of the files that compute a result) and the Quick Starts solved ahead of
     time: presolved/<name>.json, each with the full key it was solved for.
     _ref/presolve.mjs writes them and, with --check, fails when the solver
     changed since.
   - Each reader's own solves go to IndexedDB, under the same revision, the
     last MAX per tool.

   A result is used only when its key is the very key on screen and its
   revision is the one the tool ships now; anything else (no index, offline,
   storage blocked, a new solver) is a miss, and the tool solves as before.

     var cache = SolveCache.create('capacity-expansion-planner');
     cache.get(key).then(function(res){ ... res or null ... });
     cache.put(key, res);
*/
(function () {
  'use strict';
  var DB = 'brotools-solves', STORE = 'results', MAX = 12, WAIT = 2500;

  // cyrb53: a short, stable name for a long key (the key itself is checked too).
  function hash(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }

  // JSON has no NaN or Infinity, and results carry both (a line with no limit,
  // a capacity factor of a plant not yet built).
  var NUM = { NaN: NaN, Infinity: Infinity, '-Infinity': -Infinity };
  function encode(obj) {
    return JSON.stringify(obj, function (k, v) {
      return typeof v === 'number' && !isFinite(v) ? { $num: String(v) } : v;
    });
  }
  function decode(text) {
    return JSON.parse(text, function (k, v) {
      return v && typeof v === 'object' && typeof v.$num === 'string' && Object.keys(v).length === 1 && v.$num in NUM ? NUM[v.$num] : v;
    });
  }

  var dbP = null;
  function db() {
    if (!dbP) {
      dbP = new Promise(function (resolve, reject) {
        var req = indexedDB.open(DB, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
        req.onblocked = function () { reject(new Error('blocked')); };
      });
      dbP.catch(function () {});
    }
    return dbP;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(STORE, mode), out = fn(t.objectStore(STORE));
        t.oncomplete = function () { resolve(out && 'result' in out ? out.result : undefined); };
        t.onerror = t.onabort = function () { reject(t.error); };
      });
    });
  }

  function create(tool, base) {
    base = base || 'presolved/';
    var indexP = null;
    function index() {
      if (!indexP) {
        indexP = fetch(base + 'index.json').then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        }).then(function (ix) {
          return ix && typeof ix.rev === 'string' ? ix : null;
        }, function () { return null; });
      }
      return indexP;
    }
    function mine(key) { return tool + '|' + hash(key); }

    function lookup(key) {
      return index().then(function (ix) {
        if (!ix) return null;
        var h = hash(key);
        return tx('readonly', function (s) { return s.get(tool + '|' + h); }).catch(function () { return null; }).then(function (hit) {
          if (hit && hit.rev === ix.rev && hit.key === key) {
            var res = decode(hit.res);
            tx('readwrite', function (s) { hit.t = Date.now(); s.put(hit, tool + '|' + h); }).catch(function () {});
            return res;
          }
          var file = ix.files && ix.files[h];
          if (!file) return null;
          return fetch(base + file).then(function (r) { return r.ok ? r.text() : null; }).then(function (text) {
            if (!text) return null;
            var d = decode(text);
            return d && d.rev === ix.rev && d.key === key && d.res ? d.res : null;
          });
        });
      }).catch(function () { return null; });
    }

    return {
      // The result solved for this very key, or null. Never rejects, and gives
      // up (null) rather than hold a solve back for long.
      get: function (key) {
        return Promise.race([
          lookup(key),
          new Promise(function (resolve) { setTimeout(function () { resolve(null); }, WAIT); })
        ]);
      },
      // Keeps a fresh solve, then drops this tool's oldest beyond MAX.
      put: function (key, res) {
        if (!res || !res.report || !res.report.ok) return Promise.resolve();
        // Written down now, before the page draws from it.
        var text;
        try { text = encode(res); } catch (e) { return Promise.resolve(); }
        return index().then(function (ix) {
          if (!ix) return;
          var entry = { tool: tool, rev: ix.rev, key: key, res: text, t: Date.now() };
          return tx('readwrite', function (s) { s.put(entry, mine(key)); }).then(function () {
            return tx('readwrite', function (s) {
              var all = [];
              s.openCursor().onsuccess = function (e) {
                var c = e.target.result;
                if (c) { if (c.value && c.value.tool === tool) all.push({ k: c.key, t: c.value.t, rev: c.value.rev }); c.continue(); return; }
                all.sort(function (a, b) { return b.t - a.t; });
                all.forEach(function (x, i) { if (i >= MAX || x.rev !== ix.rev) s.delete(x.k); });
              };
            });
          });
        }).catch(function () {});
      }
    };
  }

  window.SolveCache = { create: create, hash: hash, encode: encode, decode: decode };
})();
