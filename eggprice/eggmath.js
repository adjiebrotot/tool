/* ============================================================
   EGG PRICE — the egg maths (no DOM, so the audit can load it)

   Shape: a Hügelschäffer egg, the standard model for a hen's egg.
     y(x) = B/2 · √((L² − 4x²) / (L² + 8wx + 4w²)),  −L/2 ≤ x ≤ L/2
   L = length, B = breadth, w = how far the widest point sits toward
   the blunt end. B and w are fixed shares of L, so every egg is the
   same shape at a different size.

   From the pack to the shell, per egg:
     W = grams / eggs                     whole egg mass (shell included)
     V = W / ρ_egg                        whole egg volume
     V = π∫y² dx = cV · L³               → L = ∛(V / cV)
     S = 2π∫y ds = cS · L²               outer shell area
     shell = S · t · ρ_shell             a thin shell of even thickness
   Shell thickness barely changes with egg size, so a bigger egg
   carries less shell per gram: area grows with L², mass with L³.
   ============================================================ */
(function (root) {
  'use strict';

  const SHAPE = { breadth: 0.75, shift: 0.05 };   // B/L and w/L
  const RHO_EGG = 1.08;     // g/cm³, whole fresh egg
  const RHO_SHELL = 2.3;    // g/cm³, shell with its membranes
  const T_SHELL = 0.036;    // cm, 0.36 mm

  // Half-width of an egg of length L at position x along its axis.
  function profile(x, L) {
    const B = SHAPE.breadth * L, w = SHAPE.shift * L;
    const num = L * L - 4 * x * x;
    if (num <= 0) return 0;
    return (B / 2) * Math.sqrt(num / (L * L + 8 * w * x + 4 * w * w));
  }

  // Points along the profile, packed toward the ends where it turns fastest.
  function profilePoints(L, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = -(L / 2) * Math.cos(Math.PI * i / n);
      pts.push([x, profile(x, L)]);
    }
    return pts;
  }

  // Volume and surface of the unit egg (L = 1), by the solid of revolution.
  // Frusta between neighbouring points: exact for the polyline, and the
  // polyline converges on the curve.
  const UNIT = (function () {
    const pts = profilePoints(1, 20000);
    let V = 0, S = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, r0] = pts[i - 1], [x1, r1] = pts[i];
      const h = x1 - x0;
      V += Math.PI * h * (r0 * r0 + r0 * r1 + r1 * r1) / 3;
      S += Math.PI * (r0 + r1) * Math.hypot(h, r1 - r0);
    }
    return { cV: V, cS: S };
  })();

  // Everything about one egg of whole mass W grams.
  function egg(W) {
    const V = W / RHO_EGG;
    const L = Math.cbrt(V / UNIT.cV);
    const S = UNIT.cS * L * L;
    const shell = Math.min(W, S * T_SHELL * RHO_SHELL);
    return {
      W, V, L, B: SHAPE.breadth * L, w: SHAPE.shift * L, S,
      shell, content: W - shell, shellShare: W > 0 ? shell / W : 0,
    };
  }

  // One row of the table: a pack of `eggs` eggs weighing `grams` for `price`.
  function pack(row) {
    const eggs = +row.eggs, grams = +row.grams, price = +row.price;
    if (!(eggs > 0) || !(grams > 0) || !(price >= 0) || !isFinite(eggs + grams + price)) return null;
    const e = egg(grams / eggs);
    const shellG = e.shell * eggs, contentG = e.content * eggs;
    return {
      egg: e, eggs, grams, price,
      shellG, contentG,
      grossPerG: price / grams,
      netPerG: contentG > 0 ? price / contentG : Infinity,
      shellCost: price * e.shellShare,
      contentCost: price * (1 - e.shellShare),
    };
  }

  root.EggMath = { SHAPE, RHO_EGG, RHO_SHELL, T_SHELL, UNIT, profile, profilePoints, egg, pack };
})(typeof window !== 'undefined' ? window : globalThis);
