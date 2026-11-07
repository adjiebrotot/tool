# Workflow Builder runtime: the PSCAD model (components, layers, scenarios, global
# substitutions, input controls, and building a page from script).
#
# Same section format as base.py. Checked on a live PSCAD 5.0.0 engine with Automation
# Library 2.9.7. Where PSCAD 5.0.0's automation server refuses a call the newer library
# declares, the note says so and the helper takes the route that works.

# @helper px_names
# @needs px_state
# @imports import re
_PX_NAME_BAD = re.compile(r"[^A-Za-z0-9_]")


def px_clean_name(text, maxlen=30):
    """A name PSCAD accepts: letters, digits and underscores, starting with a letter.

    PSCAD refuses a name with a space, a dot or a dash in it, and one that starts with a
    digit, so "Case 1.2" becomes "Case_1_2" and "3ph" becomes "n3ph"."""
    out = _PX_NAME_BAD.sub("_", str(text or "").strip())
    out = re.sub(r"_+", "_", out).strip("_")
    if not out:
        out = "item"
    if not out[0].isalpha():
        out = "n" + out
    return out[:max(1, int(maxlen))]


class _Bag(object):
    """A small record with named fields, readable as attributes or as keys."""

    def __init__(self, **fields):
        self.__dict__.update(fields)

    def __getitem__(self, key):
        return self.__dict__[key]

    def get(self, key, default=None):
        return self.__dict__.get(key, default)

    def keys(self):
        return self.__dict__.keys()

    def __repr__(self):
        inside = ", ".join("%s=%r" % kv for kv in sorted(self.__dict__.items()))
        return "(%s)" % inside
# @end

# @helper find_components
# @needs log, px_state, px_find, px_value
def find_components(app, defn="", name="", param=None, op="=", value=None,
                    enabled=False, page=""):
    """Every component matching the definition and name, narrowed by one parameter.

    `op` is one of = != > >= < <=. A text value compares as a pattern, so
    param="Name", op="=", value="Bus*" keeps the components whose Name starts with Bus.
    Always a list, possibly empty."""
    found = px_find(app, defn, name, "all", enabled=enabled, empty_ok=True, page=page) or []
    if not param:
        return found
    kept = []
    for c in found:
        try:
            raw = (c.parameters() or {}).get(param)
        except Exception:
            continue
        if raw is None:
            continue
        if _param_matches(raw, op, value):
            kept.append(c)
    log("%d of %d components match %s %s %s." % (len(kept), len(found), param, op, value),
        "info")
    return kept


def _param_matches(raw, op, value):
    num, _ = px_split_value(raw)
    want, _ = px_split_value(value)
    if num is not None and want is not None:
        if op == "=":
            return abs(num - want) <= 1e-12 * max(1.0, abs(want))
        if op == "!=":
            return abs(num - want) > 1e-12 * max(1.0, abs(want))
        if op == ">":
            return num > want
        if op == ">=":
            return num >= want
        if op == "<":
            return num < want
        if op == "<=":
            return num <= want
        return False
    import fnmatch
    text, pattern = px_text(raw).lower(), px_text(value).lower()
    hit = fnmatch.fnmatch(text, pattern)
    if op == "!=":
        return not hit
    return hit
# @end

# @helper set_enabled
# @needs log, px_state
def set_enabled(objs, enabled=True):
    """Enable or disable components, and say how many changed.

    A disabled component is left out of the build, which is how PSCAD takes a branch, a
    machine or a whole control block out of service. The original state is recorded, so
    the put-back at the end of a pass switches it back.

    PSCAD only reports a component's enabled state from 5.0.2 on. On 5.0.0 the state
    cannot be read, so the put-back assumes the component was the other way round, which
    is right whenever the step changed anything; the one line of warning says so."""
    targets = objs if isinstance(objs, (list, tuple)) else [objs]
    targets = [t for t in targets if t is not None]
    want = bool(enabled)
    changed = 0
    for t in targets:
        was = _read_enabled(t)
        if was is not None and was == want:
            continue
        key = (_cid(t), "#enabled")
        floor = _PX["marks"][-1][1] if _PX["marks"] else 0
        seen = _PX["keys"].get(key)
        fresh = seen is None or seen < floor
        if fresh:
            _PX["keys"][key] = len(_PX["records"])
            _PX["records"].append({"obj": t, "param": "#enabled",
                                   "old": (not want) if was is None else was, "key": key})
        try:
            t.enable(want)
            changed += 1
        except Exception as err:
            if fresh:
                _PX["records"].pop()
                _PX["keys"].pop(key, None)
            log("Could not %s %s: %s"
                % ("enable" if want else "disable", _label(t), err), "warn")
    log("%s %d component%s." % ("Enabled" if want else "Disabled", changed,
                                "" if changed == 1 else "s"), "info")
    return changed


