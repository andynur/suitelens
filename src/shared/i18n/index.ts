import { en, type MessageKey } from './en';

export type { MessageKey };

type Messages = Record<MessageKey, string>;
const locales: Record<string, Partial<Messages>> = { en };
let active: Partial<Messages> = en;
let activeLocale = 'en';

/** Switches the active locale (falls back to English for missing keys). */
export function setLocale(locale: string): void {
  active = locales[locale] ?? en;
  activeLocale = locale in locales ? locale : 'en';
}

/** BCP 47 tag of the active locale, for `Intl` formatters. */
export function getLocale(): string {
  return activeLocale;
}

type Vars = Record<string, string | number>;

/**
 * Reads one `{...}` group starting at `open` and returns its body and the index after it.
 * Nested braces are balanced so plural options can contain placeholders.
 */
function readGroup(template: string, open: number): { body: string; end: number } | undefined {
  let depth = 0;
  for (let i = open; i < template.length; i++) {
    if (template[i] === '{') depth++;
    else if (template[i] === '}') {
      depth--;
      if (depth === 0) return { body: template.slice(open + 1, i), end: i + 1 };
    }
  }
  return undefined;
}

/** Picks the ICU-style plural option (`one {...} other {...}`, `=0 {...}`) for `value`. */
function plural(options: string, value: number, vars: Vars): string {
  const choices = new Map<string, string>();
  let i = 0;
  while (i < options.length) {
    const open = options.indexOf('{', i);
    if (open < 0) break;
    const selector = options.slice(i, open).trim();
    const group = readGroup(options, open);
    if (!group) break;
    choices.set(selector, group.body);
    i = group.end;
  }
  const category = new Intl.PluralRules(activeLocale).select(value);
  const chosen = choices.get(`=${value}`) ?? choices.get(category) ?? choices.get('other') ?? '';
  return format(chosen.replace(/#/g, value.toLocaleString(activeLocale)), vars);
}

function format(template: string, vars: Vars): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf('{', i);
    if (open < 0) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const group = readGroup(template, open);
    if (!group) {
      out += template.slice(open);
      break;
    }
    const match = /^(\w+)\s*,\s*plural\s*,(.*)$/s.exec(group.body);
    if (match && match[1]! in vars) {
      out += plural(match[2]!, Number(vars[match[1]!]), vars);
    } else if (/^\w+$/.test(group.body) && group.body in vars) {
      out += String(vars[group.body]);
    } else {
      out += template.slice(open, group.end);
    }
    i = group.end;
  }
  return out;
}

/**
 * Translates a key and fills `{placeholders}`. Count strings use the ICU plural form
 * `{count, plural, one {# file} other {# files}}`; `#` is the formatted number.
 */
export function t(key: MessageKey, vars?: Vars): string {
  const template = active[key] ?? en[key];
  if (!vars) return template;
  return format(template, vars);
}

export function isMessageKey(key: string): key is MessageKey {
  return key in en;
}
