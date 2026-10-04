import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSwitchRow } from './SettingsFormControls'
import { getShowAllClaudeAccountsInStatusBarEntry } from './accounts-claude-search'

type ShowAllClaudeAccountsSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function ShowAllClaudeAccountsSetting({
  settings,
  updateSettings
}: ShowAllClaudeAccountsSettingProps): React.JSX.Element {
  const entry = getShowAllClaudeAccountsInStatusBarEntry()
  const shown = settings.showAllClaudeAccountsInStatusBar === true
  return (
    <SearchableSetting
      title={entry.title}
      description={entry.description}
      keywords={entry.keywords}
    >
      <SettingsSwitchRow
        label={entry.title}
        description={entry.description}
        checked={shown}
        onChange={() => updateSettings({ showAllClaudeAccountsInStatusBar: !shown })}
      />
    </SearchableSetting>
  )
}