def _read_enabled(obj):
    """True, False, or None when this PSCAD cannot say."""
    try:
        return bool(obj.enabled)
    except Exception:
        _say_once("This PSCAD does not report whether a component is enabled (it needs "
                  "5.0.2 or newer), so putting a change back assumes the component was "
                  "the other way round.", "info")
        return None
# @end

# @helper scenarios
# @needs log, px_state, track_created, px_names
def scenario_list(app, pattern="*"):
    """The scenarios in the project, sorted, matching the pattern.

    A PSCAD scenario stores a set of component parameter values, the way an operation
    scenario does in other tools: switching to one brings its values back."""
    import fnmatch
    prj = _PX["project"]
    try:
        names = list(prj.scenarios() or [])
    except Exception as err:
        log("Could not list the project's scenarios: %s" % err, "warn")
        return []
    low = str(pattern or "*").lower()
    return sorted(n for n in names if fnmatch.fnmatch(str(n).lower(), low))


def scenario_activate(app, scen):
    """Switch to a scenario by name and give its name back."""
    prj = _PX["project"]
    name = str(getattr(scen, "name", scen) or "").strip()
    if not name:
        raise PXError("[CODE] scenario_activate was given no scenario name.")
    try:
        prj.scenario(name)
    except Exception as err:
        have = scenario_list(app)
        raise PXError('[MODEL] Could not switch to scenario "%s": %s%s'
                      % (name, err, ("\n  The project has: " + ", ".join(have))
                         if have else "\n  The project has no scenarios."))
    log("Scenario %s is active." % name, "info")
    return name


def scenario_save(app, name=""):
    """Save the values in use now into a scenario, and say whether PSCAD took it.

    With no name the current scenario is saved. PSCAD 5.0.0's automation server refuses
    save_as_scenario(), so a new name needs PSCAD 5.1 or newer, or a scenario the reader
    made in PSCAD first; the helper says which it was rather than failing the run."""
    prj = _PX["project"]
    try:
        if name:
            prj.save_as_scenario(px_clean_name(name))
            track_created(name, kind="scenario", keep=True, name=px_clean_name(name),
                          parent=prj)
            log("Saved the values in use now as scenario %s." % px_clean_name(name), "info")
        else:
            prj.save_scenario()
            log("Saved the current scenario.", "info")
        return True
    except Exception as err:
        log('Could not save scenario "%s": %s\n  PSCAD 5.0 cannot create a scenario from a '
            "script. Make the scenario once in PSCAD, then this step saves into it."
            % (name or (prj.scenario() or "current"), err), "warn")
        return False


def each_scenario(app, scenarios):
    """Yield each scenario with it active in turn, and put back the one that was active."""
    prj = _PX["project"]
    names = [str(getattr(s, "name", s)) for s in (scenarios or [])]
    try:
        was = prj.scenario() or ""
    except Exception:
        was = ""
    try:
        for name in names:
            scenario_activate(app, name)
            yield name
    finally:
        if was:
            try:
                prj.scenario(was)
            except Exception as err:
                log("Could not go back to scenario %s: %s" % (was, err), "warn")
# @end

# @helper layers
# @needs log, px_state, px_names, track_created
def layer_list(app, pattern="*"):
    """The project's layers as {name: state}, matching the pattern.

    A PSCAD layer groups components and switches them together between Enabled,
    Disabled and Invisible, which is how a study holds alternative network
    arrangements in one case."""
    import fnmatch
    prj = _PX["project"]
    try:
        got = dict(prj.layers() or {})
    except Exception as err:
        log("Could not list the project's layers: %s" % err, "warn")
        return {}
    low = str(pattern or "*").lower()
    return {k: v for k, v in sorted(got.items()) if fnmatch.fnmatch(str(k).lower(), low)}


def layer_states(app, name):
    """Every state the named layer can take, as PSCAD lists them."""
    try:
        return list(_PX["project"].layer_states(str(name)) or [])
    except Exception as err:
        log("Could not read the states of layer %s: %s" % (name, err), "warn")
        return ["Enabled", "Disabled", "Invisible"]


