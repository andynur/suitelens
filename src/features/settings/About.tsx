import { browser } from 'wxt/browser';
import { t } from '../../shared/i18n';
import { PRIVACY_POLICY_URL, REPOSITORY_URL } from '../../shared/constants';

/** About screen (F-1.25): version, repo, privacy policy, trademark disclaimer. */
export function About() {
  const version = browser.runtime.getManifest().version;
  return (
    <section className="px-3 py-3 text-xs" aria-label={t('about.title')}>
      <h2 className="mb-2 font-semibold text-fg">{t('about.title')}</h2>
      <p className="text-fg">
        {t('app.name')} · {t('about.version', { version })}
      </p>
      <p className="mt-1 text-fg-muted">{t('about.local')}</p>
      <p className="mt-2 flex gap-3">
        <a
          className="text-accent hover:underline"
          href={REPOSITORY_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('about.repo')} ↗
        </a>
        <a
          className="text-accent hover:underline"
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('about.privacy')} ↗
        </a>
      </p>
      <p className="mt-3 text-[11px] text-fg-muted">{t('about.disclaimer')}</p>
    </section>
  );
}
