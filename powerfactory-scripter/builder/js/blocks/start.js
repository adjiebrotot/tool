// Start: where every workflow begins. Its settings are the workflow's own settings and become
// the SETTINGS lines at the top of the generated script (DESIGN 6.6, 7.1).
//
// The workflow name is NOT a setting of this block: it is the workflow's `name` (shown in the
// toolbar and in the toasts) and the generator writes it as WORKFLOW_NAME. The inspector shows
// it with Start's settings when nothing is selected.
//
// Setting keys are frozen handles (saved in every workflow); change labels and tips freely.

import { defineBlock } from '../core/registry.js';

defineBlock({
  type: 'start', cat: 'start', kind: 'start',
  title: 'Start',
  desc: 'Where the workflow begins: the PowerFactory project to open and where the results go. Every workflow has exactly one Start.',
  keywords: ['begin', 'project', 'connect', 'settings', 'study case', 'output folder', 'workflow'],
  settings: [
    { key: 'project', label: 'Project', kind: 'text', default: '', required: true,
      placeholder: 'Exactly as in the Data Manager, e.g. Nine-bus System',
      tip: 'The PowerFactory project to open. Type the name exactly as the Data Manager shows it; letter case counts.' },
    { key: 'studyCase', label: 'Study case', kind: 'text', default: '',
      placeholder: 'Leave empty to use the active one',
      tip: 'The study case to activate first. Leave it empty to keep the one that is active in the project.' },
    { key: 'outputDir', label: 'Output folder', kind: 'text', default: '',
      placeholder: 'Leave empty for the folder of the script',
      tip: 'Each run writes its tables, graphs and run.log to a new folder in here. Empty means the folder the script is in.' },
    { key: 'undoChanges', label: 'Put changed values back at the end', kind: 'bool', default: true, more: true, 
      tip: 'When the workflow ends (also after an error), every attribute the workflow changed is set back to its value before the run.' },
    { key: 'tableFmt', label: 'Save the results tables as', kind: 'select', default: 'csv', more: true,
      options: [['csv', 'CSV (opens in Excel)'], ['xlsx', 'Excel (.xlsx)'], ['both', 'Both']],
      tip: 'Every results table is saved in the run folder when the run ends (also after an error). A Save results table block saves its own table its own way.' },
    { key: 'fNominal', label: 'Nominal frequency', kind: 'select', default: 'auto', more: true, 
      options: [['auto', 'Find it from the grid'], ['50', '50 Hz'], ['60', '60 Hz']],
      tip: 'Used by the frequency checks. "Find it from the grid" reads the nominal frequency of the grid in the project.' },
    { key: 'runMode', label: 'How to run', kind: 'select', default: 'auto', more: true,
      options: [['auto', 'Automatic'], ['engine', 'Start PowerFactory in the background'], ['inside', 'From inside PowerFactory']],
      tip: 'Automatic uses the PowerFactory you run the script from, or starts one in the background when there is none.' },
    { key: 'showPf', label: 'Show the PowerFactory window', kind: 'bool', default: false, more: true, showIf: (s) => s.runMode !== 'inside',
      tip: 'Show the PowerFactory window while the script runs (slower). Only for a PowerFactory started in the background.' },
    { key: 'fastMode', label: 'Fast mode', kind: 'bool', default: true, more: true,
      tip: 'Turns off screen updates and most output window messages while the script runs.' },
    { key: 'connectTimeout', label: 'Connect timeout', kind: 'number', default: 120, unit: 's', min: 10, step: 10, more: true, showIf: (s) => s.runMode !== 'inside',
      tip: 'How long to wait for PowerFactory to start before giving up.' },
    { key: 'apiPath', label: 'PowerFactory Python folder', kind: 'text', default: '', more: true, showIf: (s) => s.runMode !== 'inside',
      placeholder: 'Leave empty to find it',
      tip: 'The folder with the powerfactory module, e.g. C:\\Program Files\\DIgSILENT\\PowerFactory 2024\\Python\\3.12. Empty: the script finds it.' },
    { key: 'pfUser', label: 'PowerFactory user', kind: 'text', default: '', more: true, showIf: (s) => s.runMode !== 'inside',
      placeholder: 'Leave empty for your own user',
      tip: 'Log in to PowerFactory as this user. Leave it empty to use your own.' },
  ],
  summary(s) {
    return s.project ? `Project: ${s.project}` : 'Project: not set \u26a0';
  },
  emit(cx) {
    const s = cx.s;
    const f = s.fNominal === '50' || s.fNominal === '60' ? Number(s.fNominal) : 'auto';
    return {
      settings: [
        ...cx.settingLine('PROJECT', 'project', 'The PowerFactory project to open, exactly as the Data Manager shows it (letter case counts).'),
        ...cx.settingLine('STUDY_CASE', 'studyCase', 'The study case to activate first ("" = keep the active one).'),
        ...cx.settingLine('OUTPUT_DIR', 'outputDir', 'Where each run writes its folder of results and run.log ("" = the folder of this script).'),
        ...cx.settingLine('UNDO_CHANGES', 'undoChanges', 'True: put every value the workflow changed back when it ends.'),
        ...cx.settingLine('TABLE_FORMAT', 'tableFmt', 'How the results tables are saved in the run folder when the run ends: "csv", "xlsx" (Excel, needs pandas and openpyxl) or "both".'),
        ...cx.settingLine('F_NOMINAL', 'fNominal', 'Nominal frequency in Hz for the frequency checks: 50, 60 or "auto" (read from the grid).', { value: f }),
        ...cx.settingLine('RUN_MODE', 'runMode', '"auto", "engine" (start PowerFactory in the background) or "inside" (run from inside PowerFactory).'),
        ...cx.settingLine('SHOW_PF', 'showPf', 'True: show the PowerFactory window while running (engine mode only).'),
        ...cx.settingLine('FAST_MODE', 'fastMode', 'True: no screen updates and fewer output window messages while running.'),
        ...cx.settingLine('CONNECT_TIMEOUT', 'connectTimeout', 'Seconds to wait for PowerFactory to start.'),
        ...cx.settingLine('PF_API_PATH', 'apiPath', 'The folder with the powerfactory Python module ("" = find it).'),
        ...cx.settingLine('PF_USER', 'pfUser', 'Log in to PowerFactory as this user ("" = your own).'),
      ],
      lines: [],
      // Excel needs pandas and openpyxl: checked before connecting, when the script has tables.
      tablePackages: s.tableFmt === 'csv' ? [] : ['pandas', 'openpyxl'],
    };
  },
});