def layer_set(app, name, state="Enabled"):
    """Put one layer into a state and give the state back. The old state is put back later."""
    prj = _PX["project"]
    name = str(name)
    have = layer_list(app)
    if name not in have:
        raise PXError('[MODEL] The project has no layer called "%s".%s'
                      % (name, ("\n  It has: " + ", ".join(sorted(have)))
                         if have else "\n  It has no layers."))
    want = _layer_state_name(app, name, state)
    if have[name] != want:
        _PX["records"].append({"obj": ("#layer", name), "param": "#layer",
                               "old": have[name], "key": ("#layer:" + name, "#layer")})
        _PX["keys"][("#layer:" + name, "#layer")] = len(_PX["records"]) - 1
        try:
            prj.set_layer_state(name, want)
        except Exception as err:
            _PX["records"].pop()
            raise PXError('[MODEL] Could not put layer "%s" into "%s": %s' % (name, want, err))
    log("Layer %s is %s." % (name, want), "info")
    return want


def _layer_state_name(app, name, state):
    """The state as PSCAD spells it; the nearest one when the spelling is off."""
    want = str(state or "Enabled").strip()
    options = layer_states(app, name)
    for o in options:
        if str(o).lower() == want.lower():
            return str(o)
    near = _closest(want, options)
    if near:
        log('Layer "%s" has no state "%s"; using "%s".' % (name, want, near[0]), "warn")
        return str(near[0])
    return want


def layer_create(app, name, state="Enabled", keep=False, if_exists="reuse"):
    """Make a layer (or take the one that is there) and give it back.

    `if_exists` "reuse" takes an existing layer of that name, "new" numbers a fresh one.
    `keep` False has finish() delete it again."""
    prj = _PX["project"]
    name = px_clean_name(name)
    have = layer_list(app)
    if name in have:
        if if_exists == "reuse":
            log("Layer %s is already there; using it." % name, "info")
            return prj.layer(name)
        n = 2
        while "%s_%d" % (name, n) in have:
            n += 1
        name = "%s_%d" % (name, n)
    try:
        layer = prj.create_layer(name, state)
    except Exception as err:
        raise PXError('[MODEL] Could not create layer "%s": %s' % (name, err))
    track_created(layer, kind="layer", keep=keep, name=name, parent=prj)
    log("Created layer %s (%s)." % (name, state), "info")
    return layer


def layer_add(app, objs, name):
    """Put components on a layer and say how many went on."""
    targets = objs if isinstance(objs, (list, tuple)) else [objs]
    n = 0
    for t in [x for x in targets if x is not None]:
        try:
            t.add_to_layer(str(name))
            n += 1
        except Exception as err:
            log("Could not put %s on layer %s: %s" % (_label(t), name, err), "warn")
    log("Put %d component%s on layer %s." % (n, "" if n == 1 else "s", name), "info")
    return n


def each_layer(app, names, state="Enabled", others="Disabled"):
    """Yield each layer with only it in `state` and the others in `others`.

    The layer states found before the loop are put back however the loop ends."""
    prj = _PX["project"]
    names = [str(getattr(n, "name", n)) for n in (names or [])]
    was = layer_list(app)
    try:
        for name in names:
            for other in names:
                if other != name and others:
                    try:
                        layer_set(app, other, others)
                    except PXError as err:
                        log(str(err), "warn")
            layer_set(app, name, state)
            yield name
    finally:
        now = layer_list(app)
        for key, old in was.items():
            if key in now and now[key] != old:
                try:
                    prj.set_layer_state(key, old)
                except Exception as err:
                    log("Could not put layer %s back to %s: %s" % (key, old, err), "warn")
# @end

# @helper globalsub
# @needs log, px_state, px_names, px_value, track_created, finish
def _gs_set_name(app, set_name=None):
    """Which set of global substitutions to work on.

    A project's substitutions live in sets. One that has never been given named sets has a
    single set whose name is the empty string, and its active_set reads as None, so the
    empty name is the right default rather than a sign of something missing."""
    gs = _PX["project"].global_substitution
    if set_name is not None:
        return str(set_name)
    try:
        active = gs.active_set
    except Exception:
        active = None
    if active:
        return str(active)
    try:
        names = list(gs)
    except Exception:
        names = []
    return str(names[0]) if names else ""


def gs_sets(app):
    """The names of the project's global substitution sets.

    A project with no named sets gives [""], its one unnamed set."""
    try:
        return [str(n) for n in _PX["project"].global_substitution]
    except Exception as err:
        log("Could not list the project's global substitution sets: %s" % err, "warn")
        return []


