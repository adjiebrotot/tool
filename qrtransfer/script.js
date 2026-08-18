/* QR Code Data Transfer — app layer.
 * Owns the DOM, the workers, and the CDN globals. All wire-protocol behaviour
 * lives in codec.js, which knows nothing about any of this.
 */
(function () {
'use strict';

var C = window.QRTCodec;
var $ = function (id) { return document.getElementById(id); };

var QR_LIB  = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.5.2/qrcode.min.js';
var JSQR_LIB = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';

var QUIET = 6;                 // quiet-zone modules on each side
var RING_CAP = 48;             // pre-rendered frames held ahead of playback
var MAX_BYTES = 10 * 1024 * 1024;
var SOFT_BYTES = 1024 * 1024;
var HARD_BYTES = 4 * 1024 * 1024;

// ── small helpers ───────────────────────────────────────────────────────────

function fmtBytes(b) {
  if (b === null || b === undefined) return '–';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}
function fmtDuration(s) {
  if (!isFinite(s) || s < 0) return '–';
  if (s < 60) return Math.ceil(s) + 's';
  var m = Math.floor(s / 60);
  return m + 'm ' + String(Math.round(s - m * 60)).padStart(2, '0') + 's';
}
function warn(msg) {
  var el = $('warnBanner');
  if (!msg) { el.classList.remove('visible'); el.textContent = ''; return; }
  el.textContent = msg;
  el.classList.add('visible');
}
function setMetrics(defs) {
  for (var i = 0; i < 4; i++) {
    $('m' + (i + 1) + 'l').textContent = defs[i] ? defs[i][0] : '';
    var v = $('m' + (i + 1) + 'v');
    v.textContent = defs[i] ? defs[i][1] : '–';
    v.classList.toggle('small', !!(defs[i] && defs[i][2]));
  }
}
function note(txt) { $('stageNote').textContent = txt; }

// ── theme ───────────────────────────────────────────────────────────────────

(function theme() {
  var btn = $('themeToggle');
  var saved = null;
  try { saved = localStorage.getItem('qrtransfer-theme'); } catch (e) {}
  if (saved === 'dark') document.body.classList.remove('light');
  var sync = function () {
    var light = document.body.classList.contains('light');
    btn.textContent = light ? '🌙 Dark' : '☀️ Light';
  };
  btn.addEventListener('click', function () {
    document.body.classList.toggle('light');
    try { localStorage.setItem('qrtransfer-theme', document.body.classList.contains('light') ? 'light' : 'dark'); } catch (e) {}
    sync();
  });
  sync();
})();

// ── tabs ────────────────────────────────────────────────────────────────────

var activeTab = 'send';

function showTab(name) {
  activeTab = name;
  var tabs = document.querySelectorAll('.ctrl-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].dataset.tab === name);
  var panels = document.querySelectorAll('.ctrl-panel');
  for (i = 0; i < panels.length; i++) panels[i].classList.toggle('active', panels[i].id === 'tab-' + name);

  $('stageTitle').textContent = name === 'send' ? 'Sender' : 'Receiver';
  $('stagePanel').hidden = (name === 'test');      // nothing to show, the block map is the view
  $('qrHolder').classList.toggle('active', name === 'send' && !!player.frameOnScreen);
  $('camHolder').hidden = (name !== 'recv') || !receiver.active;
  $('stageEmpty').hidden = (name === 'send' && !!player.frameOnScreen) || (name === 'recv' && receiver.active);

  if (name !== 'send') stopBroadcast();
  if (name !== 'recv') receiver.stop();

  var showProgress = (name === 'test' && !!selfTest.manifest) || (name === 'recv' && !!receiver.manifest);
  $('progressPanel').hidden = !showProgress;
  var showResult = (name === 'test' && !!selfTest.verdict && selfTest.verdict !== 'running') ||
                   (name === 'recv' && !!receiver.result);
  $('resultPanel').hidden = !showResult;
  if (showProgress) drawBlockMap();

  warn('');
  refreshMetrics();
  if (name === 'send') note(source ? describeSource() : 'Pick a file to begin.');
  if (name === 'recv') note(receiver.active ? 'Scanning.' : 'Start the camera, then point it at the sending screen.');

}

// ── lazy CDN loading ────────────────────────────────────────────────────────

var scriptCache = {};
function loadScript(url) {
  if (scriptCache[url]) return scriptCache[url];
  scriptCache[url] = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = url;
    s.onload = function () { resolve(true); };
    s.onerror = function () { reject(new Error('could not load ' + url)); };
    document.head.appendChild(s);
  });
  return scriptCache[url];
}

/* new Worker(path) is blocked from file:// in some browsers, so fall back to a
   blob built from the same file, then to running on the main thread. */
function makeWorker(path) {
  try {
    var w = new Worker(path);
    return Promise.resolve(w);
  } catch (e) {
    return fetch(path).then(function (r) { return r.text(); }).then(function (src) {
      return new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
    });
  }
}

// ── source selection ────────────────────────────────────────────────────────

var source = null;       // { payload, originalSize, fileCrc, compressed, name, mime }
var rawInput = null;     // { bytes, name, mime } before compression

function describeSource() {
  if (!source) return 'Pick a file to begin.';
  var s = source.name + ', ' + fmtBytes(source.originalSize);
  if (source.compressed) s += ', compressed to ' + fmtBytes(source.payload.length);
  return s;
}

function setSourceBytes(bytes, name, mime) {
  if (bytes.length === 0) { warn('That file is empty, so there is nothing to send.'); return; }
  if (bytes.length > MAX_BYTES) {
    warn('That file is ' + fmtBytes(bytes.length) + '. The limit is ' + fmtBytes(MAX_BYTES) +
         ', because anything larger takes longer to send than a camera can realistically be held steady.');
    return;
  }
  rawInput = { bytes: bytes, name: name, mime: mime };
  stopBroadcast();
  return rebuildPlan();
}

function rebuildPlan() {
  if (!rawInput) return Promise.resolve();
  var compress = $('compressToggle').checked;
  return C.prepareSource(rawInput.bytes, { name: rawInput.name, mime: rawInput.mime, compress: compress })
    .then(function (src) {
      source = src;
      var presetId = $('preset').value;
      try {
        plan = C.planSession({
          payload: src.payload, originalSize: src.originalSize, fileCrc: src.fileCrc,
          compressed: src.compressed, name: src.name, mime: src.mime, preset: presetId
        });
      } catch (e) {
        plan = null;
        warn('This file needs more blocks than the chosen density allows. Pick a denser setting, or send a smaller file.');
        return;
      }
      manifestWire = C.encodeManifestFrame(plan);
      $('dropZone').classList.add('has-file');
      $('dropZone').querySelector('.drop-title').textContent = src.name;
      $('dropZone').querySelector('.drop-sub').textContent = fmtBytes(src.originalSize) +
        (src.compressed ? ', compressed to ' + fmtBytes(src.payload.length) : '');
      $('startBtn').disabled = false;
      $('startBtn').classList.remove('is-disabled');
      warn(sizeAdvice(src.originalSize));
      note(describeSource());
      refreshMetrics();
    });
}

function sizeAdvice(bytes) {
  if (!plan) return '';
  var eta = estimateSeconds();
  if (bytes > HARD_BYTES) return 'This is a large payload. At the current settings it will take about ' +
    fmtDuration(eta) + ' of steady, uninterrupted scanning. Consider a denser setting or a smaller file.';
  if (bytes > SOFT_BYTES) return 'Roughly ' + fmtDuration(eta) + ' at the current settings. Keep both devices still.';
  return '';
}

function estimateSeconds() {
  if (!plan) return NaN;
  var fps = parseInt($('fpsSlider').value, 10);
  var manifestFactor = 1 + 1 / (C.MANIFEST_EVERY + 1);
  return plan.K * 1.25 * manifestFactor / fps;   // 1.25x is the measured mid-range overhead
}

// drop zone
(function dropZone() {
  var dz = $('dropZone'), fi = $('fileInput');
  ['dragenter', 'dragover'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('dragover'); });
  });
  dz.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readFile(f);
  });
  fi.addEventListener('change', function () { if (fi.files && fi.files[0]) readFile(fi.files[0]); });
})();

