#!/usr/bin/env python3
"""Build and check a tool.adjiebrotots.com #load link from references/params.json.

The link opens the tool on the user's scenario; the tool, not the assistant, works out the
result. This script makes the link exact: it knows every key each page takes, its range and
its choices, and refuses anything the tool would not read as written.

Usage (run from the skill folder, or give the path to this file):

  python3 scripts/build_link.py --pages
      every page this skill covers, with its Quick Starts count

  python3 scripts/build_link.py --fields PAGE [--find WORDS]
      the keys PAGE takes (range, default, choices); --find narrows by key or label

  python3 scripts/build_link.py --quickstarts PAGE [--find WORDS]
      the Quick Starts (qs values) of PAGE

  python3 scripts/build_link.py SPEC.json        (or "-" to read the spec from stdin)
      build the link. SPEC is:
      {
        "page": "rentvsownhouse",                 # a page id from --pages
        "qs": "perth/house-2br",                  # optional Quick Start to start from
        "set": {"propertyPrice": 800000, "rentAmount": 700},   # keys in the order to send
        "why": {"rentAmount": "The rent you pay now"},          # optional, per key, <= 200 chars
        "note": "Perth, November 2026",           # optional one line, <= 200 chars
        "json": {...},                            # optional, only for pages whose reference defines it
        "run": 0                                  # optional, 0 opens a heavy optimiser without solving
      }

  python3 scripts/build_link.py --page PAGE [--qs QS] [--note TEXT] key=value ... [--why key=TEXT ...]
      the same, from the command line.

On success it prints the link on the first line, then one line per key it checked.
On a problem it prints every problem (with the nearest valid keys or choices) and exits 1:
fix the spec and run it again. It never guesses a value for you.
"""
import json
import os
import re
import sys
import difflib
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
PARAMS = os.path.join(HERE, '..', 'references', 'params.json')
WHY_MAX = 200
RESERVED = {'v', 'qs', 'note', 'json', 'run'}
FORBIDDEN = {'s', 'open', 'embed'}
TRUE = {'true', '1', 'on', 'yes'}
FALSE = {'false', '0', 'off', 'no'}


def load_params():
    with open(PARAMS, encoding='utf-8') as fh:
        return json.load(fh)


def encode_value(s):
    """Percent-encode a value exactly as the site's own generator does (encodeValue in
    _ref/agent-lib.mjs): / : , $ @ = stay as they are; ( ) ' are encoded."""
    return quote(str(s), safe="-_.!~*/:,$@=")


def build(base, pairs):
    link = base + '#load' + ''.join('&' + k + '=' + encode_value(v) for k, v in pairs)
    if link and link[-1] in '.,:':
        link = link[:-1] + '%%%02X' % ord(link[-1])
    return link


def as_text(v):
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    if isinstance(v, (dict, list)):
        return json.dumps(v, separators=(',', ':'), ensure_ascii=False)
    return str(v)


def to_number(s):
    t = re.sub(r'[$,_\s]', '', str(s))
    t = re.sub(r'%$', '', t)
    if not re.match(r'^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$', t, re.I):
        return None
    return float(t)


def fmt_num(n):
    return str(int(n)) if float(n).is_integer() else repr(float(n))


def nearest(word, choices, n=4):
    return difflib.get_close_matches(word, list(choices), n=n, cutoff=0.5)


def find_page(params, name):
    name = (name or '').strip()
    for p in params['pages']:
        if name in (p['page'], p['url'], p['url'].strip('/'), p['base']):
            return p
    return None


