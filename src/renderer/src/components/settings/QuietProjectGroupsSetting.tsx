import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSwitchRow } from './SettingsFormControls'
import { getQuietProjectGroupsEntry } from './appearance-sidebar-search'

type QuietProjectGroupsSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function QuietProjectGroupsSetting({
  settings,
  updateSettings
}: QuietProjectGroupsSettingProps): React.JSX.Element {
  const entry = getQuietProjectGroupsEntry()
  const quiet = settings.quietProjectGroups !== false
  return (
    <SearchableSetting
      title={entry.title}
      description={entry.description}
      keywords={entry.keywords}
    >
      <SettingsSwitchRow
        label={entry.title}
        description={entry.description}
        checked={quiet}
        onChange={() => updateSettings({ quietProjectGroups: !quiet })}
      />
    </SearchableSetting>
  )
}
