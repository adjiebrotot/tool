(function () {
  'use strict';
  // Watermark logo (logos/logo.svg), preloaded for use in canvas exports
  const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
  const wmLogoImg = new Image();
  wmLogoImg.src = WM_LOGO_SRC;

  // ============================================================
  // PART 1: PURE JS GIF ENCODER
  // NeuQuant Neural Net Quantizer (A. Dekker 1994, MIT adapted)
  // GIF89a format + LZW compression
  // ============================================================

  class ByteStream {
    constructor() { this.d = []; }
    wb(v)    { this.d.push(v & 0xFF); }
    wbs(a,n) { for (let i = 0; i < n; i++) this.d.push(a[i] & 0xFF); }
    ws(v)    { this.d.push(v & 0xFF, (v >> 8) & 0xFF); }
    wt(s)    { for (let i = 0; i < s.length; i++) this.d.push(s.charCodeAt(i)); }
    toU8()   { return new Uint8Array(this.d); }
  }

  // ── NeuQuant: train a 256-neuron network on the image pixels ──
  function neuQuantize(rgba, samplefac) {
    samplefac = Math.max(1, samplefac | 0);

    const N = 256, NBSHIFT = 4, NCYCLES = 100;
    const INTALPHA = 1 << 10;
    const INITRAD  = N >> 3;
    const RADIUSBIASSHIFT = 6;
    const RADBIAS6 = 1 << RADIUSBIASSHIFT;
    const INITRADIUS = INITRAD * RADBIAS6;
    const RADIUSDEC = 30;
    const RADSHIFT = 8, RADBIAS = 1 << RADSHIFT;
    const ARADSHIFT = 10 + RADSHIFT, ARADBIAS = 1 << ARADSHIFT;
    const INTBIAS = 1 << 16, GAMMASHIFT = 10;
    const BETAGAMMA = INTBIAS << (GAMMASHIFT - 10);
    const BETA = INTBIAS >> 10;

    // Network: each neuron = [c0, c1, c2, originalIndex]
    const net = [];
    for (let i = 0; i < N; i++) {
      const v = (i << (NBSHIFT + 8)) / N;
      net[i] = new Float64Array([v, v, v, i]);
    }
    const bias = new Float64Array(N);
    const freq = new Float64Array(N);
    const radpower = new Float64Array(INITRAD);
    const netindex = new Int32Array(256);
    for (let i = 0; i < N; i++) freq[i] = INTBIAS / N;

    function contest(b0, b1, b2) {
      let bd = 0x7FFFFFFF, bbd = 0x7FFFFFFF, bp = 0, bbp = 0;
      for (let i = 0; i < N; i++) {
        const n = net[i];
        const d = Math.abs(n[0]-b0) + Math.abs(n[1]-b1) + Math.abs(n[2]-b2);
        if (d < bd)  { bd = d;  bp = i; }
        const dd = d - ((bias[i] >> (16 - NBSHIFT)) | 0);
        if (dd < bbd){ bbd = dd; bbp = i; }
        const bf = (freq[i] >> 10) | 0;
        freq[i] -= bf;
        bias[i] += bf << GAMMASHIFT;
      }
      freq[bp] += BETA;
      bias[bp] -= BETAGAMMA;
      return bbp;
    }

    function altersingle(a, i, b0, b1, b2) {
      net[i][0] -= ((a * (net[i][0] - b0)) / INTALPHA) | 0;
      net[i][1] -= ((a * (net[i][1] - b1)) / INTALPHA) | 0;
      net[i][2] -= ((a * (net[i][2] - b2)) / INTALPHA) | 0;
    }

    function alterneigh(rad, ci, b0, b1, b2) {
      const lo = Math.max(ci - rad, -1);
      const hi = Math.min(ci + rad, N);
      let j = ci + 1, k = ci - 1, m = 1;
      while (j < hi || k > lo) {
        const a = radpower[m++] || 0;
        if (j < hi) {
          const p = net[j++];
          p[0] -= ((a*(p[0]-b0))/ARADBIAS)|0;
          p[1] -= ((a*(p[1]-b1))/ARADBIAS)|0;
          p[2] -= ((a*(p[2]-b2))/ARADBIAS)|0;
        }
        if (k > lo) {
          const p = net[k--];
          p[0] -= ((a*(p[0]-b0))/ARADBIAS)|0;
          p[1] -= ((a*(p[1]-b1))/ARADBIAS)|0;
          p[2] -= ((a*(p[2]-b2))/ARADBIAS)|0;
        }
      }
    }

    function learn() {
      const len = rgba.length;
      const sp = Math.max(1, (len / 4 / samplefac) | 0);
      let delta = Math.max(1, (sp / NCYCLES) | 0);
      let alpha = INTALPHA, radius = INITRADIUS;
      let rad = (radius >> RADIUSBIASSHIFT) | 0;
      if (rad > 1) for (let i = 0; i < rad; i++)
        radpower[i] = alpha * ((rad*rad - i*i) * RADBIAS) / (rad*rad);

      const primes = [499, 491, 487, 503];
      let step = 4;
      if (len >= primes[0] * 4) {
        const p = primes.find(p => len % p !== 0);
        step = p ? p * 4 : primes[3] * 4;
      }

      let pix = 0;
      for (let i = 0; i < sp; i++) {
        const b0 = (rgba[pix]   & 0xFF) << NBSHIFT;
        const b1 = (rgba[pix+1] & 0xFF) << NBSHIFT;
        const b2 = (rgba[pix+2] & 0xFF) << NBSHIFT;
        const j  = contest(b0, b1, b2);
        altersingle(alpha, j, b0, b1, b2);
        if (rad > 0) alterneigh(rad, j, b0, b1, b2);
        pix += step;
        if (pix >= len) pix -= len;
        if ((i + 1) % delta === 0) {
          alpha  -= (alpha  / 30) | 0;
          radius -= (radius / RADIUSDEC) | 0;
          rad = (radius >> RADIUSBIASSHIFT) | 0;
          if (rad <= 1) rad = 0;
          if (rad > 1) for (let k = 0; k < rad; k++)
            radpower[k] = alpha * ((rad*rad - k*k) * RADBIAS) / (rad*rad);
        }
      }
    }

    // Train the network
    learn();

    // Unbias and assign original indices
    for (let i = 0; i < N; i++) {
      net[i][0] >>= NBSHIFT;
      net[i][1] >>= NBSHIFT;
      net[i][2] >>= NBSHIFT;
      net[i][3]  = i;
    }

    // Sort by ch1 (green) and build fast lookup index
    net.sort((a, b) => a[1] - b[1]);
    let prev = 0, sp2 = 0;
    for (let i = 0; i < N; i++) {
      const g = net[i][1];
      if (g !== prev) {
        netindex[prev] = (sp2 + i) >> 1;
        for (let j = prev + 1; j < g; j++) netindex[j] = i;
        prev = g; sp2 = i;
      }
    }
    netindex[prev] = (sp2 + N - 1) >> 1;
    for (let j = prev + 1; j < 256; j++) netindex[j] = N - 1;

    // Build palette array indexed by original neuron index
    const palette = new Uint8Array(N * 3);
    for (let k = 0; k < N; k++) {
      const n   = net[k];
      const idx = n[3] | 0;
      palette[idx*3]   = Math.max(0, Math.min(255, n[0] | 0));
      palette[idx*3+1] = Math.max(0, Math.min(255, n[1] | 0));
      palette[idx*3+2] = Math.max(0, Math.min(255, n[2] | 0));
    }

    // Nearest-color lookup using binary search on sorted network
    function lookup(c0, c1, c2) {
      let bd = 1000, best = 0;
      let i = netindex[c1] | 0, j = i - 1;
      while (i < N || j >= 0) {
        if (i < N) {
          const p = net[i]; let d = p[1] - c1;
          if (d >= bd) { i = N; }
          else {
            i++;
            if (d < 0) d = -d;
            let a = p[0] - c0; if (a < 0) a = -a; d += a;
            if (d < bd) { a = p[2] - c2; if (a < 0) a = -a; d += a; if (d < bd) { bd = d; best = p[3] | 0; } }
          }
        }
        if (j >= 0) {
          const p = net[j]; let d = c1 - p[1];
          if (d >= bd) { j = -1; }
          else {
            j--;
            if (d < 0) d = -d;
            let a = p[0] - c0; if (a < 0) a = -a; d += a;
            if (d < bd) { a = p[2] - c2; if (a < 0) a = -a; d += a; if (d < bd) { bd = d; best = p[3] | 0; } }
          }
        }
      }
      return best;
    }

    return { palette, lookup };
  }

  // ── GIF LZW Encoder ──
  function lzwEncode(pixels, colorDepth, out) {
    const HSIZE = 5003, BITS = 12, MAXMAX = 1 << BITS;
    const ht = new Int32Array(HSIZE).fill(-1);
    const ct = new Int32Array(HSIZE);
    const acc = new Uint8Array(256);

    const ics = Math.max(2, colorDepth);
    const gib = ics + 1;
    let nb = gib, mc = (1 << nb) - 1;
    const CC = 1 << ics, EC = CC + 1;
    let fe = EC + 1;
    let cflag = false, ca = 0, cb = 0, ac = 0;

    out.wb(ics); // LZW minimum code size

    function charOut(c) { acc[ac++] = c; if (ac >= 254) flushAcc(); }
    function flushAcc() { if (ac > 0) { out.wb(ac); out.wbs(acc, ac); ac = 0; } }

    function emit(code) {
      ca |= code << cb;
      cb += nb;
      while (cb >= 8) { charOut(ca & 0xFF); ca >>>= 8; cb -= 8; }
      // Update code size if needed
      if (fe > mc || cflag) {
        if (cflag) { nb = gib; mc = (1 << nb) - 1; cflag = false; }
        else if (nb < BITS) { nb++; mc = nb < BITS ? (1 << nb) - 1 : MAXMAX; }
      }
      if (code === EC) { while (cb > 0) { charOut(ca & 0xFF); ca >>>= 8; cb -= 8; } flushAcc(); }
    }

    function clearTable() {
      ht.fill(-1);
      fe = EC + 1;
      cflag = true;
      emit(CC);
    }

    emit(CC);
    let ent = pixels[0];

    mainLoop: for (let p = 1; p < pixels.length; p++) {
      const c = pixels[p];
      const fcode = (c << BITS) + ent;
      let i = ((c << 4) ^ ent) % HSIZE;

      if (ht[i] === fcode) { ent = ct[i]; continue; }

      if (ht[i] >= 0) {
        let disp = i === 0 ? 1 : HSIZE - i;
        do {
          if ((i -= disp) < 0) i += HSIZE;
          if (ht[i] === fcode) { ent = ct[i]; continue mainLoop; }
        } while (ht[i] >= 0);
      }

      emit(ent);
      ent = c;
      if (fe < MAXMAX) { ct[i] = fe++; ht[i] = fcode; }
      else { clearTable(); }
    }

    emit(ent);
    emit(EC);
    out.wb(0); // GIF sub-block terminator
  }

  // ── Assemble GIF89a (async — yields between frames to keep the browser responsive) ──
  async function buildGIF(frames, w, h, { delay, loop, samplefac, dither }, onProgress) {
    const out = new ByteStream();

    // Header + Logical Screen Descriptor
    out.wt('GIF89a');
    out.ws(w); out.ws(h);
    out.wb(0x70); // no global color table; color resolution = 8-bit
    out.wb(0); out.wb(0);

    // Netscape loop extension
    if (loop) {
      out.wb(0x21); out.wb(0xFF); out.wb(11);
      out.wt('NETSCAPE2.0');
      out.wb(3); out.wb(1); out.ws(0); out.wb(0);
    }

    for (let fi = 0; fi < frames.length; fi++) {
      const rgba = frames[fi];

      // --- Bayer pre-dither (adds ordered noise before quantization) ---
      if (dither === 'bayer') {
        const bm = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i4 = (y * w + x) * 4;
            const t  = (bm[y & 3][x & 3] / 16 - 0.5) * 22;
            rgba[i4]   = Math.max(0, Math.min(255, (rgba[i4]   + t) | 0));
            rgba[i4+1] = Math.max(0, Math.min(255, (rgba[i4+1] + t) | 0));
            rgba[i4+2] = Math.max(0, Math.min(255, (rgba[i4+2] + t) | 0));
          }
        }
      }

      // --- Quantize to 256 colors ---
      const { palette, lookup } = neuQuantize(rgba, samplefac);

      // --- Index pixels (nearest color or Floyd-Steinberg) ---
      const indexed = new Uint8Array(w * h);

      if (dither === 'floyd') {
        const err = new Float32Array(w * h * 3);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const pi = (y * w + x) * 4;
            const ei = (y * w + x) * 3;
            const r = Math.max(0, Math.min(255, rgba[pi]   + err[ei]));
            const g = Math.max(0, Math.min(255, rgba[pi+1] + err[ei+1]));
            const b = Math.max(0, Math.min(255, rgba[pi+2] + err[ei+2]));
            const idx = lookup(r, g, b);
            indexed[y * w + x] = idx;
            const er = r - palette[idx*3];
            const eg = g - palette[idx*3+1];
            const eb = b - palette[idx*3+2];
            // Diffuse error to neighbors
            const spread = [[1,0,7/16],[-1,1,3/16],[0,1,5/16],[1,1,1/16]];
            for (const [dx, dy, fw] of spread) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < w && ny < h) {
                const ne = (ny * w + nx) * 3;
                err[ne]   += er * fw;
                err[ne+1] += eg * fw;
                err[ne+2] += eb * fw;
              }
            }
          }
        }
      } else {
        for (let i = 0; i < w * h; i++) {
          indexed[i] = lookup(rgba[i*4], rgba[i*4+1], rgba[i*4+2]);
        }
      }

      // --- Graphic Control Extension ---
      out.wb(0x21); out.wb(0xF9); out.wb(4);
      out.wb(0);         // packed: no disposal, no input, no transparency
      out.ws(delay);     // frame delay in centiseconds
      out.wb(0);         // transparent color index (unused)
      out.wb(0);         // block terminator

      // --- Image Descriptor ---
      out.wb(0x2C);
      out.ws(0); out.ws(0); // left, top
      out.ws(w); out.ws(h);
      out.wb(0x80 | 7);  // local color table flag; size = 2^(7+1) = 256 colors

      // --- Local Color Table (RGB) ---
      out.wbs(palette, 256 * 3);

      // --- Image Data (LZW compressed) ---
      lzwEncode(indexed, 8, out);

      // Yield to the browser after every frame so the UI stays responsive
      // and the browser's "Not Responding" watchdog is not triggered.
      await new Promise(r => setTimeout(r, 0));
      if (onProgress) onProgress(fi + 1, frames.length);
    }

    out.wb(0x3B); // GIF trailer
    return out.toU8();
  }


  // ============================================================
  // PART 2: APP STATE
  // ============================================================

  const S = {
    duration:  0,
    inPoint:   0,
    outPoint:  0,
    speed:     1,
    fps:       12,
    width:     480,
    quality:   3,      // 1=max .. 5=draft
    dither:    'none',
    loop:      true,
    reverse:   false,
    gifUrl:    null,
    converting:false,
  };

  const QUAL_LABELS = ['Max', 'High', 'Med', 'Fast', 'Draft'];
  const QUAL_SF     = [1, 2, 5, 10, 20]; // NeuQuant samplefac

  // ── DOM references ──
  const $ = id => document.getElementById(id);
  const dropZone     = $('dropZone');
  const fileInput    = $('fileInput');
  const workspace    = $('workspace');
  const video        = $('video');
  const widthSlider  = $('widthSlider');  const widthVal  = $('widthVal');  const widthWarn = $('widthWarn');
  const fpsSlider    = $('fpsSlider');    const fpsVal    = $('fpsVal');    const fpsWarn   = $('fpsWarn');
  const qualSlider   = $('qualSlider');   const qualVal   = $('qualVal');
  const loopCheck    = $('loopCheck');    const reverseCheck = $('reverseCheck');
  const playBtn      = $('playBtn');
  const prevBtn      = $('prevBtn');      const nextBtn   = $('nextBtn');
  const timecodeDisp = $('timecodeDisp'); const speedBadge= $('speedBadge');
  const timelineBar  = $('timelineBar');  const tlRegion  = $('tlRegion');
  const handleIn     = $('handleIn');     const handleOut = $('handleOut');
  const playhead     = $('playhead');
  const tlStartLbl   = $('tlStartLbl');   const tlEndLbl  = $('tlEndLbl');
  const inLbl        = $('inLbl');        const outLbl    = $('outLbl');
  const clipLbl      = $('clipLbl');
  const metFrames    = $('metFrames');    const metDuration = $('metDuration');
  const metDims      = $('metDims');      const metSize   = $('metSize');
  const convertBtn   = $('convertBtn');
  const progressFill = $('progressFill'); const statusMsg = $('statusMsg');
  const gifOutput    = $('gifOutput');    const gifThumb  = $('gifThumb');
  const gifName      = $('gifName');      const gifMeta   = $('gifMeta');
  const downloadBtn  = $('downloadBtn');  const loadBtn   = $('loadBtn');
  const themeToggle  = $('themeToggle');


  // ============================================================
  // PART 3: UTILITIES
  // ============================================================

  function fmtTime(s) {
    s = Math.max(0, s || 0);
    const m   = Math.floor(s / 60) | 0;
    const sec = (s % 60).toFixed(2).padStart(5, '0');
    return `${m}:${sec}`;
  }

  function fmtBytes(b) {
    if (b < 1024)        return (b | 0) + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
  }

  function getHeight()      { return video.videoWidth ? Math.round(S.width * video.videoHeight / video.videoWidth) : Math.round(S.width * 9/16); }
  function getTotalFrames() { return Math.max(1, Math.floor((S.outPoint - S.inPoint) / S.speed * S.fps)); }
  function getDelay()       { return Math.max(2, Math.round(100 / S.fps)); }

  function setStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className   = 'status-msg' + (type ? ' ' + type : '');
  }
  function setProgress(pct) { progressFill.style.width = pct + '%'; }


  // ============================================================
  // PART 4: VIDEO LOADING
  // ============================================================

  function loadVideo(file) {
    if (!file || !file.type.startsWith('video/')) { alert('Please select a valid video file.'); return; }
    if (S.gifUrl) { URL.revokeObjectURL(S.gifUrl); S.gifUrl = null; }
    const url = URL.createObjectURL(file);
    video.src = url;
    video.load();
    video.onloadedmetadata = () => {
      S.duration = video.duration;
      S.inPoint  = 0;
      S.outPoint = video.duration;
      // Default width to the video's native width, capped at 3840
      const nativeW = Math.min(video.videoWidth || 480, 3840);
      S.width = nativeW;
      widthSlider.value = nativeW;
      widthVal.textContent = nativeW + ' px';
      widthWarn.classList.toggle('visible', nativeW > 1920);
      dropZone.style.display = 'none';
      workspace.classList.add('active');
      gifOutput.classList.remove('visible');
      tlStartLbl.textContent = fmtTime(0);
      tlEndLbl.textContent   = fmtTime(video.duration);
      updateTimeline();
      updateMetrics();
      setStatus('Ready. Drag the blue handles to trim the clip.', '');
      setProgress(0);
    };
  }

  // Drag and drop
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    loadVideo(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => loadVideo(e.target.files[0]));
  loadBtn.addEventListener('click', () => {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'video/*';
    fi.onchange = e => loadVideo(e.target.files[0]);
    fi.click();
  });


  // ============================================================
  // PART 5: TIMELINE
  // ============================================================

  function pctOf(t) { return S.duration ? (t / S.duration) * 100 : 0; }
  function timeOf(pct) { return (pct / 100) * S.duration; }

  function updateTimeline() {
    const ip = pctOf(S.inPoint), op = pctOf(S.outPoint);
    tlRegion.style.left   = ip + '%';
    tlRegion.style.width  = (op - ip) + '%';
    handleIn.style.left   = ip + '%';
    handleOut.style.left  = op + '%';
    inLbl.textContent     = S.inPoint.toFixed(2) + 's';
    outLbl.textContent    = S.outPoint.toFixed(2) + 's';
    clipLbl.textContent   = (S.outPoint - S.inPoint).toFixed(2) + 's';
    updateMetrics();
  }

  function updatePlayhead() {
    if (!S.duration) return;
    playhead.style.left = pctOf(video.currentTime) + '%';
    timecodeDisp.innerHTML = `${fmtTime(video.currentTime)} <em>/</em> ${fmtTime(S.duration)}`;
  }

  // Click on timeline to seek
  timelineBar.addEventListener('click', e => {
    const r = timelineBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100));
    video.currentTime = timeOf(pct);
  });

  // Make a timeline handle draggable
  function makeDraggable(handle, onDrag) {
    let dragging = false;
    handle.addEventListener('mousedown', e => { e.preventDefault(); dragging = true; });
    handle.addEventListener('touchstart', e => { e.preventDefault(); dragging = true; }, { passive: false });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const r = timelineBar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100));
      onDrag(pct);
    });
    document.addEventListener('touchmove', e => {
      if (!dragging) return;
      const r = timelineBar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, (e.touches[0].clientX - r.left) / r.width * 100));
      onDrag(pct);
    }, { passive: true });
    document.addEventListener('mouseup',  () => { dragging = false; });
    document.addEventListener('touchend', () => { dragging = false; });
  }

  makeDraggable(handleIn, pct => {
    S.inPoint = Math.min(timeOf(pct), S.outPoint - 0.1);
    if (video.currentTime < S.inPoint) video.currentTime = S.inPoint;
    updateTimeline();
  });

  makeDraggable(handleOut, pct => {
    S.outPoint = Math.max(timeOf(pct), S.inPoint + 0.1);
    if (video.currentTime > S.outPoint) video.currentTime = S.outPoint;
    updateTimeline();
  });


  // ============================================================
  // PART 6: PLAYBACK CONTROLS
  // ============================================================

  playBtn.addEventListener('click', () => {
    if (video.paused) { video.playbackRate = S.speed; video.play(); }
    else video.pause();
  });

  video.addEventListener('play',  () => { playBtn.textContent = '⏸'; playBtn.title = 'Pause'; });
  video.addEventListener('pause', () => { playBtn.textContent = '▶'; playBtn.title = 'Play'; });

  video.addEventListener('timeupdate', () => {
    if (!video.paused && video.currentTime >= S.outPoint) {
      video.currentTime = S.inPoint;
    }
    updatePlayhead();
  });

  prevBtn.addEventListener('click', () => {
    video.pause();
    video.currentTime = Math.max(S.inPoint, video.currentTime - S.speed / S.fps);
  });
  nextBtn.addEventListener('click', () => {
    video.pause();
    video.currentTime = Math.min(S.outPoint, video.currentTime + S.speed / S.fps);
  });


  // ============================================================
  // PART 7: SETTINGS
  // ============================================================

  widthSlider.addEventListener('input', () => {
    S.width = +widthSlider.value;
    widthVal.textContent = S.width + ' px';
    widthWarn.classList.toggle('visible', S.width > 1920);
    updateMetrics();
  });

  fpsSlider.addEventListener('input', () => {
    S.fps = +fpsSlider.value;
    fpsVal.textContent = S.fps + ' fps';
    fpsWarn.classList.toggle('visible', S.fps > 24);
    updateMetrics();
  });

  qualSlider.addEventListener('input', () => {
    S.quality = +qualSlider.value;
    qualVal.textContent = QUAL_LABELS[S.quality - 1];
  });

  loopCheck.addEventListener('change',   () => { S.loop    = loopCheck.checked; });
  reverseCheck.addEventListener('change',() => { S.reverse = reverseCheck.checked; });

  // Dither toggle
  $('ditherGroup').addEventListener('click', e => {
    const btn = e.target.closest('[data-val]');
    if (!btn) return;
    $('ditherGroup').querySelectorAll('.tbtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.dither = btn.dataset.val;
  });

  // Speed toggle
  $('speedGroup').addEventListener('click', e => {
    const btn = e.target.closest('[data-speed]');
    if (!btn) return;
    $('speedGroup').querySelectorAll('.tbtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.speed = +btn.dataset.speed;
    video.playbackRate = S.speed;
    speedBadge.textContent = S.speed + '×';
    updateMetrics();
  });

  // Theme toggle
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    themeToggle.textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
  });


  // ============================================================
  // PART 8: METRICS
  // ============================================================

  function updateMetrics() {
    if (!S.duration) return;
    const h      = getHeight();
    const frames = getTotalFrames();
    const dur    = (S.outPoint - S.inPoint) / S.speed;
    // Rough estimate: animated GIF ~0.42 bytes/pixel after LZW
    const estBytes = frames * S.width * h * 0.42;
    metFrames.textContent   = frames;
    metDuration.textContent = dur.toFixed(1) + 's';
    metDims.textContent     = S.width + '×' + h;
    metSize.textContent     = fmtBytes(estBytes);
  }


  // ============================================================
  // PART 9: FRAME CAPTURE
  // ============================================================

  async function seekTo(t) {
    return new Promise(res => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; res(); } };
      video.addEventListener('seeked', done, { once: true });
      setTimeout(done, 900); // failsafe timeout
      video.currentTime = Math.max(0, Math.min(S.duration - 0.001, t));
    });
  }

  async function captureFrames() {
    const h      = getHeight();
    const frames = getTotalFrames(); // already capped at 120
    const canvas = document.createElement('canvas');
    canvas.width  = S.width;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const wasPlaying = !video.paused;
    video.pause();

    const result = [];
    for (let i = 0; i < frames; i++) {
      const srcTime = S.inPoint + i * S.speed / S.fps;
      await seekTo(srcTime);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const _wmFs = Math.max(10, Math.floor(canvas.height * 0.028));
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.font = `500 ${_wmFs}px "DM Mono",monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 2;
      const _wmText = 'Made using tool.adjiebrotots.com/videotogif';
      const _wmX = canvas.width - 8, _wmY = canvas.height - 6;
      const _wmTextW = ctx.measureText(_wmText).width;
      const _wmLogoSize = Math.round(_wmFs * 1.3);
      if(wmLogoImg.complete && wmLogoImg.naturalWidth){
        ctx.drawImage(wmLogoImg, _wmX - _wmTextW - Math.round(_wmFs * 0.4) - _wmLogoSize, _wmY - _wmLogoSize + Math.round(_wmFs * 0.15), _wmLogoSize, _wmLogoSize);
      }
      ctx.strokeStyle = '#000000';
      ctx.strokeText(_wmText, _wmX, _wmY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(_wmText, _wmX, _wmY);
      ctx.restore();
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      result.push(new Uint8ClampedArray(id.data));

      setProgress((i + 1) / frames * 72);
      setStatus(`Capturing frame ${i + 1} / ${frames}…`);
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 0)); // yield to browser
    }

    if (wasPlaying) { video.playbackRate = S.speed; video.play(); }
    if (S.reverse) result.reverse();
    return { result, w: canvas.width, h };
  }


  // ============================================================
  // PART 10: CONVERT
  // ============================================================

  convertBtn.addEventListener('click', async () => {
    if (S.converting || !S.duration) return;
    S.converting = true;
    convertBtn.disabled = true;
    gifOutput.classList.remove('visible');
    setProgress(0);
    setStatus('Preparing…');

    try {
      const { result, w, h } = await captureFrames();

      setStatus('Encoding GIF — this may take a moment…');
      setProgress(78);
      await new Promise(r => setTimeout(r, 12)); // let status render

      const gifData = await buildGIF(result, w, h, {
        delay:     getDelay(),
        loop:      S.loop,
        samplefac: QUAL_SF[S.quality - 1],
        dither:    S.dither,
      }, (done, total) => {
        setProgress(78 + (done / total) * 22);
        setStatus(`Encoding frame ${done} / ${total}…`);
      });

      setProgress(100);

      if (S.gifUrl) URL.revokeObjectURL(S.gifUrl);
      const blob  = new Blob([gifData], { type: 'image/gif' });
      S.gifUrl    = URL.createObjectURL(blob);

      gifThumb.src         = S.gifUrl;
      gifName.textContent  = 'output.gif';
      gifMeta.textContent  = `${w}×${h} · ${result.length} frames · ${fmtBytes(gifData.length)}`;
      gifOutput.classList.add('visible');

      setStatus(`Done! ${fmtBytes(gifData.length)} — click Download to save.`, 'ok');

      downloadBtn.onclick = () => {
        const a  = document.createElement('a');
        a.href   = S.gifUrl;
        a.download = 'output.gif';
        a.click();
      };

    } catch (err) {
      console.error(err);
      setStatus('Error: ' + err.message, 'err');
    }

    S.converting = false;
    convertBtn.disabled = false;
  });

})();