function readFile(file) {
  note('Reading ' + file.name + '…');
  return file.arrayBuffer().then(function (buf) {
    return setSourceBytes(new Uint8Array(buf), file.name,
      file.type || 'application/octet-stream');
  });
}

$('useTextBtn').addEventListener('click', function () {
  var txt = $('textInput').value;
  if (!txt) { warn('Type or paste something first.'); return; }
  setSourceBytes(C.utf8(txt), 'message.txt', 'text/plain');
});

// ── sender: worker pool ─────────────────────────────────────────────────────

var pool = {
  workers: [], busy: [], ready: false, failed: false, initPromise: null,
  onFrame: null, onFail: null,

  size: function () {
    var hc = navigator.hardwareConcurrency || 2;
    return Math.max(1, Math.min(4, hc - 1));
  },

  init: function () {
    if (this.initPromise) return this.initPromise;
    var self = this;
    var want = this.size();
    var tasks = [];
    for (var i = 0; i < want; i++) tasks.push(this.spawn(i));
    this.initPromise = Promise.all(tasks).then(function (results) {
      self.ready = results.some(function (r) { return r; });
      self.failed = !self.ready;
      return self.ready;
    });
    return this.initPromise;
  },

  spawn: function (idx) {
    var self = this;
    return makeWorker('render-worker.js').then(function (w) {
      return new Promise(function (resolve) {
        var settled = false;
        w.onmessage = function (e) {
          var m = e.data;
          if (m.cmd === 'init') {
            settled = true;
            if (!m.ok) { w.terminate(); resolve(false); return; }
            self.workers.push(w); self.busy.push(false);
            resolve(true);
            return;
          }
          var slot = self.workers.indexOf(w);
          if (slot >= 0) self.busy[slot] = false;
          if (m.cmd === 'frame' && self.onFrame) self.onFrame(m);
          if (m.cmd === 'error' && self.onFail) self.onFail(m.error);
        };
        w.onerror = function () { if (!settled) { settled = true; resolve(false); } };
        w.postMessage({ cmd: 'init', lib: QR_LIB });
        setTimeout(function () { if (!settled) { settled = true; try { w.terminate(); } catch (e) {} resolve(false); } }, 15000);
      });
    }, function () { return false; });
  },

  idle: function () {
    for (var i = 0; i < this.workers.length; i++) if (!this.busy[i]) return i;
    return -1;
  },

  dispatch: function (slot, seq, str, version, ecc) {
    this.busy[slot] = true;
    this.workers[slot].postMessage({ cmd: 'render', seq: seq, str: str, version: version, ecc: ecc });
  }
};

// Last resort when no worker survives: render inline, which caps the usable rate.
var inlineRender = null;
function enableInlineRender() {
  return loadScript(QR_LIB).then(function () {
    if (typeof window.qrcode !== 'function') throw new Error('encoder missing');
    inlineRender = function (str, version, ecc) {
      var qr = window.qrcode(version, ecc);
      qr.addData(str, 'Alphanumeric');
      qr.make();
      var n = qr.getModuleCount();
      var bytes = new Uint8Array(Math.ceil(n * n / 8));
      var bit = 0;
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) bytes[bit >> 3] |= (128 >> (bit & 7));
        bit++;
      }
      return { modules: n, bits: bytes };
    };
    return true;
  });
}

// ── sender: playback ────────────────────────────────────────────────────────

var plan = null, manifestWire = null;

var player = {
  running: false, ring: [], inflight: 0, seq: 0,
  emissionIndex: 0, symbolId: 0, shown: 0, starved: 0, starveWindow: 0,
  raf: 0, vsyncCount: 0, vsyncsPerCode: 8, refreshHz: 60,
  lastTs: 0, intervals: [], startedAt: 0, frameOnScreen: false,
  wakeLock: null
};

var offCanvas = document.createElement('canvas');

