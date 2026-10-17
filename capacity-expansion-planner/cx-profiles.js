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
   - Units: per unit (a load's highest hour is its peak; a farm's share of
     its rating), [%], or for a load [MW], which sets the peak demand too.
   - A blank cell, or a season left out, keeps what the profile gives now.

   What it gives back is the profile to use and what to tell the reader.
   Nothing is used when anything is wrong, so a file is applied whole or not
   at all. */
(function(root){
  'use strict';
  var CX = root.CX;
  var own = Object.prototype.hasOwnProperty;
  function two(n){ return (n < 10 ? '0' : '') + n; }
  function r4(x){ return Math.round(x * 1e4) / 1e4; }
  function r6(x){ return Math.round(x * 1e6) / 1e6; }
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
  // A day: Monday 0 to Sunday 6, 'wd' for a weekday, 'we' for the weekend. English or Indonesian.
  var DAY = { mon: 0, monday: 0, senin: 0, tue: 1, tues: 1, tuesday: 1, selasa: 1, wed: 2, weds: 2, wednesday: 2, rabu: 2,
              thu: 3, thur: 3, thurs: 3, thursday: 3, kamis: 3, fri: 4, friday: 4, jumat: 4, "jum'at": 4, sat: 5, saturday: 5, sabtu: 5,
              sun: 6, sunday: 6, minggu: 6, ahad: 6,
              weekday: 'wd', weekdays: 'wd', workday: 'wd', workdays: 'wd', 'working day': 'wd', 'business day': 'wd', 'mon-fri': 'wd', 'hari kerja': 'wd',
              weekend: 'we', weekends: 'we', 'weekend day': 'we', 'sat-sun': 'we', 'akhir pekan': 'we', 'hari libur': 'we' };
  function dayOf(x){
    if(typeof x !== 'string') return null;
    var s = x.trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ').replace(/\s*[-–]\s*/g, '-');
    return own.call(DAY, s) ? DAY[s] : null;
  }
  // A date and time: 2026-01-05 13:00, 2026/01/05T13:00:00, 5/1/2026 13:00 (day first, else month first).
  var RE_ISO = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T\s,]+(.+))?$/, RE_DMY = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})(?:[T\s,]+(.+))?$/;
  function whenOf(x){
    if(typeof x !== 'string') return null;
    var s = x.trim(), m, y, mo, d, rest;
    if((m = RE_ISO.exec(s))){ y = +m[1]; mo = +m[2]; d = +m[3]; rest = m[4]; }
    else if((m = RE_DMY.exec(s))){ y = +m[3]; d = +m[1]; mo = +m[2]; rest = m[4]; if(mo > 12 && d <= 12){ var t = d; d = mo; mo = t; } }
    else return null;
    var h = rest === undefined ? 0 : hourOf(rest.replace(/\.\d+$/, ''));
    if(!(h >= 0)) return null;
    var ms = Date.UTC(y, mo - 1, d), dt = new Date(ms);
    if(dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { day: Math.floor(ms / 86400000), wd: (dt.getUTCDay() + 6) % 7, h: h };
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
             current(climate): the profile now as the run takes it, a grid
             ({ r, s }: a load per unit of the year's peak, a farm's
             availability) for that climate's seasons }.
     Gives { errors, ts, notes, peak (MW, a load in MW), climate (when the
             file asks for another), used: { r, rows, seasons } }. */
  CX.readProfileFile = function(table, opts){
    var rows0 = table && table.rows ? table.rows : [], dc = !!(table && table.decimalComma), load = opts.kind === 'load';
    var out = { errors: [], ts: null, notes: [], peak: null, climate: null, used: null };
    var fail = function(msg){ out.errors.push(msg); out.ts = null; return out; };
    var seasonNames = function(k){ return CX.CLIMATES[k].seasons.map(function(s){ return s.name; }); };
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
    if(data.length > 168 * CX.MAX_SEASONS)
      return fail('The file has ' + data.length.toLocaleString('en-AU') + ' rows. A profile is one typical day (24 rows), a weekday and a weekend day (48) or a week (168), with a column a season: average a longer record into those first.');
    var width = head.length;
    data.forEach(function(r){ if(r.length > width) width = r.length; });
    var cell = function(i, j){ var r = data[i]; return j < r.length ? r[j] : ''; };
    var col = function(j){ var a = []; for(var i = 0; i < data.length; i++) a.push(cell(i, j)); return a; };
    var filled = function(a){ return a.filter(function(c){ return !blank(c); }); };
    var seasonCell = function(c){ var hd = headerOf(c); return hd.season || (hd.every ? '*' : null); };

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

    // Every row's season, day and hour.
    var rowSeason = [], rowDay = [], rowHour = [], dates = {};
    for(var i = 0; i < data.length; i++){
      var d = null, h = null, sn = null;
      if(useBoth && !blank(cell(i, bothCol))){ var b = dayHourOf(String(cell(i, bothCol))); d = b.d; h = b.h; if(b.date !== undefined) dates[b.date] = 1; }
      if(dayCol >= 0 && !blank(cell(i, dayCol))) d = numericDays ? cellNum(cell(i, dayCol), dc) - 1 : dayOf(String(cell(i, dayCol)));
      if(hourCol >= 0 && !blank(cell(i, hourCol))) h = hourOf(cell(i, hourCol));
      if(seasonCol >= 0 && !blank(cell(i, seasonCol))) sn = seasonCell(cell(i, seasonCol));
      rowSeason.push(sn); rowDay.push(d); rowHour.push(h);
    }
    // Dates of one day are a typical day; of a week, its seven weekdays.
    var nDates = Object.keys(dates).length;
    if(nDates === 1) rowDay = rowDay.map(function(){ return null; });
    else if(nDates > 7) return fail('The dates run over ' + nDates + ' days. Give one day, or one week of seven days.');
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
    var C0 = opts.climate, names = [];
    cols.forEach(function(c){ if(c.hd.season && names.indexOf(c.hd.season) < 0) names.push(c.hd.season); });
    rowSeason.forEach(function(x){ if(x && x !== '*' && names.indexOf(x) < 0) names.push(x); });
    var generic = cols.filter(function(c){ return !c.hd.season && !c.hd.every; }), genericKeys = {};
    generic.forEach(function(c){ var key = c.hd.day === null ? 'x' : String(c.hd.day); genericKeys[key] = (genericKeys[key] || 0) + 1; });
    if(Object.keys(genericKeys).some(function(k){ return genericKeys[k] > 1; }))
      return fail('The file has ' + generic.length + ' columns of values with no season in their header. Head each with its season (' + list(seasonNames(C0)) + '), or give one column for every season.');
    generic.forEach(function(c){ c.hd.every = true; });
    var climate = names.length ? climateFor(names, C0) : C0;
    if(!climate) return fail('The seasons are ' + list(names) + ', which no one climate has. Use ' + Object.keys(CX.CLIMATES).filter(function(k, i, all){ return all.indexOf(k) === i; }).map(function(k){ return list(seasonNames(k)); }).filter(function(x, i, all){ return all.indexOf(x) === i; }).join(', or ') + '.');
    if(climate !== C0 && !load)
      return fail('The seasons are ' + list(names) + ', but the climate (on the Demand tab) has ' + list(seasonNames(C0)) + '. Head the columns with those, or change the climate first.');
    var seasons = seasonNames(climate);

    // The values, slot by slot: a season's day and hour.
    var units = {};
    cols.forEach(function(c){ units[c.hd.unit] = 1; });
    if(Object.keys(units).length > 1) return fail('The columns are in different units (' + Object.keys(units).map(function(u){ return { pu: 'per unit', pct: '%', mw: 'MW' }[u]; }).join(' and ') + '). Give them all in one.');
    var unit = cols[0].hd.unit;
    if(unit === 'mw' && !load) return fail(opts.who + ' takes the share of its rating it can give each hour, from 0 to 1, or in % with [%] in the header, not MW.');
    var grid = {}, from = {}, neg = 0;
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
        if(blank(raw)){ grid[key2][at] = NaN; continue; }
        var x = cellNum(raw, dc);
        if(unit === 'pct' && !/%\s*$/.test(String(raw))) x = x / 100;
        if(x < 0){ neg++; x = 0; }
        grid[key2][at] = x;
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
    // A farm's shares: above 1 they are percentages, if they stay within 100.
    var top = 0;
    for(var key4 in grid) grid[key4].forEach(function(v){ if(v > top) top = v; });
    if(!(top > 0)) return fail('Every value in the file is 0 or blank.');
    if(!load && unit === 'pu' && top > 1){
      if(top > 100) return fail('Its values run up to ' + fmt(top) + '. Give the share of the rating, from 0 to 1, or in % with [%] in the header.');
      for(var key5 in grid) grid[key5] = grid[key5].map(function(v){ return v / 100; });
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
    if(kept.length && !cur) return fail('The file has no column for ' + list(kept) + '.');
    // A load: per unit of its highest hour, which in MW is the peak demand. A farm: as it is, at most its rating.
    var most = 0, over = 0, res = { r: r, s: {} };
    for(var key6 in series) series[key6].forEach(function(v){ if(v > most) most = v; if(v > 1 + 1e-9) over++; });
    if(!(most > 0)) return fail('Every value in the file is 0.');
    for(var key7 in series) res.s[key7] = series[key7].map(function(v){ return load ? r6(v / most) : r6(Math.min(1, v)); });
    if(load && unit === 'mw') out.peak = r4(most * peak0);

    // A temperate load that peaks in winter is winter-peaking, and in summer summer-peaking.
    if(load && (climate === 'sum' || climate === 'win') && res.s.Summer && res.s.Winter){
      var ms = Math.max.apply(null, res.s.Summer), mw = Math.max.apply(null, res.s.Winter);
      if(mw > ms && climate === 'sum') climate = 'win';
      else if(ms > mw && climate === 'win') climate = 'sum';
    }
    if(climate !== C0){ out.climate = climate; out.notes.push('The climate is now ' + CX.CLIMATES[climate].label.replace(/^./, function(z){ return z.toLowerCase(); }) + ', to match the file.'); }
    out.ts = res;
    out.used = { r: r, rows: data.length, seasons: everyOnly ? [] : seasons.filter(function(z){ return kept.indexOf(z) < 0; }), unit: unit };
    if(kept.length) out.notes.push(list(kept) + ' kept ' + (kept.length > 1 ? 'their' : 'its') + ' profile, as the file has no ' + (kept.length > 1 ? 'columns' : 'column') + ' for ' + (kept.length > 1 ? 'them' : 'it') + '.');
    if(gaps) out.notes.push(gaps + ' blank cell' + (gaps > 1 ? 's keep their hours' : ' keeps its hour') + ' as the profile gave ' + (gaps > 1 ? 'them' : 'it') + '.');
    if(neg) out.notes.push(neg + ' negative value' + (neg > 1 ? 's were' : ' was') + ' read as 0.');
    if(!load && over) out.notes.push(over + ' hour' + (over > 1 ? 's' : '') + ' above the rating ' + (over > 1 ? 'are' : 'is') + ' held at it.');
    if(out.peak !== null) out.notes.push('The peak demand is now the file’s highest hour, ' + fmt(out.peak) + ' MW.');
    return out;
  };

  /* ── The template: a profile as the run takes it, with notes on every way
     it can be filled in. ── */
  var SAMPLE_WORDS = { day: 'one typical day, the same every day', day2: 'a weekday and a weekend day', week: 'a typical week, Monday to Sunday' };
  CX.templateNotes = function(kind, who, climate, r){
    var C = CX.CLIMATES[climate], names = C.seasons.map(function(s){ return s.name; }), load = kind === 'load';
    var rows = { day: '24 rows, 00:00 to 23:00', day2: '48 rows, Weekday 00:00 to 23:00 then Weekend 00:00 to 23:00', week: '168 rows, Mon 00:00 to Sun 23:00' };
    return [
      '# Capacity Expansion Planner: ' + who + ', ' + C.label + '. This file holds ' + SAMPLE_WORDS[r] + ' (' + rows[r] + ').',
      '# Rows: for one typical day give 24 rows with no Day column. For a weekday and a weekend day write Weekday or Weekend in the Day column (48 rows). For a ' +
        (load ? 'full week' : 'week of weather') + ' write Mon to Sun (168 rows).',
      '# Columns: one a season (' + list(names) + ') ' + (load ? 'per unit of the peak demand: the highest hour of the year is 1. Or in MW with [MW] in the header, which sets the peak demand too.'
           : 'as the share of its rating it can give that hour, from 0 to 1, or in % with [%] in the header. Its capacity factor follows from them.'),
      '# One column alone serves every season. A blank cell, or a season left out, keeps the profile as it is now. Lines that start with # are notes.'
    ];
  };
  function csvCell(x){ var s = String(x); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  // opts: { kind, who, climate, grid: { r, s } with a series for each season }.
  CX.templateCsv = function(opts){
    var g = opts.grid, r = g.r, C = CX.CLIMATES[opts.climate], names = C.seasons.map(function(s){ return s.name; });
    var lines = CX.templateNotes(opts.kind, opts.who, opts.climate, r).map(csvCell);
    var head = (r === 'day' ? [] : ['Day']).concat(['Hour'], names.map(function(n){ return n + ' [p.u.]'; }));
    lines.push(head.map(csvCell).join(','));
    var series = names.map(function(n){ return expand(g, r, n); });
    for(var t = 0; t < 24 * CX.RES_DAYS[r]; t++){
      var di = Math.floor(t / 24), row = [];
      if(r === 'week') row.push(CX.DAYS[di]);
      else if(r === 'day2') row.push(di ? 'Weekend' : 'Weekday');
      row.push(two(t % 24) + ':00');
      series.forEach(function(s){ row.push(r4(s[t]).toFixed(4)); });
      lines.push(row.join(','));
    }
    return lines.join('\r\n') + '\r\n';
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
