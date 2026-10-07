import { t } from '../../shared/i18n';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import type { AiProviderId } from './catalog';

/** Provider terms that affect the user's decision to send company data. */
export function ProviderNotice({ provider }: { provider: AiProviderId }) {
  if (provider === 'commandcode') {
    return <SectionMessage appearance="information">{t('ai.provider.commandcode')}</SectionMessage>;
  }
  if (provider === 'gemini') {
    return <SectionMessage appearance="warning">{t('ai.provider.gemini')}</SectionMessage>;
  }
  return null;
}
