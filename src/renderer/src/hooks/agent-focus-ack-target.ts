import { parsePaneKey } from '../../../shared/stable-pane-id'
import {
  computeAgentAcknowledgementTargets,
  readAgentAttentionTurnStartedAt,
  resolveViewedUnreadSubjectKey,
  type AgentAttentionTurnRecords
} from '@/attention/agent-attention-acknowledgement'
import type { ReadableAgentAttentionUnread } from '@/attention/agent-attention-contract'

export type AgentFocusAckState = {
  agentStatusByPaneKey: AgentAttentionTurnRecords['liveTurns']
  retainedAgentsByPaneKey: AgentAttentionTurnRecords['retainedTurns']
  acknowledgedAgentsByPaneKey: Record<string, number>
  unreadAgentCompletionPanes: Record<string, ReadableAgentAttentionUnread>
  manuallyUnreadTurnsByPaneKey: Record<string, number>
}

/** The unread agent pane key for a focused terminal leaf, or null when nothing needs an ack. */
export function resolveUnreadAgentPaneKeyForLeaf(
  state: AgentFocusAckState,
  leafId: string
): string | null {
  const records = {
    liveTurns: state.agentStatusByPaneKey,
    retainedTurns: state.retainedAgentsByPaneKey,
    acknowledgedTurnStartedAt: state.acknowledgedAgentsByPaneKey
  }
  const candidates = new Set([
    ...Object.keys(state.agentStatusByPaneKey),
    ...Object.keys(state.retainedAgentsByPaneKey),
    ...Object.keys(state.unreadAgentCompletionPanes)
  ])
  for (const paneKey of candidates) {
    if (parsePaneKey(paneKey)?.leafId !== leafId) {
      continue
    }
    // An explicit mark-unread on this turn wins over focus until the agent takes a new turn.
    const manualTurn = state.manuallyUnreadTurnsByPaneKey[paneKey]
    if (
      manualTurn !== undefined &&
      manualTurn === readAgentAttentionTurnStartedAt(records, paneKey)
    ) {
      continue
    }
    if (
      computeAgentAcknowledgementTargets(records, paneKey).length > 0 ||
      resolveViewedUnreadSubjectKey(state.unreadAgentCompletionPanes, paneKey) !== null
    ) {
      return paneKey
    }
  }
  return null
}