def gs_all(app, set_name=None):
    """The project's global substitutions as {name: value}, for one set.

    A global substitution is one named value every component that writes $(name) reads,
    which is how a PSCAD model is parameterised: set it once and the whole case follows."""
    gs = _PX["project"].global_substitution
    try:
        return dict(gs[_gs_set_name(app, set_name)])
    except Exception as err:
        log("Could not read the project's global substitutions: %s" % err, "warn")
        return {}


def gs_get(app, name, default=None, set_name=None):
    """One global substitution: a number where it is one, else its text."""
    got = gs_all(app, set_name)
    if name not in got:
        near = _closest(name, list(got))
        log('The project has no global substitution "%s".%s'
            % (name, ("\n  It has: " + ", ".join(near)) if near else ""), "warn")
        return default
    num, _ = px_split_value(got[name])
    return num if num is not None else px_text(got[name])


def gs_set(app, name, value, create=True, set_name=None):
    """Set one global substitution and give the value back.

    The value reaches every component whose parameter writes $(name), so the next build
    uses it. The original is recorded, so the put-back at the end of a pass restores it."""
    prj = _PX["project"]
    gs = prj.global_substitution
    name = px_clean_name(name)
    which = _gs_set_name(app, set_name)
    have = gs_all(app, which)
    if name not in have:
        if not create:
            raise PXError('[MODEL] The project has no global substitution "%s".%s'
                          % (name, ("\n  It has: " + ", ".join(sorted(have)))
                             if have else ""))
        try:
            gs.create(name)
        except Exception as err:
            raise PXError('[MODEL] Could not create global substitution "%s": %s'
                          % (name, err))
        track_created(name, kind="globalsub", keep=False, name=name, parent=prj)
        log("Created global substitution %s." % name, "info")
    else:
        key = ("#gs:" + name, "#gs")
        floor = _PX["marks"][-1][1] if _PX["marks"] else 0
        seen = _PX["keys"].get(key)
        if seen is None or seen < floor:
            _PX["keys"][key] = len(_PX["records"])
            _PX["records"].append({"obj": ("#gs", name), "param": "#gs",
                                   "old": have[name], "key": key})
    text = px_text(value)
    try:
        gs[which][name] = text
    except Exception as err:
        raise PXError('[MODEL] PSCAD refused global substitution %s = %s: %s'
                      % (name, text, err))
    log("Global substitution %s = %s." % (name, text), "info")
    return value


def gs_set_active(app, set_name):
    """Switch to a named set of global substitutions and give its name back.

    The set has to exist already: making one from a script closes PSCAD 5.0.0's
    automation connection, so this never creates one. Make the sets once in PSCAD, or
    load them from a CSV file with gs_load."""
    prj = _PX["project"]
    gs = prj.global_substitution
    have = gs_sets(app)
    if str(set_name) not in have:
        raise PXError('[MODEL] The project has no global substitution set "%s".%s\n'
                      "  Add the set in PSCAD (Project Settings, Substitutions), or load "
                      "the sets from a CSV file." % (set_name,
                                                     ("\n  It has: " + ", ".join(
                                                         n or "(the unnamed set)"
                                                         for n in have)) if have else ""))
    try:
        was = gs.active_set
    except Exception:
        was = None
    try:
        gs.active_set = str(set_name)
    except Exception as err:
        raise PXError('[MODEL] Could not switch to global substitution set "%s": %s'
                      % (set_name, err))
    if was is not None and str(was) != str(set_name):
        add_finish_hook("put the global substitution set back",
                        lambda: setattr(prj.global_substitution, "active_set", was))
    log("Global substitution set %s is active." % set_name, "info")
    return str(set_name)


def each_gs_set(app, set_names=None):
    """Yield each global substitution set with it active in turn, then put back the first.

    This is the PSCAD way to run one case over several parameter sets: each set holds its
    own value for every $(name) the model reads."""
    names = [str(n) for n in (set_names if set_names is not None else gs_sets(app))]
    names = [n for n in names if n]
    gs = _PX["project"].global_substitution
    try:
        was = gs.active_set
    except Exception:
        was = None
    try:
        for name in names:
            gs_set_active(app, name)
            yield name
    finally:
        if was:
            try:
                gs.active_set = was
            except Exception as err:
                log("Could not go back to global substitution set %s: %s" % (was, err),
                    "warn")


def gs_load(app, path, set_name=""):
    """Load global substitutions from a CSV file PSCAD wrote, and say how many there are."""
    prj = _PX["project"]
    try:
        if set_name:
            prj.global_substitution.load_set(str(path), str(set_name))
        else:
            prj.global_substitution.load_all_sets(str(path))
    except Exception as err:
        raise PXError("[MODEL] Could not load global substitutions from %s: %s" % (path, err))
    got = gs_all(app)
    log("Loaded %d global substitution%s from %s."
        % (len(got), "" if len(got) == 1 else "s", path), "info")
    return got


