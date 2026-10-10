import type { AgentStatusState } from './agent-status-types'
import type { NotificationSettings } from './notification-settings-types'

export function getDefaultNotificationSettings(): NotificationSettings {
  return {
    enabled: true,
    agentTaskComplete: true,
    agentNeedsInput: true,
    terminalBell: false,
    suppressWhenFocused: true,
    customSoundId: 'system',
    customSoundPath: null,
    customSoundVolume: 100,
    mutedNotificationSourceIds: []
  }
}

export function isAgentNeedsInputState(state: AgentStatusState | undefined): boolean {
  return state === 'waiting' || state === 'blocked'
}

export function isAgentNotificationDesktopAllowed(
  settings: Pick<NotificationSettings, 'enabled' | 'agentTaskComplete' | 'agentNeedsInput'>,
  agentState: AgentStatusState | undefined
): boolean {
  if (!settings.enabled) {
    return false
  }
  // Why: settings saved before this switch existed have no key; questions stay on for them.
  return isAgentNeedsInputState(agentState)
    ? settings.agentNeedsInput !== false
    : settings.agentTaskComplete
}
