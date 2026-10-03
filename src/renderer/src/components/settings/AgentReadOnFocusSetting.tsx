import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { SettingsSwitchRow } from './SettingsFormControls'
import {
  getAgentReadOnFocusDescription,
  getAgentReadOnFocusTitle
} from './agent-read-on-focus-copy'

type AgentReadOnFocusSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function AgentReadOnFocusSetting({
  settings,
  updateSettings
}: AgentReadOnFocusSettingProps): React.JSX.Element {
  const enabled = settings.agentReadOnTerminalFocus === true
  return (
    <section className="space-y-3">
      <SettingsSwitchRow
        label={getAgentReadOnFocusTitle()}
        description={getAgentReadOnFocusDescription()}
        checked={enabled}
        onChange={() => updateSettings({ agentReadOnTerminalFocus: !enabled })}
        ariaLabel={getAgentReadOnFocusTitle()}
      />
    </section>
  )
}
