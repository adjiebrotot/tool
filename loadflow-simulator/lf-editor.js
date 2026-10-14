/* Load Flow Simulator: the diagram editor.

   Pointer events throughout, so a mouse, a pen and a finger work the same:
   drag a part from the toolbar onto the diagram, drag between two buses to
   connect them, drag anything to move it, drag empty space to pan, scroll or
   pinch to zoom. In an embed the diagram is read only: pan, zoom and the
   hover readout still work. */
(function(root){
  'use strict';
  var LF = root.LF, G = LF.G;
  var BRANCH_TOOL = { Line: 1, Transformer: 1, Link: 1 };
  var PALETTE = [['Bus', 'Bus'], ['Line', 'Line'], ['Transformer', 'Transformer'], ['Generator', 'Generator'], ['Grid', 'Grid'],
                 ['Load', 'Load'], ['ShuntImpedance', 'Shunt'], ['StorageUnit', 'Storage'], ['Link', 'HVDC link']];
  var TIP = {
    Bus: 'Bus: drag it onto the diagram',
    Line: 'Line: pick it, then drag from one bus to another',
    Transformer: 'Transformer: pick it, then drag from the high-voltage bus to the other',
    Generator: 'Generator: drag it onto a bus',
    Grid: 'Grid: an external grid, the slack. Drag it onto a bus',
    Load: 'Load: drag it onto a bus',
    ShuntImpedance: 'Shunt, such as a capacitor bank: drag it onto a bus',
    StorageUnit: 'Storage unit: drag it onto a bus',
    Link: 'HVDC link: pick it, then drag from the sending bus to the other'
  };

  LF.Editor = function(app){
    var svg = app.svg, stage = app.stage, ro = !!app.readOnly;
    var hintEl = document.getElementById('sldHint');
    var armed = null, drag = null;
    var pointers = new Map();

    function hint(t){ hintEl.textContent = t || ''; hintEl.classList.toggle('visible', !!t); }
    function toDiagram(cx, cy){
      var m = svg.getScreenCTM();
      if(!m) return { x: 0, y: 0 };
      var pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
      var p = pt.matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    }
    function pxPerUnit(){ var m = svg.getScreenCTM(); return m ? m.a : 1; }
    function hitId(t){
      var el = t && t.closest ? t.closest('[data-id]') : null;
      return el && svg.contains(el) ? +el.getAttribute('data-id') : null;
    }
    function handleOf(t){ var el = t && t.closest ? t.closest('[data-h]') : null; return el ? el.getAttribute('data-h') : null; }
    function byId(){ return LF.byId(app.model); }
    function tmp(s){ var g = svg.querySelector('.lyr-tmp'); if(g) g.innerHTML = s || ''; }
    function col(t){ return app.paint()(t); }

    // The bus bar nearest a point, within tol px: where along it, and on which side.
    function nearestBus(p, tol, not){
      var best = null, L = app.L;
      Object.keys(L.bus).forEach(function(id){
        id = +id;
        if(not && not.indexOf(id) >= 0) return;
        var g = L.bus[id];
        var dx = g.x2 - g.x1, dy = g.y2 - g.y1, l2 = dx * dx + dy * dy || 1;
        var t = Math.max(0, Math.min(1, ((p.x - g.x1) * dx + (p.y - g.y1) * dy) / l2));
        var qx = g.x1 + t * dx, qy = g.y1 + t * dy, d = Math.hypot(p.x - qx, p.y - qy);
        if(d <= tol && (!best || d < best.d)){
          var half = Math.floor(g.units / 2);
          var a = Math.round(((g.v ? qy - g.cy : qx - g.cx)) / G);
          a = Math.max(-half, Math.min(half, a));
          var side = g.v ? (p.x < g.cx ? 1 : 0) : (p.y < g.cy ? 1 : 0);
          best = { id: id, d: d, a: a, side: side, g: g };
        }
      });
      return best;
    }
    function guessKv(){
      var m = app.model, ids = byId();
      if(app.sel.size === 1){ var s = ids[app.sel.values().next().value]; if(s && s.c === 'Bus') return s.v_nom; }
      var n = {}, best = null;
      m.el.forEach(function(e){ if(e.c === 'Bus'){ n[e.v_nom] = (n[e.v_nom] || 0) + 1; if(best === null || n[e.v_nom] > n[best]) best = e.v_nom; } });
      return best === null ? 110 : +best;
    }

    /* ── The toolbar ── */
    var pal = document.getElementById('palette');
    if(!ro){
      var html = '';
      PALETTE.forEach(function(p){
        html += '<button type="button" class="pal-btn" data-tool="' + p[0] + '" title="' + TIP[p[0]] + '" aria-label="' + TIP[p[0]] + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + LF.KIND_ICON[p[0]] + '</svg><span>' + p[1] + '</span></button>';
      });
      html += '<div class="pal-sep" aria-hidden="true"></div><div class="pal-row">' +
        '<button type="button" class="btn-bare" id="undoBtn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>↶</button>' +
        '<button type="button" class="btn-bare" id="redoBtn" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled>↷</button></div>' +
        '<button type="button" class="btn-secondary btn-sm pal-clear" id="clearBtn" data-icon="trash" title="Clear the whole diagram">Clear</button>';
      pal.innerHTML = html;
      if(root.SharedIcon) root.SharedIcon.hydrate(pal);
      document.getElementById('undoBtn').addEventListener('click', function(){ app.undo(); });
      document.getElementById('redoBtn').addEventListener('click', function(){ app.redo(); });
      document.getElementById('clearBtn').addEventListener('click', function(){
        if(!app.model.el.length) return;
        if(!confirm('Clear the whole diagram? Undo brings it back.')) return;
        app.model.el = [];
        app.sel = new Set();
        app.change('elec');
      });
    }
    function arm(tool){
      armed = tool;
      Array.prototype.forEach.call(pal.querySelectorAll('.pal-btn'), function(b){ b.classList.toggle('is-armed', b.getAttribute('data-tool') === tool); });
      if(!tool) hint('');
      else if(BRANCH_TOOL[tool]) hint(TIP[tool].replace(/^[^:]+: pick it, then d/, 'D') + '. Esc to stop.');
      else hint('Click the diagram to place it' + (tool === 'Bus' ? '' : ' on a bus') + '. Esc to stop.');
    }
    function ghost(tool, p){
      if(!p){ tmp(''); return; }
      var a = col('--accent'), s = '';
      if(tool === 'Bus'){
        var x = Math.round(p.x / G) * G, y = Math.round(p.y / G) * G;
        s = '<path d="M' + (x - 4 * G) + ' ' + y + 'h' + 8 * G + '" stroke="' + a + '" stroke-width="5" stroke-linecap="round" opacity=".55"/>';
      } else {
        var hit = nearestBus(p, 6 * G);
        if(hit){
          var g = hit.g, px = g.v ? g.cx : g.cx + hit.a * G, py = g.v ? g.cy + hit.a * G : g.cy;
          var d = g.v ? [hit.side ? -1 : 1, 0] : [0, hit.side ? -1 : 1];
          s = '<path d="M' + px + ' ' + py + 'l' + d[0] * 22 + ' ' + d[1] * 22 + '" stroke="' + a + '" stroke-width="2" stroke-dasharray="3 3"/>' +
              '<circle cx="' + (px + d[0] * 33) + '" cy="' + (py + d[1] * 33) + '" r="11" fill="none" stroke="' + a + '" stroke-width="2" stroke-dasharray="3 3"/>';
        } else s = '<circle cx="' + p.x + '" cy="' + p.y + '" r="11" fill="none" stroke="' + col('--muted') + '" stroke-width="2" stroke-dasharray="3 3"/>';
      }
      tmp(s);
    }
    function place(tool, p){
      var e;
      if(tool === 'Bus') e = app.newElement('Bus', { v_nom: guessKv(), at: [Math.round(p.x / G), Math.round(p.y / G), 8, 0] });
      else {
        var hit = nearestBus(p, 6 * G);
        e = hit ? app.newElement(tool, { bus: hit.id, at: [hit.a, hit.side] })
                : app.newElement(tool, { bus: null, at: [Math.round(p.x / G), Math.round(p.y / G)] });
        if(!hit) hint('Drag it onto a bus to connect it.');
      }
      app.sel = new Set([e.id]);
      app.change('elec');
      app.select([e.id]);
    }
    function connect(tool, a, b){
      var m = byId(), A = m[a], B = m[b];
      if(!A || !B || a === b) return;
      var c = tool === 'auto' ? (A.v_nom === B.v_nom ? 'Line' : 'Transformer') : tool;
      var b0 = A, b1 = B;
      if(c === 'Transformer' && B.v_nom > A.v_nom){ b0 = B; b1 = A; }
      var e = app.newElement(c, { bus0: b0.id, bus1: b1.id });
      app.sel = new Set([e.id]);
      app.change('elec');
      app.select([e.id]);
    }

    if(!ro) pal.addEventListener('pointerdown', function(ev){
      var b = ev.target.closest('.pal-btn');
      if(!b || ev.button > 0) return;
      ev.preventDefault();
      var tool = b.getAttribute('data-tool');
      try { b.setPointerCapture(ev.pointerId); } catch(e){}
      drag = { mode: 'palette', tool: tool, btn: b, sx: ev.clientX, sy: ev.clientY, moved: false, id: ev.pointerId };
    });
    if(!ro) pal.addEventListener('pointermove', function(ev){
      if(!drag || drag.mode !== 'palette' || ev.pointerId !== drag.id) return;
      if(Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 5) drag.moved = true;
      if(!drag.moved || BRANCH_TOOL[drag.tool]) return;
      var r = stage.getBoundingClientRect();
      var inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      ghost(drag.tool, inside ? toDiagram(ev.clientX, ev.clientY) : null);
    });
    if(!ro) pal.addEventListener('pointerup', function(ev){
      if(!drag || drag.mode !== 'palette' || ev.pointerId !== drag.id) return;
      var d = drag; drag = null;
      tmp('');
      var r = stage.getBoundingClientRect();
      var inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if(d.moved && inside && !BRANCH_TOOL[d.tool]){ arm(null); place(d.tool, toDiagram(ev.clientX, ev.clientY)); return; }
      if(!d.moved || BRANCH_TOOL[d.tool]) arm(armed === d.tool ? null : d.tool);
    });
    if(!ro) pal.addEventListener('pointercancel', function(){ drag = null; tmp(''); });
    // Enter or Space on a palette button (a click with no pointer behind it): a part
    // goes on the one selected bus or in the middle of the view, and a branch joins
    // the two selected buses.
    if(!ro) pal.addEventListener('click', function(ev){
      var b = ev.target.closest('.pal-btn');
      if(!b || ev.detail !== 0) return;
      var tool = b.getAttribute('data-tool'), m = byId();
      var buses = Array.from(app.sel).filter(function(id){ return m[id] && m[id].c === 'Bus'; });
      arm(null);
      if(BRANCH_TOOL[tool]){
        if(buses.length === 2) connect(tool, buses[0], buses[1]);
        else hint('Select two buses, then press ' + tool + ' again to join them.');
        return;
      }
      var g = tool !== 'Bus' && buses.length === 1 ? app.L.bus[buses[0]] : null;
      var r = stage.getBoundingClientRect();
      place(tool, g ? { x: g.cx + (g.v ? G : 0), y: g.cy + (g.v ? 0 : G) } : toDiagram(r.left + r.width / 2, r.top + r.height / 2));
    });

    /* ── The diagram ── */
    svg.addEventListener('pointerdown', function(ev){
      if(ev.button > 0) return;
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      try { svg.setPointerCapture(ev.pointerId); } catch(e){}
      if(pointers.size === 2){
        // Two fingers: pinch to zoom and pan, whatever the first one started.
        restoreDrag();
        var pts = Array.from(pointers.values());
        drag = { mode: 'pinch', d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2 };
        return;
      }
      if(pointers.size > 2) return;
      var p = toDiagram(ev.clientX, ev.clientY);
      var id = hitId(ev.target), h = handleOf(ev.target);
      drag = { mode: 'pan', sx: ev.clientX, sy: ev.clientY, lx: ev.clientX, ly: ev.clientY, p0: p, moved: false, id: id, shift: ev.shiftKey };
      if(ro){ if(id !== null) app.hover(id); return; }
      var m = byId();
      if(h && app.sel.size === 1){
        var sid = app.sel.values().next().value, e = m[sid];
        if(h === 'knob'){ drag = { mode: 'connect', tool: 'auto', from: sid, moved: false }; return; }
        if(h === 'end1' || h === 'end2'){ drag = { mode: 'resize', e: e, end: h === 'end1' ? 1 : 2, orig: e.at.slice(), moved: false }; return; }
        if(h === 'p0' || h === 'p1'){ drag = { mode: 'end', e: e, end: h === 'p0' ? 0 : 1, orig: JSON.stringify([e.bus0, e.bus1, e.at]), moved: false }; return; }
        if(h === 'mid'){ drag = startBend(e); return; }
      }
      if(armed){
        if(BRANCH_TOOL[armed]){
          if(id !== null && m[id] && m[id].c === 'Bus') drag = { mode: 'connect', tool: armed, from: id, moved: false };
          else { drag = { mode: 'pan', sx: ev.clientX, sy: ev.clientY, lx: ev.clientX, ly: ev.clientY, moved: false, id: null }; hint('Start on a bus, then drag to another bus. Esc to stop.'); }
          return;
        }
        var t = armed;
        if(!ev.shiftKey) arm(null);
        place(t, p);
        drag = null;
        return;
      }
      if(id !== null){
        if(ev.shiftKey){ app.select([id], true); drag = null; return; }
        if(!app.sel.has(id)) app.select([id]);
        var e2 = m[id];
        if(LF.BRANCH[e2.c] && app.sel.size === 1){ drag = startBend(e2); drag.click = true; return; }
        drag = startMove(p);
        drag.sx = ev.clientX; drag.sy = ev.clientY;
        return;
      }
      if(ev.shiftKey) drag = { mode: 'band', p0: p, moved: false };
    });
    function startMove(p){
      var m = app.model, origs = {};
      m.el.forEach(function(e){ if(app.sel.has(e.id) || (LF.BRANCH[e.c] && (app.sel.has(e.bus0) || app.sel.has(e.bus1)))) origs[e.id] = { at: e.at ? e.at.slice() : null, bus: e.bus }; });
      return { mode: 'move', p0: p, origs: origs, moved: false, elec: false, undo: true };
    }
    function startBend(e){
      var L = app.L.br[e.id];
      if(!L || L.pts.length !== 4) return { mode: 'none', moved: false };
      var horiz = L.pts[1][1] === L.pts[2][1];
      return { mode: 'bend', e: e, horiz: horiz, orig: e.at ? e.at.slice() : null, moved: false };
    }
    // Esc or a second finger cancels a drag: put back whatever it changed, so the model,
    // the results and the history still agree.
    function restoreDrag(){
      var d = drag;
      if(!d || !d.moved) return;
      var m = byId();
      if(d.mode === 'move') Object.keys(d.origs).forEach(function(id){
        var e = m[id], o = d.origs[id];
        if(!e) return;
        e.at = o.at ? o.at.slice() : o.at;
        if(LF.DEVICE[e.c]) e.bus = o.bus;
      });
      else if(d.mode === 'resize' || d.mode === 'bend') d.e.at = d.orig ? d.orig.slice() : d.orig;
      else if(d.mode === 'end'){ var o2 = JSON.parse(d.orig); d.e.bus0 = o2[0]; d.e.bus1 = o2[1]; d.e.at = o2[2]; }
      else return;
      app.renderSoon();
    }

    svg.addEventListener('pointermove', function(ev){
      if(pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if(!drag){
        if(ev.pointerType === 'mouse') app.hover(hitId(ev.target));
        return;
      }
      var p = toDiagram(ev.clientX, ev.clientY);
      if(drag.mode === 'pinch'){
        var pts = Array.from(pointers.values());
        if(pts.length < 2) return;
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
        var k = pxPerUnit();
        app.panBy((mx - drag.mx) / k, (my - drag.my) / k);
        var c = toDiagram(mx, my);
        if(drag.d0 > 0) app.zoomAt(d / drag.d0, c.x, c.y);
        drag.d0 = d; drag.mx = mx; drag.my = my;
        return;
      }
      if(!drag.moved){
        var far = drag.sx !== undefined ? Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 3 : true;
        if(!far) return;
        drag.moved = true;
      }
      var m = byId();
      switch(drag.mode){
        case 'pan': {
          var k2 = pxPerUnit();
          app.panBy((ev.clientX - drag.lx) / k2, (ev.clientY - drag.ly) / k2);
          drag.lx = ev.clientX; drag.ly = ev.clientY;
          svg.classList.add('is-panning');
          break;
        }
        case 'move': {
          var dx = Math.round((p.x - drag.p0.x) / G), dy = Math.round((p.y - drag.p0.y) / G);
          var single = app.sel.size === 1 ? m[app.sel.values().next().value] : null;
          if(single && LF.DEVICE[single.c]){
            // A device lands on the nearest bus, or on none.
            var hit = nearestBus(p, 5 * G);
            var o = drag.origs[single.id];
            if(hit){ single.bus = hit.id; single.at = [hit.a, hit.side]; }
            else { single.bus = null; single.at = [Math.round(p.x / G), Math.round(p.y / G)]; }
            drag.elec = single.bus !== o.bus;
          } else {
            Object.keys(drag.origs).forEach(function(id){
              var e = m[id], o2 = drag.origs[id];
              if(!e) return;
              if(e.c === 'Bus' && app.sel.has(e.id)) e.at = [o2.at[0] + dx, o2.at[1] + dy, o2.at[2], o2.at[3]];
              else if(LF.DEVICE[e.c] && app.sel.has(e.id) && e.bus === null && o2.at) e.at = [o2.at[0] + dx, o2.at[1] + dy];
              else if(LF.BRANCH[e.c] && o2.at && o2.at[2] !== null && o2.at[2] !== undefined){
                var both = app.sel.has(e.bus0) && app.sel.has(e.bus1);
                var L = app.L.br[e.id], horiz = L && L.pts.length === 4 && L.pts[1][1] === L.pts[2][1];
                var shift = horiz ? dy : dx;
                e.at = [o2.at[0], o2.at[1], o2.at[2] + (both ? shift : Math.round(shift / 2))];
              }
            });
          }
          app.renderSoon();
          break;
        }
        case 'resize': {
          var e = drag.e, o3 = drag.orig, v = o3[3] === 1;
          var other = drag.end === 1 ? (v ? o3[1] + o3[2] / 2 : o3[0] + o3[2] / 2) : (v ? o3[1] - o3[2] / 2 : o3[0] - o3[2] / 2);
          var at = Math.round((v ? p.y : p.x) / G);
          var len = Math.max(2, Math.abs(at - other));
          len += len % 2;
          var centre = drag.end === 1 ? other - len / 2 : other + len / 2;
          e.at = v ? [o3[0], centre, len, 1] : [centre, o3[1], len, 0];
          app.renderSoon();
          break;
        }
        case 'bend': {
          var e3 = drag.e, a = e3.at || [null, null, null];
          e3.at = [a[0] === undefined ? null : a[0], a[1] === undefined ? null : a[1], Math.round((drag.horiz ? p.y : p.x) / G)];
          app.renderSoon();
          break;
        }
        case 'end': {
          var e4 = drag.e, key = 'bus' + drag.end, otherBus = drag.end ? e4.bus0 : e4.bus1;
          var hit2 = nearestBus(p, 4 * G, [otherBus]);
          if(hit2){
            var at2 = (e4.at || [null, null, null]).slice();
            while(at2.length < 3) at2.push(null);
            e4[key] = hit2.id;
            at2[drag.end] = hit2.a;
            e4.at = at2;
            app.renderSoon();
          }
          tmp('<circle cx="' + p.x + '" cy="' + p.y + '" r="5" fill="' + col('--accent') + '"/>');
          break;
        }
        case 'connect': {
          var from = app.L.bus[drag.from];
          var hit3 = nearestBus(p, 3 * G, [drag.from]);
          var s = '<path d="M' + from.cx + ' ' + from.cy + 'L' + p.x + ' ' + p.y + '" stroke="' + col('--accent') + '" stroke-width="2" stroke-dasharray="5 4" fill="none"/>';
          if(hit3) s += '<path d="M' + hit3.g.x1 + ' ' + hit3.g.y1 + 'L' + hit3.g.x2 + ' ' + hit3.g.y2 + '" stroke="' + col('--accent2') + '" stroke-width="11" stroke-opacity=".4" stroke-linecap="round"/>';
          tmp(s);
          break;
        }
        case 'band': {
          var x = Math.min(drag.p0.x, p.x), y = Math.min(drag.p0.y, p.y), w = Math.abs(p.x - drag.p0.x), h = Math.abs(p.y - drag.p0.y);
          drag.rect = { x: x, y: y, w: w, h: h };
          tmp('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + col('--accent') + '" fill-opacity=".08" stroke="' + col('--accent') + '" stroke-dasharray="4 3"/>');
          break;
        }
      }
    });

    function end(ev){
      pointers.delete(ev.pointerId);
      svg.classList.remove('is-panning');
      if(!drag) return;
      if(drag.mode === 'pinch'){ if(pointers.size < 1) drag = null; return; }
      // The page took the swipe over: nothing was dragged and nothing is deselected.
      if(ev.type === 'pointercancel' && drag.mode === 'pan'){ drag = null; return; }
      var d = drag; drag = null;
      tmp('');
      if(ro){ if(!d.moved && d.id !== null) app.hover(d.id); return; }
      var m = byId();
      switch(d.mode){
        case 'pan':
          if(!d.moved && d.id === null && !d.shift) app.select([]);
          break;
        case 'move':
          if(d.moved) app.change(d.elec ? 'elec' : 'geom');
          break;
        case 'resize':
        case 'bend':
          if(d.moved) app.change('geom');
          break;
        case 'end':
          if(d.moved) app.change(JSON.stringify([d.e.bus0, d.e.bus1]) !== JSON.stringify(JSON.parse(d.orig).slice(0, 2)) ? 'elec' : 'geom');
          break;
        case 'connect': {
          var p = toDiagram(ev.clientX, ev.clientY);
          var hit = nearestBus(p, 3 * G, [d.from]);
          if(hit) connect(d.tool, d.from, hit.id);
          else if(d.moved) hint('Release it on another bus to connect.');
          break;
        }
        case 'band': {
          if(!d.rect) break;
          var r = d.rect, L = app.L, ids = [];
          var inR = function(x, y){ return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; };
          Object.keys(L.bus).forEach(function(id){ var g = L.bus[id]; if(inR(g.x1, g.y1) && inR(g.x2, g.y2)) ids.push(+id); });
          Object.keys(L.dev).forEach(function(id){ if(inR(L.dev[id].cx, L.dev[id].cy)) ids.push(+id); });
          Object.keys(L.br).forEach(function(id){ if(inR(L.br[id].mx, L.br[id].my)) ids.push(+id); });
          app.select(ids, false);
          break;
        }
      }
      void m;
    }
    // On a touch screen a vertical swipe on empty diagram scrolls the page (the stage
    // allows pan-y); a touch that starts on a part, with a tool armed or with two
    // fingers stays with the diagram.
    svg.addEventListener('touchstart', function(ev){
      if(ev.touches.length > 1 || armed || hitId(ev.target) !== null || handleOf(ev.target)) ev.preventDefault();
    }, { passive: false });
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('pointerleave', function(ev){ if(ev.pointerType === 'mouse' && !drag) app.hover(null); });

    // The wheel zooms where the pointer is; a trackpad pinch arrives as a ctrl-wheel.
    // A plain wheel scrolls the page past the diagram until the diagram is clicked
    // (or focused), so reading down the page never gets caught in it. An embed is the
    // diagram and nothing else, so there the wheel always zooms.
    var wheelOn = ro, wheelHintT = 0;
    stage.addEventListener('pointerdown', function(){ wheelOn = true; });
    stage.addEventListener('pointerleave', function(ev){ if(ev.pointerType === 'mouse' && !ro) wheelOn = false; });
    svg.addEventListener('focus', function(){ wheelOn = true; });
    svg.addEventListener('wheel', function(ev){
      if(!wheelOn && !ev.ctrlKey && !ev.metaKey){
        if(!armed){
          var msg = 'Click the diagram, or hold Ctrl, to zoom with the wheel.';
          hint(msg);
          clearTimeout(wheelHintT);
          wheelHintT = setTimeout(function(){ if(hintEl.textContent === msg) hint(''); }, 2000);
        }
        return;
      }
      ev.preventDefault();
      var p = toDiagram(ev.clientX, ev.clientY);
      var dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
      var f = Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.0015));
      app.zoomAt(f, p.x, p.y);
    }, { passive: false });

    /* ── Keyboard ── */
    if(!ro) document.addEventListener('keydown', function(ev){
      var t = ev.target, tag = t && t.tagName;
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable);
      var mod = ev.ctrlKey || ev.metaKey;
      if(mod && ev.key === 'Enter'){ ev.preventDefault(); app.run(); return; }
      if(typing) return;
      var k = ev.key;
      if(k === 'Escape'){
        if(armed){ arm(null); return; }
        if(drag){ restoreDrag(); drag = null; tmp(''); return; }
        if(app.sel.size) app.select([]);
        return;
      }
      if(mod && (k === 'z' || k === 'Z')){ ev.preventDefault(); if(ev.shiftKey) app.redo(); else app.undo(); return; }
      if(mod && (k === 'y' || k === 'Y')){ ev.preventDefault(); app.redo(); return; }
      if(mod && (k === 'd' || k === 'D')){ if(app.sel.size){ ev.preventDefault(); app.duplicateSelected(); } return; }
      if(mod && (k === 'a' || k === 'A')){
        if(!stage.matches(':hover') && document.activeElement !== document.body) return;
        ev.preventDefault();
        app.select(app.model.el.map(function(e){ return e.id; }));
        return;
      }
      if(!app.sel.size) return;
      if(k === 'Delete' || k === 'Backspace'){ ev.preventDefault(); app.deleteSelected(); return; }
      if(k === 'r' || k === 'R'){
        var any = false;
        app.model.el.forEach(function(e){ if(e.c === 'Bus' && app.sel.has(e.id)){ e.at = [e.at[0], e.at[1], e.at[2], e.at[3] === 1 ? 0 : 1]; any = true; } });
        if(any) app.change('geom');
        return;
      }
      var arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if(arrows[k]){
        ev.preventDefault();
        var st = ev.shiftKey ? 5 : 1, dv = arrows[k], moved = false;
        app.model.el.forEach(function(e){
          if(!app.sel.has(e.id)) return;
          if(e.c === 'Bus'){ e.at = [e.at[0] + dv[0] * st, e.at[1] + dv[1] * st, e.at[2], e.at[3]]; moved = true; }
          else if(LF.DEVICE[e.c] && (e.bus === null || e.bus === undefined) && e.at){ e.at = [e.at[0] + dv[0] * st, e.at[1] + dv[1] * st]; moved = true; }
        });
        if(moved) app.change('geom', 'nudge');
      }
    });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
