// Start: where every workflow begins. Its settings are the workflow's own settings and become
// the SETTINGS lines at the top of the generated script (DESIGN 6.6, 7.1).
//
// The workflow name is NOT a setting of this block: it is the workflow's `name` (shown in the
// toolbar and in the toasts) and the generator writes it as WORKFLOW_NAME. The inspector shows
// it with Start's settings when nothing is selected.
//
// Setting keys are frozen handles (saved in every workflow); change labels and tips freely.

import { defineBlock } from '../core/registry.js';

// "one per line, or separated by commas" into a list, as val.list reads its own.
export function parseLines(text) {
  return String(text === undefined || text === null ? '' : text)
    .split(/[\n,;]+/).map(v => v.trim()).filter(Boolean);
}

defineBlock({
  type: 'start', cat: 'start', kind: 'start',
  title: 'Start',
  desc: 'Where the workflow begins: the PSCAD case to open and where the results go. Every workflow has exactly one Start.',
  keywords: ['begin', 'project', 'case', 'pscx', 'connect', 'settings', 'workspace', 'output folder', 'workflow', 'fortran'],
  settings: [
    { key: 'project', label: 'PSCAD case', kind: 'text', default: '', required: true,
      placeholder: 'C:\\work\\mycase.pscx, or a case already open',
      tip: 'The .pscx file to open, or the name of a case already in the workspace. A relative path is read from the folder the script runs in.' },
    { key: 'workspace', label: 'Workspace', kind: 'text', default: '', more: true,
      placeholder: 'Leave empty to use the one that is open',
      tip: 'A .pswx workspace to load before the case. Empty keeps whatever workspace PSCAD has open.' },
    { key: 'libraries', label: 'Libraries', kind: 'textarea', default: '', more: true,
      placeholder: 'One .pslx or .pscx path per line',
      tip: 'Extra libraries to load before the case, for a model whose components live in one. The Master Library is always there.' },
    { key: 'outputDir', label: 'Output folder', kind: 'text', default: '',
      placeholder: 'Leave empty for the folder of the script',
      tip: 'Each run writes its tables, graphs and run.log to a new folder in here. Empty means the folder the script is in.' },
    { key: 'undoChanges', label: 'Put changed values back at the end', kind: 'bool', default: true, more: true,
      tip: 'When the workflow ends (also after an error), every parameter, layer state and substitution the workflow changed is set back to what it was.' },
    { key: 'tableFmt', label: 'Save the results tables as', kind: 'select', default: 'csv', more: true,
      options: [['csv', 'CSV (opens in Excel)'], ['xlsx', 'Excel (.xlsx)'], ['both', 'Both']],
      tip: 'Every results table is saved in the run folder when the run ends (also after an error). A Save results table block saves its own table its own way.' },
    { key: 'fNominal', label: 'Nominal frequency', kind: 'select', default: 'auto', more: true,
      options: [['auto', 'Read it from the case'], ['50', '50 Hz'], ['60', '60 Hz']],
      tip: 'Used by the frequency checks. "Read it from the case" takes the global substitution the Master Library components read, usually f or freq.' },
    { key: 'runMode', label: 'How to run', kind: 'select', default: 'auto', more: true,
      options: [['auto', 'Automatic'], ['launch', 'Start a new PSCAD'], ['connect', 'Use the PSCAD that is open'], ['inside', 'From inside PSCAD']],
      tip: 'Automatic uses the PSCAD that is already open, starts one when there is none, and uses the host PSCAD when the script runs inside it.' },
    { key: 'showPscad', label: 'Show the PSCAD window', kind: 'bool', default: false, more: true, showIf: (s) => s.runMode !== 'inside',
      tip: 'Show the PSCAD window while the script runs. Hidden is a little faster and keeps the screen free.' },
    { key: 'fortran', label: 'Fortran compiler', kind: 'text', default: '', more: true, showIf: (s) => s.runMode !== 'inside',
      placeholder: 'Leave empty for the one PSCAD has selected',
      tip: 'The compiler that builds the case, as PSCAD names it, e.g. GFortran 4.6.2. Empty uses whatever is selected in PSCAD.' },
    { key: 'pscadVersion', label: 'PSCAD version', kind: 'text', default: '', more: true, showIf: (s) => s.runMode === 'launch' || s.runMode === 'auto',
      placeholder: 'Leave empty to pick the newest',
      tip: 'Which installed PSCAD to start when more than one is there, e.g. 5.0.2. Empty starts the newest.' },
    { key: 'port', label: 'Automation port', kind: 'number', default: 0, min: 0, step: 1, more: true, showIf: (s) => s.runMode !== 'inside',
      tip: 'The port PSCAD listens on. 0 lets PSCAD choose; set it when several scripts drive several PSCADs at once.' },
    { key: 'connectTimeout', label: 'Connect timeout', kind: 'number', default: 120, unit: 's', min: 10, step: 10, more: true, showIf: (s) => s.runMode !== 'inside',
      tip: 'How long to wait for PSCAD to start before giving up.' },
  ],
  summary(s) {
    if (!s.project) return 'Case: not set \u26a0';
    const stem = String(s.project).replace(/\\/g, '/').split('/').pop();
    return `Case: ${stem}`;
  },
  emit(cx) {
    const s = cx.s;
    const f = s.fNominal === '50' || s.fNominal === '60' ? Number(s.fNominal) : 'auto';
    return {
      settings: [
        ...cx.settingLine('PROJECT', 'project', 'The PSCAD case to work on: a .pscx path, or the name of a case already in the workspace.'),
        ...cx.settingLine('WORKSPACE', 'workspace', 'A .pswx workspace to load before the case ("" = keep the one that is open).'),
        ...cx.settingLine('LIBRARIES', 'libraries', 'Extra .pslx / .pscx libraries to load before the case.', { value: parseLines(s.libraries) }),
        ...cx.settingLine('OUTPUT_DIR', 'outputDir', 'Where each run writes its folder of results and run.log ("" = the folder of this script).'),
        ...cx.settingLine('UNDO_CHANGES', 'undoChanges', 'True: put every parameter, layer state and substitution the workflow changed back when it ends.'),
        ...cx.settingLine('TABLE_FORMAT', 'tableFmt', 'How the results tables are saved in the run folder when the run ends: "csv", "xlsx" (Excel, needs pandas and openpyxl) or "both".'),
        ...cx.settingLine('F_NOMINAL', 'fNominal', 'Nominal frequency in Hz for the frequency checks: 50, 60 or "auto" (read the case\'s own global substitution).', { value: f }),
        ...cx.settingLine('RUN_MODE', 'runMode', '"auto", "launch" (start a new PSCAD), "connect" (use the one that is open) or "inside" (run from inside PSCAD).'),
        ...cx.settingLine('SHOW_PSCAD', 'showPscad', 'True: show the PSCAD window while running.'),
        ...cx.settingLine('FORTRAN_VERSION', 'fortran', 'The Fortran compiler that builds the case, as PSCAD names it ("" = the one PSCAD has selected).'),
        ...cx.settingLine('PSCAD_VERSION', 'pscadVersion', 'Which installed PSCAD to start ("" = the newest).'),
        ...cx.settingLine('PSCAD_PORT', 'port', 'The port PSCAD listens on for automation (0 = let PSCAD choose).'),
        ...cx.settingLine('CONNECT_TIMEOUT', 'connectTimeout', 'Seconds to wait for PSCAD to start.'),
      ],
      lines: [],
      // Excel needs pandas and openpyxl: checked before connecting, when the script has tables.
      tablePackages: s.tableFmt === 'csv' ? [] : ['pandas', 'openpyxl'],
    };
  },
});
