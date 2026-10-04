import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSwitchRow } from './SettingsFormControls'
import { getAttachedWorktreeReviewEntry } from './appearance-sidebar-search'

type AttachedWorktreeReviewSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function AttachedWorktreeReviewSetting({
  settings,
  updateSettings
}: AttachedWorktreeReviewSettingProps): React.JSX.Element {
  const entry = getAttachedWorktreeReviewEntry()
  const shown = settings.attachedWorktreeReview === true
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
        onChange={() => updateSettings({ attachedWorktreeReview: !shown })}
      />
    </SearchableSetting>
  )
}
