/** AI Assist strings: settings. Spread into `en`. */
export const aiSettingsEn = {
  'ai.settings.title': 'AI Assist',
  'ai.settings.intro':
    'AI Assist calls your provider directly from this browser with your own key. Every request shows a preview first.',
  'ai.settings.provider': 'Provider',
  'ai.provider.commandcode':
    'Command Code forwards your request to the selected model provider. Zero data retention is required for every request; unavailable routes fail instead of disabling it. Pricing can vary by route, and usage counts against your Command Code plan credits.',
  'ai.provider.gemini':
    'Google may use unpaid Gemini API inputs and responses to improve its products, with human review. Do not send confidential or personal data through unpaid services. For company data, use a project with active Cloud Billing and review the applicable Google terms; regional exceptions apply.',
  'ai.settings.provider.destination':
    "Requests go directly to {host}. Check this provider's data-retention terms before sending company data.",
  'ai.settings.model': 'Model ID',
  'ai.settings.model.hint': 'Any model ID your key can use, e.g. {example}.',
  'ai.settings.model.invalid': 'Enter a valid model ID (letters, digits, . _ : -).',
  'ai.settings.maxPerRequest': 'Max output tokens per request',
  'ai.settings.maxPerDay': 'Max tokens per day (0 = no limit)',
  'ai.settings.usageToday': 'Used today: {tokens} tokens (counted in this browser).',
  'ai.settings.redact': 'Redact sensitive patterns by default',
  'ai.settings.redact.desc':
    'Emails, phone numbers and bank or tax ID–like numbers are masked in the preview before sending.',
  'ai.settings.key.for': 'API key for {provider}',
  'ai.settings.key.where': 'Create a key at {page}. Each provider keeps its own key.',
  'ai.settings.key.none': 'No key saved.',
  'ai.settings.key.encrypted': 'Key saved, encrypted with your passphrase.',
  'ai.settings.key.encryptedLocked': 'Key saved and locked. Enter your passphrase to unlock it.',
  'ai.settings.key.session': 'Key kept for this browser session only.',
  'ai.settings.key.input': 'New API key',
  'ai.settings.key.mode': 'Storage',
  'ai.settings.key.mode.encrypted': 'Remember (encrypted with a passphrase)',
  'ai.settings.key.mode.session': 'This browser session only',
  'ai.settings.passphrase': 'Passphrase',
  'ai.settings.passphraseConfirm': 'Repeat passphrase',
  'ai.settings.passphrase.hint':
    'At least {min} characters. It is never stored; if you forget it, enter the key again.',
  'ai.settings.passphrase.mismatch': 'The passphrases do not match.',
  'ai.settings.save': 'Save key',
  'ai.settings.saved': 'AI key saved',
  'ai.settings.unlock': 'Unlock',
  'ai.settings.unlocked': 'AI key unlocked',
  'ai.settings.lock': 'Lock',
  'ai.settings.replace': 'Replace key',
  'ai.settings.delete': 'Delete key',
  'ai.settings.delete.confirm': 'Delete the saved AI key from this browser? This cannot be undone.',
  'ai.settings.deleted': 'AI key deleted',
  'ai.settings.permissionDenied':
    'Chrome did not grant access to the provider API. AI requests will fail until you allow it (save the key again to retry).',
} as const;