function drawPacked(frame) {
  var n = frame.modules, tot = n + QUIET * 2;
  if (offCanvas.width !== tot) { offCanvas.width = tot; offCanvas.height = tot; }
  var octx = offCanvas.getContext('2d');
  var img = octx.createImageData(tot, tot);
  var d = img.data;
  d.fill(255);
  var bits = frame.bits;
  for (var r = 0; r < n; r++) {
    var rowBase = r * n;
    var outRow = (r + QUIET) * tot;
    for (var c = 0; c < n; c++) {
      var bit = rowBase + c;
      if (bits[bit >> 3] & (128 >> (bit & 7))) {
        var o = (outRow + c + QUIET) * 4;
        d[o] = 0; d[o + 1] = 0; d[o + 2] = 0;
      }
    }
  }
  octx.putImageData(img, 0, 0);

  var size = parseInt($('sizeSlider').value, 10);
  size = Math.round(size / tot) * tot || tot;      // whole pixels per module
  var cv = $('qrCanvas');
  if (cv.width !== size) { cv.width = size; cv.height = size; }
  var ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(offCanvas, 0, 0, tot, tot, 0, 0, size, size);
  player.frameOnScreen = true;
  $('qrHolder').classList.add('active');
  $('stageEmpty').hidden = true;
}

function nextWire() {
  var isMan = C.isManifestSlot(player.emissionIndex);
  player.emissionIndex++;
  if (isMan) return manifestWire;
  return C.encodeDataFrame(plan, player.symbolId++);
}

function pump() {
  if (!player.running || !plan) return;
  if (inlineRender) {
    while (player.ring.length < 4) {
      var f = inlineRender(nextWire(), plan.version, plan.ecc);
      player.ring.push(f);
    }
    return;
  }
  while (player.ring.length + player.inflight < RING_CAP) {
    var slot = pool.idle();
    if (slot < 0) break;
    pool.dispatch(slot, player.seq++, nextWire(), plan.version, plan.ecc);
    player.inflight++;
  }
}

pool.onFrame = function (m) {
  player.inflight--;
  player.ring.push({ modules: m.modules, bits: new Uint8Array(m.bits) });
  pump();
};
pool.onFail = function (err) {
  player.inflight--;
  warn('The encoder rejected a frame: ' + err);
};

function measureRefresh(ts) {
  if (player.lastTs) {
    var dt = ts - player.lastTs;
    if (dt > 2 && dt < 200) {
      player.intervals.push(dt);
      if (player.intervals.length > 30) player.intervals.shift();
    }
  }
  player.lastTs = ts;
  if (player.intervals.length >= 20) {
    var s = player.intervals.slice().sort(function (a, b) { return a - b; });
    var med = s[s.length >> 1];
    player.refreshHz = Math.max(24, Math.min(240, Math.round(1000 / med)));
    applyRate();
  }
}

function applyRate() {
  var fps = parseInt($('fpsSlider').value, 10);
  player.vsyncsPerCode = Math.max(1, Math.round(player.refreshHz / fps));
}

function tick(ts) {
  if (!player.running) return;
  player.raf = requestAnimationFrame(tick);
  measureRefresh(ts);
  if (++player.vsyncCount < player.vsyncsPerCode) return;
  player.vsyncCount = 0;

  var frame = player.ring.shift();
  if (!frame) {
    player.starved++;
    player.starveWindow++;
    if (player.starveWindow > 8) {
      player.starveWindow = 0;
      var slider = $('fpsSlider');
      if (parseInt(slider.value, 10) > 2) {
        slider.value = String(parseInt(slider.value, 10) - 1);
        slider.dispatchEvent(new Event('input'));
        warn('This device cannot draw codes that fast, so the rate was lowered to ' + slider.value + ' fps.');
      }
    }
    pump();
    return;
  }
  drawPacked(frame);
  player.shown++;
  if (player.shown % 20 === 0) player.starveWindow = 0;
  pump();
  if (player.shown % 4 === 0) refreshMetrics();
}

function startBroadcast() {
  if (!plan) { warn('Pick a file or paste some text first.'); return; }
  if (player.running) { stopBroadcast(); return; }

  note('Preparing the stream…');
  var ready = pool.ready ? Promise.resolve(true) : pool.init();

  ready.then(function (ok) {
    if (ok) return true;
    return enableInlineRender().then(function () {
      warn('Background rendering is unavailable here, so codes are drawn on the main thread. Keep the rate at 6 fps or below.');
      return true;
    });
  }).then(function () {
    player.running = true;
    player.ring = []; player.inflight = 0; player.seq = 0;
    player.emissionIndex = 0; player.symbolId = 0;
    player.shown = 0; player.starved = 0; player.starveWindow = 0;
    player.vsyncCount = 0; player.lastTs = 0; player.intervals = [];
    player.startedAt = performance.now();
    applyRate();
    pump();
    $('startBtn').textContent = 'Stop broadcasting';
    note('Broadcasting. Point the other device at this screen.');
    requestWakeLock();
    player.raf = requestAnimationFrame(tick);
  }).catch(function (e) {
    warn('The QR encoder could not be loaded, so sending is unavailable. Receiving and the self-test still work. (' + e.message + ')');
    note('Encoder unavailable.');
  });
}

function stopBroadcast() {
  if (!player.running) return;
  player.running = false;
  cancelAnimationFrame(player.raf);
  $('startBtn').textContent = 'Start broadcasting';
  releaseWakeLock();
  note(source ? describeSource() : 'Pick a file to begin.');
}

function requestWakeLock() {
  if (!$('wakeToggle').checked) return;
  if (!navigator.wakeLock || !navigator.wakeLock.request) return;
  navigator.wakeLock.request('screen').then(function (l) { player.wakeLock = l; }, function () {});
}
function releaseWakeLock() {
  if (player.wakeLock) { try { player.wakeLock.release(); } catch (e) {} player.wakeLock = null; }
}

$('startBtn').addEventListener('click', startBroadcast);
$('fsBtn').addEventListener('click', function () {
  var el = $('stagePanel');
  if (document.fullscreenElement) document.exitFullscreen();
  else if (el.requestFullscreen) el.requestFullscreen();
});

// ── receiver ────────────────────────────────────────────────────────────────

