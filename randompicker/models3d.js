'use strict';
/* ============================================================
   RANDOM PICKER — 3D models (three.js)
   Scene builders for the wheel, the slot machine and the Galton
   board, plus the studio lighting and rounded geometry the die uses.

   These only DRAW. Every outcome is decided in script.js before a
   model is asked to move, and the model is then driven to show that
   outcome. Nothing in this file calls Math.random() to pick anything;
   the only randomness here is cosmetic (wood grain, plastic mottling).

   All builders are plain functions that return a small API object,
   so script.js can fall back to its 2D versions when three.js or
   WebGL is unavailable.
   ============================================================ */
const M3D = (() => {
  const TAU = Math.PI * 2;

  // ── Capability check ───────────────────────────────────────────────────
  function available() {
    if (typeof THREE === 'undefined') return false;
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  // ── Small helpers ──────────────────────────────────────────────────────
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function colorTexture(canvas, aniso) {
    const t = new THREE.CanvasTexture(canvas);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = aniso || 8;
    return t;
  }
  function hexRgb(hex) {
    hex = (hex || '').trim();
    if (/^#[0-9a-f]{3}$/i.test(hex)) hex = '#' + hex.slice(1).split('').map(ch => ch + ch).join('');
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return [136, 136, 136];
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  function shade(hex, f) { // f < 0 darkens toward black, f > 0 lightens toward white
    const [r, g, b] = hexRgb(hex);
    const m = v => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }
  function luminance(hex) {
    const [r, g, b] = hexRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  // Shrinks the font until the text fits, then ellipsises if it still does not.
  function fitLabel(g, text, maxW, maxPx, minPx, weight, family) {
    let px = maxPx;
    for (; px > minPx; px -= 2) {
      g.font = `${weight} ${px}px ${family}`;
      if (g.measureText(text).width <= maxW) return { text, px };
    }
    g.font = `${weight} ${minPx}px ${family}`;
    let t = text;
    while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return { text: t === text ? t : t + '…', px: minPx };
  }
  // Word-wraps into at most maxLines lines, shrinking the font first.
  function wrapLabel(g, text, maxW, maxPx, minPx, maxLines, weight, family) {
    for (let px = maxPx; px >= minPx; px -= 2) {
      g.font = `${weight} ${px}px ${family}`;
      const words = text.split(/\s+/);
      const lines = [];
      let line = '';
      let ok = true;
      for (const w of words) {
        const trial = line ? line + ' ' + w : w;
        if (g.measureText(trial).width <= maxW) { line = trial; continue; }
        if (line) lines.push(line);
        line = w;
        if (g.measureText(w).width > maxW) { ok = false; break; }
      }
      if (line) lines.push(line);
      if (ok && lines.length <= maxLines) return { lines, px };
    }
    const f = fitLabel(g, text, maxW, minPx, minPx, weight, family);
    return { lines: [f.text], px: f.px };
  }

  function glowTexture() {
    const c = makeCanvas(128, 128);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,236,170,0.95)');
    grad.addColorStop(0.25, 'rgba(255,196,80,0.45)');
    grad.addColorStop(1, 'rgba(255,170,40,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return colorTexture(c);
  }

  // ── Materials ──────────────────────────────────────────────────────────
  // Hex colours are sRGB; the renderer works in linear light, so convert.
  const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
  const mats = {
    chrome: () => new THREE.MeshStandardMaterial({ color: lin(0xf2f4f7), metalness: 1, roughness: 0.12 }),
    dark: () => new THREE.MeshStandardMaterial({ color: lin(0x16161b), metalness: 0.2, roughness: 0.6 }),
    gold: () => new THREE.MeshStandardMaterial({ color: lin(0xf0c064), metalness: 1, roughness: 0.24 }),
    brass: () => new THREE.MeshStandardMaterial({ color: lin(0xe2b86a), metalness: 1, roughness: 0.28 }),
    steel: () => new THREE.MeshStandardMaterial({ color: lin(0xe8ecf0), metalness: 1, roughness: 0.08 }),
    lacquer: (color, rough) => new THREE.MeshPhysicalMaterial({
      color: lin(color), roughness: rough == null ? 0.38 : rough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1
    })
  };

  // ── Studio lighting ────────────────────────────────────────────────────
  /* A soft photo-studio room baked into a prefiltered environment map: a
     big overhead softbox, a key strip and a dim fill. Glossy and metal
     parts reflect it, which is most of what makes them read as real. */
  function studioEnvironment(renderer) {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(
      new THREE.SphereGeometry(30, 32, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.33, 0.36), side: THREE.BackSide })));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.1, 0.11) }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -4;
    env.add(floor);
    const panel = (w, h, x, y, z, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 0.97), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(14, 10, 0, 14, 2, 3.2);    // overhead softbox
    panel(5, 12, 13, 5, 7, 5.0);     // key strip, front right
    panel(8, 6, -13, 4, -3, 1.2);    // fill, back left
    panel(10, 3, 0, 3, 15, 0.8);     // low front bounce, lights the faces toward camera
    const pmrem = new THREE.PMREMGenerator(renderer);
    const tex = pmrem.fromScene(env, 0.035).texture;
    pmrem.dispose();
    return tex;
  }

  function createStage(canvas, opts) {
    opts = opts || {};
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.exposure || 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (opts.clipping) renderer.localClippingEnabled = true;
    const scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    const camera = new THREE.PerspectiveCamera(opts.fov || 30, 1, 0.1, 200);
    const st = { renderer, scene, camera, w: 0, h: 0 };
    st.resize = (w, h) => {
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      if (w === st.w && h === st.h) return false;
      st.w = w; st.h = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      return true;
    };
    st.render = () => renderer.render(scene, camera);
    return st;
  }

  function shadowLight(scene, pos, span, intensity) {
    const key = new THREE.DirectionalLight(0xfff4e6, intensity == null ? 1 : intensity);
    key.position.set(pos[0], pos[1], pos[2]);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera;
    c.left = -span; c.right = span; c.top = span; c.bottom = -span;
    c.near = 0.5; c.far = 60;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(key.target);
    return key;
  }

  // ── Geometry ───────────────────────────────────────────────────────────
  /* A box whose grid lines are pushed into the edge bands, then wrapped
     onto a rounded box: every vertex is pulled back onto a sphere of
     radius r around the nearest point of the inner core. Normals come out
     exact. UVs are re-spaced to match (used by the die's face textures). */
  function roundedBox(w, h, d, r, bandSegs) {
    bandSegs = bandSegs || 5;
    const seg = bandSegs * 2 + 1;
    const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    const half = [w / 2, h / 2, d / 2];
    const remap = (u, hs) => {
      const i = Math.round((u + hs) / (2 * hs) * seg);
      return i <= bandSegs ? -hs + r * (i / bandSegs) : hs - r * ((seg - i) / bandSegs);
    };
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    const q = new THREE.Vector3(), c = new THREE.Vector3(), dv = new THREE.Vector3();
    const cube = w === h && h === d;
    for (let i = 0; i < pos.count; i++) {
      q.set(remap(pos.getX(i), half[0]), remap(pos.getY(i), half[1]), remap(pos.getZ(i), half[2]));
      c.set(
        Math.max(-(half[0] - r), Math.min(half[0] - r, q.x)),
        Math.max(-(half[1] - r), Math.min(half[1] - r, q.y)),
        Math.max(-(half[2] - r), Math.min(half[2] - r, q.z)));
      dv.subVectors(q, c).normalize();
      pos.setXYZ(i, c.x + dv.x * r, c.y + dv.y * r, c.z + dv.z * r);
      nor.setXYZ(i, dv.x, dv.y, dv.z);
      if (cube) uv.setXY(i, (remap(uv.getX(i) * 2 - 1, 1) + 1) / 2, (remap(uv.getY(i) * 2 - 1, 1) + 1) / 2);
    }
    return geo;
  }

  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function roundedRectPath(w, h, r) {
    const p = new THREE.Path();
    const x = -w / 2, y = -h / 2;
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
    p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
    p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
    return p;
  }

  // Row of bulbs with a soft halo each; intensity is set per bulb every tick.
  function bulbString(parent, points, radius, glowTex) {
    const geo = new THREE.SphereGeometry(radius, 16, 12);
    const bulbs = points.map(p => {
      const mat = new THREE.MeshStandardMaterial({ color: lin(0xfff3d0), emissive: lin(0xffb52e), emissiveIntensity: 1, roughness: 0.25 });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(p);
      parent.add(m);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
      halo.position.copy(p);
      halo.scale.setScalar(radius * 9);
      parent.add(halo);
      return { mat, halo };
    });
    return {
      set(k, v) { // v in [0, 1]
        const b = bulbs[k];
        b.mat.emissiveIntensity = 0.05 + 2.2 * v;
        b.mat.color.setRGB(0.35 + 0.65 * v, 0.3 + 0.6 * v, 0.22 + 0.4 * v);
        b.halo.material.opacity = 0.05 + 0.9 * v;
      },
      count: bulbs.length
    };
  }

  // Chasing-lights pattern shared by the wheel and the slot marquee.
  function chase(k, count, t, mode) {
    if (mode === 'still') return 1;
    if (mode === 'party') return (Math.floor(t * 9) + k) % 2 ? 1 : 0.1;
    const phase = ((k / count) * 4 - t * (mode === 'fast' ? 5 : 1.3)) % 1;
    const p = phase < 0 ? phase + 1 : phase;
    return 0.25 + 0.75 * Math.pow(Math.max(0, Math.cos(p * TAU)), 6);
  }

  // ════════════════════════════════════════════════════════════════════
  // WHEEL
  // ════════════════════════════════════════════════════════════════════
  /* A lacquered prize wheel mounted on a wall: a gold frame ring studded
     with bulbs stays put, the painted disc turns inside it, and a sprung
     red flapper at twelve o'clock clicks over the chrome pegs that divide
     the segments. Rotation is set in degrees clockwise, the same angle the
     2D wheel uses, so the landing maths is shared. */
  function Wheel(canvas) {
    const st = createStage(canvas, { fov: 26, exposure: 0.82 });
    const { scene, camera } = st;
    const R = 2;
    camera.position.set(0.7, 0.55, 11.6);
    camera.lookAt(0, 0.08, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a44, 0.35));
    const key = shadowLight(scene, [-3.2, 4.8, 9], 3.6, 1.05);

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.22 }));
    wall.position.z = -0.55;
    wall.receiveShadow = true;
    scene.add(wall);

    // Static frame: a navy backing ring and a gold tube, with bulbs set into it.
    const backing = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.5, R + 0.5, 0.26, 160).rotateX(Math.PI / 2),
      mats.lacquer(0x101a33, 0.45));
    backing.position.z = -0.24;
    backing.castShadow = true; backing.receiveShadow = true;
    scene.add(backing);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(R + 0.3, 0.13, 32, 220), mats.gold());
    frame.position.z = -0.02;
    frame.castShadow = true; frame.receiveShadow = true;
    scene.add(frame);
    const glow = glowTexture();
    const bulbPts = [];
    const BULBS = 24;
    for (let k = 0; k < BULBS; k++) {
      const a = Math.PI / 2 - (k / BULBS) * TAU;
      bulbPts.push(new THREE.Vector3(Math.cos(a) * (R + 0.3), Math.sin(a) * (R + 0.3), 0.12));
    }
    const bulbs = bulbString(scene, bulbPts, 0.07, glow);

    // Turning disc.
    const wheel = new THREE.Group();
    scene.add(wheel);
    const faceCanvas = makeCanvas(2048, 2048);
    const faceTex = colorTexture(faceCanvas, 16);
    const face = new THREE.Mesh(new THREE.CircleGeometry(R, 180),
      new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.5, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.8 }));
    face.position.z = 0.12;
    face.receiveShadow = true;
    wheel.add(face);
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.24, 180, 1, true).rotateX(Math.PI / 2), mats.gold());
    edge.castShadow = true;
    wheel.add(edge);
    const bead = new THREE.Mesh(new THREE.TorusGeometry(R - 0.012, 0.035, 12, 220), mats.chrome());
    bead.position.z = 0.12;
    wheel.add(bead);
    const hubRing = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.1, 64).rotateX(Math.PI / 2), mats.gold());
    hubRing.position.z = 0.17;
    hubRing.castShadow = true;
    wheel.add(hubRing);
    const hubDome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 48, 24, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), mats.chrome());
    hubDome.scale.z = 0.55;
    hubDome.position.z = 0.21;
    hubDome.castShadow = true;
    wheel.add(hubDome);

    let pegs = null, pegHeads = null;
    const PEG_R = R - 0.1;
    function buildPegs(n) {
      if (pegs) { wheel.remove(pegs); wheel.remove(pegHeads); pegs.geometry.dispose(); pegHeads.geometry.dispose(); }
      if (n < 1) { pegs = pegHeads = null; return; }
      const thin = n > 40 ? 0.6 : 1;
      pegs = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.026 * thin, 0.026 * thin, 0.24, 12).rotateX(Math.PI / 2), mats.chrome(), n);
      pegHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.042 * thin, 16, 12), mats.chrome(), n);
      const m = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 - (i / n) * TAU; // boundary i, clockwise from twelve o'clock
        const x = Math.cos(a) * PEG_R, y = Math.sin(a) * PEG_R;
        m.makeTranslation(x, y, 0.24); pegs.setMatrixAt(i, m);
        m.makeTranslation(x, y, 0.36); pegHeads.setMatrixAt(i, m);
      }
      pegs.castShadow = pegHeads.castShadow = true;
      wheel.add(pegs); wheel.add(pegHeads);
    }

    // Flapper: a bevelled teardrop hanging from a chrome pin above the rim.
    const flapShape = new THREE.Shape();
    flapShape.moveTo(0, -0.6);
    flapShape.bezierCurveTo(0.07, -0.44, 0.19, -0.2, 0.19, 0);
    flapShape.absarc(0, 0, 0.19, 0, Math.PI, false);
    flapShape.bezierCurveTo(-0.19, -0.2, -0.07, -0.44, 0, -0.6);
    const flapGeo = new THREE.ExtrudeGeometry(flapShape, {
      depth: 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 8, curveSegments: 40
    });
    const flapper = new THREE.Group();
    flapper.position.set(0, R + 0.3, 0.36);
    const flapMesh = new THREE.Mesh(flapGeo, mats.lacquer(0xc8141f, 0.3));
    flapMesh.castShadow = true;
    flapper.add(flapMesh);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 24).rotateX(Math.PI / 2), mats.chrome());
    pin.position.z = 0.03;
    flapper.add(pin);
    const pinCap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), mats.chrome());
    pinCap.position.z = 0.18;
    flapper.add(pinCap);
    scene.add(flapper);

    let n = 0;
    let flap = 0, flapVel = 0, lastDeg = null;
    const FLAP_MAX = 0.55;

    function drawFace(labels, colors) {
      const S = faceCanvas.width, g = faceCanvas.getContext('2d');
      const cx = S / 2, cy = S / 2, r = S / 2;
      g.clearRect(0, 0, S, S);
      n = labels.length;
      if (!n) {
        g.fillStyle = '#d9dde4';
        g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
        g.fillStyle = '#5b6472';
        g.font = '700 84px "DM Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('Add choices to build the wheel', cx, cy + r * 0.45);
        faceTex.needsUpdate = true;
        return;
      }
      const seg = TAU / n;
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + i * seg, a1 = a0 + seg;
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath();
        g.fillStyle = colors[i];
        g.fill();
        // Soft falloff toward the rim, like paint under lacquer.
        const shadeGrad = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
        shadeGrad.addColorStop(0, 'rgba(255,255,255,0.14)');
        shadeGrad.addColorStop(0.6, 'rgba(255,255,255,0)');
        shadeGrad.addColorStop(1, 'rgba(0,0,0,0.16)');
        g.fillStyle = shadeGrad;
        g.fill();
      }
      // Gold dividers with a dark hairline so they read as inlay, not paint.
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i * seg;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        g.lineCap = 'round';
        g.strokeStyle = 'rgba(60,40,10,0.45)'; g.lineWidth = n > 40 ? 6 : 13;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke();
        g.strokeStyle = '#e9c979'; g.lineWidth = n > 40 ? 3 : 8;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke();
      }
      const rim = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r);
      rim.addColorStop(0, 'rgba(0,0,0,0)');
      rim.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = rim;
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();

      // Labels run along the radius, flipped on the left half so none reads upside down.
      const outer = r * 0.84, inner = r * 0.25;
      const chord = 2 * (r * 0.62) * Math.sin(Math.min(seg, Math.PI) / 2);
      const maxPx = Math.max(30, Math.min(104, chord * 0.62));
      for (let i = 0; i < n; i++) {
        const mid = -Math.PI / 2 + (i + 0.5) * seg;
        const fit = fitLabel(g, labels[i], outer - inner, maxPx, Math.min(maxPx, 30), 800, '"DM Sans", sans-serif');
        g.save();
        g.translate(cx, cy);
        g.rotate(mid);
        const flipped = Math.cos(mid) < 0;
        if (flipped) g.rotate(Math.PI);
        g.textAlign = flipped ? 'left' : 'right';
        g.textBaseline = 'middle';
        g.font = `800 ${fit.px}px "DM Sans", sans-serif`;
        const light = luminance(colors[i]) > 0.6;
        g.fillStyle = light ? '#15202e' : '#ffffff';
        if (!light) { g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 8; g.shadowOffsetY = 3; }
        g.fillText(fit.text, flipped ? -outer : outer, 0);
        g.restore();
      }
      faceTex.needsUpdate = true;
    }

    /* Flapper physics: the peg that is passing twelve o'clock pushes the
       flapper aside (it cannot sit inside the peg), and once the peg slips
       past, a damped spring swings it back with a little wobble. */
    function stepFlapper(deg, dt) {
      if (lastDeg === null) lastDeg = deg;
      const moving = deg - lastDeg;
      lastDeg = deg;
      if (!n) return;
      const seg = 360 / n;
      const m = ((deg % seg) + seg) % seg;             // degrees since the last peg passed the top
      const w = Math.min(3.2, seg * 0.14);              // contact width, clear of the landing zone
      const c = m > seg / 2 ? m - seg : m;              // signed peg offset: negative = still coming
      let target = 0;
      if (moving >= 0 && c > -w && c < w * 0.35) target = FLAP_MAX * (c + w) / (1.35 * w);
      const sub = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / sub;
      for (let s = 0; s < sub; s++) {
        flapVel += (-900 * flap - 16 * flapVel) * h;
        flap += flapVel * h;
      }
      if (flap < target) {
        flapVel = Math.max(flapVel, (target - flap) / Math.max(dt, 1e-3));
        flap = target;
      }
      flapper.rotation.z = flap;
    }

    let faceKey = '';
    return {
      stage: st,
      setSegments(labels, colors) {
        const k = JSON.stringify([labels, colors]);
        if (k === faceKey) return;
        faceKey = k;
        drawFace(labels, colors);
        buildPegs(labels.length);
      },
      setRotation(deg, dt) {
        wheel.rotation.z = -deg * Math.PI / 180;
        if (dt != null) stepFlapper(deg, dt); else lastDeg = deg;
      },
      settleFlapper(dt) { stepFlapper(lastDeg == null ? 0 : lastDeg, dt); return Math.abs(flap) > 0.002 || Math.abs(flapVel) > 0.02; },
      setTheme(light) { wall.material.opacity = light ? 0.2 : 0.42; },
      tick(t, mode) { for (let k = 0; k < bulbs.count; k++) bulbs.set(k, chase(k, bulbs.count, t, mode)); },
      resize: st.resize,
      render: st.render,
      key
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // SLOT MACHINE
  // ════════════════════════════════════════════════════════════════════
  /* A three-reel cabinet: cherry lacquer body, chrome bezel and glass over
     the reels, a lit marquee with chasing bulbs, and a pull lever on the
     side. Each reel is a real cylinder with the choices printed round it;
     a reel's angle is set from the same pixel position the 2D reels use,
     so the stop maths in script.js drives both. */
  const REEL_MIN_SYMBOLS = 12;
  function reelGeometry(width, radius, segs) {
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * TAU, s = Math.sin(a), c = Math.cos(a);
      for (let j = 0; j <= 1; j++) {
        pos.push((j - 0.5) * width, radius * s, radius * c);
        nor.push(0, s, c);
        uv.push(j, i / segs);
      }
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, d, a, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    return geo;
  }

  function SlotMachine(canvas) {
    const st = createStage(canvas, { fov: 30, exposure: 1.0, clipping: true });
    const { scene, camera } = st;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x302a2a, 0.4));
    const key = shadowLight(scene, [-4, 7, 9], 5, 1.0);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.18 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.62;
    floor.receiveShadow = true;
    scene.add(floor);

    const machine = new THREE.Group();
    scene.add(machine);
    const W = 4.3, H = 4.9, D = 2.2;
    const bodyY = -0.17; // body spans y -2.62 .. 2.28, front face at z = 0
    const cherry = mats.lacquer(0x7d0f1b, 0.34);
    const body = new THREE.Mesh(roundedBox(W, H, D, 0.28, 6), cherry);
    body.position.set(0, bodyY, -D / 2);
    body.castShadow = true; body.receiveShadow = true;
    machine.add(body);

    // Chrome pinstripes up the front corners.
    const trimMat = mats.chrome();
    for (const sx of [-1, 1]) {
      const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, H - 0.7, 16), trimMat);
      trim.position.set(sx * (W / 2 - 0.08), bodyY, -0.06);
      machine.add(trim);
    }

    // Marquee on top, lit from inside.
    const topY = bodyY + H / 2;
    const marquee = new THREE.Mesh(roundedBox(W + 0.2, 1.05, D - 0.1, 0.22, 5), mats.lacquer(0x1b1b22, 0.3));
    marquee.position.set(0, topY + 0.5, -D / 2 + 0.02);
    marquee.castShadow = true;
    machine.add(marquee);
    const signCanvas = makeCanvas(1024, 200);
    {
      const g = signCanvas.getContext('2d');
      const bg = g.createLinearGradient(0, 0, 0, 200);
      bg.addColorStop(0, '#3a0b12'); bg.addColorStop(0.5, '#6d0f1c'); bg.addColorStop(1, '#2a070d');
      g.fillStyle = bg; g.fillRect(0, 0, 1024, 200);
      g.font = '900 118px "DM Sans", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,190,60,0.9)'; g.shadowBlur = 26;
      const gold = g.createLinearGradient(0, 40, 0, 160);
      gold.addColorStop(0, '#fff3c4'); gold.addColorStop(0.45, '#f6c343'); gold.addColorStop(1, '#b8791b');
      g.fillStyle = gold;
      g.fillText('LUCKY PICK', 512, 106);
      g.shadowBlur = 0;
      g.lineWidth = 3; g.strokeStyle = 'rgba(80,30,0,0.6)';
      g.strokeText('LUCKY PICK', 512, 106);
    }
    const signTex = colorTexture(signCanvas);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 0.72),
      new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.4 }));
    sign.position.set(0, topY + 0.5, 0.005);
    machine.add(sign);
    const glow = glowTexture();
    const mPts = [];
    const MB = 14;
    for (let k = 0; k < MB; k++) mPts.push(new THREE.Vector3(-1.95 + (3.9 * k) / (MB - 1), topY + 0.93, 0.06));
    for (let k = 0; k < MB; k++) mPts.push(new THREE.Vector3(1.95 - (3.9 * k) / (MB - 1), topY + 0.07, 0.06));
    const bulbs = bulbString(machine, mPts, 0.055, glow);

    // Reel window: dark backing, chrome bezel, glass.
    const winY = 0.62, WW = 3.36, WH = 1.95, CELL = WH / 3, BEZEL_D = 0.7;
    const backing = new THREE.Mesh(new THREE.PlaneGeometry(WW + 0.1, WH + 0.1), new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.9 }));
    backing.position.set(0, winY, 0.004);
    machine.add(backing);
    const bezelShape = roundedRectShape(WW + 0.46, WH + 0.46, 0.26);
    bezelShape.holes.push(roundedRectPath(WW, WH, 0.1));
    // A dark housing the reels sit inside, faced with a bevelled chrome frame.
    const tunnelShape = roundedRectShape(WW + 0.3, WH + 0.3, 0.2);
    tunnelShape.holes.push(roundedRectPath(WW, WH, 0.1));
    const tunnel = new THREE.Mesh(new THREE.ExtrudeGeometry(tunnelShape, { depth: BEZEL_D - 0.08, bevelEnabled: false, curveSegments: 16 }), mats.dark());
    tunnel.position.set(0, winY, 0);
    tunnel.castShadow = true;
    machine.add(tunnel);
    const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(bezelShape, {
      depth: 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 6, curveSegments: 16
    }), mats.chrome());
    bezel.position.set(0, winY, BEZEL_D - 0.1);
    bezel.castShadow = true;
    machine.add(bezel);

    // Reels are clipped to the window so only the arc behind the glass shows.
    const clip = [
      new THREE.Plane(new THREE.Vector3(0, -1, 0), winY + WH / 2),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -(winY - WH / 2))
    ];
    const REEL_W = 1.04, REEL_GAP = 0.12, REEL_FRONT = BEZEL_D - 0.1;
    const reels = [0, 1, 2].map(i => ({
      x: (i - 1) * (REEL_W + REEL_GAP),
      mesh: null, sharp: null, blurred: null, M: 0, flashT: -1
    }));

    // Inner shadow at the top and bottom lip of the window.
    const lipCanvas = makeCanvas(8, 128);
    {
      const g = lipCanvas.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, 'rgba(0,0,0,0.72)'); grad.addColorStop(0.22, 'rgba(0,0,0,0.12)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0)');
      grad.addColorStop(0.78, 'rgba(0,0,0,0.12)'); grad.addColorStop(1, 'rgba(0,0,0,0.72)');
      g.fillStyle = grad; g.fillRect(0, 0, 8, 128);
    }
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH),
      new THREE.MeshBasicMaterial({ map: colorTexture(lipCanvas), transparent: true, depthWrite: false }));
    lip.position.set(0, winY, REEL_FRONT + 0.02);
    machine.add(lip);

    // Payline: two hairlines framing the winning row (a line through the middle
    // would read as a strikethrough on the name), with arrow tabs on the bezel.
    const payMat = new THREE.MeshStandardMaterial({ color: lin(0xff2d3a), emissive: lin(0xff1426), emissiveIntensity: 0.55, roughness: 0.4 });
    const payLineMat = new THREE.MeshBasicMaterial({ color: lin(0xff2233), transparent: true, opacity: 0.6 });
    for (const sy of [-1, 1]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(WW, 0.014, 0.01), payLineMat);
      line.position.set(0, winY + sy * CELL * 0.5, REEL_FRONT + 0.03);
      machine.add(line);
    }
    const arrow = new THREE.Shape();
    arrow.moveTo(0, 0.13); arrow.lineTo(0.2, 0); arrow.lineTo(0, -0.13); arrow.lineTo(0, 0.13);
    const arrowGeo = new THREE.ExtrudeGeometry(arrow, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 });
    for (const sx of [-1, 1]) {
      const a = new THREE.Mesh(arrowGeo, payMat);
      a.position.set(sx * (WW / 2 + 0.2), winY, BEZEL_D + 0.06);
      a.rotation.z = sx < 0 ? 0 : Math.PI;
      machine.add(a);
    }

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1, envMapIntensity: 1.6, depthWrite: false
    }));
    glass.position.set(0, winY, BEZEL_D + 0.02);
    machine.add(glass);
    const streakCanvas = makeCanvas(256, 256);
    {
      const g = streakCanvas.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, 'rgba(255,255,255,0.0)');
      grad.addColorStop(0.18, 'rgba(255,255,255,0.20)');
      grad.addColorStop(0.3, 'rgba(255,255,255,0.03)');
      grad.addColorStop(0.42, 'rgba(255,255,255,0.10)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    }
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH),
      new THREE.MeshBasicMaterial({ map: colorTexture(streakCanvas), transparent: true, depthWrite: false }));
    streak.position.set(0, winY, BEZEL_D + 0.022);
    machine.add(streak);

    // Control deck: a sloped panel with three buttons.
    const deck = new THREE.Mesh(roundedBox(W - 0.3, 0.7, 0.62, 0.12, 4), mats.lacquer(0x1b1b22, 0.3));
    deck.position.set(0, -1.02, 0.34);
    deck.rotation.x = 0.42;
    deck.castShadow = true; deck.receiveShadow = true;
    machine.add(deck);
    [[-1.0, 0xffc233], [0, 0x2fbf5a], [1.0, 0xff3b3b]].forEach(([x, col]) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.1, 32),
        new THREE.MeshPhysicalMaterial({ color: lin(col), emissive: lin(col), emissiveIntensity: 0.3, roughness: 0.2, clearcoat: 1 }));
      b.position.set(x, 0.37, 0); // on the deck's top face, tilted with it
      b.castShadow = true;
      deck.add(b);
    });

    // Coin tray.
    const tray = new THREE.Mesh(roundedBox(3.1, 0.42, 0.9, 0.14, 4), mats.chrome());
    tray.position.set(0, -2.12, 0.28);
    tray.castShadow = true; tray.receiveShadow = true;
    machine.add(tray);
    const trayIn = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.62), new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.8 }));
    trayIn.rotation.x = -Math.PI / 2;
    trayIn.position.set(0, -1.905, 0.3);
    machine.add(trayIn);
    const slotPlate = new THREE.Mesh(roundedBox(0.9, 0.5, 0.08, 0.04, 3), mats.chrome());
    slotPlate.position.set(1.35, -1.68, 0.03);
    machine.add(slotPlate);
    const coinSlit = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.3), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    coinSlit.position.set(1.35, -1.68, 0.075);
    machine.add(coinSlit);

    // Lever on the right flank, pivoting toward the player.
    const lever = new THREE.Group();
    lever.position.set(W / 2 + 0.2, 0.05, -1.0);
    machine.add(lever);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.34, 40).rotateZ(Math.PI / 2), mats.chrome());
    hub.castShadow = true;
    const hubMount = new THREE.Group();
    hubMount.position.copy(lever.position);
    hubMount.add(hub);
    machine.add(hubMount);
    const arm = new THREE.Group();
    arm.position.x = 0.2;
    lever.add(arm);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 2.3, 24), mats.chrome());
    rod.position.y = 1.15;
    rod.castShadow = true;
    arm.add(rod);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 24), mats.chrome());
    collar.position.y = 0.12;
    arm.add(collar);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.29, 48, 32), mats.lacquer(0xd0101c, 0.22));
    knob.position.y = 2.42;
    knob.castShadow = true;
    arm.add(knob);
    const LEVER_REST = -0.14, LEVER_PULLED = 1.15;
    lever.rotation.x = LEVER_REST;
    let pullT0 = -1;

    camera.position.set(4.4, 2.4, 12.2);
    camera.lookAt(0.3, 0.3, 0);

    function buildReelTexture(slots, labelColors, cellPx, blurred) {
      const Wpx = 256, M = slots.length;
      const c = makeCanvas(Wpx, M * cellPx);
      const g = c.getContext('2d');
      g.fillStyle = '#f4efe3';
      g.fillRect(0, 0, Wpx, c.height);
      for (let k = 0; k < M; k++) {
        const row = M - 1 - k; // slot k sits above slot k-1 on the reel
        const y0 = row * cellPx;
        const band = g.createLinearGradient(0, y0, 0, y0 + cellPx);
        band.addColorStop(0, 'rgba(0,0,0,0.05)'); band.addColorStop(0.5, 'rgba(255,255,255,0.05)'); band.addColorStop(1, 'rgba(0,0,0,0.05)');
        g.fillStyle = band; g.fillRect(0, y0, Wpx, cellPx);
        g.fillStyle = 'rgba(80,60,30,0.22)';
        g.fillRect(14, y0, Wpx - 28, Math.max(1, cellPx * 0.012));
        const { lines, px } = wrapLabel(g, slots[k].label, Wpx - 26, Math.round(cellPx * 0.36), Math.max(10, Math.round(cellPx * 0.17)), 2, 800, '"DM Sans", sans-serif');
        g.font = `800 ${px}px "DM Sans", sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = slots[k].color;
        const lh = px * 1.08;
        lines.forEach((ln, li) => g.fillText(ln, Wpx / 2, y0 + cellPx / 2 + (li - (lines.length - 1) / 2) * lh));
      }
      if (!blurred) return c;
      // Vertical smear for motion blur, wrapping round the reel.
      const b = makeCanvas(Wpx, c.height);
      const bg = b.getContext('2d');
      const taps = 11, spread = cellPx * 0.55;
      for (let s = 0; s < taps; s++) {
        const dy = (s / (taps - 1) - 0.5) * spread;
        bg.globalAlpha = 1 / taps * 1.6;
        bg.drawImage(c, 0, dy); bg.drawImage(c, 0, dy - c.height); bg.drawImage(c, 0, dy + c.height);
      }
      bg.globalAlpha = 1;
      return b;
    }

    function setReels(slotLists, labelColors) {
      reels.forEach((rl, i) => {
        if (rl.mesh) {
          machine.remove(rl.mesh);
          rl.mesh.geometry.dispose();
          rl.sharp.dispose(); rl.blurred.dispose(); rl.mesh.material.dispose();
          rl.mesh = null;
        }
        const slots = slotLists[i];
        const M = slots.length;
        rl.M = M;
        if (!M) return;
        const cellPx = Math.max(40, Math.min(168, Math.floor(4096 / M)));
        rl.sharp = colorTexture(buildReelTexture(slots, labelColors, cellPx, false));
        rl.blurred = colorTexture(buildReelTexture(slots, labelColors, cellPx, true));
        [rl.sharp, rl.blurred].forEach(t => { t.wrapT = THREE.RepeatWrapping; });
        const radius = (M * CELL) / TAU;
        rl.radius = radius;
        const mat = new THREE.MeshStandardMaterial({
          map: rl.sharp, roughness: 0.55, metalness: 0, clippingPlanes: clip, emissive: 0xffffff, emissiveIntensity: 0
        });
        rl.mesh = new THREE.Mesh(reelGeometry(REEL_W, radius, Math.max(96, M * 10)), mat);
        rl.mesh.position.set(rl.x, winY, REEL_FRONT - radius);
        rl.mesh.receiveShadow = true;
        machine.add(rl.mesh);
      });
    }

    // Raycast for clicks on the lever.
    const ray = new THREE.Raycaster();
    const leverParts = [rod, knob, collar, hub];

    let wobble = null;
    return {
      stage: st,
      setReels,
      /* pos is the 2D reel's pixel offset; slot (pos/itemH + 1) is on the
         payline there, so the same slot is turned to face the player. */
      setReel(i, pos, itemH, speed) {
        const rl = reels[i];
        if (!rl.mesh) return;
        rl.mesh.rotation.x = (pos / itemH + 1.5) * TAU / rl.M;
        const blur = speed > 900;
        if ((rl.mesh.material.map === rl.blurred) !== blur) {
          rl.mesh.material.map = blur ? rl.blurred : rl.sharp;
          rl.mesh.material.needsUpdate = true;
        }
      },
      flashReel(i, now) { reels[i].flashT = now; },
      pull(now) { pullT0 = now; },
      shake(now, kind) { wobble = { t0: now, kind }; },
      hitsLever(clientX, clientY) {
        const r = st.renderer.domElement.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
        return ray.intersectObjects(leverParts, false).length > 0;
      },
      tick(now, mode) {
        const t = now / 1000;
        for (let k = 0; k < bulbs.count; k++) bulbs.set(k, chase(k, bulbs.count, t, mode));
        payMat.emissiveIntensity = mode === 'party' ? (Math.floor(t * 6) % 2 ? 1.6 : 0.4) : 0.55;
        // Lever: a quick yank down, then a springy return.
        if (pullT0 >= 0) {
          const e = now - pullT0;
          let a;
          if (e < 190) { const u = e / 190; a = LEVER_REST + (LEVER_PULLED - LEVER_REST) * (1 - Math.pow(1 - u, 3)); }
          else if (e < 900) {
            const u = (e - 190) / 710;
            a = LEVER_REST + (LEVER_PULLED - LEVER_REST) * Math.exp(-5.5 * u) * Math.cos(u * 9);
          } else { a = LEVER_REST; pullT0 = -1; }
          lever.rotation.x = a;
        }
        reels.forEach(rl => {
          if (!rl.mesh) return;
          const e = rl.flashT >= 0 ? (now - rl.flashT) / 320 : 1;
          rl.mesh.material.emissiveIntensity = e < 1 ? 0.35 * (1 - e) : 0;
          if (e >= 1) rl.flashT = -1;
        });
        // Win shimmy or losing slump, applied to the whole machine.
        machine.position.set(0, 0, 0);
        machine.rotation.z = 0;
        if (wobble) {
          const e = (now - wobble.t0) / (wobble.kind === 'win' ? 520 : 600);
          if (e >= 1) wobble = null;
          else if (wobble.kind === 'win') machine.position.x = Math.sin(e * Math.PI * 6) * 0.07 * (1 - e);
          else { machine.position.y = -Math.sin(e * Math.PI) * 0.07; machine.rotation.z = Math.sin(e * Math.PI * 2) * 0.008 * (1 - e); }
        }
        return pullT0 >= 0 || wobble !== null || reels.some(rl => rl.flashT >= 0);
      },
      setTheme(light) { floor.material.opacity = light ? 0.16 : 0.36; },
      resize: st.resize,
      render: st.render
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // GALTON BOARD
  // ════════════════════════════════════════════════════════════════════
  /* A wooden bean machine under glass: brass pins, a hopper at the top,
     bins with dividers, and polished steel balls that pile up in the bins
     like the real thing. The board is laid out in the same pixel
     coordinates as the 2D board (galtonLayout in script.js) and mapped
     1 px = 0.01 world units, so the falling-ball paths are shared. */
  function GaltonBoard(canvas) {
    const st = createStage(canvas, { fov: 22, exposure: 1.0 });
    const { scene, camera } = st;
    const K = 0.01;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3228, 0.45));
    const key = shadowLight(scene, [-2.2, 4.5, 6], 4, 1.1);

    const root = new THREE.Group();
    scene.add(root);
    let L = null;          // layout in px
    let theme = { light: true };
    let boardMesh = null, pins = null, dividers = null, rails = [], plate = null, hopper = [];
    const plateCanvas = makeCanvas(2048, 160);
    const plateTex = colorTexture(plateCanvas);
    const steel = mats.steel();
    const ballGeo = new THREE.SphereGeometry(1, 32, 20);
    const flying = new THREE.InstancedMesh(ballGeo, steel, 64);
    flying.castShadow = true;
    flying.count = 0;
    root.add(flying);
    const STACK_MAX = 4000;
    const stacked = new THREE.InstancedMesh(ballGeo, steel, STACK_MAX);
    stacked.castShadow = true; stacked.receiveShadow = true;
    stacked.count = 0;
    root.add(stacked);
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.07, envMapIntensity: 1.4, depthWrite: false });
    let glass = null, streak = null;

    const wx = x => (x - L.cssW / 2) * K;
    const wy = y => (L.cssH / 2 - y) * K;

    function woodCanvas(w, h, light) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const base = light ? '#d8b98a' : '#5b3a25';
      const dark = light ? '120,80,40' : '25,12,6';
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      // Deterministic grain so a redraw does not reshuffle the board.
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 340; i++) {
        const y = rnd() * h, amp = 2 + rnd() * 9, fq = 0.0015 + rnd() * 0.005, ph = rnd() * TAU;
        g.strokeStyle = `rgba(${dark},${0.035 + rnd() * 0.09})`;
        g.lineWidth = 0.6 + rnd() * 2.4;
        g.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const yy = y + Math.sin(x * fq + ph) * amp + Math.sin(x * fq * 3.3 + ph * 2) * amp * 0.3;
          if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
        }
        g.stroke();
      }
      const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
      vig.addColorStop(0, 'rgba(255,255,255,0.06)'); vig.addColorStop(1, 'rgba(0,0,0,0.22)');
      g.fillStyle = vig; g.fillRect(0, 0, w, h);
      return c;
    }

    function clearBoard() {
      [boardMesh, pins, dividers, plate, glass, streak, ...rails, ...hopper].forEach(o => {
        if (!o) return;
        root.remove(o);
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material !== glassMat && o.material !== steel) {
          if (o.material.map && o.material.map !== plateTex) o.material.map.dispose();
          o.material.dispose();
        }
      });
      boardMesh = pins = dividers = plate = glass = streak = null;
      rails = []; hopper = [];
    }

    function ballRadiusPx() { return Math.max(3, Math.min(9, L.slot * 0.3, (L.binBottomY - L.binTopY) / 12)); }

    // Stack geometry per bin: hex-packed columns sitting on the bin floor. At
    // most three columns, so piles grow upward and read as a histogram.
    function stackSpec() {
      const r = ballRadiusPx();
      const inner = Math.max(2 * r, L.slot - 5);
      const cols = Math.max(1, Math.min(3, Math.floor(inner / (2 * r))));
      const rowH = cols > 1 ? r * 1.74 : r * 2;
      const binH = L.binBottomY - L.binTopY;
      const rowsFit = Math.max(1, Math.floor((binH - 2) / rowH));
      return { r, cols, rowH, rowsFit, cap: cols * rowsFit };
    }
    function slotPx(bin, idx) {
      const s = stackSpec();
      const row = Math.floor(idx / s.cols), col = idx % s.cols;
      const odd = s.cols > 1 && row % 2 === 1;
      const colsHere = odd ? s.cols - 1 : s.cols;
      const c = odd ? Math.min(col, colsHere - 1) : col;
      const x = L.pegX(L.rows, bin) + (c - (colsHere - 1) / 2) * 2 * s.r;
      const y = L.binBottomY - s.r - 1 - row * s.rowH;
      return { x, y: Math.max(L.binTopY + s.r, y) };
    }

    function build(layout, light) {
      L = layout;
      theme.light = light;
      clearBoard();
      const Wd = L.cssW * K, Hd = L.cssH * K;
      // Camera fitted so the board plane fills the canvas exactly.
      camera.fov = 22;
      const tanH = Math.tan((camera.fov * Math.PI / 180) / 2);
      const dist = Math.max(Hd / 2 / tanH, Wd / 2 / (tanH * camera.aspect)) * 1.0;
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      key.position.set(-Wd * 0.45, Hd * 0.9, dist * 0.8);

      const woodTex = colorTexture(woodCanvas(1024, Math.round(1024 * L.cssH / L.cssW), light));
      boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(Wd, Hd),
        new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55, metalness: 0 }));
      boardMesh.receiveShadow = true;
      root.add(boardMesh);

      // Frame rails, a touch darker than the board.
      const railMat = mats.lacquer(light ? 0x7a4a26 : 0x3b2415, 0.4);
      const t = 12 * K, dep = 0.34;
      [[0, Hd / 2 - t / 2, Wd, t], [0, -Hd / 2 + t / 2, Wd, t], [-Wd / 2 + t / 2, 0, t, Hd], [Wd / 2 - t / 2, 0, t, Hd]].forEach(([x, y, w, h]) => {
        const m = new THREE.Mesh(roundedBox(w, h, dep, 0.035, 3), railMat);
        m.position.set(x, y, dep / 2);
        m.castShadow = true; m.receiveShadow = true;
        root.add(m); rails.push(m);
      });

      if (L.rows < 1 || !L.valid) { glassAndStreak(Wd, Hd); return; }

      // Hopper: two brass-edged boards funnelling to the first pin.
      const hopMat = mats.lacquer(light ? 0x7b4d2a : 0x2e1c10, 0.4);
      const topY = 12, mouthY = L.marginTop - 12, mouthHalf = 12, spread = Math.min(40, L.cssW * 0.07);
      [-1, 1].forEach(sx => {
        const x0 = L.centerX + sx * mouthHalf, y0 = mouthY;
        const x1 = L.centerX + sx * (mouthHalf + spread), y1 = topY;
        const len = Math.hypot(x1 - x0, y1 - y0) * K;
        const m = new THREE.Mesh(new THREE.BoxGeometry(4 * K, len, 0.3), hopMat);
        m.position.set(wx((x0 + x1) / 2), wy((y0 + y1) / 2), 0.15);
        m.rotation.z = Math.atan2(-(y1 - y0), x1 - x0) - Math.PI / 2;
        m.castShadow = true;
        root.add(m); hopper.push(m);
      });

      // Pins.
      const pinR = Math.max(2.2, Math.min(4.4, L.slot * 0.085)) * K;
      const total = (L.rows * (L.rows + 1)) / 2;
      pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(pinR, pinR, 0.26, 16).rotateX(Math.PI / 2), mats.brass(), total);
      const m4 = new THREE.Matrix4();
      let k = 0;
      for (let r = 0; r < L.rows; r++) {
        for (let j = 0; j <= r; j++) {
          m4.makeTranslation(wx(L.pegX(r, j)), wy(L.pegRowY(r)), 0.13);
          pins.setMatrixAt(k++, m4);
        }
      }
      pins.castShadow = true;
      root.add(pins);

      // Bin dividers: thin brass slats between bins and at both ends.
      const bins = L.rows + 1;
      const binH = (L.binBottomY - L.binTopY) * K;
      dividers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4 * K, binH, 0.28), mats.brass(), bins + 1);
      for (let b = 0; b <= bins; b++) {
        const x = L.pegX(L.rows, b) - L.slot / 2;
        m4.makeTranslation(wx(x), wy((L.binTopY + L.binBottomY) / 2), 0.14);
        dividers.setMatrixAt(b, m4);
      }
      dividers.castShadow = true;
      root.add(dividers);

      // Name plate under the bins.
      const plH = (L.cssH - L.binBottomY - 12) * K;
      plateCanvas.height = Math.max(64, Math.round(2048 * plH / Wd));
      plate = new THREE.Mesh(new THREE.PlaneGeometry(Wd - 24 * K, plH),
        new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.45, metalness: 0.6 }));
      plate.position.set(0, wy((L.binBottomY + L.cssH - 12) / 2), 0.004);
      plate.receiveShadow = true;
      root.add(plate);

      glassAndStreak(Wd, Hd);
    }

    function glassAndStreak(Wd, Hd) {
      glass = new THREE.Mesh(new THREE.PlaneGeometry(Wd, Hd), glassMat);
      glass.position.z = 0.33;
      root.add(glass);
      const sc = makeCanvas(256, 256);
      const g = sc.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0.05, 'rgba(255,255,255,0)');
      grad.addColorStop(0.16, 'rgba(255,255,255,0.13)');
      grad.addColorStop(0.24, 'rgba(255,255,255,0.02)');
      grad.addColorStop(0.3, 'rgba(255,255,255,0.07)');
      grad.addColorStop(0.36, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
      streak = new THREE.Mesh(new THREE.PlaneGeometry(Wd, Hd),
        new THREE.MeshBasicMaterial({ map: colorTexture(sc), transparent: true, depthWrite: false }));
      streak.position.z = 0.335;
      root.add(streak);
    }

    function drawPlate(labels, counts) {
      const g = plateCanvas.getContext('2d');
      const Wc = plateCanvas.width, Hc = plateCanvas.height;
      const brass = g.createLinearGradient(0, 0, 0, Hc);
      brass.addColorStop(0, '#c9a45c'); brass.addColorStop(0.5, '#a9823d'); brass.addColorStop(1, '#8a672c');
      g.fillStyle = brass; g.fillRect(0, 0, Wc, Hc);
      // Fine brushed lines.
      for (let x = 0; x < Wc; x += 3) { g.fillStyle = `rgba(255,255,255,${0.03 + ((x * 7) % 11) / 260})`; g.fillRect(x, 0, 1, Hc); }
      if (!L || !L.valid) return;
      const bins = L.rows + 1;
      const pxPer = Wc / (L.cssW - 24);
      const binW = L.slot * pxPer;
      const rotate = bins > 8;
      for (let b = 0; b < bins; b++) {
        const x = (L.pegX(L.rows, b) - 12) * pxPer;
        const name = labels[b] || '';
        g.save();
        g.fillStyle = '#2a1c08';
        g.shadowColor = 'rgba(255,236,190,0.45)'; g.shadowOffsetY = 2; // engraved: lit lower lip
        g.textAlign = 'center'; g.textBaseline = 'middle';
        // Sized in screen pixels, so the plate stays legible on a phone.
        if (rotate) {
          const f = fitLabel(g, name, Hc * 1.05, Math.min(Hc * 0.3, binW * 0.55, 12 * pxPer), 14, 700, '"DM Sans", sans-serif');
          g.translate(x, Hc * 0.5);
          g.rotate(-Math.PI / 4);
          g.font = `700 ${f.px}px "DM Sans", sans-serif`;
          g.fillText(f.text, 0, 0);
        } else {
          const f = fitLabel(g, name, binW * 0.92, Math.min(Hc * 0.4, 13 * pxPer), 14, 700, '"DM Sans", sans-serif');
          g.font = `700 ${f.px}px "DM Sans", sans-serif`;
          g.fillText(f.text, x, Hc * 0.34);
          g.font = `600 ${Math.round(Math.min(Hc * 0.34, 11 * pxPer))}px "DM Mono", monospace`;
          g.fillStyle = 'rgba(42,28,8,0.85)';
          g.fillText(String(counts[b] || 0), x, Hc * 0.76);
        }
        g.restore();
      }
      plateTex.needsUpdate = true;
    }

    // Piles as many balls as fit; past that, each bin is drawn to scale.
    function setCounts(counts, labels) {
      if (!L || !L.valid) { stacked.count = 0; drawPlate(labels || [], counts || []); return; }
      const s = stackSpec();
      const maxC = Math.max(0, ...counts);
      const scale = maxC > s.cap ? s.cap / maxC : 1;
      const m4 = new THREE.Matrix4();
      const r = s.r * K;
      let k = 0;
      counts.forEach((c, b) => {
        const shown = Math.min(s.cap, Math.round(c * scale));
        for (let i = 0; i < shown && k < STACK_MAX; i++) {
          const p = slotPx(b, i);
          m4.makeScale(r, r, r).setPosition(wx(p.x), wy(p.y), r + 0.004);
          stacked.setMatrixAt(k++, m4);
        }
      });
      stacked.count = k;
      stacked.instanceMatrix.needsUpdate = true;
      drawPlate(labels, counts);
      return scale;
    }

    return {
      stage: st,
      build,
      setCounts,
      ballRadiusPx: () => (L ? ballRadiusPx() : 6),
      // Where the next ball dropped into a bin comes to rest (px).
      landingPx(bin, countBefore, totalMax) {
        const s = stackSpec();
        const scale = totalMax > s.cap ? s.cap / totalMax : 1;
        return slotPx(bin, Math.min(s.cap - 1, Math.round(countBefore * scale)));
      },
      setFlying(list) {
        const m4 = new THREE.Matrix4();
        const n = Math.min(list.length, 64);
        for (let i = 0; i < n; i++) {
          const p = list[i], r = (p.r || 6) * K;
          m4.makeScale(r, r, r).setPosition(wx(p.x), wy(p.y), r + 0.004);
          flying.setMatrixAt(i, m4);
        }
        flying.count = n;
        flying.instanceMatrix.needsUpdate = true;
      },
      resize: st.resize,
      render: st.render
    };
  }

  return { available, createStage, studioEnvironment, roundedBox, Wheel, SlotMachine, GaltonBoard, shade, REEL_MIN_SYMBOLS };
})();
