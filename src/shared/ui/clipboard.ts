import { t } from '../i18n';
import { useAppStore } from '../store';

/** Copies text and shows a toast (F-1.9). */
export async function copyWithToast(text: string): Promise<boolean> {
  const { toast } = useAppStore.getState();
  try {
    await navigator.clipboard.writeText(text);
    toast(t('app.copied', { value: text.length > 40 ? `${text.slice(0, 40)}…` : text }));
    return true;
  } catch {
    toast(t('app.copyFailed'));
    return false;
  }
}