var receiver = {
  active: false, stream: null, decoder: null, manifest: null,
  workers: [], workerBusy: [], nextId: 1,
  detector: null, useNative: false, nativeChecked: 0, nativeBad: 0,
  roi: null, misses: 0, lastText: null,
  framesDecoded: 0, framesAccepted: 0, decodeTimes: [], lastDecodeTs: 0,
  raf: 0, rvfc: 0, videoEl: null, grabCanvas: null, inflight: 0,
  startedAt: 0, finished: false, result: null,

  stop: function () {
    this.active = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    if (this.stream) { this.stream.getTracks().forEach(function (t) { t.stop(); }); this.stream = null; }
    var v = $('camVideo');
    if (v.srcObject) v.srcObject = null;
    if (v.src) { URL.revokeObjectURL(v.src); v.removeAttribute('src'); v.load(); }
    $('camHolder').hidden = true;
    $('camBtn').textContent = 'Start camera';
  },

  reset: function () {
    this.decoder = null; this.manifest = null; this.roi = null; this.misses = 0;
    this.lastText = null; this.framesDecoded = 0; this.framesAccepted = 0;
    this.decodeTimes = []; this.finished = false; this.result = null;
    this.nativeChecked = 0; this.nativeBad = 0;
    $('progressPanel').hidden = true;
    $('resultPanel').hidden = true;
    refreshMetrics();
  }
};

function nativeAvailable() {
  if (!('BarcodeDetector' in window)) return Promise.resolve(false);
  return window.BarcodeDetector.getSupportedFormats()
    .then(function (f) { return f.indexOf('qr_code') >= 0; })
    .catch(function () { return false; });
}

function initDecoders() {
  var mode = $('decSel').value;
  var wantNative = (mode === 'auto' || mode === 'native');
  var wantJsqr = (mode === 'auto' || mode === 'jsqr');

  var nativeStep = wantNative ? nativeAvailable() : Promise.resolve(false);
  return nativeStep.then(function (ok) {
    if (ok) { receiver.detector = new window.BarcodeDetector({ formats: ['qr_code'] }); receiver.useNative = true; }
    else { receiver.detector = null; receiver.useNative = false; }

    if (!wantJsqr && !receiver.useNative) throw new Error('no decoder available');
    if (!wantJsqr) return true;
    if (receiver.workers.length) return true;

    var tasks = [makeWorker('decode-worker.js'), makeWorker('decode-worker.js')];
    return Promise.all(tasks.map(function (p) {
      return p.then(function (w) {
        return new Promise(function (resolve) {
          var settled = false;
          w.onmessage = function (e) {
            var m = e.data;
            if (m.cmd === 'init') {
              settled = true;
              if (!m.ok) { w.terminate(); resolve(false); return; }
              receiver.workers.push(w); receiver.workerBusy.push(false);
              resolve(true);
              return;
            }
            var slot = receiver.workers.indexOf(w);
            if (slot >= 0) receiver.workerBusy[slot] = false;
            receiver.inflight--;
            if (m.cmd === 'result') onDecoded(m.text, m.location, false);
          };
          w.onerror = function () { if (!settled) { settled = true; resolve(false); } };
          w.postMessage({ cmd: 'init', lib: JSQR_LIB });
          setTimeout(function () { if (!settled) { settled = true; try { w.terminate(); } catch (e) {} resolve(false); } }, 20000);
        });
      }, function () { return false; });
    })).then(function (res) {
      if (!res.some(Boolean) && !receiver.useNative) throw new Error('no decoder available');
      return true;
    });
  }).then(function () {
    $('decSub').textContent = receiver.useNative
      ? 'Using the built-in reader' + (receiver.workers.length ? ', with jsQR standing by.' : '.')
      : 'Using jsQR.';
    return true;
  });
}

function startCamera() {
  if (receiver.active) { receiver.stop(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    warn('This browser will not give a page camera access. Load a screen recording of the sender instead.');
    return;
  }
  if (!window.isSecureContext) {
    warn('Camera access needs a secure connection (https). Open the hosted page, or load a screen recording of the sender instead.');
    return;
  }

  var res = parseInt($('resSel').value, 10);
  var devId = $('camSel').value;
  var base = { width: { ideal: res }, height: { ideal: Math.round(res * 9 / 16) },
               frameRate: { ideal: 30, max: 60 } };
  if (devId) base.deviceId = { exact: devId };
  else base.facingMode = { ideal: 'environment' };

  // Continuous focus matters a lot at 20 to 40 cm, but plenty of cameras reject
  // the constraint outright, so ask for it and fall back rather than fail.
  var withFocus = Object.assign({}, base, { advanced: [{ focusMode: 'continuous' }] });

  note('Asking for the camera…');
  initDecoders()
    .then(function () {
      return navigator.mediaDevices.getUserMedia({ video: withFocus, audio: false })
        .catch(function (e) {
          if (/denied|NotAllowed|Permission/i.test(String(e && e.name || e))) throw e;
          return navigator.mediaDevices.getUserMedia({ video: base, audio: false });
        });
    })
    .then(function (stream) {
      receiver.stream = stream;
      var track = stream.getVideoTracks()[0];
      // applyConstraints rejects asynchronously, so a try/catch would miss it.
      try {
        var r = track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        if (r && r.catch) r.catch(function () {});
      } catch (e) {}
      var v = $('camVideo');
      v.srcObject = stream;
      return v.play().then(function () { return v; });
    })
    .then(function (v) {
      receiver.active = true;
      receiver.startedAt = performance.now();
      receiver.videoEl = v;
      $('camHolder').hidden = false;
      $('stageEmpty').hidden = true;
      $('camBtn').textContent = 'Stop camera';
      note('Scanning. Fill the outline with the sending screen.');
      warn('');
      listCameras();
      scanLoop();
    })
    .catch(function (e) {
      var msg = String(e && e.message || e);
      if (/denied|NotAllowed/i.test(msg)) warn('Camera permission was refused. You can still load a screen recording of the sender.');
      else if (/no decoder/i.test(msg)) warn('No QR decoder could be loaded. Check the connection, or try again.');
      else warn('The camera could not be started: ' + msg);
      note('Camera unavailable.');
    });
}

function listCameras() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  navigator.mediaDevices.enumerateDevices().then(function (devs) {
    var sel = $('camSel');
    var current = sel.value;
    sel.innerHTML = '<option value="">Default camera</option>';
    devs.filter(function (d) { return d.kind === 'videoinput'; }).forEach(function (d, i) {
      var o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || ('Camera ' + (i + 1));
      sel.appendChild(o);
    });
    sel.value = current;
  }).catch(function () {});
}

