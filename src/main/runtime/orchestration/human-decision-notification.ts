import type { MessageRow, MessageType } from './types'

const HUMAN_DECISION_TYPES: ReadonlySet<MessageType> = new Set(['escalation', 'decision_gate'])

type DecisionNotifier = {
  dispatchPluginNotification(input: {
    pluginId: string
    title: string
    body?: string
  }): Promise<{ delivered: boolean }>
}

/** Banner only the message types that wait on a human; status, heartbeat and reports stay in the mailbox. */
export function notifyHumanDecisionMessage(
  runtime: DecisionNotifier,
  message: Pick<MessageRow, 'type' | 'subject' | 'from_handle'>
): void {
  if (!HUMAN_DECISION_TYPES.has(message.type)) {
    return
  }
  const kind = message.type === 'escalation' ? 'Escalation' : 'Decision needed'
  void runtime
    .dispatchPluginNotification({
      pluginId: 'Orca',
      title: `${kind}: ${message.subject}`,
      body: `From ${message.from_handle}`
    })
    .catch(() => undefined)
}
