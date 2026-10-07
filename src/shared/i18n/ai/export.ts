/** AI Assist strings: export. Spread into `en`. */
export const aiExportEn = {
  'ai.export.title': 'AI Context Export',
  'ai.export.intro':
    'Export record-type metadata for coding agents as Markdown or JSON. Generated locally: no AI call, no record values, no account ID.',
  'ai.export.recordType': 'Record type',
  'ai.export.recordTypeHint': 'SuiteScript record type ID, for example salesorder.',
  'ai.export.invalidRecordType':
    'Enter a SuiteScript record type ID: lowercase letters, digits and underscores.',
  'ai.export.useActive': 'Use active ({recordType})',
  'ai.export.otherTypeNote':
    'Body and sublist fields require an open {recordType} record. For custom record types, available definition identifiers are exported separately with partial coverage.',
  'ai.export.generate': 'Generate',
  'ai.export.cancel': 'Cancel',
  'ai.export.step.fields': 'Reading fields…',
  'ai.export.step.automations': 'Reading scripts and workflows…',
  'ai.export.step.customRecords': 'Reading custom record types…',
  'ai.export.summary':
    '{fields, plural, one {# body field} other {# body fields}} ({custom} custom), {sublists, plural, one {# sublist} other {# sublists}}, {scripts, plural, one {# script} other {# scripts}}, {workflows, plural, one {# workflow} other {# workflows}}, {records, plural, one {# referenced custom record type} other {# referenced custom record types}}',
  'ai.export.savePath': 'Save as {path} in your project.',
  'ai.export.preview': 'Markdown preview',
  'ai.export.copyMenu': 'Copy',
  'ai.export.downloadMenu': 'Download',
  'ai.export.copyMarkdown': 'Copy Markdown',
  'ai.export.copyJson': 'Copy JSON',
  'ai.export.copySnippet': 'Copy agent snippet',
  'ai.export.downloadMarkdown': 'Download .md',
  'ai.export.downloadJson': 'Download .json',
  'ai.export.copiedMarkdown': 'Copied Markdown',
  'ai.export.copiedJson': 'Copied JSON',
  'ai.export.copiedSnippet': 'Copied agent snippet',
  'ai.export.empty.title': 'No export yet',
  'ai.export.empty.body': 'Choose a record type and select Generate.',
} as const;