/* Feed the decoder only the pixels it needs. Locating a code in a full 1080p
   frame costs tens of milliseconds even when there is no code in it, so once one
   is found we crop to it and scale to about 2.5 pixels per module. */
function grabRegion(video) {
  var vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;

  var sx, sy, sw, sh, target;
  if (receiver.roi) {
    sx = receiver.roi.x; sy = receiver.roi.y; sw = receiver.roi.w; sh = receiver.roi.h;
    var modules = receiver.manifest ? C.moduleCountFor(C.versionForBodySize(receiver.manifest.n)) : 0;
    target = modules ? Math.round(modules * 2.5) : 480;
  } else {
    var side = Math.min(vw, vh);
    sx = (vw - side) / 2; sy = (vh - side) / 2; sw = side; sh = side;
    target = 640;
  }
  // Never scale up. Enlarging a region adds no detail, and the interpolation
  // smears module edges badly enough to stop a code decoding at all.
  target = Math.min(target, Math.round(Math.min(sw, sh)));
  target = Math.max(80, Math.min(target, 900));

  if (!receiver.grabCanvas) receiver.grabCanvas = document.createElement('canvas');
  var cv = receiver.grabCanvas;
  if (cv.width !== target) { cv.width = target; cv.height = target; }
  var ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, target, target);
  return { canvas: cv, sx: sx, sy: sy, sw: sw, sh: sh, target: target };
}

function scanLoop() {
  var v = $('camVideo');
  var lastTime = -1;

  function onFrame() {
    if (!receiver.active) return;
    schedule();
    if (v.readyState < 2) return;
    if (!v.requestVideoFrameCallback) {
      if (v.currentTime === lastTime) return;   // rAF outruns a 30 fps camera
      lastTime = v.currentTime;
    }
    processFrame(v);
  }
  function schedule() {
    if (!receiver.active) return;
    if (v.requestVideoFrameCallback) receiver.rvfc = v.requestVideoFrameCallback(onFrame);
    else receiver.raf = requestAnimationFrame(onFrame);
  }
  schedule();
}

function processFrame(video) {
  if (receiver.finished) return;
  var grab = grabRegion(video);
  if (!grab) return;
  receiver.lastGrab = grab;

  if (receiver.useNative) {
    if (receiver.inflight > 0) return;
    receiver.inflight++;
    receiver.detector.detect(grab.canvas).then(function (codes) {
      receiver.inflight--;
      if (codes && codes.length) {
        var c = codes[0];
        onDecoded(c.rawValue, cornerPointsToLocation(c.cornerPoints), true);
      } else onDecoded(null, null, true);
    }, function () { receiver.inflight--; });
    return;
  }

  var slot = -1;
  for (var i = 0; i < receiver.workers.length; i++) if (!receiver.workerBusy[i]) { slot = i; break; }
  if (slot < 0) return;                            // drop, never queue: a queued frame is stale
  var ctx = grab.canvas.getContext('2d', { willReadFrequently: true });
  var img = ctx.getImageData(0, 0, grab.target, grab.target);
  receiver.workerBusy[slot] = true;
  receiver.inflight++;
  receiver.workers[slot].postMessage({
    cmd: 'decode', id: receiver.nextId++, data: img.data.buffer,
    width: grab.target, height: grab.target
  }, [img.data.buffer]);
}

function cornerPointsToLocation(pts) {
  if (!pts || pts.length < 4) return null;
  return {
    topLeftCorner: pts[0], topRightCorner: pts[1],
    bottomRightCorner: pts[2], bottomLeftCorner: pts[3]
  };
}

function onDecoded(text, location, fromNative) {
  if (!receiver.active || receiver.finished) return;
  var now = performance.now();
  if (receiver.lastDecodeTs) {
    receiver.decodeTimes.push(now - receiver.lastDecodeTs);
    if (receiver.decodeTimes.length > 30) receiver.decodeTimes.shift();
  }
  receiver.lastDecodeTs = now;

  if (!text) {
    if (++receiver.misses > 15) { receiver.roi = null; $('camReticle').classList.remove('locked'); }
    return;
  }
  receiver.misses = 0;
  if (location) { updateRoi(location); $('camReticle').classList.add('locked'); }

  receiver.framesDecoded++;
  if (text === receiver.lastText) return;      // same code, seen again
  receiver.lastText = text;

  var parsed = C.parseFrame(text, receiver.manifest ? receiver.manifest.n : 0);
  if (fromNative) {
    receiver.nativeChecked++;
    if (!parsed) receiver.nativeBad++;
    // The built-in reader is not specified byte for byte across platforms. If it
    // keeps handing back frames that fail their own checksum, stop trusting it.
    if (receiver.nativeChecked >= 40) {
      if (receiver.nativeBad / receiver.nativeChecked > 0.25 && receiver.workers.length && $('decSel').value === 'auto') {
        receiver.useNative = false;
        $('decSub').textContent = 'Switched to jsQR: the built-in reader was returning damaged frames.';
        warn('The built-in barcode reader was returning damaged frames on this device, so jsQR took over.');
      }
      receiver.nativeChecked = 0; receiver.nativeBad = 0;
    }
  }
  if (!parsed) return;

  acceptFrame(parsed);
  refreshMetrics();
}

function updateRoi(loc) {
  var g = receiver.lastGrab;
  if (!g) return;
  var xs = [loc.topLeftCorner.x, loc.topRightCorner.x, loc.bottomRightCorner.x, loc.bottomLeftCorner.x];
  var ys = [loc.topLeftCorner.y, loc.topRightCorner.y, loc.bottomRightCorner.y, loc.bottomLeftCorner.y];
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);

  // Back out of the grab canvas into source video coordinates.
  var kx = g.sw / g.target, ky = g.sh / g.target;
  var x = g.sx + minX * kx, y = g.sy + minY * ky;
  var w = (maxX - minX) * kx, h = (maxY - minY) * ky;
  if (!(w > 8 && h > 8)) return;

  var pad = 0.25;
  x -= w * pad; y -= h * pad; w *= (1 + 2 * pad); h *= (1 + 2 * pad);
  var side = Math.max(w, h);
  var cx = x + w / 2, cy = y + h / 2;
  receiver.roi = { x: cx - side / 2, y: cy - side / 2, w: side, h: side };

  var v = receiver.videoEl;
  if (v && v.videoWidth) {
    var r = receiver.roi;
    $('camReticle').style.left = (r.x / v.videoWidth * 100) + '%';
    $('camReticle').style.top = (r.y / v.videoHeight * 100) + '%';
    $('camReticle').style.width = (r.w / v.videoWidth * 100) + '%';
    $('camReticle').style.height = (r.h / v.videoHeight * 100) + '%';
    $('camReticle').style.inset = 'auto';
  }
}

