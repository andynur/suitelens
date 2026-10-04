import { en, type MessageKey } from './en';

export type { MessageKey };

type Messages = Record<MessageKey, string>;
const locales: Record<string, Partial<Messages>> = { en };
let active: Partial<Messages> = en;

/** Switches the active locale (falls back to English for missing keys). */
export function setLocale(locale: string): void {
  active = locales[locale] ?? en;
}

/** Translates a key and fills `{placeholders}`. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template = active[key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function isMessageKey(key: string): key is MessageKey {
  return key in en;
}
