/* Runs jsQR off the main thread. jsQR costs tens of milliseconds per frame, which
   would starve the capture loop if it ran inline. */
'use strict';
var ready = false;

self.onmessage = function (e) {
  var m = e.data;

  if (m.cmd === 'init') {
    try {
      importScripts(m.lib);
      ready = (typeof jsQR === 'function');
      self.postMessage({ cmd: 'init', ok: ready, error: ready ? null : 'jsQR global missing' });
    } catch (err) {
      self.postMessage({ cmd: 'init', ok: false, error: String(err && err.message || err) });
    }
    return;
  }

  if (m.cmd === 'decode') {
    if (!ready) { self.postMessage({ cmd: 'result', id: m.id, text: null }); return; }
    var res = null;
    try {
      res = jsQR(new Uint8ClampedArray(m.data), m.width, m.height, { inversionAttempts: 'dontInvert' });
    } catch (err) { res = null; }
    self.postMessage({
      cmd: 'result', id: m.id,
      text: res ? res.data : null,
      location: res ? res.location : null,
      width: m.width, height: m.height
    });
  }
};