function acceptFrame(parsed) {
  if (parsed.type === C.TYPE_MANIFEST) {
    if (!receiver.manifest) bindManifest(parsed);
    else if (receiver.manifest.sessionId !== parsed.sessionId && receiver.decoder.recovered === 0) bindManifest(parsed);
    return;
  }
  if (!receiver.decoder) return;                 // data before the manifest, wait
  var r = receiver.decoder.addFrame(parsed);
  if (r === 'progress' || r === 'stored') receiver.framesAccepted++;
  drawBlockMap();
  if (receiver.decoder.isComplete() && !receiver.finished) finishTransfer();
}

function bindManifest(m) {
  receiver.manifest = m;
  receiver.decoder = C.createDecoder({
    K: m.K, blockSize: m.blockSize, sessionId: m.sessionId, degTable: m.degTable
  });
  receiver.framesAccepted = 0;
  $('progressPanel').hidden = false;
  $('resultPanel').hidden = true;
  note('Receiving ' + m.name + ', ' + fmtBytes(m.originalSize) + '.');
  drawBlockMap();
  refreshMetrics();
}

function finishTransfer() {
  receiver.finished = true;
  note('Checking the file…');
  C.finalise(receiver.decoder, receiver.manifest).then(function (res) {
    if (!res.ok) {
      // Never hand over a file that failed its checksum. Start over and keep looking.
      warn('The rebuilt file did not match its checksum (' + res.reason + '). Starting over, keep the camera pointed at the sender.');
      receiver.decoder = C.createDecoder({
        K: receiver.manifest.K, blockSize: receiver.manifest.blockSize,
        sessionId: receiver.manifest.sessionId, degTable: receiver.manifest.degTable
      });
      receiver.finished = false;
      receiver.lastText = null;
      drawBlockMap();
      return;
    }
    receiver.result = res;
    showResult(res.bytes, receiver.manifest, receiver.decoder.stats());
    receiver.stop();
    note('Done. ' + receiver.manifest.name + ' rebuilt and verified.');
  });
}

