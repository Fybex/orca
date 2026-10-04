import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSwitchRow } from './SettingsFormControls'
import { getShowActivityButtonEntry } from './appearance-sidebar-search'

type ShowActivityButtonSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function ShowActivityButtonSetting({
  settings,
  updateSettings
}: ShowActivityButtonSettingProps): React.JSX.Element {
  const entry = getShowActivityButtonEntry()
  const shown = settings.showActivityButton !== false
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
        onChange={() => updateSettings({ showActivityButton: !shown })}
      />
    </SearchableSetting>
  )
}
