/** AI Assist strings: explain (Explain Script, Explain Error). Spread into `en`. */
export const aiExplainEn = {
  'ai.explain.script.title': 'Explain Script',
  'ai.explain.script.desc':
    'Reads a SuiteScript file from the File Cabinet and asks the AI for a summary, entry points, fields touched and governance risks. You review everything before it is sent.',
  'ai.explain.script.pick': 'Script on this record type',
  'ai.explain.script.option': '{name} · {file}',
  'ai.explain.script.other': 'Other file (enter its ID)',
  'ai.explain.script.noScripts': 'No scripts with a source file were found for this record type.',
  'ai.explain.script.noRecord': 'Open a record to pick one of its scripts, or enter a file ID.',
  'ai.explain.script.fileId': 'File Cabinet file ID',
  'ai.explain.script.fileIdHint': 'The internal ID of the script file, for example 1234.',
  'ai.explain.script.explain': 'Explain',
  'ai.explain.script.reading': 'Reading script source…',
  'ai.explain.script.previewTitle': 'Explain Script: review what will be sent',
  'ai.explain.script.truncated':
    'The source is longer than the AI payload limit. Only its beginning is included, with a notice. You can edit it in the preview.',
  'ai.explain.error.select': 'Select "{title}" for AI',
  'ai.explain.error.disabled.setup': 'Set up AI in Settings first',
  'ai.explain.error.disabled.select': 'Select log entries first',
  'ai.explain.error.selected': '{count} of {max} selected for AI',
  'ai.explain.error.selectHint': 'Select up to {max} log entries or groups to explain with AI.',
  'ai.explain.error.clear': 'Clear selection',
  'ai.explain.error.explain': 'Explain with AI',
  'ai.explain.error.previewTitle': 'Explain Error: review what will be sent',
} as const;
