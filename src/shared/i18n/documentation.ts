export const documentationEn = {
  'tabs.docs': 'Docs',
  'feature.documentationGenerator': 'Documentation Generator (preview)',
  'feature.documentationGenerator.desc':
    'Generate a local as-built draft for one record type. Metadata only; coverage is partial.',
  'docs.title': 'Documentation Generator',
  'docs.preset': 'Export preset',
  'docs.preset.asBuilt': 'As-built document',
  'docs.preset.agent': 'AI agent context',
  'docs.intro':
    'Preview an as-built draft for one record type, generated locally from available metadata. No AI call or record values. Review coverage before using the draft.',
  'docs.generate': 'Generate preview',
  'docs.loading': 'Reading document metadata…',
  'docs.empty.title': 'No document yet',
  'docs.empty.body': 'Choose a record type and generate an as-built preview.',
  'docs.preview': 'As-built preview',
  'docs.document.title': '# As-built draft: {recordType}',
  'docs.document.overview': '## Overview',
  'docs.document.draft':
    'Draft assembled from available record-type metadata. It is partial and requires review against native definitions. No AI-written narrative or transaction values are included.',
  'docs.document.coverage': '## Additional coverage and review',
  'docs.document.forms':
    'Forms/layouts: not checked. The active field snapshot does not establish custom-form definitions.',
  'docs.document.searches':
    'Related saved searches: not checked. Page links and impact candidates do not establish relationships to this record type.',
  'docs.document.integrations':
    'Integrations/RESTlets: not checked. Account-visible deployments do not establish integrations with this record type.',
  'docs.document.order':
    'Execution order: not verified. Script/workflow metadata does not establish exact runtime ordering or field interactions.',
  'docs.document.risk':
    'Risk notes: no account-specific risk assessment was performed. Review missing source coverage, permissions and native definitions before planning a change.',
} as const;