def check_field(f, raw):
    """Return (value as the link carries it, problem or '')."""
    v = as_text(raw).strip()
    kind = f['kind']
    if kind == 'checkbox':
        lo = v.lower()
        if lo in TRUE:
            return 'true', ''
        if lo in FALSE:
            return 'false', ''
        return v, 'is a checkbox: give true or false'
    if kind == 'choice':
        for o in f['options']:
            if v == o['value']:
                return o['value'], ''
        for o in f['options']:
            if o.get('label') and v.lower() == o['label'].lower():
                return o['value'], ''
        for o in f['options']:
            if v.lower() == o['value'].lower():
                return o['value'], ''
        opts = ', '.join(o['value'] + (' (' + o['label'] + ')' if o.get('label') and o['label'] != o['value'] else '') for o in f['options'])
        return v, 'takes one of: ' + opts
    if kind in ('number', 'amount', 'slider'):
        n = to_number(v)
        if n is None:
            return v, 'is not a number (write it as on screen, e.g. 6.1 for 6.1 %, 800000 for 800,000)'
        lo, hi = f.get('min'), f.get('max')
        if lo is not None and n < lo:
            return fmt_num(n), 'is below the minimum %s (range %s to %s)' % (fmt_num(lo), fmt_num(lo), fmt_num(hi) if hi is not None else 'no limit')
        if hi is not None and n > hi:
            return fmt_num(n), 'is above the maximum %s (range %s to %s)' % (fmt_num(hi), fmt_num(lo) if lo is not None else 'no limit', fmt_num(hi))
        return fmt_num(n), ''
    if kind == 'date':
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', v):
            return v, 'is a date: write it as YYYY-MM-DD'
        return v, ''
    if len(v) > 2048:
        return v, 'is longer than 2048 characters'
    return v, ''


def make(params, spec):
    problems, notes, pairs = [], [], [('v', '1')]
    page = find_page(params, spec.get('page'))
    if not page:
        names = [p['page'] for p in params['pages']]
        return None, ['page "%s" is not one of: %s' % (spec.get('page'), ', '.join(names))], []
    fields = {f['key']: f for f in page['fields']}
    qs_keys = {q['key'] for q in page.get('quickStarts', [])}
    qs = spec.get('qs')
    if qs not in (None, ''):
        qs = str(qs)
        if qs not in qs_keys:
            hint = nearest(qs, qs_keys)
            problems.append('qs "%s" is not a Quick Start of %s%s' % (qs, page['page'], (': did you mean ' + ', '.join(hint) + '?') if hint else ' (run --quickstarts %s)' % page['page']))
        else:
            pairs.append(('qs', qs))
            notes.append('qs=%s  (%s)' % (qs, next((q['title'] for q in page['quickStarts'] if q['key'] == qs), '')))
    why = dict(spec.get('why') or {})
    sets = spec.get('set') or {}
    if not isinstance(sets, dict):
        return None, ['"set" must be an object of key: value'], []
    for key, raw in sets.items():
        key = str(key)
        if key in FORBIDDEN:
            problems.append('%s: never use the keys s, open or embed (they belong to Share links)' % key)
            continue
        if key in RESERVED or key.startswith('why.'):
            problems.append('%s: put this in the spec\'s own "%s" entry, not in "set"' % (key, key.split('.')[0]))
            continue
        if key in fields:
            val, bad = check_field(fields[key], raw)
            if bad:
                problems.append('%s=%s %s' % (key, val, bad))
                continue
            f = fields[key]
            unit = ('unit set by ' + ' and '.join(f['unitSetBy'])) if f.get('unitSetBy') else f.get('unit')
            notes.append('%s=%s  (%s%s)' % (key, val, f['label'], (', ' + unit) if unit else ''))
        elif key in page.get('lists', []):
            val = as_text(raw)
            notes.append('%s=%s  (list, read by the tool as its reference describes)' % (key, val))
        elif any(key.startswith(pre) and len(key) > len(pre) for pre in page.get('families', [])):
            val = as_text(raw)
            notes.append('%s=%s  (part setting; the tool reports a part name it cannot find)' % (key, val))
        else:
            hint = nearest(key, list(fields) + page.get('lists', []))
            problems.append('%s is not a key of %s%s' % (key, page['page'], (': did you mean ' + ', '.join(hint) + '?') if hint else ' (run --fields %s)' % page['page']))
            continue
        pairs.append((key, val))
        if key in why:
            w = str(why.pop(key)).strip()
            if len(w) > WHY_MAX:
                problems.append('why.%s is %d characters; keep it to %d' % (key, len(w), WHY_MAX))
            elif w:
                pairs.append(('why.' + key, w))
    for key in why:
        problems.append('why.%s explains a key the spec does not set' % key)
    if spec.get('json') not in (None, ''):
        if not page.get('json'):
            problems.append('json: %s takes no json; use its keys' % page['page'])
        else:
            j = spec['json']
            if isinstance(j, str):
                try:
                    j = json.loads(j)
                except ValueError as e:
                    problems.append('json is not valid JSON: %s' % e)
                    j = None
            if j is not None:
                pairs.append(('json', json.dumps(j, separators=(',', ':'), ensure_ascii=False)))
                notes.append('json=(%d characters, compact)' % len(pairs[-1][1]))
    if spec.get('run') not in (None, ''):
        if str(spec['run']) != '0':
            problems.append('run takes only 0 (leave it out to solve as usual)')
        else:
            pairs.append(('run', '0'))
    note = str(spec.get('note') or '').strip()
    if note:
        if len(note) > WHY_MAX:
            problems.append('note is %d characters; keep it to %d' % (len(note), WHY_MAX))
        else:
            pairs.append(('note', note))
    if problems:
        return None, problems, notes
    return build(page['base'], pairs), [], notes


