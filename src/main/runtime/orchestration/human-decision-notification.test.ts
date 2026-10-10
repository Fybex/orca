import { describe, expect, it, vi } from 'vitest'
import { notifyHumanDecisionMessage } from './human-decision-notification'

function makeRuntime() {
  return {
    dispatchPluginNotification: vi.fn(async (_input: { title: string }) => ({ delivered: true }))
  }
}

describe('notifyHumanDecisionMessage', () => {
  it('banners escalations and decision gates', () => {
    const runtime = makeRuntime()
    notifyHumanDecisionMessage(runtime, {
      type: 'decision_gate',
      subject: 'Pick the schema',
      from_handle: 'term_a'
    })
    notifyHumanDecisionMessage(runtime, {
      type: 'escalation',
      subject: 'CI red',
      from_handle: 'term_b'
    })
    expect(runtime.dispatchPluginNotification.mock.calls.map(([input]) => input.title)).toEqual([
      'Decision needed: Pick the schema',
      'Escalation: CI red'
    ])
  })

  it('stays silent for progress and reports', () => {
    const runtime = makeRuntime()
    for (const type of ['status', 'heartbeat', 'worker_done', 'dispatch', 'question'] as const) {
      notifyHumanDecisionMessage(runtime, {
        type,
        subject: 's',
        from_handle: 'term_a'
      })
    }
    expect(runtime.dispatchPluginNotification).not.toHaveBeenCalled()
  })
})