def gs_save(app, path, set_name=""):
    """Write the global substitutions to a CSV file, and give the path back."""
    prj = _PX["project"]
    try:
        if set_name:
            prj.global_substitution.save_set(str(path), str(set_name))
        else:
            prj.global_substitution.save_all_sets(str(path))
    except Exception as err:
        raise PXError("[MODEL] Could not save global substitutions to %s: %s" % (path, err))
    log("Saved the global substitutions to %s." % path, "info")
    return str(path)
# @end

# @helper controls
# @needs log, px_state, px_find, px_value
def control_set(app, defn="", name="", value=None, kind="auto", match="one"):
    """Set an input control of the model: a slider, a switch, a dial or a button.

    PSCAD drives a running case through controls on a control panel rather than through an
    event list, so this is how a script changes a set point, closes a breaker logic switch
    or presses a fault button. `kind` "auto" reads what the control is; "slider" takes a
    number, "switch" a yes / no, "dial" a position (1 upwards), "button" clicks it.
    Works before a run and while one is running."""
    ctrl = px_find(app, defn, name, match)
    if isinstance(ctrl, list):
        return [control_set(app, "", "", value, kind, "one") if False else
                _control_one(c, value, kind) for c in ctrl]
    return _control_one(ctrl, value, kind)


def _control_one(ctrl, value, kind):
    what = str(kind or "auto").lower()
    if what == "auto":
        what = _control_kind(ctrl)
    num, _ = px_split_value(value)
    try:
        if what == "slider":
            if num is None:
                raise PXError("[CODE] A slider needs a number; %r was given." % (value,))
            ctrl.value(num)
            log("Slider %s = %g." % (_label(ctrl), num), "info")
            return num
        if what == "switch":
            on = _truthy(value)
            ctrl.set_state(bool(on))
            log("Switch %s is %s." % (_label(ctrl), "on" if on else "off"), "info")
            return bool(on)
        if what == "dial":
            if num is None:
                raise PXError("[CODE] A dial needs a position number; %r was given." % (value,))
            ctrl.position(int(num))
            log("Dial %s is at position %d." % (_label(ctrl), int(num)), "info")
            return int(num)
        if what == "button":
            ctrl.click()
            log("Clicked button %s." % _label(ctrl), "info")
            return True
    except PXError:
        raise
    except Exception as err:
        raise PXError("[MODEL] Could not set %s %s: %s" % (what, _label(ctrl), err))
    raise PXError('[CODE] "%s" is not a control kind this step knows (slider, switch, dial, '
                  "button)." % kind)


def _control_kind(ctrl):
    """What sort of control this is, from the object PSCAD gave back."""
    cls = type(ctrl).__name__.lower()
    for name in ("slider", "switch", "button"):
        if name in cls:
            return name
    if "selector" in cls or "dial" in cls:
        return "dial"
    defn = _defn_of(ctrl).lower()
    if "var_pot" in defn:
        return "slider"
    if "var_switch" in defn:
        return "switch"
    if "var_button" in defn:
        return "button"
    if "var_dial" in defn or "var_select" in defn:
        return "dial"
    return "slider"


def _truthy(value):
    if isinstance(value, str):
        return value.strip().lower() in ("1", "on", "yes", "true", "y", "closed")
    return bool(value)


def control_limits(app, defn="", name="", lower=None, upper=None, match="one"):
    """Widen or narrow a slider's range so a sweep can reach the value it needs."""
    ctrl = px_find(app, defn, name, match)
    lo = px_number(lower)
    hi = px_number(upper)
    if lo is None or hi is None:
        raise PXError("[CODE] A slider's limits need two numbers.")
    try:
        ctrl.limits(lo, hi)
    except Exception as err:
        raise PXError("[MODEL] Could not set the limits of %s: %s" % (_label(ctrl), err))
    log("Slider %s now runs %g to %g." % (_label(ctrl), lo, hi), "info")
    return (lo, hi)
# @end

# @helper canvas
# @needs log, px_state, px_find
def page_of(app, page="Main"):
    """A page of the project to build on, by definition name ("Main", or a module's own)."""
    prj = _PX["project"]
    try:
        return prj.canvas(str(page or "Main"))
    except Exception as err:
        try:
            have = list(prj.definitions() or [])
        except Exception:
            have = []
        raise PXError('[MODEL] %s has no page called "%s": %s%s'
                      % (getattr(prj, "name", "the project"), page, err,
                         ("\n  Its pages: " + ", ".join(have)) if have else ""))


