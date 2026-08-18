/* Renders one QR code per message and hands back a bit-packed module matrix.
   Packed rather than pixels: a v40 matrix is 3.9 KB instead of 125 KB, and the
   buffer is transferred, not copied. */
'use strict';
var ready = false;

self.onmessage = function (e) {
  var m = e.data;

  if (m.cmd === 'init') {
    try {
      importScripts(m.lib);
      ready = (typeof qrcode === 'function');
      self.postMessage({ cmd: 'init', ok: ready, error: ready ? null : 'qrcode global missing' });
    } catch (err) {
      self.postMessage({ cmd: 'init', ok: false, error: String(err && err.message || err) });
    }
    return;
  }

  if (m.cmd === 'render') {
    if (!ready) { self.postMessage({ cmd: 'error', seq: m.seq, error: 'encoder not ready' }); return; }
    try {
      // The version is always explicit: qrcode-generator's auto-select loop stops
      // at 39, so version 40 would never be chosen and would throw instead.
      var qr = qrcode(m.version, m.ecc);
      qr.addData(m.str, 'Alphanumeric');
      qr.make();
      var n = qr.getModuleCount();
      var bytes = new Uint8Array(Math.ceil(n * n / 8));
      var bit = 0;
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (qr.isDark(r, c)) bytes[bit >> 3] |= (128 >> (bit & 7));
          bit++;
        }
      }
      self.postMessage({ cmd: 'frame', seq: m.seq, modules: n, bits: bytes.buffer }, [bytes.buffer]);
    } catch (err) {
      self.postMessage({ cmd: 'error', seq: m.seq, error: String(err && err.message || err) });
    }
  }
};