def show_fields(page, find):
    words = (find or '').lower().split()
    for f in page['fields']:
        hay = (f['key'] + ' ' + f['label'] + ' ' + f.get('group', '')).lower()
        if words and not all(w in hay for w in words):
            continue
        rng = ''
        if f['kind'] == 'choice':
            rng = 'one of ' + ', '.join(o['value'] for o in f['options'])
        elif f['kind'] == 'checkbox':
            rng = 'true or false'
        elif f.get('min') is not None or f.get('max') is not None:
            rng = '%s to %s' % (fmt_num(f['min']) if f.get('min') is not None else '-inf', fmt_num(f['max']) if f.get('max') is not None else 'inf')
        star = ' *' if f.get('important') else ''
        print('%s%s  [%s] %s%s; %s; default %s' % (f['key'], star, f['kind'], f['label'], (' (' + f['unit'] + ')') if f.get('unit') else '', rng or f['kind'], f.get('default')))
    for k in page.get('lists', []):
        if not words or any(w in k.lower() for w in words):
            print('%s  [list] see the page reference, COMPACT LISTS' % k)
    for pre in page.get('families', []):
        print('%s<name>.<param>  [part setting] see the page reference' % pre)


def main(argv):
    params = load_params()
    if not argv or argv[0] in ('-h', '--help'):
        print(__doc__)
        return 0
    if argv[0] == '--pages':
        for p in params['pages']:
            print('%s  %s  (%s, %d Quick Starts)  %s' % (p['page'], p['title'], p['lang'], len(p.get('quickStarts', [])), p['base']))
        return 0
    find = None
    if '--find' in argv:
        i = argv.index('--find')
        find = ' '.join(argv[i + 1:])
        argv = argv[:i]
    if argv[0] in ('--fields', '--quickstarts'):
        page = find_page(params, argv[1] if len(argv) > 1 else '')
        if not page:
            print('unknown page; run --pages', file=sys.stderr)
            return 1
        if argv[0] == '--fields':
            show_fields(page, find)
        else:
            words = (find or '').lower().split()
            for q in page.get('quickStarts', []):
                if not words or all(w in (q['key'] + ' ' + q['title']).lower() for w in words):
                    print('%s  %s' % (q['key'], q['title']))
        return 0
    if argv[0] == '-' or argv[0].endswith('.json'):
        text = sys.stdin.read() if argv[0] == '-' else open(argv[0], encoding='utf-8').read()
        try:
            spec = json.loads(text)
        except ValueError as e:
            print('the spec is not valid JSON: %s' % e, file=sys.stderr)
            return 1
    else:
        spec = {'set': {}, 'why': {}}
        i = 0
        while i < len(argv):
            a = argv[i]
            if a in ('--page', '--qs', '--note', '--run', '--json'):
                spec[a[2:]] = argv[i + 1] if i + 1 < len(argv) else ''
                i += 2
                continue
            if a == '--why':
                k, _, t = (argv[i + 1] if i + 1 < len(argv) else '').partition('=')
                spec['why'][k] = t
                i += 2
                continue
            k, eq, v = a.partition('=')
            if not eq:
                print('"%s" is not key=value' % a, file=sys.stderr)
                return 1
            spec['set'][k] = v
            i += 1
    link, problems, notes = make(params, spec)
    if problems:
        print('NOT BUILT. Fix these and run again:', file=sys.stderr)
        for p in problems:
            print('  - ' + p, file=sys.stderr)
        return 1
    print(link)
    for n in notes:
        print('  ok ' + n)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