def pages(app, pattern="*"):
    """The project's page (definition) names, sorted, matching the pattern."""
    import fnmatch
    try:
        have = list(_PX["project"].definitions() or [])
    except Exception as err:
        log("Could not list the project's pages: %s" % err, "warn")
        return []
    low = str(pattern or "*").lower()
    return sorted(n for n in have if fnmatch.fnmatch(str(n).lower(), low))


def module_page(app, defn="", name="", match="one"):
    """The page inside a module component, so a script can work on what is drawn in it."""
    comp = px_find(app, defn, name, match)
    try:
        return comp.canvas()
    except Exception as err:
        raise PXError("[MODEL] %s is not a module, so it has no page of its own: %s"
                      % (_label(comp), err))
# @end

# @helper build_page
# @needs log, px_state, px_names, px_set, track_created, canvas, px_find
def add_component(app, defn, x=1, y=1, page="Main", orient=0, keep=False, **params):
    """Put a component on a page and give it back.

    `defn` is a definition written namespace first, lower case: "master:source_1",
    "master:resistor". x and y are grid units, as PSCAD counts them. Anything else is set
    as a parameter of the new component. `keep` False has finish() delete it again, so a
    script that instruments a model leaves it as it was."""
    cv = page if hasattr(page, "create_component") else page_of(app, page)
    try:
        comp = cv.create_component(str(defn), int(x), int(y), int(orient))
    except Exception as err:
        raise PXError('[MODEL] Could not put "%s" on the page at (%s, %s): %s\n'
                      "  A definition is written namespace first and lower case, as in "
                      "master:source_1." % (defn, x, y, err))
    track_created(comp, kind="component", keep=keep, name=str(defn), parent=cv)
    for key, value in params.items():
        px_set(comp, key, value, record=False)
    page_changed()
    log("Added %s at (%s, %s)." % (defn, x, y), "info")
    return comp


def add_wire(app, *vertices, **kw):
    """Draw a wire through the given grid points and give it back.

    Two points make a straight connection; more make a multi-segment wire."""
    page = kw.pop("page", "Main")
    keep = bool(kw.pop("keep", False))
    cv = page if hasattr(page, "create_wire") else page_of(app, page)
    pts = _points(vertices)
    try:
        wire = cv.create_wire(*pts)
    except Exception as err:
        raise PXError("[MODEL] Could not draw a wire through %s: %s" % (list(pts), err))
    track_created(wire, kind="component", keep=keep, name="wire", parent=cv)
    log("Drew a wire through %d point%s." % (len(pts), "" if len(pts) == 1 else "s"), "info")
    return wire


def add_bus(app, *vertices, **kw):
    """Draw a bus through the given grid points and give it back. `name` names the bus."""
    page = kw.pop("page", "Main")
    keep = bool(kw.pop("keep", False))
    name = str(kw.pop("name", "") or "")
    cv = page if hasattr(page, "create_bus") else page_of(app, page)
    pts = _points(vertices)
    try:
        bus = cv.create_bus(*pts)
    except Exception as err:
        raise PXError("[MODEL] Could not draw a bus through %s: %s" % (list(pts), err))
    track_created(bus, kind="component", keep=keep, name=name or "bus", parent=cv)
    if name:
        px_set(bus, "Name", px_clean_name(name), record=False)
    for key, value in kw.items():
        px_set(bus, key, value, record=False)
    log("Drew a bus%s through %d points." % ((" " + name) if name else "", len(pts)), "info")
    return bus


def _points(vertices):
    """(x, y) pairs from either add_wire((1,2),(3,4)) or add_wire(1,2,3,4)."""
    flat = []
    for v in vertices:
        if isinstance(v, (tuple, list)):
            flat.append((int(v[0]), int(v[1])))
        else:
            flat.append(v)
    if flat and not isinstance(flat[0], tuple):
        nums = [int(v) for v in flat]
        if len(nums) % 2:
            raise PXError("[CODE] A wire or bus needs pairs of numbers; %d were given."
                          % len(nums))
        flat = list(zip(nums[0::2], nums[1::2]))
    if len(flat) < 2:
        raise PXError("[CODE] A wire or bus needs at least two points.")
    return flat


