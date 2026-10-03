import { translate } from '@/i18n/i18n'
import { searchKeywords } from './settings-search-keywords'

export function getAgentReadOnFocusTitle(): string {
  return translate(
    'auto.components.settings.agent-read-on-focus-copy.title',
    'Mark agents read when their terminal has focus'
  )
}

export function getAgentReadOnFocusDescription(): string {
  return translate(
    'auto.components.settings.agent-read-on-focus-copy.description',
    'Clicking or typing in an agent terminal marks it read, like opening its Dashboard card. A turn that finishes while you are in its terminal is read too.'
  )
}

export function getAgentReadOnFocusSearchKeywords(): string[] {
  return searchKeywords([
    { key: 'auto.components.settings.agent-read-on-focus-copy.read', fallback: 'read' },
    { key: 'auto.components.settings.agent-read-on-focus-copy.unread', fallback: 'unread' },
    { key: 'auto.components.settings.agent-read-on-focus-copy.focus', fallback: 'focus' },
    { key: 'auto.components.settings.agent-read-on-focus-copy.seen', fallback: 'seen' },
    { key: 'auto.components.settings.agent-read-on-focus-copy.done', fallback: 'done' },
    { key: 'auto.components.settings.agent-read-on-focus-copy.dashboard', fallback: 'dashboard' }
  ])
}
