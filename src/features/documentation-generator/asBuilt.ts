import { t } from '../../shared/i18n';
import { toMarkdown, type RecordContextModel } from '../ai/export/contextModel';

/** Metadata-only draft. Reuses the allow-listed context model, with explicit coverage gaps. */
export function asBuiltPreview(model: RecordContextModel): string {
  const context = toMarkdown(model).split('\n').slice(2).join('\n');
  return [
    t('docs.document.title', { recordType: model.recordType }),
    '',
    t('docs.document.overview'),
    '',
    t('docs.document.draft'),
    '',
    context,
    t('docs.document.coverage'),
    '',
    t('docs.document.forms'),
    '',
    t('docs.document.searches'),
    '',
    t('docs.document.integrations'),
    '',
    t('docs.document.order'),
    '',
    t('docs.document.risk'),
    '',
  ].join('\n');
}
