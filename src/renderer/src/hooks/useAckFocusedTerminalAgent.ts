import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { resolveUnreadAgentPaneKeyForLeaf } from './agent-focus-ack-target'

function focusedTerminalLeafId(): string | null {
  const active = document.activeElement
  return active instanceof Element
    ? (active.closest('.pane[data-leaf-id]')?.getAttribute('data-leaf-id') ?? null)
    : null
}

// Opt-in: a focused agent terminal counts as read, like a Dashboard card click, with no idle check.
export function useAckFocusedTerminalAgent(): void {
  useEffect(() => {
    let lastAgentStatus: unknown = undefined
    let lastRetained: unknown = undefined
    let lastUnread: unknown = undefined

    const ackFocused = (): void => {
      const s = useAppStore.getState()
      if (s.settings?.agentReadOnTerminalFocus !== true) {
        return
      }
      if (document.visibilityState !== 'visible' || !document.hasFocus()) {
        return
      }
      const leafId = focusedTerminalLeafId()
      if (!leafId) {
        return
      }
      const paneKey = resolveUnreadAgentPaneKeyForLeaf(s, leafId)
      if (paneKey) {
        s.acknowledgeAgents([paneKey])
      }
    }
    // Why: a turn that finishes while its pane has focus is read the moment it lands.
    const onStoreChange = (): void => {
      const s = useAppStore.getState()
      if (
        s.agentStatusByPaneKey === lastAgentStatus &&
        s.retainedAgentsByPaneKey === lastRetained &&
        s.unreadAgentCompletionPanes === lastUnread
      ) {
        return
      }
      lastAgentStatus = s.agentStatusByPaneKey
      lastRetained = s.retainedAgentsByPaneKey
      lastUnread = s.unreadAgentCompletionPanes
      ackFocused()
    }
    // Capture phase: xterm stops keydown propagation before it reaches window bubble listeners.
    window.addEventListener('focusin', ackFocused, true)
    window.addEventListener('keydown', ackFocused, true)
    window.addEventListener('focus', ackFocused)
    onStoreChange()
    const unsubscribe = useAppStore.subscribe(onStoreChange)
    return () => {
      window.removeEventListener('focusin', ackFocused, true)
      window.removeEventListener('keydown', ackFocused, true)
      window.removeEventListener('focus', ackFocused)
      unsubscribe()
    }
  }, [])
}
