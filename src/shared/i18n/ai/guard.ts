/** AI Assist strings: guard (preview dialog, response view). Spread into `en`. */
export const aiGuardEn = {
  'ai.guard.preview.description':
    'Review everything that will be sent to {provider} ({model}, {host}). Nothing is sent until you choose Send.',
  'ai.guard.recordNote':
    'Record values (transaction or customer data) are not included unless you add them yourself.',
  'ai.guard.kind.question': 'Question',
  'ai.guard.kind.schema': 'Schema',
  'ai.guard.kind.script': 'Script',
  'ai.guard.kind.metadata': 'Metadata',
  'ai.guard.kind.log': 'Log',
  'ai.guard.kind.record': 'Record data',
  'ai.guard.kind.note': 'Note',
  'ai.guard.itemContent': 'Content of {label}',
  'ai.guard.remove': 'Remove',
  'ai.guard.removeItem': 'Remove {label}',
  'ai.guard.itemTokens': '~{tokens} tokens',
  'ai.guard.totalTokens': 'About {tokens} input tokens in total',
  'ai.guard.redact': 'Redact personal data',
  'ai.guard.redact.desc': 'Replaces emails, phone numbers and bank or tax IDs before sending.',
  'ai.guard.redactCount': '{count, plural, one {# redaction} other {# redactions}} applied',
  'ai.guard.redactedPreview': 'Sent as (redacted)',
  'ai.guard.empty': 'Nothing to send. Every item was removed.',
  'ai.guard.tooLarge':
    'The payload is too large ({chars} of {max} characters). Remove or shorten items.',
  'ai.guard.send': 'Send',
  'ai.guard.streaming': 'Waiting for the AI response…',
  'ai.guard.cancelled': 'Cancelled. The request was stopped.',
  'ai.guard.usage': 'Input {input} tokens · output {output} tokens',
  'ai.guard.truncated.title': 'Answer cut off',
  'ai.guard.truncated.body':
    'The answer reached the output-token limit. Raise the limit in Settings or ask a narrower question.',
  'ai.guard.refusal.title': 'Request declined',
  'ai.guard.refusal.body': 'The AI provider declined to answer this request.',
  'ai.guard.response': 'AI response',
  'ai.guard.codeBlock': 'Code ({lang})',
} as const;