def add_channel(app, name, x=1, y=1, page="Main", group="", units="",
                lo=None, hi=None, keep=False):
    """Put an output channel (a PGB) on a page so the run records that signal.

    An output channel is what PSCAD writes to its .out files and draws on a graph, so a
    signal with no channel cannot be read back. Wire its input to the signal in PSCAD, or
    place it beside a data label of the same name."""
    cv = page if hasattr(page, "create_component") else page_of(app, page)
    pgb = add_component(app, "master:pgb", x, y, cv, keep=keep)
    params = {"Name": str(name), "Group": str(group or name), "Display": "YES"}
    if units:
        params["Units"] = str(units)
    if lo is not None:
        params["Min"] = lo
    if hi is not None:
        params["Max"] = hi
    for key, value in params.items():
        px_set(pgb, key, value, record=False)
    log("Added output channel %s." % name, "info")
    return pgb


def add_graph(app, channel=None, x=1, y=1, page="Main", keep=False, title=""):
    """Put a graph frame on a page, with a curve of `channel` when one is given.

    Gives back a record with .frame, .graph and .curve. A curve on a graph is also how a
    run's samples are read straight out of PSCAD, with no file in between."""
    cv = page if hasattr(page, "create_graph") else page_of(app, page)
    try:
        if channel is not None:
            frame, graph, curve = cv.create_graph(channel, int(x), int(y))
        else:
            frame = cv.create_graph_frame(int(x), int(y))
            graph, curve = None, None
    except Exception as err:
        raise PXError("[MODEL] Could not add a graph at (%s, %s): %s" % (x, y, err))
    track_created(frame, kind="component", keep=keep, name=title or "graph", parent=cv)
    if title:
        try:
            frame.title = str(title)
        except Exception:
            pass
    log("Added a graph%s." % ((" for " + _label(channel)) if channel is not None else ""),
        "info")
    return _Bag(frame=frame, graph=graph, curve=curve)


def delete_component(app, objs):
    """Delete components from the page and say how many went."""
    targets = objs if isinstance(objs, (list, tuple)) else [objs]
    n = 0
    for t in [x for x in targets if x is not None]:
        try:
            t.delete()
            n += 1
        except Exception as err:
            log("Could not delete %s: %s" % (_label(t), err), "warn")
    page_changed()
    log("Deleted %d component%s." % (n, "" if n == 1 else "s"), "info")
    return n


def copy_component(app, obj, x, y):
    """Copy one component to another spot on its page and give the copy back."""
    try:
        made = obj.clone(int(x), int(y))
    except Exception as err:
        raise PXError("[MODEL] Could not copy %s to (%s, %s): %s" % (_label(obj), x, y, err))
    track_created(made, kind="component", keep=False, name=_defn_of(obj))
    page_changed()
    log("Copied %s to (%s, %s)." % (_label(obj), x, y), "info")
    return made
# @end

# @helper projects
# @needs log, px_state, px_names, track_created, px_connect
def project_list(app, pattern="*"):
    """The projects loaded in the workspace, sorted, matching the pattern."""
    import fnmatch
    try:
        names = list(app.project_names() or [])
    except Exception as err:
        log("Could not list the workspace's projects: %s" % err, "warn")
        return []
    low = str(pattern or "*").lower()
    return sorted(n for n in names if fnmatch.fnmatch(str(n).lower(), low))


def project_use(app, name):
    """Make a loaded project the one the workflow works on, and give it back.

    Every later step that finds a component or runs a simulation uses this project. The
    project the workflow started on is put back by finish()."""
    name = str(getattr(name, "name", name))
    have = project_list(app)
    if name not in have:
        raise PXError('[MODEL] The workspace has no project called "%s".%s'
                      % (name, ("\n  It has: " + ", ".join(have)) if have else ""))
    prj = app.project(name)
    try:
        prj.focus()
    except Exception:
        pass
    _PX["project"] = prj
    if _PX["start"] is None:
        _remember_start(prj)
    log("Project %s is the one in use." % name, "info")
    return prj


def project_save(app, prj=None):
    """Save the project so what the workflow changed is on disk. True when it saved."""
    prj = prj if prj is not None else _PX["project"]
    try:
        prj.save()
        log("Saved project %s." % getattr(prj, "name", ""), "info")
        return True
    except Exception as err:
        log("Could not save project %s: %s" % (getattr(prj, "name", ""), err), "warn")
        return False


def project_save_as(app, path, prj=None, keep=True):
    """Save the project under a new name and give the new project back.

    This is how a workflow keeps the model it built or changed without touching the
    reader's own file."""
    import os
    prj = prj if prj is not None else _PX["project"]
    full = os.path.abspath(os.path.expanduser(os.path.expandvars(str(path))))
    folder = os.path.dirname(full)
    if folder and not os.path.isdir(folder):
        os.makedirs(folder, exist_ok=True)
    try:
        made = prj.save_as(os.path.basename(full), folder=folder or None)
    except Exception as err:
        raise PXError("[MODEL] Could not save the project as %s: %s" % (full, err))
    if made is not None and not keep:
        track_created(made, kind="project", keep=False, name=os.path.basename(full))
    log("Saved the project as %s." % full, "info")
    return made if made is not None else prj


