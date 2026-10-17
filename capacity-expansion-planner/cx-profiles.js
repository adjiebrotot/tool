/* Capacity Expansion Planner: profiles from a file, and the template to fill in.

   No DOM here. The page loads this file the first time a template or a file
   is asked for, and the audit loads it in Node. A spreadsheet arrives as rows
   of cells (CSV text through CX.csvRows, an Excel sheet through
   CX.sheetRows, which takes SheetJS), and CX.readProfileFile reads them as
   one profile, the load's or a solar or wind farm's (cx-core.js):

   - Rows whose first cell starts with # are notes, and are skipped, so the
     template can explain itself. So are blank rows.
   - The sampling is what the file holds: 24 hours are one typical day, a
     weekday and a weekend day are 48, Monday to Sunday 168. Rows find their
     hour and day from an Hour column (00:00, 0 to 23, 1 to 24 as the hour
     ending, 1 PM), a Day column (Mon … Sun, Weekday, Weekend), one column
     with both ("Mon 13:00"), or dates and times (a week of real data); with
     none, by their order. Days may also be columns ("Mon", "Summer weekend").
   - Columns of values are the climate's seasons, by name ("Winter [p.u.]",
     "Dry", "Fall"), or one column for every season. A load's file with
     seasons of another climate sets the climate to match, and one that peaks
     in winter makes a temperate climate winter-peaking; a farm's must use
     the climate's seasons.
   - Seasons may also be rows: a Season column, with one column of values
     (the seasonal templates, 24, 48 or 168 rows a season).
   - The still, overcast peak day may come too, as 24 rows with Peak day in
     the Day column (or "Summer peak day" in the Season column): the
     profile's own hours that day. Left out, it is built as ever.
   - A year of hours (dated rows over more than a week, or 8,760 or 8,784
     rows in order from 1 January of the plan's first year) is averaged into
     a typical week for each season, Monday to Sunday: each day in the season
     its Season column names, else the one its month falls in for the
     hemisphere (CX.seasonOfMonth). A load's day with the year's highest
     hour, or the day its Season column marks peak, is its peak day, and is
     left out of the averages.
   - Units: per unit (a load's highest hour is its peak; a farm's share of
     its rating), [%], or for a load [MW], which sets the peak demand too.
   - A blank cell, or a season left out, keeps what the profile gives now.
   - Values are kept as read, so a template reads back to exactly the
     profile it was written from.

   What it gives back is the profile to use and what to tell the reader.
   Nothing is used when anything is wrong, so a file is applied whole or not
   at all. */
