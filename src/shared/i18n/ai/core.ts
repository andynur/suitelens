/** Shared AI Assist strings (tab, feature flags, error codes). Spread into `en`. */
export const aiCoreEn = {
  'tabs.ai': 'AI',
  'ai.setupAbove': 'Available after AI is set up (see above).',
  'feature.aiAssist': 'AI Assist',
  'feature.aiAssist.desc':
    'Ask for SuiteQL and explanations with your own AI provider key. Nothing is sent without a preview.',
  'feature.aiContextExport': 'AI Context Export',
  'feature.aiContextExport.desc':
    'Export record-type metadata as Markdown or JSON for coding agents. Metadata only, no AI call.',
  'ai.workbench.title': 'AI Assist',
  'ai.notConfigured.title': 'AI is not set up',
  'ai.notConfigured.body': 'Add your AI provider key in AI setup to use AI Assistant.',
  'ai.locked.body': 'Your saved key is locked. Unlock it in AI setup to continue.',
  'ai.openSettings': 'Open AI setup',
  'ai.setup.title': 'AI setup',
  'ai.setup.status.none': 'Not set up',
  'ai.setup.status.locked': 'Key locked',
  'ai.setup.status.ready': '{provider} · {model}',
  'ai.setup.inAssistant':
    'Provider, key, model and token limits are set in AI Assistant, next to where you use them.',
  'error.AI_NOT_CONFIGURED': 'No AI provider key is set up. Add one in AI setup.',
  'error.AI_LOCKED': 'The AI key is locked. Unlock it with your passphrase in AI setup.',
  'error.AI_LIMIT_REACHED': 'The AI token limit is reached. Change the limits in AI setup.',
  'error.AI_PROVIDER_ERROR': 'The AI provider returned an error.',
} as const;