function showResult(bytes, manifest, stats) {
  $('resultPanel').hidden = false;
  $('resName').textContent = manifest.name;
  $('resSub').textContent = fmtBytes(bytes.length) + ' · ' + manifest.K + ' blocks · ' +
    (stats && stats.overhead ? stats.overhead.toFixed(2) + 'x frames used' : '') +
    ' · CRC-32 ' + ('00000000' + manifest.fileCrc.toString(16)).slice(-8);
  $('resBadge').textContent = 'Checksum OK';
  $('resBadge').className = 'badge badge-success';

  var isText = /^text\//.test(manifest.mime);
  $('copyBtn').hidden = !isText;
  $('copyBtn').onclick = function () {
    navigator.clipboard.writeText(C.fromUtf8(bytes)).then(function () {
      $('copyBtn').textContent = 'Copied';
      setTimeout(function () { $('copyBtn').textContent = 'Copy text'; }, 1500);
    });
  };
  $('dlBtn').onclick = function () {
    var blob = new Blob([bytes], { type: manifest.mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = manifest.name || 'transfer.bin';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };
  refreshMetrics();
}

$('camBtn').addEventListener('click', startCamera);
$('resetBtn').addEventListener('click', function () { receiver.reset(); note('Reset. Ready for a new transfer.'); });
$('decSel').addEventListener('change', function () {
  receiver.useNative = false; receiver.detector = null;
  if (receiver.active) { receiver.stop(); startCamera(); }
});

// Decode a screen recording instead of a live camera.
$('videoInput').addEventListener('change', function (e) {
  var f = e.target.files && e.target.files[0];
  if (!f) return;
  receiver.reset();
  initDecoders().then(function () {
    var v = $('camVideo');
    v.srcObject = null;
    v.src = URL.createObjectURL(f);
    v.muted = true;
    v.loop = false;
    return v.play().then(function () { return v; });
  }).then(function (v) {
    receiver.active = true;
    receiver.videoEl = v;
    receiver.startedAt = performance.now();
    $('camHolder').hidden = false;
    $('stageEmpty').hidden = true;
    note('Reading the recording…');
    v.onended = function () {
      if (!receiver.finished) {
        note('The recording ended before the file was complete.');
        warn('The recording ran out with ' + (receiver.decoder ? receiver.decoder.recovered : 0) +
             ' of ' + (receiver.manifest ? receiver.manifest.K : '?') +
             ' blocks recovered. Record a longer clip, or slow the sender down.');
      }
      receiver.active = false;
    };
    scanLoop();
  }).catch(function (err) {
    warn('That recording could not be read: ' + String(err && err.message || err));
  });
});

// ── block map ───────────────────────────────────────────────────────────────

function drawBlockMap() {
  var onTest = (activeTab === 'test');
  var dec = onTest ? selfTest.decoder : receiver.decoder;
  var man = onTest ? selfTest.manifest : receiver.manifest;
  if (!dec || !man) return;
  var cv = $('blockMap');
  var K = man.K;
  var cols = Math.ceil(Math.sqrt(K * 2.2));
  var rows = Math.ceil(K / cols);
  var cell = Math.max(3, Math.min(14, Math.floor(760 / cols)));
  var gap = cell > 5 ? 1 : 0;
  var w = cols * (cell + gap), h = rows * (cell + gap);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  cv.style.maxWidth = w + 'px';

  var cs = getComputedStyle(document.documentElement);
  var body = getComputedStyle(document.body);
  var on = body.getPropertyValue('--accent').trim() || cs.getPropertyValue('--accent').trim();
  var off = body.getPropertyValue('--border').trim() || cs.getPropertyValue('--border').trim();

  var ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  for (var i = 0; i < K; i++) {
    ctx.fillStyle = dec.have(i) ? on : off;
    ctx.fillRect((i % cols) * (cell + gap), Math.floor(i / cols) * (cell + gap), cell, cell);
  }
  $('mapNote').textContent = dec.recovered + ' of ' + K + ' (' +
    Math.floor(dec.recovered / K * 100) + '%)';
}

// ── metrics ─────────────────────────────────────────────────────────────────

function refreshMetrics() {
  if (activeTab === 'send') {
    var fps = parseInt($('fpsSlider').value, 10);
    var rate = plan ? plan.blockSize * (player.running ? effectiveFps() : fps) / 1024 : 0;
    setMetrics([
      ['Frame payload', plan ? plan.blockSize + ' B' : '–'],
      ['Blocks', plan ? String(plan.K) : '–'],
      ['Rate', plan ? rate.toFixed(1) + ' KB/s' : '–'],
      ['Frames sent', player.running ? String(player.shown) : (plan ? '~' + fmtDuration(estimateSeconds()) : '–')]
    ]);
    if (player.running) $('m4l').textContent = 'Frames sent';
    else if (plan) $('m4l').textContent = 'Estimated time';
    return;
  }

  if (activeTab === 'recv') {
    var dfps = receiver.decodeTimes.length
      ? (1000 / (receiver.decodeTimes.reduce(function (a, b) { return a + b; }, 0) / receiver.decodeTimes.length))
      : 0;
    var dec = receiver.decoder, man = receiver.manifest;
    var left = '–';
    if (dec && man && !dec.isComplete() && dfps > 0) {
      var remaining = (man.K - dec.recovered) * 1.3;
      left = fmtDuration(remaining / Math.max(0.5, dfps));
    } else if (dec && dec.isComplete()) left = 'done';
    setMetrics([
      ['Decode rate', dfps ? dfps.toFixed(1) + ' fps' : '–'],
      ['Blocks', dec ? dec.recovered + ' / ' + man.K : '–', true],
      ['Frames used', dec ? String(dec.stats().accepted) : '–'],
      ['Time left', left]
    ]);
    return;
  }

  setMetrics([
    ['Overhead', selfTest.overhead ? selfTest.overhead.toFixed(2) + 'x' : '–'],
    ['Frames sent', selfTest.frames ? String(selfTest.frames) : '–'],
    ['Frames received', selfTest.received ? String(selfTest.received) : '–'],
    ['Result', selfTest.verdict || '–', true]
  ]);
}

function effectiveFps() { return player.refreshHz / player.vsyncsPerCode; }

// ── self-test ───────────────────────────────────────────────────────────────

var selfTest = { running: false, decoder: null, manifest: null, overhead: 0, frames: 0, received: 0, verdict: '' };

function runSelfTest(opts) {
  opts = opts || {};
  var lossPct = opts.lossPct === undefined ? parseInt($('lossSlider').value, 10) : opts.lossPct;
  var nbytes = opts.bytes === undefined ? parseInt($('testSizeSlider').value, 10) * 1024 : opts.bytes;
  var presetId = opts.preset || $('preset').value;

  selfTest.running = true;
  selfTest.overhead = 0; selfTest.frames = 0; selfTest.received = 0; selfTest.verdict = 'running';
  $('resultPanel').hidden = true;
  warn('');
  $('mapNote').textContent = 'Generating ' + fmtBytes(nbytes) + ' of random data…';
  refreshMetrics();

  // Random, so incompressible: the worst case rather than the flattering one.
  var bytes = new Uint8Array(nbytes);
  var chunk = 65536;
  for (var o = 0; o < nbytes; o += chunk) {
    var slice = bytes.subarray(o, Math.min(o + chunk, nbytes));
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(slice);
    else for (var i = 0; i < slice.length; i++) slice[i] = (Math.random() * 256) | 0;
  }

  return C.prepareSource(bytes, { name: 'selftest.bin', mime: 'application/octet-stream', compress: false })
    .then(function (src) {
      var testPlan = C.planSession({
        payload: src.payload, originalSize: src.originalSize, fileCrc: src.fileCrc,
        compressed: src.compressed, name: src.name, mime: src.mime, preset: presetId
      });
      var manifest = C.parseFrame(C.encodeManifestFrame(testPlan), testPlan.n);
      if (!manifest) throw new Error('the manifest failed its own checksum');

      var dec = C.createDecoder({ K: manifest.K, blockSize: manifest.blockSize,
        sessionId: manifest.sessionId, degTable: manifest.degTable });
      selfTest.decoder = dec;
      selfTest.manifest = manifest;
      $('progressPanel').hidden = false;

      var symbolId = 0, emitted = 0, cap = manifest.K * 60 + 2000;
      var loss = lossPct / 100;
      var t0 = performance.now();

      return new Promise(function (resolve, reject) {
        function step() {
          var budget = performance.now() + 24;      // keep the page responsive
          while (!dec.isComplete() && performance.now() < budget && emitted < cap) {
            var wire = C.encodeDataFrame(testPlan, symbolId++);
            emitted++;
            if (Math.random() < loss) continue;      // this frame never reached the camera
            dec.addFrame(C.parseFrame(wire, testPlan.n));
          }
          selfTest.frames = emitted;
          drawBlockMap();
          refreshMetrics();
          if (dec.isComplete()) return resolve({ dec: dec, manifest: manifest, source: bytes,
            emitted: emitted, ms: performance.now() - t0 });
          if (emitted >= cap) return reject(new Error('gave up after ' + emitted + ' frames'));
          $('mapNote').textContent = dec.recovered + ' of ' + manifest.K + ' (' +
            Math.floor(dec.recovered / manifest.K * 100) + '%), ' + lossPct + '% of frames thrown away';
          setTimeout(step, 0);
        }
        step();
      });
    })
    .then(function (r) {
      return C.finalise(r.dec, r.manifest).then(function (res) {
        var same = res.ok && res.bytes.length === r.source.length;
        if (same) for (var i = 0; i < r.source.length; i++) if (res.bytes[i] !== r.source[i]) { same = false; break; }
        var stats = r.dec.stats();
        selfTest.overhead = stats.overhead;
        selfTest.frames = r.emitted;
        selfTest.received = stats.accepted;
        selfTest.verdict = same ? 'Verified' : 'Failed';
        selfTest.running = false;

        $('resultPanel').hidden = false;
        $('resName').textContent = 'selftest.bin';
        $('resSub').textContent = fmtBytes(r.source.length) + ' · ' + r.manifest.K + ' blocks · ' +
          r.emitted + ' frames emitted, ' + stats.accepted + ' received · ' +
          stats.overhead.toFixed(2) + 'x · ' + Math.round(r.ms) + ' ms';
        $('resBadge').textContent = same ? 'Byte for byte identical' : 'Mismatch';
        $('resBadge').className = 'badge ' + (same ? 'badge-success' : 'badge-error');
        $('copyBtn').hidden = true;
        $('dlBtn').onclick = function () {
          var blob = new Blob([res.bytes], { type: 'application/octet-stream' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = 'selftest.bin';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        };
        if (!same) warn('The self-test could not rebuild the data. Please report this.');
        refreshMetrics();
        return { ok: same, crcMatch: res.ok, overhead: stats.overhead, frames: r.emitted,
                 accepted: stats.accepted, K: r.manifest.K, ms: r.ms, reason: res.reason || null };
      });
    })
    .catch(function (e) {
      selfTest.running = false;
      selfTest.verdict = 'Failed';
      warn('The self-test did not finish: ' + String(e && e.message || e));
      refreshMetrics();
      return { ok: false, reason: String(e && e.message || e) };
    });
}

$('testBtn').addEventListener('click', function () {
  if (selfTest.running) return;
  runSelfTest();
});

// ── settings wiring ─────────────────────────────────────────────────────────

function fillPresets() {
  var sel = $('preset');
  sel.innerHTML = '';
  C.PRESETS.forEach(function (p) {
    var o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.label + ', ' + C.blockSizeFor(p.version, p.ecc) + ' B per frame';
    sel.appendChild(o);
  });
  sel.value = 'balanced';
}

function describePreset() {
  var p = C.presetById($('preset').value);
  var bs = C.blockSizeFor(p.version, p.ecc);
  var fps = parseInt($('fpsSlider').value, 10);
  var modules = C.moduleCountFor(p.version);
  $('presetSub').textContent = 'Version ' + p.version + ', ' + modules + ' modules across, ' +
    bs + ' bytes per frame, about ' + (bs * fps / 1024).toFixed(1) + ' KB/s at ' + fps + ' fps.';

  var msg = '';
  if (p.id === 'max') msg = 'Maximum density only decodes reliably with a browser that has a built-in barcode reader, which today means Chrome on Android.';
  else if (p.id === 'dense') msg = 'Dense codes need a good camera and a steady hand.';
  if (fps > 12) msg = (msg ? msg + ' ' : '') + 'Above 12 fps a phone camera captures fewer than half the codes cleanly.';
  warn(msg || (source ? sizeAdvice(source.originalSize) : ''));
}

$('preset').addEventListener('change', function () {
  describePreset();
  if (rawInput) rebuildPlan(); else refreshMetrics();
});
$('compressToggle').addEventListener('change', function () { if (rawInput) rebuildPlan(); });
$('fpsSlider').addEventListener('input', function () {
  $('fpsVal').textContent = this.value + ' fps';
  applyRate();
  describePreset();
  $('fpsHelp').textContent = player.running
    ? 'Showing ' + effectiveFps().toFixed(1) + ' fps on a ' + player.refreshHz + ' Hz screen.'
    : 'Lower is slower but far more reliable. 8 is a good starting point.';
  refreshMetrics();
});
$('sizeSlider').addEventListener('input', function () { $('sizeVal').textContent = this.value + ' px'; });
$('lossSlider').addEventListener('input', function () { $('lossVal').textContent = this.value + '%'; });
$('testSizeSlider').addEventListener('input', function () { $('testSizeVal').textContent = this.value + ' KB'; });

document.querySelectorAll('.ctrl-tab').forEach(function (t) {
  t.addEventListener('click', function () { showTab(t.dataset.tab); });
});

// ── boot ────────────────────────────────────────────────────────────────────

fillPresets();
if (window.SharedTooltip && SharedTooltip.init) SharedTooltip.init();
if (window.Persist && Persist.init) Persist.init('qrtransfer', { onRestore: function () { syncLabels(); } });

function syncLabels() {
  $('fpsVal').textContent = $('fpsSlider').value + ' fps';
  $('sizeVal').textContent = $('sizeSlider').value + ' px';
  $('lossVal').textContent = $('lossSlider').value + '%';
  $('testSizeVal').textContent = $('testSizeSlider').value + ' KB';
  $('fpsHelp').textContent = 'Lower is slower but far more reliable. 8 is a good starting point.';
  describePreset();
  refreshMetrics();
}
syncLabels();
showTab('send');

nativeAvailable().then(function (ok) {
  $('decSub').textContent = ok
    ? 'This browser has a built-in barcode reader, which is the fast path.'
    : 'This browser has no built-in barcode reader, so jsQR is used.';
});

// Test hook. Present in production but inert unless something calls it.
window.__QRT = {
  codec: C,
  runSelfTest: runSelfTest,
  state: function () {
    return {
      hasPlan: !!plan, K: plan ? plan.K : 0, blockSize: plan ? plan.blockSize : 0,
      n: plan ? plan.n : 0, version: plan ? plan.version : 0,
      broadcasting: player.running, framesShown: player.shown,
      receiverActive: receiver.active, activeTab: activeTab,
      warning: $('warnBanner').classList.contains('visible') ? $('warnBanner').textContent : ''
    };
  },
  setSourceBytes: setSourceBytes,
  showTab: showTab,
  startBroadcast: startBroadcast,
  stopBroadcast: stopBroadcast,
  frameStrings: function (count) {
    if (!plan) return [];
    var out = [C.encodeManifestFrame(plan)];
    for (var i = 0; i < count; i++) out.push(C.encodeDataFrame(plan, i));
    return out;
  }
};

})();