(function(root){
  'use strict';
  var CX = root.CX;
  var own = Object.prototype.hasOwnProperty;
  function two(n){ return (n < 10 ? '0' : '') + n; }
  function r4(x){ return Math.round(x * 1e4) / 1e4; }
  function fmt(x){ return (Math.round(x * 10) / 10).toLocaleString('en-AU'); }
  var list = CX.list;
  CX.FILE_ROWS = 20000;

  /* ── CSV text into rows of cells ──
     The delimiter is whichever of comma, semicolon and tab the header row
     uses most (notes skipped); a file that uses a semicolon or a tab may
     write 0,85 for 0.85. (The ED/UC Simulator's ed-profiles.js.) */
  CX.csvRows = function(text){
    text = String(text || '').replace(/^﻿/, '');
    var first = '', i0 = 0;
    while(i0 < text.length && (!first.trim() || /^\s*"?#/.test(first))){ var nl = text.indexOf('\n', i0); if(nl < 0) nl = text.length; first = text.slice(i0, nl); i0 = nl + 1; }
    var bare = first.replace(/"[^"]*"/g, '');
    var count = function(c){ return bare.split(c).length - 1; };
    var delim = ',', best = count(',');
    if(count(';') > best){ delim = ';'; best = count(';'); }
    if(count('\t') > best) delim = '\t';
    var rows = [], row = [], cell = '', q = false, n = text.length;
    for(var i = 0; i < n; i++){
      var c = text[i];
      if(q){
        if(c === '"'){ if(text[i + 1] === '"'){ cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if(c === '"') q = true;
      else if(c === delim){ row.push(cell); cell = ''; }
      else if(c === '\n' || c === '\r'){
        if(c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
        if(rows.length > CX.FILE_ROWS) break;
      } else cell += c;
    }
    if(cell !== '' || row.length){ row.push(cell); rows.push(row); }
    return { rows: rows, decimalComma: delim !== ',' };
  };

  /* ── An Excel workbook into rows of cells, through SheetJS ──
     A cell formatted as a time comes back as "HH:MM", one formatted as a
     date and time as "YYYY-MM-DD HH:MM", read from the serial number itself
     so no time zone can move it. The sheet named for profiles is read if
     there is one, else the first. */
  CX.sheetRows = function(XLSX, data){
    var wb = XLSX.read(data, { type: 'array', cellNF: true, cellDates: false, cellText: false });
    var names = wb.SheetNames || [];
    var name = names.filter(function(n){ return /profile|load|demand|solar|wind/i.test(n); })[0] || names[0];
    var ws = name && wb.Sheets[name];
    if(!ws || !ws['!ref']) return { rows: [], decimalComma: false, sheet: name || '' };
    var d1904 = !!(wb.Workbook && wb.Workbook.WBProps && wb.Workbook.WBProps.date1904);
    var rg = XLSX.utils.decode_range(ws['!ref']), rows = [], cols = [];
    for(var C = rg.s.c; C <= rg.e.c; C++) cols.push(XLSX.utils.encode_col(C));
    for(var R = rg.s.r; R <= Math.min(rg.e.r, rg.s.r + CX.FILE_ROWS); R++){
      var row = [], rn = String(R + 1);
      for(var j = 0; j < cols.length; j++){
        var cell = ws[cols[j] + rn], v = '';
        if(cell){
          if(cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z)) v = serialText(cell.v, d1904);
          else if(cell.t === 'd' && cell.v instanceof Date) v = stamp(Date.UTC(cell.v.getFullYear(), cell.v.getMonth(), cell.v.getDate(), cell.v.getHours(), cell.v.getMinutes()));
          else if(cell.t === 'n') v = cell.v;
          else if(cell.t === 's' || cell.t === 'str') v = String(cell.v);
          else if(cell.t === 'b') v = cell.v ? 1 : 0;
        }
        row.push(v);
      }
      rows.push(row);
    }
    return { rows: rows, decimalComma: false, sheet: name };
  };
  function stamp(ms){ var d = new Date(ms); return d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1) + '-' + two(d.getUTCDate()) + ' ' + two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()); }
  // An Excel serial: a time of day alone below 1, else a date and time.
  function serialText(serial, d1904){
    if(!isFinite(serial)) return '';
    if(serial >= 0 && serial < 1){ var m = Math.round(serial * 1440); return two(Math.floor(m / 60) % 24) + ':' + two(m % 60); }
    return stamp(Math.round(((serial + (d1904 ? 1462 : 0)) - 25569) * 86400) * 1000);
  }

  /* ── Reading a cell ── */
  function blank(x){ return x === undefined || x === null || (typeof x === 'string' && !x.trim()); }
  // A number, written as a number, a percentage, or with thousands separated.
  function cellNum(x, dc){
    if(typeof x === 'number') return isFinite(x) ? x : NaN;
    if(typeof x !== 'string') return NaN;
    var s = x.trim().replace(/[\s  ']/g, '');
    if(!s) return NaN;
    var pct = s.charAt(s.length - 1) === '%';
    if(pct) s = s.slice(0, -1);
    if(dc && s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if(/^[-+]?\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) s = s.replace(/,/g, '');
    if(!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    var v = parseFloat(s);
    return pct ? v / 100 : v;
  }
  CX.cellNum = cellNum;
  // An hour of the day: 13, 13:00, 1 PM, 1:00 p.m., 13:00-14:00. NaN if it is not one; -1 if it is not on the hour.
  var RE_HOUR = /^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*([ap])?\.?\s*(?:m\.?)?(?:\s*[-–]\s*\d{1,2}(?:[:.]\d{2})?(?::\d{2})?\s*(?:[ap]\.?\s*m\.?)?)?$/i;
  function hourOf(x){
    if(typeof x === 'number') return Number.isInteger(x) && x >= 0 && x <= 24 ? x : NaN;
    if(typeof x !== 'string') return NaN;
    var m = RE_HOUR.exec(x.trim());
    if(!m) return NaN;
    var h = +m[1], mi = m[2] ? +m[2] : 0;
    if(m[3]){ if(h < 1 || h > 12) return NaN; h = h % 12 + (/p/i.test(m[3]) ? 12 : 0); }
    if(h > 24 || mi > 59) return NaN;
    return mi ? -1 : h;
  }
  /* A day: Monday 0 to Sunday 6, 'wd' for a weekday, 'we' for the weekend,
     'pk' for the still, overcast peak day, 'any' for every day (one typical
     day, as no day named). English or Indonesian. */
  var DAY = { mon: 0, monday: 0, senin: 0, tue: 1, tues: 1, tuesday: 1, selasa: 1, wed: 2, weds: 2, wednesday: 2, rabu: 2,
              thu: 3, thur: 3, thurs: 3, thursday: 3, kamis: 3, fri: 4, friday: 4, jumat: 4, "jum'at": 4, sat: 5, saturday: 5, sabtu: 5,
              sun: 6, sunday: 6, minggu: 6, ahad: 6,
              weekday: 'wd', weekdays: 'wd', workday: 'wd', workdays: 'wd', 'working day': 'wd', 'business day': 'wd', 'mon-fri': 'wd', 'hari kerja': 'wd',
              weekend: 'we', weekends: 'we', 'weekend day': 'we', 'sat-sun': 'we', 'akhir pekan': 'we', 'hari libur': 'we',
              'peak day': 'pk', 'still day': 'pk', 'hari puncak': 'pk',
              'every day': 'any', 'any day': 'any', 'all days': 'any', 'typical day': 'any', 'setiap hari': 'any' };
  function dayOf(x){
    if(typeof x !== 'string') return null;
    var s = x.trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ').replace(/\s*[-–]\s*/g, '-');
    // "Peak" alone is the peak day in a Day column, but never a header's word.
    return own.call(DAY, s) ? DAY[s] : s === 'peak' ? 'pk' : null;
  }
  // A cell naming the peak day, alone or with its season ("Summer peak day", "Peak day, Winter").
  function isPeak(x){ return typeof x === 'string' && /(^|[^a-z])(peak|still|puncak)([^a-z]|$)/i.test(x); }
  /* A date and time: 2026-01-05 13:00, 2026/01/05T13:00:00, 5/1/2026 13:00.
     A date written with the day or the month first is read day first unless
     the month cannot be (13/1 is the 13th), or as order ('dmy' or 'mdy')
     says for a whole file. */
  var RE_ISO = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T\s,]+(.+))?$/, RE_DMY = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})(?:[T\s,]+(.+))?$/;
  function whenOf(x, order){
    if(typeof x !== 'string') return null;
    var s = x.trim(), m, y, mo, d, rest;
    if((m = RE_ISO.exec(s))){ y = +m[1]; mo = +m[2]; d = +m[3]; rest = m[4]; }
    else if((m = RE_DMY.exec(s))){
      y = +m[3]; d = +m[1]; mo = +m[2]; rest = m[4];
      if(order === 'mdy' || (!order && mo > 12 && d <= 12)){ var t = d; d = mo; mo = t; }
    }
    else return null;
    var h = rest === undefined ? 0 : hourOf(rest.replace(/\.\d+$/, ''));
    if(!(h >= 0)) return null;
    var ms = Date.UTC(y, mo - 1, d), dt = new Date(ms);
    if(dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { day: Math.floor(ms / 86400000), wd: (dt.getUTCDay() + 6) % 7, h: h, mon: mo - 1 };
  }
  // A whole file's dates: day first or month first, from any that can only be one; null if they disagree.
  function dateOrder(cells){
    var dmy = false, mdy = false;
    cells.forEach(function(c){
      var m = typeof c === 'string' && RE_DMY.exec(c.trim());
      if(!m) return;
      if(+m[1] > 12) dmy = true;
      if(+m[2] > 12) mdy = true;
    });
    return dmy && mdy ? null : mdy ? 'mdy' : 'dmy';
  }
  // A day and an hour in one cell: "Mon 13:00", "Weekday, 1 PM", or a date and time.
  function dayHourOf(x){
    if(typeof x !== 'string') return null;
    var w = whenOf(x);
    if(w) return { d: w.wd, h: w.h, date: w.day };
    var m = /^(.*?[A-Za-z'.])[\s,]+(\d.*)$/.exec(x.trim());
    if(!m) return null;
    var d = dayOf(m[1]), h = hourOf(m[2]);
    return d !== null && h >= 0 ? { d: d, h: h } : null;
  }

  /* ── A header: a season, a day, a unit ── */
  var SEASON = { summer: 'Summer', autumn: 'Autumn', fall: 'Autumn', winter: 'Winter', spring: 'Spring',
                 dry: 'Dry season', kemarau: 'Dry season', wet: 'Wet season', rainy: 'Wet season', hujan: 'Wet season', penghujan: 'Wet season' };
  var EVERY = { all: 1, every: 1, any: 1, year: 1, annual: 1, semua: 1 };
  function headerOf(h){
    var text = String(h === undefined || h === null ? '' : h).replace(/\s+/g, ' ').trim(), unit = 'pu', m;
    var s = text;
    if((m = /^(.*?)\s*[\[(]\s*(mw|%|p\.?\s?u\.?|per unit)\s*[\])]\s*$/i.exec(s)) || (m = /^(.*?)\s+(mw|%|p\.u\.)$/i.exec(s))){
      var u = m[2].toLowerCase();
      unit = u === 'mw' ? 'mw' : u === '%' ? 'pct' : 'pu';
      s = m[1].trim();
    }
    var words = s.toLowerCase().split(/[^a-z']+/).filter(Boolean), season = null, day = null, every = false;
    words.forEach(function(w){
      if(own.call(SEASON, w) && !season) season = SEASON[w];
      else if(own.call(EVERY, w)) every = true;
      if(own.call(DAY, w) && day === null) day = DAY[w];
    });
    if(s === '*') every = true;
    return { text: text, season: season, every: every && !season, day: day, unit: unit, words: words };
  }
  var HOUR_HEAD = /^(hour|hours|hr|h|time|jam|waktu|hour of (the )?day|hour ending|he)$/i, DAY_HEAD = /^(day|days|weekday|day of (the )?week|hari|type of day|day type)$/i;
  // A season cell: its season, '*' for every season or none named (a bare "Peak day"), or null if it is not one.
  function seasonCell(c){ var hd = headerOf(c); return hd.season || (hd.every || isPeak(c) ? '*' : null); }

  // The names of the seasons each climate has, and which one the file's fit.
  function climateFor(names, cur){
    var fits = function(k){ var own2 = CX.CLIMATES[k].seasons.map(function(s){ return s.name; }); return names.every(function(n){ return own2.indexOf(n) >= 0; }); };
    if(fits(cur)) return cur;
    var keys = Object.keys(CX.CLIMATES).filter(fits);
    return keys.length ? keys[0] : null;
  }
  var DAYS_OF = { day: [null], day2: ['wd', 'we'], week: [0, 1, 2, 3, 4, 5, 6] };
  function slotName(r, di, h){
    var d = r === 'week' ? CX.DAYS[di] + ' ' : r === 'day2' ? (di ? 'Weekend ' : 'Weekday ') : '';
    return d + two(h) + ':00';
  }
  // A grid from one sampling to another: each day of r takes the day of g.r that stands for it.
  function expand(g, r, name){
    var ser = CX.tsSeries(g, name), wds = r === 'week' ? [0, 1, 2, 3, 4, 5, 6] : r === 'day2' ? [0, 5] : [0], out = [];
    wds.forEach(function(wd){ var at = CX.dayOf(g.r, wd) * 24; for(var h = 0; h < 24; h++) out.push(ser[at + h]); });
    return out;
  }
  CX.expandGrid = expand;

  /* Read a file's rows as one profile.
     opts: { kind: 'load' | 'pv' | 'wind', who: its name for messages,
             climate: the climate's key now, peak: the peak demand now (MW),
             hemi: 's' or 'n', whose months a year of hours is sorted by,
             year: the plan's first year, where a year in order begins,
             current(climate): the profile now as the run takes it, a grid
             ({ r, s }: a load per unit of the year's peak, a farm's
             availability) for that climate's seasons }.
     Gives { errors, ts, notes, peak (MW, a load in MW), climate (when the
             file asks for another), used: { r, rows, seasons, unit, peak,
             year: { from, to, days } for a year } }. */
  CX.readProfileFile = function(table, opts){
    var rows0 = table && table.rows ? table.rows : [], dc = !!(table && table.decimalComma), load = opts.kind === 'load';
    var out = { errors: [], ts: null, notes: [], peak: null, climate: null, used: null };
    var fail = function(msg){ out.errors.push(msg); out.ts = null; return out; };
    var seasonNames = function(k){ return CX.CLIMATES[k].seasons.map(function(s){ return s.name; }); };
    var hemi = opts.hemi === 'n' ? 'n' : 's', C0 = opts.climate;
    // Notes and blank rows are skipped; line numbers are the file's.
    var rows = [], lineNo = [];
    rows0.forEach(function(r, i){
      if(!Array.isArray(r) || r.every(blank)) return;
      var firstCell = r.filter(function(c){ return !blank(c); })[0];
      if(typeof firstCell === 'string' && /^\s*#/.test(firstCell)) return;
      rows.push(r); lineNo.push(i + 1);
    });
    if(!rows.length) return fail('The file is empty.');
    // The header is the first row, unless it already holds a number.
    var head = rows[0], hasHead = !head.some(function(c){ return !isNaN(cellNum(c, dc)); });
    var data = hasHead ? rows.slice(1) : rows, lines = hasHead ? lineNo.slice(1) : lineNo;
    if(!hasHead) head = [];
    if(!data.length) return fail('The file has a header row but no rows of values under it.');
    var width = head.length;
    data.forEach(function(r){ if(r.length > width) width = r.length; });
    var cell = function(i, j){ var r = data[i]; return j < r.length ? r[j] : ''; };
    var col = function(j){ var a = []; for(var i = 0; i < data.length; i++) a.push(cell(i, j)); return a; };
    var filled = function(a){ return a.filter(function(c){ return !blank(c); }); };

    // The label columns: an hour, a day, a season, both a day and an hour, or a date and time.
    var hourCol = -1, dayCol = -1, bothCol = -1, seasonCol = -1, numericDays = false;
    for(var j = 0; j < width; j++){
      var a = filled(col(j)), hd = String(head[j] === undefined ? '' : head[j]).trim(), k = '';
      if(!a.length) continue;
      var allNum = a.every(function(c){ return !isNaN(cellNum(c, dc)); });
      if(a.every(function(c){ return dayOf(String(c)) !== null; })) k = 'day';
      else if(!allNum && a.every(function(c){ return typeof c === 'string' && seasonCell(c) !== null; })) k = 'season';
      else if(!allNum && a.every(function(c){ return dayHourOf(String(c)) !== null; })) k = 'both';
      else if(DAY_HEAD.test(hd) && allNum && a.every(function(c){ var v = cellNum(c, dc); return Number.isInteger(v) && v >= 1 && v <= 7; })){ k = 'day'; numericDays = true; }
      else if(a.every(function(c){ return !isNaN(hourOf(typeof c === 'number' ? c : String(c))); })){
        // Numbers 0 to 23 (or 1 to 24) may be values: an hour column says so in its header, or holds every hour of the day first.
        var text = a.some(function(c){ return typeof c === 'string' && /[:apm]/i.test(c); });
        var hrs = {};
        a.forEach(function(c){ hrs[hourOf(typeof c === 'number' ? c : String(c))] = 1; });
        if(HOUR_HEAD.test(hd) || text || (Object.keys(hrs).length >= 24 && !seasonCell(hd) && j < 3)) k = 'hour';
      }
      if(DAY_HEAD.test(hd) && k !== 'day' && !allNum)
        return fail('The ' + hd + ' column holds “' + String(a.filter(function(c){ return dayOf(String(c)) === null; })[0]).slice(0, 30) + '”, which is not a day. Write Mon to Sun, or Weekday and Weekend.');
      if(k === 'hour'){ if(hourCol >= 0) return fail('Columns ' + (hourCol + 1) + ' and ' + (j + 1) + ' both look like hours of the day. Keep one Hour column.'); hourCol = j; }
      else if(k === 'day' && dayCol < 0) dayCol = j;
      else if(k === 'both' && bothCol < 0) bothCol = j;
      else if(k === 'season' && seasonCol < 0) seasonCol = j;
    }
    var labels = [hourCol, dayCol, bothCol, seasonCol];
    var useBoth = bothCol >= 0 && hourCol < 0;
    for(var i0 = 0; i0 < data.length; i0++) if(hourCol >= 0 && !blank(cell(i0, hourCol)) && hourOf(cell(i0, hourCol)) === -1)
      return fail('Row ' + lines[i0] + ' is at ' + String(cell(i0, hourCol)) + ', not on the hour. Give one row an hour, on the hour.');

    // The columns of values, and what each header says.
    var cols = [];
    for(var jc = 0; jc < width; jc++){
      if(labels.indexOf(jc) >= 0) continue;
      var vals = col(jc), any = vals.some(function(c){ return !blank(c); }), hd2 = headerOf(head[jc]);
      if(!any && !hd2.text) continue;
      var bad = [];
      vals.forEach(function(c, i){ if(!blank(c) && isNaN(cellNum(c, dc))) bad.push(i); });
      // A column of words is a note or a name, not values.
      if(bad.length && bad.length === filled(vals).length && !hd2.season && !hd2.every) continue;
      if(bad.length) return fail('“' + String(vals[bad[0]]).slice(0, 30) + '” in row ' + lines[bad[0]] + (hd2.text ? ', ' + hd2.text + ',' : '') + ' is not a number.');
      cols.push({ j: jc, hd: hd2 });
    }
    if(!cols.length) return fail('The file has no column of numbers. Give the hours’ values in a column a season, as the template does.');
    // Days as columns only when two or more say so ("Sun" alone may be the sun).
    var dayCols = cols.filter(function(c){ return c.hd.day !== null; }).length >= 2;
    if(!dayCols) cols.forEach(function(c){ c.hd.day = null; });

    // A year of hours: dated rows over more than a week, or a year's rows in order.
    var dateCells = bothCol >= 0 ? filled(col(bothCol)) : [];
    var dated = dateCells.length > 0 && dateCells.every(function(c){ return typeof c === 'string' && whenOf(c) !== null; });
    if(dated){
      var dset = {};
      dateCells.forEach(function(c){ dset[whenOf(c).day] = 1; });
      if(Object.keys(dset).length > 7) return year(true);
    } else if(dayCol < 0 && !dayCols && (data.length === 8760 || data.length === 8784)) return year(false);
    if(data.length > 168 * CX.MAX_SEASONS + 24)
      return fail('The file has ' + data.length.toLocaleString('en-AU') + ' rows. A profile is one typical day (24 rows), a weekday and a weekend day (48) or a week (168), for every season or each one, or a whole year of hours (8,760 rows, in order or dated).');

    // The peak day's rows, kept apart: Peak day in the Day column, or a Season cell that names it.
    var pkCells = [];
    for(var ip = 0; ip < data.length; ip++){
      var bCell = useBoth ? cell(ip, bothCol) : '', bh = useBoth && !blank(bCell) ? dayHourOf(String(bCell)) : null;
      if((dayCol >= 0 && dayOf(String(cell(ip, dayCol))) === 'pk') || (seasonCol >= 0 && isPeak(cell(ip, seasonCol))) || (bh && bh.d === 'pk'))
        pkCells.push({ i: ip, line: lines[ip], h: hourCol >= 0 && !blank(cell(ip, hourCol)) ? hourOf(cell(ip, hourCol)) : bh ? bh.h : null,
                       sn: seasonCol >= 0 && !blank(cell(ip, seasonCol)) ? seasonCell(cell(ip, seasonCol)) : null, row: data[ip] });
    }
    var pkSeason = null;
    if(pkCells.length){
      for(var q0 = 0; q0 < pkCells.length; q0++){
        var sq = pkCells[q0].sn;
        if(sq && sq !== '*'){ if(pkSeason && pkSeason !== sq) return fail('The peak day’s rows name both ' + pkSeason + ' and ' + sq + '. Give one peak day.'); pkSeason = sq; }
      }
      var isPk = {};
      pkCells.forEach(function(c){ isPk[c.i] = 1; });
      lines = lines.filter(function(_, i){ return !isPk[i]; });
      data = data.filter(function(_, i){ return !isPk[i]; });
      if(!data.length) return fail('The file has only the peak day. Give the typical days too.');
    }

    // Every row's season, day and hour.
    var rowSeason = [], rowDay = [], rowHour = [], dates = {};
    for(var i = 0; i < data.length; i++){
      var d = null, h = null, sn = null;
      if(useBoth && !blank(cell(i, bothCol))){ var b = dayHourOf(String(cell(i, bothCol))); d = b.d; h = b.h; if(b.date !== undefined) dates[b.date] = 1; }
      if(dayCol >= 0 && !blank(cell(i, dayCol))) d = numericDays ? cellNum(cell(i, dayCol), dc) - 1 : dayOf(String(cell(i, dayCol)));
      if(d === 'any') d = null;
      if(hourCol >= 0 && !blank(cell(i, hourCol))) h = hourOf(cell(i, hourCol));
      if(seasonCol >= 0 && !blank(cell(i, seasonCol))) sn = seasonCell(cell(i, seasonCol));
      rowSeason.push(sn); rowDay.push(d); rowHour.push(h);
    }
    // Dates of one day are a typical day; of a week, its seven weekdays.
    var nDates = Object.keys(dates).length;
    if(nDates === 1) rowDay = rowDay.map(function(){ return null; });
    else if(nDates > 7) return fail('The dates run over ' + nDates + ' days. Give one day, one week of seven days, or a whole year.');
    var labelled = hourCol >= 0 || useBoth;
    // Hours 1 to 24 are the hour ending then.
    if(labelled){
      var hs = rowHour.filter(function(x){ return x !== null; });
      if(hs.indexOf(24) >= 0 && hs.indexOf(0) < 0){ rowHour = rowHour.map(function(x){ return x === null ? null : x - 1; }); out.notes.push('Hours 1 to 24 are read as the hour ending then, so 1 is 00:00 to 01:00.'); }
      else if(hs.indexOf(24) >= 0) return fail('The hours run from 0 to 24, which is 25 hours. Give 0 to 23, or 1 to 24 for the hour ending.');
    }
    var anyDay = rowDay.some(function(x){ return x !== null; }) || dayCols;
    var groupOf = function(i){ return rowSeason[i] === null ? '' : rowSeason[i]; };
    if(!labelled){
      // No hours named: the rows' order from 00:00, within each season (and each day, where days are named).
      var cnt = {}, idx = [];
      for(var q = 0; q < data.length; q++){
        var key0 = groupOf(q) + '|' + (anyDay && !dayCols ? rowDay[q] : '');
        idx.push(cnt[key0] || 0); cnt[key0] = idx[q] + 1;
      }
      var sizes = Object.keys(cnt).map(function(g){ return cnt[g]; }), per = sizes[0];
      var okSize = anyDay ? per === 24 : [24, 48, 168].indexOf(per) >= 0;
      if(!okSize || sizes.some(function(z){ return z !== per; }))
        return fail('The file has ' + data.length + ' rows and no Hour column. ' + (anyDay ? 'Give each day 24 rows, from 00:00, or add an Hour column.' :
          'Give 24 rows for one typical day, 48 for a weekday then a weekend day, or 168 for Monday to Sunday' + (seasonCol >= 0 ? ', for each season' : '') + ', or add an Hour column.'));
      for(var q2 = 0; q2 < data.length; q2++){
        rowHour[q2] = idx[q2] % 24;
        if(!anyDay && per > 24) rowDay[q2] = per === 48 ? (idx[q2] < 24 ? 'wd' : 'we') : Math.floor(idx[q2] / 24);
      }
      out.notes.push('With no Hour column, its rows are read in order from ' + (anyDay || per === 24 ? '00:00.' : per === 48 ? 'a weekday’s 00:00 to a weekend day’s 23:00.' : 'Monday 00:00 to Sunday 23:00.'));
      if(per > 24) anyDay = true;
    } else if(!anyDay){
      // Hours that come round again with no day named: a weekday then a weekend day, or Monday to Sunday.
      var seen = {}, rounds = 0;
      rowHour.forEach(function(x, i){
        if(x === null) return;
        var key = groupOf(i) + '|' + x;
        seen[key] = (seen[key] || 0) + 1; rowDay[i] = seen[key] - 1;
        if(seen[key] > rounds) rounds = seen[key];
      });
      var uneven = Object.keys(seen).filter(function(k){ return seen[k] !== rounds; })[0];
      if(rounds > 1 && uneven !== undefined){
        var odd = Object.keys(seen).filter(function(k){ return seen[k] > 1; })[0].split('|');
        return fail(two(+odd[1]) + ':00' + (odd[0] ? ' in ' + odd[0] : '') + ' comes ' + seen[odd.join('|')] + ' times, but ' + two(+uneven.split('|')[1]) + ':00 ' + seen[uneven] + (seen[uneven] === 1 ? ' time' : ' times') + '. Give each hour one row, or add a Day column.');
      }
      if(rounds === 2) rowDay = rowDay.map(function(x){ return x === null ? null : x ? 'we' : 'wd'; });
      else if(rounds === 1) rowDay = rowDay.map(function(){ return null; });
      else if(rounds !== 7) return fail('Each hour of the day comes ' + rounds + ' times with no day named. Add a Day column: Mon to Sun, or Weekday and Weekend.');
      if(rounds > 1){ anyDay = true; out.notes.push('With no Day column, the hours that come round again are read as ' + (rounds === 2 ? 'a weekday, then a weekend day.' : 'Monday to Sunday.')); }
    }

    // The sampling the file holds.
    var named = [];
    rowDay.forEach(function(x){ if(x !== null) named.push(x); });
    cols.forEach(function(c){ if(c.hd.day !== null) named.push(c.hd.day); });
    var hasWeek = named.some(function(x){ return typeof x === 'number'; }), hasTwo = named.some(function(x){ return x === 'wd' || x === 'we'; });
    if(hasWeek && hasTwo) return fail('The file names both days of the week (Mon to Sun) and Weekday or Weekend. Use one or the other.');
    var r = hasWeek ? 'week' : hasTwo ? 'day2' : 'day', dayIdx = function(x){ return r === 'week' ? x : r === 'day2' ? (x === 'we' ? 1 : 0) : 0; };
    var n = 24 * CX.RES_DAYS[r];

    // The seasons, and the climate they belong to.
    var names = [];
    cols.forEach(function(c){ if(c.hd.season && names.indexOf(c.hd.season) < 0) names.push(c.hd.season); });
    rowSeason.forEach(function(x){ if(x && x !== '*' && names.indexOf(x) < 0) names.push(x); });
    if(pkSeason && names.indexOf(pkSeason) < 0) names.push(pkSeason);
    var generic = cols.filter(function(c){ return !c.hd.season && !c.hd.every; }), genericKeys = {};
    generic.forEach(function(c){ var key = c.hd.day === null ? 'x' : String(c.hd.day); genericKeys[key] = (genericKeys[key] || 0) + 1; });
    if(Object.keys(genericKeys).some(function(k){ return genericKeys[k] > 1; }))
      return fail('The file has ' + generic.length + ' columns of values with no season in their header. Head each with its season (' + list(seasonNames(C0)) + '), or give one column for every season.');
    generic.forEach(function(c){ c.hd.every = true; });
    var climate = climateOf(names);
    if(!climate) return out;

    // The values, slot by slot: a season's day and hour.
    var unit = unitOf();
    if(!unit) return out;
    var grid = {}, from = {}, neg = 0;
    var valueOf = function(raw){
      var x = cellNum(raw, dc);
      if(unit === 'pct' && !/%\s*$/.test(String(raw))) x = x / 100;
      if(x < 0){ neg++; x = 0; }
      return x;
    };
    for(var ci = 0; ci < cols.length; ci++){
      var c2 = cols[ci];
      for(var i2 = 0; i2 < data.length; i2++){
        var key2 = c2.hd.season || (seasonCol >= 0 && rowSeason[i2] ? rowSeason[i2] : '*');
        var dd = c2.hd.day !== null ? c2.hd.day : rowDay[i2], hh = rowHour[i2], raw = cell(i2, c2.j);
        if(hh === null || (r !== 'day' && dd === null)){
          if(!blank(raw)) return fail('Row ' + lines[i2] + ' has a value but no ' + (hh === null ? 'hour' : 'day') + '.');
          continue;
        }
        if(!grid[key2]){ grid[key2] = new Array(n); from[key2] = new Array(n); }
        var at = dayIdx(dd) * 24 + hh;
        if(from[key2][at] !== undefined)
          return fail('Rows ' + from[key2][at] + ' and ' + lines[i2] + ' are both ' + (key2 === '*' ? '' : key2 + ', ') + slotName(r, dayIdx(dd), hh) + '. Give each hour one row.');
        from[key2][at] = lines[i2];
        grid[key2][at] = blank(raw) ? NaN : valueOf(raw);
      }
    }
    // Every hour of the sampling has a row.
    for(var key3 in grid){
      var missing = [];
      for(var s3 = 0; s3 < n; s3++) if(from[key3][s3] === undefined) missing.push(s3);
      if(missing.length)
        return fail('The file has no row for ' + (key3 === '*' ? '' : key3 + ', ') + slotName(r, Math.floor(missing[0] / 24), missing[0] % 24) + (missing.length > 1 ? ' and ' + (missing.length - 1) + ' more hour' + (missing.length > 2 ? 's' : '') : '') +
          '. ' + { day: 'One typical day needs its 24 hours, 00:00 to 23:00.', day2: 'A weekday and a weekend day need 24 hours each.', week: 'A week needs all 168 hours, Monday 00:00 to Sunday 23:00.' }[r]);
    }
    // The peak day: one value an hour, every hour once, none blank.
    var pk = null;
    if(pkCells.length){
      var pv = new Array(24), pl = new Array(24), ph = pkCells.map(function(c, z){ return c.h === null && !labelled ? z : c.h; });
      if(ph.indexOf(24) >= 0 && ph.indexOf(0) < 0) ph = ph.map(function(x){ return x === null ? null : x - 1; });
      for(var z = 0; z < pkCells.length; z++){
        var pc = pkCells[z], hz = ph[z];
        if(!(hz >= 0 && hz <= 23)) return fail('Row ' + pc.line + ' is the peak day with no hour. Give its 24 hours, 00:00 to 23:00.');
        if(pl[hz] !== undefined) return fail('Rows ' + pl[hz] + ' and ' + pc.line + ' are both the peak day’s ' + two(hz) + ':00. Give each hour one row.');
        pl[hz] = pc.line;
        var own2 = cols.length === 1 ? cols[0] : cols.filter(function(c){ return pkSeason && c.hd.season === pkSeason; })[0] || null;
        if(!own2){
          var full = cols.filter(function(c){ return !blank(pc.row[c.j]); });
          if(full.length !== 1) return fail('Row ' + pc.line + ', the peak day’s ' + two(hz) + ':00, has ' + (full.length ? full.length + ' values' : 'no value') + '. Give the peak day one value an hour.');
          own2 = full[0];
        }
        var rv = own2.j < pc.row.length ? pc.row[own2.j] : '';
        if(blank(rv)) return fail('The peak day’s ' + two(hz) + ':00 has no value. Give all 24 of its hours, or leave its rows out.');
        pv[hz] = valueOf(rv);
      }
      for(var hm = 0; hm < 24; hm++) if(pl[hm] === undefined) return fail('The peak day has no row for ' + two(hm) + ':00. Give all 24 of its hours, or leave its rows out.');
      pk = { s: pkSeason || '', v: pv };
    }
    return finish({ grid: grid, r: r, pk: pk, climate: climate, unit: unit, neg: neg, rows: data.length + pkCells.length, keptWhy: ['the file has no column for', 'the file has no columns for'] });

    // The climate the seasons named belong to: the one now if it has them; a load may move to another, a farm may not.
    function climateOf(nm){
      var cl = nm.length ? climateFor(nm, C0) : C0;
      if(!cl){ fail('The seasons are ' + list(nm) + ', which no one climate has. Use ' + Object.keys(CX.CLIMATES).map(function(k){ return list(seasonNames(k)); }).filter(function(x, i, all){ return all.indexOf(x) === i; }).join(', or ') + '.'); return null; }
      if(cl !== C0 && !load){ fail('The seasons are ' + list(nm) + ', but the climate (on the Demand tab) has ' + list(seasonNames(C0)) + '. Head the columns with those, or change the climate first.'); return null; }
      return cl;
    }
    // One unit for every column of values; MW for a load only.
    function unitOf(){
      var units = {};
      cols.forEach(function(c){ units[c.hd.unit] = 1; });
      if(Object.keys(units).length > 1){ fail('The columns are in different units (' + Object.keys(units).map(function(u){ return { pu: 'per unit', pct: '%', mw: 'MW' }[u]; }).join(' and ') + '). Give them all in one.'); return null; }
      var u = cols[0].hd.unit;
      if(u === 'mw' && !load){ fail(opts.who + ' takes the share of its rating it can give each hour, from 0 to 1, or in % with [%] in the header, not MW.'); return null; }
      return u;
    }

    /* A year of hours, averaged into a typical week for each season. Each
       hour goes to its season (its Season cell, else its month's) and its
       weekday; a week's hour is the average of every one that comes to it,
       taken as the first plus the average step from it, so hours that are
       all the same give exactly that. The peak day stays out of them. */
    function year(isDated){
      if(cols.length !== 1) return fail('A year of hours takes one column of values, its hours from top to bottom, but the file has ' + cols.length + '. Keep one.');
      var c0 = cols[0];
      if(c0.hd.season) return fail('A year of hours takes one column of values for the whole year, not one headed ' + c0.hd.season + '. Its seasons come from a Season column, or from the months.');
      var u = unitOf();
      if(!u) return out;
      var order = isDated ? dateOrder(filled(col(bothCol))) : 'dmy';
      if(!order) return fail('Its dates are written both day first and month first. Write them one way, as 2026-01-31 is.');
      var Y = opts.year >= 1900 && opts.year <= 2200 ? Math.round(opts.year) : 2026, day0 = Math.floor(Date.UTC(Y, 0, 1) / 86400000);
      // When each row is: an hour since 1970.
      var recs = [], hcol = [];
      for(var i = 0; i < data.length; i++){
        var hv = hourCol >= 0 && !blank(cell(i, hourCol)) ? hourOf(cell(i, hourCol)) : null;
        hcol.push(hv);
        if(isDated){
          var bc = cell(i, bothCol);
          if(blank(bc)){ if(!blank(cell(i, c0.j))) return fail('Row ' + lines[i] + ' has a value but no date.'); continue; }
          var w = whenOf(String(bc), order);
          if(!w) return fail('Row ' + lines[i] + '’s date, ' + String(bc).slice(0, 30) + ', is not a date.');
          if(hourCol >= 0 && hv === null) return fail('Row ' + lines[i] + ' has no hour.');
          recs.push({ i: i, t: w.day * 24 + (hourCol >= 0 ? hv : w.h) });
        } else recs.push({ i: i, t: day0 * 24 + i });
      }
      // Hours 1 to 24, or times from 01:00 to the next year's 00:00, are the hour ending then.
      var ending = false;
      if(hourCol >= 0){
        var hh0 = hcol.filter(function(x){ return x !== null; });
        if(hh0.indexOf(24) >= 0 && hh0.indexOf(0) < 0) ending = true;
        else if(hh0.indexOf(24) >= 0) return fail('The hours run from 0 to 24, which is 25 hours. Give 0 to 23, or 1 to 24 for the hour ending.');
        if(ending && isDated) recs.forEach(function(rc){ rc.t -= 1; });
        if(!isDated) for(var iv = 0; iv < recs.length; iv++){
          var want = iv % 24, got = hcol[iv] === null ? want : hcol[iv] - (ending ? 1 : 0);
          if(got !== want) return fail('Row ' + lines[iv] + ' is at ' + two(got) + ':00, but in order from 1 January 00:00 it is ' + two(want) + ':00. Give the year’s hours in order, or add a column of dates.');
        }
      } else if(isDated && recs.length){
        var tmin = Infinity, tmax = -Infinity;
        recs.forEach(function(rc){ if(rc.t < tmin) tmin = rc.t; if(rc.t > tmax) tmax = rc.t; });
        if(tmin % 24 === 1 && tmax % 24 === 0){ ending = true; recs.forEach(function(rc){ rc.t -= 1; }); }
      }
      if(ending) out.notes.push('Its hours are read as the hour ending then, so 01:00 is 00:00 to 01:00.');
      if(!recs.length) return fail('The file has no dated rows.');
      recs.sort(function(x, y){ return x.t - y.t; });
      var at0 = {};
      for(var rq = 0; rq < recs.length; rq++){
        var rc = recs[rq], dt = new Date(rc.t * 3600000);
        if(at0[rc.t] !== undefined) return fail('Rows ' + lines[at0[rc.t]] + ' and ' + lines[rc.i] + ' are both ' + dayText(Math.floor(rc.t / 24)) + ' ' + two(rc.t % 24) + ':00. Give each hour one row.');
        at0[rc.t] = rc.i;
        rc.day = Math.floor(rc.t / 24); rc.h = rc.t % 24; rc.wd = (dt.getUTCDay() + 6) % 7; rc.mon = dt.getUTCMonth();
        var sc = seasonCol >= 0 && !blank(cell(rc.i, seasonCol)) ? cell(rc.i, seasonCol) : null;
        rc.named = sc === null ? null : seasonCell(sc);
        if(rc.named === '*') rc.named = null;
        rc.pk = sc !== null && isPeak(sc);
        var raw = cell(rc.i, c0.j);
        rc.v = blank(raw) ? NaN : cellNum(raw, dc);
      }
      // The seasons: as named, the rest by their month in the climate they belong to.
      var nm = [];
      recs.forEach(function(rc){ if(rc.named && nm.indexOf(rc.named) < 0) nm.push(rc.named); });
      var cl = climateOf(nm);
      if(!cl) return out;
      var seasons = seasonNames(cl), byMonth = 0;
      recs.forEach(function(rc){ rc.season = rc.named || seasons[CX.seasonOfMonth(cl, hemi, rc.mon)]; if(!rc.named) byMonth++; });
      // Values, in the file's unit.
      var neg = 0;
      recs.forEach(function(rc){
        if(isNaN(rc.v)) return;
        if(u === 'pct' && !/%\s*$/.test(String(cell(rc.i, c0.j)))) rc.v = rc.v / 100;
        if(rc.v < 0){ neg++; rc.v = 0; }
      });
      // The peak day: the one its Season cells mark, else a load's with the year's highest hour.
      var pkDay = null, pkS = '', marked = recs.filter(function(rc){ return rc.pk; }), auto = false;
      if(marked.length){
        var md = {};
        marked.forEach(function(rc){ md[rc.day] = 1; });
        if(Object.keys(md).length > 1) return fail('The rows marked as the peak day run over ' + Object.keys(md).length + ' days. Mark the 24 hours of one day.');
        pkDay = marked[0].day;
        pkS = (marked.filter(function(rc){ return rc.named; })[0] || marked[0]).season;
      } else if(load){
        var best = null;
        recs.forEach(function(rc){ if(!isNaN(rc.v) && (best === null || rc.v > best.v)) best = rc; });
        if(best){ pkDay = best.day; pkS = best.season; auto = best; }
      }
      // The typical weeks, the peak day left out; an hour of the week with no day in its season takes the season's average hour.
      var acc = {}, mk = function(m){ return { v0: new Array(m), d: new Array(m).fill(0), n: new Array(m).fill(0) }; };
      var add = function(A, x, v){ if(!A.n[x]) A.v0[x] = v; A.d[x] += v - A.v0[x]; A.n[x]++; };
      var mean = function(A, x){ return A.n[x] ? A.v0[x] + A.d[x] / A.n[x] : NaN; };
      var dayset = {}, minDay = Infinity, maxDay = -Infinity, blanks = 0;
      recs.forEach(function(rc){
        dayset[rc.day] = 1; if(rc.day < minDay) minDay = rc.day; if(rc.day > maxDay) maxDay = rc.day;
        if(isNaN(rc.v)){ blanks++; return; }
        if(rc.day === pkDay) return;
        var A = acc[rc.season] || (acc[rc.season] = { wk: mk(168), hr: mk(24) });
        add(A.wk, rc.wd * 24 + rc.h, rc.v); add(A.hr, rc.h, rc.v);
      });
      var grid = {}, thin = 0;
      Object.keys(acc).forEach(function(sn){
        var A = acc[sn], g = new Array(168);
        for(var x = 0; x < 168; x++){ g[x] = mean(A.wk, x); if(isNaN(g[x])){ g[x] = mean(A.hr, x % 24); if(!isNaN(g[x])) thin++; } }
        grid[sn] = g;
      });
      var pk = null, pkGap = 0;
      if(pkDay !== null){
        var pv = new Array(24), pwd = (new Date(pkDay * 86400000).getUTCDay() + 6) % 7;
        recs.forEach(function(rc){ if(rc.day === pkDay && !isNaN(rc.v)) pv[rc.h] = rc.v; });
        for(var hp = 0; hp < 24; hp++) if(pv[hp] === undefined){
          pkGap++;
          var fillv = grid[pkS] ? grid[pkS][pwd * 24 + hp] : NaN;
          pv[hp] = isNaN(fillv) ? 0 : fillv;
        }
        pk = { s: pkS, v: pv };
      }
      var days = Object.keys(dayset).length;
      out.notes.push('A year of hours, ' + dayText(minDay) + ' to ' + dayText(maxDay) + ' (' + days.toLocaleString('en-AU') + ' days), is averaged into a typical week for each season, Monday to Sunday, ' +
        (byMonth ? (byMonth < recs.length ? 'by its Season column, and the rest ' : '') + 'by month for the ' + CX.HEMIS[hemi].toLowerCase() + ' hemisphere (' +
          list(CX.CLIMATES[cl].seasons.map(function(s, z){ var m = CX.seasonMonths(cl, hemi, z); return s.name + ' ' + CX.MONTHS[m[0]] + ' to ' + CX.MONTHS[m[m.length - 1]]; })) + ').' : 'by its Season column.'));
      if(pk) out.notes.push((auto ? 'Its highest hour, ' + two(auto.h) + ':00 on ' + dayText(pkDay) + ', makes that day' : 'The day its Season column marks, ' + dayText(pkDay) + ', is') +
        ' the still, overcast peak day (' + pkS + '), left out of the typical weeks.' + (pkGap ? ' ' + pkGap + ' of its hours missing take the typical week’s.' : ''));
      if(thin) out.notes.push(thin + ' hour' + (thin > 1 ? 's' : '') + ' of the typical weeks had no day of that weekday in the season, and take the season’s average hour.');
      if(blanks) out.notes.push(blanks + ' blank hour' + (blanks > 1 ? 's are' : ' is') + ' left out of the averages.');
      return finish({ grid: grid, r: 'week', pk: pk, climate: cl, unit: u, neg: neg, rows: recs.length, keptWhy: ['the year has no day in', 'the year has no days in'],
                      year: { from: minDay, to: maxDay, days: days } });
    }

    /* Both: a farm's shares, blanks and left-out seasons from the profile
       now, a load per unit of its highest hour (the peak day's too), and
       the climate a load's seasons say. */
    function finish(o){
      var grid = o.grid, r = o.r, n = 24 * CX.RES_DAYS[r], unit = o.unit, climate = o.climate, seasons = seasonNames(climate), pk = o.pk;
      // A farm's shares: above 1 they are percentages, if they stay within 100.
      var top = 0;
      for(var key4 in grid) grid[key4].forEach(function(v){ if(v > top) top = v; });
      if(pk) pk.v.forEach(function(v){ if(v > top) top = v; });
      if(!(top > 0)) return fail('Every value in the file is 0 or blank.');
      if(!load && unit === 'pu' && top > 1){
        if(top > 100) return fail('Its values run up to ' + fmt(top) + '. Give the share of the rating, from 0 to 1, or in % with [%] in the header.');
        for(var key5 in grid) grid[key5] = grid[key5].map(function(v){ return v / 100; });
        if(pk) pk.v = pk.v.map(function(v){ return v / 100; });
        out.notes.push('Its values run up to ' + fmt(top) + ', so they are read as %.');
      }
      if(load && unit === 'pu' && top > 2) out.notes.push('Its values run up to ' + fmt(top) + ' and are read as a shape. If they are MW, end a header with [MW] to set the peak demand from the file too.');

      // Blank cells and left-out seasons keep the profile as it is now.
      var cur = opts.current ? opts.current(climate) : null, peak0 = opts.peak > 0 ? opts.peak : 1;
      var scale = unit === 'mw' ? 1 / peak0 : 1, gaps = 0, kept = [], series = {};
      var fill = function(name, src){
        var now = cur ? expand(cur, r, name) : null, v = new Array(n);
        for(var t = 0; t < n; t++){
          var y = src ? src[t] : NaN;
          if(isNaN(y)){ if(src) gaps++; v[t] = now ? now[t] : 0; }
          else v[t] = y * scale;
        }
        return v;
      };
      var everyOnly = Object.keys(grid).length === 1 && grid['*'];
      if(everyOnly && !grid['*'].some(function(y){ return isNaN(y); })) series['*'] = fill('*', grid['*']);
      else seasons.forEach(function(name){
        var src = grid[name] || grid['*'] || null;
        if(!src) kept.push(name);
        series[name] = fill(name, src);
      });
      if(kept.length && !cur) return fail('The file has no ' + (o.year ? 'day in ' : 'column for ') + list(kept) + '.');
      // A load: per unit of its highest hour, which in MW is the peak demand. A farm: as it is, at most its rating.
      var pkv = pk ? pk.v.map(function(y){ return y * scale; }) : null;
      var most = 0, over = 0, res = { r: r, s: {} };
      for(var key6 in series) series[key6].forEach(function(v){ if(v > most) most = v; if(v > 1 + 1e-9) over++; });
      if(pkv) pkv.forEach(function(v){ if(v > most) most = v; if(v > 1 + 1e-9) over++; });
      if(!(most > 0)) return fail('Every value in the file is 0.');
      var per = function(v){ return load ? v / most : Math.min(1, v); };
      for(var key7 in series) res.s[key7] = series[key7].map(per);
      if(pkv) res.pk = { s: pk.s, h: pkv.map(per) };
      if(load && unit === 'mw') out.peak = r4(most * peak0);

      // A temperate load that peaks in winter is winter-peaking, and in summer summer-peaking: its peak day says, else its typical days.
      if(load && (climate === 'sum' || climate === 'win')){
        var hot = res.pk && (res.pk.s === 'Summer' || res.pk.s === 'Winter') ? res.pk.s : null;
        if(!hot && res.s.Summer && res.s.Winter){
          var ms = Math.max.apply(null, res.s.Summer), mw = Math.max.apply(null, res.s.Winter);
          hot = mw > ms ? 'Winter' : ms > mw ? 'Summer' : null;
        }
        if(hot === 'Winter' && climate === 'sum') climate = 'win';
        else if(hot === 'Summer' && climate === 'win') climate = 'sum';
      }
      if(climate !== opts.climate){ out.climate = climate; out.notes.push('The climate is now ' + CX.CLIMATES[climate].label.replace(/^./, function(z){ return z.toLowerCase(); }) + ', to match the file.'); }
      out.ts = res;
      out.used = { r: r, rows: o.rows, seasons: everyOnly ? [] : seasons.filter(function(z){ return kept.indexOf(z) < 0; }), unit: unit, peak: !!res.pk, year: o.year || null };
      if(kept.length) out.notes.push(list(kept) + ' kept ' + (kept.length > 1 ? 'their' : 'its') + ' profile, as ' + o.keptWhy[kept.length > 1 ? 1 : 0] + ' ' + (kept.length > 1 ? 'them' : 'it') + '.');
      if(gaps) out.notes.push(gaps + ' blank cell' + (gaps > 1 ? 's keep their hours' : ' keeps its hour') + ' as the profile gave ' + (gaps > 1 ? 'them' : 'it') + '.');
      if(o.neg) out.notes.push(o.neg + ' negative value' + (o.neg > 1 ? 's were' : ' was') + ' read as 0.');
      if(!load && over) out.notes.push(over + ' hour' + (over > 1 ? 's' : '') + ' above the rating ' + (over > 1 ? 'are' : 'is') + ' held at it.');
      if(out.peak !== null) out.notes.push('The peak demand is now the file’s highest hour, ' + fmt(out.peak) + ' MW.');
      return out;
    }
  };
  function dayText(day){ var d = new Date(day * 86400000); return d.getUTCDate() + ' ' + CX.MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }

  /* ── The templates: a profile as the run takes it, with notes on every way
     it can be filled in ──
     Typical days (one, a weekday and a weekend day, or a week), the same in
     every season or each season its own in a Season column, then the peak
     day; or a whole year, dated, with its peak day marked. Values are written
     to the last digit they hold, so one read back is the profile exactly. */
  // A grid's seasons as one series for every season: their average weighed by their days (seasons alike give exactly theirs).
  CX.everySeason = function(g, climate){
    var S = CX.CLIMATES[climate].seasons, n = 24 * CX.RES_DAYS[g.r], W = 0, out = new Array(n);
    var ser = S.map(function(s){ return CX.tsSeries(g, s.name); });
    S.forEach(function(s){ W += s.days; });
    for(var t = 0; t < n; t++){
      var v0 = ser[0][t], d = 0;
      for(var i = 1; i < S.length; i++) d += S[i].days * (ser[i][t] - v0);
      out[t] = v0 + d / W;
    }
    return { r: g.r, s: { '*': out } };
  };
  // The first day of year y in season si, where the full-year template puts the peak day.
  function peakDate(y, climate, hemi, si){
    var Y = CX.yearDays(y);
    for(var k = 0; k < Y.n; k++) if(CX.seasonOfMonth(climate, hemi, new Date((Y.d0 + k) * 86400000).getUTCMonth()) === si) return Y.d0 + k;
    return Y.d0;
  }
  var DAY_WORDS = { day: 'Day "Every day"', day2: 'Day Weekday or Weekend', week: 'Day Mon to Sun' };
  var WHAT = { day: 'one typical day', day2: 'a weekday and a weekend day', week: 'a typical week, Monday to Sunday' };
  // opts: { kind, who, climate, r, seasonal, year (for a whole year), hemi }.
  CX.templateNotes = function(o){
    var C = CX.CLIMATES[o.climate], names = C.seasons.map(function(s){ return s.name; }), load = o.kind === 'load', per = 24 * CX.RES_DAYS[o.r];
    var lines = [];
    if(o.year){
      var Y = CX.yearDays(o.year), hemi = o.hemi === 'n' ? 'n' : 's';
      lines.push('# Capacity Expansion Planner: ' + o.who + ', ' + C.label + '. Every hour of ' + o.year + ' (' + (24 * Y.n).toLocaleString('en-AU') + ' rows), averaged into a typical week for each season, Monday to Sunday, when it is opened.');
      lines.push('# Rows: Time, an hour a row in order. Season: the season its day goes into, by month for the ' + CX.HEMIS[hemi].toLowerCase() + ' hemisphere (' +
        list(C.seasons.map(function(s, i){ var m = CX.seasonMonths(o.climate, hemi, i); return s.name + ' ' + CX.MONTHS[m[0]] + ' to ' + CX.MONTHS[m[m.length - 1]]; })) +
        '). Change any to suit, or leave the column out to go by the months.');
    } else {
      lines.push('# Capacity Expansion Planner: ' + o.who + ', ' + C.label + '. ' + WHAT[o.r].replace(/^./, function(z){ return z.toUpperCase(); }) +
        (o.seasonal ? ' for each season (' + list(names) + ')' : ', the same in every season') + ', then the still, overcast peak day.');
      lines.push('# Rows: ' + (o.seasonal ? 'Season, ' : '') + DAY_WORDS[o.r] + ', Hour 00:00 to 23:00: ' + per + ' rows' + (o.seasonal ? ' a season.' : '.') +
        (o.seasonal ? ' Leave a season out to keep its profile as it is now.' : ' To give each season its own, add a Season column (' + list(names) + ') or take a seasonal template.'));
    }
    lines.push(load ? '# Values: per unit of the peak demand, the highest hour of the year 1. Or in MW with [MW] in the header, which sets the peak demand too.'
                    : '# Values: the share of its rating it can give that hour, from 0 to 1, or in % with [%] in the header. Its capacity factor follows from them.');
    var still = load ? 'the peak season’s highest day' : 'its clearest day at a ' + (o.kind === 'pv' ? 'quarter of the sun' : 'tenth of the wind');
    lines.push(o.year ? '# Peak day: the day whose Season says peak (as "Summer peak day") is the still, overcast peak day, and stays out of the typical weeks. ' +
                        (load ? 'With none marked, it is the day of the year’s highest hour.' : 'With none marked, it runs as ' + still + '.')
                      : '# Peak day: the still, overcast peak day (Assumptions), its 24 rows with Peak day in the Day column. ' + (load ? 'Its highest hour may be above the typical days’. ' : '') +
                        'Leave them out to run it as ' + still + '.');
    lines.push('# A blank cell keeps the profile as it is now. Lines that start with # are notes.');
    return lines;
  };
  function csvCell(x){ var s = String(x); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  // A value to the last digit it holds: the shortest text that reads back to it.
  function val(v){ return String(+v || 0); }
  /* opts: { kind, who, climate, grid: { r, s } (each season, or '*'),
             seasonal, peak: { s, h } (its season and 24 hours), year, hemi }.
     A whole year (year set) takes the grid's week for each season. */
  CX.templateCsv = function(opts){
    var g = opts.grid, C = CX.CLIMATES[opts.climate], names = C.seasons.map(function(s){ return s.name; });
    var head = opts.kind === 'load' ? 'Load [p.u.]' : 'Output [p.u.]', pk = opts.peak, out = [];
    if(opts.year){
      var hemi = opts.hemi === 'n' ? 'n' : 's', Y = CX.yearDays(opts.year), weeks = names.map(function(n){ return expand(g, 'week', n); });
      var pkSi = pk ? Math.max(0, names.indexOf(pk.s)) : -1, pkDay = pk ? peakDate(opts.year, opts.climate, hemi, pkSi) : null;
      CX.templateNotes({ kind: opts.kind, who: opts.who, climate: opts.climate, r: 'week', year: opts.year, hemi: hemi }).forEach(function(l){ out.push(csvCell(l)); });
      out.push(['Time', 'Season', head].join(','));
      for(var k = 0; k < Y.n; k++){
        var day = Y.d0 + k, dt = new Date(day * 86400000), si = CX.seasonOfMonth(opts.climate, hemi, dt.getUTCMonth()), wd = (dt.getUTCDay() + 6) % 7;
        var date = dt.getUTCFullYear() + '-' + two(dt.getUTCMonth() + 1) + '-' + two(dt.getUTCDate()), isPk = day === pkDay;
        for(var h = 0; h < 24; h++)
          out.push(date + ' ' + two(h) + ':00,' + (isPk ? names[pkSi] + ' peak day' : names[si]) + ',' + val(isPk ? pk.h[h] : weeks[si][wd * 24 + h]));
      }
      return out.join('\r\n') + '\r\n';
    }
    var r = g.r, seasonal = !!opts.seasonal, nd = CX.RES_DAYS[r];
    CX.templateNotes({ kind: opts.kind, who: opts.who, climate: opts.climate, r: r, seasonal: seasonal }).forEach(function(l){ out.push(csvCell(l)); });
    out.push((seasonal ? ['Season'] : []).concat(['Day', 'Hour', head]).join(','));
    var dayName = function(di){ return r === 'week' ? CX.DAYS[di] : r === 'day2' ? (di ? 'Weekend' : 'Weekday') : 'Every day'; };
    (seasonal ? names : ['*']).forEach(function(name){
      var ser = expand(g, r, name);
      for(var t = 0; t < 24 * nd; t++) out.push((seasonal ? [csvCell(name)] : []).concat([dayName(Math.floor(t / 24)), two(t % 24) + ':00', val(ser[t])]).join(','));
    });
    if(pk) for(var hp = 0; hp < 24; hp++) out.push((seasonal ? [csvCell(pk.s)] : []).concat(['Peak day', two(hp) + ':00', val(pk.h[hp])]).join(','));
    return out.join('\r\n') + '\r\n';
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
