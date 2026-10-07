import { t } from '../../shared/i18n';
import { useAppStore } from '../../shared/store';
import { WORKSPACE_ROLES } from '../../shared/workspace';

/** Radio cards for the workspace role; the choice applies right away. */
export function WorkspaceRolePicker() {
  const role = useAppStore((s) => s.settings.workspaceRole);
  const saveSettings = useAppStore((s) => s.saveSettings);
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="sr-only">{t('workspace.title')}</legend>
      {WORKSPACE_ROLES.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-surface p-2 hover:bg-muted has-checked:border-accent has-checked:bg-selected"
        >
          <input
            type="radio"
            name="workspaceRole"
            value={option}
            checked={role === option}
            onChange={() => void saveSettings({ workspaceRole: option })}
            className="mt-0.5"
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-fg">{t(`workspace.${option}`)}</span>
            <span className="text-xs text-fg-subtlest">{t(`workspace.${option}.desc`)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