def project_new(app, path, keep=False):
    """Make a new, empty case in the workspace and give it back, for a model built by script."""
    import os
    full = os.path.abspath(os.path.expanduser(os.path.expandvars(str(path))))
    folder = os.path.dirname(full)
    if folder and not os.path.isdir(folder):
        os.makedirs(folder, exist_ok=True)
    try:
        prj = app.create_case(full)
    except Exception as err:
        raise PXError("[MODEL] Could not create the case %s: %s" % (full, err))
    track_created(prj, kind="project", keep=keep, name=os.path.basename(full))
    log("Created case %s." % full, "info")
    return prj
# @end

# @helper multirun
# @needs log, px_state, px_find, px_value, px_set
def mrun_sweep(app, variable=1, values=(), defn="master:mrun", name="", match="first"):
    """Set up PSCAD's own Multiple Run component to sweep one variable over a list.

    The Multiple Run component is how PSCAD repeats a case with different values inside
    one build, so the sweep costs one compile rather than one per value. `variable` is
    which of its six variables to drive (1 to 6). It needs a Multiple Run component
    already on the page, wired to what it should change.

    A sweep driven by the workflow's own loop instead (a value written before each run) is
    simpler to read and gives a separate result per pass; this is for the cases where the
    model is built around the Multiple Run component."""
    mrun = px_find(app, defn, name, match)
    n = int(variable)
    if not 1 <= n <= 6:
        raise PXError("[CODE] A Multiple Run component has variables 1 to 6; %s was given."
                      % variable)
    nums = [px_number(v) for v in (values or [])]
    nums = [v for v in nums if v is not None]
    if not nums:
        raise PXError("[CODE] The Multiple Run sweep was given no numbers.")
    if len(nums) > 10:
        log("A Multiple Run variable holds 10 values; the first 10 of %d are used."
            % len(nums), "warn")
        nums = nums[:10]
    px_set(mrun, "VType%d" % n, "LIST")
    px_set(mrun, "IType%d" % n, "REAL")
    px_set(mrun, "N%dR" % n, len(nums))
    for i, v in enumerate(nums, 1):
        px_set(mrun, "V%dRun%dR" % (n, i), v)
    px_set(mrun, "ENAB", "ENABLED")
    log("Multiple Run variable %d sweeps %d value%s: %s."
        % (n, len(nums), "" if len(nums) == 1 else "s",
           ", ".join("%g" % v for v in nums)), "info")
    return nums


def mrun_range(app, variable=1, first=0.0, last=1.0, steps=10,
               defn="master:mrun", name="", match="first"):
    """Set up PSCAD's Multiple Run component to sweep one variable over a range."""
    mrun = px_find(app, defn, name, match)
    n = int(variable)
    if not 1 <= n <= 6:
        raise PXError("[CODE] A Multiple Run component has variables 1 to 6; %s was given."
                      % variable)
    lo, hi, count = px_number(first, 0.0), px_number(last, 1.0), max(1, int(steps))
    inc = (hi - lo) / count if count else 0.0
    px_set(mrun, "VType%d" % n, "SEQUENTIAL")
    px_set(mrun, "IType%d" % n, "REAL")
    px_set(mrun, "Min%dR" % n, lo)
    px_set(mrun, "Max%dR" % n, hi)
    px_set(mrun, "Inc%dR" % n, inc)
    px_set(mrun, "ENAB", "ENABLED")
    log("Multiple Run variable %d sweeps %g to %g in steps of %g." % (n, lo, hi, inc), "info")
    return (lo, hi, inc)


def mrun_count(app, runs=None):
    """How many runs the project does in one go, PSCAD's "Multiple Run" count.

    Setting it to 1 puts the project back to a single run."""
    prj = _PX["project"]
    if runs is None:
        try:
            return int(px_number((prj.parameters() or {}).get("Mruns"), 1))
        except Exception:
            return 1
    n = max(1, int(runs))
    px_set(prj, "Mruns", n)
    px_set(prj, "MrunType", "STANDALONE" if n <= 1 else "MASTER")
    log("The project runs %d time%s in one go." % (n, "" if n == 1 else "s"), "info")
    return n
# @end
