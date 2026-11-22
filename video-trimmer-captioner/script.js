/* Video Trimmer and Captioner
   ─────────────────────────────────────────────────────────────────────────────
   The edit is a list of clips, each a stretch [a, b) of one source video, played
   one after another. Captions belong to the footage, not to the edit: each one
   is pinned to its source video in that video's own seconds. So a clip that is
   trimmed, deleted, duplicated or moved takes its captions with it, and the
   captions shown at a point of the edit are the ones whose footage is on
   screen there. The SRT / VTT the tool writes is that mapping, retimed.

   Nothing leaves the device. The preview plays the source <video> elements and
   draws the frame, the captions and the credit onto one canvas, the same way
   the export draws them. The export decodes each clip with Mediabunny
   (WebCodecs), redraws every frame on a fixed frame grid, and encodes MP4 or
   WebM in the browser, faster than real time on most machines.             */
(function () {
  'use strict';

  const MB_URL = 'https://cdn.jsdelivr.net/npm/mediabunny@1.65.0/dist/bundles/mediabunny.min.mjs';
  let MB = null;
  function loadMB() {
    if (MB) return Promise.resolve(MB);
    return import(MB_URL).then(m => (MB = m));
  }

  const $ = id => document.getElementById(id);
  const EPS = 1e-4;
  const MIN_CLIP = 0.05;          // shortest clip a split or trim may leave, seconds
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  const MIN_SPEED = 0.25, MAX_SPEED = 4;   // what browsers play with sound
  // A clip plays at its own speed (1 when it has none: older saved edits).
  const spd = c => (c && c.speed > 0 ? c.speed : 1);
  const outLen = c => (c.b - c.a) / spd(c);
  const SRC_VARS = ['--line-a', '--gold', '--line-c', '--line-d', '--line-e'];

  // ── State ────────────────────────────────────────────────────────────────
  const S = {
    sources: [],   // { id, name, size, file, el, duration, w, h, fps }
    clips: [],     // { id, src, a, b, speed }   seconds in the source; speed 1 is as filmed
    caps: [],      // { id, src, a, b, text }
    sel: null,     // selected clip id
    t: 0,          // playhead, seconds of the edit
    playing: false,
    cur: 0,        // index of the clip the player is in
    exporting: false,
    cancel: false,
    outUrl: null,
  };
  let nextId = 1;
  const uid = p => p + (nextId++);

  // ── Small helpers ────────────────────────────────────────────────────────
  function fmt(s, dp) {
    dp = dp == null ? 2 : dp;
    s = Math.max(0, s || 0);
    let m = Math.floor(s / 60);
    let sec = s - m * 60;
    let txt = sec.toFixed(dp);
    if (parseFloat(txt) >= 60) { m += 1; txt = (0).toFixed(dp); }
    const h = Math.floor(m / 60);
    const pad = txt.padStart(dp ? dp + 3 : 2, '0');
    return h ? h + ':' + String(m % 60).padStart(2, '0') + ':' + pad : m + ':' + pad;
  }
  // "1:02.5", "62.5", "0:01:02.500", "1:02,5" all read as seconds.
  function parseTime(str) {
    str = String(str || '').trim().replace(',', '.');
    if (!str) return NaN;
    if (!/^[0-9:.]+$/.test(str)) return NaN;
    const parts = str.split(':');
    if (parts.length > 3) return NaN;
    let s = 0;
    for (const p of parts) { if (p === '' || isNaN(+p)) return NaN; s = s * 60 + +p; }
    return s;
  }
  function fmtBytes(b) {
    if (b < 1024) return (b | 0) + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
    return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const srcOf = id => S.sources.find(s => s.id === id);
  function srcColour(id) {
    const i = Math.max(0, S.sources.findIndex(s => s.id === id));
    return 'var(' + SRC_VARS[i % SRC_VARS.length] + ')';
  }
  function setStatus(msg, type) {
    const el = $('statusMsg');
    el.textContent = msg;
    el.className = 'status-msg' + (type ? ' ' + type : '');
  }
  function setProgress(p) { $('progressFill').style.width = clamp(p, 0, 100) + '%'; }
  const isTyping = el => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

  // ── The edit as a timeline ───────────────────────────────────────────────
  let layoutCache = null, occCache = null;
  function invalidate() { layoutCache = null; occCache = null; }
  function layout() {
    if (layoutCache) return layoutCache;
    let t = 0;
    const rows = S.clips.map((c, i) => { const r = { c, i, start: t, end: t + outLen(c) }; t = r.end; return r; });
    return (layoutCache = { rows, total: t });
  }
  const total = () => layout().total;
  // Which clip a point of the edit falls in, and the matching source second.
  function locate(t) {
    const L = layout();
    if (!L.rows.length) return null;
    t = clamp(t, 0, L.total);
    for (const r of L.rows) if (t < r.end - EPS) return { i: r.i, c: r.c, start: r.start, srcT: Math.min(r.c.b, r.c.a + (t - r.start) * spd(r.c)) };
    const r = L.rows[L.rows.length - 1];
    return { i: r.i, c: r.c, start: r.start, srcT: r.c.b };
  }
  // Where each caption shows in the edit. A caption on footage used twice
  // shows twice; one cut in two by a split joins back up when the two halves
  // still play back to back.
  function occurrences() {
    if (occCache) return occCache;
    const out = [];
    for (const r of layout().rows) {
      const c = r.c;
      for (const cap of S.caps) {
        if (cap.src !== c.src) continue;
        const a = Math.max(cap.a, c.a), b = Math.min(cap.b, c.b);
        if (b - a <= EPS) continue;
        const s = r.start + (a - c.a) / spd(c), e = r.start + (b - c.a) / spd(c);
        const prev = out.length && out.filter(o => o.cap === cap).pop();
        if (prev && Math.abs(prev.e - s) < 1e-3) { prev.e = e; prev.lastI = r.i; continue; }
        out.push({ cap, s, e, i: r.i, lastI: r.i });
      }
    }
    out.sort((x, y) => x.s - y.s || x.e - y.e);
    return (occCache = out);
  }
  function captionAt(t) {
    const lines = [];
    for (const o of occurrences()) {
      if (o.s > t + EPS) break;
      if (t < o.e - EPS && o.cap.text.trim()) lines.push(o.cap.text.trim());
    }
    return lines.join('\n');
  }

  // ── Undo / redo ──────────────────────────────────────────────────────────
  const hist = { stack: [], pos: -1 };
  function snap() { return JSON.stringify({ clips: S.clips, caps: S.caps, sel: S.sel }); }
  function commit() {
    const s = snap();
    if (hist.stack[hist.pos] === s) return;
    hist.stack = hist.stack.slice(0, hist.pos + 1);
    hist.stack.push(s);
    if (hist.stack.length > 200) hist.stack.shift();
    hist.pos = hist.stack.length - 1;
    syncUndo();
    saveSoon();
  }
  function restoreSnap(s) {
    const o = JSON.parse(s);
    S.clips = o.clips; S.caps = o.caps; S.sel = o.sel;
    invalidate();
    S.t = clamp(S.t, 0, total());
    renderAll();
    seek(S.t);
    syncUndo();
    saveSoon();
  }
  function undo() { if (hist.pos > 0) { hist.pos--; restoreSnap(hist.stack[hist.pos]); } }
  function redo() { if (hist.pos < hist.stack.length - 1) { hist.pos++; restoreSnap(hist.stack[hist.pos]); } }
  function syncUndo() {
    $('undoBtn').disabled = hist.pos <= 0;
    $('redoBtn').disabled = hist.pos >= hist.stack.length - 1;
  }

  // ── Caption files ────────────────────────────────────────────────────────
  const TIME_RE = /((?:\d+:)?\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[,.]\d{1,3})/;
  function cueTime(s) {
    const m = s.replace(',', '.').match(/^(?:(\d+):)?(\d{1,2}):(\d{2})\.(\d{1,3})$/);
    if (!m) return NaN;
    return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0')) / 1000;
  }
  function decodeEntities(s) {
    return s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }
  function parseCaptions(text) {
    text = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const out = [];
    for (const block of text.split(/\n[ \t]*\n/)) {
      const lines = block.split('\n');
      const k = lines.findIndex(l => TIME_RE.test(l));
      if (k < 0) continue;
      const m = lines[k].match(TIME_RE);
      const a = cueTime(m[1]), b = cueTime(m[2]);
      const body = decodeEntities(lines.slice(k + 1).join('\n').replace(/<[^>]*>/g, '').replace(/\{\\[^}]*\}/g, '')).trim();
      if (!isFinite(a) || !isFinite(b) || b <= a || !body) continue;
      out.push({ a, b, text: body });
    }
    return out;
  }
  function cueStamp(s, sep) {
    const ms = Math.round(Math.max(0, s) * 1000);
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60, r = ms % 1000;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0') + sep + String(r).padStart(3, '0');
  }
  function captionCues() {
    return occurrences().filter(o => o.cap.text.trim()).map(o => ({ s: o.s, e: o.e, text: o.cap.text.trim() }));
  }
  function buildSRT() {
    return captionCues().map((c, i) => (i + 1) + '\n' + cueStamp(c.s, ',') + ' --> ' + cueStamp(c.e, ',') + '\n' + c.text + '\n').join('\n');
  }
  function buildVTT() {
    return 'WEBVTT\n\n' + captionCues().map(c => cueStamp(c.s, '.') + ' --> ' + cueStamp(c.e, '.') + '\n' + c.text.replace(/-->/g, '->') + '\n').join('\n');
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function baseName() {
    const n = S.sources.length ? S.sources[0].name : 'video';
    return n.replace(/\.[^.]+$/, '') + '-edited';
  }
  // Caption times in a file follow the source video they are added to.
  function addCaptionsFrom(text, srcId, replace) {
    const cues = parseCaptions(text);
    if (!cues.length) return 0;
    if (replace) S.caps = S.caps.filter(c => c.src !== srcId);
    for (const q of cues) S.caps.push({ id: uid('k'), src: srcId, a: q.a, b: q.b, text: q.text });
    invalidate();
    return cues.length;
  }

  // ── Loading videos ───────────────────────────────────────────────────────
  const isCaptionFile = f => /\.(srt|vtt)$/i.test(f.name) || f.type === 'text/vtt' || f.type === 'application/x-subrip';
  const isVideoFile = f => (f.type || '').startsWith('video/') || /\.(mp4|m4v|mov|webm|mkv|ogv)$/i.test(f.name);

  function makeVideoEl(url) {
    const v = document.createElement('video');
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    $('srcVideos').appendChild(v);
    return v;
  }
  function loadSource(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = makeVideoEl(url);
      const fail = () => { v.remove(); URL.revokeObjectURL(url); reject(new Error(file.name + ' could not be played in this browser.')); };
      v.addEventListener('error', fail, { once: true });
      v.addEventListener('loadedmetadata', () => {
        let dur = v.duration;
        if (!isFinite(dur)) dur = 0;
        const src = { id: uid('s'), name: file.name, size: file.size, file, url, el: v, duration: dur, w: v.videoWidth || 640, h: v.videoHeight || 360, fps: 0 };
        v.addEventListener('seeked', requestDraw);
        v.addEventListener('loadeddata', requestDraw);
        if (!isFinite(v.duration) || !v.duration) {
          // Some WebM files only learn their length once played to the end.
          v.currentTime = 1e9;
          v.addEventListener('durationchange', function once() {
            if (isFinite(v.duration) && v.duration) { v.removeEventListener('durationchange', once); src.duration = v.duration; v.currentTime = 0; resolve(src); }
          });
        } else resolve(src);
      }, { once: true });
    }).then(src => { S.sources.push(src); detectFps(src); return src; });
  }
  // The frame rate of a source, from Mediabunny, for "Same as the video".
  function detectFps(src) {
    loadMB().then(async mb => {
      const input = new mb.Input({ source: new mb.BlobSource(src.file), formats: mb.ALL_FORMATS });
      const vt = await input.getPrimaryVideoTrack();
      if (!vt) return;
      const st = await vt.computePacketStats(120);
      if (st && st.averagePacketRate > 1) { src.fps = st.averagePacketRate; renderMetrics(); }
    }).catch(() => {});
  }

  async function openFiles(files, mode) {
    files = Array.from(files || []);
    const vids = files.filter(isVideoFile);
    const caps = files.filter(isCaptionFile);
    if (mode === 'new' && !vids.length) {
      if (caps.length) { pendingCaption = caps[0]; showCapChip(); return; }
      alert('Please choose a video file.');
      return;
    }
    pause();
    try {
      if (mode === 'new') resetProject();
      const added = [];
      for (const f of vids) {
        setStatus('Opening ' + f.name + '…');
        added.push(await loadSource(f));
      }
      for (const src of added) S.clips.push({ id: uid('c'), src: src.id, a: 0, b: src.duration });
      let capCount = 0;
      const capFile = caps[0] || (mode === 'new' ? pendingCaption : null);
      const target = added[0] || (selectedClip() && srcOf(selectedClip().src)) || S.sources[0];
      if (capFile && target) capCount = addCaptionsFrom(await capFile.text(), target.id, false);
      pendingCaption = null; showCapChip();
      if (mode === 'new') {
        S.sel = S.clips.length ? S.clips[0].id : null;
        S.t = 0;
        $('dropZone').style.display = 'none';
        $('workspace').classList.add('active');
        const restored = !capFile && added.length === 1 && maybeRestore(added[0]);
        hist.stack = []; hist.pos = -1;
        if (restored) { const fresh = restored.fresh; hist.stack.push(fresh); hist.pos = 0; }
        invalidate();
        commit();
        renderAll();
        sizeStage();
        seek(0);
        if (restored) setStatus('Your last edit of this video is back. Undo starts it fresh.', 'ok');
        else setStatus(capCount ? 'Ready, with ' + capCount + ' captions. Split, trim or reorder the clips, then export.' : 'Ready. Split, trim or reorder the clips, then export.');
      } else {
        invalidate();
        commit();
        renderAll();
        if (added.length) setStatus('Added ' + added.map(s => s.name).join(', ') + ' to the end of the edit.', 'ok');
        if (capCount) setStatus('Opened ' + capCount + ' captions for ' + target.name + '.', 'ok');
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || String(err), 'err');
      if (mode === 'new' && !S.clips.length) alert(err.message || String(err));
    }
  }
  function resetProject() {
    for (const s of S.sources) { s.el.remove(); URL.revokeObjectURL(s.url); }
    S.sources = []; S.clips = []; S.caps = []; S.sel = null; S.t = 0; S.cur = 0;
    clearOutput();
    invalidate();
  }

  // Drop zone: a video, a caption file, or both at once.
  let pendingCaption = null;
  function showCapChip() {
    const chip = $('capChip');
    chip.hidden = !pendingCaption;
    chip.textContent = pendingCaption ? 'Captions ready: ' + pendingCaption.name : '';
  }
  const dz = $('dropZone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); openFiles(e.dataTransfer.files, 'new'); });
  $('fileInput').addEventListener('change', e => { openFiles(e.target.files, 'new'); e.target.value = ''; });
  function pickFiles(accept, multiple, cb) {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = accept; fi.multiple = !!multiple;
    fi.onchange = () => cb(fi.files);
    fi.click();
  }
  $('capPickBtn').addEventListener('click', e => {
    e.stopPropagation();
    pickFiles('.srt,.vtt,text/vtt', false, files => { if (files[0]) { pendingCaption = files[0]; showCapChip(); } });
  });
  // The sample: 12 s with sound in three coloured parts, and its captions.
  const SAMPLE = document.createElement('video').canPlayType('video/mp4; codecs="avc1.4d401e"')
    ? { url: 'sample.mp4', type: 'video/mp4' } : { url: 'sample.webm', type: 'video/webm' };
  $('sampleBtn').addEventListener('click', async e => {
    e.stopPropagation();
    const btn = $('sampleBtn'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Loading sample…';
    try {
      const [vr, cr] = await Promise.all([fetch(SAMPLE.url), fetch('sample.srt')]);
      if (!vr.ok || !cr.ok) throw new Error('HTTP ' + (vr.ok ? cr.status : vr.status));
      const files = [new File([await vr.blob()], SAMPLE.url, { type: SAMPLE.type }), new File([await cr.text()], 'sample.srt', { type: 'application/x-subrip' })];
      await openFiles(files, 'new');
    } catch (err) {
      alert('Could not load the sample video (' + err.message + ').');
    } finally { btn.disabled = false; btn.textContent = label; }
  });
  $('loadBtn').addEventListener('click', () => {
    if (hist.pos > 0 && !confirm('Open another video and start a new edit? This edit stays in this browser only for the video it was made on.')) return;
    pickFiles('video/*,.srt,.vtt', true, files => openFiles(files, 'new'));
  });
  $('addVideoBtn').addEventListener('click', () => pickFiles('video/*', true, files => openFiles(files, 'add')));
  $('openCapBtn').addEventListener('click', () => pickFiles('.srt,.vtt,text/vtt', false, async files => {
    if (!files[0]) return;
    const c = selectedClip() || S.clips[0];
    if (!c) return;
    const src = srcOf(c.src);
    const had = S.caps.some(k => k.src === src.id);
    if (had && !confirm('Replace the captions of ' + src.name + ' with this file? (Undo brings them back.)')) return;
    const n = addCaptionsFrom(await files[0].text(), src.id, true);
    if (!n) { setStatus('No captions found in ' + files[0].name + '. Is it an SRT or VTT file?', 'err'); return; }
    commit(); renderAll(); requestDraw();
    setStatus('Opened ' + n + ' captions for ' + src.name + '.', 'ok');
  }));

  // ── Remembering the edit (the mini cache) ────────────────────────────────
  // The video itself cannot be kept, so the edit is kept against the file it
  // was made on (name, size, length) and comes back when that file is opened.
  let persist = null, saveTimer = null;
  let savedProject = null;
  const fingerprint = s => [s.name, s.size, Math.round(s.duration * 100) / 100];
  function projectBlob() {
    if (S.sources.length !== 1 || !S.clips.length) return savedProject;
    const s = S.sources[0];
    return {
      fp: fingerprint(s),
      clips: S.clips.map(c => (spd(c) === 1 ? [c.a, c.b] : [c.a, c.b, spd(c)])),
      caps: S.caps.map(c => [c.a, c.b, c.text]),
    };
  }
  function saveSoon() { if (persist) persist.schedule(); }
  function maybeRestore(src) {
    const p = savedProject;
    if (!p || !Array.isArray(p.fp) || JSON.stringify(p.fp) !== JSON.stringify(fingerprint(src))) return null;
    if (!Array.isArray(p.clips) || !p.clips.length) return null;
    const fresh = snap();
    const clips = [];
    for (const r of p.clips) {
      const a = clamp(+r[0] || 0, 0, src.duration), b = clamp(+r[1] || 0, 0, src.duration);
      const sp = clamp(+r[2] || 1, MIN_SPEED, MAX_SPEED);
      if (b - a >= MIN_CLIP) clips.push({ id: uid('c'), src: src.id, a, b, speed: sp });
    }
    if (!clips.length) return null;
    S.clips = clips;
    S.caps = (p.caps || []).filter(r => Array.isArray(r) && isFinite(+r[0]) && +r[1] > +r[0])
      .map(r => ({ id: uid('k'), src: src.id, a: +r[0], b: +r[1], text: String(r[2] || '') }));
    S.sel = clips[0].id;
    return { fresh };
  }

  // ── Clip operations ──────────────────────────────────────────────────────
  const selectedClip = () => S.clips.find(c => c.id === S.sel) || null;
  function selectClip(id, andSeek) {
    S.sel = id;
    renderClips(); renderSeq(); renderTrim();
    if (andSeek) {
      const r = layout().rows.find(r => r.c.id === id);
      if (r && (S.t < r.start - EPS || S.t >= r.end - EPS)) seek(r.start);
    }
  }
  function splitAtPlayhead() {
    const loc = locate(S.t);
    if (!loc) return;
    const c = loc.c;
    if (loc.srcT - c.a < MIN_CLIP || c.b - loc.srcT < MIN_CLIP) { setStatus('Move the playhead inside a clip, away from its ends, to split it.', 'err'); return; }
    const right = { id: uid('c'), src: c.src, a: loc.srcT, b: c.b, speed: spd(c) };
    c.b = loc.srcT;
    S.clips.splice(loc.i + 1, 0, right);
    S.sel = right.id;
    invalidate(); commit(); renderAll(); seek(S.t);
    setStatus('Split into clips ' + (loc.i + 1) + ' and ' + (loc.i + 2) + '.', 'ok');
  }
  function deleteClip(id) {
    const i = S.clips.findIndex(c => c.id === id);
    if (i < 0) return;
    if (S.clips.length === 1) { setStatus('An edit needs at least one clip. Trim this one, or open another video.', 'err'); return; }
    const r = layout().rows[i];
    const tAfter = S.t >= r.end ? S.t - (r.end - r.start) : Math.min(S.t, r.start);
    S.clips.splice(i, 1);
    S.sel = S.clips[Math.min(i, S.clips.length - 1)].id;
    invalidate(); commit(); renderAll(); seek(tAfter);
    setStatus('Clip ' + (i + 1) + ' removed. Undo brings it back.', 'ok');
  }
  function duplicateClip(id) {
    const i = S.clips.findIndex(c => c.id === id);
    if (i < 0) return;
    const c = S.clips[i];
    const copy = { id: uid('c'), src: c.src, a: c.a, b: c.b, speed: spd(c) };
    S.clips.splice(i + 1, 0, copy);
    S.sel = copy.id;
    invalidate(); commit(); renderAll(); seek(layout().rows[i + 1].start);
  }
  function moveClip(from, to) {
    if (to < 0 || to >= S.clips.length || from === to) return;
    const [c] = S.clips.splice(from, 1);
    S.clips.splice(to, 0, c);
    S.sel = c.id;
    invalidate(); commit(); renderAll();
    seek(layout().rows[to].start);
  }
  // Trim the selected clip so it starts (or ends) at the playhead's frame.
  function trimToPlayhead(which) {
    const loc = locate(S.t);
    if (!loc) return;
    const c = loc.c;
    if (which === 'in') {
      if (c.b - loc.srcT < MIN_CLIP) return;
      c.a = loc.srcT;
    } else {
      if (loc.srcT - c.a < MIN_CLIP) return;
      c.b = loc.srcT;
    }
    S.sel = c.id;
    invalidate(); commit(); renderAll();
    seek(which === 'in' ? layout().rows[loc.i].start : Math.max(0, layout().rows[loc.i].end - 0.001));
  }
  // Speed as a multiplier: 2 plays the clip in half the time. Captions on it
  // speed up with it, as they belong to the footage.
  function setClipSpeed(c, x) {
    x = clamp(Math.round(x * 1000) / 1000, MIN_SPEED, MAX_SPEED);
    if (!isFinite(x)) return;
    c.speed = x;
    S.sel = c.id;
    invalidate(); commit(); renderAll();
    const r = layout().rows.find(r => r.c.id === c.id);
    if (r) seek(r.start);
    if (x !== 1) setStatus('Clip ' + (r.i + 1) + ' plays at ' + fmtSpeed(x) + ', ' + fmt(outLen(c)) + ' long.', 'ok');
  }
  function setClipTime(c, which, v) {
    const src = srcOf(c.src);
    if (which === 'a') c.a = clamp(v, 0, c.b - MIN_CLIP);
    else c.b = clamp(v, c.a + MIN_CLIP, src.duration);
  }

  // ── Caption operations ───────────────────────────────────────────────────
  function addCaptionAtPlayhead() {
    const loc = locate(S.t);
    if (!loc) return;
    const src = srcOf(loc.c.src);
    let a = loc.srcT;
    const k = spd(loc.c);
    let b = Math.min(a + 2 * k, loc.c.b);
    if (b - a < 0.5 * k) { a = Math.max(loc.c.a, loc.c.b - 2 * k); b = loc.c.b; }
    const cap = { id: uid('k'), src: src.id, a, b, text: '' };
    S.caps.push(cap);
    invalidate(); commit();
    showTab('captions');
    renderCaptions(); renderSeq(); requestDraw();
    const ta = document.querySelector('.cap-row[data-cap="' + cap.id + '"] .cap-text');
    if (ta) { ta.focus(); ta.scrollIntoView({ block: 'nearest' }); }
  }
  // An edited caption time is read in the edit's seconds and pinned back
  // onto the footage of the clip it starts (or ends) in.
  function setCapTime(occ, which, t) {
    const L = layout();
    const row = L.rows[which === 's' ? occ.i : occ.lastI];
    const src = srcOf(occ.cap.src);
    const srcT = clamp(row.c.a + (t - row.start) * spd(row.c), 0, src.duration);
    if (which === 's') occ.cap.a = Math.min(srcT, occ.cap.b - 0.05);
    else occ.cap.b = Math.max(srcT, occ.cap.a + 0.05);
    invalidate();
  }

  // ── Rendering the side panel ─────────────────────────────────────────────
  function renderAll() {
    invalidate();
    renderClips(); renderSeq(); renderTrim(); renderCaptions(); renderMetrics(); updatePlayhead(); requestDraw();
  }
  function renderClips() {
    const list = $('clipList');
    const L = layout();
    list.innerHTML = L.rows.map(r => {
      const c = r.c, src = srcOf(c.src);
      const multi = S.sources.length > 1;
      return '<div class="clip-row' + (c.id === S.sel ? ' sel' : '') + '" data-clip="' + c.id + '">' +
        '<span class="clip-grip" title="Drag to change the order" aria-label="Drag to change the order">⠿</span>' +
        '<span class="clip-swatch" style="background:' + srcColour(c.src) + '"></span>' +
        '<span class="clip-name">Clip ' + (r.i + 1) + (multi ? '<small>' + esc(src.name) + '</small>' : '') + '</span>' +
        '<span class="clip-acts">' +
          SharedIcon.button('duplicate', 'Duplicate clip ' + (r.i + 1), 'sm clip-dup') +
          SharedIcon.button('trash', 'Remove clip ' + (r.i + 1), 'sm clip-del', S.clips.length < 2 ? 'disabled' : '') +
        '</span>' +
        '<span class="clip-times">' +
          '<label>From <input class="time-input" data-k="a" value="' + fmt(c.a, 3) + '" aria-label="Clip ' + (r.i + 1) + ' starts at"></label>' +
          '<label>to <input class="time-input" data-k="b" value="' + fmt(c.b, 3) + '" aria-label="Clip ' + (r.i + 1) + ' ends at"></label>' +
        '</span>' +
        '<span class="clip-times clip-speed">' +
          '<label>Speed <select class="sel-sm speed-sel" data-k="speed" aria-label="Clip ' + (r.i + 1) + ' speed">' + speedOptions(spd(c)) + '</select></label>' +
          '<label>Length <input class="time-input" data-k="len" value="' + fmt(outLen(c), 2) + '" aria-label="Clip ' + (r.i + 1) + ' plays for" title="Type the length you want and the speed follows"></label>' +
        '</span></div>';
    }).join('');
    const kept = L.total, full = S.sources.reduce((s, x) => s + x.duration, 0);
    $('clipTotal').textContent = S.clips.length + (S.clips.length === 1 ? ' clip, ' : ' clips, ') + fmt(kept) + ' in all' +
      (S.sources.length ? ' (the ' + (S.sources.length > 1 ? 'videos run ' : 'video runs ') + fmt(full) + ').' : '.');
  }
  const fmtSpeed = x => (Math.round(x * 100) / 100) + '×';
  function speedOptions(cur) {
    const list = SPEEDS.slice();
    if (!list.some(x => Math.abs(x - cur) < 1e-6)) { list.push(cur); list.sort((a, b) => a - b); }
    return list.map(x => '<option value="' + x + '"' + (Math.abs(x - cur) < 1e-6 ? ' selected' : '') + '>' +
      fmtSpeed(x) + '</option>').join('');
  }
  const clipList = $('clipList');
  clipList.addEventListener('click', e => {
    const row = e.target.closest('.clip-row');
    if (!row) return;
    const id = row.dataset.clip;
    if (e.target.closest('.clip-del')) { deleteClip(id); return; }
    if (e.target.closest('.clip-dup')) { duplicateClip(id); return; }
    if (e.target.closest('input, select')) { if (S.sel !== id) selectClip(id, true); return; }
    selectClip(id, true);
  });
  clipList.addEventListener('change', e => {
    const sel = e.target.closest('.speed-sel');
    if (sel) {
      const c = S.clips.find(c => c.id === sel.closest('.clip-row').dataset.clip);
      if (!c) return;
      setClipSpeed(c, +sel.value);
      return;
    }
    const inp = e.target.closest('.time-input');
    if (!inp) return;
    const c = S.clips.find(c => c.id === inp.closest('.clip-row').dataset.clip);
    if (inp.dataset.k === 'len') {
      const want = parseTime(inp.value);
      if (!c || !isFinite(want) || want <= 0) { inp.classList.add('bad'); return; }
      const raw = (c.b - c.a) / want;
      setClipSpeed(c, raw);
      if (raw < MIN_SPEED || raw > MAX_SPEED) setStatus('Clip speed goes from ' + MIN_SPEED + '× to ' + MAX_SPEED + '×, so this clip now plays for ' + fmt(outLen(c)) + '. Trim it to make it shorter.', 'err');
      return;
    }
    const v = parseTime(inp.value);
    if (!c || !isFinite(v)) { inp.classList.add('bad'); return; }
    setClipTime(c, inp.dataset.k, v);
    invalidate(); commit(); renderAll();
    const r = layout().rows.find(r => r.c.id === c.id);
    seek(inp.dataset.k === 'a' ? r.start : Math.max(r.start, r.end - 0.001));
  });
  clipList.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.time-input')) e.target.blur(); });

  // Reorder by dragging the grip.
  (function () {
    let drag = null;
    clipList.addEventListener('pointerdown', e => {
      const grip = e.target.closest('.clip-grip');
      if (!grip) return;
      e.preventDefault();
      const row = grip.closest('.clip-row');
      drag = { row, from: [...clipList.children].indexOf(row), to: -1 };
      row.classList.add('dragging');
      grip.setPointerCapture(e.pointerId);
    });
    clipList.addEventListener('pointermove', e => {
      if (!drag) return;
      const rows = [...clipList.children];
      rows.forEach(r => r.classList.remove('drop-before', 'drop-after'));
      let to = rows.length;
      for (let i = 0; i < rows.length; i++) {
        const b = rows[i].getBoundingClientRect();
        if (e.clientY < b.top + b.height / 2) { to = i; break; }
      }
      drag.to = to;
      if (to < rows.length) rows[to].classList.add('drop-before'); else rows[rows.length - 1].classList.add('drop-after');
    });
    const end = () => {
      if (!drag) return;
      const { from, to, row } = drag;
      drag = null;
      row.classList.remove('dragging');
      [...clipList.children].forEach(r => r.classList.remove('drop-before', 'drop-after'));
      if (to < 0) return;
      const dest = to > from ? to - 1 : to;
      if (dest !== from) moveClip(from, dest);
    };
    clipList.addEventListener('pointerup', end);
    clipList.addEventListener('pointercancel', end);
  })();

  function renderCaptions() {
    const occ = occurrences();
    const list = $('capList');
    const focused = document.activeElement && list.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused ? (focused.closest('.cap-row').dataset.cap + '|' + (focused.dataset.k || 'text')) : null;
    const caret = focused && focused.tagName === 'TEXTAREA' ? [focused.selectionStart, focused.selectionEnd] : null;
    list.innerHTML = occ.map((o, n) =>
      '<div class="cap-row" data-cap="' + o.cap.id + '" data-n="' + n + '">' +
        '<div class="cap-head">' +
          '<input class="time-input" data-k="s" value="' + fmt(o.s, 3) + '" aria-label="Caption starts at">' +
          '<span class="arrow">→</span>' +
          '<input class="time-input" data-k="e" value="' + fmt(o.e, 3) + '" aria-label="Caption ends at">' +
          '<button type="button" class="btn-bare sm seek" title="Play from here" aria-label="Play from this caption">▶</button>' +
          SharedIcon.button('trash', 'Remove this caption', 'sm cap-del') +
        '</div>' +
        '<textarea class="cap-text" rows="2" placeholder="Type the caption" aria-label="Caption text">' + esc(o.cap.text) + '</textarea>' +
      '</div>').join('');
    $('capEmpty').style.display = occ.length ? 'none' : '';
    const hidden = S.caps.length - new Set(occ.map(o => o.cap)).size;
    $('capEmpty').textContent = occ.length ? '' : (hidden ? 'All ' + hidden + ' captions sit in parts that are cut out. Undo or widen a clip to bring them back.' : '');
    if (!occ.length && !hidden) $('capEmpty').innerHTML = 'No captions yet. Open an SRT or VTT file, or press <b>+ Add caption</b> at the moment someone starts speaking.';
    if (focusKey) {
      const [id, k] = focusKey.split('|');
      const row = list.querySelector('.cap-row[data-cap="' + id + '"]');
      const el = row && (k === 'text' ? row.querySelector('.cap-text') : row.querySelector('[data-k="' + k + '"]'));
      if (el) { el.focus(); if (caret && el.setSelectionRange) el.setSelectionRange(caret[0], caret[1]); }
    }
    liveCapId = null;
    markLiveCaption();
  }
  const capList = $('capList');
  const occOf = row => occurrences()[+row.dataset.n];
  capList.addEventListener('click', e => {
    const row = e.target.closest('.cap-row');
    if (!row) return;
    const o = occOf(row);
    if (!o) return;
    if (e.target.closest('.cap-del')) {
      S.caps = S.caps.filter(c => c !== o.cap);
      invalidate(); commit(); renderCaptions(); renderSeq(); requestDraw();
      return;
    }
    if (e.target.closest('.seek')) { seek(o.s); play(); return; }
    if (!e.target.closest('input, textarea')) seek(o.s);
  });
  capList.addEventListener('focusin', e => {
    const row = e.target.closest('.cap-row');
    const o = row && occOf(row);
    if (o && (S.t < o.s - EPS || S.t >= o.e - EPS)) { pause(); seek(o.s); }
  });
  capList.addEventListener('input', e => {
    if (!e.target.matches('.cap-text')) return;
    const o = occOf(e.target.closest('.cap-row'));
    if (!o) return;
    o.cap.text = e.target.value;
    requestDraw();
    saveSoon();
  });
  capList.addEventListener('change', e => {
    const row = e.target.closest('.cap-row');
    const o = row && occOf(row);
    if (!o) return;
    if (e.target.matches('.cap-text')) { commit(); return; }
    if (e.target.matches('.time-input')) {
      const v = parseTime(e.target.value);
      if (!isFinite(v)) { e.target.classList.add('bad'); return; }
      setCapTime(o, e.target.dataset.k, clamp(v, 0, total()));
      commit(); renderCaptions(); renderSeq(); requestDraw();
    }
  });
  capList.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.time-input')) e.target.blur(); });

  let liveCapId = null;
  function markLiveCaption() {
    const occ = occurrences();
    let live = null;
    for (const o of occ) { if (o.s > S.t + EPS) break; if (S.t < o.e - EPS) live = o; }
    const id = live ? live.cap.id : null;
    if (id === liveCapId) return;
    liveCapId = id;
    capList.querySelectorAll('.cap-row.live').forEach(r => r.classList.remove('live'));
    $('seqCaps').querySelectorAll('.seq-cap.live').forEach(r => r.classList.remove('live'));
    if (!id) return;
    const row = capList.querySelector('.cap-row[data-cap="' + id + '"]');
    if (row) {
      row.classList.add('live');
      if (S.playing && !capList.contains(document.activeElement)) {
        const lb = capList.getBoundingClientRect(), rb = row.getBoundingClientRect();
        if (rb.top < lb.top || rb.bottom > lb.bottom) capList.scrollTop += rb.top - lb.top - 8;
      }
    }
    $('seqCaps').querySelectorAll('.seq-cap[data-cap="' + id + '"]').forEach(r => r.classList.add('live'));
  }

  $('addCapBtn').addEventListener('click', addCaptionAtPlayhead);
  $('srtBtn').addEventListener('click', () => {
    if (!captionCues().length) { setStatus('There are no captions in the edit to save.', 'err'); return; }
    download(new Blob([buildSRT()], { type: 'application/x-subrip' }), baseName() + '.srt');
  });
  $('vttBtn').addEventListener('click', () => {
    if (!captionCues().length) { setStatus('There are no captions in the edit to save.', 'err'); return; }
    download(new Blob([buildVTT()], { type: 'text/vtt' }), baseName() + '.vtt');
  });
  $('clearCapsBtn').addEventListener('click', () => {
    if (!S.caps.length) return;
    if (!confirm('Remove every caption? (Undo brings them back.)')) return;
    S.caps = [];
    invalidate(); commit(); renderCaptions(); renderSeq(); requestDraw();
  });
  $('shiftBtn').addEventListener('click', () => {
    const d = parseFloat($('shiftBy').value);
    if (!isFinite(d) || !d || !S.caps.length) return;
    for (const c of S.caps) { c.a += d; c.b += d; }
    S.caps = S.caps.filter(c => c.b > 0.05);
    for (const c of S.caps) c.a = Math.max(0, c.a);
    invalidate(); commit(); renderCaptions(); renderSeq(); requestDraw();
    setStatus('Every caption moved ' + (d > 0 ? 'later' : 'earlier') + ' by ' + Math.abs(d) + ' s.', 'ok');
  });

  // ── Timelines ────────────────────────────────────────────────────────────
  function renderSeq() {
    const L = layout(), T = L.total || 1;
    $('seqClips').innerHTML = L.rows.map(r =>
      '<div class="seq-clip' + (r.c.id === S.sel ? ' sel' : '') + '" data-clip="' + r.c.id + '" style="left:' + (r.start / T * 100) + '%;width:' + ((r.end - r.start) / T * 100) + '%;background:' + srcColour(r.c.src) + '" title="Clip ' + (r.i + 1) + ', ' + (r.end - r.start).toFixed(2) + ' s">' +
        '<span>' + (r.i + 1) + '</span><span class="sc-dur">' + (r.end - r.start).toFixed(1) + 's' + (spd(r.c) !== 1 ? ' · ' + fmtSpeed(spd(r.c)) : '') + '</span></div>').join('');
    $('seqCaps').innerHTML = occurrences().map(o =>
      '<div class="seq-cap" data-cap="' + o.cap.id + '" style="left:' + (o.s / T * 100) + '%;width:' + Math.max(0.3, (o.e - o.s) / T * 100) + '%"></div>').join('');
    $('seqInfo').textContent = S.clips.length + (S.clips.length === 1 ? ' clip · ' : ' clips · ') + fmt(L.total) +
      (S.caps.length ? ' · ' + occurrences().length + ' captions' : '');
    liveCapId = null;
    markLiveCaption();
  }
  function renderTrim() {
    const c = selectedClip();
    const i = S.clips.indexOf(c);
    if (!c) return;
    const src = srcOf(c.src), D = src.duration || 1;
    $('tlRegion').style.left = (c.a / D * 100) + '%';
    $('tlRegion').style.width = ((c.b - c.a) / D * 100) + '%';
    $('handleIn').style.left = (c.a / D * 100) + '%';
    $('handleOut').style.left = (c.b / D * 100) + '%';
    $('trimTitle').textContent = 'Trim clip ' + (i + 1);
    $('trimInfo').textContent = fmt(c.a) + ' to ' + fmt(c.b) + ' of ' + (S.sources.length > 1 ? src.name + ' (' + fmt(D) + ')' : fmt(D)) +
      (spd(c) !== 1 ? ' · plays at ' + fmtSpeed(spd(c)) + ', ' + fmt(outLen(c)) : '');
    updatePlayhead();
  }
  function updatePlayhead() {
    const T = total();
    $('seqHead').style.left = (T ? S.t / T * 100 : 0) + '%';
    $('timecodeDisp').innerHTML = fmt(S.t) + ' <em>/</em> ' + fmt(T);
    const loc = locate(S.t), c = selectedClip();
    const th = $('trimHead');
    if (loc && c && loc.c.src === c.src) {
      th.style.display = '';
      th.style.left = (loc.srcT / (srcOf(c.src).duration || 1) * 100) + '%';
    } else th.style.display = 'none';
    markLiveCaption();
  }

  // Seek by clicking or dragging on the edit.
  function pointerTime(e, bar) {
    const r = bar.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width, 0, 1);
  }
  (function () {
    const bar = $('seqBar');
    let dragging = false, wasPlaying = false;
    bar.addEventListener('pointerdown', e => {
      dragging = true; wasPlaying = S.playing; pause();
      bar.setPointerCapture(e.pointerId);
      const t = pointerTime(e, bar) * total();
      const loc = locate(t);
      if (loc && loc.c.id !== S.sel) { S.sel = loc.c.id; renderClips(); renderSeq(); renderTrim(); }
      seek(t);
    });
    bar.addEventListener('pointermove', e => {
      if (!dragging) return;
      const t = pointerTime(e, bar) * total();
      const loc = locate(t);
      if (loc && loc.c.id !== S.sel) { S.sel = loc.c.id; renderClips(); renderSeq(); renderTrim(); }
      seek(t);
    });
    const up = () => { if (dragging) { dragging = false; if (wasPlaying) play(); } };
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  })();

  // The trim bar: the whole source of the selected clip, with its two ends.
  (function () {
    const bar = $('trimBar');
    let mode = null;   // 'in' | 'out' | 'seek'
    function apply(e) {
      const c = selectedClip();
      if (!c) return;
      const D = srcOf(c.src).duration;
      const v = pointerTime(e, bar) * D;
      const i = S.clips.indexOf(c);
      if (mode === 'in') { setClipTime(c, 'a', v); invalidate(); renderSeq(); renderTrim(); seek(layout().rows[i].start); }
      else if (mode === 'out') { setClipTime(c, 'b', v); invalidate(); renderSeq(); renderTrim(); seek(Math.max(layout().rows[i].start, layout().rows[i].end - 0.001)); }
      else {
        const r = layout().rows[i];
        seek(r.start + (clamp(v, c.a, c.b - 0.001) - c.a) / spd(c));
      }
    }
    bar.addEventListener('pointerdown', e => {
      if (!selectedClip()) return;
      pause();
      mode = e.target === $('handleIn') ? 'in' : e.target === $('handleOut') ? 'out' : 'seek';
      bar.setPointerCapture(e.pointerId);
      apply(e);
    });
    bar.addEventListener('pointermove', e => { if (mode) apply(e); });
    const up = () => {
      if (!mode) return;
      const was = mode; mode = null;
      if (was !== 'seek') { invalidate(); commit(); renderAll(); }
    };
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  })();

  // ── Player ───────────────────────────────────────────────────────────────
  const stage = $('stage');
  const sctx = stage.getContext('2d');
  function sizeStage() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (stage.width !== w || stage.height !== h) { stage.width = w; stage.height = h; }
    requestDraw();
  }
  if (window.ResizeObserver) new ResizeObserver(sizeStage).observe($('videoArea'));
  // The workspace fills the window under the header (style.css reads --hdr-h).
  const hdr = document.querySelector('.header');
  const setHdr = () => document.documentElement.style.setProperty('--hdr-h', hdr.offsetHeight + 'px');
  setHdr();
  if (window.ResizeObserver) new ResizeObserver(setHdr).observe(hdr);
  window.addEventListener('resize', sizeStage);

  let drawQueued = false;
  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; drawStage(); });
  }
  function drawStage() {
    const W = stage.width, H = stage.height;
    sctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--stage-bg') || '#000';
    sctx.fillRect(0, 0, W, H);
    if (!S.clips.length) return;
    const out = outDims();
    const sc = Math.min(W / out.w, H / out.h);
    const fw = out.w * sc, fh = out.h * sc, fx = (W - fw) / 2, fy = (H - fh) / 2;
    sctx.fillStyle = '#000';
    sctx.fillRect(fx, fy, fw, fh);
    const loc = locate(S.t);
    if (loc) {
      const v = srcOf(loc.c.src).el;
      if (v.readyState >= 2 && v.videoWidth) drawContain(sctx, v, v.videoWidth, v.videoHeight, fx, fy, fw, fh);
    }
    const st = capStyle();
    if ($('capMode').value === 'burn' || $('capMode').value === 'track') drawCaption(sctx, captionAt(S.t), st, fx, fy, fw, fh);
    if ($('creditCheck').checked) drawCredit(sctx, fx, fy, fw, fh);
  }
  function drawContain(ctx, img, iw, ih, x, y, w, h) {
    const s = Math.min(w / iw, h / ih);
    const dw = iw * s, dh = ih * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  // Captions are drawn the same way in the preview and the export.
  function capStyle() {
    return {
      size: parseFloat($('capSize').value) || 5.5,
      pos: $('capPos').value,
      look: $('capLook').value,
      colour: $('capColour').value === 'yellow' ? '#FFE14D' : '#FFFFFF',
    };
  }
  function wrapLines(ctx, text, maxW) {
    const out = [];
    for (const para of text.split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (line && ctx.measureText(test).width > maxW) { out.push(line); line = w; }
        else line = test;
      }
      if (line) out.push(line);
    }
    return out;
  }
  function drawCaption(ctx, text, st, x, y, w, h) {
    if (!text) return;
    const fs = Math.max(8, h * st.size / 100);
    ctx.save();
    ctx.font = '600 ' + fs + 'px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapLines(ctx, text, w * 0.88);
    const lh = fs * 1.28, pad = fs * 0.4, margin = h * 0.06;
    const blockH = lines.length * lh;
    const top = st.pos === 'top' ? y + margin : y + h - margin - blockH;
    const cx = x + w / 2;
    lines.forEach((ln, i) => {
      const ly = top + i * lh + lh / 2;
      if (st.look === 'box') {
        const tw = ctx.measureText(ln).width;
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        const bx = cx - tw / 2 - pad, by = ly - lh / 2, bw = tw + pad * 2;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, lh, fs * 0.18); ctx.fill(); }
        else ctx.fillRect(bx, by, bw, lh);
      } else {
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2, fs * 0.18);
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeText(ln, cx, ly);
      }
      ctx.fillStyle = st.colour;
      ctx.fillText(ln, cx, ly);
    });
    ctx.restore();
  }
  const WM_TEXT = 'Edited at tool.adjiebrotots.com';
  function drawCredit(ctx, x, y, w, h) {
    const fs = Math.max(9, Math.floor(h * 0.026));
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.font = '500 ' + fs + 'px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.lineWidth = Math.max(1.5, fs * 0.14);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(WM_TEXT, x + w - fs * 0.6, y + fs * 0.5);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(WM_TEXT, x + w - fs * 0.6, y + fs * 0.5);
    ctx.restore();
  }

  // Move the playhead. Shows the clip's source video at the right second.
  function seek(t) {
    const L = layout();
    S.t = clamp(t, 0, L.total);
    const loc = locate(S.t);
    if (!loc) return;
    S.cur = loc.i;
    const v = srcOf(loc.c.src).el;
    for (const s of S.sources) if (s.el !== v && !s.el.paused) s.el.pause();
    if (Math.abs(v.currentTime - loc.srcT) > 0.001) v.currentTime = Math.min(loc.srcT, Math.max(0, srcOf(loc.c.src).duration - 0.001));
    updatePlayhead();
    requestDraw();
  }
  function play() {
    if (!S.clips.length || S.exporting) return;
    if (S.t >= total() - 0.02) seek(0);
    S.playing = true;
    $('playBtn').textContent = '⏸'; $('playBtn').title = 'Pause (Space)';
    const loc = locate(S.t);
    S.cur = loc.i;
    const v = srcOf(loc.c.src).el;
    v.currentTime = loc.srcT;
    v.playbackRate = spd(loc.c);
    v.play().catch(() => {});
    requestAnimationFrame(tick);
  }
  function pause() {
    if (!S.playing) return;
    S.playing = false;
    for (const s of S.sources) s.el.pause();
    $('playBtn').textContent = '▶'; $('playBtn').title = 'Play (Space)';
    updatePlayhead(); requestDraw();
  }
  // While playing, follow the video and hop to the next clip at each cut.
  function tick() {
    if (!S.playing) return;
    const L = layout();
    const r = L.rows[S.cur];
    if (!r) { pause(); return; }
    const src = srcOf(r.c.src), v = src.el;
    const lead = 0.5 * spd(r.c) / (src.fps || 30);
    if (v.currentTime >= r.c.b - lead || v.ended) {
      const n = L.rows[S.cur + 1];
      if (!n) { pause(); S.t = L.total; updatePlayhead(); requestDraw(); return; }
      S.cur = n.i;
      if (n.c.src === r.c.src && Math.abs(n.c.a - v.currentTime) < 0.06) {
        // The next clip carries straight on: keep playing, at its own speed.
        v.playbackRate = spd(n.c);
      } else {
        v.pause();
        const nv = srcOf(n.c.src).el;
        nv.currentTime = n.c.a;
        nv.playbackRate = spd(n.c);
        nv.play().catch(() => {});
      }
      S.t = n.start;
    } else {
      S.t = clamp(r.start + (v.currentTime - r.c.a) / spd(r.c), r.start, r.end);
    }
    updatePlayhead();
    drawStage();
    requestAnimationFrame(tick);
  }
  $('playBtn').addEventListener('click', () => (S.playing ? pause() : play()));
  stage.addEventListener('click', () => { if (S.clips.length) (S.playing ? pause() : play()); });
  function frameStep() { const loc = locate(S.t); return 1 / ((loc && srcOf(loc.c.src).fps) || 30); }
  $('prevBtn').addEventListener('click', () => { pause(); seek(S.t - frameStep()); });
  $('nextBtn').addEventListener('click', () => { pause(); seek(S.t + frameStep()); });
  $('splitBtn').addEventListener('click', splitAtPlayhead);
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);

  document.addEventListener('keydown', e => {
    if (!$('workspace').classList.contains('active') || S.exporting) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) {
      if (isTyping(e.target) && e.target.matches('.cap-text, .time-input')) return; // the field's own undo
      e.preventDefault(); e.shiftKey ? redo() : undo(); return;
    }
    if (mod && (e.key === 'y' || e.key === 'Y')) { if (!isTyping(e.target)) { e.preventDefault(); redo(); } return; }
    if (isTyping(e.target) || mod || e.altKey) return;
    switch (e.key) {
      case ' ': e.preventDefault(); S.playing ? pause() : play(); break;
      case 's': case 'S': e.preventDefault(); splitAtPlayhead(); break;
      case 'c': case 'C': e.preventDefault(); pause(); addCaptionAtPlayhead(); break;
      case 'i': case 'I': e.preventDefault(); trimToPlayhead('in'); break;
      case 'o': case 'O': e.preventDefault(); trimToPlayhead('out'); break;
      case 'Delete': case 'Backspace': if (S.sel) { e.preventDefault(); deleteClip(S.sel); } break;
      case 'ArrowLeft': e.preventDefault(); pause(); seek(S.t - (e.shiftKey ? 1 : frameStep())); break;
      case 'ArrowRight': e.preventDefault(); pause(); seek(S.t + (e.shiftKey ? 1 : frameStep())); break;
      case 'Home': e.preventDefault(); pause(); seek(0); break;
      case 'End': e.preventDefault(); pause(); seek(total()); break;
    }
  });

  // ── Tabs ─────────────────────────────────────────────────────────────────
  function showTab(name) {
    document.querySelectorAll('.sidebar .ctrl-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.sidebar .ctrl-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  }
  document.querySelectorAll('.sidebar .ctrl-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ── Export settings ──────────────────────────────────────────────────────
  const QUALITY = { low: 'QUALITY_LOW', medium: 'QUALITY_MEDIUM', high: 'QUALITY_HIGH', veryhigh: 'QUALITY_VERY_HIGH' };
  const BPP = { low: 0.045, medium: 0.07, high: 0.1, veryhigh: 0.16 };   // rough bits per pixel per frame
  function firstSource() { const c = S.clips[0]; return c ? srcOf(c.src) : S.sources[0]; }
  // The output frame: the first clip's shape, at the chosen height, even sides.
  function outDims() {
    const s = firstSource();
    if (!s) return { w: 640, h: 360 };
    const v = $('outRes').value;
    let h = v === 'src' ? s.h : +v;
    let w = h * s.w / s.h;
    const even = n => Math.max(2, Math.round(n / 2) * 2);
    return { w: even(w), h: even(h) };
  }
  function outFps() {
    const v = $('outFps').value;
    if (v !== 'src') return +v;
    const s = firstSource();
    const f = s && s.fps ? s.fps : 30;
    return clamp(Math.round(f * 1000) / 1000, 1, 120);
  }
  function renderMetrics() {
    if (!S.clips.length) return;
    const d = outDims(), fps = outFps(), T = total();
    const frames = frameGrid().length;
    const hasAudio = true;
    const bytes = (d.w * d.h * fps * BPP[$('outQuality').value] * T + (hasAudio ? 128000 * T : 0)) / 8;
    $('metLen').textContent = fmt(T);
    $('metDims').textContent = d.w + '×' + d.h;
    $('metFrames').textContent = frames.toLocaleString() + ' @ ' + (Math.round(fps * 100) / 100);
    $('metSize').textContent = '≈ ' + fmtBytes(bytes);
  }
  const FMT_TIPS = {
    mp4: '<strong>MP4:</strong> plays almost everywhere, phones and social media included. H.264 where your browser can encode it.',
    webm: '<strong>WebM:</strong> an open format (VP9 and Opus) that browsers and most players read. Often the faster choice in Chrome and Firefox.',
  };
  const CAP_NOTES = {
    burn: 'Drawn into the picture, so they show in every player and on every site.',
    track: 'Kept as a separate track viewers switch on and off. VLC and mpv show it; many players and sites ignore it, so keep the SRT too.',
    none: 'The video goes out without captions. ⬇ SRT or ⬇ VTT still saves them on their own.',
  };
  function syncExportNotes() {
    $('fmtTip').setAttribute('data-tip', FMT_TIPS[$('outFormat').value] || '');
    $('capModeNote').textContent = CAP_NOTES[$('capMode').value] || '';
  }
  $('capSize').addEventListener('input', () => { $('capSizeVal').textContent = $('capSize').value + '% of height'; requestDraw(); });
  ['capPos', 'capLook', 'capColour', 'capMode', 'creditCheck'].forEach(id => $(id).addEventListener('change', () => { syncExportNotes(); requestDraw(); }));
  ['outFormat', 'outRes', 'outFps', 'outQuality'].forEach(id => $(id).addEventListener('change', () => { syncExportNotes(); renderMetrics(); requestDraw(); }));

  // Every output frame's time in the edit: one fixed grid over the whole edit,
  // so a cut never drifts the frame rate.
  function frameGrid() {
    const fps = outFps(), L = layout();
    const out = [];
    const n = Math.max(1, Math.round(L.total * fps));
    for (let k = 0; k < n; k++) out.push(k / fps);
    return out;
  }

  // ── Export ───────────────────────────────────────────────────────────────
  function clearOutput() {
    if (S.outUrl) { URL.revokeObjectURL(S.outUrl); S.outUrl = null; }
    $('outStrip').classList.remove('visible');
    $('outThumb').removeAttribute('src');
  }
  function setExporting(on) {
    S.exporting = on;
    $('exportBtn').disabled = on;
    $('cancelBtn').hidden = !on;
    document.querySelectorAll('#tab-clips button, #tab-captions button, #undoBtn, #redoBtn, #loadBtn, #playBtn').forEach(b => { if (on) { b.dataset.wasDisabled = b.disabled ? '1' : ''; b.disabled = true; } else { b.disabled = b.dataset.wasDisabled === '1'; } });
    if (!on) syncUndo();
  }
  $('cancelBtn').addEventListener('click', () => { S.cancel = true; setStatus('Stopping…'); });

  // One stretch of silence, in seconds, at 48 kHz stereo.
  function silence(sec) {
    const n = Math.max(1, Math.round(sec * 48000));
    return new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: 48000 });
  }
  function sliceBuffer(buf, s0, s1) {
    const n = s1 - s0;
    const out = new AudioBuffer({ length: n, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
    for (let ch = 0; ch < buf.numberOfChannels; ch++) out.copyToChannel(buf.getChannelData(ch).subarray(s0, s1), ch);
    return out;
  }

  /* Speed without the chipmunk: WSOLA (waveform-similarity overlap-add).
     Windows of the clip's sound are laid down at the output's pace and each one
     is taken from where, within a short search, it best continues the last, so
     the pitch stays as filmed (as the browser's own preview plays it).
     chans: one Float32Array per channel. Returns the same at length n / speed. */
  function timeStretch(chans, speed) {
    const n = chans[0].length, outN = Math.max(1, Math.round(n / speed));
    const N = 1024, Hs = N / 2, TOL = 256, L = Hs;
    const out = chans.map(() => new Float32Array(outN));
    if (n < N * 2) {                      // too short to stretch: resample it
      chans.forEach((x, ch) => { for (let i = 0; i < outN; i++) out[ch][i] = x[Math.min(n - 1, Math.floor(i * speed))]; });
      return out;
    }
    const w = new Float32Array(N);
    for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);   // periodic Hann: 50% overlap sums to 1
    const mono = new Float32Array(n);
    for (const x of chans) for (let i = 0; i < n; i++) mono[i] += x[i] / chans.length;
    let prev = 0;
    for (let k = 0, o = 0; o < outN; k++, o += Hs) {
      let pos = Math.round(k * Hs * speed);
      if (k > 0) {
        // The natural continuation of the last window, and the best match near pos.
        const nat = prev + Hs;
        let best = pos, bestC = -Infinity;
        const lo = Math.max(0, pos - TOL), hi = Math.min(n - N, pos + TOL);
        for (let p = lo; p <= hi; p += 2) {
          let c = 0;
          for (let j = 0; j < L; j += 4) { const a = nat + j < n ? mono[nat + j] : 0; c += a * mono[p + j]; }
          if (c > bestC) { bestC = c; best = p; }
        }
        pos = best;
      }
      pos = clamp(pos, 0, n - N);
      for (let ch = 0; ch < chans.length; ch++) {
        const x = chans[ch], y = out[ch];
        for (let j = 0; j < N && o + j < outN; j++) y[o + j] += x[pos + j] * w[j];
      }
      prev = pos;
    }
    // The first half window has no partner overlapping it: lift it back up.
    for (const y of out) for (let j = 0; j < Hs && j < outN; j++) y[j] /= Math.max(w[j], 0.05);
    return out;
  }
  // A clip's sound as one block per channel, gaps in the source filled with silence.
  async function gatherClipAudio(mb, at, a, b, check) {
    const sink = new mb.AudioBufferSink(at);
    let sr = 0, chCount = 0, parts = [], have = 0;
    let cursor = a;
    for await (const wb of sink.buffers(a, b)) {
      check();
      const buf = wb.buffer;
      if (!sr) { sr = buf.sampleRate; chCount = buf.numberOfChannels; }
      if (wb.timestamp > cursor + 2 / sr) {
        const gap = Math.round((Math.min(wb.timestamp, b) - cursor) * sr);
        if (gap > 0) { parts.push({ gap }); have += gap; cursor += gap / sr; }
      }
      const s0 = clamp(Math.round((cursor - wb.timestamp) * sr), 0, buf.length);
      const s1 = clamp(Math.round((b - wb.timestamp) * sr), 0, buf.length);
      if (s1 - s0 < 1) continue;
      const chans = [];
      for (let ch = 0; ch < chCount; ch++) chans.push(buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1)).slice(s0, s1));
      parts.push({ chans }); have += s1 - s0;
      cursor = wb.timestamp + s1 / sr;
    }
    if (!sr) return null;
    const total = Math.max(have, Math.round((b - a) * sr));
    const chans = [];
    for (let ch = 0; ch < chCount; ch++) chans.push(new Float32Array(total));
    let at0 = 0;
    for (const p of parts) {
      if (p.gap) { at0 += p.gap; continue; }
      for (let ch = 0; ch < chCount; ch++) chans[ch].set(p.chans[ch], at0);
      at0 += p.chans[0].length;
    }
    return { sr, chans };
  }

  async function exportVideo() {
    if (S.exporting || !S.clips.length) return;
    if (!('VideoEncoder' in window)) {
      setStatus('This browser cannot encode video. Use a recent Chrome, Edge, Safari or Firefox. ⬇ SRT and ⬇ VTT still work.', 'err');
      return;
    }
    pause();
    clearOutput();
    S.cancel = false;
    setExporting(true);
    setProgress(0);
    setStatus('Loading the encoder…');
    let output = null;
    const inputs = [];
    try {
      const mb = await loadMB();
      await document.fonts.load('600 40px "DM Sans"').catch(() => {});
      const kind = $('outFormat').value === 'webm' ? 'webm' : 'mp4';
      const { w: W, h: H } = outDims();
      const fps = outFps();
      const quality = mb[QUALITY[$('outQuality').value]] || mb.QUALITY_HIGH;
      const format = kind === 'mp4' ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat();
      const vCodec = await mb.getFirstEncodableVideoCodec(kind === 'mp4' ? ['avc', 'hevc', 'vp9', 'av1'] : ['vp9', 'vp8', 'av1'], { width: W, height: H });
      if (!vCodec) throw new Error('This browser cannot encode ' + kind.toUpperCase() + ' video at ' + W + '×' + H + '. Try ' + (kind === 'mp4' ? 'WebM' : 'MP4') + ' or a smaller resolution.');

      // Open each source that the edit uses.
      setStatus('Reading the video…');
      const used = [...new Set(S.clips.map(c => c.src))];
      const tracks = {};
      for (const id of used) {
        const input = new mb.Input({ source: new mb.BlobSource(srcOf(id).file), formats: mb.ALL_FORMATS });
        inputs.push(input);
        const vt = await input.getPrimaryVideoTrack();
        const at = await input.getPrimaryAudioTrack();
        const vOk = vt && await vt.canDecode();
        const aOk = at && await at.canDecode();
        if (!vOk) throw new Error('This browser cannot decode the video in ' + srcOf(id).name + '.');
        tracks[id] = { vt, at: aOk ? at : null };
      }
      const anyAudio = used.some(id => tracks[id].at);
      const aCodec = anyAudio ? await mb.getFirstEncodableAudioCodec(kind === 'mp4' ? ['aac', 'opus'] : ['opus', 'vorbis'], { numberOfChannels: 2, sampleRate: 48000 }) : null;

      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      output = new mb.Output({ format, target: new mb.BufferTarget() });
      const vSrc = new mb.CanvasSource(canvas, { codec: vCodec, quality, keyFrameInterval: 2 });
      output.addVideoTrack(vSrc, { frameRate: fps });
      let aSrc = null;
      if (aCodec) {
        aSrc = new mb.AudioBufferSource({ codec: aCodec, quality, transform: { numberOfChannels: 2, sampleRate: 48000 } });
        output.addAudioTrack(aSrc);
      }
      const capMode = $('capMode').value;
      const cues = captionCues();
      let sSrc = null;
      if (capMode === 'track' && cues.length) {
        sSrc = new mb.TextSubtitleSource('webvtt');
        output.addSubtitleTrack(sSrc, { name: 'Captions' });
      }
      await output.start();

      const st = capStyle();
      const credit = $('creditCheck').checked;
      const grid = frameGrid();
      const L = layout();
      const nFrames = grid.length;
      let framesDone = 0;
      const check = () => { if (S.cancel) throw new Error('cancelled'); };

      async function videoLoop() {
        // Frames grouped by clip, each frame asked for at its source second.
        let k = 0;
        for (const r of L.rows) {
          const times = [];
          const outTimes = [];
          while (k < nFrames && (grid[k] < r.end - EPS || r === L.rows[L.rows.length - 1])) {
            const T = grid[k];
            times.push(clamp(r.c.a + (T - r.start) * spd(r.c), r.c.a, Math.max(r.c.a, r.c.b - 1e-6)));
            outTimes.push(T);
            k++;
          }
          if (!times.length) continue;
          const sink = new mb.CanvasSink(tracks[r.c.src].vt, { poolSize: 2 });
          let j = 0;
          for await (const wc of sink.canvasesAtTimestamps(times)) {
            check();
            const T = outTimes[j++];
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, W, H);
            if (wc) drawContain(ctx, wc.canvas, wc.canvas.width, wc.canvas.height, 0, 0, W, H);
            if (capMode === 'burn') drawCaption(ctx, captionAt(T), st, 0, 0, W, H);
            if (credit) drawCredit(ctx, 0, 0, W, H);
            await vSrc.add(T, 1 / fps);
            framesDone++;
            if (framesDone % 3 === 0) {
              setProgress(framesDone / nFrames * 97);
              setStatus('Encoding frame ' + framesDone.toLocaleString() + ' of ' + nFrames.toLocaleString() + '…');
            }
          }
        }
        vSrc.close();
      }

      async function audioLoop() {
        if (!aSrc) return;
        let written = 0;   // seconds of audio placed so far
        const end = nFrames / fps;
        for (const r of L.rows) {
          check();
          const clipEnd = Math.min(r.end, end);
          const at = tracks[r.c.src].at;
          if (at && spd(r.c) !== 1) {
            // A sped-up or slowed clip: stretch its sound to the clip's new length.
            const got = await gatherClipAudio(mb, at, r.c.a, r.c.b, check);
            if (got) {
              const st = timeStretch(got.chans, spd(r.c));
              const len = st[0].length, step = got.sr;   // add a second at a time
              for (let o = 0; o < len; o += step) {
                check();
                const m = Math.min(step, len - o);
                const ab = new AudioBuffer({ length: m, numberOfChannels: st.length, sampleRate: got.sr });
                st.forEach((y, ch) => ab.copyToChannel(y.subarray(o, o + m), ch));
                await aSrc.add(ab);
              }
              written += len / got.sr;
            }
          } else if (at) {
            const sink = new mb.AudioBufferSink(at);
            let cursor = r.c.a;   // source second reached so far
            for await (const wb of sink.buffers(r.c.a, r.c.b)) {
              check();
              const buf = wb.buffer, sr = buf.sampleRate;
              if (wb.timestamp > cursor + 2 / sr) {         // a gap in the source: fill it
                const gap = Math.min(wb.timestamp, r.c.b) - cursor;
                if (gap > 0) { await aSrc.add(silence(gap)); written += Math.round(gap * 48000) / 48000; cursor += gap; }
              }
              const s0 = clamp(Math.round((cursor - wb.timestamp) * sr), 0, buf.length);
              const s1 = clamp(Math.round((r.c.b - wb.timestamp) * sr), 0, buf.length);
              if (s1 - s0 < 1) continue;
              await aSrc.add(sliceBuffer(buf, s0, s1));
              written += (s1 - s0) / sr;
              cursor = wb.timestamp + s1 / sr;
            }
          }
          const pad = clipEnd - written;
          if (pad > 1 / 48000) { await aSrc.add(silence(pad)); written += Math.round(pad * 48000) / 48000; }
        }
        aSrc.close();
      }

      if (sSrc) { await sSrc.add(buildVTT()); sSrc.close(); }
      await Promise.all([videoLoop(), audioLoop()]);
      setProgress(98);
      setStatus('Finishing the file…');
      await output.finalize();
      const buf = output.target.buffer;
      const blob = new Blob([buf], { type: format.mimeType });
      S.outUrl = URL.createObjectURL(blob);
      const name = baseName() + format.fileExtension;
      $('outThumb').src = S.outUrl;
      $('outName').textContent = name;
      $('outMeta').textContent = W + '×' + H + ' · ' + fmt(nFrames / fps) + ' · ' + vCodec.toUpperCase() + (aCodec ? ' + ' + aCodec.toUpperCase() : ', no sound') + (sSrc ? ' + captions track' : '') + ' · ' + fmtBytes(blob.size);
      $('outStrip').classList.add('visible');
      $('downloadBtn').onclick = () => {
        const a = document.createElement('a');
        a.href = S.outUrl; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
      };
      setProgress(100);
      setStatus('Done. ' + fmtBytes(blob.size) + '. Press ⬇ Download video to save it.', 'ok');
      requestAnimationFrame(sizeStage);
    } catch (err) {
      if (output && output.state !== 'finalized' && output.state !== 'canceled') { try { await output.cancel(); } catch (e) {} }
      if (S.cancel || (err && err.message === 'cancelled')) { setStatus('Export stopped.'); setProgress(0); }
      else { console.error(err); setStatus('Export failed: ' + (err && err.message || err), 'err'); setProgress(0); }
    } finally {
      for (const i of inputs) { try { i.dispose && i.dispose(); } catch (e) {} }
      setExporting(false);
      S.cancel = false;
    }
  }
  $('exportBtn').addEventListener('click', exportVideo);

  // ── Theme ────────────────────────────────────────────────────────────────
  const themeToggle = $('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', () => requestAnimationFrame(requestDraw));

  // ── Start ────────────────────────────────────────────────────────────────
  // Short option lists as segmented buttons; the selects stay the saved fields.
  ['outFormat', 'outQuality', 'capPos', 'capLook', 'capColour', 'capMode'].forEach(id => {
    if (window.SharedSeg) SharedSeg.fromSelect($(id), { labelOf: o => o.textContent });
  });
  syncExportNotes();
  syncUndo();
  if (window.Persist) {
    persist = Persist.init('video-trimmer-captioner', {
      extra: { save: projectBlob, restore: p => { savedProject = p && typeof p === 'object' ? p : null; } },
      onRestore: () => { $('capSizeVal').textContent = $('capSize').value + '% of height'; syncExportNotes(); renderMetrics(); requestDraw(); },
    });
  }
  // Fetch the encoder ahead of time once a video is open, so Export starts at once.
  $('workspace').addEventListener('pointerenter', () => { loadMB().catch(() => {}); }, { once: true });

  // For checks and the guide: the edit as data.
  window.VTC = { state: S, layout, occurrences, captionAt, buildSRT, buildVTT, parseCaptions, seek, splitAtPlayhead, deleteClip, moveClip, duplicateClip, undo, redo, exportVideo, outDims, outFps };
})();
